const { diferenciaMin, diaSemana, periodoDe } = require('./tiempo');

/* Motor de evaluación de asistencia (spec 004).
 *
 * Funciones PURAS: reciben el turno, las marcas y las reglas ya resueltas
 * y devuelven el veredicto del día. No tocan la base, así que los casos
 * límite de la spec (10 min exactos, 3 retardos, extra sobre/bajo umbral)
 * se prueban directamente, sin montar datos.
 *
 * La evaluación es DERIVADA: no guarda nada. Las marcas siguen siendo la
 * fuente de verdad (`asistencias`, o la corrección del administrador si la
 * hay) y cambiar el horario o las reglas re-evalúa todo al instante.
 */

/* Estados de un día, del más al menos "decidido":
 *   justificado  vacaciones, incapacidad… — no cuenta retardo ni falta
 *   descanso     no le tocaba trabajar (turno de descanso, o día no
 *                laboral sin turno y sin marcas)
 *   sin_horario  día laboral —o día con marcas— sin turno definido: no se
 *                puede juzgar la puntualidad, y NO es un retardo (HU-1)
 *   falta        tenía turno, el día ya pasó y no hay ninguna marca
 *   incompleto   tenía turno y hay salida pero no entrada: una marca
 *                olvidada no es una falta ni un retardo
 *   pendiente    tenía turno, es hoy o futuro, y aún no hay entrada
 *   puntual      entrada dentro de la tolerancia
 *   retardo      entrada después de la tolerancia
 */
const ESTADOS = ['justificado', 'descanso', 'sin_horario', 'falta', 'incompleto', 'pendiente', 'puntual', 'retardo'];

/** Retardos que forman un acta (constante de negocio, spec 004 §5). */
const RETARDOS_POR_ACTA = 3;

/* El turno que rige una fecha. El turno por fecha manda sobre el semanal:
 * para quien tiene horario fijo es una excepción; para quien rota es su
 * calendario completo. */
function resolverTurno(fecha, semanal, turnoFecha) {
  if (turnoFecha) {
    if (turnoFecha.descanso) return { descanso: true, origen: 'fecha' };
    return { entrada: turnoFecha.entrada, salida: turnoFecha.salida, descanso: false, origen: 'fecha' };
  }
  const fijo = semanal?.get?.(diaSemana(fecha));
  if (fijo) return { entrada: fijo.entrada, salida: fijo.salida, descanso: false, origen: 'semanal' };
  return null;
}

/**
 * Evalúa un día.
 *
 * @param fecha         'YYYY-MM-DD'
 * @param turno         resultado de `resolverTurno` (o null)
 * @param diaLaboral    si la cocina abre ese día (`sucursales.dias_laborales`)
 * @param marcas        { entrada, salida, corregido } efectivas: la corrección
 *                      del administrador ya aplicada si existe
 * @param justificacion { tipo, nota } o null
 * @param extraManual   { minutos, nota } o null — manda sobre el cálculo
 * @param config        { tolerancia_min, umbral_extra_min }
 * @param hoy           'YYYY-MM-DD' en la zona del negocio
 */
function evaluarDia({ fecha, turno = null, diaLaboral = true, marcas = {}, justificacion = null, extraManual = null, config, hoy }) {
  const entrada = marcas.entrada ?? null;
  const salida = marcas.salida ?? null;

  // Tiempo en la cocina: última salida − primera entrada. Sin descontar
  // comida (spec 004 §7). Si falta una de las dos marcas, no hay tiempo.
  const trabajado = entrada && salida ? Math.max(0, diferenciaMin(entrada, salida)) : 0;

  let estado;
  let retraso = 0;
  let extraCalculado = 0;

  if (justificacion) {
    estado = 'justificado';
  } else if (turno?.descanso) {
    estado = 'descanso';
  } else if (!turno) {
    estado = entrada || salida || diaLaboral ? 'sin_horario' : 'descanso';
  } else if (!entrada) {
    estado = salida ? 'incompleto' : fecha < hoy ? 'falta' : 'pendiente';
  } else {
    const minutosTarde = diferenciaMin(turno.entrada, entrada);
    retraso = Math.max(0, minutosTarde);
    // 10 minutos exactos todavía es a tiempo; el 11 ya es retardo (HU-2).
    estado = minutosTarde > config.tolerancia_min ? 'retardo' : 'puntual';
  }

  /* Extra sugerida por el checador: lo que se quedó después de la salida
   * del turno, solo si llega al umbral —para no contar dos minutos de
   * recoger sus cosas como tiempo extra— y entonces se cuenta COMPLETA
   * (20 min con umbral 15 son 20, no 5). Sin turno no hay contra qué
   * medir: esa extra, si la hubo, se asigna a mano. */
  if (turno && !turno.descanso && !justificacion && salida) {
    const exceso = diferenciaMin(turno.salida, salida);
    if (exceso > 0 && exceso >= config.umbral_extra_min) extraCalculado = exceso;
  }

  const manual = extraManual != null;
  return {
    fecha,
    estado,
    turno: turno && !turno.descanso ? { entrada: turno.entrada, salida: turno.salida, origen: turno.origen } : null,
    turno_descanso: Boolean(turno?.descanso),
    entrada,
    salida,
    corregido: Boolean(marcas.corregido),
    justificacion,
    retraso_min: retraso,
    trabajado_min: trabajado,
    extra_calculado_min: extraCalculado,
    extra_min: manual ? extraManual.minutos : extraCalculado,
    extra_fuente: manual ? 'manual' : extraCalculado > 0 ? 'checador' : null,
    extra_nota: manual ? extraManual.nota ?? null : null,
  };
}

/* Actas por periodo (HU-3). Cada 3 retardos DENTRO del mismo periodo son
 * un acta; con 6 son dos. Los retardos se toman en orden cronológico, así
 * que el acta 1 son siempre los tres primeros y no cambia cuando llega el
 * cuarto. El sobrante (1 o 2) queda como "acumulados" hacia la siguiente.
 *
 * Derivadas, sin tabla (plan §1): el acta existe mientras existan sus
 * retardos. Si el administrador corrige una entrada o justifica el día, el
 * retardo desaparece y el acta con él, que es lo que debe pasar. */
function calcularActas(diasEvaluados, periodo) {
  const porPeriodo = new Map();
  for (const d of diasEvaluados) {
    if (d.estado !== 'retardo') continue;
    const p = periodoDe(d.fecha, periodo);
    if (!porPeriodo.has(p.clave)) porPeriodo.set(p.clave, { ...p, retardos: [] });
    porPeriodo.get(p.clave).retardos.push(d);
  }

  const periodos = [];
  const actas = [];
  for (const p of [...porPeriodo.values()].sort((a, b) => a.desde.localeCompare(b.desde))) {
    const retardos = p.retardos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const completas = Math.floor(retardos.length / RETARDOS_POR_ACTA);
    periodos.push({
      clave: p.clave, desde: p.desde, hasta: p.hasta,
      retardos: retardos.length,
      actas: completas,
      acumulados: retardos.length % RETARDOS_POR_ACTA,
    });
    for (let i = 0; i < completas; i++) {
      actas.push({
        periodo: { clave: p.clave, desde: p.desde, hasta: p.hasta },
        numero: i + 1,
        retardos: retardos.slice(i * RETARDOS_POR_ACTA, (i + 1) * RETARDOS_POR_ACTA).map((d) => ({
          fecha: d.fecha,
          turno_entrada: d.turno?.entrada ?? null,
          entrada: d.entrada,
          retraso_min: d.retraso_min,
        })),
      });
    }
  }
  return { periodos, actas };
}

/** Totales de un conjunto de días evaluados. */
function totalizar(dias) {
  const t = { trabajado_min: 0, extra_min: 0, retraso_min: 0 };
  for (const e of ESTADOS) t[e] = 0;
  for (const d of dias) {
    t[d.estado] += 1;
    t.trabajado_min += d.trabajado_min;
    t.extra_min += d.extra_min;
    if (d.estado === 'retardo') t.retraso_min += d.retraso_min;
  }
  return t;
}

module.exports = {
  ESTADOS,
  RETARDOS_POR_ACTA,
  resolverTurno,
  evaluarDia,
  calcularActas,
  totalizar,
};
