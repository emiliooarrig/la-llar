const express = require('express');
const router = express.Router();
const ctrl  = require('../controllers/unidadesController');
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
