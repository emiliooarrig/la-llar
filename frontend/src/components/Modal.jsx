import { useEffect, useId, useRef } from 'react';
import { IconoCerrar } from './Iconos';

const FOCUSABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* Diálogo accesible: el foco entra, se queda dentro y vuelve a su sitio al
   cerrar. Antes cada página montaba su propio overlay y sólo el visor de
   PDF declaraba `aria-modal`; con Tab se salía del diálogo a la página de
   detrás sin que nada lo indicara. */
export default function Modal({
  abierto = true,
  onCerrar,
  titulo,
  subtitulo,
  ancho = false,
  children,
  pie,
  bloqueado = false,   // impide cerrar mientras se guarda
}) {
  const cajaRef = useRef(null);
  const previoRef = useRef(null);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    previoRef.current = document.activeElement;

    const caja = cajaRef.current;
    const primero = caja?.querySelector('[data-foco-inicial]') || caja?.querySelector(FOCUSABLES);
    primero?.focus();

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape' && !bloqueado) {
        e.stopPropagation();
        onCerrar?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = [...(caja?.querySelectorAll(FOCUSABLES) || [])]
        .filter(el => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const inicio = focusables[0];
      const fin = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === inicio) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault();
        inicio.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflowPrevio;
      previoRef.current?.focus?.();
    };
  }, [abierto, bloqueado, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="overlay"
      onMouseDown={e => { if (e.target === e.currentTarget && !bloqueado) onCerrar?.(); }}
    >
      <div
        ref={cajaRef}
        className={`modal${ancho ? ' modal--ancho' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__titulo" id={tituloId}>{titulo}</h2>
            {subtitulo && <p className="modal__sub">{subtitulo}</p>}
          </div>
          <button
            type="button" className="modal__cerrar" onClick={onCerrar}
            disabled={bloqueado} aria-label="Cerrar"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="modal__cuerpo">{children}</div>

        {pie && <div className="modal__pie">{pie}</div>}
      </div>
    </div>
  );
}
