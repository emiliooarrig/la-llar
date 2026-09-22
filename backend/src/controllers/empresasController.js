const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NOMBRE_MAX = 120;

// Cuántas unidades cuelgan de cada empresa: es el dato que convierte
// "desactivar empresa" en una decisión informada (si tiene sucursales
// dentro, apagarla las deja sin empresa en los formularios nuevos).
const INCLUDE_RESUMEN = {
  _count: { select: { sucursales: true } },
};

/* Valida y normaliza el nombre de una empresa.
 * Devuelve { error } si algo falla, o { nombre } ya saneado. */
function validarDatosEmpresa({ nombre }) {
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!nombreLimpio) return { error: 'El nombre de la empresa es requerido' };
  if (nombreLimpio.length > NOMBRE_MAX) {
    return { error: `El nombre no puede exceder ${NOMBRE_MAX} caracteres` };
  }
  return { nombre: nombreLimpio };
}

// ── Listar empresas ───────────────────────────────────────────────────
// Todos los roles pueden leer el catálogo: el selector de empresa aparece
// en los formularios de factura y de vale, no solo en el panel del admin.
// Lo que cambia por rol es la visibilidad de las inactivas: una empresa
// dada de baja debe seguir viéndose en el catálogo del administrador (para
// poder reactivarla) pero desaparecer de los formularios de todos los demás.
async function listar(req, res) {
  try {
    const incluirInactivos = req.query.incluir_inactivos === '1' && req.usuario.rol === 'administrador';

    const empresas = await prisma.empresas.findMany({
      where: incluirInactivos ? {} : { activo: true },
      include: INCLUDE_RESUMEN,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
    res.json(empresas);
  } catch (e) {
    console.error('Error al listar empresas:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Crear empresa (solo administrador) ────────────────────────────────
async function crear(req, res) {
  const datos = validarDatosEmpresa(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const empresa = await prisma.empresas.create({
      data: { nombre: datos.nombre },
      include: INCLUDE_RESUMEN,
    });
    res.status(201).json(empresa);
  } catch (e) {
    // El nombre es la clave natural del catálogo: dos "La Llar" harían que
    // una factura pudiera apuntar a la empresa equivocada sin que se note.
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una empresa con ese nombre' });
    }
    console.error('Error al crear empresa:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Actualizar empresa (solo administrador) ───────────────────────────
async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const datos = validarDatosEmpresa(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const empresa = await prisma.empresas.update({
      where: { id },
      data: { nombre: datos.nombre },
      include: INCLUDE_RESUMEN,
    });
    res.json(empresa);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Empresa no encontrada' });
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe una empresa con ese nombre' });
    console.error('Error al actualizar empresa:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Activar / desactivar empresa (soft delete) ────────────────────────
// Nunca se elimina físicamente: las facturas y los vales ya emitidos siguen
// apuntando a su empresa, y un histórico que pierde su etiqueta fiscal deja
// de poder auditarse. Desactivar solo la saca de los formularios nuevos.
async function toggleActivo(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const actual = await prisma.empresas.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Empresa no encontrada' });

    const empresa = await prisma.empresas.update({
      where: { id },
      data: { activo: !actual.activo },
      include: INCLUDE_RESUMEN,
    });
    res.json(empresa);
  } catch (e) {
    console.error('Error al cambiar estado de la empresa:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, toggleActivo, validarDatosEmpresa, NOMBRE_MAX };
