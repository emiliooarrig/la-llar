import PanelMisDocumentos from '../components/PanelMisDocumentos';

const RECURSO = {
  base: '/unidades',
  modulo: 'unidades',
  campoDocs: 'documentos_unidad',
  titulo: 'Documentos de mi unidad',
  subtitulo: u => u.nombre,
};

export default function MisUnidades() {
  return <PanelMisDocumentos recurso={RECURSO} />;
}
