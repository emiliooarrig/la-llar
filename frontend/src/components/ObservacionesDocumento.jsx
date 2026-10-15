import { useState } from 'react';
import Modal from './Modal';
import Campo from './Campo';
import Insignia from './Insignia';
import { IconoAclaracion } from './Iconos';
import { formatFechaHora } from '../lib/formato';
import styles from './ObservacionesDocumento.module.css';

/* Observaciones de los documentos de proveedores y unidades: el mismo
   criterio que las de facturas (PanelFacturas). Rechazar exige escribir el
   motivo, y quien subió el archivo lo lee junto a su documento para saber
   qué corregir. Lo usan el detalle del administrador, la bandeja «Por
   revisar» y la pantalla de quien sube. */

const ETIQUETA_ESTADO = { pendiente: 'En revisión', aprobado: 'Aprobado', desaprobado: 'Rechazado' };

/**
 * Pide el motivo antes de rechazar.
 *
 * @param doc          documento a rechazar (`nombre_original`)
 * @param onConfirmar  async (texto) => void. Si lanza, el mensaje del
 *                     backend se muestra bajo el campo y el modal sigue
 *                     abierto.
 * @param encima       por encima del visor de PDF (la bandeja rechaza
 *                     desde ahí).
 */
export function ModalRechazo({ doc, onConfirmar, onCerrar, encima = false }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const texto = motivo.trim();

    // Misma regla que el backend, dicha antes del viaje.
    if (!texto) {
      setError('Escribe por qué se rechaza. Quien subió el documento lo va a leer.');
      return;
    }

    setGuardando(true);
    try {
      await onConfirmar(texto);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo rechazar el documento.');
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Rechazar el documento"
      subtitulo={doc.nombre_original}
      onCerrar={onCerrar}
      bloqueado={guardando}
      encima={encima}
      pie={
        <>
          <button type="button" className="btn btn--neutro" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" form="form-rechazo-doc" className="btn btn--peligro" disabled={guardando}>
            {guardando && <span className="spinner" />}
            Rechazar
          </button>
        </>
      }
    >
      <form id="form-rechazo-doc" onSubmit={enviar} noValidate>
        <Campo
          etiqueta="Motivo del rechazo"
          error={error}
          id="motivo-rechazo"
          pista="Quien lo subió lo verá junto a su documento: dile exactamente qué corregir."
        >
          <textarea
            id="motivo-rechazo" className={`control${error ? ' control--invalido' : ''}`}
            rows={4} maxLength={500}
            placeholder="Ej. La constancia de situación fiscal está vencida; sube la del mes en curso."
            value={motivo}
            onChange={e => { setMotivo(e.target.value); if (error) setError(null); }}
            disabled={guardando} data-foco-inicial
          />
        </Campo>
      </form>
    </Modal>
  );
}

/** Historial completo de observaciones de un documento: qué se le dijo a
 *  quien lo subió y cuándo. Solo lectura, como en facturas. */
export function ModalObservaciones({ doc, onCerrar }) {
  const obs = doc.observaciones ?? [];
  return (
    <Modal
      titulo="Observaciones"
      subtitulo={doc.nombre_original}
      onCerrar={onCerrar}
      pie={<button type="button" className="btn btn--neutro" onClick={onCerrar}>Cerrar</button>}
    >
      <div className={styles.bloque}>
        <span className={styles.estado}>
          Estado actual: <Insignia estado={doc.estado}>{ETIQUETA_ESTADO[doc.estado]}</Insignia>
        </span>
        {obs.length === 0 ? (
          <p className={styles.hiloVacio}>No hay observaciones en este documento.</p>
        ) : (
          <div className={styles.hilo}>
            {obs.map(o => (
              <div className={styles.nota} key={o.id}>
                <p className={styles.notaTexto}>{o.texto}</p>
                <p className={styles.notaPie}>
                  {o.autor ? `${o.autor} · ` : ''}{formatFechaHora(o.creado_en)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Acceso al historial desde la tabla. No pinta nada si no hay notas. */
export function BotonObservaciones({ doc, onAbrir }) {
  const n = doc.observaciones?.length ?? 0;
  if (n === 0) return null;
  return (
    <button
      type="button" className={styles.boton} onClick={() => onAbrir(doc)}
      title="Ver observaciones" aria-label={`Ver ${n} observaci${n === 1 ? 'ón' : 'ones'} de ${doc.nombre_original}`}
    >
      <IconoAclaracion tamano={13} /> {n}
    </button>
  );
}

/** Último motivo de rechazo bajo el nombre del archivo: quien subió el
 *  documento no debería tener que abrir nada para saber qué corregir. */
export function MotivoRechazo({ doc }) {
  const ultima = doc.estado === 'desaprobado' ? doc.observaciones?.[0] : null;
  if (!ultima) return null;
  return (
    <span className={styles.motivo} title={ultima.texto}>
      Motivo: {ultima.texto}
    </span>
  );
}

/** Nombre del archivo con el motivo del rechazo debajo, si lo hay. */
export function NombreConMotivo({ doc }) {
  return (
    <span className={styles.nombre}>
      <span className="texto-cortado" title={doc.nombre_original}>{doc.nombre_original}</span>
      <MotivoRechazo doc={doc} />
    </span>
  );
}
