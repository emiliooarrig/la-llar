const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/horariosController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

/* Horarios de empleados (spec 004): horario fijo por día de la semana y
 * turnos por fecha (excepciones o calendario rotativo).
 *
 * Administrador: cualquier empleado. Gerente: solo los de su sucursal, que
 * comprueba el controlador contra `req.usuario.sucursal_id`. */
const EDITORES = ['administrador', 'gerente'];

router.get('/:empleadoId', soloRol(...EDITORES), ctrl.obtenerHorario);
router.put('/:empleadoId/semanal', soloRol(...EDITORES), ctrl.guardarSemanal);
router.put('/:empleadoId/turnos', soloRol(...EDITORES), ctrl.guardarTurnos);
router.delete('/:empleadoId/turnos/:fecha', soloRol(...EDITORES), ctrl.borrarTurno);

module.exports = router;
