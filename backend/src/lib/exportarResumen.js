const ExcelJS = require('exceljs');
const PdfPrinter = require('pdfmake');
const { formatearMoneda } = require('./resumenFacturas');

/* Exportación del resumen semanal a Excel y a PDF (spec 001 HU-9).
 *
 * Los dos formatos salen de la MISMA estructura que devuelve el endpoint en
 * JSON, y por el mismo camino: es la única forma de que el criterio de
 * aceptación —"Excel y PDF con los mismos datos"— se cumpla solo, en vez de
 * depender de que alguien recuerde tocar tres sitios al añadir una columna.
 */

const COLUMNAS = [
  { clave: 'proveedor',           titulo: 'Proveedor',        ancho: 32, anchoPdf: 90 },
  { clave: 'empresa',             titulo: 'Empresa',          ancho: 18, anchoPdf: 60 },
  { clave: 'serie_folio',         titulo: 'Serie-Folio',      ancho: 14, anchoPdf: 45 },
  { clave: 'uuid_fiscal',         titulo: 'Folio fiscal',     ancho: 38, anchoPdf: 125 },
  { clave: 'fecha_cfdi',          titulo: 'Fecha factura',    ancho: 13, anchoPdf: 48 },
  { clave: 'fecha_aprobacion',    titulo: 'Aprobación',       ancho: 13, anchoPdf: 48 },
  { clave: 'dias_credito',        titulo: 'Días crédito',     ancho: 12, anchoPdf: 40 },
  { clave: 'fecha_pago_estimada', titulo: 'Pago estimado',    ancho: 14, anchoPdf: 48 },
  { clave: 'total',               titulo: 'Total',            ancho: 14, anchoPdf: 52 },
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** Encabezado que identifica de qué es este papel. Sin empresa y periodo, dos
 *  exportaciones distintas son indistinguibles sobre una mesa. */
function encabezado({ empresa, desde, hasta }) {
  return {
    titulo: 'Resumen de facturas aprobadas',
    empresa: empresa || 'Todas las empresas',
    periodo: `Del ${fechaLarga(desde)} al ${fechaLarga(hasta)}`,
    generado: new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }),
  };
}

function valorCelda(fila, clave) {
  const valor = fila[clave];
  if (clave === 'dias_credito') {
    return fila.dias_credito_sin_configurar ? `${valor} (sin configurar)` : String(valor);
  }
  return valor ?? '—';
}

/* ── Excel ───────────────────────────────────────────────────────────── */
async function aExcel(resumen, meta) {
  const cab = encabezado(meta);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Gestión La Llar';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Facturas aprobadas', {
    views: [{ state: 'frozen', ySplit: 5 }],   // el encabezado no se pierde al bajar
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  hoja.columns = COLUMNAS.map((c) => ({ key: c.clave, width: c.ancho }));

  const ultima = COLUMNAS.length;
  const tituloFila = hoja.addRow([cab.titulo]);
  tituloFila.font = { size: 14, bold: true };
  hoja.mergeCells(1, 1, 1, ultima);

  const empresaFila = hoja.addRow([cab.empresa]);
  empresaFila.font = { size: 11, bold: true };
  hoja.mergeCells(2, 1, 2, ultima);

  const periodoFila = hoja.addRow([cab.periodo]);
  periodoFila.font = { size: 10, color: { argb: 'FF666666' } };
  hoja.mergeCells(3, 1, 3, ultima);

  hoja.addRow([]);

  const cabecera = hoja.addRow(COLUMNAS.map((c) => c.titulo));
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC75B12' } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  for (const fila of resumen.filas) {
    const valores = COLUMNAS.map((c) => (c.clave === 'total' ? Number(fila.total) : valorCelda(fila, c.clave)));
    const agregada = hoja.addRow(valores);
    // El total va como NÚMERO, no como texto: en una hoja de cálculo, quien
    // la reciba querrá sumar la columna sin volver a teclearla.
    agregada.getCell(COLUMNAS.findIndex((c) => c.clave === 'total') + 1).numFmt = '"$"#,##0.00';
  }

  hoja.addRow([]);
  for (const total of resumen.totales.por_moneda) {
    const fila = hoja.addRow([
      `Total ${total.moneda} (${resumen.totales.facturas} factura${resumen.totales.facturas === 1 ? '' : 's'})`,
      ...Array(COLUMNAS.length - 2).fill(''),
      Number(total.total),
    ]);
    fila.font = { bold: true };
    fila.getCell(COLUMNAS.length).numFmt = '"$"#,##0.00';
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

/* ── PDF ─────────────────────────────────────────────────────────────── */
/* Las fuentes estándar (AFM) que PDFKit lleva dentro, igual que el reporte de
 * asistencias: no hay que empaquetar ningún .ttf ni depender de lo que haya
 * instalado en el servidor, y WinAnsi cubre los acentos del español. */
const FUENTES_PDF = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
const printer = new PdfPrinter(FUENTES_PDF);

function aPDF(resumen, meta) {
  const cab = encabezado(meta);

  const cuerpo = [
    COLUMNAS.map((c) => ({ text: c.titulo, style: 'th' })),
    ...resumen.filas.map((fila) =>
      COLUMNAS.map((c) => ({
        text: c.clave === 'total' ? formatearMoneda(fila.total) : valorCelda(fila, c.clave),
        style: c.clave === 'total' ? 'tdNum' : 'td',
      }))
    ),
  ];

  if (resumen.filas.length === 0) {
    cuerpo.push([{ text: 'No hay facturas aprobadas en este periodo.', colSpan: COLUMNAS.length, style: 'vacio' },
      ...Array(COLUMNAS.length - 1).fill({})]);
  }

  const totales = resumen.totales.por_moneda.map((t) => [
    { text: `Total ${t.moneda}`, colSpan: COLUMNAS.length - 1, style: 'thTotal' },
    ...Array(COLUMNAS.length - 2).fill({}),
    { text: formatearMoneda(t.total), style: 'thTotal', alignment: 'right' },
  ]);

  const definicion = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [28, 32, 28, 40],
    defaultStyle: { font: 'Helvetica' },
    info: { title: `${cab.titulo} — ${cab.empresa}`, author: 'Sistema de Gestión La Llar' },
    content: [
      { text: cab.titulo, style: 'titulo' },
      { text: cab.empresa, style: 'empresa' },
      { text: cab.periodo, style: 'periodo' },
      {
        style: 'tabla',
        table: { headerRows: 1, widths: COLUMNAS.map((c) => c.anchoPdf), body: [...cuerpo, ...totales] },
        layout: {
          hLineWidth: (i, nodo) => (i === 0 || i === 1 || i === nodo.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: (i) => (i <= 1 ? '#C75B12' : '#E3DDD6'),
          fillColor: (i) => (i === 0 ? '#C75B12' : i % 2 === 0 ? '#FAF8F6' : null),
          paddingTop: () => 5, paddingBottom: () => 5,
        },
      },
      resumen.totales.sin_configurar > 0
        ? {
            text: `${resumen.totales.sin_configurar} factura(s) son de proveedores sin días de crédito configurados: ` +
                  'su fecha de pago estimada se calculó como de contado.',
            style: 'nota',
          }
        : null,
    ].filter(Boolean),
    footer: (pagina, total) => ({
      columns: [
        { text: `Generado el ${cab.generado}`, style: 'pie' },
        { text: `Página ${pagina} de ${total}`, style: 'pie', alignment: 'right' },
      ],
      margin: [28, 8, 28, 0],
    }),
    styles: {
      titulo:  { fontSize: 15, bold: true, color: '#2B2724' },
      empresa: { fontSize: 11.5, bold: true, color: '#C75B12', margin: [0, 3, 0, 0] },
      periodo: { fontSize: 9.5, color: '#6B6560', margin: [0, 2, 0, 12] },
      tabla:   { fontSize: 7.5 },
      th:      { bold: true, color: '#FFFFFF', fontSize: 7.5, margin: [2, 0, 2, 0] },
      thTotal: { bold: true, fontSize: 8.5, color: '#2B2724', margin: [2, 0, 2, 0] },
      td:      { fontSize: 7.5, color: '#2B2724', margin: [2, 0, 2, 0] },
      tdNum:   { fontSize: 7.5, color: '#2B2724', alignment: 'right', margin: [2, 0, 2, 0] },
      vacio:   { fontSize: 9, color: '#6B6560', alignment: 'center', margin: [0, 10, 0, 10] },
      nota:    { fontSize: 8, color: '#8A6D3B', margin: [0, 10, 0, 0], italics: true },
      pie:     { fontSize: 7.5, color: '#8C8580' },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = printer.createPdfKitDocument(definicion);
      const trozos = [];
      doc.on('data', (t) => trozos.push(t));
      doc.on('end', () => resolve(Buffer.concat(trozos)));
      doc.on('error', reject);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/** Nombre de archivo estable y ordenable: quien exporte cuatro semanas
 *  seguidas quiere verlas en orden en su carpeta de descargas. */
function nombreArchivo({ empresa, desde, hasta }, extension) {
  const trozo = (empresa || 'todas')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `resumen-facturas_${trozo}_${desde}_${hasta}.${extension}`;
}

module.exports = { aExcel, aPDF, nombreArchivo, COLUMNAS };
