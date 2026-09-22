const { XMLParser } = require('fast-xml-parser');

/* Lectura de un CFDI (factura electrónica mexicana) para quedarnos con los
 * cuatro datos que el sistema necesita: folio fiscal, importe, fecha y los
 * RFC de emisor y receptor.
 *
 * Esto NO valida el comprobante ante el SAT —eso está fuera de alcance
 * (spec 001 §2)—. Solo lee lo que el XML dice de sí mismo. El folio fiscal
 * es el que importa: es la clave con la que el sistema detecta que una
 * factura ya se subió antes.
 *
 * ── Sobre seguridad ──────────────────────────────────────────────────
 * Parsear XML que sube un tercero es el camino clásico a un XXE: un DOCTYPE
 * con una entidad externa consigue que el servidor lea /etc/passwd o haga
 * peticiones a la red interna, y devuelva el resultado dentro de un campo.
 * `fast-xml-parser` no resuelve entidades externas ni sigue DOCTYPEs —no
 * implementa esa parte del estándar—, así que el vector no existe. Aun así
 * el DOCTYPE se rechaza explícitamente: un comprobante fiscal no lo lleva,
 * y no depender del comportamiento interno de una librería para una
 * propiedad de seguridad es más barato que auditarla en cada actualización.
 */

// Un CFDI legítimo ronda las decenas de KB. El tope de subida ya es 10 MB,
// pero conviene cortar antes de construir el árbol en memoria.
const TAMANO_MAX = 4 * 1024 * 1024;

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* Sin prefijos: el CFDI casi siempre usa 'cfdi:' y 'tfd:', pero el prefijo
 * lo elige quien emite y hay XML válidos que no usan ninguno. Se ignoran los
 * prefijos al leer y se busca por nombre local. */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseAttributeValue: false,  // los importes se convierten a mano, no por heurística
  trimValues: true,
  processEntities: false,      // sin expansión de entidades: ni XXE ni billion laughs
});

class ErrorCFDI extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorCFDI';
  }
}

/** Recorre el árbol buscando el primer nodo con ese nombre local. El timbre
 *  vive dentro de Complemento, pero su profundidad exacta varía entre
 *  emisores, así que se busca en vez de asumir la ruta. */
function buscarNodo(nodo, nombre, profundidad = 0) {
  if (!nodo || typeof nodo !== 'object' || profundidad > 12) return null;

  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarNodo(hijo, nombre, profundidad + 1);
      if (encontrado) return encontrado;
    }
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(nodo, nombre)) {
    const valor = nodo[nombre];
    return Array.isArray(valor) ? valor[0] : valor;
  }

  for (const valor of Object.values(nodo)) {
    const encontrado = buscarNodo(valor, nombre, profundidad + 1);
    if (encontrado) return encontrado;
  }
  return null;
}

/** Número con dos decimales a partir del atributo del XML. Se trabaja sobre
 *  la cadena: `Total="1234.56"` es texto, y convertirlo con parseFloat y
 *  volver a formatear es lo que introduce los céntimos fantasma. */
function aImporte(texto) {
  if (texto == null || texto === '') return null;
  const limpio = String(texto).trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? limpio : null;
}

/** La fecha del CFDI viene en hora local del emisor y sin zona
 *  ('2026-09-18T12:34:56'). Se interpreta tal cual, sin inventarle un huso:
 *  la zona de operación es America/Mexico_City para todo el sistema. */
function aFecha(texto) {
  if (!texto) return null;
  const fecha = new Date(String(texto).trim());
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function rfcLimpio(texto) {
  if (!texto) return null;
  const valor = String(texto).trim().toUpperCase();
  return valor.length > 0 && valor.length <= 13 ? valor : null;
}

/**
 * Extrae los datos del comprobante.
 *
 * @param {Buffer|string} entrada  contenido del XML
 * @returns {{uuid, total, fecha, rfcEmisor, rfcReceptor, serieFolio, moneda}}
 * @throws {ErrorCFDI} con un mensaje pensado para el proveedor que subió mal
 *         el archivo, no para el programador.
 */
function parsearCFDI(entrada) {
  const texto = Buffer.isBuffer(entrada) ? entrada.toString('utf8') : String(entrada || '');

  if (!texto.trim()) {
    throw new ErrorCFDI('El archivo XML está vacío.');
  }
  if (texto.length > TAMANO_MAX) {
    throw new ErrorCFDI('El XML es demasiado grande para ser un comprobante fiscal.');
  }
  // Un CFDI no lleva DOCTYPE. Si viene uno, o no es un CFDI o alguien está
  // probando suerte con una entidad externa.
  if (/<!DOCTYPE/i.test(texto)) {
    throw new ErrorCFDI('El XML contiene un DOCTYPE, que un CFDI no lleva. No se procesa.');
  }

  let arbol;
  try {
    arbol = parser.parse(texto);
  } catch {
    throw new ErrorCFDI('El archivo no es un XML válido o está dañado.');
  }

  const comprobante = buscarNodo(arbol, 'Comprobante');
  if (!comprobante) {
    throw new ErrorCFDI('El XML no es un CFDI: no se encontró el nodo Comprobante.');
  }

  const timbre = buscarNodo(comprobante, 'TimbreFiscalDigital');
  const uuid = timbre?.['@_UUID']?.trim();

  /* Sin timbre no hay folio fiscal, y sin folio fiscal el sistema no puede
   * saber si esta factura ya se subió. Un CFDI sin timbrar no es una factura
   * todavía, así que se rechaza aquí y no más adelante. */
  if (!uuid) {
    throw new ErrorCFDI(
      'El XML no tiene folio fiscal (UUID): no es un CFDI timbrado. ' +
      'Sube el archivo que te devolvió tu proveedor de timbrado.'
    );
  }
  if (!RE_UUID.test(uuid)) {
    throw new ErrorCFDI(`El folio fiscal "${uuid}" no tiene el formato de un UUID.`);
  }

  const total = aImporte(comprobante['@_Total']);
  if (total === null) {
    throw new ErrorCFDI('El comprobante no trae un total legible.');
  }

  const emisor = buscarNodo(comprobante, 'Emisor');
  const receptor = buscarNodo(comprobante, 'Receptor');

  const serie = comprobante['@_Serie']?.trim() || '';
  const folio = comprobante['@_Folio']?.trim() || '';

  return {
    uuid: uuid.toUpperCase(),
    total,                                    // cadena con decimales exactos
    fecha: aFecha(comprobante['@_Fecha']),
    rfcEmisor: rfcLimpio(emisor?.['@_Rfc']),
    rfcReceptor: rfcLimpio(receptor?.['@_Rfc']),
    serieFolio: [serie, folio].filter(Boolean).join('-').slice(0, 60) || null,
    moneda: comprobante['@_Moneda']?.trim().slice(0, 3) || null,
  };
}

module.exports = { parsearCFDI, ErrorCFDI, TAMANO_MAX };
