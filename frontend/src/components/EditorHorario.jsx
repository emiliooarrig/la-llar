import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Modal from './Modal';
import Campo from './Campo';
import { IconoBasura, IconoAlerta, IconoMas } from './Iconos';
import { toast, avisoError, confirmar } from '../lib/alertas';
import styles from './EditorHorario.module.css';

/* Editor de horario de un empleado (spec 004, T-407).
 *
 * Dos capas, porque el negocio tiene los dos casos (spec §7):
 *   · Horario fijo — un turno por día de la semana. Lo normal en cocina.
 *   · Turnos por fecha — mandan sobre el fijo. Para quien tiene horario fijo
 *     son la excepción («el jueves 12 entra a las 10»); para quien rota son
 *     su calendario completo, y su horario fijo se deja vacío.
 *
 * Las dos se guardan por separado: son decisiones distintas, y guardar el
 * horario fijo no debería tocar los turnos de nadie ni al revés.
 */

const DIAS = [
  { iso: 1, nombre: 'Lunes' }, { iso: 2, nombre: 'Martes' }, { iso: 3, nombre: 'Miércoles' },
  { iso: 4, nombre: 'Jueves' }, { iso: 5, nombre: 'Viernes' }, { iso: 6, nombre: 'Sábado' },
  { iso: 7, nombre: 'Domingo' },
];
const MAX_FECHAS = 62;

const pad = n => String(n).padStart(2, '0');
const aFecha = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Fechas de `desde` a `hasta` que caen en los días ISO elegidos. */
function fechasDelRango(desde, hasta, dias) {
  const out = [];
  const d = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (d <= fin && out.length <= MAX_FECHAS) {
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (dias.has(iso)) out.push(aFecha(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function fechaCorta(fecha) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

const filaVacia = () => DIAS.map(d => ({ iso: d.iso, trabaja: false, entrada: '', salida: '' }));

/** Error de un turno en cliente; el servidor valida lo mismo. */
function errorTurno(entrada, salida) {
  if (!entrada || !salida) return 'Indica entrada y salida.';
  if (salida <= entrada) return 'La salida debe ser posterior a la entrada.';
  return null;
}

export default function EditorHorario({ empleado, mes, diasLaborales, onCerrar, onCambio }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [semanal, setSemanal] = useState(filaVacia);
  const [erroresSemana, setErroresSemana] = useState({});
  const [guardandoSemana, setGuardandoSemana] = useState(false);

  const [turnos, setTurnos] = useState([]);
  const [nuevo, setNuevo] = useState(() => {
    const hoy = aFecha(new Date());
    const inicio = hoy.startsWith(mes) ? hoy : `${mes}-01`;
    return { desde: inicio, hasta: inicio, tipo: 'turno', entrada: '', salida: '', dias: new Set([1, 2, 3, 4, 5, 6, 7]) };
  });
  const [erroresNuevo, setErroresNuevo] = useState({});
  const [guardandoTurno, setGuardandoTurno] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.get(`/horarios/${empleado.id}`, { params: { mes } })
      .then(({ data }) => {
        if (!vivo) return;
        const porDia = new Map(data.semanal.map(h => [h.dia_semana, h]));
        setSemanal(DIAS.map(d => {
          const h = porDia.get(d.iso);
          return { iso: d.iso, trabaja: Boolean(h), entrada: h?.entrada ?? '', salida: h?.salida ?? '' };
        }));
        setTurnos(data.turnos);
      })
      .catch(err => { if (vivo) setError(err.response?.data?.error || 'No se pudo cargar el horario.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [empleado.id, mes]);

  const fechasNuevas = useMemo(() => {
    if (!nuevo.desde || !nuevo.hasta || nuevo.hasta < nuevo.desde) return [];
    return fechasDelRango(nuevo.desde, nuevo.hasta, nuevo.dias);
  }, [nuevo.desde, nuevo.hasta, nuevo.dias]);

  function cambiarDia(iso, cambios) {
    setSemanal(prev => prev.map(f => (f.iso === iso ? { ...f, ...cambios } : f)));
    if (erroresSemana[iso]) setErroresSemana(p => ({ ...p, [iso]: null }));
  }

  /* El atajo más usado: mismo turno de lunes a sábado. Copia el primer día
     con turno a todos los días laborales de la unidad. */
  function copiarATodos() {
    const modelo = semanal.find(f => f.trabaja && f.entrada && f.salida);
    if (!modelo) return;
    setSemanal(prev => prev.map(f => (diasLaborales.has(f.iso)
      ? { ...f, trabaja: true, entrada: modelo.entrada, salida: modelo.salida }
      : f)));
    setErroresSemana({});
  }

  async function guardarSemanal() {
    const fallos = {};
    for (const f of semanal) {
      if (!f.trabaja) continue;
      const e = errorTurno(f.entrada, f.salida);
      if (e) fallos[f.iso] = e;
    }
    setErroresSemana(fallos);
    if (Object.keys(fallos).length) return;

    setGuardandoSemana(true);
    try {
      await api.put(`/horarios/${empleado.id}/semanal`, {
        dias: semanal.filter(f => f.trabaja).map(f => ({ dia_semana: f.iso, entrada: f.entrada, salida: f.salida })),
      });
      toast('Horario fijo guardado');
      onCambio();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo guardar el horario.');
    } finally {
      setGuardandoSemana(false);
    }
  }

  async function asignarTurnos(e) {
    e.preventDefault();
    const fallos = {};
    if (!nuevo.desde) fallos.desde = 'Elige la fecha.';
    if (nuevo.hasta && nuevo.hasta < nuevo.desde) fallos.hasta = 'Debe ser igual o posterior al inicio.';
    if (nuevo.tipo === 'turno') {
      const t = errorTurno(nuevo.entrada, nuevo.salida);
      if (t) fallos.salida = t;
    }
    if (!fallos.desde && !fallos.hasta) {
      if (fechasNuevas.length === 0) fallos.dias = 'El rango no incluye ninguno de los días elegidos.';
      if (fechasNuevas.length > MAX_FECHAS) fallos.hasta = `Como máximo ${MAX_FECHAS} fechas a la vez.`;
    }
    setErroresNuevo(fallos);
    if (Object.keys(fallos).length) return;

    setGuardandoTurno(true);
    try {
      const { data } = await api.put(`/horarios/${empleado.id}/turnos`, {
        turnos: fechasNuevas.map(fecha => (nuevo.tipo === 'descanso'
          ? { fecha, descanso: true }
          : { fecha, entrada: nuevo.entrada, salida: nuevo.salida })),
      });
      // Se fusionan con lo que ya había: la respuesta trae solo los tocados.
      const porFecha = new Map(turnos.map(t => [t.fecha, t]));
      for (const t of data.turnos) porFecha.set(t.fecha, t);
      setTurnos([...porFecha.values()].filter(t => t.fecha.startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha)));
      toast(data.turnos.length === 1 ? 'Turno asignado' : `${data.turnos.length} turnos asignados`);
      onCambio();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudieron asignar los turnos.');
    } finally {
      setGuardandoTurno(false);
    }
  }

  async function quitarTurno(fecha) {
    const ok = await confirmar({
      titulo: '¿Quitar el turno de esta fecha?',
      texto: 'El día volverá a regirse por el horario fijo, o quedará sin horario si no tiene.',
      confirmar: 'Quitar turno',
    });
    if (!ok) return;
    try {
      await api.delete(`/horarios/${empleado.id}/turnos/${fecha}`);
      setTurnos(prev => prev.filter(t => t.fecha !== fecha));
      toast('Turno quitado');
      onCambio();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo quitar el turno.');
    }
  }

  const hayModelo = semanal.some(f => f.trabaja && f.entrada && f.salida);
  const [, numMes] = mes.split('-').map(Number);
  const nombreMes = new Date(2000, numMes - 1, 1).toLocaleDateString('es-MX', { month: 'long' });
  const rangoLargo = nuevo.desde && nuevo.hasta && nuevo.hasta > nuevo.desde;

  return (
    <Modal
      titulo="Horario del empleado"
      subtitulo={empleado.nombre}
      onCerrar={onCerrar}
      ancho
      bloqueado={guardandoSemana || guardandoTurno}
      pie={<button type="button" className="btn btn--neutro" onClick={onCerrar}>Cerrar</button>}
    >
      {cargando ? (
        <div className={styles.cargando}><span className="spinner" /> Cargando horario…</div>
      ) : error ? (
        <div className="aviso aviso--error"><IconoAlerta /><span>{error}</span></div>
      ) : (
        <div className={styles.editor}>
          {/* ── Horario fijo ── */}
          <section className={styles.bloque} aria-labelledby="h-fijo">
            <div className={styles.bloqueCabeza}>
              <div>
                <h3 id="h-fijo" className={styles.bloqueTitulo}>Horario fijo</h3>
                <p className={styles.bloqueTexto}>
                  Un turno por día de la semana. Si el empleado rota, déjalo vacío y asígnale turnos por fecha.
                </p>
              </div>
              <button
                type="button" className="btn btn--fantasma btn--sm" onClick={copiarATodos}
                disabled={!hayModelo || guardandoSemana}
                title="Copia el primer turno a todos los días laborales de la unidad"
              >
                Copiar a días laborales
              </button>
            </div>

            <div className={styles.semana} role="group" aria-label="Turno por día de la semana">
              {semanal.map(f => {
                const dia = DIAS[f.iso - 1];
                const noLaboral = !diasLaborales.has(f.iso);
                return (
                  <div key={f.iso} className={`${styles.dia}${f.trabaja ? '' : ` ${styles.diaLibre}`}`}>
                    <label className={styles.diaNombre}>
                      <input
                        type="checkbox" checked={f.trabaja}
                        onChange={e => cambiarDia(f.iso, { trabaja: e.target.checked })}
                        disabled={guardandoSemana}
                      />
                      <span>{dia.nombre}</span>
                      {noLaboral && <span className={styles.diaNota}>no laboral</span>}
                    </label>
                    {f.trabaja ? (
                      <span className={styles.diaHoras}>
                        <input
                          type="time" className={`control${erroresSemana[f.iso] ? ' control--invalido' : ''}`}
                          aria-label={`Entrada del ${dia.nombre.toLowerCase()}`}
                          value={f.entrada} onChange={e => cambiarDia(f.iso, { entrada: e.target.value })}
                          disabled={guardandoSemana}
                        />
                        <span className={styles.guion} aria-hidden="true">a</span>
                        <input
                          type="time" className={`control${erroresSemana[f.iso] ? ' control--invalido' : ''}`}
                          aria-label={`Salida del ${dia.nombre.toLowerCase()}`}
                          value={f.salida} onChange={e => cambiarDia(f.iso, { salida: e.target.value })}
                          disabled={guardandoSemana}
                        />
                      </span>
                    ) : (
                      <span className={styles.diaSinTurno}>Sin turno</span>
                    )}
                    {erroresSemana[f.iso] && <span className={`error-campo ${styles.diaError}`}>{erroresSemana[f.iso]}</span>}
                  </div>
                );
              })}
            </div>

            <div className={styles.acciones}>
              <button type="button" className="btn btn--primario btn--sm" onClick={guardarSemanal} disabled={guardandoSemana}>
                {guardandoSemana && <span className="spinner" />}Guardar horario fijo
              </button>
            </div>
          </section>

          {/* ── Turnos por fecha ── */}
          <section className={styles.bloque} aria-labelledby="h-fechas">
            <div>
              <h3 id="h-fechas" className={styles.bloqueTitulo}>Turnos por fecha</h3>
              <p className={styles.bloqueTexto}>
                Mandan sobre el horario fijo: úsalos para una excepción, un descanso o el calendario de quien rota.
              </p>
            </div>

            <form className={styles.nuevo} onSubmit={asignarTurnos} noValidate>
              <div className={styles.nuevoFila}>
                <Campo etiqueta="Desde" id="t-desde" error={erroresNuevo.desde}>
                  <input
                    id="t-desde" type="date" className={`control${erroresNuevo.desde ? ' control--invalido' : ''}`}
                    value={nuevo.desde}
                    onChange={e => setNuevo(p => ({ ...p, desde: e.target.value, hasta: p.hasta < e.target.value ? e.target.value : p.hasta }))}
                    disabled={guardandoTurno}
                  />
                </Campo>
                <Campo etiqueta="Hasta" id="t-hasta" error={erroresNuevo.hasta}>
                  <input
                    id="t-hasta" type="date" className={`control${erroresNuevo.hasta ? ' control--invalido' : ''}`}
                    value={nuevo.hasta} min={nuevo.desde}
                    onChange={e => setNuevo(p => ({ ...p, hasta: e.target.value }))}
                    disabled={guardandoTurno}
                  />
                </Campo>
                <Campo etiqueta="Tipo" id="t-tipo">
                  <select
                    id="t-tipo" className="control" value={nuevo.tipo}
                    onChange={e => setNuevo(p => ({ ...p, tipo: e.target.value }))}
                    disabled={guardandoTurno}
                  >
                    <option value="turno">Trabaja</option>
                    <option value="descanso">Descansa</option>
                  </select>
                </Campo>
              </div>

              {rangoLargo && (
                <div className={styles.filtroDias}>
                  <span className="etiqueta">Solo estos días</span>
                  <div className={styles.chipsDias}>
                    {DIAS.map(d => {
                      const activo = nuevo.dias.has(d.iso);
                      return (
                        <button
                          key={d.iso} type="button" aria-pressed={activo}
                          className={`chip${activo ? ' chip--activo' : ''}`}
                          onClick={() => setNuevo(p => {
                            const dias = new Set(p.dias);
                            if (dias.has(d.iso)) dias.delete(d.iso); else dias.add(d.iso);
                            return { ...p, dias };
                          })}
                          disabled={guardandoTurno}
                        >
                          {d.nombre.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {erroresNuevo.dias && <span className="error-campo">{erroresNuevo.dias}</span>}
                </div>
              )}

              {nuevo.tipo === 'turno' && (
                <div className={styles.nuevoFila}>
                  <Campo etiqueta="Entrada" id="t-entrada">
                    <input
                      id="t-entrada" type="time" className="control"
                      value={nuevo.entrada} onChange={e => setNuevo(p => ({ ...p, entrada: e.target.value }))}
                      disabled={guardandoTurno}
                    />
                  </Campo>
                  <Campo etiqueta="Salida" id="t-salida" error={erroresNuevo.salida}>
                    <input
                      id="t-salida" type="time" className={`control${erroresNuevo.salida ? ' control--invalido' : ''}`}
                      value={nuevo.salida} onChange={e => setNuevo(p => ({ ...p, salida: e.target.value }))}
                      disabled={guardandoTurno}
                    />
                  </Campo>
                </div>
              )}

              <div className={styles.acciones}>
                <span className="pista">
                  {fechasNuevas.length === 0 ? 'Ninguna fecha seleccionada'
                    : fechasNuevas.length === 1 ? `Se asignará el ${fechaCorta(fechasNuevas[0])}. Reemplaza el turno que ya tuviera.`
                    : `Se asignarán ${Math.min(fechasNuevas.length, MAX_FECHAS)} fechas. Reemplazan los turnos que ya tuvieran.`}
                </span>
                <button type="submit" className="btn btn--primario btn--sm" disabled={guardandoTurno}>
                  {guardandoTurno ? <span className="spinner" /> : <IconoMas tamano={15} />}Asignar
                </button>
              </div>
            </form>

            <div className={styles.lista}>
              <span className={styles.listaTitulo}>Asignados en {nombreMes}</span>
              {turnos.length === 0 ? (
                <p className={styles.vacio}>Ningún turno por fecha este mes.</p>
              ) : (
                <ul className={styles.turnos}>
                  {turnos.map(t => (
                    <li key={t.fecha} className={styles.turno}>
                      <span className={styles.turnoFecha}>{fechaCorta(t.fecha)}</span>
                      <span className={t.descanso ? styles.turnoDescanso : styles.turnoHoras}>
                        {t.descanso ? 'Descansa' : `${t.entrada} – ${t.salida}`}
                      </span>
                      <button
                        type="button" className="btn-icono tono-error" onClick={() => quitarTurno(t.fecha)}
                        title="Quitar turno" aria-label={`Quitar el turno del ${fechaCorta(t.fecha)}`}
                      >
                        <IconoBasura />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
