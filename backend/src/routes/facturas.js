const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/facturasController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirFactura } = require('../middleware/upload');

router.use(verificarToken);

/* Facturación de proveedores (spec 001).
 *
 * El gerente no aparece en ninguna de estas rutas: la pregunta abierta §7
 * se resolvió en que proveedores es cosa de admin y proveedor únicamente.
 *
 * El alcance fino —que un proveedor solo toque lo suyo— no se puede resolver
 * aquí, porque depende de a quién pertenece cada factura: lo comprueba el
 * controlador contra `req.usuario.proveedor_id`. */

// Resumen semanal. Antes de '/:facturaId' o 'resumen' se leería como un id.
router.get('/resumen', soloRol('administrador'), ctrl.resumen);

router.get('/:facturaId', soloRol('administrador', 'proveedor'), ctrl.obtener);
router.get('/:facturaId/xml', soloRol('administrador', 'proveedor'), ctrl.descargarXml);
router.get('/:facturaId/pdf', soloRol('administrador', 'proveedor'), ctrl.descargarPdf);

// Revisión: solo el administrador decide.
router.patch('/:facturaId/estado', soloRol('administrador'), ctrl.actualizarEstado);
router.post('/:facturaId/observaciones', soloRol('administrador'), ctrl.agregarObservacion);
router.patch('/:facturaId/pago', soloRol('administrador'), ctrl.marcarPago);

// Complemento de pago: lo sube el proveedor (o el administrador en su
// nombre) y lo revisa el administrador.
router.post('/:facturaId/complemento', soloRol('administrador', 'proveedor'), subirFactura(), ctrl.subirComplemento);
router.patch('/:facturaId/complemento/estado', soloRol('administrador'), ctrl.actualizarEstadoComplemento);

module.exports = router;
