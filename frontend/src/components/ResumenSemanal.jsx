import { useEffect, useState } from 'react';
import api from '../services/api';
import { IconoChevron, IconoDescargar, IconoArchivar, IconoAlerta, IconoInfo } from './Iconos';
import { descargarArchivo } from '../lib/descargas';
import { confirmar, toast, avisoError } from '../lib/alertas';
import { ETIQUETA_EVAL, NOMBRE_DIA_LARGO, formatearMinutos, fechaLegible } from '../lib/asistencia';
import styles from './ResumenSemanal.module.css';

/* Resumen semanal por empleado (spec 005, T-504).
 *
 * Lo que se ve aquí es EXACTAMENTE el JSON que el backend usa para el PDF:
 * la tabla no recalcula nada, solo pinta. Así el papel que firma el
 * empleado dice lo mismo que la pantalla (HU-3).
 *
 * La semana es la de la unidad (spec 005 §7): el backend la corta en su día
 * de arranque. Aquí solo se navega de 7 en 7 días a partir del inicio que
 * devuelve.
 *
 * Tres salidas: el PDF para firma, el mismo PDF archivado en el Histórico
 * con folio, y el lote de toda la unidad para imprimir de una vez.
 */

const pad = n => String(n).padStart(2, '0');
const hoyLocal = () => { const h = new Date(); return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`; };

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const diaIso = fecha => { const d = new Date(`${fecha}T00:00:00`).getDay(); return d === 0 ? 7 : d; };

const TONO_ESTADO = {
  puntual: styles.estado_puntual,
  retardo: styles.estado_retardo,
  falta: styles.estado_falta,
  justificado: styles.estado_justificado,
};

export default function ResumenSemanal({ empleado, sucursalId, mes, version, esAdmin }) {
  // Arranca en la semana de hoy si se está viendo el mes en curso; si no,
  // en la primera semana del mes que se está mirando en el calendario.
  const [semana, setSemana] = useState(() => (hoyLocal().startsWith(mes) ? hoyLocal() : `${mes}-01`));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null); // 'pdf' | 'historico' | 'lote'

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    api.get('/asistencias/resumen', { params: { empleado_id: empleado.id, semana } })
      .then(({ data }) => { if (vivo) setDatos(data); })
      .catch(err => { if (vivo) setError(err.response?.data?.error || 'No se pudo generar el resumen de la semana.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [empleado.id, semana, version]);

  const inicio = datos?.semana.inicio;

  async function imprimir() {
    setOcupado('pdf');
    await descargarArchivo(
      `/asistencias/resumen?empleado_id=${empleado.id}&semana=${inicio}&formato=pdf`,
      `Resumen ${empleado.nombre} ${inicio}.pdf`,
    );
    setOcupado(null);
  }

  async function imprimirLote() {
    setOcupado('lote');
    await descargarArchivo(
      `/asistencias/resumen/lote?sucursal_id=${sucursalId}&semana=${inicio}`,
      `Resúmenes de la unidad ${inicio}.pdf`,
    );
    setOcupado(null);
  }

  async function archivar() {
    const ok = await confirmar({
      titulo: '¿Mandar el resumen al Histórico?',
      texto: `Se guardará el PDF de ${empleado.nombre} (semana del ${fechaLegible(datos.semana.inicio)} al ${fechaLegible(datos.semana.fin)}) con un folio impreso. Si la semana se corrige después, puedes volver a mandarlo: quedará con otro folio.`,
      confirmar: 'Mandar al Histórico',
    });
    if (!ok) return;

    setOcupado('historico');
    try {
      const { data } = await api.post('/asistencias/resumen/historico', { empleado_id: empleado.id, semana: inicio });
      toast(`Archivado con folio ${data.folio}`);
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo archivar el resumen.');
    } finally {
      setOcupado(null);
    }
  }

  const t = datos?.totales;

  return (
    <section className={styles.resumen} aria-labelledby="titulo-resumen-semanal">
      <div className={styles.cabecera}>
        <h2 className="seccion__titulo" id="titulo-resumen-semanal">Resumen semanal para firma</h2>

        <div className={styles.navegacion}>
          <button
            type="button" className={styles.btnSemana} onClick={() => setSemana(sumarDias(inicio ?? semana, -7))}
            disabled={cargando} aria-label="Semana anterior"
          >
            <IconoChevron dir="izquierda" tamano={16} />
          </button>
          <span className={styles.rango}>
            {datos ? <>Del {fechaLegible(datos.semana.inicio)} al {fechaLegible(datos.semana.fin)}</> : 'Cargando…'}
          </span>
          <button
            type="button" className={styles.btnSemana} onClick={() => setSemana(sumarDias(inicio ?? semana, 7))}
            disabled={cargando} aria-label="Semana siguiente"
          >
            <IconoChevron dir="derecha" tamano={16} />
          </button>
        </div>

        <div className={styles.acciones}>
          <button type="button" className="btn btn--neutro btn--sm" onClick={imprimirLote} disabled={!datos || Boolean(ocupado)}
            title="Un PDF con el resumen de cada empleado activo de la unidad">
            {ocupado === 'lote' ? <span className="spinner" /> : <IconoDescargar tamano={15} />} Toda la unidad
          </button>
          <button type="button" className="btn btn--neutro btn--sm" onClick={archivar} disabled={!datos || Boolean(ocupado)}
            title="Guardar este PDF con folio en el Histórico">
            {ocupado === 'historico' ? <span className="spinner" /> : <IconoArchivar tamano={15} />} Mandar al Histórico
          </button>
          <button type="button" className="btn btn--primario btn--sm" onClick={imprimir} disabled={!datos || Boolean(ocupado)}>
            {ocupado === 'pdf' ? <span className="spinner" /> : <IconoDescargar tamano={15} />} Imprimir PDF (para firma)
          </button>
        </div>
      </div>

      {error ? (
        <div className="aviso aviso--error" role="alert"><IconoAlerta /><span>{error}</span></div>
      ) : !datos ? (
        <div className={styles.cargando}><span className="spinner" /> Armando el resumen…</div>
      ) : (
        <div className={cargando ? styles.recargando : undefined}>
          {datos.actas.length > 0 && (
            <div className="aviso aviso--error" role="status">
              <IconoAlerta />
              <span>
                <strong>Acta por retardos.</strong> Esta semana entra en {datos.actas.length === 1 ? 'un acta' : `${datos.actas.length} actas`} de
                {' '}{datos.reglas.retardos_por_acta} retardos ({datos.actas.map(a => a.retardos.map(r => fechaLegible(r.fecha)).join(', ')).join(' / ')}).
                El PDF del acta se descarga en la sección de puntualidad.
              </span>
            </div>
          )}

          <div className={styles.totales}>
            <Total numero={t.dias_trabajados} etiqueta="Días trabajados" />
            <Total numero={t.retardo} etiqueta="Retardos" tono={t.retardo ? 'atencion' : null} />
            <Total numero={t.falta} etiqueta="Faltas" tono={t.falta ? 'error' : null} />
            <Total numero={formatearMinutos(t.trabajado_min)} etiqueta="Horas trabajadas" />
            <Total numero={formatearMinutos(t.extra_min)} etiqueta="Horas extra" tono="extra" />
          </div>

          <div className={`tabla-marco ${styles.tabla}`}>
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Horario</th>
                  <th scope="col" className="th-num">Entrada</th>
                  <th scope="col" className="th-num">Salida</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="th-num">Horas</th>
                  <th scope="col" className="th-num">Extra</th>
                </tr>
              </thead>
              <tbody>
                {datos.dias.map(d => (
                  <tr key={d.fecha}>
                    <td>
                      <span className={styles.diaNombre}>{NOMBRE_DIA_LARGO[diaIso(d.fecha) - 1]}</span>
                      <span className={styles.diaFecha}>{fechaLegible(d.fecha).replace(/^\S+\s/, '')}</span>
                    </td>
                    <td className={styles.mono}>
                      {d.turno ? `${d.turno.entrada}–${d.turno.salida}` : d.turno_descanso ? 'Descanso' : '—'}
                    </td>
                    <td className={`col-num ${styles.mono}`}>{d.entrada ?? '—'}{d.corregido ? <span className={styles.corregido} title="Corregido a mano">✎</span> : null}</td>
                    <td className={`col-num ${styles.mono}`}>{d.salida ?? '—'}</td>
                    <td>
                      <span className={`${styles.estado} ${TONO_ESTADO[d.estado] ?? ''}`}>
                        {ETIQUETA_EVAL[d.estado]}{d.estado === 'retardo' ? ` +${d.retraso_min}m` : ''}
                      </span>
                    </td>
                    <td className="col-num">{d.trabajado_min ? formatearMinutos(d.trabajado_min) : '—'}</td>
                    <td className={`col-num ${d.extra_min ? styles.extra : ''}`}>
                      {d.extra_min ? `${formatearMinutos(d.extra_min)}${d.extra_fuente === 'manual' ? '*' : ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.nota}>
            <IconoInfo tamano={14} />
            <span>
              La semana de esta unidad empieza el <strong>{NOMBRE_DIA_LARGO[datos.sucursal.inicio_semana - 1].toLowerCase()}</strong>
              {esAdmin ? ' (se cambia en Unidades)' : ''}. El PDF lleva la firma del empleado y la de Recursos Humanos con tu nombre.
              La extra con * se asignó a mano.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

function Total({ numero, etiqueta, tono }) {
  return (
    <div className={`${styles.total}${tono ? ` ${styles[`total_${tono}`]}` : ''}`}>
      <span className={styles.totalNumero}>{numero}</span>
      <span className={styles.totalEtiqueta}>{etiqueta}</span>
    </div>
  );
}
