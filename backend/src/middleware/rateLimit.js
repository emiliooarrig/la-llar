const rateLimit = require('express-rate-limit');

const LOGIN_VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_INTENTOS = 5;

function minutosRestantes(resetTime) {
  if (!resetTime) return Math.ceil(LOGIN_VENTANA_MS / 60000);
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
}

/* Freno de fuerza bruta sobre el login: 5 intentos por IP cada 15 minutos.
 *
 * `skipSuccessfulRequests` hace que solo los intentos FALLIDOS consuman cuota,
 * así un usuario que entra bien no gasta su margen. El contador se comparte
 * por IP (no por email) a propósito: si fuera por email, un atacante rotaría
 * el correo para saltarse el límite.
 *
 * El controlador de login lee `req.rateLimit.remaining` para avisarle al
 * usuario cuántos intentos le quedan antes del bloqueo. */
const loginLimiter = rateLimit({
  windowMs: LOGIN_VENTANA_MS,
  limit: LOGIN_MAX_INTENTOS,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7', // RateLimit-* en la respuesta
  legacyHeaders: false,
  handler: (req, res) => {
    const minutos = minutosRestantes(req.rateLimit?.resetTime);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
      intentosRestantes: 0,
      minutosEspera: minutos,
    });
  },
});

module.exports = { loginLimiter, LOGIN_MAX_INTENTOS, LOGIN_VENTANA_MS };
