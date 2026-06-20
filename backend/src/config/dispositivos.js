/* Dispositivos checadores autorizados.
 *
 * Cada checador físico tiene un token secreto (`x-device-token`) que lo
 * autentica y, a la vez, lo ata a UNA unidad/cocina. Como el `lector_uid`
 * puede repetirse entre cocinas (el mismo número de empleado en lectores
 * distintos), es el token —no el cuerpo de la petición— quien determina en
 * qué sucursal se inserta la marca: un checador solo puede registrar
 * asistencias de su propia unidad.
 *
 * Configuración en backend/.env como JSON:
 *   CHECADOR_DISPOSITIVOS='[{"token":"...","unidad":"Cocina Centro","dispositivo_id":"NGTECO-01"}]'
 *
 * - token:         secreto que envía el agente en el header x-device-token.
 * - unidad:        nombre EXACTO de la fila en `sucursales` (case-insensitive).
 * - dispositivo_id: etiqueta opcional, solo para registro/auditoría.
 */
function cargarDispositivos() {
  const crudo = process.env.CHECADOR_DISPOSITIVOS;
  if (!crudo || !crudo.trim()) {
    console.warn('[checador] CHECADOR_DISPOSITIVOS no está configurado: el webhook rechazará todos los registros.');
    return new Map();
  }

  let lista;
  try {
    lista = JSON.parse(crudo);
  } catch {
    console.error('[checador] CHECADOR_DISPOSITIVOS no es un JSON válido. Revisa backend/.env');
    return new Map();
  }
  if (!Array.isArray(lista)) {
    console.error('[checador] CHECADOR_DISPOSITIVOS debe ser un arreglo JSON.');
    return new Map();
  }

  const mapa = new Map();
  for (const d of lista) {
    if (!d || typeof d.token !== 'string' || typeof d.unidad !== 'string' || !d.token.trim() || !d.unidad.trim()) {
      console.warn('[checador] Entrada de dispositivo ignorada (faltan "token" o "unidad").');
      continue;
    }
    mapa.set(d.token, {
      unidad: d.unidad.trim(),
      dispositivo_id: typeof d.dispositivo_id === 'string' ? d.dispositivo_id.trim() : null,
    });
  }
  return mapa;
}

const dispositivos = cargarDispositivos();

// Devuelve la config del dispositivo si el token es válido, o null si no.
function resolverDispositivo(token) {
  if (!token) return null;
  return dispositivos.get(token) || null;
}

module.exports = { resolverDispositivo };
