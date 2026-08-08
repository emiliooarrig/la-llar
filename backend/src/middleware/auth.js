const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/* Verifica el token y, además, contrasta cada petición contra la base de datos.
 *
 * La firma del JWT sola no basta: un token es válido 8 horas y no se puede
 * "desfirmar". Sin esta consulta, un usuario desactivado seguiría operando con
 * normalidad hasta que expirara su token, y un cambio de rol o de sucursal no
 * surtiría efecto hasta entonces (un ex-gerente conservaría su unidad anterior).
 *
 * Por eso el alcance real (rol, sucursal, proveedor) se toma SIEMPRE de la BD,
 * no del payload firmado: la base es la fuente de verdad y el token queda como
 * simple prueba de identidad. Es una consulta por clave primaria por petición;
 * si algún día pesa, el siguiente paso es una caché corta (segundos), no volver
 * a confiar en el payload. */
async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        sucursal_id: true,
        proveedor_id: true,
      },
    });

    // Cuenta borrada o desactivada: la sesión abierta muere aquí mismo.
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Tu acceso fue revocado. Inicia sesión de nuevo.' });
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      sucursal_id: usuario.sucursal_id ?? null,
      proveedor_id: usuario.proveedor_id ?? null,
    };

    next();
  } catch (error) {
    console.error('Error al verificar la sesión:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

function soloRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

module.exports = { verificarToken, soloRol };
