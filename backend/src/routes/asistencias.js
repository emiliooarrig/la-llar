const express = require('express');
const router = express.Router();
const { mesEmpleado, guardarDia, reporteUnidad } = require('../controllers/asistenciasController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

// Reporte PDF de toda la unidad: administrador (cualquiera) y gerente (la suya).
router.get('/reporte', soloRol('administrador', 'gerente'), reporteUnidad);
// Lectura: administrador (todas las unidades) y gerente (solo la suya).
router.get('/', soloRol('administrador', 'gerente'), mesEmpleado);
// Edición de marcas/justificaciones: administrador siempre; gerente solo sobre
// su unidad y mientras la ventana `asistencias` esté abierta (validado en el controlador).
router.put('/dia', soloRol('administrador', 'gerente'), guardarDia);

module.exports = router;
