const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/historicosController');
const { verificarToken, soloRol } = require('../middleware/auth');

// El archivo histórico es exclusivo del administrador: consulta, envío y descarga.
router.use(verificarToken, soloRol('administrador'));

router.get('/', ctrl.listar);
router.post('/', ctrl.enviar);
router.get('/:id/descargar', ctrl.descargar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
