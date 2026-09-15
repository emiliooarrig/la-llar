import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/* Los filtros viven en la URL, no en el estado del componente. Así el botón
   atrás funciona, recargar no pierde el contexto y el administrador puede
   pasarle a un gerente la vista exacta que está mirando.
   Sólo se escriben los valores distintos del predeterminado: la barra de
   direcciones se queda limpia mientras no filtres nada. */
export function useFiltrosURL(predeterminados) {
  const [params, setParams] = useSearchParams();

  /* setSearchParams calcula el siguiente valor a partir de los params del
     render en curso, no del resultado de la llamada anterior: dos cambios
     seguidos dentro del mismo manejador hacían que el segundo pisara al
     primero (elegir unidad y limpiar empleado a la vez dejaba la unidad
     vacía). Este ref encadena las llamadas hasta que llega el nuevo render. */
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const aplicar = useCallback(mutar => {
    const siguiente = new URLSearchParams(paramsRef.current);
    mutar(siguiente);
    paramsRef.current = siguiente;
    setParams(siguiente, { replace: true });
  }, [setParams]);

  const filtros = useMemo(() => {
    const salida = {};
    for (const [clave, valorBase] of Object.entries(predeterminados)) {
      salida[clave] = params.get(clave) ?? valorBase;
    }
    return salida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, JSON.stringify(predeterminados)]);

  const setFiltro = useCallback((clave, valor) => {
    aplicar(siguiente => {
      if (valor === '' || valor == null || valor === predeterminados[clave]) siguiente.delete(clave);
      else siguiente.set(clave, valor);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicar, JSON.stringify(predeterminados)]);

  /** Varios filtros de una vez. Equivale a encadenar setFiltro, y deja claro
      en el sitio de llamada que los cambios son un solo movimiento. */
  const setFiltros = useCallback(cambios => {
    aplicar(siguiente => {
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === '' || valor == null || valor === predeterminados[clave]) siguiente.delete(clave);
        else siguiente.set(clave, valor);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicar, JSON.stringify(predeterminados)]);

  const limpiar = useCallback(() => {
    aplicar(siguiente => Object.keys(predeterminados).forEach(c => siguiente.delete(c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicar, JSON.stringify(predeterminados)]);

  const hayFiltros = Object.entries(predeterminados).some(([c, base]) => filtros[c] !== base);

  /** Firma estable de los filtros: la paginación vuelve a 1 cuando cambia. */
  const clave = Object.values(filtros).join('|');

  return { filtros, setFiltro, setFiltros, limpiar, hayFiltros, clave };
}
