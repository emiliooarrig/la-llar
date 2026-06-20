const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TIPOS_JUSTIFICACION = ['vacaciones', 'incapacidad', 'permiso', 'falta_justificada'];

/* ── Helpers de fecha/hora ──────────────────────────────────
 * Todas las marcas de tiempo se tratan como "hora de pared" en UTC,
 * de modo que lo que inserta el checador (o el seed / SQL) se muestra
 * sin desplazamiento por zona horaria. */
function pad(n) {
  return String(n).padStart(2, '0');
}

function fechaDeTimestamp(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function horaDeTimestamp(date) {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

// Combina 'YYYY-MM-DD' + 'HH:MM' en un Date (hora de pared en UTC).
function combinar(fecha, hora) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
}

function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const fin = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { inicio, fin };
}

const RE_MES = /^\d{4}-\d{2}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;

/* ── GET /api/asistencias?empleado_id=&mes=YYYY-MM ───────────
 * Devuelve, para el empleado y mes indicados, un mapa de días con
 * la entrada, salida y justificación (si existe) de cada uno. */
async function mesEmpleado(req, res) {
  const empleado_id = parseInt(req.query.empleado_id);
  const mes = req.query.mes;

  if (!empleado_id) return res.status(400).json({ error: 'empleado_id es requerido' });
  if (!RE_MES.test(mes || '')) return res.status(400).json({ error: 'mes debe tener el formato YYYY-MM' });

  try {
    const empleado = await prisma.empleados.findUnique({
      where: { id: empleado_id },
      include: { sucursal: { select: { id: true, nombre: true } } },
    });
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });

    // El gerente solo puede consultar empleados de su propia unidad.
    if (req.usuario.rol === 'gerente' && empleado.sucursal_id !== req.usuario.sucursal_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { inicio, fin } = rangoMes(mes);
    const rangoFecha = { gte: `${mes}-01`, lte: `${mes}-31` };

    const [punches, correcciones, justificaciones] = await Promise.all([
      prisma.asistencias.findMany({
        where: { empleado_id, timestamp: { gte: inicio, lt: fin } },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.correcciones_asistencia.findMany({ where: { empleado_id, fecha: rangoFecha } }),
      prisma.justificaciones.findMany({ where: { empleado_id, fecha: rangoFecha } }),
    ]);

    // Día = marcas crudas del checador + capa de corrección + justificación.
    const dias = {};
    const obtenerDia = (fecha) => {
      if (!dias[fecha]) dias[fecha] = { fecha, rawEntrada: null, rawSalida: null, correccion: null, justificacion: null };
      return dias[fecha];
    };

    for (const p of punches) {
      const dia = obtenerDia(fechaDeTimestamp(p.timestamp));
      const hora = horaDeTimestamp(p.timestamp);
      if (p.tipo === 'entrada') {
        if (!dia.rawEntrada || hora < dia.rawEntrada) dia.rawEntrada = hora; // primera entrada
      } else {
        if (!dia.rawSalida || hora > dia.rawSalida) dia.rawSalida = hora; // última salida
      }
    }

    for (const c of correcciones) {
      obtenerDia(c.fecha).correccion = { entrada: c.entrada, salida: c.salida };
    }
    for (const j of justificaciones) {
      obtenerDia(j.fecha).justificacion = { tipo: j.tipo, nota: j.nota };
    }

    // Valores efectivos: corrección si existe, si no las marcas crudas.
    const resultado = Object.values(dias).map((d) => {
      const corregido = !!d.correccion;
      return {
        fecha: d.fecha,
        entrada: corregido ? d.correccion.entrada : d.rawEntrada,
        salida: corregido ? d.correccion.salida : d.rawSalida,
        corregido,
        original: corregido ? { entrada: d.rawEntrada, salida: d.rawSalida } : null,
        justificacion: d.justificacion,
      };
    });

    res.json({
      mes,
      empleado: { id: empleado.id, nombre: empleado.nombre, sucursal: empleado.sucursal },
      dias: resultado.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    });
  } catch (e) {
    console.error('Error al obtener asistencias del mes:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Calcula la entrada/salida cruda (primera entrada, última salida) del día
// a partir de las marcas del checador, sin modificarlas.
async function marcasCrudasDelDia(empleado_id, fecha) {
  const inicio = combinar(fecha, '00:00');
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const punches = await prisma.asistencias.findMany({
    where: { empleado_id, timestamp: { gte: inicio, lt: fin } },
  });
  let entrada = null, salida = null;
  for (const p of punches) {
    const hora = horaDeTimestamp(p.timestamp);
    if (p.tipo === 'entrada') { if (!entrada || hora < entrada) entrada = hora; }
    else { if (!salida || hora > salida) salida = hora; }
  }
  return { entrada, salida };
}

/* ── PUT /api/asistencias/dia ────────────────────────────────
 * El administrador corrige la entrada/salida y/o justifica un día.
 * NO se tocan las marcas crudas del checador (tabla `asistencias`):
 * la corrección se guarda como una capa aparte y sobreescribe la
 * vista. Con { revertir: true } se elimina la corrección y el día
 * vuelve a mostrar las marcas originales. */
async function guardarDia(req, res) {
  const { empleado_id, fecha, revertir } = req.body;
  let { entrada, salida, justificacion } = req.body;

  if (!empleado_id) return res.status(400).json({ error: 'empleado_id es requerido' });
  if (!RE_FECHA.test(fecha || '')) return res.status(400).json({ error: 'fecha debe tener el formato YYYY-MM-DD' });

  entrada = entrada?.trim() || null;
  salida = salida?.trim() || null;
  if (!revertir) {
    if (entrada && !RE_HORA.test(entrada)) return res.status(400).json({ error: 'La hora de entrada debe tener el formato HH:MM' });
    if (salida && !RE_HORA.test(salida)) return res.status(400).json({ error: 'La hora de salida debe tener el formato HH:MM' });
    if (entrada && salida && salida < entrada) {
      return res.status(400).json({ error: 'La salida no puede ser anterior a la entrada' });
    }
  }

  const tipoJustificacion = justificacion?.tipo || null;
  if (tipoJustificacion && !TIPOS_JUSTIFICACION.includes(tipoJustificacion)) {
    return res.status(400).json({ error: 'Tipo de justificación inválido' });
  }

  try {
    const empleado = await prisma.empleados.findUnique({ where: { id: parseInt(empleado_id) } });
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
    const eid = empleado.id;

    await prisma.$transaction(async (tx) => {
      // Capa de corrección (sin tocar las marcas crudas del checador).
      if (revertir) {
        await tx.correcciones_asistencia.deleteMany({ where: { empleado_id: eid, fecha } });
      } else {
        await tx.correcciones_asistencia.upsert({
          where: { empleado_id_fecha: { empleado_id: eid, fecha } },
          update: { entrada, salida, corregido_por: req.usuario.id },
          create: { empleado_id: eid, fecha, entrada, salida, corregido_por: req.usuario.id },
        });
      }

      // Justificación del día.
      if (tipoJustificacion) {
        await tx.justificaciones.upsert({
          where: { empleado_id_fecha: { empleado_id: eid, fecha } },
          update: { tipo: tipoJustificacion, nota: justificacion.nota?.trim() || null, creado_por: req.usuario.id },
          create: { empleado_id: eid, fecha, tipo: tipoJustificacion, nota: justificacion.nota?.trim() || null, creado_por: req.usuario.id },
        });
      } else {
        await tx.justificaciones.deleteMany({ where: { empleado_id: eid, fecha } });
      }
    });

    // Respuesta con valores efectivos (corrección si aplica, si no las crudas).
    const raw = await marcasCrudasDelDia(eid, fecha);
    const corregido = !revertir;
    res.json({
      fecha,
      entrada: corregido ? entrada : raw.entrada,
      salida: corregido ? salida : raw.salida,
      corregido,
      original: corregido ? raw : null,
      justificacion: tipoJustificacion ? { tipo: tipoJustificacion, nota: justificacion.nota?.trim() || null } : null,
    });
  } catch (e) {
    console.error('Error al guardar el día:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { mesEmpleado, guardarDia };
