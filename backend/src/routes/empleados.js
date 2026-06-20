const express = require('express');
const router = express.Router();
const { listar, crear, actualizar, toggleActivo } = require('../controllers/empleadosController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

// Lectura: administrador y gerente (filtrado a su unidad en el controlador).
router.get('/', soloRol('administrador', 'gerente'), listar);
// Alta/edición/baja: exclusivo del administrador.
router.post('/', soloRol('administrador'), crear);
router.put('/:id', soloRol('administrador'), actualizar);
router.patch('/:id/activo', soloRol('administrador'), toggleActivo);

module.exports = router;
