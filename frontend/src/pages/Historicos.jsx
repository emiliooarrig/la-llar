import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import MenuUsuario from '../components/MenuUsuario';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Proveedores.module.css';

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function IconoTipoArchivo({ mime }) {
  const es = t => mime?.includes(t);
  if (es('pdf'))   return <span className={`${styles.iconoBadge} ${styles.iconoPDF}`}>PDF</span>;
  if (es('sheet') || es('excel')) return <span className={`${styles.iconoBadge} ${styles.iconoXLSX}`}>XLS</span>;
  return <span className={`${styles.iconoBadge} ${styles.iconoOther}`}>DOC</span>;
}

function BadgeOrigen({ origen }) {
  return origen === 'unidad'
    ? <span className={styles.badgeOrigenUnidad}>Unidad</span>
    : <span className={styles.badgeOrigenProveedor}>Proveedor</span>;
}

export default function Historicos() {
  const { usuario } = useAuth();

  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando]     = useState(true);

  // Filtros
  const [filtroOrigen, setFiltroOrigen] = useState('todos'); // todos | unidad | proveedor
  const [busqueda, setBusqueda]         = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/historicos');
        setDocumentos(res.data);
      } catch {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el archivo histórico.', confirmButtonColor: '#E8621A' });
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  /* ── Filtrado en el navegador (lista ya cargada) ─────── */
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return documentos.filter(d => {
      if (filtroOrigen !== 'todos' && d.origen !== filtroOrigen) return false;
      if (q && !d.nombre_original.toLowerCase().includes(q) && !d.origen_nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documentos, filtroOrigen, busqueda]);

  const conteoUnidad    = documentos.filter(d => d.origen === 'unidad').length;
  const conteoProveedor = documentos.filter(d => d.origen === 'proveedor').length;

  /* ── Descargar ───────────────────────────────────────── */
  async function handleDescargar(doc) {
    try {
      const res = await api.get(`/historicos/${doc.id}/descargar`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', doc.nombre_original);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el archivo.', confirmButtonColor: '#E8621A' });
    }
  }

  /* ── Eliminar ────────────────────────────────────────── */
  async function handleEliminar(doc) {
    const r = await Swal.fire({
      title: '¿Eliminar documento?',
      html: `Se eliminará <b>${doc.nombre_original}</b> del archivo histórico y del servidor.<br/>Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93025',
      cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    try {
      await api.delete(`/historicos/${doc.id}`);
      setDocumentos(prev => prev.filter(d => d.id !== doc.id));
      Swal.fire({ icon: 'success', title: 'Eliminado', text: 'El documento se eliminó correctamente.', timer: 1600, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar el documento.', confirmButtonColor: '#E8621A' });
    }
  }

  return (
    <div className={styles.pagina}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.marca}>
          <LogoInicio className={styles.logoSmall} />
          <span className={styles.appNombre}>Sistema de Gestión</span>
        </div>
        <div className={styles.usuario}>
          <div className={styles.infoUsuario}>
            <span className={styles.nombreUsuario}>{usuario?.nombre}</span>
            <span className={styles.rolBadge}>{ETIQUETA_ROL[usuario?.rol]}</span>
          </div>
          <MenuUsuario />
        </div>
      </header>

      <main className={styles.contenido}>
        <div className={styles.paginaHeader}>
          <div>
            <h1 className={styles.tituloPagina}>Documentación Histórica</h1>
            <p className={styles.subtituloPagina}>
              Archivo permanente de documentos enviados desde Proveedores y Unidades
            </p>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className={styles.filtroBarra}>
          <div className={styles.buscador}>
            <span className={styles.buscadorIcono}><IconoLupa /></span>
            <input
              type="text"
              className={styles.inputBuscar}
              placeholder="Buscar por nombre de archivo o del origen…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          <div className={styles.filtros}>
            <div className={styles.filtroGrupo}>
              <span className={styles.filtroLabel}>Origen</span>
              <div className={styles.segmento}>
                <button
                  className={`${styles.segmentoBtn} ${filtroOrigen === 'todos' ? styles.segmentoBtnActivo : ''}`}
                  onClick={() => setFiltroOrigen('todos')}
                >
                  Todos<span className={styles.segmentoConteo}>{documentos.length}</span>
                </button>
                <button
                  className={`${styles.segmentoBtn} ${filtroOrigen === 'unidad' ? styles.segmentoBtnActivo : ''}`}
                  onClick={() => setFiltroOrigen('unidad')}
                >
                  Unidades<span className={styles.segmentoConteo}>{conteoUnidad}</span>
                </button>
                <button
                  className={`${styles.segmentoBtn} ${filtroOrigen === 'proveedor' ? styles.segmentoBtnActivo : ''}`}
                  onClick={() => setFiltroOrigen('proveedor')}
                >
                  Proveedores<span className={styles.segmentoConteo}>{conteoProveedor}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Origen</th>
                <th>Subido el</th>
                <th>Aprobado por</th>
                <th>Enviado al histórico</th>
                <th className={styles.thAcciones}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="6" className={styles.estadoTabla}>
                    <div className={styles.cargandoSpinner} />
                    Cargando archivo histórico...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className={styles.estadoTabla}>
                    {documentos.length === 0
                      ? 'Aún no hay documentos en el archivo histórico.'
                      : 'Ningún documento coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div className={styles.iconoArchivo}>
                        <IconoTipoArchivo mime={doc.tipo_mime} />
                        <span className={styles.nombreArchivo} title={doc.nombre_original}>
                          {doc.nombre_original}
                        </span>
                      </div>
                    </td>
                    <td>
                      <BadgeOrigen origen={doc.origen} />{' '}
                      <span title={`Subido por: ${doc.subido_por_nombre ?? '—'}`}>{doc.origen_nombre}</span>
                    </td>
                    <td className={styles.colFecha} title={`Subido por: ${doc.subido_por_nombre ?? '—'}`}>
                      {formatFecha(doc.subido_en)}
                    </td>
                    <td>{doc.aprobado_por_nombre ?? '—'}</td>
                    <td className={styles.colFecha}>{formatFechaHora(doc.enviado_en)}</td>
                    <td className={styles.colAcciones}>
                      <div className={styles.acciones}>
                        <button
                          className={styles.btnDescargar}
                          onClick={() => handleDescargar(doc)}
                          title="Descargar"
                        >
                          <IconoDescarga />
                        </button>
                        <button
                          className={styles.btnEliminar}
                          onClick={() => handleEliminar(doc)}
                          title="Eliminar"
                        >
                          <IconoBasura />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!cargando && filtrados.length > 0 && (
            <p className={styles.pieTabla}>
              {filtrados.length} de {documentos.length} documento{documentos.length !== 1 ? 's' : ''} ·{' '}
              {conteoUnidad} de unidades · {conteoProveedor} de proveedores
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ── Iconos ─────────────────────────────────────────────── */
function IconoLupa() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function IconoDescarga() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
    </svg>
  );
}
function IconoBasura() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}
