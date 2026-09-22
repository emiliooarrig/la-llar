const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { verificarToken } = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', verificarToken, async (_req, res) => {
  try {
    const sucursales = await prisma.sucursales.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      // La empresa viaja con la unidad porque de ella se deriva el alcance
      // de un gerente (spec 000 §5): quien lista sucursales para un
      // formulario necesita saber a qué empresa pertenece cada una sin
      // pedir el catálogo aparte.
      select: {
        id: true,
        nombre: true,
        dias_laborales: true,
        empresa_id: true,
        empresa: { select: { id: true, nombre: true } },
      },
    });
    res.json(sucursales);
  } catch (e) {
    console.error('Error al listar sucursales:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
