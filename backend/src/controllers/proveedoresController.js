const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../middleware/upload');
const { leerObservacion, conAutores } = require('../lib/observacionesDocumento');

const prisma = new PrismaClient();

const INCLUDE_DOCS = {
  documentos_proveedor: {
    orderBy: { creado_en: 'desc' },
    include: { observaciones: { orderBy: { creado_en: 'desc' } } },
  },
};

/* Quien subió el documento lee las observaciones (sobre todo el motivo de
 * un rechazo) junto a su archivo: se entregan con el nombre del autor. */
async function conObservaciones(proveedor) {
  return { ...proveedor, documentos_proveedor: await conAutores(prisma, proveedor.documentos_proveedor) };
}

// Resumen ligero para las tarjetas del catálogo: conteo total + estados
// de cada documento (para derivar los pendientes en el frontend).
const INCLUDE_RESUMEN = {
  _count: { select: { documentos_proveedor: true } },
  documentos_proveedor: { select: { estado: true } },
};

const NOMBRE_MAX = 150;
// RFC mexicano: 3-4 letras + 6 dígitos (fecha) + 3 de homoclave. Opcional.
const RE_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

/* Valida y normaliza el cuerpo de alta/edición de un proveedor.
 * Devuelve { error } si algo falla, o { nombre, rfc } ya saneados. */
function validarDatosProveedor({ nombre, rfc }) {
  const nombreLimpio = nombre?.trim();
  if (!nombreLimpio) return { error: 'El nombre del proveedor es requerido' };
  if (nombreLimpio.length > NOMBRE_MAX) {
    return { error: `El nombre no puede exceder ${NOMBRE_MAX} caracteres` };
  }

  // RFC es opcional; si se envía vacío lo guardamos como null.
  const rfcLimpio = rfc?.trim().toUpperCase() || null;
  if (rfcLimpio && !RE_RFC.test(rfcLimpio)) {
    return { error: 'El RFC no tiene un formato válido (12 o 13 caracteres)' };
  }

  return { nombre: nombreLimpio, rfc: rfcLimpio };
}

// ── Listar proveedores ─────────────────────────────────────────────────
// Admin: todos con conteo de docs y estados
// Proveedor: solo el suyo con sus documentos
async function listar(req, res) {
  try {
    if (req.usuario.rol === 'administrador') {
      // El catálogo (CRUD) pide también los inactivos para poder reactivarlos;
      // el resto de consultas (p. ej. el selector de Usuarios) solo ve activos.
      const incluirInactivos = req.query.incluir_inactivos === '1';
      const proveedores = await prisma.proveedores.findMany({
        where: incluirInactivos ? {} : { activo: true },
        include: INCLUDE_RESUMEN,
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      return res.json(proveedores);
    }

    // Proveedor: devuelve su propio perfil con documentos
    const proveedor = await prisma.proveedores.findUnique({
      where: { id: req.usuario.proveedor_id },
      include: INCLUDE_DOCS,
    });
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(await conObservaciones(proveedor));
  } catch (e) {
    console.error('Error al listar proveedores:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Obtener proveedor con documentos ──────────────────────────────────
async function obtener(req, res) {
  const id = parseInt(req.params.id);

  if (req.usuario.rol === 'proveedor' && req.usuario.proveedor_id !== id) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const proveedor = await prisma.proveedores.findUnique({
      where: { id },
      include: INCLUDE_DOCS,
    });
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(await conObservaciones(proveedor));
  } catch (e) {
    console.error('Error al obtener proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Subir documento ───────────────────────────────────────────────────
async function subirDocumento(req, res) {
  const id = parseInt(req.params.id);

  if (req.usuario.rol === 'proveedor' && req.usuario.proveedor_id !== id) {
    if (req.file) fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  // Proveedor solo puede subir si la ventana está activa (manual o por intervalo)
  if (req.usuario.rol === 'proveedor') {
    const ventana = await prisma.ventanas_carga.findUnique({ where: { modulo: 'proveedores' } });
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
    const documento = await prisma.documentos_proveedor.create({
      data: {
        proveedor_id: id,
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
    const doc = await prisma.documentos_proveedor.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    if (req.usuario.rol === 'proveedor' && doc.proveedor_id !== req.usuario.proveedor_id) {
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

  // Rechazar exige motivo (mismo criterio que facturas): quien subió el
  // archivo lo lee para saber qué corregir.
  const { observacion, error } = leerObservacion(req.body, estado);
  if (error) return res.status(400).json({ error });

  try {
    const doc = await prisma.$transaction(async (tx) => {
      if (observacion) {
        await tx.observaciones_doc_proveedor.create({
          data: { documento_id: docId, texto: observacion, autor_id: req.usuario.id },
        });
      }
      return tx.documentos_proveedor.update({
        where: { id: docId },
        data: { estado },
        include: { observaciones: { orderBy: { creado_en: 'desc' } } },
      });
    });
    const [conAutor] = await conAutores(prisma, [doc]);
    res.json(conAutor);
  } catch (e) {
    // P2003: la observación apunta a un documento que no existe.
    if (e.code === 'P2025' || e.code === 'P2003') return res.status(404).json({ error: 'Documento no encontrado' });
    console.error('Error al actualizar estado:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Eliminar documento (admin) ────────────────────────────────────────
async function eliminarDocumento(req, res) {
  const docId = parseInt(req.params.docId);
  try {
    const doc = await prisma.documentos_proveedor.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const filePath = path.join(UPLOADS_DIR, doc.ruta_archivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.documentos_proveedor.delete({ where: { id: docId } });
    res.json({ ok: true, id: docId });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Documento no encontrado' });
    console.error('Error al eliminar documento:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Crear proveedor (solo administrador) ──────────────────────────────
async function crear(req, res) {
  const datos = validarDatosProveedor(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const proveedor = await prisma.proveedores.create({
      data: { nombre: datos.nombre, rfc: datos.rfc },
      include: INCLUDE_RESUMEN,
    });
    res.status(201).json(proveedor);
  } catch (e) {
    // El RFC es único desde el alta por link (spec 001): dos proveedores con
    // el mismo RFC repartirían las facturas de una sola empresa entre dos
    // expedientes.
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un proveedor con ese RFC' });
    }
    console.error('Error al crear proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Actualizar proveedor (solo administrador) ─────────────────────────
async function actualizar(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const datos = validarDatosProveedor(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const proveedor = await prisma.proveedores.update({
      where: { id },
      data: { nombre: datos.nombre, rfc: datos.rfc },
      include: INCLUDE_RESUMEN,
    });
    res.json(proveedor);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Proveedor no encontrado' });
    if (e.code === 'P2002') return res.status(409).json({ error: 'Ya existe un proveedor con ese RFC' });
    console.error('Error al actualizar proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Activar / desactivar proveedor (soft delete) ──────────────────────
// Nunca se elimina físicamente: se conserva el historial de documentos.
async function toggleActivo(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const actual = await prisma.proveedores.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const proveedor = await prisma.proveedores.update({
      where: { id },
      data: { activo: !actual.activo },
      include: INCLUDE_RESUMEN,
    });
    res.json(proveedor);
  } catch (e) {
    console.error('Error al cambiar estado del proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}


/* ── PATCH /api/proveedores/:id/credito (administrador) ───────────────
 * Días de crédito: los días naturales entre que se aprueba una factura y la
 * fecha estimada de pago (spec 001 HU-10). Son fijos por proveedor, no por
 * empresa: el mismo proveedor cobra al mismo plazo facture a quien facture
 * (respuesta a la pregunta abierta §7).
 *
 * 0 es un valor legítimo —de contado—, no "sin configurar". */
async function actualizarCredito(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const dias = req.body?.dias_credito;
  // Se exige entero: "30.5 días de crédito" no significa nada y un decimal
  // que llegue por descuido desplazaría todas las fechas de pago.
  if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
    return res.status(400).json({ error: 'Los días de crédito deben ser un número entero entre 0 y 365' });
  }

  try {
    const proveedor = await prisma.proveedores.update({
      where: { id },
      data: { dias_credito: dias },
      include: INCLUDE_RESUMEN,
    });
    res.json(proveedor);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Proveedor no encontrado' });
    console.error('Error al actualizar días de crédito:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── PATCH /api/proveedores/:id/bloqueo (administrador) ───────────────
 * Freno puntual a la facturación de un proveedor (spec 001 HU-8).
 *
 * Es distinto de desactivarlo: un proveedor bloqueado sigue entrando al
 * portal y viendo su historial; lo único que no puede es subir facturas
 * nuevas. El motivo es obligatorio porque el proveedor lo lee: un 403 sin
 * explicación acaba en una llamada telefónica al administrador. */
async function actualizarBloqueo(req, res) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const bloqueado = Boolean(req.body?.bloqueado);
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

  if (bloqueado && !motivo) {
    return res.status(400).json({ error: 'Para bloquear la facturación hay que escribir el motivo.' });
  }
  if (motivo.length > 300) {
    return res.status(400).json({ error: 'El motivo no puede exceder 300 caracteres' });
  }

  try {
    const proveedor = await prisma.proveedores.update({
      where: { id },
      data: {
        bloqueado_facturar: bloqueado,
        // Al desbloquear se borra el motivo: dejarlo puesto haría que la
        // próxima pantalla mostrara un bloqueo que ya no existe.
        motivo_bloqueo: bloqueado ? motivo : null,
      },
      include: INCLUDE_RESUMEN,
    });
    res.json(proveedor);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Proveedor no encontrado' });
    console.error('Error al actualizar bloqueo del proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listar, obtener, subirDocumento, descargar, actualizarEstado, eliminarDocumento,
  crear, actualizar, toggleActivo, actualizarCredito, actualizarBloqueo,
};
