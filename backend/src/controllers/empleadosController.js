const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const INCLUDE_SUCURSAL = { sucursal: { select: { id: true, nombre: true } } };

// Normaliza los datos personales opcionales del cuerpo de la petición.
// Cadenas vacías → null; RFC/CURP en mayúsculas; fecha 'YYYY-MM-DD' → Date.
function datosPersonales({ fecha_nacimiento, rfc, curp }) {
  return {
    fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
    rfc:  rfc?.trim()  ? rfc.trim().toUpperCase()  : null,
    curp: curp?.trim() ? curp.trim().toUpperCase() : null,
  };
}

async function listar(req, res) {
  try {
    // El gerente solo ve a los empleados de su unidad asignada.
    const where = req.usuario.rol === 'gerente'
      ? { sucursal_id: req.usuario.sucursal_id ?? -1 }
      : {};
    const empleados = await prisma.empleados.findMany({
      where,
      include: INCLUDE_SUCURSAL,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
    res.json(empleados);
  } catch (e) {
    console.error('Error al listar empleados:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  const { nombre, lector_uid, sucursal_id } = req.body;
  if (!nombre?.trim() || !lector_uid?.trim() || !sucursal_id) {
    return res.status(400).json({ error: 'Nombre, UID de lector y sucursal son requeridos' });
  }
  try {
    const empleado = await prisma.empleados.create({
      data: {
        nombre: nombre.trim(),
        lector_uid: lector_uid.trim(),
        sucursal_id: parseInt(sucursal_id),
        ...datosPersonales(req.body),
      },
      include: INCLUDE_SUCURSAL,
    });
    res.status(201).json(empleado);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'El UID de lector ya está registrado en esta unidad' });
    console.error('Error al crear empleado:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  const { nombre, lector_uid, sucursal_id } = req.body;
  if (!nombre?.trim() || !lector_uid?.trim() || !sucursal_id) {
    return res.status(400).json({ error: 'Nombre, UID de lector y sucursal son requeridos' });
  }
  try {
    const empleado = await prisma.empleados.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        lector_uid: lector_uid.trim(),
        sucursal_id: parseInt(sucursal_id),
        ...datosPersonales(req.body),
      },
      include: INCLUDE_SUCURSAL,
    });
    res.json(empleado);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'El UID de lector ya está registrado en esta unidad' });
    if (e.code === 'P2025') return res.status(404).json({ error: 'Empleado no encontrado' });
    console.error('Error al actualizar empleado:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function toggleActivo(req, res) {
  const id = parseInt(req.params.id);
  try {
    const actual = await prisma.empleados.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Empleado no encontrado' });

    const empleado = await prisma.empleados.update({
      where: { id },
      data: { activo: !actual.activo },
      include: INCLUDE_SUCURSAL,
    });
    res.json(empleado);
  } catch (e) {
    console.error('Error al cambiar estado:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, toggleActivo };
