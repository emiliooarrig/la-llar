const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/* ── GET /api/pendientes ─────────────────────────────────────
 * Bandeja consolidada del administrador: une los documentos con
 * estado 'pendiente' de proveedores y de unidades en una sola
 * lista. Agregación sobre tablas existentes (sin cambios de BD).
 * Aprobar/rechazar se hace con los PATCH ya existentes de cada
 * módulo (proveedores/documentos/:id/estado, unidades/...). */
async function listar(_req, res) {
  try {
    const [docsProv, docsUnid] = await Promise.all([
      prisma.documentos_proveedor.findMany({
        where: { estado: 'pendiente' },
        include: { proveedor: { select: { id: true, nombre: true } } },
      }),
      prisma.documentos_unidad.findMany({
        where: { estado: 'pendiente' },
        include: { sucursal: { select: { id: true, nombre: true } } },
      }),
    ]);

    // Resolver nombre de quien subió cada documento (subido_por no tiene
    // relación declarada en el schema; lo mapeamos con una sola consulta).
    const idsUsuarios = [
      ...new Set([
        ...docsProv.map((d) => d.subido_por),
        ...docsUnid.map((d) => d.subido_por),
      ]),
    ];
    const usuarios = idsUsuarios.length
      ? await prisma.usuarios.findMany({
          where: { id: { in: idsUsuarios } },
          select: { id: true, nombre: true },
        })
      : [];
    const nombrePorUsuario = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

    const filas = [
      ...docsProv.map((d) => ({
        key: `proveedor-${d.id}`,
        tipo: 'proveedor',
        doc_id: d.id,
        origen_id: d.proveedor?.id ?? d.proveedor_id,
        origen: d.proveedor?.nombre ?? 'Proveedor',
        nombre_original: d.nombre_original,
        tipo_mime: d.tipo_mime,
        subido_por: nombrePorUsuario[d.subido_por] ?? null,
        creado_en: d.creado_en,
      })),
      ...docsUnid.map((d) => ({
        key: `unidad-${d.id}`,
        tipo: 'unidad',
        doc_id: d.id,
        origen_id: d.sucursal?.id ?? d.sucursal_id,
        origen: d.sucursal?.nombre ?? 'Unidad',
        nombre_original: d.nombre_original,
        tipo_mime: d.tipo_mime,
        subido_por: nombrePorUsuario[d.subido_por] ?? null,
        creado_en: d.creado_en,
      })),
    ];

    // Más antiguos primero: los que llevan más tiempo esperando van arriba.
    filas.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));

    res.json({
      total: filas.length,
      proveedores: docsProv.length,
      unidades: docsUnid.length,
      documentos: filas,
    });
  } catch (e) {
    console.error('Error al listar pendientes:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar };
