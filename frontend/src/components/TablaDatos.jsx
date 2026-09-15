import { useMemo, useState } from 'react';
import { usePaginacion } from '../hooks/usePaginacion';
import { IconoOrden } from './Iconos';
import EstadoDato from './EstadoDato';
import Paginacion from './Paginacion';

/* Una sola tabla para todo el sistema. `.tabla` llegó a estar redefinida
   24 veces en 8 archivos, cada copia con su propia densidad, su propio
   hover y su propio criterio sobre qué es un estado vacío.
 *
 * columnas: [{
 *   clave, titulo,
 *   render(fila) -> ReactNode,
 *   orden(fila)  -> valor comparable (si falta, la columna no se ordena),
 *   clase, thClase, ancho
 * }]
 */
export default function TablaDatos({
  columnas,
  filas,
  clave = f => f.id,
  claseFila,
  cargando,
  error,
  onReintentar,
  vacio = {},
  etiqueta = 'registros',
  totalSinFiltrar,
  ordenInicial,
  porPagina = 10,
  claveFiltros = '',
  pie,
}) {
  const [orden, setOrden] = useState(ordenInicial || null);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find(c => c.clave === orden.clave);
    if (!col?.orden) return filas;
    const signo = orden.dir === 'desc' ? -1 : 1;
    return [...filas].sort((a, b) => {
      const va = col.orden(a);
      const vb = col.orden(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;          // los huecos caen al final en ambos sentidos
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') {
        return signo * va.localeCompare(vb, 'es', { sensitivity: 'base' });
      }
      return signo * (va > vb ? 1 : va < vb ? -1 : 0);
    });
  }, [filas, orden, columnas]);

  const pag = usePaginacion(ordenadas, `${claveFiltros}|${orden?.clave}|${orden?.dir}`, porPagina);

  function alternarOrden(col) {
    setOrden(prev =>
      prev?.clave === col.clave
        ? { clave: col.clave, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { clave: col.clave, dir: 'asc' }
    );
  }

  const estado = cargando ? 'cargando' : error ? 'error' : ordenadas.length === 0 ? 'vacio' : null;

  return (
    <div className="tabla-marco">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map(col => {
              const activa = orden?.clave === col.clave;
              const dirAria = activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none';
              return (
                <th
                  key={col.clave}
                  className={col.thClase}
                  style={col.ancho ? { width: col.ancho } : undefined}
                  aria-sort={col.orden ? dirAria : undefined}
                  scope="col"
                >
                  {col.orden ? (
                    <button
                      type="button"
                      className="tabla__orden"
                      onClick={() => alternarOrden(col)}
                      data-orden={activa ? orden.dir : 'ninguno'}
                      title={`Ordenar por ${col.titulo}`}
                    >
                      {col.titulo}
                      <span className="tabla__orden-flecha">
                        <IconoOrden dir={activa ? orden.dir : null} tamano={11} />
                      </span>
                    </button>
                  ) : col.titulo}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {estado ? (
            <tr>
              <td colSpan={columnas.length} className="estado-dato-celda">
                <EstadoDato
                  estado={estado}
                  titulo={estado === 'vacio' ? vacio.titulo : undefined}
                  texto={estado === 'vacio' ? vacio.texto : estado === 'cargando' ? `Cargando ${etiqueta}…` : error}
                  icono={estado === 'vacio' ? vacio.icono : undefined}
                  onReintentar={onReintentar}
                />
              </td>
            </tr>
          ) : (
            pag.visibles.map(fila => (
              <tr key={clave(fila)} className={claseFila?.(fila) || undefined}>
                {columnas.map(col => (
                  <td key={col.clave} className={col.clase}>
                    {col.render ? col.render(fila) : fila[col.clave]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {!estado && (
        <div className="tabla__pie">
          <span className="tabla__conteo">
            {pag.total === totalSinFiltrar || totalSinFiltrar == null
              ? `${pag.primero}–${pag.ultimo} de ${pag.total} ${etiqueta}`
              : `${pag.primero}–${pag.ultimo} de ${pag.total} ${etiqueta} (${totalSinFiltrar} en total)`}
          </span>
          {pie}
          <Paginacion pagina={pag.pagina} totalPaginas={pag.totalPaginas} irA={pag.irA} />
        </div>
      )}
    </div>
  );
}
