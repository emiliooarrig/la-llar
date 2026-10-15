/* Observaciones de los documentos de proveedores y de unidades.
 *
 * Mismo criterio que las observaciones de facturas (facturasController):
 * rechazar EXIGE escribir el motivo, porque "rechazado" a secas obliga a
 * quien subió el archivo a llamar por teléfono para saber qué corregir.
 * El historial solo crece: una observación no se edita ni se borra. */

const OBSERVACION_MAX = 500;

/** Lee la observación que acompaña un cambio de estado.
 *  Devuelve { error } o { observacion } (cadena, vacía si no vino). */
function leerObservacion(body, estado) {
  const observacion = typeof body?.observacion === 'string' ? body.observacion.trim() : '';
  if (estado === 'desaprobado' && !observacion) {
    return { error: 'Para rechazar un documento hay que escribir el motivo.' };
  }
  if (observacion.length > OBSERVACION_MAX) {
    return { error: `La observación no puede exceder ${OBSERVACION_MAX} caracteres` };
  }
  return { observacion };
}

/** Añade `autor` (nombre) a las observaciones de cada documento, con una
 *  sola consulta: `autor_id` no tiene relación declarada en el schema. */
async function conAutores(prisma, docs) {
  const ids = [...new Set(docs.flatMap((d) => (d.observaciones ?? []).map((o) => o.autor_id)))];
  if (ids.length === 0) return docs;

  const usuarios = await prisma.usuarios.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true },
  });
  const nombrePorId = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

  return docs.map((d) => ({
    ...d,
    observaciones: (d.observaciones ?? []).map((o) => ({ ...o, autor: nombrePorId[o.autor_id] ?? null })),
  }));
}

module.exports = { leerObservacion, conAutores };
