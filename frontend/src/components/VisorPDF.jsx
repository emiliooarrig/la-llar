import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import styles from './VisorPDF.module.css';

/**
 * Visor de PDF en modal. Usa el visor nativo del navegador: descarga el
 * archivo como blob (el interceptor de `api` pone el JWT) y lo entrega a un
 * <iframe> mediante una URL de objeto. Así no hace falta un endpoint público
 * ni una librería de renderizado.
 *
 * @param doc       Documento a mostrar, o null para no renderizar nada.
 *                  Se usan `nombre_original` y `tipo_mime`.
 * @param url       Ruta del endpoint de descarga del documento.
 * @param onCerrar  Se invoca al cerrar el visor.
 */
export default function VisorPDF({ doc, url, onCerrar }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError]     = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    if (!doc) return undefined;

    let cancelado = false;
    setBlobUrl(null);
    setError(null);

    (async () => {
      try {
        const res = await api.get(url, { responseType: 'blob' });
        if (cancelado) return;
        // Forzamos el tipo: el endpoint responde con Content-Disposition de
        // descarga y sin este type el navegador no lo pinta en el iframe.
        const objeto = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        urlRef.current = objeto;
        setBlobUrl(objeto);
      } catch {
        if (!cancelado) setError('No se pudo abrir el documento.');
      }
    })();

    return () => {
      cancelado = true;
      // Sin revocar, cada apertura deja el archivo retenido en memoria.
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [doc, url]);

  useEffect(() => {
    if (!doc) return undefined;
    const alPulsar = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPulsar);
    // Evita que la página de atrás se desplace mientras el visor está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [doc, onCerrar]);

  if (!doc) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={e => e.target === e.currentTarget && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${doc.nombre_original}`}
    >
      <div className={styles.visor}>
        <header className={styles.barra}>
          <span className={styles.nombre} title={doc.nombre_original}>
            {doc.nombre_original}
          </span>
          <div className={styles.acciones}>
            {blobUrl && (
              <a
                className={styles.btnBarra}
                href={blobUrl}
                download={doc.nombre_original}
                title="Descargar"
              >
                <IconoDescarga />
                <span className={styles.btnTexto}>Descargar</span>
              </a>
            )}
            <button className={styles.btnCerrar} onClick={onCerrar} aria-label="Cerrar vista previa">
              <IconoCerrar />
            </button>
          </div>
        </header>

        <div className={styles.lienzo}>
          {error ? (
            <div className={styles.estado}>
              <p>{error}</p>
              <button className={styles.btnReintentar} onClick={onCerrar}>Cerrar</button>
            </div>
          ) : !blobUrl ? (
            <div className={styles.estado}>
              <div className={styles.spinner} />
              Cargando documento…
            </div>
          ) : (
            <iframe
              className={styles.marco}
              src={blobUrl}
              title={doc.nombre_original}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** true si el documento puede abrirse en el visor nativo. */
export function esVisualizable(doc) {
  return Boolean(doc?.tipo_mime?.includes('pdf'));
}

/* ── Iconos ─────────────────────────────────────────────── */
function IconoDescarga() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}
function IconoCerrar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
