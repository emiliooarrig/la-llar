import { useEffect, useMemo, useState } from 'react';

/** Los listados empiezan a paginarse a partir de este número de elementos. */
export const ELEMENTOS_POR_PAGINA = 10;

/**
 * Pagina en el navegador una lista ya filtrada.
 *
 * @param elementos     Lista completa a paginar (idealmente memoizada).
 * @param claveFiltros  Firma de los filtros activos. Cuando cambia volvemos a
 *                      la página 1: la página 4 de un listado deja de
 *                      significar lo mismo en cuanto el listado se reduce.
 * @param porPagina     Elementos por página.
 */
export function usePaginacion(elementos, claveFiltros = '', porPagina = ELEMENTOS_POR_PAGINA) {
  const [pagina, setPagina] = useState(1);

  const total        = elementos.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  useEffect(() => { setPagina(1); }, [claveFiltros]);

  // Al eliminar o desactivar elementos la última página puede desaparecer;
  // en ese caso retrocedemos en lugar de dejar la tabla vacía.
  useEffect(() => { setPagina(p => Math.min(p, totalPaginas)); }, [totalPaginas]);

  // El clamp del efecto anterior se aplica hasta el siguiente render, así que
  // acotamos también aquí para no cortar una rebanada fuera de rango.
  const paginaActual = Math.min(pagina, totalPaginas);
  const desde        = (paginaActual - 1) * porPagina;

  const visibles = useMemo(
    () => elementos.slice(desde, desde + porPagina),
    [elementos, desde, porPagina],
  );

  function irA(destino) {
    setPagina(Math.min(Math.max(1, destino), totalPaginas));
  }

  return {
    visibles,
    pagina: paginaActual,
    totalPaginas,
    irA,
    total,
    // Rango 1-based para el pie de tabla ("Mostrando 11–20 de 87").
    primero: total === 0 ? 0 : desde + 1,
    ultimo:  Math.min(desde + porPagina, total),
  };
}
