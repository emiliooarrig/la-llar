import CatalogoDocumentos from '../components/CatalogoDocumentos';
import Campo from '../components/Campo';
import { plural } from '../lib/formato';
import styles from './AdminUnidades.module.css';

// Días de la semana en ISO (1 = lunes … 7 = domingo).
const DIAS = [
  { iso: 1, corta: 'Lun' }, { iso: 2, corta: 'Mar' }, { iso: 3, corta: 'Mié' },
  { iso: 4, corta: 'Jue' }, { iso: 5, corta: 'Vie' }, { iso: 6, corta: 'Sáb' },
  { iso: 7, corta: 'Dom' },
];
const POR_DEFECTO = [1, 2, 3, 4, 5, 6];

// "1,2,3,4,5,6" → [1,2,3,4,5,6]. Sin dato, de lunes a sábado.
function parseDias(str) {
  if (!str) return POR_DEFECTO;
  const dias = String(str).split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 7);
  return dias.length ? dias : POR_DEFECTO;
}

const RECURSO = {
  modulo: 'unidades',
  base: '/unidades',
  listaUrl: '/unidades?incluir_inactivos=1',
  campoDocs: 'documentos_unidad',
  titulo: 'Unidades',
  subtitulo: 'Cocinas y sucursales, con la documentación de cada una.',
  singular: 'unidad',
  Singular: 'Unidad',
  plural: 'unidades',
  genero: 'f',
  determinanteSingular: 'esta unidad',
  textoNuevo: 'Nueva unidad',
  placeholderBusqueda: 'Buscar unidad por nombre…',
  quien: 'Los gerentes',
  rutaDetalle: id => `/admin/unidades/${id}`,
  metaFicha: u => plural(u.empleados_activos ?? 0, 'empleado activo', 'empleados activos'),
};

const FORMULARIO = {
  vacio: { nombre: '', dias: POR_DEFECTO, inicio_semana: 1 },
  desde: u => ({ nombre: u.nombre, dias: parseDias(u.dias_laborales), inicio_semana: u.inicio_semana ?? 1 }),
  aPayload: f => ({ nombre: f.nombre.trim(), dias_laborales: f.dias, inicio_semana: Number(f.inicio_semana) }),
  validar: f => {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (f.dias.length === 0) e.dias = 'Marca al menos un día laboral.';
    return e;
  },
  Campos: ({ form, cambiar, errores, guardando }) => (
    <>
      <Campo etiqueta="Nombre de la unidad" id="u-nombre" error={errores.nombre}>
        <input
          id="u-nombre" className={`control${errores.nombre ? ' control--invalido' : ''}`}
          type="text" placeholder="Ej. Cocina Centro"
          value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
          disabled={guardando} data-foco-inicial
        />
      </Campo>

      <Campo
        etiqueta="Días laborales" error={errores.dias}
        pista="Los días no marcados no cuentan como falta en el calendario de asistencias."
      >
        <div className={styles.dias} role="group" aria-label="Días laborales">
          {DIAS.map(d => {
            const activo = form.dias.includes(d.iso);
            return (
              <button
                key={d.iso} type="button" disabled={guardando}
                className={`${styles.dia} ${activo ? styles.diaActivo : ''}`}
                aria-pressed={activo}
                onClick={() => cambiar('dias',
                  activo ? form.dias.filter(x => x !== d.iso) : [...form.dias, d.iso].sort((a, b) => a - b))}
              >
                {d.corta}
              </button>
            );
          })}
        </div>
      </Campo>

      {/* Cada cocina cierra su semana en un día distinto (spec 005): el
          resumen semanal que firma el empleado se corta aquí. */}
      <Campo
        etiqueta="La semana empieza el" id="u-inicio-semana"
        pista="Define la semana del resumen de asistencia que se imprime para firma."
      >
        <select
          id="u-inicio-semana" className="control"
          value={form.inicio_semana} onChange={e => cambiar('inicio_semana', Number(e.target.value))}
          disabled={guardando}
        >
          {NOMBRES_DIA.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
        </select>
      </Campo>
    </>
  ),
};

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function AdminUnidades() {
  return <CatalogoDocumentos recurso={RECURSO} formulario={FORMULARIO} />;
}
