const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/configController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo, FORMATOS_PDF } = require('../middleware/upload');

router.use(verificarToken);

/* Ajustes que el administrador publica y el resto consulta. Hoy solo el
   ejemplo de factura (spec 001 HU-7). */
router.get('/ejemplo-factura/info', soloRol('administrador', 'proveedor'), ctrl.infoEjemploFactura);
router.get('/ejemplo-factura', soloRol('administrador', 'proveedor'), ctrl.descargarEjemploFactura);

// Solo PDF: el ejemplo se mira, no se rellena.
router.put('/ejemplo-factura', soloRol('administrador'), subirArchivo('archivo', FORMATOS_PDF), ctrl.publicarEjemploFactura);

module.exports = router;
