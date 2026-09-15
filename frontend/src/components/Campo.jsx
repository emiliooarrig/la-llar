import { IconoAlerta } from './Iconos';

/* Campo de formulario con etiqueta, error y pista. La pista desaparece
   cuando hay error: dos líneas de ayuda contradictorias bajo el mismo
   input se leen peor que una. */
export default function Campo({ etiqueta, error, pista, id, opcional, children }) {
  return (
    <div className="campo">
      {etiqueta && (
        <label className="etiqueta" htmlFor={id}>
          {etiqueta}
          {opcional && <span className="etiqueta__opcional"> · opcional</span>}
        </label>
      )}
      {children}
      {error
        ? <span className="error-campo" id={id ? `err-${id}` : undefined}><IconoAlerta tamano={13} />{error}</span>
        : pista && <span className="pista">{pista}</span>}
    </div>
  );
}
