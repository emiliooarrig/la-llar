const express = require('express');
const router = express.Router();
const { kpis } = require('../controllers/dashboardController');
const { verificarToken, soloRol } = require('../middleware/auth');

// Resumen operativo: exclusivo del administrador.
router.use(verificarToken, soloRol('administrador'));

router.get('/kpis', kpis);

module.exports = router;
