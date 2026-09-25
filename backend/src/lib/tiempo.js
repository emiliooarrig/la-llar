/* Aritmética de horas de reloj y fechas de calendario (spec 004).
 *
 * Todo aquí trabaja con CADENAS: horas 'HH:MM' y fechas 'YYYY-MM-DD', la
 * misma convención que `justificaciones` y `correcciones_asistencia`. Un
 * turno "de 08:00 a 16:00" es una hora de pared, no un instante: pasarlo
 * por `Date` obligaría a elegir una zona horaria, y cada elección
 * equivocada mueve una entrada de las 08:05 a las 02:05.
 *
 * Cuando hace falta el calendario (qué día de la semana es, cuántos días
 * tiene el mes) se usa `Date.UTC` solo como calculadora: se construye y se
 * lee en UTC, así que la zona del servidor nunca interviene.
 *
 * Los turnos que cruzan la medianoche no se soportan (spec 004 §6): una
 * salida anterior a la entrada es un error, no el día siguiente.
 */

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (n) => String(n).padStart(2, '0');

/** true si es una hora de reloj válida 'HH:MM' (00:00 … 23:59). */
function esHora(texto) {
  return typeof texto === 'string' && RE_HORA.test(texto);
}

/** true si es una fecha de calendario real 'YYYY-MM-DD' (rechaza 2026-02-30). */
function esFecha(texto) {
  if (typeof texto !== 'string' || !RE_FECHA.test(texto)) return false;
  const [y, m, d] = texto.split('-').map(Number);
  return d <= diasDelMes(y, m);
}

function esMes(texto) {
  return typeof texto === 'string' && RE_MES.test(texto);
}

/** 'HH:MM' → minutos desde medianoche. */
function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Minutos desde medianoche → 'HH:MM'. */
function deMinutos(total) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Minutos de `desde` a `hasta` (negativo si `hasta` es anterior). */
function diferenciaMin(desde, hasta) {
  return aMinutos(hasta) - aMinutos(desde);
}

function diasDelMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function aDate(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function deDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
function diaSemana(fecha) {
  const d = aDate(fecha).getUTCDay();
  return d === 0 ? 7 : d;
}

function sumarDias(fecha, n) {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return deDate(d);
}

/** Todas las fechas de `desde` a `hasta`, ambas incluidas. */
function fechasEntre(desde, hasta) {
  const fechas = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

/** Primer y último día de un mes 'YYYY-MM'. */
function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return { desde: `${mes}-01`, hasta: `${mes}-${pad(diasDelMes(y, m))}` };
}

/* Periodo de conteo de retardos que contiene a `fecha`.
 *   semana   → lunes a domingo (la semana que usan los resúmenes)
 *   quincena → 1–15 y 16–fin de mes
 *   mes      → mes calendario
 * La `clave` identifica el periodo en la URL del acta y en la evaluación. */
function periodoDe(fecha, periodo) {
  if (periodo === 'semana') {
    const desde = sumarDias(fecha, 1 - diaSemana(fecha));
    return { clave: desde, desde, hasta: sumarDias(desde, 6) };
  }
  const mes = fecha.slice(0, 7);
  const { desde, hasta } = rangoMes(mes);
  if (periodo === 'quincena') {
    const primera = Number(fecha.slice(8, 10)) <= 15;
    return primera
      ? { clave: `${mes}-Q1`, desde, hasta: `${mes}-15` }
      : { clave: `${mes}-Q2`, desde: `${mes}-16`, hasta };
  }
  return { clave: mes, desde, hasta };
}

/** Primer día de la semana que contiene `fecha`, para una semana que
 *  arranca en `diaInicio` (1 = lunes … 7 = domingo). Cada unidad define el
 *  suyo (spec 005): con inicio en miércoles, el martes pertenece a la
 *  semana que empezó el miércoles anterior. */
function inicioSemanaDe(fecha, diaInicio = 1) {
  const atras = (diaSemana(fecha) - diaInicio + 7) % 7;
  return sumarDias(fecha, -atras);
}

/** Fecha de hoy en la zona de operación del negocio (America/Mexico_City),
 *  sin depender de la zona del servidor: en Hostinger el servidor corre en
 *  UTC, y a las 19:00 de México ya sería "mañana". */
function hoyMX(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

module.exports = {
  esHora,
  esFecha,
  esMes,
  aMinutos,
  deMinutos,
  diferenciaMin,
  diaSemana,
  sumarDias,
  fechasEntre,
  rangoMes,
  periodoDe,
  inicioSemanaDe,
  hoyMX,
};
