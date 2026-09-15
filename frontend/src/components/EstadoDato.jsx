import { IconoAlerta, IconoCheck, IconoBuscar } from './Iconos';

/* Los tres estados que todo dato necesita. Antes convivían la bandeja de
   pendientes (esqueleto + vacío ilustrado + reintento) y tablas que
   resolvían lo mismo con un `<td>` de texto plano. */
export default function EstadoDato({
  estado,                 // 'cargando' | 'vacio' | 'error'
  titulo,
  texto,
  onReintentar,
  icono,
}) {
  if (estado === 'cargando') {
    return (
      <div className="estado-dato" role="status" aria-live="polite">
        <span className="spinner spinner--lg" style={{ color: 'var(--color-naranja)' }} />
        <span className="estado-dato__texto">{texto || 'Cargando…'}</span>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="estado-dato" role="alert">
        <span className="estado-dato__icono estado-dato__icono--error"><IconoAlerta tamano={20} /></span>
        <div>
          <p className="estado-dato__titulo">{titulo || 'No se pudo cargar'}</p>
          {texto && <p className="estado-dato__texto">{texto}</p>}
        </div>
        {onReintentar && (
          <button type="button" className="btn btn--neutro btn--sm" onClick={onReintentar}>Reintentar</button>
        )}
      </div>
    );
  }

  const Icono = icono || (titulo?.toLowerCase().includes('filtro') ? IconoBuscar : IconoCheck);
  return (
    <div className="estado-dato">
      <span className={`estado-dato__icono${icono ? '' : ' estado-dato__icono--exito'}`}><Icono tamano={20} /></span>
      <div>
        <p className="estado-dato__titulo">{titulo || 'Sin resultados'}</p>
        {texto && <p className="estado-dato__texto">{texto}</p>}
      </div>
    </div>
  );
}
