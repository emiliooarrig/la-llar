const express = require('express');
const router = express.Router();
const { login, me, cambiarPassword } = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, login);
router.get('/me', verificarToken, me);
router.put('/password', verificarToken, cambiarPassword);

module.exports = router;
