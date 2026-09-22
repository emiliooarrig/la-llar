/* Vocabulario compartido del módulo de facturación.
   Lo que pinta el portal del proveedor y lo que pinta el panel del
   administrador tiene que decir lo mismo con las mismas palabras: si cada
   pantalla traduce `desaprobado` por su cuenta, acaban discrepando. */

export const ETIQUETA_ESTADO = {
  pendiente: 'En revisión',
  aprobado: 'Aprobada',
  desaprobado: 'Rechazada',
};

export const ETIQUETA_ESTADO_COMPLEMENTO = {
  pendiente: 'En revisión',
  aprobado: 'Aprobado',
  desaprobado: 'Rechazado',
};

/** Importe con separadores de millar. Llega como CADENA desde el backend
 *  ("1160.00"): es dinero, y convertirlo a número para formatearlo es
 *  justo lo que introduce los centavos fantasma. */
export function formatImporte(texto, moneda = 'MXN') {
  if (texto == null) return '—';
  const [entera = '0', decimal = '00'] = String(texto).split('.');
  const negativo = entera.startsWith('-');
  const digitos = negativo ? entera.slice(1) : entera;
  const conSeparadores = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const simbolo = moneda === 'MXN' || !moneda ? '$' : `${moneda} $`;
  return `${negativo ? '-' : ''}${simbolo}${conSeparadores}.${decimal.padEnd(2, '0').slice(0, 2)}`;
}

/** Los ocho primeros caracteres del folio fiscal. El UUID completo no cabe
 *  en una columna de tabla, y su prefijo ya distingue una factura de otra
 *  a simple vista; el completo se ve en el detalle y se puede copiar. */
export function folioCorto(uuid) {
  return uuid ? uuid.split('-')[0] : '—';
}

/** Cómo se llama una factura cuando hay que nombrarla en una frase. */
export function referenciaFactura(factura) {
  return factura?.serie_folio || folioCorto(factura?.uuid_fiscal);
}

/** Fecha 'YYYY-MM-DD' a formato legible, sin pasar por Date: construir una
 *  fecha de calendario con `new Date('2026-09-01')` la interpreta como UTC
 *  y en México la muestra un día antes. */
export function formatFechaISO(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Lunes de la semana de una fecha, en 'YYYY-MM-DD'. El resumen se pide por
 *  semanas naturales, que es como el negocio programa los pagos. */
export function lunesDe(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7;             // 0 = lunes
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dia);
  return aISO(lunes);
}

export function sumarDiasISO(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d + dias);
  return aISO(fecha);
}

export function aISO(fecha) {
  const p = n => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}
