const express = require('express');
const router = express.Router();
const { mesEmpleado, guardarDia } = require('../controllers/asistenciasController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

// Lectura: administrador (todas las unidades) y gerente (solo la suya).
router.get('/', soloRol('administrador', 'gerente'), mesEmpleado);
// Edición de marcas/justificaciones: exclusiva del administrador.
router.put('/dia', soloRol('administrador'), guardarDia);

module.exports = router;
