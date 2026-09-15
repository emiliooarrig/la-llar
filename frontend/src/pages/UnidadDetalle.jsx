import DetalleDocumentos from '../components/DetalleDocumentos';
import { plural } from '../lib/formato';

const RECURSO = {
  tipo: 'unidad',
  base: '/unidades',
  listado: '/admin/unidades',
  etiquetaListado: 'Unidades',
  campoDocs: 'documentos_unidad',
  determinante: 'esta unidad',
  titulo: u => u?.nombre ?? '',
  subtitulo: (u, r) =>
    `Cocina · ${plural(r.total, 'documento')}` +
    (r.pendiente > 0 ? ` · ${r.pendiente} por revisar` : ''),
};

export default function UnidadDetalle() {
  return <DetalleDocumentos recurso={RECURSO} />;
}
