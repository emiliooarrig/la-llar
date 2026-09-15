/* Estado de la ventana de carga. La misma regla vive en el backend
   (ventanasController y dashboardController): si hay intervalo programado
   manda el reloj; si no, manda el interruptor manual. */

export function ventanaAbierta(v) {
  if (!v) return false;
  if (v.desde && v.hasta) {
    const ahora = new Date();
    return ahora >= new Date(v.desde) && ahora <= new Date(v.hasta);
  }
  return v.abierta ?? false;
}

const fmt = iso =>
  new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });

/**
 * Qué decirle a quien sube documentos. Devuelve `{ tono, texto }` para
 * pintarlo como aviso; un "no puedes subir" sin fecha ni motivo obliga a
 * llamar al administrador para saber cuándo volver.
 */
export function mensajeVentana(v) {
  if (!v) return { tono: 'atencion', texto: 'La carga de documentos está deshabilitada. Contacta al administrador.' };

  if (v.desde && v.hasta) {
    const ahora = new Date();
    const desde = new Date(v.desde);
    const hasta = new Date(v.hasta);
    if (ahora < desde) return { tono: 'atencion', texto: `La carga abre el ${fmt(v.desde)} y cierra el ${fmt(v.hasta)}.` };
    if (ahora <= hasta) return { tono: 'exito', texto: `Carga abierta hasta el ${fmt(v.hasta)}.` };
    return { tono: 'atencion', texto: `El período de carga venció el ${fmt(v.hasta)}. Contacta al administrador para reabrirlo.` };
  }

  return v.abierta
    ? { tono: 'exito', texto: 'La carga está abierta: puedes subir documentos ahora.' }
    : { tono: 'atencion', texto: 'La carga está cerrada en este momento. Contacta al administrador para habilitarla.' };
}

/** Etiqueta corta para la insignia de estado de la ventana. */
export function etiquetaVentana(v) {
  const abierta = ventanaAbierta(v);
  if (v?.desde && v?.hasta) {
    const ahora = new Date();
    if (ahora < new Date(v.desde)) return { texto: 'Programada', tono: 'acero' };
    if (ahora > new Date(v.hasta)) return { texto: 'Vencida', tono: 'neutro' };
    return { texto: 'Abierta', tono: 'exito' };
  }
  return abierta ? { texto: 'Abierta', tono: 'exito' } : { texto: 'Cerrada', tono: 'neutro' };
}

/** Valor para <input type="datetime-local"> a partir de un ISO. */
export function aDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
