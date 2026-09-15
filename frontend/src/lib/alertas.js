import Swal from 'sweetalert2';

/* Escala de respuesta del sistema:
     · validación de formulario → inline, junto al campo (no vive aquí)
     · éxito rutinario          → toast(), no bloquea ni pide clic
     · error que corta la tarea → avisoError()
     · acción irreversible      → confirmar()
   Antes todo pasaba por un modal con botón, incluido el éxito: ~120
   `Swal.fire` sueltos, cada uno repitiendo los mismos hex de marca. */

const NARANJA = '#E8621A';
const GRIS = '#9E9892';

/* Sin clases de entrada/salida: los diálogos aparecen, no actúan. */
const base = Swal.mixin({
  buttonsStyling: false,
  showClass: { popup: '', backdrop: '' },
  hideClass: { popup: '', backdrop: '' },
  customClass: {
    popup: 'swal-llar',
    title: 'swal-llar__titulo',
    htmlContainer: 'swal-llar__texto',
    actions: 'swal-llar__acciones',
    confirmButton: 'btn btn--primario',
    denyButton: 'btn btn--peligro',
    cancelButton: 'btn btn--neutro',
  },
});

/**
 * Confirmación de acción irreversible o destructiva.
 * @returns {Promise<boolean>} true si el usuario confirmó.
 */
export async function confirmar({
  titulo,
  texto,
  html,
  confirmar: textoConfirmar = 'Confirmar',
  cancelar = 'Cancelar',
  destructivo = false,
}) {
  const res = await base.fire({
    title: titulo,
    text: html ? undefined : texto,
    html,
    icon: destructivo ? 'warning' : 'question',
    iconColor: destructivo ? '#D93025' : NARANJA,
    showCancelButton: true,
    confirmButtonText: textoConfirmar,
    cancelButtonText: cancelar,
    reverseButtons: true,
    focusCancel: destructivo,
    customClass: {
      popup: 'swal-llar',
      title: 'swal-llar__titulo',
      htmlContainer: 'swal-llar__texto',
      actions: 'swal-llar__acciones',
      confirmButton: destructivo ? 'btn btn--peligro' : 'btn btn--primario',
      cancelButton: 'btn btn--neutro',
    },
  });
  return res.isConfirmed;
}

/** Error que impide continuar. Lleva botón porque hay que leerlo. */
export function avisoError(texto, titulo = 'No se pudo completar') {
  return base.fire({
    title: titulo,
    text: texto,
    icon: 'error',
    iconColor: '#D93025',
    confirmButtonText: 'Entendido',
  });
}

/** Aviso informativo con botón (permisos, reglas, límites). */
export function avisoInfo(texto, titulo) {
  return base.fire({ title: titulo, text: texto, icon: 'info', iconColor: NARANJA, confirmButtonText: 'Entendido' });
}

/* Confirmación de éxito: se asoma en la esquina y se va sola. El usuario
   ya está mirando el resultado; no hace falta detenerlo para decírselo. */
const cinta = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  timer: 2600,
  timerProgressBar: false,
  showConfirmButton: false,
  showClass: { popup: '' },
  hideClass: { popup: '' },
  customClass: { popup: 'swal-cinta', title: 'swal-cinta__titulo' },
});

export function toast(mensaje, tono = 'exito') {
  return cinta.fire({ title: mensaje, icon: tono === 'exito' ? 'success' : tono === 'error' ? 'error' : 'info',
    iconColor: tono === 'exito' ? '#2E7D32' : tono === 'error' ? '#D93025' : NARANJA });
}

/** Diálogo de tres salidas (aprobar / rechazar / cancelar). */
export async function elegir({ titulo, texto, confirmar: textoSi, negar, cancelar = 'Cancelar' }) {
  const res = await base.fire({
    title: titulo, text: texto, icon: 'question', iconColor: NARANJA,
    showDenyButton: true, showCancelButton: true,
    confirmButtonText: textoSi, denyButtonText: negar, cancelButtonText: cancelar,
    reverseButtons: true,
  });
  if (res.isConfirmed) return 'confirmar';
  if (res.isDenied) return 'negar';
  return 'cancelar';
}

export { GRIS, NARANJA };
