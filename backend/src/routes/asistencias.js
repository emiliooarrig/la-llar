const express = require('express');
const router = express.Router();
const { mesEmpleado, guardarDia, reporteUnidad } = require('../controllers/asistenciasController');
const horarios = require('../controllers/horariosController');
const resumenes = require('../controllers/resumenController');
const { verificarToken, soloRol } = require('../middleware/auth');

router.use(verificarToken);

// Reporte PDF de toda la unidad: administrador (cualquiera) y gerente (la suya).
router.get('/reporte', soloRol('administrador', 'gerente'), reporteUnidad);
// Lectura: administrador (todas las unidades) y gerente (solo la suya).
router.get('/', soloRol('administrador', 'gerente'), mesEmpleado);
// Edición de marcas/justificaciones: administrador siempre; gerente solo sobre
// su unidad y mientras la ventana `asistencias` esté abierta (validado en el controlador).
router.put('/dia', soloRol('administrador', 'gerente'), guardarDia);

// Evaluación contra horario (spec 004): puntualidad, retardos, actas y
// horas extra. Administrador y gerente de la unidad (alcance en el
// controlador). Asignar extra a mano no necesita la ventana de edición:
// no toca marcas, es parte de llevar la cocina.
router.get('/evaluacion', soloRol('administrador', 'gerente'), horarios.evaluacion);
router.get('/acta', soloRol('administrador', 'gerente'), horarios.actaPDF);
router.put('/horas-extra', soloRol('administrador', 'gerente'), horarios.asignarExtra);
router.delete('/horas-extra', soloRol('administrador', 'gerente'), horarios.quitarExtra);

// Resumen semanal por empleado (spec 005): JSON o PDF bajo demanda, lote de
// toda la unidad y archivo en el Histórico. Mismo alcance que la evaluación.
router.get('/resumen', soloRol('administrador', 'gerente'), resumenes.resumen);
router.get('/resumen/lote', soloRol('administrador', 'gerente'), resumenes.resumenLote);
router.post('/resumen/historico', soloRol('administrador', 'gerente'), resumenes.mandarAlHistorico);

module.exports = router;
