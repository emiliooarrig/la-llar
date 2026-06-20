const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function pad(n) { return String(n).padStart(2, '0'); }
function fechaUTC(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// Ventana abierta: si tiene rango programado se evalúa contra "ahora";
// si no, manda el flag manual. (Misma regla que ventanasController.)
function ventanaAbierta(v) {
  if (!v) return false;
  if (v.desde && v.hasta) {
    const now = new Date();
    return now >= new Date(v.desde) && now <= new Date(v.hasta);
  }
  return v.abierta;
}

/* ── GET /api/dashboard/kpis ─────────────────────────────────
 * Resumen operativo del día para el administrador. Una sola
 * respuesta con todos los conteos; agregaciones sobre las tablas
 * existentes (sin cambios de BD). */
async function kpis(req, res) {
  try {
    // Límites del día de hoy (convención: timestamp = hora de pared en UTC).
    const ahora = new Date();
    const inicioHoy = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0));
    const finHoy = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 0));

    const [
      empleadosActivos,
      empleadosInactivos,
      porSucursalRaw,
      sucursales,
      pendientesProv,
      pendientesUnidad,
      ventanas,
      presentesHoy,
      ultimaMarca,
    ] = await Promise.all([
      prisma.empleados.count({ where: { activo: true } }),
      prisma.empleados.count({ where: { activo: false } }),
      prisma.empleados.groupBy({ by: ['sucursal_id'], where: { activo: true }, _count: { _all: true } }),
      prisma.sucursales.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.documentos_proveedor.count({ where: { estado: 'pendiente' } }),
      prisma.documentos_unidad.count({ where: { estado: 'pendiente' } }),
      prisma.ventanas_carga.findMany(),
      prisma.asistencias.findMany({
        where: { tipo: 'entrada', timestamp: { gte: inicioHoy, lt: finHoy } },
        distinct: ['empleado_id'],
        select: { empleado_id: true },
      }),
      prisma.asistencias.findFirst({ orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
    ]);

    // Plantilla activa por estación (sucursal), ordenada de mayor a menor.
    const conteoPorSucursal = Object.fromEntries(porSucursalRaw.map(g => [g.sucursal_id, g._count._all]));
    const porSucursal = sucursales
      .map(s => ({ id: s.id, nombre: s.nombre, total: conteoPorSucursal[s.id] || 0 }))
      .sort((a, b) => b.total - a.total);

    const ventanaProv = ventanas.find(v => v.modulo === 'proveedores');
    const ventanaUnid = ventanas.find(v => v.modulo === 'unidades');

    res.json({
      empleados: {
        activos: empleadosActivos,
        inactivos: empleadosInactivos,
        porSucursal,
      },
      documentosPendientes: {
        total: pendientesProv + pendientesUnidad,
        proveedores: pendientesProv,
        unidades: pendientesUnidad,
      },
      ventanas: {
        proveedores: ventanaAbierta(ventanaProv),
        unidades: ventanaAbierta(ventanaUnid),
      },
      asistenciaHoy: {
        fecha: fechaUTC(inicioHoy),
        presentes: presentesHoy.length,
        plantilla: empleadosActivos,
        ultimaActividad: ultimaMarca ? fechaUTC(ultimaMarca.timestamp) : null,
      },
    });
  } catch (e) {
    console.error('Error al obtener KPIs del dashboard:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { kpis };
