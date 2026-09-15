#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
 * Generador de datos de MUESTRA para la demo en vivo.
 *
 * NO forma parte de `prisma/seed.js`: son datos desechables que se
 * cargan sobre una base ya sembrada y se pueden revertir con el
 * script `revertir-demo.sql` que este mismo generador emite.
 *
 * Produce dos cosas:
 *   1. Los PDFs reales en `backend/uploads/` (pdfmake), para que la
 *      vista previa y la descarga funcionen durante la demo.
 *   2. `demo-agosto-2026.sql` con los INSERT correspondientes.
 *
 * Uso:  node scripts/demo/generar-demo.js
 * ───────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PdfPrinter = require('pdfmake');

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const SALIDA_SQL = path.join(__dirname, 'demo-agosto-2026.sql');
const SALIDA_REVERT = path.join(__dirname, 'revertir-demo.sql');

/* Marca que permite borrar exactamente lo que este script insertó, sin
   tocar los datos de la semilla ni lo que se capture durante la demo. */
const MES = '2026-08';
const RANGO_DESDE = '2026-08-01 00:00:00';
const RANGO_HASTA = '2026-09-01 00:00:00';

/* ── Utilidades ─────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
const fecha = d => `${MES}-${pad(d)}`;
const sql = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

// PRNG determinista: volver a correr el script produce el mismo SQL.
function prng(semilla) {
  let h = 1779033703 ^ semilla.length;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Nombre de archivo estable a partir de su clave lógica.
function uuidDe(clave) {
  const h = crypto.createHash('sha1').update(clave).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// Día ISO (1=Lunes … 7=Domingo) de un día de agosto de 2026.
const isoDe = d => { const n = new Date(Date.UTC(2026, 7, d)).getUTCDay(); return n === 0 ? 7 : n; };

// Minutos → 'HH:MM'.
const hhmm = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/* ── Plantilla de Cocina Central ────────────────────────────── */
const DIAS_MES = 31;
const SUCURSAL = { id: 1, nombre: 'Cocina Central' };

/* Cada empleado con su turno y sus incidencias. Entre los cuatro cubren
   todos los estados que el calendario sabe pintar: completo, incompleto,
   justificado (vacaciones / incapacidad / permiso / falta justificada) y
   falta sin justificar. */
const PLANTILLA = [
  {
    id: 1, nombre: 'Ana García Martínez',
    entrada: 7 * 60, salida: 15 * 60,
    // Periodo vacacional completo: lunes 10 a sábado 15.
    justificados: [
      { dias: [10, 11, 12, 13, 14, 15], tipo: 'vacaciones', nota: 'Periodo vacacional 2026 (6 días).' },
    ],
    incompletos: [{ dia: 4, falta: 'salida' }],  // olvidó checar la salida
    faltas: [],
  },
  {
    id: 2, nombre: 'Luis Hernández López',
    entrada: 14 * 60, salida: 22 * 60,
    justificados: [
      { dias: [17, 18, 19], tipo: 'incapacidad', nota: 'Incapacidad IMSS folio 4471-26.' },
    ],
    incompletos: [{ dia: 7, falta: 'entrada' }], // llegó y no checó entrada
    faltas: [25],                                 // ausencia sin justificar
  },
  {
    id: 9, nombre: 'Elena Vargas Núñez',
    entrada: 6 * 60, salida: 14 * 60,
    justificados: [
      { dias: [6], tipo: 'permiso', nota: 'Permiso por trámite personal.' },
      { dias: [20], tipo: 'permiso', nota: 'Permiso por cita médica familiar.' },
    ],
    incompletos: [{ dia: 22, falta: 'salida' }],
    faltas: [],
  },
  {
    id: 16, nombre: 'Emilio Arriaga Guzman',
    entrada: 8 * 60, salida: 16 * 60,
    justificados: [
      { dias: [28], tipo: 'falta_justificada', nota: 'Ausencia autorizada por la gerencia.' },
    ],
    incompletos: [{ dia: 31, falta: 'salida' }],
    faltas: [],
  },
];

/* ── Marcas de asistencia ───────────────────────────────────── */
function generarAsistencias() {
  const filas = [];
  const justificaciones = [];

  for (const emp of PLANTILLA) {
    const rnd = prng(`asistencias-${emp.id}`);
    const diasJustificados = new Set(emp.justificados.flatMap(j => j.dias));
    const diasFalta = new Set(emp.faltas);
    const incompletos = new Map(emp.incompletos.map(i => [i.dia, i.falta]));

    for (const j of emp.justificados) {
      for (const dia of j.dias) {
        justificaciones.push({ empleado_id: emp.id, fecha: fecha(dia), tipo: j.tipo, nota: j.nota });
      }
    }

    for (let dia = 1; dia <= DIAS_MES; dia++) {
      if (isoDe(dia) === 7) continue;                 // domingo: la unidad no abre
      if (diasJustificados.has(dia)) continue;        // día justificado: sin marcas
      if (diasFalta.has(dia)) continue;               // ausencia: sin marcas

      const faltante = incompletos.get(dia);

      // Jitter realista: se llega entre 8 min antes y 9 después; se sale
      // entre 2 y 26 min después del turno.
      const entrada = emp.entrada + Math.round(rnd() * 17) - 8;
      const salida = emp.salida + 2 + Math.round(rnd() * 24);

      if (faltante !== 'entrada') {
        filas.push({ empleado_id: emp.id, tipo: 'entrada', ts: `${fecha(dia)} ${hhmm(entrada)}:00` });
      }
      if (faltante !== 'salida') {
        filas.push({ empleado_id: emp.id, tipo: 'salida', ts: `${fecha(dia)} ${hhmm(salida)}:00` });
      }
    }
  }

  return { filas, justificaciones };
}

/* Dos días corregidos a mano por el administrador, para que la demo pueda
   enseñar el punto naranja del calendario y la capa de auditoría. */
const CORRECCIONES = [
  { empleado_id: 9, fecha: fecha(22), entrada: '06:00', salida: '14:05' },  // cierra el día incompleto
  { empleado_id: 1, fecha: fecha(5), entrada: '07:00', salida: '15:00' },   // ajuste de horario
];

/* ── Documentos ─────────────────────────────────────────────── */
const NOTA_MUESTRA = 'DOCUMENTO DE MUESTRA · generado para la demostración del sistema. Sin validez oficial.';

const DOCS_PROVEEDOR = [
  { proveedor_id: 1, titular: 'Distribuidora Alimentos del Norte SA de CV', subido_por: 2, docs: [
    { nombre: 'Constancia_Situacion_Fiscal_2026.pdf', tipo: 'fiscal', estado: 'aprobado', creado: '2026-08-06 10:12:00' },
    { nombre: 'Factura_Agosto_2026.pdf', tipo: 'factura', estado: 'pendiente', creado: '2026-09-07 09:40:00' },
  ] },
  { proveedor_id: 2, titular: 'Carnes y Embutidos Hernández', subido_por: 3, docs: [
    { nombre: 'Certificado_Sanitario_2026.pdf', tipo: 'sanitario', estado: 'aprobado', creado: '2026-08-11 12:30:00' },
    { nombre: 'Lista_Precios_Septiembre_2026.pdf', tipo: 'precios', estado: 'pendiente', creado: '2026-09-09 16:05:00' },
  ] },
  { proveedor_id: 3, titular: 'Verduras Orgánicas del Valle', subido_por: 4, docs: [
    { nombre: 'Constancia_Situacion_Fiscal_2026.pdf', tipo: 'fiscal', estado: 'aprobado', encabezado: true, creado: '2026-08-04 08:55:00' },
    { nombre: 'Poliza_Responsabilidad_Civil_2026.pdf', tipo: 'poliza', estado: 'pendiente', creado: '2026-09-03 11:20:00' },
  ] },
  { proveedor_id: 4, titular: 'Lácteos La Fuente', subido_por: 5, docs: [
    { nombre: 'Certificado_Sanitario_2026.pdf', tipo: 'sanitario', estado: 'desaprobado', creado: '2026-08-18 15:44:00' },
    { nombre: 'Factura_Agosto_2026.pdf', tipo: 'factura', estado: 'pendiente', creado: '2026-09-08 13:15:00' },
  ] },
  // Este proveedor no tiene usuario propio: lo subió el administrador.
  { proveedor_id: 6, titular: 'Distribuidora Herdez', subido_por: 1, docs: [
    { nombre: 'Contrato_Suministro_2026.pdf', tipo: 'contrato', estado: 'aprobado', creado: '2026-08-21 09:05:00' },
    { nombre: 'Constancia_Situacion_Fiscal_2026.pdf', tipo: 'fiscal', estado: 'pendiente', creado: '2026-09-10 10:50:00' },
  ] },
];

const DOCS_UNIDAD = [
  { sucursal_id: 1, titular: 'Cocina Central', subido_por: 6, docs: [
    { nombre: 'Bitacora_Limpieza_Agosto_2026.pdf', tipo: 'bitacora', estado: 'aprobado', creado: '2026-08-31 18:20:00' },
    { nombre: 'Control_Temperaturas_Agosto_2026.pdf', tipo: 'temperaturas', estado: 'pendiente', creado: '2026-09-05 17:10:00' },
  ] },
  { sucursal_id: 2, titular: 'Sucursal Norte', subido_por: 7, docs: [
    { nombre: 'Acta_Fumigacion_2026.pdf', tipo: 'fumigacion', estado: 'aprobado', creado: '2026-08-14 11:00:00' },
    { nombre: 'Bitacora_Limpieza_Agosto_2026.pdf', tipo: 'bitacora', estado: 'pendiente', creado: '2026-09-04 19:30:00' },
  ] },
  { sucursal_id: 3, titular: 'Sucursal Sur', subido_por: 8, docs: [
    { nombre: 'Bitacora_Limpieza_Agosto_2026.pdf', tipo: 'bitacora', estado: 'desaprobado', creado: '2026-08-29 20:05:00' },
    { nombre: 'Inventario_Cierre_Agosto_2026.pdf', tipo: 'inventario', estado: 'pendiente', creado: '2026-09-06 14:25:00' },
  ] },
  { sucursal_id: 4, titular: 'Sucursal Oriente', subido_por: 9, docs: [
    { nombre: 'Control_Temperaturas_Agosto_2026.pdf', tipo: 'temperaturas', estado: 'aprobado', creado: '2026-08-30 16:40:00' },
    { nombre: 'Inventario_Cierre_Agosto_2026.pdf', tipo: 'inventario', estado: 'pendiente', creado: '2026-09-09 12:00:00' },
  ] },
];

/* ── Contenido de cada tipo de PDF ──────────────────────────── */
const CUERPOS = {
  fiscal: () => ({
    subtitulo: 'Constancia de situación fiscal',
    parrafo: 'Documento de respaldo fiscal del proveedor para el ejercicio 2026, entregado al área de compras como parte del expediente de alta.',
    tabla: [['Concepto', 'Dato'], ['Ejercicio', '2026'], ['Régimen', 'Personas morales'], ['Estatus del padrón', 'Activo'], ['Última actualización', 'Agosto 2026']],
  }),
  factura: () => ({
    subtitulo: 'Relación de facturas · agosto 2026',
    parrafo: 'Resumen de los comprobantes emitidos durante el periodo, entregado para conciliación con el área administrativa.',
    tabla: [['Folio', 'Fecha', 'Concepto', 'Importe'],
      ['A-4471', '05/08/2026', 'Suministro semanal', '$ 18,420.00'],
      ['A-4488', '12/08/2026', 'Suministro semanal', '$ 17,050.00'],
      ['A-4503', '19/08/2026', 'Suministro semanal', '$ 19,730.00'],
      ['A-4519', '26/08/2026', 'Suministro semanal', '$ 16,890.00'],
      ['', '', 'Total del periodo', '$ 72,090.00']],
  }),
  sanitario: () => ({
    subtitulo: 'Certificado sanitario',
    parrafo: 'Constancia de cumplimiento de las condiciones sanitarias de manejo, almacenamiento y transporte de los productos suministrados.',
    tabla: [['Rubro', 'Resultado'], ['Cadena de frío', 'Conforme'], ['Transporte', 'Conforme'], ['Manejo de empaque', 'Conforme'], ['Vigencia', 'Agosto 2026 – agosto 2027']],
  }),
  precios: () => ({
    subtitulo: 'Lista de precios · septiembre 2026',
    parrafo: 'Precios vigentes para el periodo indicado. Sustituye a cualquier lista anterior.',
    tabla: [['Clave', 'Descripción', 'Unidad', 'Precio'],
      ['C-101', 'Producto de línea A', 'kg', '$ 148.00'],
      ['C-118', 'Producto de línea B', 'kg', '$ 96.50'],
      ['C-204', 'Producto de línea C', 'caja', '$ 412.00'],
      ['C-230', 'Producto de línea D', 'pieza', '$ 37.90']],
  }),
  poliza: () => ({
    subtitulo: 'Póliza de responsabilidad civil',
    parrafo: 'Carátula de la póliza contratada por el proveedor, requisito del expediente de alta.',
    tabla: [['Concepto', 'Dato'], ['Número de póliza', 'RC-2026-08814'], ['Cobertura', 'Responsabilidad civil general'], ['Suma asegurada', '$ 2,000,000.00'], ['Vigencia', '01/08/2026 – 31/07/2027']],
  }),
  contrato: () => ({
    subtitulo: 'Contrato de suministro 2026',
    parrafo: 'Condiciones generales de suministro acordadas para el ejercicio en curso: periodicidad de entrega, plazos de pago y niveles de servicio.',
    tabla: [['Cláusula', 'Condición'], ['Periodicidad', 'Entrega semanal'], ['Plazo de pago', '30 días naturales'], ['Nivel de servicio', '95% de pedidos completos'], ['Vigencia', 'Enero – diciembre 2026']],
  }),
  bitacora: () => ({
    subtitulo: 'Bitácora de limpieza · agosto 2026',
    parrafo: 'Registro de las rutinas de limpieza profunda realizadas en la unidad durante el mes, con el responsable de cada jornada.',
    tabla: [['Semana', 'Área', 'Responsable', 'Estado'],
      ['1 al 8', 'Cocina caliente', 'Turno matutino', 'Completada'],
      ['10 al 15', 'Cámaras de frío', 'Turno matutino', 'Completada'],
      ['17 al 22', 'Almacén seco', 'Turno vespertino', 'Completada'],
      ['24 al 31', 'Área de lavado', 'Turno vespertino', 'Completada']],
  }),
  temperaturas: () => ({
    subtitulo: 'Control de temperaturas · agosto 2026',
    parrafo: 'Lecturas de referencia de los equipos de refrigeración y congelación de la unidad, tomadas al inicio y al cierre de cada jornada.',
    tabla: [['Equipo', 'Rango objetivo', 'Promedio del mes', 'Estado'],
      ['Cámara de refrigeración 1', '2 °C a 4 °C', '3.1 °C', 'Dentro de rango'],
      ['Cámara de refrigeración 2', '2 °C a 4 °C', '3.6 °C', 'Dentro de rango'],
      ['Congelador principal', '-18 °C a -15 °C', '-16.8 °C', 'Dentro de rango'],
      ['Barra fría de servicio', '4 °C a 6 °C', '5.2 °C', 'Dentro de rango']],
  }),
  inventario: () => ({
    subtitulo: 'Inventario de cierre · agosto 2026',
    parrafo: 'Conteo físico de cierre de mes cotejado contra el sistema. Las diferencias se reportan al área de compras.',
    tabla: [['Categoría', 'Sistema', 'Físico', 'Diferencia'],
      ['Abarrotes', '412', '410', '-2'],
      ['Cárnicos', '188', '188', '0'],
      ['Lácteos', '96', '95', '-1'],
      ['Verdura y fruta', '241', '243', '+2'],
      ['Desechables', '530', '530', '0']],
  }),
  fumigacion: () => ({
    subtitulo: 'Acta de fumigación',
    parrafo: 'Constancia del servicio de control de plagas aplicado en la unidad, con el detalle de las áreas atendidas.',
    tabla: [['Concepto', 'Dato'], ['Fecha del servicio', '14/08/2026'], ['Áreas atendidas', 'Cocina, almacén, comedor'], ['Método', 'Aspersión y cebaderos'], ['Próximo servicio', 'Noviembre 2026']],
  }),
};

/* ── Generación de los PDF ──────────────────────────────────── */
const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica', bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique',
  },
});

const NARANJA = '#E8621A';
const TEXTO = '#2D2926';
const SUAVE = '#6B6560';
const GRIS = '#D1CEC9';

function construirPdf({ titular, nombreArchivo, cuerpo, creado }) {
  const columnas = cuerpo.tabla[0].length;

  return {
    pageSize: 'LETTER',
    pageMargins: [56, 56, 56, 64],
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: TEXTO },
    content: [
      { text: 'LA LLAR', fontSize: 9, bold: true, color: NARANJA, characterSpacing: 1.6 },
      { text: 'Sistema de Gestión Interna', fontSize: 8.5, color: SUAVE, margin: [0, 2, 0, 14] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 1.2, lineColor: GRIS }] },
      { text: cuerpo.subtitulo, fontSize: 17, bold: true, margin: [0, 18, 0, 4] },
      { text: titular, fontSize: 11, color: SUAVE, margin: [0, 0, 0, 16] },
      { text: cuerpo.parrafo, fontSize: 10, color: SUAVE, lineHeight: 1.35, margin: [0, 0, 0, 18] },
      {
        table: {
          headerRows: 1,
          widths: Array(columnas).fill('*'),
          body: cuerpo.tabla.map((fila, i) =>
            fila.map(celda => ({
              text: celda,
              bold: i === 0,
              fontSize: i === 0 ? 8.5 : 10,
              color: i === 0 ? SUAVE : TEXTO,
              margin: [0, 5, 0, 5],
            }))),
        },
        layout: {
          hLineWidth: i => (i === 0 || i === 1 ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: i => (i <= 1 ? GRIS : '#F2F0ED'),
          paddingLeft: () => 8, paddingRight: () => 8,
        },
        margin: [0, 0, 0, 22],
      },
      { text: `Archivo: ${nombreArchivo}`, fontSize: 8.5, color: SUAVE },
      { text: `Fecha del documento: ${creado.slice(0, 10).split('-').reverse().join('/')}`, fontSize: 8.5, color: SUAVE },
    ],
    footer: () => ({
      text: NOTA_MUESTRA,
      fontSize: 7.5, color: SUAVE, alignment: 'center', margin: [56, 16, 56, 0],
    }),
  };
}

function escribirPdf(destino, definicion) {
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(definicion);
    const stream = fs.createWriteStream(destino);
    doc.pipe(stream);
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/* ── Programa principal ─────────────────────────────────────── */
(async () => {
  if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

  const { filas, justificaciones } = generarAsistencias();
  const archivos = [];

  // Documentos: se escribe el PDF y se guarda la fila que lo referencia.
  const filasProveedor = [];
  for (const grupo of DOCS_PROVEEDOR) {
    for (const d of grupo.docs) {
      const uuid = uuidDe(`prov-${grupo.proveedor_id}-${d.nombre}`);
      const archivo = `${uuid}.pdf`;
      await escribirPdf(path.join(UPLOADS, archivo), construirPdf({
        titular: grupo.titular, nombreArchivo: d.nombre,
        cuerpo: CUERPOS[d.tipo](), creado: d.creado,
      }));
      archivos.push(archivo);
      filasProveedor.push({ ...d, proveedor_id: grupo.proveedor_id, subido_por: grupo.subido_por, archivo });
    }
  }

  const filasUnidad = [];
  for (const grupo of DOCS_UNIDAD) {
    for (const d of grupo.docs) {
      const uuid = uuidDe(`unid-${grupo.sucursal_id}-${d.nombre}`);
      const archivo = `${uuid}.pdf`;
      await escribirPdf(path.join(UPLOADS, archivo), construirPdf({
        titular: grupo.titular, nombreArchivo: d.nombre,
        cuerpo: CUERPOS[d.tipo](), creado: d.creado,
      }));
      archivos.push(archivo);
      filasUnidad.push({ ...d, sucursal_id: grupo.sucursal_id, subido_por: grupo.subido_por, archivo });
    }
  }

  /* ── SQL de carga ──────────────────────────────────────── */
  const L = [];
  L.push('-- ─────────────────────────────────────────────────────────────');
  L.push('-- Datos de MUESTRA para la demostración en vivo del sistema.');
  L.push('-- Generado por scripts/demo/generar-demo.js — NO editar a mano.');
  L.push('--');
  L.push('-- Contenido:');
  L.push(`--   · Asistencias de agosto 2026 para ${PLANTILLA.length} empleados de ${SUCURSAL.nombre}`);
  L.push('--   · Justificaciones (vacaciones, incapacidad, permisos, falta justificada)');
  L.push('--   · Dos días corregidos a mano por el administrador');
  L.push(`--   · ${filasProveedor.length} documentos de proveedor y ${filasUnidad.length} de unidad (PDFs en backend/uploads/)`);
  L.push('--');
  L.push('-- Para deshacerlo: mysql la_llar < scripts/demo/revertir-demo.sql');
  L.push('-- ─────────────────────────────────────────────────────────────');
  L.push('');
  L.push('START TRANSACTION;');
  L.push('');

  L.push('-- ── Marcas del checador (timestamp = hora de pared en UTC) ──');
  L.push('INSERT INTO asistencias (empleado_id, sucursal_id, tipo, timestamp) VALUES');
  L.push(filas.map(f => `  (${f.empleado_id}, ${SUCURSAL.id}, ${sql(f.tipo)}, ${sql(f.ts)})`).join(',\n') + ';');
  L.push('');

  L.push('-- ── Justificaciones (creado_por = 1, administrador) ──');
  L.push('INSERT INTO justificaciones (empleado_id, fecha, tipo, nota, creado_por, creado_en) VALUES');
  L.push(justificaciones.map(j =>
    `  (${j.empleado_id}, ${sql(j.fecha)}, ${sql(j.tipo)}, ${sql(j.nota)}, 1, ${sql(`${j.fecha} 09:00:00`)})`
  ).join(',\n') + ';');
  L.push('');

  L.push('-- ── Correcciones manuales del administrador ──');
  L.push('-- Sobreescriben el día en la vista; las marcas crudas no se tocan.');
  L.push('INSERT INTO correcciones_asistencia (empleado_id, fecha, entrada, salida, corregido_por, creado_en) VALUES');
  L.push(CORRECCIONES.map(c =>
    `  (${c.empleado_id}, ${sql(c.fecha)}, ${sql(c.entrada)}, ${sql(c.salida)}, 1, ${sql(`${c.fecha} 18:30:00`)})`
  ).join(',\n') + ';');
  L.push('');

  L.push('-- ── Documentos de proveedor ──');
  L.push('INSERT INTO documentos_proveedor (proveedor_id, nombre_original, ruta_archivo, tipo_mime, subido_por, estado, creado_en) VALUES');
  L.push(filasProveedor.map(d =>
    `  (${d.proveedor_id}, ${sql(d.nombre)}, ${sql(d.archivo)}, 'application/pdf', ${d.subido_por}, ${sql(d.estado)}, ${sql(d.creado)})`
  ).join(',\n') + ';');
  L.push('');

  L.push('-- ── Documentos de unidad ──');
  L.push('INSERT INTO documentos_unidad (sucursal_id, nombre_original, ruta_archivo, tipo_mime, subido_por, estado, creado_en) VALUES');
  L.push(filasUnidad.map(d =>
    `  (${d.sucursal_id}, ${sql(d.nombre)}, ${sql(d.archivo)}, 'application/pdf', ${d.subido_por}, ${sql(d.estado)}, ${sql(d.creado)})`
  ).join(',\n') + ';');
  L.push('');
  L.push('COMMIT;');
  L.push('');

  fs.writeFileSync(SALIDA_SQL, L.join('\n'), 'utf8');

  /* ── SQL de reversión ──────────────────────────────────── */
  const R = [];
  R.push('-- Deshace exactamente lo que insertó demo-agosto-2026.sql.');
  R.push('-- No toca los datos de la semilla ni lo capturado durante la demo.');
  R.push('');
  R.push('START TRANSACTION;');
  R.push('');
  R.push(`DELETE FROM asistencias WHERE sucursal_id = ${SUCURSAL.id}`);
  R.push(`  AND timestamp >= ${sql(RANGO_DESDE)} AND timestamp < ${sql(RANGO_HASTA)};`);
  R.push('');
  R.push(`DELETE FROM justificaciones WHERE fecha LIKE ${sql(`${MES}-%`)}`);
  R.push(`  AND empleado_id IN (${PLANTILLA.map(e => e.id).join(', ')});`);
  R.push('');
  R.push(`DELETE FROM correcciones_asistencia WHERE fecha LIKE ${sql(`${MES}-%`)}`);
  R.push(`  AND empleado_id IN (${PLANTILLA.map(e => e.id).join(', ')});`);
  R.push('');
  R.push('DELETE FROM documentos_proveedor WHERE ruta_archivo IN (');
  R.push(filasProveedor.map(d => `  ${sql(d.archivo)}`).join(',\n'));
  R.push(');');
  R.push('');
  R.push('DELETE FROM documentos_unidad WHERE ruta_archivo IN (');
  R.push(filasUnidad.map(d => `  ${sql(d.archivo)}`).join(',\n'));
  R.push(');');
  R.push('');
  R.push('COMMIT;');
  R.push('');
  R.push('-- Los PDFs quedan en backend/uploads/. Para borrarlos también:');
  R.push('--   cd backend/uploads && rm ' + archivos.map(a => a.slice(0, 8) + '*').join(' '));
  R.push('');
  fs.writeFileSync(SALIDA_REVERT, R.join('\n'), 'utf8');

  console.log(`PDFs escritos en uploads/      ${archivos.length}`);
  console.log(`Marcas de asistencia           ${filas.length}`);
  console.log(`Justificaciones                ${justificaciones.length}`);
  console.log(`Correcciones                   ${CORRECCIONES.length}`);
  console.log(`Documentos proveedor / unidad  ${filasProveedor.length} / ${filasUnidad.length}`);
  console.log(`\nSQL:      ${path.relative(process.cwd(), SALIDA_SQL)}`);
  console.log(`Reversión:${path.relative(process.cwd(), SALIDA_REVERT)}`);
})().catch(e => { console.error(e); process.exit(1); });
