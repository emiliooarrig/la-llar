const { diaSemana } = require('./tiempo');

/* PDF del resumen semanal de asistencia (spec 005, T-503).
 *
 * Construye la definición pdfmake a partir del MISMO objeto que devuelve el
 * endpoint JSON y pinta la pantalla. No recalcula nada: si el PDF sacara
 * sus propias cuentas, tarde o temprano el papel que firma el empleado
 * diría otra cosa que lo que el gerente vio (plan §6).
 *
 * Una página por empleado. La impresión por lote de una unidad es la misma
 * función con varios resúmenes.
 */

const DIAS = [null, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ETIQUETA_ESTADO = {
  puntual: 'Puntual',
  retardo: 'Retardo',
  falta: 'Falta',
  incompleto: 'Incompleto',
  pendiente: 'Pendiente',
  sin_horario: 'Sin horario',
  descanso: 'Descanso',
  justificado: 'Justificado',
};
const COLOR_ESTADO = {
  puntual: '#1B7A34',
  retardo: '#B7791F',
  falta: '#C62828',
  justificado: '#1565C0',
};
const ETIQUETA_JUSTIFICACION = {
  vacaciones: 'Vacaciones', incapacidad: 'Incapacidad', permiso: 'Permiso', falta_justificada: 'Falta justificada',
};

const GRIS = '#5C564F';
const GRIS_CLARO = '#8A847D';
const BORDE = '#DDD8D2';
const FONDO = '#F3F0EC';

function fechaCorta(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

function fechaLarga(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** Minutos → "7h 30m" / "45m" / "—". */
function horas(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Texto de la columna Estado, con el detalle que hace falta para firmarlo. */
function textoEstado(d) {
  if (d.estado === 'justificado' && d.justificacion) {
    return ETIQUETA_JUSTIFICACION[d.justificacion.tipo] ?? 'Justificado';
  }
  if (d.estado === 'retardo') return `Retardo (+${d.retraso_min} min)`;
  return ETIQUETA_ESTADO[d.estado] ?? d.estado;
}

/** Filas de la tabla diaria. Exportada para poder comprobar en las pruebas
 *  que el PDF dice lo mismo que el JSON. */
function filasTabla(resumen) {
  return resumen.dias.map((d) => [
    `${DIAS[diaSemana(d.fecha)]} ${fechaCorta(d.fecha)}`,
    d.turno ? `${d.turno.entrada}–${d.turno.salida}` : d.turno_descanso ? 'Descanso' : '—',
    d.entrada ?? '—',
    d.salida ?? '—',
    textoEstado(d),
    horas(d.trabajado_min),
    d.extra_min ? `${horas(d.extra_min)}${d.extra_fuente === 'manual' ? '*' : ''}` : '—',
  ]);
}

/** Totales al pie, en el orden de la HU-1. También exportada para las pruebas. */
function filasTotales(resumen) {
  const t = resumen.totales;
  return [
    ['Días trabajados', String(t.dias_trabajados)],
    ['Retardos', String(t.retardo)],
    ['Faltas', String(t.falta)],
    ['Horas trabajadas', horas(t.trabajado_min)],
    ['Horas extra', horas(t.extra_min)],
  ];
}

function paginaEmpleado(resumen, { firmaRRHH, folio }) {
  const { empleado, sucursal, semana, reglas } = resumen;
  const cabeceras = ['Día', 'Horario', 'Entrada', 'Salida', 'Estado', 'Horas', 'Extra']
    .map((x) => ({ text: x, bold: true, color: GRIS, fillColor: FONDO, fontSize: 8.5 }));

  const cuerpo = [cabeceras, ...filasTabla(resumen).map((fila, i) => {
    const d = resumen.dias[i];
    return fila.map((celda, j) => ({
      text: celda,
      fontSize: 9,
      color: j === 4 ? COLOR_ESTADO[d.estado] ?? '#2D2926' : '#2D2926',
      bold: j === 4 && (d.estado === 'retardo' || d.estado === 'falta'),
      alignment: j >= 2 && j !== 4 ? 'center' : 'left',
    }));
  })];

  const totales = filasTotales(resumen);

  const contenido = [
    {
      columns: [
        { stack: [
          { text: 'Resumen semanal de asistencia', fontSize: 15, bold: true, color: '#2D2926' },
          { text: `Semana del ${fechaLarga(semana.inicio)} al ${fechaLarga(semana.fin)}`, fontSize: 10.5, bold: true, color: '#E8621A', margin: [0, 3, 0, 0] },
        ] },
        folio
          ? { width: 'auto', text: `Folio ${folio}`, fontSize: 9, bold: true, color: GRIS, alignment: 'right' }
          : { width: 'auto', text: '' },
      ],
      margin: [0, 0, 0, 12],
    },
    {
      table: {
        widths: [90, '*', 90, '*'],
        body: [
          [{ text: 'Empleado', color: GRIS }, { text: empleado.nombre, bold: true }, { text: 'Unidad', color: GRIS }, sucursal.nombre],
          [{ text: 'No. checador', color: GRIS }, empleado.lector_uid ?? '—', { text: 'Empresa', color: GRIS }, sucursal.empresa ?? '—'],
        ],
      },
      layout: 'noBorders',
      fontSize: 9.5,
      margin: [0, 0, 0, 12],
    },
    {
      table: { headerRows: 1, widths: [88, 70, 46, 46, '*', 46, 50], body: cuerpo },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        hLineColor: () => BORDE, vLineColor: () => BORDE,
        paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 10],
    },
    {
      columns: [
        {
          width: 220,
          table: {
            widths: ['*', 70],
            body: [
              [{ text: 'Totales de la semana', bold: true, colSpan: 2, fillColor: FONDO, color: GRIS, fontSize: 8.5 }, {}],
              ...totales.map(([a, b]) => [{ text: a, fontSize: 9 }, { text: b, fontSize: 9, bold: true, alignment: 'right' }]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            hLineColor: () => BORDE, vLineColor: () => BORDE,
            paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3,
          },
        },
        {
          width: '*',
          stack: [
            ...(resumen.actas.length
              ? [{
                  text: [
                    { text: 'Acta por retardos. ', bold: true, color: '#C62828' },
                    `En este periodo el empleado acumula ${reglas.retardos_por_acta} retardos o más `,
                    `(${resumen.actas.map((a) => a.retardos.map((r) => fechaCorta(r.fecha)).join(', ')).join(' / ')}).`,
                  ],
                  fontSize: 9,
                  margin: [0, 0, 0, 6],
                }]
              : []),
            {
              text: `Tolerancia de ${reglas.tolerancia_min} min sobre la entrada del turno. `
                + 'Horas = de la primera entrada a la última salida, sin descontar comida. '
                + 'La extra marcada con * se asignó a mano.',
              fontSize: 8, color: GRIS_CLARO,
            },
          ],
          margin: [16, 0, 0, 0],
        },
      ],
      margin: [0, 0, 0, 10],
    },
    {
      text: 'Con mi firma hago constar que revisé este resumen de mi asistencia de la semana indicada.',
      fontSize: 9, color: GRIS, margin: [0, 16, 0, 0],
    },
    {
      columns: [
        bloqueFirma(empleado.nombre, 'Firma del empleado'),
        bloqueFirma(firmaRRHH, 'Recursos Humanos'),
      ],
      columnGap: 40,
    },
  ];

  return contenido;
}

function bloqueFirma(nombre, cargo) {
  return {
    width: '*',
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: '#2D2926' }], margin: [0, 44, 0, 4] },
      { text: nombre, bold: true, fontSize: 9.5 },
      { text: cargo, fontSize: 8.5, color: GRIS },
      { text: 'Fecha: ____ / ____ / ________', fontSize: 8.5, color: GRIS, margin: [0, 8, 0, 0] },
    ],
  };
}

/**
 * Definición pdfmake de uno o varios resúmenes (uno por página).
 *
 * @param resumenes  arreglo de resúmenes tal como los devuelve el endpoint
 * @param firmaRRHH  nombre del usuario que genera el documento: firma como
 *                   personal de Recursos Humanos (spec 005 §7)
 * @param folio      folio del Histórico, solo cuando se archiva
 */
function construirResumenPDF(resumenes, { firmaRRHH, folio = null, generadoEn }) {
  const content = [];
  resumenes.forEach((r, i) => {
    const pagina = paginaEmpleado(r, { firmaRRHH, folio });
    if (i > 0) pagina[0] = { ...pagina[0], pageBreak: 'before' };
    content.push(...pagina);
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [44, 40, 44, 44],
    defaultStyle: { font: 'Helvetica', fontSize: 9.5, lineHeight: 1.2 },
    info: { title: 'Resumen semanal de asistencia' },
    content,
    footer: (actual, total) => ({
      text: `Generado por ${firmaRRHH} el ${fechaLarga(generadoEn)}${folio ? ` · Folio ${folio}` : ''} · La Llar — Sistema de Gestión Interna`
        + (total > 1 ? ` · Página ${actual} de ${total}` : ''),
      alignment: 'center', fontSize: 7, color: '#B0AAA2', margin: [0, 16, 0, 0],
    }),
  };
}

module.exports = { construirResumenPDF, filasTabla, filasTotales };
