const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLES = ['administrador', 'gerente', 'proveedor'];
const BCRYPT_ROUNDS = 10;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

// Nunca exponemos el hash de la contraseña. Incluimos el nombre de la
// sucursal/proveedor para que el frontend muestre el alcance sin consultas extra.
const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  sucursal_id: true,
  proveedor_id: true,
  creado_en: true,
  sucursal: { select: { id: true, nombre: true } },
  proveedor: { select: { id: true, nombre: true } },
};

/* Normaliza el alcance (sucursal/proveedor) según el rol:
 *  - gerente  → requiere sucursal_id, sin proveedor_id
 *  - proveedor→ requiere proveedor_id, sin sucursal_id
 *  - admin    → sin alcance
 * Devuelve { error } si el alcance requerido falta, o { sucursal_id, proveedor_id }. */
function resolverAlcance(rol, sucursal_id, proveedor_id) {
  if (rol === 'gerente') {
    if (!sucursal_id) return { error: 'Un gerente debe tener una sucursal asignada' };
    return { sucursal_id: parseInt(sucursal_id), proveedor_id: null };
  }
  if (rol === 'proveedor') {
    if (!proveedor_id) return { error: 'Un proveedor debe tener un perfil de proveedor asignado' };
    return { sucursal_id: null, proveedor_id: parseInt(proveedor_id) };
  }
  return { sucursal_id: null, proveedor_id: null };
}

// ── Listar usuarios (solo administrador) ───────────────────────────────
async function listar(_req, res) {
  try {
    const usuarios = await prisma.usuarios.findMany({
      select: SELECT_USUARIO,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
    res.json(usuarios);
  } catch (e) {
    console.error('Error al listar usuarios:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Crear usuario ──────────────────────────────────────────────────────
async function crear(req, res) {
  const { nombre, email, password, rol, sucursal_id, proveedor_id } = req.body;

  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!RE_EMAIL.test(email?.trim() || '')) return res.status(400).json({ error: 'El correo no es válido' });
  if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  if (!password || password.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` });
  }

  const alcance = resolverAlcance(rol, sucursal_id, proveedor_id);
  if (alcance.error) return res.status(400).json({ error: alcance.error });

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const usuario = await prisma.usuarios.create({
      data: {
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hash,
        rol,
        sucursal_id: alcance.sucursal_id,
        proveedor_id: alcance.proveedor_id,
      },
      select: SELECT_USUARIO,
    });
    res.status(201).json(usuario);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'El correo ya está registrado' });
    console.error('Error al crear usuario:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Actualizar usuario ─────────────────────────────────────────────────
// La contraseña es opcional: si llega vacía, se conserva la actual
// (así el admin puede editar datos sin restablecer el acceso).
async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  const { nombre, email, password, rol, sucursal_id, proveedor_id } = req.body;

  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!RE_EMAIL.test(email?.trim() || '')) return res.status(400).json({ error: 'El correo no es válido' });
  if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

  const alcance = resolverAlcance(rol, sucursal_id, proveedor_id);
  if (alcance.error) return res.status(400).json({ error: alcance.error });

  const data = {
    nombre: nombre.trim(),
    email: email.toLowerCase().trim(),
    rol,
    sucursal_id: alcance.sucursal_id,
    proveedor_id: alcance.proveedor_id,
  };

  // Solo se actualiza la contraseña si el admin escribió una nueva.
  if (password) {
    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` });
    }
    data.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  try {
    const usuario = await prisma.usuarios.update({
      where: { id },
      data,
      select: SELECT_USUARIO,
    });
    res.json(usuario);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'El correo ya está registrado' });
    if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    console.error('Error al actualizar usuario:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Activar / desactivar (soft delete) ─────────────────────────────────
// Un usuario desactivado no puede iniciar sesión (validado en el login).
async function toggleActivo(req, res) {
  const id = parseInt(req.params.id);

  // Salvaguarda: el admin no puede revocarse el acceso a sí mismo.
  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  try {
    const actual = await prisma.usuarios.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });

    const usuario = await prisma.usuarios.update({
      where: { id },
      data: { activo: !actual.activo },
      select: SELECT_USUARIO,
    });
    res.json(usuario);
  } catch (e) {
    console.error('Error al cambiar estado del usuario:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, toggleActivo };
