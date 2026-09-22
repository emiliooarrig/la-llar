import { Link } from 'react-router-dom';
import DetalleDocumentos from '../components/DetalleDocumentos';
import { IconoFactura } from '../components/Iconos';
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
  /* La facturación de un proveedor es otra pantalla, no otra pestaña: tiene
     sus propios filtros, sus propias acciones y su propio bloqueo. Desde
     aquí solo se entra. */
  accionesExtra: proveedor => proveedor && (
    <Link to={`/admin/proveedores/${proveedor.id}/facturas`} className="btn btn--neutro">
      <IconoFactura /> Facturas
    </Link>
  ),
};

export default function ProveedorDetalle() {
  return <DetalleDocumentos recurso={RECURSO} />;
}
