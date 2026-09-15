import PanelMisDocumentos from '../components/PanelMisDocumentos';

const RECURSO = {
  base: '/proveedores',
  modulo: 'proveedores',
  campoDocs: 'documentos_proveedor',
  titulo: 'Mis documentos',
  subtitulo: p => `${p.nombre}${p.rfc ? ` · RFC ${p.rfc}` : ''}`,
};

export default function MisDocumentos() {
  return <PanelMisDocumentos recurso={RECURSO} />;
}
