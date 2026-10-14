const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/configController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo, FORMATOS_PDF } = require('../middleware/upload');

router.use(verificarToken);

/* Ajustes que el administrador publica y el resto consulta: los ejemplos en
   PDF. Cada uno lo ve solo quien lo necesita — el de factura los
   proveedores (spec 001 HU-7), el de vale los gerentes, que son quienes
   llenan el papel. Solo PDF: el ejemplo se mira, no se rellena. */
router.get('/ejemplo-factura/info', soloRol('administrador', 'proveedor'), ctrl.infoEjemploFactura);
router.get('/ejemplo-factura', soloRol('administrador', 'proveedor'), ctrl.descargarEjemploFactura);
router.put('/ejemplo-factura', soloRol('administrador'), subirArchivo('archivo', FORMATOS_PDF), ctrl.publicarEjemploFactura);

router.get('/ejemplo-vale/info', soloRol('administrador', 'gerente'), ctrl.infoEjemploVale);
router.get('/ejemplo-vale', soloRol('administrador', 'gerente'), ctrl.descargarEjemploVale);
router.put('/ejemplo-vale', soloRol('administrador'), subirArchivo('archivo', FORMATOS_PDF), ctrl.publicarEjemploVale);

// Reglas de evaluación de asistencia (spec 004): tolerancia, umbral de
// horas extra y periodo de conteo de retardos.
router.get('/asistencia', soloRol('administrador', 'gerente'), ctrl.leerAsistencia);
router.put('/asistencia', soloRol('administrador'), ctrl.guardarAsistencia);

module.exports = router;
