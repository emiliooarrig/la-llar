/* Formateo de datos. Antes `formatFecha` estaba copiada en ocho páginas
   y `iniciales` en dos, con pequeñas diferencias entre copias. */

const SIN_DATO = '—';

export function formatFecha(iso) {
  if (!iso) return SIN_DATO;
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatFechaLarga(iso) {
  if (!iso) return SIN_DATO;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatFechaHora(iso) {
  if (!iso) return SIN_DATO;
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Días transcurridos desde `iso` hasta hoy (0 si es hoy o futuro). */
export function diasDesde(iso) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** "1 documento" / "3 documentos" sin el `(s)` que ensucia la lectura. */
export function plural(n, singular, pluralForma = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Normaliza para buscar: sin acentos, sin mayúsculas. */
export function normalizar(texto) {
  if (texto == null) return '';
  return String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Clasifica un MIME en la etiqueta corta de formato que usa la tabla. */
export function formatoArchivo(mime) {
  const m = mime || '';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('sheet') || m.includes('excel')) return 'xls';
  if (m.includes('word') || m.includes('document')) return 'doc';
  return 'otro';
}
