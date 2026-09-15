import { IconoChevron } from './Iconos';

/* Ventana de páginas alrededor de la actual: con 40 páginas no tiene
   sentido pintar 40 botones. */
function paginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, actual, actual - 1, actual + 1]);
  const lista = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const salida = [];
  lista.forEach((n, i) => {
    if (i > 0 && n - lista[i - 1] > 1) salida.push('…');
    salida.push(n);
  });
  return salida;
}

export default function Paginacion({ pagina, totalPaginas, irA }) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="paginacion" aria-label="Paginación">
      <button
        type="button" className="paginacion__btn" onClick={() => irA(pagina - 1)}
        disabled={pagina === 1} aria-label="Página anterior"
      >
        <IconoChevron dir="izquierda" />
      </button>

      {paginasVisibles(pagina, totalPaginas).map((n, i) =>
        n === '…' ? (
          <span key={`h${i}`} className="paginacion__hueco" aria-hidden="true">…</span>
        ) : (
          <button
            key={n}
            type="button"
            className={`paginacion__btn${n === pagina ? ' paginacion__btn--activo' : ''}`}
            onClick={() => irA(n)}
            aria-current={n === pagina ? 'page' : undefined}
            aria-label={`Página ${n}`}
          >
            {n}
          </button>
        )
      )}

      <button
        type="button" className="paginacion__btn" onClick={() => irA(pagina + 1)}
        disabled={pagina === totalPaginas} aria-label="Página siguiente"
      >
        <IconoChevron dir="derecha" />
      </button>
    </nav>
  );
}
