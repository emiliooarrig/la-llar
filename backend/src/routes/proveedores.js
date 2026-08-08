const express = require('express');
const router = express.Router();
const ctrl  = require('../controllers/proveedoresController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo } = require('../middleware/upload');

router.use(verificarToken);

// Valida formato (extensión + contenido real) y escribe en disco. Si el
// archivo no es PDF/XLSX/DOCX, corta con 400 antes de llegar al controlador.
const uploadSingle = subirArchivo('archivo');

// Rutas estáticas ANTES que las dinámicas
router.get('/documentos/:docId/descargar', soloRol('administrador', 'proveedor'), ctrl.descargar);
router.patch('/documentos/:docId/estado', soloRol('administrador'), ctrl.actualizarEstado);
router.delete('/documentos/:docId', soloRol('administrador'), ctrl.eliminarDocumento);

// CRUD del catálogo de proveedores (exclusivo del administrador).
// Definido antes de las rutas con ':id' dinámico para evitar colisiones.
router.post('/', soloRol('administrador'), ctrl.crear);
router.put('/:id', soloRol('administrador'), ctrl.actualizar);
router.patch('/:id/activo', soloRol('administrador'), ctrl.toggleActivo);

// Rutas de proveedores
router.get('/', soloRol('administrador', 'proveedor'), ctrl.listar);
router.get('/:id', soloRol('administrador', 'proveedor'), ctrl.obtener);
router.post('/:id/documentos', soloRol('administrador', 'proveedor'), uploadSingle, ctrl.subirDocumento);

module.exports = router;
