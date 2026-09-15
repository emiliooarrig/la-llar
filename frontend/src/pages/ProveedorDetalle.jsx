import DetalleDocumentos from '../components/DetalleDocumentos';
import { plural } from '../lib/formato';

const RECURSO = {
  tipo: 'proveedor',
  base: '/proveedores',
  listado: '/admin/proveedores',
  etiquetaListado: 'Proveedores',
  campoDocs: 'documentos_proveedor',
  determinante: 'este proveedor',
  titulo: p => p?.nombre ?? '',
  subtitulo: (p, r) =>
    `RFC ${p.rfc || 'no especificado'} · ${plural(r.total, 'documento')}` +
    (r.pendiente > 0 ? ` · ${r.pendiente} por revisar` : ''),
};

export default function ProveedorDetalle() {
  return <DetalleDocumentos recurso={RECURSO} />;
}
