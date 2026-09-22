import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { formatImporte } from '../lib/facturas';
import { IconoCerrar, IconoDescargar, IconoCheck } from './Iconos';
import shell from './VisorPDF.module.css';
import styles from './VisorXML.module.css';

/**
 * Visor de CFDI (spec 001 HU-5).
 *
 * Enseña dos cosas a la vez: los campos que de verdad se revisan —folio
 * fiscal, RFC de las dos partes, total— y el XML tal cual, para quien
 * necesite comprobar algo que el resumen no muestra.
 *
 * ── Por qué el XML se pinta como texto y no se interpreta ────────────
 * Este archivo lo subió un tercero. Meterlo en el DOM como marcado, o
 * abrirlo en un iframe con tipo XML, sería ejecutar lo que traiga dentro.
 * Aquí entra en un <pre> como cadena: React escapa el contenido, el
 * navegador lo trata como texto y no hay nada que interpretar. El endpoint
 * lo sirve además con `text/plain` y `nosniff` por el mismo motivo.
 *
 * @param factura   la factura (o su complemento) a mostrar
 * @param url       endpoint del XML
 * @param titulo    nombre a mostrar en la barra
 * @param onCerrar  cierra el visor
 */
export default function VisorXML({ factura, url, titulo, onCerrar }) {
  const [xml, setXml] = useState(null);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const cajaRef = useRef(null);

  useEffect(() => {
    if (!factura) return undefined;
    let cancelado = false;
    setXml(null);
    setError(null);

    api.get(url, { responseType: 'text', transformResponse: r => r })
      .then(({ data }) => { if (!cancelado) setXml(typeof data === 'string' ? data : String(data)); })
      .catch(() => { if (!cancelado) setError('No se pudo abrir el XML.'); });

    return () => { cancelado = true; };
  }, [factura, url]);

  useEffect(() => {
    if (!factura) return undefined;
    const alPulsar = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPulsar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [factura, onCerrar]);

  if (!factura) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(xml ?? '');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles no pasa nada: el texto se puede
      // seleccionar a mano, que es para lo que está el <pre>.
    }
  }

  const campos = [
    { etiqueta: 'Folio fiscal (UUID)', valor: factura.uuid_fiscal, mono: true },
    { etiqueta: 'Serie y folio', valor: factura.serie_folio },
    { etiqueta: 'RFC emisor', valor: factura.rfc_emisor, mono: true },
    { etiqueta: 'RFC receptor', valor: factura.rfc_receptor, mono: true },
    { etiqueta: 'Fecha del comprobante', valor: factura.fecha_cfdi ? new Date(factura.fecha_cfdi).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : null },
    { etiqueta: 'Empresa facturada', valor: factura.empresa?.nombre },
  ];

  return (
    <div
      className={shell.overlay}
      onMouseDown={e => e.target === e.currentTarget && onCerrar()}
      role="dialog" aria-modal="true"
      aria-label={`Comprobante fiscal ${factura.uuid_fiscal ?? ''}`}
    >
      <div className={shell.visor} ref={cajaRef}>
        <header className={shell.barra}>
          <span className={shell.nombre} title={titulo}>{titulo}</span>
          <div className={shell.acciones}>
            <button type="button" className={shell.btnBarra} onClick={copiar} disabled={!xml}>
              {copiado ? <IconoCheck tamano={15} /> : null}
              <span className={shell.btnTexto}>{copiado ? 'Copiado' : 'Copiar XML'}</span>
            </button>
            <a className={shell.btnBarra} href="#descargar" onClick={e => { e.preventDefault(); descargar(url, titulo); }}>
              <IconoDescargar tamano={15} />
              <span className={shell.btnTexto}>Descargar</span>
            </a>
            <button className={shell.btnCerrar} onClick={onCerrar} aria-label="Cerrar el comprobante">
              <IconoCerrar />
            </button>
          </div>
        </header>

        <div className={styles.cuerpo}>
          <div className={styles.campos}>
            {campos.map(c => (
              <div className={styles.campo} key={c.etiqueta}>
                <span className={styles.campoEtiqueta}>{c.etiqueta}</span>
                <span className={`${styles.campoValor}${c.mono ? ` ${styles.campoMono}` : ''}`}>
                  {c.valor || '—'}
                </span>
              </div>
            ))}
            <div className={styles.campo}>
              <span className={styles.campoEtiqueta}>Total</span>
              <span className={styles.campoImporte}>{formatImporte(factura.total, factura.moneda)}</span>
            </div>
          </div>

          <div className={styles.seccion}>
            <span className={styles.seccionTitulo}>XML del comprobante</span>
          </div>

          {error ? (
            <p className={styles.aviso}>{error}</p>
          ) : xml === null ? (
            <p className={styles.aviso}>Cargando el XML…</p>
          ) : (
            /* Texto plano: React escapa el contenido y el navegador no
               interpreta nada de lo que venga dentro del archivo. */
            <pre className={styles.crudo}>{xml}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* La descarga pasa por el mismo helper que el resto del sistema para que
   lleve el JWT; un <a href> directo al endpoint iría sin cabecera. */
async function descargar(url, nombre) {
  const { descargarArchivo } = await import('../lib/descargas');
  await descargarArchivo(url.replace('?inline=1', ''), nombre);
}
