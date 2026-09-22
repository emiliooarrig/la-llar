const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alertasController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

/* Alertas in-app (spec 001 HU-6). Se calculan al vuelo: no hay tabla que
   mantener ni estado de "leída" que sincronizar. */
router.get('/', soloRol('administrador'), ctrl.listar);
router.get('/mias', soloRol('proveedor'), ctrl.mias);

module.exports = router;
