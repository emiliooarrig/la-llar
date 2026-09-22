const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/registroController');
const { registroLimiter } = require('../middleware/rateLimit');

/* Alta de proveedor por link de invitación (spec 001 HU-1).
 *
 * Estas son las ÚNICAS rutas del sistema sin `verificarToken`: quien las
 * llama todavía no tiene cuenta —viene justo a crearla—. Lo que hace de
 * portero es el token de la URL: 256 bits aleatorios, de un solo uso y con
 * caducidad, cuyo hash es lo único que se guarda.
 *
 * El rate limit va en el router, no en cada ruta, para que no se olvide al
 * añadir la siguiente. */
router.use(registroLimiter);

router.get('/:token', ctrl.validarToken);
router.post('/:token', ctrl.registrar);

module.exports = router;
