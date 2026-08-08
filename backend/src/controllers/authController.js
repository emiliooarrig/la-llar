const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN = 8;

/* Cuántos intentos le quedan a esta IP antes de que el limitador la bloquee.
 * Lo pone `loginLimiter` en `req.rateLimit`; si el middleware no corrió (por
 * ejemplo en pruebas del controlador aislado) devolvemos null y el frontend
 * simplemente no muestra el aviso. */
function intentosRestantes(req) {
  return typeof req.rateLimit?.remaining === 'number' ? req.rateLimit.remaining : null;
}

// El motivo real del fallo (usuario inexistente, inactivo o password mala) no
// se revela nunca: siempre el mismo mensaje, para no filtrar qué correos existen.
function credencialesInvalidas(req, res) {
  return res.status(401).json({
    error: 'Credenciales inválidas',
    intentosRestantes: intentosRestantes(req),
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!usuario || !usuario.activo) {
      return credencialesInvalidas(req, res);
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return credencialesInvalidas(req, res);
    }

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      sucursal_id: usuario.sucursal_id ?? null,
      proveedor_id: usuario.proveedor_id ?? null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.json({ token, usuario: payload });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function me(req, res) {
  return res.json({ usuario: req.usuario });
}

/* Cambio de contraseña propia. Cualquier rol autenticado puede usarlo, pero
 * SIEMPRE sobre su propio usuario: el id sale del JWT, nunca del body, para
 * que nadie pueda cambiar la contraseña de otra cuenta desde aquí. */
async function cambiarPassword(req, res) {
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva son requeridas' });
  }

  if (passwordNueva.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres` });
  }

  if (passwordActual === passwordNueva) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
  }

  try {
    const usuario = await prisma.usuarios.findUnique({ where: { id: req.usuario.id } });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
    if (!passwordValida) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Defensa extra: el usuario pudo escribir la misma contraseña con otra
    // capitalización de la comparación anterior (o la actual ya era esa).
    const esLaMisma = await bcrypt.compare(passwordNueva, usuario.password);
    if (esLaMisma) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
    }

    const hash = await bcrypt.hash(passwordNueva, BCRYPT_ROUNDS);
    await prisma.usuarios.update({ where: { id: usuario.id }, data: { password: hash } });

    return res.json({ mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, me, cambiarPassword };
