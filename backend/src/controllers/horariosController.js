const { PrismaClient } = require('@prisma/client');
const {
  agruparDiasEmpleado, diaEfectivo, parseDiasLaborales, combinar, printerPDF,
} = require('./asistenciasController');
const t = require('../lib/tiempo');
const {
  resolverTurno, evaluarDia, calcularActas, totalizar, RETARDOS_POR_ACTA,
} = require('../lib/evaluacionAsistencia');

const prisma = new PrismaClient();

/* Horarios, evaluación de puntualidad, horas extra y actas (spec 004).
 *
 * Quién puede qué:
 *   · administrador → cualquier empleado.
 *   · gerente       → solo empleados de SU sucursal. Define horarios y
 *                     asigna extras sin pedir permiso: es su trabajo diario
 *                     (spec 004 §3). Corregir MARCAS sigue necesitando la
 *                     ventana temporal que abre el administrador; eso vive en
 *                     `guardarDia` y aquí no se toca.
 * La sucursal sale de `req.usuario` (leído de la BD), nunca del cliente.
 */

const NOTA_MAX = 300;
const TURNOS_POR_PETICION = 62;   // dos meses de calendario rotativo de golpe
const EXTRA_MAX_MIN = 24 * 60;

/** Carga el empleado y comprueba el alcance. Devuelve { empleado } o { status, error }. */
async function empleadoConAlcance(req, idCrudo) {
  const id = Number(idCrudo);
  if (!Number.isInteger(id) || id <= 0) return { status: 400, error: 'Empleado inválido' };

  const empleado = await prisma.empleados.findUnique({
    where: { id },
    include: { sucursal: { select: { id: true, nombre: true, dias_laborales: true } } },
  });
  if (!empleado) return { status: 404, error: 'Empleado no encontrado' };
  if (req.usuario.rol === 'gerente' && empleado.sucursal_id !== req.usuario.sucursal_id) {
    return { status: 403, error: 'Acceso denegado' };
  }
  return { empleado };
}

/** Reglas vigentes. Si alguien borró la fila, rigen los valores de la spec. */
async function leerConfig() {
  const fila = await prisma.config_asistencia.findUnique({ where: { id: 1 } });
  return fila ?? { id: 1, tolerancia_min: 10, umbral_extra_min: 15, periodo_retardos: 'mes' };
}

/** Valida un turno entrada/salida. Devuelve el mensaje de error o null. */
function errorDeTurno(entrada, salida, etiqueta) {
  if (!t.esHora(entrada) || !t.esHora(salida)) {
    return `${etiqueta}: las horas deben tener el formato HH:MM.`;
  }
  // Sin turnos que crucen la medianoche (spec 004 §6): una salida anterior
  // a la entrada casi siempre es un error de captura, no el día siguiente.
  if (t.diferenciaMin(entrada, salida) <= 0) {
    return `${etiqueta}: la salida debe ser posterior a la entrada. Los turnos que cruzan la medianoche no se admiten.`;
  }
  return null;
}

const serializarSemanal = (filas) =>
  filas.sort((a, b) => a.dia_semana - b.dia_semana)
    .map(({ dia_semana, entrada, salida }) => ({ dia_semana, entrada, salida }));

const serializarTurno = ({ fecha, entrada, salida, descanso, asignado_por, creado_en }) =>
  ({ fecha, entrada, salida, descanso, asignado_por, creado_en });

/* ── GET /api/horarios/:empleadoId?mes=YYYY-MM ──────────────────────────
 * El horario semanal y los turnos por fecha. Con `mes`, los turnos de ese
 * mes; sin él, de hoy en adelante (lo que el editor necesita ver). */
async function obtenerHorario(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.params.empleadoId);
  if (error) return res.status(status).json({ error });

  let rango;
  if (req.query.mes) {
    if (!t.esMes(req.query.mes)) return res.status(400).json({ error: 'mes debe tener el formato YYYY-MM' });
    rango = t.rangoMes(req.query.mes);
  }

  try {
    const [semanal, turnos] = await Promise.all([
      prisma.horarios_empleado.findMany({ where: { empleado_id: empleado.id } }),
      prisma.turnos_fecha.findMany({
        where: {
          empleado_id: empleado.id,
          fecha: rango ? { gte: rango.desde, lte: rango.hasta } : { gte: t.hoyMX() },
        },
        orderBy: { fecha: 'asc' },
      }),
    ]);

    res.json({
      empleado: { id: empleado.id, nombre: empleado.nombre, sucursal: { id: empleado.sucursal.id, nombre: empleado.sucursal.nombre } },
      dias_laborales: [...parseDiasLaborales(empleado.sucursal.dias_laborales)].sort(),
      semanal: serializarSemanal(semanal),
      turnos: turnos.map(serializarTurno),
    });
  } catch (e) {
    console.error('Error al obtener el horario:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── PUT /api/horarios/:empleadoId/semanal ──────────────────────────────
 * Reemplaza el horario fijo completo: { dias: [{ dia_semana, entrada, salida }] }.
 * Un día que no viene queda sin turno fijo. Lista vacía = el empleado no
 * tiene horario fijo (p. ej. porque rota y vive de turnos por fecha).
 * Reemplazar entero, en una transacción, evita el estado a medias de ir
 * día por día. */
async function guardarSemanal(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.params.empleadoId);
  if (error) return res.status(status).json({ error });

  const dias = req.body?.dias;
  if (!Array.isArray(dias) || dias.length > 7) {
    return res.status(400).json({ error: 'Envía la lista de días con su entrada y salida.' });
  }

  const vistos = new Set();
  for (const d of dias) {
    const dia = Number(d?.dia_semana);
    if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
      return res.status(400).json({ error: 'El día de la semana debe ir de 1 (lunes) a 7 (domingo).' });
    }
    if (vistos.has(dia)) return res.status(400).json({ error: 'Hay un día de la semana repetido.' });
    vistos.add(dia);
    const mal = errorDeTurno(d.entrada, d.salida, NOMBRE_DIA[dia]);
    if (mal) return res.status(400).json({ error: mal });
  }

  try {
    const guardado = await prisma.$transaction(async (tx) => {
      await tx.horarios_empleado.deleteMany({ where: { empleado_id: empleado.id } });
      if (dias.length) {
        await tx.horarios_empleado.createMany({
          data: dias.map((d) => ({
            empleado_id: empleado.id, dia_semana: Number(d.dia_semana), entrada: d.entrada, salida: d.salida,
          })),
        });
      }
      return tx.horarios_empleado.findMany({ where: { empleado_id: empleado.id } });
    });
    res.json({ semanal: serializarSemanal(guardado) });
  } catch (e) {
    console.error('Error al guardar el horario semanal:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

const NOMBRE_DIA = [null, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/* ── PUT /api/horarios/:empleadoId/turnos ───────────────────────────────
 * Asigna turnos a fechas concretas: { turnos: [{ fecha, entrada, salida, descanso }] }.
 * Sirve igual para una excepción suelta que para cargar el mes entero de
 * alguien que rota. Si la fecha ya tenía turno, se reemplaza. */
async function guardarTurnos(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.params.empleadoId);
  if (error) return res.status(status).json({ error });

  const turnos = req.body?.turnos;
  if (!Array.isArray(turnos) || turnos.length === 0) {
    return res.status(400).json({ error: 'Indica al menos una fecha.' });
  }
  if (turnos.length > TURNOS_POR_PETICION) {
    return res.status(400).json({ error: `Se pueden asignar como máximo ${TURNOS_POR_PETICION} fechas a la vez.` });
  }

  const porFecha = new Map();
  for (const tu of turnos) {
    if (!t.esFecha(tu?.fecha)) return res.status(400).json({ error: 'Cada turno necesita una fecha válida (YYYY-MM-DD).' });
    const descanso = tu.descanso === true;
    if (!descanso) {
      const mal = errorDeTurno(tu.entrada, tu.salida, tu.fecha);
      if (mal) return res.status(400).json({ error: mal });
    }
    // La última gana si una fecha viene dos veces.
    porFecha.set(tu.fecha, {
      fecha: tu.fecha,
      descanso,
      entrada: descanso ? null : tu.entrada,
      salida: descanso ? null : tu.salida,
    });
  }

  try {
    const guardados = await prisma.$transaction([...porFecha.values()].map((tu) =>
      prisma.turnos_fecha.upsert({
        where: { empleado_id_fecha: { empleado_id: empleado.id, fecha: tu.fecha } },
        update: { entrada: tu.entrada, salida: tu.salida, descanso: tu.descanso, asignado_por: req.usuario.id },
        create: { empleado_id: empleado.id, ...tu, asignado_por: req.usuario.id },
      })
    ));
    res.json({ turnos: guardados.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(serializarTurno) });
  } catch (e) {
    console.error('Error al guardar turnos por fecha:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── DELETE /api/horarios/:empleadoId/turnos/:fecha ─────────────────────
 * Quita el turno de una fecha: el día vuelve a regirse por el horario
 * semanal (o queda sin horario, si el empleado rota). */
async function borrarTurno(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.params.empleadoId);
  if (error) return res.status(status).json({ error });
  if (!t.esFecha(req.params.fecha)) return res.status(400).json({ error: 'Fecha inválida' });

  try {
    const { count } = await prisma.turnos_fecha.deleteMany({ where: { empleado_id: empleado.id, fecha: req.params.fecha } });
    if (count === 0) return res.status(404).json({ error: 'Esa fecha no tenía turno asignado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Error al quitar el turno:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── Horas extra manuales ─────────────────────────────────────────────
 * PUT /api/asistencias/horas-extra   { empleado_id, fecha, minutos, nota }
 * DELETE /api/asistencias/horas-extra?empleado_id=&fecha=
 *
 * La extra es variable y no depende solo del checador (spec 004 §7): quien
 * lleva la cocina sabe que alguien se quedó a cubrir un evento aunque
 * olvidara marcar, o que los 40 minutos de más fueron por gusto. El valor
 * manual MANDA sobre el calculado; 0 es un valor válido (anula el
 * calculado). Borrar devuelve el día al cálculo del checador. */
async function asignarExtra(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.body?.empleado_id);
  if (error) return res.status(status).json({ error });

  const { fecha } = req.body;
  const minutos = Number(req.body?.minutos);
  const nota = String(req.body?.nota ?? '').trim() || null;

  if (!t.esFecha(fecha)) return res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD).' });
  if (!Number.isInteger(minutos) || minutos < 0 || minutos > EXTRA_MAX_MIN) {
    return res.status(400).json({ error: 'Las horas extra deben ser un número entero de minutos entre 0 y 1440.' });
  }
  if (nota && nota.length > NOTA_MAX) {
    return res.status(400).json({ error: `La nota admite como máximo ${NOTA_MAX} caracteres.` });
  }

  try {
    const fila = await prisma.horas_extra_manual.upsert({
      where: { empleado_id_fecha: { empleado_id: empleado.id, fecha } },
      update: { minutos, nota, asignado_por: req.usuario.id },
      create: { empleado_id: empleado.id, fecha, minutos, nota, asignado_por: req.usuario.id },
    });
    res.json({ empleado_id: fila.empleado_id, fecha: fila.fecha, minutos: fila.minutos, nota: fila.nota });
  } catch (e) {
    console.error('Error al asignar horas extra:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function quitarExtra(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.query.empleado_id);
  if (error) return res.status(status).json({ error });
  if (!t.esFecha(req.query.fecha)) return res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD).' });

  try {
    await prisma.horas_extra_manual.deleteMany({ where: { empleado_id: empleado.id, fecha: req.query.fecha } });
    res.json({ ok: true });
  } catch (e) {
    console.error('Error al quitar horas extra:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── Evaluación ───────────────────────────────────────────────────────
 * Junta todo lo que decide un día —turno, marcas efectivas, justificación,
 * extra manual, reglas— y lo pasa por el motor puro. Una consulta por
 * tabla para el rango completo. */
async function evaluarRango(empleado, desde, hasta, config) {
  const rangoFecha = { gte: desde, lte: hasta };
  const eid = empleado.id;

  const [semanal, turnos, punches, correcciones, justificaciones, extras] = await Promise.all([
    prisma.horarios_empleado.findMany({ where: { empleado_id: eid } }),
    prisma.turnos_fecha.findMany({ where: { empleado_id: eid, fecha: rangoFecha } }),
    prisma.asistencias.findMany({
      where: { empleado_id: eid, timestamp: { gte: combinar(desde, '00:00'), lt: combinar(t.sumarDias(hasta, 1), '00:00') } },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.correcciones_asistencia.findMany({ where: { empleado_id: eid, fecha: rangoFecha } }),
    prisma.justificaciones.findMany({ where: { empleado_id: eid, fecha: rangoFecha } }),
    prisma.horas_extra_manual.findMany({ where: { empleado_id: eid, fecha: rangoFecha } }),
  ]);

  const semanalPorDia = new Map(semanal.map((h) => [h.dia_semana, h]));
  const turnoPorFecha = new Map(turnos.map((x) => [x.fecha, x]));
  const extraPorFecha = new Map(extras.map((x) => [x.fecha, x]));
  const crudos = agruparDiasEmpleado(punches, correcciones, justificaciones);
  const laborales = parseDiasLaborales(empleado.sucursal.dias_laborales);
  const hoy = t.hoyMX();

  const dias = t.fechasEntre(desde, hasta).map((fecha) => {
    // La corrección del administrador manda sobre la marca cruda (spec §5).
    const efectivo = crudos[fecha] ? diaEfectivo(crudos[fecha]) : null;
    return evaluarDia({
      fecha,
      turno: resolverTurno(fecha, semanalPorDia, turnoPorFecha.get(fecha)),
      diaLaboral: laborales.has(t.diaSemana(fecha)),
      marcas: efectivo ?? {},
      justificacion: efectivo?.justificacion ?? null,
      extraManual: extraPorFecha.get(fecha) ?? null,
      config,
      hoy,
    });
  });

  return { dias, sinHorario: semanal.length === 0 && turnos.length === 0 };
}

/* ── GET /api/asistencias/evaluacion?empleado_id=&mes=YYYY-MM ───────────
 * Por día: estado, turno, retraso, trabajado y extra. Más los totales del
 * mes y las actas de los periodos que tocan el mes.
 *
 * Los retardos se cuentan por PERIODO, que no tiene por qué coincidir con el
 * mes pedido (con periodo semanal, la semana del 29 de septiembre al 5 de
 * octubre es una sola). Por eso se evalúa el rango ampliado hasta cubrir
 * los periodos completos, pero los días y totales que se devuelven son solo
 * los del mes. */
async function evaluacion(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.query.empleado_id);
  if (error) return res.status(status).json({ error });
  if (!t.esMes(req.query.mes)) return res.status(400).json({ error: 'mes debe tener el formato YYYY-MM' });

  try {
    const config = await leerConfig();
    const mes = t.rangoMes(req.query.mes);
    const desde = t.periodoDe(mes.desde, config.periodo_retardos).desde;
    const hasta = t.periodoDe(mes.hasta, config.periodo_retardos).hasta;

    const { dias, sinHorario } = await evaluarRango(empleado, desde, hasta, config);
    const delMes = dias.filter((d) => d.fecha >= mes.desde && d.fecha <= mes.hasta);
    const { periodos, actas } = calcularActas(dias, config.periodo_retardos);

    res.json({
      mes: req.query.mes,
      empleado: { id: empleado.id, nombre: empleado.nombre, sucursal: { id: empleado.sucursal.id, nombre: empleado.sucursal.nombre } },
      reglas: {
        tolerancia_min: config.tolerancia_min,
        umbral_extra_min: config.umbral_extra_min,
        periodo_retardos: config.periodo_retardos,
        retardos_por_acta: RETARDOS_POR_ACTA,
      },
      sin_horario_definido: sinHorario,
      dias: delMes,
      totales: totalizar(delMes),
      periodos,
      actas,
    });
  } catch (e) {
    console.error('Error al evaluar asistencia:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/asistencias/acta?empleado_id=&fecha=YYYY-MM-DD&numero=1 ───
 * El acta en PDF, para imprimirse y firmarse a mano por el empleado y por
 * el personal administrativo (spec 004 §7). `fecha` es cualquier día del
 * periodo (la evaluación entrega su `desde`) y `numero` cuál de las actas
 * del periodo, si hay más de una.
 *
 * Se genera bajo demanda desde los retardos vigentes: si un retardo se
 * justificó después, el acta ya no existe y se responde 404 en vez de
 * imprimir un papel que acusa de algo que no pasó. */
async function actaPDF(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.query.empleado_id);
  if (error) return res.status(status).json({ error });
  if (!t.esFecha(req.query.fecha)) return res.status(400).json({ error: 'Fecha inválida (YYYY-MM-DD).' });
  const numero = req.query.numero ? Number(req.query.numero) : 1;
  if (!Number.isInteger(numero) || numero < 1) return res.status(400).json({ error: 'Número de acta inválido' });

  try {
    const config = await leerConfig();
    const periodo = t.periodoDe(req.query.fecha, config.periodo_retardos);
    const { dias } = await evaluarRango(empleado, periodo.desde, periodo.hasta, config);
    const acta = calcularActas(dias, config.periodo_retardos).actas.find((a) => a.numero === numero);
    if (!acta) {
      return res.status(404).json({ error: 'No hay un acta con esos datos: el empleado no acumula los retardos necesarios en ese periodo.' });
    }

    const doc = construirActaPDF({ empleado, acta, config, generadoPor: req.usuario.nombre });
    const slug = empleado.nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'empleado';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="acta_${slug}_${acta.periodo.clave}_${numero}.pdf"`);

    const pdf = printerPDF.createPdfKitDocument(doc);
    pdf.pipe(res);
    pdf.end();
  } catch (e) {
    console.error('Error al generar el acta:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
  }
}

const NOMBRE_PERIODO = { semana: 'semana', quincena: 'quincena', mes: 'mes' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dia = NOMBRE_DIA[t.diaSemana(fecha)].toLowerCase();
  return `${dia} ${d} de ${MESES[m - 1]} de ${y}`;
}

function construirActaPDF({ empleado, acta, config, generadoPor }) {
  const hoy = t.hoyMX();
  const gris = '#5C564F';
  const borde = '#DDD8D2';

  const filas = [
    ['#', 'Fecha', 'Entrada del turno', 'Entrada registrada', 'Retraso'].map((x) => ({ text: x, bold: true, color: gris, fillColor: '#F3F0EC' })),
    ...acta.retardos.map((r, i) => [
      String(i + 1),
      fechaLarga(r.fecha),
      r.turno_entrada ?? '—',
      r.entrada ?? '—',
      `${r.retraso_min} min`,
    ]),
  ];

  const lineaFirma = (quien, detalle) => ({
    width: '*',
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8, lineColor: '#2D2926' }], margin: [0, 48, 0, 4] },
      { text: quien, bold: true, fontSize: 9.5 },
      { text: detalle, fontSize: 8.5, color: gris },
    ],
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [56, 52, 56, 52],
    defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.25 },
    content: [
      { text: 'ACTA ADMINISTRATIVA POR RETARDOS', fontSize: 15, bold: true, color: '#2D2926' },
      { text: `${empleado.sucursal.nombre}  ·  Acta ${acta.numero} del periodo`, fontSize: 10.5, bold: true, color: '#E8621A', margin: [0, 3, 0, 14] },
      {
        table: {
          widths: [120, '*'],
          body: [
            ['Empleado', { text: empleado.nombre, bold: true }],
            ['Unidad', empleado.sucursal.nombre],
            ['Periodo de conteo', `Del ${fechaLarga(acta.periodo.desde)} al ${fechaLarga(acta.periodo.hasta)} (por ${NOMBRE_PERIODO[config.periodo_retardos]})`],
            ['Fecha del acta', fechaLarga(hoy)],
          ].map(([a, b]) => [{ text: a, color: gris }, b]),
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 14],
      },
      {
        text: [
          'Se hace constar que el empleado arriba citado acumuló ',
          { text: `${RETARDOS_POR_ACTA} retardos`, bold: true },
          ' dentro del periodo indicado. Se considera retardo toda entrada registrada más de ',
          { text: `${config.tolerancia_min} minutos`, bold: true },
          ' después de la hora de entrada de su turno. Los retardos que originan esta acta son:',
        ],
        margin: [0, 0, 0, 10],
      },
      {
        table: { headerRows: 1, widths: [18, '*', 90, 96, 56], body: filas },
        layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => borde, vLineColor: () => borde,
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4,
        },
        fontSize: 9.5,
        margin: [0, 0, 0, 14],
      },
      { text: 'Observaciones:', bold: true, margin: [0, 4, 0, 4] },
      ...[0, 1, 2].map(() => ({
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.5, lineColor: borde }], margin: [0, 16, 0, 0],
      })),
      {
        text: 'El empleado firma de enterado. Su firma no implica conformidad con el contenido; puede asentar sus comentarios en las observaciones.',
        fontSize: 8.5, color: gris, margin: [0, 18, 0, 0],
      },
      {
        columns: [
          lineaFirma(empleado.nombre, 'Firma del empleado'),
          lineaFirma('Nombre y firma', 'Personal administrativo'),
        ],
        columnGap: 40,
        margin: [0, 10, 0, 0],
      },
    ],
    footer: () => ({
      text: `Generado por ${generadoPor} el ${fechaLarga(hoy)} · La Llar — Sistema de Gestión Interna`,
      alignment: 'center', fontSize: 7, color: '#B0AAA2', margin: [0, 16, 0, 0],
    }),
  };
}

module.exports = {
  obtenerHorario,
  guardarSemanal,
  guardarTurnos,
  borrarTurno,
  asignarExtra,
  quitarExtra,
  evaluacion,
  actaPDF,
  leerConfig,
};
