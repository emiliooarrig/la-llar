/* Vocabulario de la evaluación de asistencia (specs 004 y 005).
   La pantalla de Asistencias y el resumen semanal nombran los estados con
   las mismas palabras que el PDF que firma el empleado: si cada vista
   tradujera `sin_horario` por su cuenta, acabarían discrepando. */

export const ETIQUETA_EVAL = {
  puntual: 'Puntual',
  retardo: 'Retardo',
  falta: 'Falta',
  incompleto: 'Incompleto',
  pendiente: 'Pendiente',
  sin_horario: 'Sin horario',
  descanso: 'Descanso',
  justificado: 'Justificado',
};

export const NOMBRE_DIA_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Minutos → "1h 20m" / "45m". Para la extra, donde "0h" no dice nada. */
export function formatearMinutos(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 'YYYY-MM-DD' → "mié 3 jun", sin pasar por UTC (en México se correría un día). */
export function fechaLegible(fecha) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}
