import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function IconoPuntos() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

/**
 * Acciones secundarias de una fila.
 *
 * El panel se monta en <body> con posición fija: dentro de la tabla quedaría
 * recortado, porque `.tabla-marco` usa `overflow: clip` para redondear sus
 * esquinas y `overflow-x: auto` en pantallas estrechas.
 *
 * opciones: [{ etiqueta, onClick, Icono, peligro, separadorAntes, desactivado }]
 */
export default function MenuAcciones({ opciones, etiqueta = 'Más acciones', disabled }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const botonRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const ancho = 200;
    setPos({
      top: r.bottom + 4,
      // Si no cabe alineado a la derecha del botón, se pega al borde.
      left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)),
    });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) {
      if (botonRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setAbierto(false);
    }
    function escape(e) { if (e.key === 'Escape') setAbierto(false); }
    const cerrar = () => setAbierto(false);

    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    // El panel va en coordenadas fijas: si la página se mueve bajo él, se cierra.
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [abierto]);

  const visibles = opciones.filter(Boolean);
  if (visibles.length === 0) return null;

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className="btn-icono"
        onClick={() => setAbierto(v => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={etiqueta}
        title="Más acciones"
        disabled={disabled}
      >
        <IconoPuntos />
      </button>

      {abierto && pos && createPortal(
        <div
          ref={panelRef}
          className="menu-acc__panel"
          role="menu"
          style={{ top: pos.top, left: pos.left }}
        >
          {visibles.map((o, i) => (
            <div key={o.etiqueta}>
              {o.separadorAntes && i > 0 && <div className="menu-acc__sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={`menu-acc__item${o.peligro ? ' menu-acc__item--peligro' : ''}`}
                disabled={o.desactivado}
                onClick={() => { setAbierto(false); o.onClick(); }}
              >
                {o.Icono && <o.Icono />} {o.etiqueta}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
