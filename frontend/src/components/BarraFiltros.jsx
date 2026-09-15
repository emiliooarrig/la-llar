import { IconoBuscar } from './Iconos';

/* Cada módulo inventaba su propia barra: chips en la bandeja, dos selects
   con etiqueta en asistencias, buscador suelto en usuarios, nada en las
   tablas de documentos. Esta es la forma única. */
export default function BarraFiltros({ busqueda, campos = [], conteo, onLimpiar, extra }) {
  return (
    <div className="barra-filtros no-imprimir">
      {busqueda && (
        <div className="buscador">
          <span className="buscador__icono"><IconoBuscar /></span>
          <input
            type="search"
            className="control"
            placeholder={busqueda.placeholder || 'Buscar…'}
            value={busqueda.valor}
            onChange={e => busqueda.onChange(e.target.value)}
            aria-label={busqueda.placeholder || 'Buscar'}
          />
        </div>
      )}

      {campos.map(campo => (
        <div className="barra-filtros__campo" key={campo.etiqueta}>
          <label className="barra-filtros__etiqueta" htmlFor={`filtro-${campo.etiqueta}`}>
            {campo.etiqueta}
          </label>
          <select
            id={`filtro-${campo.etiqueta}`}
            className="control"
            value={campo.valor}
            onChange={e => campo.onChange(e.target.value)}
            disabled={campo.desactivado}
          >
            {campo.opciones.map(o => (
              <option key={o.valor} value={o.valor}>{o.texto}</option>
            ))}
          </select>
        </div>
      ))}

      {extra}

      {(conteo || onLimpiar) && (
        <div className="barra-filtros__cola">
          {conteo && <span className="barra-filtros__conteo">{conteo}</span>}
          {onLimpiar && (
            <button type="button" className="btn btn--fantasma btn--sm" onClick={onLimpiar}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
