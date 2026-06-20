const express = require('express');
const router = express.Router();
const { listar } = require('../controllers/pendientesController');
const { verificarToken, soloRol } = require('../middleware/auth');

// Bandeja consolidada de pendientes: exclusiva del administrador.
router.use(verificarToken, soloRol('administrador'));

router.get('/', listar);

module.exports = router;
