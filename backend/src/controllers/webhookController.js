const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TIPOS = ['entrada', 'salida'];
// Acepta 'YYYY-MM-DDTHH:MM:SS' o 'YYYY-MM-DD HH:MM:SS' (segundos opcionales).
const RE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/* El checador envía su hora local "de pared" (sin zona horaria). Para que se
 * muestre igual que el resto del sistema, se guarda como esa misma hora en UTC
 * —misma convención que asistenciasController—, sin desplazamientos. */
function parsearTimestamp(valor) {
  if (typeof valor !== 'string') return null;
  const m = RE_TIMESTAMP.exec(valor.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const fecha = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/* POST /api/webhook/asistencia   (auth: x-device-token)
 *
 * Registra una marca cruda de un checador físico. El dispositivo está atado
 * a una unidad por su token; el empleado se resuelve por `lector_uid` DENTRO
 * de esa unidad, porque el mismo uid puede existir en otras cocinas.
 *
 * Body: { lector_uid, tipo: 'entrada'|'salida', timestamp, dispositivo_id } */
async function registrarAsistencia(req, res) {
  const { lector_uid, tipo, timestamp, dispositivo_id } = req.body || {};
  const { unidad } = req.dispositivo;

  const uid = typeof lector_uid === 'string' ? lector_uid.trim() : '';
  if (!uid) return res.status(400).json({ error: 'lector_uid es requerido' });
  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: "tipo debe ser 'entrada' o 'salida'" });

  const marca = parsearTimestamp(timestamp);
  if (!marca) return res.status(400).json({ error: 'timestamp inválido (use YYYY-MM-DDTHH:MM:SS)' });

  try {
    // 1) Unidad del dispositivo (resuelta por nombre desde su token).
    const sucursal = await prisma.sucursales.findFirst({
      where: { nombre: unidad, activo: true },
      select: { id: true },
    });
    if (!sucursal) {
      console.error(`[webhook] La unidad "${unidad}" del dispositivo ${dispositivo_id || '?'} no existe o está inactiva.`);
      return res.status(404).json({ error: 'La unidad del dispositivo no está registrada' });
    }

    // 2) Empleado por lector_uid DENTRO de esa unidad (uid no es único global).
    const empleado = await prisma.empleados.findFirst({
      where: { lector_uid: uid, sucursal_id: sucursal.id, activo: true },
      select: { id: true },
    });
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado en esta unidad' });
    }

    // 3) Insertar la marca cruda (no se modifica nunca; las correcciones van aparte).
    const asistencia = await prisma.asistencias.create({
      data: { empleado_id: empleado.id, sucursal_id: sucursal.id, tipo, timestamp: marca },
      select: { id: true },
    });

    return res.status(201).json({ id: asistencia.id, registrado: true });
  } catch (e) {
    console.error('Error al registrar asistencia del checador:', e);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { registrarAsistencia };
