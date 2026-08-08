const express = require('express');
const router = express.Router();
const ctrl  = require('../controllers/unidadesController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { subirArchivo } = require('../middleware/upload');

router.use(verificarToken);

// Valida formato (extensión + contenido real) y escribe en disco. Si el
// archivo no es PDF/XLSX/DOCX, corta con 400 antes de llegar al controlador.
const uploadSingle = subirArchivo('archivo');

// Rutas estáticas ANTES que las dinámicas
router.get('/documentos/:docId/descargar', soloRol('administrador', 'gerente'), ctrl.descargar);
router.patch('/documentos/:docId/estado', soloRol('administrador'), ctrl.actualizarEstado);
router.delete('/documentos/:docId', soloRol('administrador'), ctrl.eliminarDocumento);

// CRUD del catálogo de unidades (exclusivo del administrador).
// Definido antes de las rutas con ':id' dinámico para evitar colisiones.
router.post('/', soloRol('administrador'), ctrl.crear);
router.put('/:id', soloRol('administrador'), ctrl.actualizar);
router.patch('/:id/activo', soloRol('administrador'), ctrl.toggleActivo);

// Rutas de unidades
router.get('/', soloRol('administrador', 'gerente'), ctrl.listar);
router.get('/:id', soloRol('administrador', 'gerente'), ctrl.obtener);
router.post('/:id/documentos', soloRol('administrador', 'gerente'), uploadSingle, ctrl.subirDocumento);

module.exports = router;
