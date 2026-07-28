const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('../middleware/upload');

const prisma = new PrismaClient();

/* ── GET /api/historicos?origen=&busqueda= ───────────────────
 * Lista el archivo histórico completo (solo administrador).
 * Filtros:
 *   origen   → 'unidad' | 'proveedor' (omitir = ambos)
 *   busqueda → coincidencia parcial en el nombre del archivo o en el
 *              nombre del origen (unidad/proveedor). */
async function listar(req, res) {
  const { origen, busqueda } = req.query;

  if (origen && !['unidad', 'proveedor'].includes(origen)) {
    return res.status(400).json({ error: "origen debe ser 'unidad' o 'proveedor'" });
  }

  try {
    const where = {};
    if (origen) where.origen = origen;
    if (busqueda?.trim()) {
      const q = busqueda.trim();
      where.OR = [
        { nombre_original: { contains: q } },
        { origen_nombre: { contains: q } },
      ];
    }

    const docs = await prisma.documentos_historicos.findMany({
      where,
      orderBy: { enviado_en: 'desc' },
    });

    // subido_por / aprobado_por no tienen relación declarada (mismo patrón
    // que pendientes): resolvemos los nombres con una sola consulta.
    const idsUsuarios = [...new Set(docs.flatMap((d) => [d.subido_por, d.aprobado_por]))];
    const usuarios = idsUsuarios.length
      ? await prisma.usuarios.findMany({
          where: { id: { in: idsUsuarios } },
          select: { id: true, nombre: true },
        })
      : [];
    const nombrePorUsuario = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

    res.json(docs.map((d) => ({
      ...d,
      subido_por_nombre: nombrePorUsuario[d.subido_por] ?? null,
      aprobado_por_nombre: nombrePorUsuario[d.aprobado_por] ?? null,
    })));
  } catch (e) {
    console.error('Error al listar históricos:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/historicos ────────────────────────────────────
 * Manda un documento activo al archivo histórico (solo administrador).
 * Body: { tipo: 'unidad' | 'proveedor', doc_id }
 * En una transacción: copia el documento a documentos_historicos
 * (preservando su fecha original de subida y quién lo subió, y registrando
 * al administrador que aprueba el envío) y lo elimina de su tabla origen.
 * El archivo físico no se mueve: ruta_archivo sigue apuntando a uploads/. */
async function enviar(req, res) {
  const { tipo, doc_id } = req.body;
  const docId = parseInt(doc_id);

  if (!['unidad', 'proveedor'].includes(tipo)) {
    return res.status(400).json({ error: "tipo debe ser 'unidad' o 'proveedor'" });
  }
  if (!docId) return res.status(400).json({ error: 'doc_id es requerido' });

  try {
    const historico = await prisma.$transaction(async (tx) => {
      let doc, origenId, origenNombre;

      if (tipo === 'unidad') {
        doc = await tx.documentos_unidad.findUnique({
          where: { id: docId },
          include: { sucursal: { select: { id: true, nombre: true } } },
        });
        if (!doc) return null;
        origenId = doc.sucursal_id;
        origenNombre = doc.sucursal?.nombre ?? 'Unidad';
      } else {
        doc = await tx.documentos_proveedor.findUnique({
          where: { id: docId },
          include: { proveedor: { select: { id: true, nombre: true } } },
        });
        if (!doc) return null;
        origenId = doc.proveedor_id;
        origenNombre = doc.proveedor?.nombre ?? 'Proveedor';
      }

      const creado = await tx.documentos_historicos.create({
        data: {
          origen: tipo,
          origen_id: origenId,
          origen_nombre: origenNombre,
          nombre_original: doc.nombre_original,
          ruta_archivo: doc.ruta_archivo,
          tipo_mime: doc.tipo_mime,
          subido_por: doc.subido_por,
          subido_en: doc.creado_en,
          aprobado_por: req.usuario.id,
        },
      });

      if (tipo === 'unidad') {
        await tx.documentos_unidad.delete({ where: { id: docId } });
      } else {
        await tx.documentos_proveedor.delete({ where: { id: docId } });
      }

      return creado;
    });

    if (!historico) return res.status(404).json({ error: 'Documento no encontrado' });
    res.status(201).json(historico);
  } catch (e) {
    console.error('Error al mandar a histórico:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/historicos/:id/descargar ───────────────────────
 * Descarga un documento del archivo histórico (solo administrador). */
async function descargar(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const doc = await prisma.documentos_historicos.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const filePath = path.join(UPLOADS_DIR, doc.ruta_archivo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    res.download(filePath, doc.nombre_original);
  } catch (e) {
    console.error('Error al descargar histórico:', e);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}

/* ── DELETE /api/historicos/:id ──────────────────────────────
 * Elimina un documento del archivo histórico (solo administrador).
 * Borra el registro de la base de datos y el archivo físico de uploads/.
 * El histórico es el único dueño del archivo (al enviarse se elimina de su
 * tabla origen), por lo que es seguro borrar el archivo del disco. */
async function eliminar(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const doc = await prisma.documentos_historicos.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    await prisma.documentos_historicos.delete({ where: { id } });

    // Borra el archivo físico. Si ya no existe, no es un error fatal:
    // el registro de BD (fuente de verdad) ya quedó eliminado.
    const filePath = path.join(UPLOADS_DIR, doc.ruta_archivo);
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('No se pudo borrar el archivo físico del histórico:', err);
      }
    }

    res.status(204).end();
  } catch (e) {
    console.error('Error al eliminar histórico:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, enviar, descargar, eliminar };
