const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/valesController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo, FORMATOS_PDF } = require('../middleware/upload');

router.use(verificarToken);

/* Vales azules (spec 002).
 *
 * Solicitan gerentes y administradores; autoriza el administrador. El
 * proveedor no aparece: sus reembolsos, si algún día los hay, irían por otra
 * puerta, y darle acceso aquí le dejaría ver la cola de vales de las cocinas.
 *
 * El alcance fino —que cada solicitante vea solo lo suyo— no se puede
 * resolver con `soloRol`, porque depende de quién subió cada vale: lo
 * comprueba el controlador contra `req.usuario.id`.
 */
const SOLICITANTES = ['administrador', 'gerente'];

// Antes de '/:id', o "reglas" se leería como el identificador de un vale.
router.get('/reglas', soloRol(...SOLICITANTES), ctrl.reglas);

router.get('/', soloRol(...SOLICITANTES), ctrl.listar);
// El comprobante es un escaneo del papel: solo PDF.
router.post('/', soloRol(...SOLICITANTES), subirArchivo('comprobante', FORMATOS_PDF), ctrl.crear);

router.get('/:id', soloRol(...SOLICITANTES), ctrl.obtener);
router.get('/:id/comprobante', soloRol(...SOLICITANTES), ctrl.descargarComprobante);

// Resolver un vale es cosa del autorizador.
router.patch('/:id/autorizar', soloRol('administrador'), ctrl.autorizar);
router.patch('/:id/rechazar', soloRol('administrador'), ctrl.rechazar);
router.delete('/:id', soloRol('administrador'), ctrl.archivar);

module.exports = router;
