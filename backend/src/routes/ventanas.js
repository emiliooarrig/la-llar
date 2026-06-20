const express = require('express');
const router = express.Router();
const { obtener, toggle, programar, limpiarProgramacion } = require('../controllers/ventanasController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.get('/:modulo', verificarToken, obtener);
router.patch('/:modulo', verificarToken, soloRol('administrador'), toggle);
router.put('/:modulo/programacion', verificarToken, soloRol('administrador'), programar);
router.delete('/:modulo/programacion', verificarToken, soloRol('administrador'), limpiarProgramacion);

module.exports = router;
