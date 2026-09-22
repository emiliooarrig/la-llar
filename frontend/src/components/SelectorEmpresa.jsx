import { useEffect, useState } from 'react';
import { cargarEmpresas } from '../lib/empresas';

/* Selector de empresa: el mismo control para filtrar un listado y para
   elegir la empresa de un alta.
 *
 * Los dos usos se parecen tanto que tenerlos separados garantizaba que se
 * desincronizaran (uno ordenando por nombre y el otro por id, uno con
 * "Todas" y el otro con "Seleccionar…"). Lo que cambia entre ambos es una
 * opción de cabecera, así que es un solo componente con `incluirTodas`.
 *
 *   Filtro:      <SelectorEmpresa incluirTodas valor={f.empresa} onChange={…} />
 *   Formulario:  <SelectorEmpresa valor={form.empresa_id} onChange={…} requerido />
 *
 * Cuando el usuario NO puede elegir empresa —un gerente, cuya empresa sale
 * de su unidad— este componente no se pinta: se muestra la empresa fija. La
 * constitución es explícita en que el alcance no se decide en el navegador,
 * así que un selector deshabilitado con el valor "correcto" ya puesto sería
 * una invitación a confiar en lo que mande el cliente.
 */
export default function SelectorEmpresa({
  valor,
  onChange,
  incluirTodas = false,
  incluirInactivos = false,
  id = 'selector-empresa',
  className = 'control',
  disabled = false,
  requerido = false,
  etiquetaTodas = 'Todas las empresas',
  placeholder = 'Seleccionar empresa…',
  autoSeleccionarUnica = false,
  onCargar,
}) {
  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);

    cargarEmpresas({ incluirInactivos })
      .then(datos => {
        if (!vivo) return;
        setEmpresas(datos);
        onCargar?.(datos);

        /* Con una sola empresa en el catálogo, obligar a elegirla es papeleo:
           se selecciona sola. Solo aplica a formularios (no a filtros), donde
           el valor vacío significa "Todas" y sí es una elección legítima. */
        if (autoSeleccionarUnica && !incluirTodas && !valor && datos.length === 1) {
          onChange?.(String(datos[0].id));
        }
      })
      .catch(() => { if (vivo) setError(true); })
      .finally(() => { if (vivo) setCargando(false); });

    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirInactivos]);

  /* Una empresa dada de baja que ya estaba elegida en un registro antiguo
     tiene que seguir apareciendo, o al abrir ese registro el selector se
     mostraría vacío y guardar lo cambiaría en silencio. */
  const seleccionadaFuera =
    valor && !empresas.some(e => String(e.id) === String(valor));

  return (
    <select
      id={id}
      className={className}
      value={valor ?? ''}
      onChange={e => onChange?.(e.target.value)}
      disabled={disabled || cargando || error}
      required={requerido}
      aria-label={incluirTodas ? 'Filtrar por empresa' : 'Empresa'}
      aria-busy={cargando || undefined}
    >
      {cargando ? (
        <option value="">Cargando empresas…</option>
      ) : error ? (
        <option value="">No se pudieron cargar las empresas</option>
      ) : (
        <>
          {incluirTodas
            ? <option value="">{etiquetaTodas}</option>
            : <option value="">{placeholder}</option>}

          {seleccionadaFuera && (
            <option value={valor}>Empresa no disponible</option>
          )}

          {empresas.map(empresa => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}{empresa.activo === false ? ' (inactiva)' : ''}
            </option>
          ))}
        </>
      )}
    </select>
  );
}
