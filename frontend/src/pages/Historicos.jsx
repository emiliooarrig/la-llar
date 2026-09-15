import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import TablaDatos from '../components/TablaDatos';
import BarraFiltros from '../components/BarraFiltros';
import Insignia, { Formato } from '../components/Insignia';
import VisorPDF, { esVisualizable } from '../components/VisorPDF';
import { IconoOjo, IconoDescargar, IconoBasura, IconoArchivar } from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { formatFechaHora, normalizar } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { confirmar, toast, avisoError } from '../lib/alertas';

const FILTROS_BASE = { q: '', origen: 'todos' };

export default function Historicos() {
  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [docVisor, setDocVisor] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const { data } = await api.get('/historicos');
      setDocumentos(data);
    } catch {
      setError('No se pudo cargar el archivo histórico.');
    } finally {
      setCargando(false);
    }
  }

  const conteo = useMemo(() => ({
    unidad: documentos.filter(d => d.origen === 'unidad').length,
    proveedor: documentos.filter(d => d.origen === 'proveedor').length,
  }), [documentos]);

  const filtrados = useMemo(() => {
    const q = normalizar(filtros.q);
    return documentos.filter(d => {
      if (filtros.origen !== 'todos' && d.origen !== filtros.origen) return false;
      if (q && !normalizar(d.nombre_original).includes(q) && !normalizar(d.origen_nombre).includes(q)) return false;
      return true;
    });
  }, [documentos, filtros]);

  /* El histórico es el último lugar donde vive un archivo: borrar aquí lo
     saca del servidor y no hay vuelta atrás. */
  async function eliminar(doc) {
    const ok = await confirmar({
      titulo: '¿Eliminar del archivo histórico?',
      texto: `«${doc.nombre_original}» se borrará del servidor de forma permanente. El histórico es el último respaldo: esta acción no se puede deshacer.`,
      confirmar: 'Eliminar definitivamente',
      destructivo: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/historicos/${doc.id}`);
      setDocumentos(prev => prev.filter(d => d.id !== doc.id));
      toast('Documento eliminado');
    } catch {
      await avisoError('No se pudo eliminar el documento.');
    }
  }

  const columnas = [
    {
      clave: 'nombre_original',
      titulo: 'Archivo',
      orden: d => d.nombre_original,
      clase: 'celda-elastica',
      render: d => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)', minWidth: 0 }}>
          <Formato mime={d.tipo_mime} />
          <span className="texto-cortado" title={d.nombre_original}>{d.nombre_original}</span>
        </span>
      ),
    },
    {
      clave: 'origen',
      titulo: 'Origen',
      orden: d => d.origen,
      render: d => <Insignia tono={d.origen === 'unidad' ? 'naranja' : 'exito'} punto={false}>
        {d.origen === 'unidad' ? 'Unidad' : 'Proveedor'}
      </Insignia>,
    },
    {
      clave: 'origen_nombre',
      titulo: 'Procedencia',
      orden: d => d.origen_nombre,
      render: d => d.origen_nombre,
    },
    {
      clave: 'creado_en',
      titulo: 'Archivado',
      orden: d => d.creado_en,
      clase: 'col-fecha',
      render: d => formatFechaHora(d.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: d => (
        <span className="acciones-fila">
          {esVisualizable(d) && (
            <button
              type="button" className="btn-icono" onClick={() => setDocVisor(d)}
              title="Ver documento" aria-label={`Ver ${d.nombre_original}`}
            >
              <IconoOjo />
            </button>
          )}
          <button
            type="button" className="btn-icono tono-acero"
            onClick={() => descargarArchivo(`/historicos/${d.id}/descargar`, d.nombre_original)}
            title="Descargar" aria-label={`Descargar ${d.nombre_original}`}
          >
            <IconoDescargar />
          </button>
          <button
            type="button" className="btn-icono tono-error" onClick={() => eliminar(d)}
            title="Eliminar del histórico" aria-label={`Eliminar ${d.nombre_original}`}
          >
            <IconoBasura />
          </button>
        </span>
      ),
    },
  ];

  return (
    <Layout
      titulo="Histórico"
      subtitulo="Archivo permanente: documentos retirados de proveedores y unidades."
      migas={[{ etiqueta: 'Histórico' }]}
    >
      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: 'Buscar por archivo o procedencia…',
        }}
        campos={[{
          etiqueta: 'Origen',
          valor: filtros.origen,
          onChange: v => setFiltro('origen', v),
          opciones: [
            { valor: 'todos', texto: `Todos (${documentos.length})` },
            { valor: 'unidad', texto: `Unidades (${conteo.unidad})` },
            { valor: 'proveedor', texto: `Proveedores (${conteo.proveedor})` },
          ],
        }]}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <TablaDatos
        columnas={columnas}
        filas={filtrados}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        etiqueta="documentos"
        totalSinFiltrar={documentos.length}
        claveFiltros={clave}
        ordenInicial={{ clave: 'creado_en', dir: 'desc' }}
        vacio={{
          titulo: hayFiltros ? 'Ningún documento coincide' : 'El archivo histórico está vacío',
          texto: hayFiltros
            ? 'Prueba con otro término o limpia los filtros.'
            : 'Aquí aparecerán los documentos que mandes al histórico desde proveedores y unidades.',
          icono: IconoArchivar,
        }}
      />

      {docVisor && (
        <VisorPDF
          doc={docVisor}
          url={`/historicos/${docVisor.id}/descargar`}
          onCerrar={() => setDocVisor(null)}
        />
      )}
    </Layout>
  );
}
