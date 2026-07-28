const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/* Calcula si la ventana está abierta en este momento */
function calcularAbierta(ventana) {
  const now = new Date();
  if (ventana.desde && ventana.hasta) {
    return now >= new Date(ventana.desde) && now <= new Date(ventana.hasta);
  }
  return ventana.abierta;
}

function conEstado(ventana) {
  return { ...ventana, estaAbierta: calcularAbierta(ventana) };
}

/* GET /api/ventanas/:modulo */
async function obtener(req, res) {
  const { modulo } = req.params;
  try {
    const v = await prisma.ventanas_carga.findUnique({ where: { modulo } });
    if (!v) return res.status(404).json({ error: 'Módulo no encontrado' });
    res.json(conEstado(v));
  } catch (e) {
    console.error('Error al obtener ventana:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* PATCH /api/ventanas/:modulo — toggle manual (limpia la programación) */
async function toggle(req, res) {
  const { modulo } = req.params;
  try {
    const actual = await prisma.ventanas_carga.findUnique({ where: { modulo } });
    if (!actual) return res.status(404).json({ error: 'Módulo no encontrado' });

    const v = await prisma.ventanas_carga.update({
      where: { modulo },
      data: { abierta: !actual.abierta, desde: null, hasta: null },
    });
    res.json(conEstado(v));
  } catch (e) {
    console.error('Error al cambiar ventana:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* PUT /api/ventanas/:modulo/programacion — establece un intervalo de tiempo */
async function programar(req, res) {
  const { modulo } = req.params;
  const { desde, hasta } = req.body;

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Las fechas de apertura y cierre son requeridas' });
  }

  const dDesde = new Date(desde);
  const dHasta = new Date(hasta);

  if (isNaN(dDesde.getTime()) || isNaN(dHasta.getTime())) {
    return res.status(400).json({ error: 'Formato de fecha inválido' });
  }
  if (dHasta <= dDesde) {
    return res.status(400).json({ error: 'El cierre debe ser posterior a la apertura' });
  }

  try {
    const v = await prisma.ventanas_carga.update({
      where: { modulo },
      data: { desde: dDesde, hasta: dHasta },
    });
    res.json(conEstado(v));
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Módulo no encontrado' });
    console.error('Error al programar ventana:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* DELETE /api/ventanas/:modulo/programacion — elimina el intervalo (vuelve a modo manual) */
async function limpiarProgramacion(req, res) {
  const { modulo } = req.params;
  try {
    const v = await prisma.ventanas_carga.update({
      where: { modulo },
      data: { desde: null, hasta: null },
    });
    res.json(conEstado(v));
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Módulo no encontrado' });
    console.error('Error al limpiar programación:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { obtener, toggle, programar, limpiarProgramacion, calcularAbierta };
