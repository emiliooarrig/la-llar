/* Cálculo del resumen semanal de facturas aprobadas (spec 001 HU-9).
 *
 * Vive aparte del controlador porque es aritmética de dinero y de fechas:
 * lo que se puede probar sin levantar un servidor ni tocar la base, y lo que
 * más caro sale si se equivoca —la fecha de pago estimada es la que mira
 * quien programa las transferencias—.
 */

/** Suma días naturales a una fecha sin pasar por zonas horarias.
 *
 *  Días NATURALES, no hábiles: es lo que dice el plan §4. Si el negocio
 *  pidiera hábiles habría que restar fines de semana y días festivos, que es
 *  otra conversación (calendario oficial incluido).
 *
 *  Se construye la fecha a mediodía para que un cambio de horario de verano
 *  —que mueve el reloj una hora— no empuje el resultado al día anterior. */
function sumarDias(fecha, dias) {
  const base = new Date(fecha);
  const resultado = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/** 'YYYY-MM-DD' en hora local, que es como el sistema guarda las fechas de
 *  calendario (constitución §3). `toISOString()` daría UTC y en México
 *  restaría un día durante media tarde. */
function aFechaISO(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Los importes se suman en centavos enteros y se formatean al final.
 * Sumar 0.1 + 0.2 en coma flotante da 0.30000000000000004, y un resumen de
 * pagos que no cuadra por un céntimo es un resumen que nadie firma. */
function aCentavos(texto) {
  const limpio = String(texto ?? '0').trim();
  const negativo = limpio.startsWith('-');
  const [entera, decimal = ''] = limpio.replace('-', '').split('.');
  const centavos = BigInt(entera || '0') * 100n + BigInt((decimal + '00').slice(0, 2));
  return negativo ? -centavos : centavos;
}

function deCentavos(centavos) {
  const negativo = centavos < 0n;
  const abs = negativo ? -centavos : centavos;
  const entera = abs / 100n;
  const resto = abs % 100n;
  return `${negativo ? '-' : ''}${entera}.${String(resto).padStart(2, '0')}`;
}

/** Formato para leer, no para calcular: '$1,234.56'. */
function formatearMoneda(texto) {
  const [entera, decimal = '00'] = String(texto).split('.');
  const conSeparadores = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${conSeparadores}.${decimal}`;
}

/**
 * Arma el resumen a partir de las facturas ya filtradas por el controlador.
 *
 * @param {Array} facturas  facturas aprobadas, con `proveedor` y `empresa`
 * @returns {{ filas, totales }}
 */
function construirResumen(facturas) {
  const filas = facturas.map((f) => {
    /* Sin configurar se calcula como 0 (HU-10) pero se marca, para que el
     * administrador sepa que esa fecha de pago es una suposición y no un
     * plazo pactado. */
    const sinConfigurar = f.proveedor?.dias_credito == null;
    const dias = sinConfigurar ? 0 : f.proveedor.dias_credito;

    return {
      factura_id: f.id,
      proveedor: f.proveedor?.nombre ?? '—',
      proveedor_id: f.proveedor_id,
      rfc: f.proveedor?.rfc ?? null,
      empresa: f.empresa?.nombre ?? '—',
      empresa_id: f.empresa_id,
      uuid_fiscal: f.uuid_fiscal,
      serie_folio: f.serie_folio,
      total: f.total != null ? f.total.toFixed(2) : '0.00',   // cadena con centavos, nunca number
      moneda: f.moneda || 'MXN',
      fecha_cfdi: aFechaISO(f.fecha_cfdi),
      fecha_aprobacion: aFechaISO(f.fecha_aprobacion),
      dias_credito: dias,
      dias_credito_sin_configurar: sinConfigurar,
      fecha_pago_estimada: f.fecha_aprobacion ? aFechaISO(sumarDias(f.fecha_aprobacion, dias)) : null,
      pago_realizado: f.pago_realizado,
      complemento_pendiente: f.pago_realizado && !f.complemento,
    };
  });

  const sumaPorMoneda = new Map();
  for (const fila of filas) {
    const previo = sumaPorMoneda.get(fila.moneda) ?? 0n;
    sumaPorMoneda.set(fila.moneda, previo + aCentavos(fila.total));
  }

  return {
    filas,
    totales: {
      facturas: filas.length,
      proveedores: new Set(filas.map((f) => f.proveedor_id)).size,
      /* Se totaliza POR MONEDA. Sumar pesos con dólares da un número que no
       * significa nada; si algún día entra un CFDI en USD, el resumen lo
       * enseña aparte en vez de mentir con un único gran total. */
      por_moneda: [...sumaPorMoneda.entries()].map(([moneda, centavos]) => ({
        moneda,
        total: deCentavos(centavos),
      })),
      sin_configurar: filas.filter((f) => f.dias_credito_sin_configurar).length,
    },
  };
}

module.exports = { construirResumen, sumarDias, aFechaISO, aCentavos, deCentavos, formatearMoneda };
