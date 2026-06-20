const express = require('express');
const router = express.Router();
const ctrl  = require('../controllers/proveedoresController');
const { verificarToken, soloRol } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(verificarToken);

// Multer con manejo de errores inline
function uploadSingle(req, res, next) {
  upload.single('archivo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

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
