const path = require('node:path');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { printerPDF } = require('./asistenciasController');
const { leerConfig, empleadoConAlcance, evaluarRango } = require('./horariosController');
const { calcularActas, totalizar, RETARDOS_POR_ACTA } = require('../lib/evaluacionAsistencia');
const { construirResumenPDF } = require('../lib/resumenPDF');
const { UPLOADS_DIR } = require('../middleware/upload');
const t = require('../lib/tiempo');

const prisma = new PrismaClient();

/* Resumen semanal de asistencia por empleado (spec 005).
 *
 * Es DERIVADO de la evaluación de la spec 004 (§5): no aplica reglas por su
 * cuenta, solo corta el resultado del mismo motor por la semana de la
 * unidad y lo totaliza. El JSON que pinta la pantalla es exactamente lo que
 * recibe el generador del PDF, así que los números no pueden discrepar.
 *
 * Tres salidas:
 *   · JSON / PDF bajo demanda — no guarda nada.
 *   · «Mandar al Histórico» — el mismo PDF con folio, archivado en
 *     `documentos_historicos` (origen `asistencia`).
 *   · Lote — el PDF de toda una unidad, una página por empleado.
 *
 * Quién: administrador (cualquiera) y gerente (su unidad). El empleado no
 * tiene acceso (spec 005 §7).
 */

/** La semana de la unidad que contiene `fecha`. */
function semanaDe(fecha, sucursal) {
  const inicio = t.inicioSemanaDe(fecha, sucursal.inicio_semana || 1);
  return { inicio, fin: t.sumarDias(inicio, 6) };
}

/**
 * Arma el resumen de un empleado para la semana que contiene `fecha`.
 *
 * Evalúa un rango más ancho que la semana: el acta se decide por periodo
 * (hoy el mes) y la semana de una unidad puede cruzar de un mes a otro. Se
 * evalúan los periodos completos para contar bien los retardos, y luego se
 * recorta a los 7 días.
 */
async function construirResumen(empleado, fecha, config) {
  const semana = semanaDe(fecha, empleado.sucursal);
  const desde = [semana.inicio, t.periodoDe(semana.inicio, config.periodo_retardos).desde].sort()[0];
  const hasta = [semana.fin, t.periodoDe(semana.fin, config.periodo_retardos).hasta].sort()[1];

  const { dias, sinHorario } = await evaluarRango(empleado, desde, hasta, config);
  const diasSemana = dias.filter((d) => d.fecha >= semana.inicio && d.fecha <= semana.fin);

  /* Las actas son las de la spec 004, no un conteo nuevo de "3 en la
   * semana": se señalan las que incluyen algún retardo de esta semana. Si el
   * resumen contara por su cuenta, podría decir "acta" donde la pantalla de
   * puntualidad no la ve, o al revés. */
  const actas = calcularActas(dias, config.periodo_retardos).actas
    .filter((a) => a.retardos.some((r) => r.fecha >= semana.inicio && r.fecha <= semana.fin));

  return {
    empleado: { id: empleado.id, nombre: empleado.nombre, lector_uid: empleado.lector_uid },
    sucursal: {
      id: empleado.sucursal.id,
      nombre: empleado.sucursal.nombre,
      inicio_semana: empleado.sucursal.inicio_semana || 1,
      empresa: empleado.sucursal.empresa?.nombre ?? null,
    },
    semana,
    reglas: {
      tolerancia_min: config.tolerancia_min,
      umbral_extra_min: config.umbral_extra_min,
      periodo_retardos: config.periodo_retardos,
      retardos_por_acta: RETARDOS_POR_ACTA,
    },
    sin_horario_definido: sinHorario,
    dias: diasSemana,
    totales: {
      ...totalizar(diasSemana),
      // "Trabajado" = hay entrada ese día (plan §4), con o sin turno.
      dias_trabajados: diasSemana.filter((d) => d.entrada).length,
    },
    actas,
  };
}

/** Renderiza la definición pdfmake a un Buffer. */
function pdfABuffer(definicion) {
  return new Promise((resolve, reject) => {
    const doc = printerPDF.createPdfKitDocument(definicion);
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    doc.end();
  });
}

const slug = (texto) => texto.normalize('NFD').replace(/[^\x20-\x7e]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'empleado';

function enviarPDF(res, buffer, nombre) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

/* ── GET /api/asistencias/resumen?empleado_id=&semana=YYYY-MM-DD&formato=json|pdf
 * `semana` es cualquier día de la semana deseada; se ajusta al día de
 * arranque de la unidad del empleado. */
async function resumen(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.query.empleado_id);
  if (error) return res.status(status).json({ error });
  if (!t.esFecha(req.query.semana)) return res.status(400).json({ error: 'semana debe ser una fecha YYYY-MM-DD' });
  const formato = req.query.formato || 'json';
  if (!['json', 'pdf'].includes(formato)) return res.status(400).json({ error: "formato debe ser 'json' o 'pdf'" });

  try {
    const config = await leerConfig();
    const datos = await construirResumen(empleado, req.query.semana, config);
    if (formato === 'json') return res.json(datos);

    const buffer = await pdfABuffer(construirResumenPDF([datos], { firmaRRHH: req.usuario.nombre, generadoEn: t.hoyMX() }));
    enviarPDF(res, buffer, `resumen_${slug(empleado.nombre)}_${datos.semana.inicio}.pdf`);
  } catch (e) {
    console.error('Error al generar el resumen semanal:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/asistencias/resumen/historico  { empleado_id, semana } ────
 * Genera el resumen con folio y lo archiva en el Histórico (spec 005 §7).
 *
 * El folio es el id de la fila del Histórico, así que primero se crea la
 * fila y luego se escribe el archivo con ese folio impreso. Si la escritura
 * falla, la fila se borra: un registro sin archivo es un hueco en el
 * archivo que nadie sabría explicar.
 *
 * Mandar dos veces la misma semana es válido —p. ej. tras corregir un
 * día— y deja dos folios: el papel firmado lleva el suyo impreso. */
async function mandarAlHistorico(req, res) {
  const { empleado, status, error } = await empleadoConAlcance(req, req.body?.empleado_id);
  if (error) return res.status(status).json({ error });
  if (!t.esFecha(req.body?.semana)) return res.status(400).json({ error: 'semana debe ser una fecha YYYY-MM-DD' });

  let fila = null;
  const archivo = `${uuidv4()}.pdf`;
  try {
    const config = await leerConfig();
    const datos = await construirResumen(empleado, req.body.semana, config);
    const nombre = `Resumen semanal - ${empleado.nombre} - ${datos.semana.inicio} al ${datos.semana.fin}.pdf`.slice(0, 255);

    fila = await prisma.documentos_historicos.create({
      data: {
        origen: 'asistencia',
        origen_id: empleado.id,
        origen_nombre: `${empleado.nombre} · ${empleado.sucursal.nombre}`.slice(0, 150),
        nombre_original: nombre,
        ruta_archivo: archivo,
        tipo_mime: 'application/pdf',
        subido_por: req.usuario.id,
        subido_en: new Date(),
        aprobado_por: req.usuario.id,
      },
    });

    const folio = `RS-${String(fila.id).padStart(6, '0')}`;
    const buffer = await pdfABuffer(construirResumenPDF([datos], { firmaRRHH: req.usuario.nombre, folio, generadoEn: t.hoyMX() }));
    await fs.promises.writeFile(path.join(UPLOADS_DIR, archivo), buffer);

    res.status(201).json({ id: fila.id, folio, nombre_original: nombre, semana: datos.semana });
  } catch (e) {
    if (fila) await prisma.documentos_historicos.delete({ where: { id: fila.id } }).catch(() => {});
    await fs.promises.unlink(path.join(UPLOADS_DIR, archivo)).catch(() => {});
    console.error('Error al mandar el resumen al histórico:', e);
    res.status(500).json({ error: 'No se pudo archivar el resumen' });
  }
}

/* ── GET /api/asistencias/resumen/lote?sucursal_id=&semana=YYYY-MM-DD ────
 * Todos los empleados activos de una unidad en un solo PDF, una página por
 * empleado (T-505): la impresión de cada semana para recoger firmas. */
async function resumenLote(req, res) {
  const sucursalId = Number(req.query.sucursal_id);
  if (!Number.isInteger(sucursalId) || sucursalId <= 0) return res.status(400).json({ error: 'Unidad inválida' });
  if (!t.esFecha(req.query.semana)) return res.status(400).json({ error: 'semana debe ser una fecha YYYY-MM-DD' });
  if (req.usuario.rol === 'gerente' && req.usuario.sucursal_id !== sucursalId) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const empleados = await prisma.empleados.findMany({
      where: { sucursal_id: sucursalId, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        sucursal: {
          select: {
            id: true, nombre: true, dias_laborales: true, inicio_semana: true,
            empresa: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (empleados.length === 0) {
      const existe = await prisma.sucursales.findUnique({ where: { id: sucursalId }, select: { id: true } });
      return res.status(existe ? 400 : 404).json({
        error: existe ? 'La unidad no tiene empleados activos.' : 'Unidad no encontrada',
      });
    }

    const config = await leerConfig();
    const resumenes = [];
    for (const emp of empleados) resumenes.push(await construirResumen(emp, req.query.semana, config));

    const buffer = await pdfABuffer(construirResumenPDF(resumenes, { firmaRRHH: req.usuario.nombre, generadoEn: t.hoyMX() }));
    enviarPDF(res, buffer, `resumenes_${slug(empleados[0].sucursal.nombre)}_${resumenes[0].semana.inicio}.pdf`);
  } catch (e) {
    console.error('Error al generar los resúmenes de la unidad:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { resumen, mandarAlHistorico, resumenLote, construirResumen, semanaDe };
