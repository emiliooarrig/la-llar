import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import Layout from './Layout';
import TablaDatos from './TablaDatos';
import BarraFiltros from './BarraFiltros';
import MenuAcciones from './MenuAcciones';
import Insignia, { Formato } from './Insignia';
import VisorPDF, { esVisualizable } from './VisorPDF';
import {
  IconoSubir, IconoDescargar, IconoOjo, IconoCheck, IconoCerrar,
  IconoArchivar, IconoBasura, IconoAlerta,
} from './Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { formatFecha, normalizar } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { confirmar, toast, avisoError } from '../lib/alertas';
import { invalidarPendientes } from '../hooks/usePendientes';
import styles from './DetalleDocumentos.module.css';

/* El backend valida extensión Y contenido real (middleware/upload.js);
   esto sólo evita el viaje al servidor cuando el archivo ya se ve mal. */
const EXTENSIONES = ['.pdf', '.xlsx', '.docx'];
const extensionValida = nombre => EXTENSIONES.some(ext => nombre.toLowerCase().endsWith(ext));

const FILTROS_BASE = { q: '', estado: 'todos' };

/* Proveedor y unidad son la misma pantalla con distinto sustantivo: antes
   eran dos archivos de 472 líneas que diferían en dieciocho. */
export default function DetalleDocumentos({ recurso }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [entidad, setEntidad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [ocupado, setOcupado] = useState(null);   // id del documento en proceso
  const [docVisor, setDocVisor] = useState(null);

  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get(`${recurso.base}/${id}`);
      setEntidad(data);
    } catch (e) {
      await avisoError(e.response?.data?.error ?? `No se pudo cargar ${recurso.determinante}.`);
      navigate(recurso.listado);
    } finally {
      setCargando(false);
    }
  }

  const docs = entidad?.[recurso.campoDocs] ?? [];

  const resumen = useMemo(() => ({
    total: docs.length,
    pendiente: docs.filter(d => d.estado === 'pendiente').length,
    aprobado: docs.filter(d => d.estado === 'aprobado').length,
    desaprobado: docs.filter(d => d.estado === 'desaprobado').length,
  }), [docs]);

  const filtrados = useMemo(() => {
    const q = normalizar(filtros.q);
    return docs.filter(d => {
      const texto = !q || normalizar(d.nombre_original).includes(q);
      const estado = filtros.estado === 'todos' || d.estado === filtros.estado;
      return texto && estado;
    });
  }, [docs, filtros]);

  function actualizarDocs(fn) {
    setEntidad(prev => ({ ...prev, [recurso.campoDocs]: fn(prev[recurso.campoDocs] ?? []) }));
  }

  /* ── Subir ──────────────────────────────────────────────── */
  async function subir(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!extensionValida(file.name)) {
      await avisoError('Sólo se aceptan archivos PDF, Excel (.xlsx) y Word (.docx).', 'Formato no permitido');
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const { data } = await api.post(`${recurso.base}/${id}/documentos`, formData, {
        headers: { 'Content-Type': undefined },
      });
      actualizarDocs(prev => [data, ...prev]);
      invalidarPendientes();
      toast('Documento subido');
    } catch (err) {
      await avisoError(err.response?.data?.error ?? 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }

  /* Cambiar el estado es reversible desde esta misma tabla: no se confirma. */
  async function cambiarEstado(doc, estado) {
    setOcupado(doc.id);
    try {
      const { data } = await api.patch(`${recurso.base}/documentos/${doc.id}/estado`, { estado });
      actualizarDocs(prev => prev.map(d => (d.id === data.id ? { ...d, estado: data.estado } : d)));
      invalidarPendientes();
      toast(estado === 'aprobado' ? 'Documento aprobado'
        : estado === 'desaprobado' ? 'Documento rechazado'
        : 'Documento devuelto a revisión');
    } catch {
      await avisoError('No se pudo actualizar el estado del documento.');
    } finally {
      setOcupado(null);
    }
  }

  /* Archivar y eliminar sacan el documento de aquí: ambas se confirman. */
  async function archivar(doc) {
    const ok = await confirmar({
      titulo: '¿Mandar al histórico?',
      texto: `«${doc.nombre_original}» saldrá de ${recurso.determinante} y quedará en el archivo permanente del sistema.`,
      confirmar: 'Mandar al histórico',
    });
    if (!ok) return;

    setOcupado(doc.id);
    try {
      await api.post('/historicos', { tipo: recurso.tipo, doc_id: doc.id });
      actualizarDocs(prev => prev.filter(d => d.id !== doc.id));
      invalidarPendientes();
      toast('Enviado al histórico');
    } catch (e) {
      await avisoError(e.response?.data?.error ?? 'No se pudo mandar el documento al histórico.');
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar(doc) {
    const ok = await confirmar({
      titulo: '¿Eliminar el documento?',
      texto: `«${doc.nombre_original}» se borrará del servidor de forma permanente. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;

    setOcupado(doc.id);
    try {
      await api.delete(`${recurso.base}/documentos/${doc.id}`);
      actualizarDocs(prev => prev.filter(d => d.id !== doc.id));
      invalidarPendientes();
      toast('Documento eliminado');
    } catch {
      await avisoError('No se pudo eliminar el documento.');
    } finally {
      setOcupado(null);
    }
  }

  const columnas = [
    {
      clave: 'nombre_original',
      titulo: 'Archivo',
      orden: d => d.nombre_original,
      clase: 'celda-elastica',
      render: d => (
        <span className={styles.archivo}>
          <Formato mime={d.tipo_mime} />
          <span className="texto-cortado" title={d.nombre_original}>{d.nombre_original}</span>
        </span>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      orden: d => d.estado,
      render: d => <Insignia estado={d.estado} />,
    },
    {
      clave: 'creado_en',
      titulo: 'Subido',
      orden: d => d.creado_en,
      clase: 'col-fecha',
      render: d => formatFecha(d.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: d => {
        const bloqueado = ocupado === d.id;
        const rutaDescarga = `${recurso.base}/documentos/${d.id}/descargar`;
        return (
          <span className="acciones-fila">
            {esVisualizable(d) && (
              <button
                type="button" className="btn-icono" onClick={() => setDocVisor(d)}
                title="Ver documento" aria-label={`Ver ${d.nombre_original}`} disabled={bloqueado}
              >
                <IconoOjo />
              </button>
            )}
            <button
              type="button" className="btn-icono tono-acero"
              onClick={() => descargarArchivo(rutaDescarga, d.nombre_original)}
              title="Descargar" aria-label={`Descargar ${d.nombre_original}`} disabled={bloqueado}
            >
              <IconoDescargar />
            </button>
            {d.estado !== 'aprobado' && (
              <button
                type="button" className="btn-icono tono-exito"
                onClick={() => cambiarEstado(d, 'aprobado')}
                title="Aprobar" aria-label={`Aprobar ${d.nombre_original}`} disabled={bloqueado}
              >
                <IconoCheck />
              </button>
            )}
            {d.estado !== 'desaprobado' && (
              <button
                type="button" className="btn-icono tono-error"
                onClick={() => cambiarEstado(d, 'desaprobado')}
                title="Rechazar" aria-label={`Rechazar ${d.nombre_original}`} disabled={bloqueado}
              >
                <IconoCerrar />
              </button>
            )}
            <MenuAcciones
              disabled={bloqueado}
              etiqueta={`Más acciones para ${d.nombre_original}`}
              opciones={[
                d.estado !== 'pendiente' && {
                  etiqueta: 'Devolver a revisión',
                  Icono: IconoAlerta,
                  onClick: () => cambiarEstado(d, 'pendiente'),
                },
                {
                  etiqueta: 'Mandar al histórico',
                  Icono: IconoArchivar,
                  onClick: () => archivar(d),
                  separadorAntes: true,
                },
                {
                  etiqueta: 'Eliminar documento',
                  Icono: IconoBasura,
                  onClick: () => eliminar(d),
                  peligro: true,
                },
              ]}
            />
          </span>
        );
      },
    },
  ];

  return (
    <Layout
      titulo={cargando ? '…' : recurso.titulo(entidad)}
      subtitulo={entidad ? recurso.subtitulo(entidad, resumen) : undefined}
      migas={[
        { etiqueta: recurso.etiquetaListado, to: recurso.listado },
        { etiqueta: cargando ? '…' : recurso.titulo(entidad) },
      ]}
      acciones={
        <>
          <input
            ref={inputRef} type="file" accept=".pdf,.xlsx,.docx"
            style={{ display: 'none' }} onChange={subir}
          />
          <button
            type="button" className="btn btn--primario"
            onClick={() => inputRef.current?.click()} disabled={subiendo || cargando}
          >
            {subiendo ? <><span className="spinner" /> Subiendo…</> : <><IconoSubir /> Subir documento</>}
          </button>
        </>
      }
    >
      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: 'Buscar por nombre de archivo…',
        }}
        campos={[{
          etiqueta: 'Estado',
          valor: filtros.estado,
          onChange: v => setFiltro('estado', v),
          opciones: [
            { valor: 'todos', texto: `Todos (${resumen.total})` },
            { valor: 'pendiente', texto: `Pendientes (${resumen.pendiente})` },
            { valor: 'aprobado', texto: `Aprobados (${resumen.aprobado})` },
            { valor: 'desaprobado', texto: `Rechazados (${resumen.desaprobado})` },
          ],
        }]}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <TablaDatos
        columnas={columnas}
        filas={filtrados}
        cargando={cargando}
        onReintentar={cargar}
        etiqueta="documentos"
        totalSinFiltrar={docs.length}
        claveFiltros={clave}
        ordenInicial={{ clave: 'creado_en', dir: 'desc' }}
        vacio={{
          titulo: hayFiltros ? 'Ningún documento coincide' : 'Todavía no hay documentos',
          texto: hayFiltros
            ? 'Prueba con otro término o limpia los filtros.'
            : `Sube el primer archivo de ${recurso.determinante} con «Subir documento».`,
        }}
      />

      {docVisor && (
        <VisorPDF
          doc={docVisor}
          url={`${recurso.base}/documentos/${docVisor.id}/descargar`}
          onCerrar={() => setDocVisor(null)}
        />
      )}
    </Layout>
  );
}
