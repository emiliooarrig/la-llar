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
      select: { id: true, nombre: true, dias_laborales: true },
    });
    res.json(sucursales);
  } catch (e) {
    console.error('Error al listar sucursales:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
