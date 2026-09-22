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

/* Freno sobre el alta por link de proveedores (spec 001 HU-1).
 *
 * Estos endpoints son los únicos del sistema SIN `verificarToken`: quien los
 * llama no se ha identificado todavía. Eso los convierte en el sitio natural
 * para dos abusos: probar tokens de invitación a lo bruto hasta acertar uno,
 * y crear cuentas en masa con un link filtrado.
 *
 * El límite es por IP y cuenta TODOS los intentos, no solo los fallidos: a
 * diferencia del login, aquí un intento con éxito tampoco debería repetirse
 * treinta veces desde la misma IP —una invitación se usa una vez—. La ventana
 * es más larga y el cupo más corto que en el login por el mismo motivo.
 *
 * El token en sí es de 256 bits: el límite no es lo que hace inviable
 * adivinarlo, es lo que evita que alguien lo intente sin coste. */
const REGISTRO_VENTANA_MS = 60 * 60 * 1000; // 1 hora
const REGISTRO_MAX_INTENTOS = 10;

const registroLimiter = rateLimit({
  windowMs: REGISTRO_VENTANA_MS,
  limit: REGISTRO_MAX_INTENTOS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    const minutos = Math.max(1, Math.ceil(((req.rateLimit?.resetTime?.getTime() ?? 0) - Date.now()) / 60000));
    return res.status(429).json({
      error: `Demasiados intentos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
    });
  },
});

module.exports = {
  loginLimiter,
  LOGIN_MAX_INTENTOS,
  LOGIN_VENTANA_MS,
  registroLimiter,
  REGISTRO_MAX_INTENTOS,
  REGISTRO_VENTANA_MS,
};
