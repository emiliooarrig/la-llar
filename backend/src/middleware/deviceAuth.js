const { resolverDispositivo } = require('../config/dispositivos');

/* Autentica al checador físico mediante el header `x-device-token`.
 *
 * No usa JWT: los dispositivos no son usuarios del sistema. El token, además
 * de autenticar, ata el dispositivo a su unidad (ver config/dispositivos.js),
 * por lo que un checador nunca puede insertar marcas de otra cocina.
 *
 * Si es válido, deja en `req.dispositivo = { unidad, dispositivo_id }`. */
function verificarDispositivo(req, res, next) {
  const token = req.get('x-device-token');
  if (!token) {
    return res.status(401).json({ error: 'Token de dispositivo requerido' });
  }

  const dispositivo = resolverDispositivo(token);
  if (!dispositivo) {
    return res.status(401).json({ error: 'Token de dispositivo inválido' });
  }

  req.dispositivo = dispositivo;
  next();
}

module.exports = { verificarDispositivo };
