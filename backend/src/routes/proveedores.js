const express = require('express');
const router = express.Router();
const ctrl  = require('../controllers/proveedoresController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo, subirFactura } = require('../middleware/upload');
const registro = require('../controllers/registroController');
const facturas = require('../controllers/facturasController');

router.use(verificarToken);

// Valida formato (extensión + contenido real) y escribe en disco. Si el
// archivo no es PDF/XLSX/DOCX, corta con 400 antes de llegar al controlador.
const uploadSingle = subirArchivo('archivo');

// Invitaciones de alta (spec 001 HU-1). Van con las estáticas y antes que
// '/:id', o un GET a /invitaciones se interpretaría como el proveedor nº
// "invitaciones". El registro en sí vive en /api/registro (público).
router.get('/invitaciones', soloRol('administrador'), registro.listarInvitaciones);
router.post('/invitaciones', soloRol('administrador'), registro.crearInvitacion);

// Rutas estáticas ANTES que las dinámicas
router.get('/documentos/:docId/descargar', soloRol('administrador', 'proveedor'), ctrl.descargar);
router.patch('/documentos/:docId/estado', soloRol('administrador'), ctrl.actualizarEstado);
router.delete('/documentos/:docId', soloRol('administrador'), ctrl.eliminarDocumento);

// CRUD del catálogo de proveedores (exclusivo del administrador).
// Definido antes de las rutas con ':id' dinámico para evitar colisiones.
router.post('/', soloRol('administrador'), ctrl.crear);
router.put('/:id', soloRol('administrador'), ctrl.actualizar);
router.patch('/:id/activo', soloRol('administrador'), ctrl.toggleActivo);

// Configuración del proveedor que usa la facturación (spec 001 HU-8 y HU-10).
router.patch('/:id/credito', soloRol('administrador'), ctrl.actualizarCredito);
router.patch('/:id/bloqueo', soloRol('administrador'), ctrl.actualizarBloqueo);

// Facturas del proveedor. La subida lleva DOS archivos (xml + pdf).
router.get('/:id/facturas', soloRol('administrador', 'proveedor'), facturas.listarPorProveedor);
router.post('/:id/facturas', soloRol('administrador', 'proveedor'), subirFactura(), facturas.subirFactura);

// Rutas de proveedores
router.get('/', soloRol('administrador', 'proveedor'), ctrl.listar);
router.get('/:id', soloRol('administrador', 'proveedor'), ctrl.obtener);
router.post('/:id/documentos', soloRol('administrador', 'proveedor'), uploadSingle, ctrl.subirDocumento);

module.exports = router;
