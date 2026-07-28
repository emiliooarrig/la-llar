const { PrismaClient } = require('@prisma/client');
const PdfPrinter = require('pdfmake');
const { calcularAbierta } = require('./ventanasController');

const prisma = new PrismaClient();

const TIPOS_JUSTIFICACION = ['vacaciones', 'incapacidad', 'permiso', 'falta_justificada'];

// El reporte PDF usa las fuentes estándar (AFM) integradas en PDFKit, así no
// hay que empaquetar archivos de fuente. WinAnsi cubre los acentos del español.
const FUENTES_PDF = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
const printerPDF = new PdfPrinter(FUENTES_PDF);

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

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

/* ── Helpers compartidos de días/horas ──────────────────────
 * Reutilizados por la vista mensual (mesEmpleado) y por el reporte PDF. */

// "1,2,3,4,5,6" → Set{1..7} (ISO: 1=Lunes … 7=Domingo). Fallback: Lun–Sáb.
function parseDiasLaborales(str) {
  if (!str) return new Set([1, 2, 3, 4, 5, 6]);
  const dias = String(str).split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 7);
  return new Set(dias.length ? dias : [1, 2, 3, 4, 5, 6]);
}

// Día ISO (1=Lunes … 7=Domingo) de una fecha 'YYYY-MM-DD' (hora de pared UTC).
function isoDeFecha(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

// Fecha local de hoy como 'YYYY-MM-DD'.
function hoyStr() {
  const h = new Date();
  return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`;
}

// Matriz de semanas (lunes a domingo) del mes 'YYYY-MM'. Celda = { dia, fecha } o null.
function construirSemanasMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1));
  const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (primero.getUTCDay() + 6) % 7; // 0 = lunes

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push({ dia: d, fecha: `${mes}-${pad(d)}` });
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

// Minutos trabajados del día = última salida − primera entrada (0 si falta alguna).
function minutosTrabajados(dia) {
  if (!dia?.entrada || !dia?.salida) return 0;
  const [eh, em] = dia.entrada.split(':').map(Number);
  const [sh, sm] = dia.salida.split(':').map(Number);
  const diff = (sh * 60 + sm) - (eh * 60 + em);
  return diff > 0 ? diff : 0;
}

// Minutos → "Xh Ym" (omite minutos en 0).
function formatearHoras(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0 && m === 0) return '0h';
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* Agrupa marcas/correcciones/justificaciones de UN empleado en un mapa
 * fecha → { fecha, rawEntrada, rawSalida, correccion, justificacion }. */
function agruparDiasEmpleado(punches, correcciones, justificaciones) {
  const dias = {};
  const obtenerDia = (fecha) => {
    if (!dias[fecha]) dias[fecha] = { fecha, rawEntrada: null, rawSalida: null, correccion: null, justificacion: null };
    return dias[fecha];
  };

  for (const p of punches) {
    const dia = obtenerDia(fechaDeTimestamp(p.timestamp));
    const hora = horaDeTimestamp(p.timestamp);
    if (p.tipo === 'entrada') {
      if (!dia.rawEntrada || hora < dia.rawEntrada) dia.rawEntrada = hora;
    } else {
      if (!dia.rawSalida || hora > dia.rawSalida) dia.rawSalida = hora;
    }
  }
  for (const c of correcciones) obtenerDia(c.fecha).correccion = { entrada: c.entrada, salida: c.salida };
  for (const j of justificaciones) obtenerDia(j.fecha).justificacion = { tipo: j.tipo, nota: j.nota };
  return dias;
}

// Valores efectivos de un día: corrección si existe, si no las marcas crudas.
function diaEfectivo(d) {
  const corregido = !!d.correccion;
  return {
    fecha: d.fecha,
    entrada: corregido ? d.correccion.entrada : d.rawEntrada,
    salida: corregido ? d.correccion.salida : d.rawSalida,
    corregido,
    original: corregido ? { entrada: d.rawEntrada, salida: d.rawSalida } : null,
    justificacion: d.justificacion,
  };
}

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
    const dias = agruparDiasEmpleado(punches, correcciones, justificaciones);
    const resultado = Object.values(dias).map(diaEfectivo);

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
 * Corrige la entrada/salida y/o justifica un día. El administrador
 * siempre puede; el gerente solo sobre empleados de su unidad y
 * mientras la ventana `asistencias` esté abierta (permiso temporal
 * que otorga el administrador). Revertir es exclusivo del admin.
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

    if (req.usuario.rol === 'gerente') {
      // Revertir borra una corrección (posiblemente hecha por el admin): solo admin.
      if (revertir) return res.status(403).json({ error: 'Solo el administrador puede revertir correcciones' });
      if (empleado.sucursal_id !== req.usuario.sucursal_id) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      const ventana = await prisma.ventanas_carga.findUnique({ where: { modulo: 'asistencias' } });
      if (!ventana || !calcularAbierta(ventana)) {
        return res.status(403).json({ error: 'El permiso de edición de asistencias no está vigente. Solicítalo al administrador.' });
      }
    }

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

/* ── Reporte PDF de la unidad ────────────────────────────────
 * Clasifica el día de un empleado en un estado visual para el reporte. */
function clasificarDia(dia, fecha, diasLaborales, hoy) {
  if (dia?.justificacion) return 'justificada';
  if (dia?.entrada && dia?.salida) return 'completa';
  if (dia?.entrada || dia?.salida) return 'incompleta';
  if (!diasLaborales.has(isoDeFecha(fecha))) return 'noLaboral';
  if (fecha < hoy) return 'falta';
  return 'sinDatos'; // hoy o futuro sin registro todavía
}

const MARCAS = {
  completa:    { texto: 'P', color: '#1B7A34' },
  incompleta:  { texto: 'I', color: '#B7791F' },
  justificada: { texto: 'J', color: '#1565C0' },
  falta:       { texto: 'F', color: '#C62828' },
  noLaboral:   { texto: '–', color: '#B0AAA2' }, // guion medio
  sinDatos:    { texto: '', color: '#000000' },
};

const GRIS_ENCABEZADO = '#F3F0EC';
const GRIS_BORDE = '#DDD8D2';

function layoutTablaReporte() {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => GRIS_BORDE,
    vLineColor: () => GRIS_BORDE,
    paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3,
  };
}

function leyendaReporte() {
  const items = [
    ['P', 'Presente', '#1B7A34'],
    ['I', 'Incompleta', '#B7791F'],
    ['J', 'Justificada', '#1565C0'],
    ['F', 'Falta', '#C62828'],
    ['–', 'No laboral', '#B0AAA2'],
  ];
  return items.map(([m, txt, color]) => ({
    width: 'auto',
    text: [{ text: `${m} `, bold: true, color }, { text: txt, color: '#5C564F' }],
    fontSize: 8,
  }));
}

// Construye la definición de documento pdfmake para el reporte de una unidad.
function construirReportePDF({ sucursal, mes, semanas, datosEmp, diasLaborales, hoy }) {
  const [anio, numMes] = mes.split('-').map(Number);
  const nombreMes = NOMBRES_MES[numMes - 1];
  const diasLista = [...diasLaborales].sort((a, b) => a - b).map((n) => DIAS_SEMANA_CORTO[n - 1]).join(', ');

  const content = [
    { text: 'Reporte de Asistencias', style: 'titulo' },
    { text: `${sucursal.nombre}  ·  ${nombreMes} ${anio}`, style: 'subtitulo' },
    {
      text: `Generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`
        + `  ·  ${datosEmp.length} empleado(s)  ·  Días laborales: ${diasLista}`,
      style: 'meta', margin: [0, 0, 0, 8],
    },
    { columns: leyendaReporte(), columnGap: 12, margin: [0, 0, 0, 12] },
  ];

  if (datosEmp.length === 0) {
    content.push({ text: 'Esta unidad no tiene empleados activos.', italics: true, color: '#8A847D', margin: [0, 20, 0, 0] });
    return documentoBase(content);
  }

  // Acumuladores mensuales por empleado.
  const mensual = new Map(datosEmp.map((d) => [d.emp.id, { horas: 0, completos: 0, incompletos: 0, justificados: 0, faltas: 0 }]));

  const thDia = (txt) => ({ text: txt, bold: true, fontSize: 7.5, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO });

  semanas.forEach((semana, wi) => {
    const reales = semana.filter(Boolean);
    if (reales.length === 0) return;

    // Encabezado: Empleado | 7 días (abrev + número) | Horas
    const header = [{ text: 'Empleado', bold: true, fontSize: 8, color: '#5C564F', fillColor: GRIS_ENCABEZADO }];
    for (let j = 0; j < 7; j++) {
      const cell = semana[j];
      header.push(thDia(cell ? `${DIAS_SEMANA_CORTO[j]}\n${cell.dia}` : ''));
    }
    header.push({ text: 'Horas', bold: true, fontSize: 8, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO });

    const body = [header];
    let totalSemanaMin = 0;

    for (const { emp, mapa } of datosEmp) {
      const acc = mensual.get(emp.id);
      const fila = [{ text: emp.nombre, fontSize: 8 }];
      let minSemana = 0;

      for (let j = 0; j < 7; j++) {
        const cell = semana[j];
        if (!cell) { fila.push({ text: '', fontSize: 8 }); continue; }
        const dia = mapa[cell.fecha];
        const estado = clasificarDia(dia, cell.fecha, diasLaborales, hoy);
        const marca = MARCAS[estado];
        minSemana += minutosTrabajados(dia);
        if (estado === 'completa') acc.completos++;
        else if (estado === 'incompleta') acc.incompletos++;
        else if (estado === 'justificada') acc.justificados++;
        else if (estado === 'falta') acc.faltas++;
        fila.push({ text: marca.texto, color: marca.color, bold: estado === 'falta', alignment: 'center', fontSize: 8 });
      }

      acc.horas += minSemana;
      totalSemanaMin += minSemana;
      fila.push({ text: formatearHoras(minSemana), bold: true, alignment: 'center', fontSize: 8 });
      body.push(fila);
    }

    // Total de horas de la semana para toda la unidad.
    body.push([
      { text: 'Total de la unidad', bold: true, alignment: 'right', fillColor: GRIS_ENCABEZADO, colSpan: 8 },
      {}, {}, {}, {}, {}, {}, {},
      { text: formatearHoras(totalSemanaMin), bold: true, alignment: 'center', fillColor: GRIS_ENCABEZADO },
    ]);

    content.push({ text: `Semana ${wi + 1} · del ${reales[0].dia} al ${reales[reales.length - 1].dia} de ${nombreMes}`, style: 'semana', margin: [0, wi === 0 ? 4 : 12, 0, 4] });
    content.push({ table: { headerRows: 1, widths: ['*', ...Array(7).fill(26), 44], body }, layout: layoutTablaReporte() });
  });

  // Resumen mensual consolidado.
  const bodyRes = [[
    { text: 'Empleado', bold: true, fontSize: 8, color: '#5C564F', fillColor: GRIS_ENCABEZADO },
    { text: 'Horas del mes', bold: true, fontSize: 8, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO },
    { text: 'Completos', bold: true, fontSize: 8, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO },
    { text: 'Incompletos', bold: true, fontSize: 8, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO },
    { text: 'Justificados', bold: true, fontSize: 8, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO },
    { text: 'Faltas', bold: true, fontSize: 8, color: '#5C564F', alignment: 'center', fillColor: GRIS_ENCABEZADO },
  ]];

  let totMin = 0, totFaltas = 0;
  for (const { emp } of datosEmp) {
    const a = mensual.get(emp.id);
    totMin += a.horas; totFaltas += a.faltas;
    bodyRes.push([
      { text: emp.nombre, fontSize: 8 },
      { text: formatearHoras(a.horas), bold: true, alignment: 'center', fontSize: 8 },
      { text: String(a.completos), alignment: 'center', fontSize: 8 },
      { text: String(a.incompletos), alignment: 'center', fontSize: 8 },
      { text: String(a.justificados), alignment: 'center', fontSize: 8 },
      { text: String(a.faltas), alignment: 'center', fontSize: 8, color: a.faltas > 0 ? '#C62828' : '#000000', bold: a.faltas > 0 },
    ]);
  }
  bodyRes.push([
    { text: 'Total de la unidad', bold: true, alignment: 'right', fillColor: GRIS_ENCABEZADO },
    { text: formatearHoras(totMin), bold: true, alignment: 'center', fillColor: GRIS_ENCABEZADO },
    { text: '', fillColor: GRIS_ENCABEZADO },
    { text: '', fillColor: GRIS_ENCABEZADO },
    { text: '', fillColor: GRIS_ENCABEZADO },
    { text: String(totFaltas), bold: true, alignment: 'center', fillColor: GRIS_ENCABEZADO },
  ]);

  content.push({ text: 'Resumen mensual', style: 'semana', margin: [0, 16, 0, 4] });
  content.push({ table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'], body: bodyRes }, layout: layoutTablaReporte() });

  return documentoBase(content);
}

function documentoBase(content) {
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 30, 28, 34],
    defaultStyle: { font: 'Helvetica', fontSize: 8 },
    footer: (cur, tot) => ({ text: `Página ${cur} de ${tot}`, alignment: 'center', fontSize: 7, color: '#B0AAA2', margin: [0, 8, 0, 0] }),
    content,
    styles: {
      titulo: { fontSize: 16, bold: true, color: '#2D2926' },
      subtitulo: { fontSize: 11, bold: true, color: '#E8621A', margin: [0, 2, 0, 2] },
      meta: { fontSize: 8, color: '#8A847D' },
      semana: { fontSize: 10, bold: true, color: '#2D2926' },
    },
  };
}

/* ── GET /api/asistencias/reporte?sucursal_id=&mes=YYYY-MM ────
 * Genera y descarga el reporte PDF de asistencias de toda la unidad. */
async function reporteUnidad(req, res) {
  const sucursal_id = parseInt(req.query.sucursal_id);
  const mes = req.query.mes;

  if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido' });
  if (!RE_MES.test(mes || '')) return res.status(400).json({ error: 'mes debe tener el formato YYYY-MM' });

  // El gerente solo puede generar el reporte de su propia unidad.
  if (req.usuario.rol === 'gerente' && req.usuario.sucursal_id !== sucursal_id) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const sucursal = await prisma.sucursales.findUnique({ where: { id: sucursal_id } });
    if (!sucursal) return res.status(404).json({ error: 'Unidad no encontrada' });

    const empleados = await prisma.empleados.findMany({
      where: { sucursal_id, activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });

    const { inicio, fin } = rangoMes(mes);
    const rangoFecha = { gte: `${mes}-01`, lte: `${mes}-31` };
    const ids = empleados.map((e) => e.id);

    // Una sola consulta por tabla para toda la unidad; luego se agrupa por empleado.
    const [punches, correcciones, justificaciones] = ids.length
      ? await Promise.all([
          prisma.asistencias.findMany({ where: { empleado_id: { in: ids }, timestamp: { gte: inicio, lt: fin } }, orderBy: { timestamp: 'asc' } }),
          prisma.correcciones_asistencia.findMany({ where: { empleado_id: { in: ids }, fecha: rangoFecha } }),
          prisma.justificaciones.findMany({ where: { empleado_id: { in: ids }, fecha: rangoFecha } }),
        ])
      : [[], [], []];

    const porEmp = new Map(ids.map((id) => [id, { punches: [], correcciones: [], justificaciones: [] }]));
    for (const p of punches) porEmp.get(p.empleado_id)?.punches.push(p);
    for (const c of correcciones) porEmp.get(c.empleado_id)?.correcciones.push(c);
    for (const j of justificaciones) porEmp.get(j.empleado_id)?.justificaciones.push(j);

    const datosEmp = empleados.map((emp) => {
      const g = porEmp.get(emp.id);
      const raw = agruparDiasEmpleado(g.punches, g.correcciones, g.justificaciones);
      const mapa = {};
      for (const f of Object.keys(raw)) mapa[f] = diaEfectivo(raw[f]);
      return { emp, mapa };
    });

    const docDefinition = construirReportePDF({
      sucursal,
      mes,
      semanas: construirSemanasMes(mes),
      datosEmp,
      diasLaborales: parseDiasLaborales(sucursal.dias_laborales),
      hoy: hoyStr(),
    });

    const slug = sucursal.nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'unidad';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${slug}_${mes}.pdf"`);

    const pdfDoc = printerPDF.createPdfKitDocument(docDefinition);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (e) {
    console.error('Error al generar el reporte PDF:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { mesEmpleado, guardarDia, reporteUnidad };
