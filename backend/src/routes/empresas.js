const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/empresasController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

// Leer el catálogo lo puede hacer cualquier rol autenticado: el selector de
// empresa vive también en los formularios de proveedor y de gerente. El
// controlador ya limita las inactivas al administrador.
router.get('/', ctrl.listar);

// Escribir sobre el catálogo es exclusivo del administrador.
router.post('/', soloRol('administrador'), ctrl.crear);
router.put('/:id', soloRol('administrador'), ctrl.actualizar);
router.patch('/:id/activo', soloRol('administrador'), ctrl.toggleActivo);

module.exports = router;
