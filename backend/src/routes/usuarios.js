const express = require('express');
const router = express.Router();
const { listar, crear, actualizar, toggleActivo } = require('../controllers/usuariosController');
const { verificarToken, soloRol } = require('../middleware/auth');

// Módulo exclusivo del administrador: gestión de accesos al sistema.
router.use(verificarToken, soloRol('administrador'));

router.get('/', listar);
router.post('/', crear);
router.put('/:id', actualizar);
router.patch('/:id/activo', toggleActivo);

module.exports = router;
