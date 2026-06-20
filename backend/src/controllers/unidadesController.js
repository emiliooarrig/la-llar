const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../middleware/upload');

const prisma = new PrismaClient();

const INCLUDE_DOCS = {
  documentos_unidad: {
    orderBy: { creado_en: 'desc' },
  },
};

// Resumen ligero para las tarjetas del catálogo: conteo total de documentos
// + estado de cada uno (para derivar los pendientes en el frontend).
const INCLUDE_RESUMEN = {
  _count: { select: { documentos_unidad: true } },
  documentos_unidad: { select: { estado: true } },
};

const NOMBRE_MAX = 150;

/* Valida y normaliza el cuerpo de alta/edición de una unidad (sucursal).
 * Devuelve { error } si algo falla, o { nombre } ya saneado. */
function validarDatosUnidad({ nombre }) {
  const nombreLimpio = nombre?.trim();
  if (!nombreLimpio) return { error: 'El nombre de la unidad es requerido' };
  if (nombreLimpio.length > NOMBRE_MAX) {
    return { error: `El nombre no puede exceder ${NOMBRE_MAX} caracteres` };
  }
  return { nombre: nombreLimpio };
}

/* Adjunta a cada unidad el conteo de empleados activos.
 * Se resuelve con un solo groupBy en vez de un count por fila. */
async function adjuntarEmpleadosActivos(unidades) {
  if (unidades.length === 0) return unidades;
  const grupos = await prisma.empleados.groupBy({
    by: ['sucursal_id'],
    where: { activo: true, sucursal_id: { in: unidades.map(u => u.id) } },
    _count: { _all: true },
  });
  const porSucursal = new Map(grupos.map(g => [g.sucursal_id, g._count._all]));
  return unidades.map(u => ({ ...u, empleados_activos: porSucursal.get(u.id) ?? 0 }));
}

// ── Listar unidades ───────────────────────────────────────────────────
// Admin: todas las sucursales con conteo de docs, estados y empleados activos
// Gerente: solo la sucursal que tiene asignada, con sus documentos
async function listar(req, res) {
  try {
    if (req.usuario.rol === 'administrador') {
      // El catálogo (CRUD) pide también las inactivas para poder reactivarlas;
      // cualquier otra consulta solo ve activas.
      const incluirInactivos = req.query.incluir_inactivos === '1';
      const unidades = await prisma.sucursales.findMany({
        where: incluirInactivos ? {} : { activo: true },
        include: INCLUDE_RESUMEN,
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      return res.json(await adjuntarEmpleadosActivos(unidades));
    }

    // Gerente: devuelve su propia sucursal con documentos
    if (!req.usuario.sucursal_id) {
      return res.status(404).json({ error: 'No tienes una unidad asignada' });
    }
    const unidad = await prisma.sucursales.findUnique({
      where: { id: req.usuario.sucursal_id },
      include: INCLUDE_DOCS,
    });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json(unidad);
  } catch (e) {
    console.error('Error al listar unidades:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Obtener unidad con documentos ─────────────────────────────────────
async function obtener(req, res) {
  const id = parseInt(req.params.id);

  if (req.usuario.rol === 'gerente' && req.usuario.sucursal_id !== id) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const unidad = await prisma.sucursales.findUnique({
      where: { id },
      include: INCLUDE_DOCS,
    });
    if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json(unidad);
  } catch (e) {
    console.error('Error al obtener unidad:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Subir documento ───────────────────────────────────────────────────
async function subirDocumento(req, res) {
  const id = parseInt(req.params.id);

  if (req.usuario.rol === 'gerente' && req.usuario.sucursal_id !== id) {
    if (req.file) fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  // Gerente solo puede subir si la ventana está activa (manual o por intervalo)
  if (req.usuario.rol === 'gerente') {
    const ventana = await prisma.ventanas_carga.findUnique({ where: { modulo: 'unidades' } });
    const now = new Date();
    let abierta;
    if (ventana?.desde && ventana?.hasta) {
      abierta = now >= new Date(ventana.desde) && now <= new Date(ventana.hasta);
    } else {
      abierta = ventana?.abierta ?? false;
    }
    if (!abierta) {
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
      return res.status(403).json({ error: 'La ventana de carga está cerrada. Contacta al administrador.' });
    }
  }

  try {
    const documento = await prisma.documentos_unidad.create({
      data: {
        sucursal_id: id,
        nombre_original: req.file.originalname,
        ruta_archivo: req.file.filename,
        tipo_mime: req.file.mimetype,
        subido_por: req.usuario.id,
        estado: 'pendiente',
      },
    });
    res.status(201).json(documento);
  } catch (e) {
    if (req.file) fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
    console.error('Error al guardar documento:', e);
    res.status(500).json({ error: 'Error al guardar el documento' });
  }
}

// ── Descargar documento ───────────────────────────────────────────────
async function descargar(req, res) {
  const docId = parseInt(req.params.docId);

  try {
    const doc = await prisma.documentos_unidad.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    if (req.usuario.rol === 'gerente' && doc.sucursal_id !== req.usuario.sucursal_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const filePath = path.join(UPLOADS_DIR, doc.ruta_archivo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    res.download(filePath, doc.nombre_original);
  } catch (e) {
    console.error('Error al descargar:', e);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}

// ── Actualizar estado (admin) ─────────────────────────────────────────
async function actualizarEstado(req, res) {
  const docId = parseInt(req.params.docId);
  const { estado } = req.body;

  const ESTADOS_VALIDOS = ['pendiente', 'aprobado', 'desaprobado'];
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  try {
    const doc = await prisma.documentos_unidad.update({
      where: { id: docId },
      data: { estado },
    });
    res.json(doc);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Documento no encontrado' });
    console.error('Error al actualizar estado:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Eliminar documento (admin) ────────────────────────────────────────
async function eliminarDocumento(req, res) {
  const docId = parseInt(req.params.docId);
  try {
    const doc = await prisma.documentos_unidad.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const filePath = path.join(UPLOADS_DIR, doc.ruta_archivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.documentos_unidad.delete({ where: { id: docId } });
    res.json({ ok: true, id: docId });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Documento no encontrado' });
    console.error('Error al eliminar documento:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Crear unidad (solo administrador) ─────────────────────────────────
async function crear(req, res) {
  const datos = validarDatosUnidad(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    // Evita duplicados de nombre (la colación de MySQL ya es case-insensitive).
    const existente = await prisma.sucursales.findFirst({ where: { nombre: datos.nombre } });
    if (existente) return res.status(409).json({ error: 'Ya existe una unidad con ese nombre' });

    const unidad = await prisma.sucursales.create({
      data: { nombre: datos.nombre },
      include: INCLUDE_RESUMEN,
    });
    res.status(201).json({ ...unidad, empleados_activos: 0 });
  } catch (e) {
    console.error('Error al crear unidad:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Actualizar unidad (solo administrador) ────────────────────────────
async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const datos = validarDatosUnidad(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const duplicado = await prisma.sucursales.findFirst({
      where: { nombre: datos.nombre, NOT: { id } },
    });
    if (duplicado) return res.status(409).json({ error: 'Ya existe una unidad con ese nombre' });

    const unidad = await prisma.sucursales.update({
      where: { id },
      data: { nombre: datos.nombre },
      include: INCLUDE_RESUMEN,
    });
    const [conData] = await adjuntarEmpleadosActivos([unidad]);
    res.json(conData);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Unidad no encontrada' });
    console.error('Error al actualizar unidad:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Activar / desactivar unidad (soft delete) ─────────────────────────
// Nunca se elimina físicamente: se conserva el historial de documentos,
// empleados y asistencias asociadas a la sucursal.
async function toggleActivo(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const actual = await prisma.sucursales.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Unidad no encontrada' });

    const unidad = await prisma.sucursales.update({
      where: { id },
      data: { activo: !actual.activo },
      include: INCLUDE_RESUMEN,
    });
    const [conData] = await adjuntarEmpleadosActivos([unidad]);
    res.json(conData);
  } catch (e) {
    console.error('Error al cambiar estado de la unidad:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listar, obtener, subirDocumento, descargar, actualizarEstado, eliminarDocumento,
  crear, actualizar, toggleActivo,
};
