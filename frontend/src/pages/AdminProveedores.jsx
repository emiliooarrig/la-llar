import CatalogoDocumentos from '../components/CatalogoDocumentos';
import Campo from '../components/Campo';

const RECURSO = {
  modulo: 'proveedores',
  base: '/proveedores',
  listaUrl: '/proveedores?incluir_inactivos=1',
  campoDocs: 'documentos_proveedor',
  titulo: 'Proveedores',
  subtitulo: 'Catálogo de proveedores y su documentación en el sistema.',
  singular: 'proveedor',
  Singular: 'Proveedor',
  plural: 'proveedores',
  genero: 'm',
  determinanteSingular: 'este proveedor',
  textoNuevo: 'Nuevo proveedor',
  placeholderBusqueda: 'Buscar por nombre o RFC…',
  quien: 'Los proveedores',
  rutaDetalle: id => `/admin/proveedores/${id}`,
  metaFicha: p => (p.rfc ? `RFC ${p.rfc}` : 'Sin RFC registrado'),
};

/* El RFC mexicano son 12 caracteres (persona moral) o 13 (persona física). */
const FORMULARIO = {
  vacio: { nombre: '', rfc: '' },
  desde: p => ({ nombre: p.nombre, rfc: p.rfc ?? '' }),
  aPayload: f => ({ nombre: f.nombre.trim(), rfc: f.rfc.trim().toUpperCase() || null }),
  validar: f => {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    const rfc = f.rfc.trim();
    if (rfc && (rfc.length < 12 || rfc.length > 13)) e.rfc = 'Un RFC tiene 12 (moral) o 13 (física) caracteres.';
    return e;
  },
  Campos: ({ form, cambiar, errores, guardando }) => (
    <>
      <Campo etiqueta="Nombre o razón social" id="p-nombre" error={errores.nombre}>
        <input
          id="p-nombre" className={`control${errores.nombre ? ' control--invalido' : ''}`}
          type="text" placeholder="Ej. Distribuidora del Norte S.A. de C.V."
          value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
          disabled={guardando} data-foco-inicial
        />
      </Campo>
      <Campo
        etiqueta="RFC" id="p-rfc" error={errores.rfc} opcional
        pista="Puedes registrarlo después; no bloquea la carga de documentos."
      >
        <input
          id="p-rfc" className={`control mono${errores.rfc ? ' control--invalido' : ''}`}
          type="text" maxLength={13} placeholder="XAXX010101000"
          value={form.rfc} onChange={e => cambiar('rfc', e.target.value.toUpperCase())}
          disabled={guardando}
        />
      </Campo>
    </>
  ),
};

export default function AdminProveedores() {
  return <CatalogoDocumentos recurso={RECURSO} formulario={FORMULARIO} />;
}
