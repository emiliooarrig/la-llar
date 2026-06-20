const express = require('express');
const router = express.Router();
const { registrarAsistencia } = require('../controllers/webhookController');
const { verificarDispositivo } = require('../middleware/deviceAuth');

// Integración de checadores físicos. Auth por token de dispositivo (no JWT):
// los checadores no son usuarios del sistema.
router.post('/asistencia', verificarDispositivo, registrarAsistencia);

module.exports = router;
