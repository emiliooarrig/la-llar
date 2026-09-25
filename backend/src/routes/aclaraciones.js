const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aclaracionesController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo, FORMATOS_DOCUMENTO } = require('../middleware/upload');

router.use(verificarToken);

/* Aclaraciones de proveedores (spec 003).
 *
 * Solo administrador y proveedor: el negocio confirmó que las aclaraciones
 * son únicamente de proveedores (§7), así que el gerente no entra.
 *
 * El alcance fino —que un proveedor toque solo sus aclaraciones— depende de
 * a quién pertenece cada una: lo comprueba `cargarAclaracion` contra
 * `req.usuario.proveedor_id`, que además corta con 409 las escrituras sobre
 * una aclaración cerrada. */
const PARTICIPANTES = ['administrador', 'proveedor'];

const lectura = ctrl.cargarAclaracion();
const escritura = ctrl.cargarAclaracion({ escritura: true });

router.get('/', soloRol(...PARTICIPANTES), ctrl.listar);
router.post('/', soloRol(...PARTICIPANTES), ctrl.crear);

router.get('/:id', soloRol(...PARTICIPANTES), lectura, ctrl.obtener);
router.post('/:id/notas', soloRol(...PARTICIPANTES), escritura, ctrl.agregarNota);

// El alcance y el estado se comprueban ANTES de multer: una aclaración ajena
// o cerrada se rechaza sin llegar a escribir el archivo en disco. El soporte
// admite los mismos formatos que la documentación genérica (PDF/XLSX/DOCX).
router.post(
  '/:id/documentos',
  soloRol(...PARTICIPANTES),
  escritura,
  subirArchivo('archivo', FORMATOS_DOCUMENTO),
  ctrl.adjuntarSoporte
);
router.get('/:id/documentos/:docId/archivo', soloRol(...PARTICIPANTES), lectura, ctrl.descargarSoporte);

// Cerrar es cosa del administrador.
router.patch('/:id/cerrar', soloRol('administrador'), escritura, ctrl.cerrar);

module.exports = router;
