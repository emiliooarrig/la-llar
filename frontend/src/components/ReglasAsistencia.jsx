import { useEffect, useState } from 'react';
import api from '../services/api';
import Modal from './Modal';
import Campo from './Campo';
import { IconoAlerta } from './Iconos';
import { toast, avisoError } from '../lib/alertas';

/* Reglas de evaluación de asistencia (spec 004, T-409). Solo administrador.
 *
 * Son reglas del negocio entero, no de una cocina: cambiarlas re-evalúa al
 * instante todos los meses de todos los empleados, porque la evaluación se
 * deriva cada vez. Por eso el aviso al pie del formulario. */

const PERIODOS = [
  { valor: 'mes', texto: 'Mes calendario' },
  { valor: 'quincena', texto: 'Quincena (1–15 y 16–fin de mes)' },
  { valor: 'semana', texto: 'Semana (lunes a domingo)' },
];

export default function ReglasAsistencia({ onCerrar, onCambio }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get('/config/asistencia')
      .then(({ data }) => setForm({
        tolerancia_min: String(data.tolerancia_min),
        umbral_extra_min: String(data.umbral_extra_min),
        periodo_retardos: data.periodo_retardos,
      }))
      .catch(() => setError('No se pudieron cargar las reglas.'));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    const tolerancia = Number(form.tolerancia_min);
    const umbral = Number(form.umbral_extra_min);
    const fallos = {};
    if (form.tolerancia_min === '' || !Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 120) {
      fallos.tolerancia_min = 'Entre 0 y 120 minutos, sin decimales.';
    }
    if (form.umbral_extra_min === '' || !Number.isInteger(umbral) || umbral < 0 || umbral > 480) {
      fallos.umbral_extra_min = 'Entre 0 y 480 minutos, sin decimales.';
    }
    setErrores(fallos);
    if (Object.keys(fallos).length) return;

    setGuardando(true);
    try {
      await api.put('/config/asistencia', {
        tolerancia_min: tolerancia,
        umbral_extra_min: umbral,
        periodo_retardos: form.periodo_retardos,
      });
      toast('Reglas guardadas');
      onCambio();
      onCerrar();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudieron guardar las reglas.');
    } finally {
      setGuardando(false);
    }
  }

  const cambiar = (campo, valor) => {
    setForm(p => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: null }));
  };

  return (
    <Modal
      titulo="Reglas de asistencia"
      subtitulo="Aplican a todas las unidades"
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <button type="button" className="btn btn--neutro" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" form="form-reglas" className="btn btn--primario" disabled={guardando || !form}>
            {guardando && <span className="spinner" />}Guardar reglas
          </button>
        </>
      }
    >
      {error ? (
        <div className="aviso aviso--error"><IconoAlerta /><span>{error}</span></div>
      ) : !form ? (
        <p className="pista"><span className="spinner" /> Cargando…</p>
      ) : (
        <form id="form-reglas" onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
          <Campo
            etiqueta="Tolerancia de entrada (minutos)" id="r-tol" error={errores.tolerancia_min}
            pista="Llegar hasta estos minutos tarde cuenta como a tiempo. Un minuto más es retardo."
          >
            <input
              id="r-tol" type="number" min={0} max={120} step={1} inputMode="numeric"
              className={`control${errores.tolerancia_min ? ' control--invalido' : ''}`}
              value={form.tolerancia_min} onChange={e => cambiar('tolerancia_min', e.target.value)}
              disabled={guardando} data-foco-inicial
            />
          </Campo>

          <Campo
            etiqueta="Umbral de horas extra (minutos)" id="r-umbral" error={errores.umbral_extra_min}
            pista="El checador sugiere extra cuando la salida pasa de la del turno al menos estos minutos. Siempre se puede ajustar a mano por día."
          >
            <input
              id="r-umbral" type="number" min={0} max={480} step={1} inputMode="numeric"
              className={`control${errores.umbral_extra_min ? ' control--invalido' : ''}`}
              value={form.umbral_extra_min} onChange={e => cambiar('umbral_extra_min', e.target.value)}
              disabled={guardando}
            />
          </Campo>

          <Campo
            etiqueta="Periodo de conteo de retardos" id="r-periodo"
            pista="Cada 3 retardos dentro del mismo periodo generan un acta."
          >
            <select
              id="r-periodo" className="control" value={form.periodo_retardos}
              onChange={e => cambiar('periodo_retardos', e.target.value)} disabled={guardando}
            >
              {PERIODOS.map(p => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
            </select>
          </Campo>

          <div className="aviso aviso--atencion" style={{ marginBottom: 0 }}>
            <IconoAlerta />
            <span>Los cambios se aplican también a los meses anteriores: las actas se recalculan con las reglas nuevas.</span>
          </div>
        </form>
      )}
    </Modal>
  );
}
