import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import MenuUsuario from '../components/MenuUsuario';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Pendientes.module.css';

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

/* Cada tipo de origen mapea a su color de identidad y su endpoint. */
const TIPO_META = {
  proveedor: {
    etiqueta: 'Proveedor',
    base: '/proveedores/documentos',
    clsBadge: styles.badgeProveedor,
    clsTono: styles.tonoOliva,
    Icono: IconoProveedor,
  },
  unidad: {
    etiqueta: 'Unidad',
    base: '/unidades/documentos',
    clsBadge: styles.badgeUnidad,
    clsTono: styles.tonoNaranja,
    Icono: IconoUnidad,
  },
};

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diasEspera(iso) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function Pendientes() {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [datos, setDatos]       = useState({ total: 0, proveedores: 0, unidades: 0, documentos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState(false);
  const [procesando, setProcesando] = useState(null); // key del doc en proceso

  // Filtro por tipo desde el query param (lo manda el tablero del dashboard).
  const filtroTipo = searchParams.get('tipo'); // 'proveedor' | 'unidad' | null

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(false);
    try {
      const res = await api.get('/pendientes');
      setDatos(res.data);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  const documentos = useMemo(() => {
    if (!filtroTipo) return datos.documentos;
    return datos.documentos.filter(d => d.tipo === filtroTipo);
  }, [datos.documentos, filtroTipo]);

  function cambiarFiltro(tipo) {
    if (!tipo) { searchParams.delete('tipo'); }
    else { searchParams.set('tipo', tipo); }
    setSearchParams(searchParams, { replace: true });
  }

  /* ── Aprobar / Rechazar (reutiliza los PATCH de cada módulo) ── */
  async function handleResolver(doc, estado) {
    const cfg = estado === 'aprobado'
      ? { titulo: '¿Aprobar documento?', texto: `"${doc.nombre_original}" quedará aprobado.`, color: '#2E7D32', ok: 'Sí, aprobar' }
      : { titulo: '¿Rechazar documento?', texto: `"${doc.nombre_original}" quedará desaprobado.`, color: '#D93025', ok: 'Sí, rechazar' };

    const result = await Swal.fire({
      title: cfg.titulo, text: cfg.texto, icon: 'question',
      showCancelButton: true, confirmButtonColor: cfg.color, cancelButtonColor: '#9E9892',
      confirmButtonText: cfg.ok, cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    const meta = TIPO_META[doc.tipo];
    setProcesando(doc.key);
    try {
      await api.patch(`${meta.base}/${doc.doc_id}/estado`, { estado });
      // Actualización optimista: la fila desaparece de la bandeja.
      setDatos(prev => ({
        ...prev,
        total: prev.total - 1,
        proveedores: prev.proveedores - (doc.tipo === 'proveedor' ? 1 : 0),
        unidades: prev.unidades - (doc.tipo === 'unidad' ? 1 : 0),
        documentos: prev.documentos.filter(d => d.key !== doc.key),
      }));
      Swal.fire({
        icon: 'success',
        title: estado === 'aprobado' ? 'Documento aprobado' : 'Documento rechazado',
        timer: 1200, showConfirmButton: false, timerProgressBar: true,
      });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el documento.', confirmButtonColor: '#E8621A' });
    } finally {
      setProcesando(null);
    }
  }

  /* ── Descargar para revisar antes de decidir ── */
  async function handleDescargar(doc) {
    const meta = TIPO_META[doc.tipo];
    try {
      const res = await api.get(`${meta.base}/${doc.doc_id}/descargar`, { responseType: 'blob' });
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

  const hayPendientes = datos.total > 0;

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
        {/* Encabezado de página */}
        <div className={styles.paginaHeader}>
          <div>
            <h1 className={styles.tituloPagina}>Por revisar</h1>
            <p className={styles.subtituloPagina}>
              Documentos de proveedores y unidades esperando tu aprobación.
            </p>
          </div>
        </div>

        {/* Lámpara de calor: resumen con barra de filtros integrada */}
        <div className={`${styles.banda} ${hayPendientes ? styles.bandaAlerta : styles.bandaCalma}`}>
          <div className={styles.bandaCifra}>
            <span className={styles.bandaNumero}>{cargando ? '—' : datos.total}</span>
            <span className={styles.bandaTexto}>
              {hayPendientes
                ? `documento${datos.total === 1 ? '' : 's'} en cola`
                : 'todo al día'}
            </span>
          </div>
          <div className={styles.filtros}>
            <button
              className={`${styles.chipFiltro} ${!filtroTipo ? styles.chipActivo : ''}`}
              onClick={() => cambiarFiltro(null)}
            >
              Todos <span className={styles.chipConteo}>{datos.total}</span>
            </button>
            <button
              className={`${styles.chipFiltro} ${filtroTipo === 'proveedor' ? styles.chipActivo : ''}`}
              onClick={() => cambiarFiltro('proveedor')}
            >
              Proveedores <span className={styles.chipConteo}>{datos.proveedores}</span>
            </button>
            <button
              className={`${styles.chipFiltro} ${filtroTipo === 'unidad' ? styles.chipActivo : ''}`}
              onClick={() => cambiarFiltro('unidad')}
            >
              Unidades <span className={styles.chipConteo}>{datos.unidades}</span>
            </button>
          </div>
        </div>

        {/* Cola de comandas */}
        {error ? (
          <div className={styles.errorBox}>
            <span>No se pudo cargar la bandeja de pendientes.</span>
            <button className={styles.btnReintentar} onClick={cargar}>Reintentar</button>
          </div>
        ) : cargando ? (
          <div className={styles.cola}>
            {[0, 1, 2].map(i => <div key={i} className={`${styles.ticket} ${styles.skel}`} />)}
          </div>
        ) : documentos.length === 0 ? (
          <div className={styles.vacio}>
            <span className={styles.vacioCheck}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <div className={styles.vacioTitulo}>
              {filtroTipo ? 'Sin pendientes en esta categoría' : 'Bandeja vacía'}
            </div>
            <div className={styles.vacioSub}>
              {filtroTipo
                ? 'No hay documentos esperando en este origen.'
                : 'No hay documentos por revisar. Todo está aprobado o rechazado.'}
            </div>
          </div>
        ) : (
          <div className={styles.cola}>
            {documentos.map(doc => {
              const meta = TIPO_META[doc.tipo];
              const dias = diasEspera(doc.creado_en);
              const enProceso = procesando === doc.key;
              return (
                <article key={doc.key} className={`${styles.ticket} ${enProceso ? styles.ticketProcesando : ''}`}>
                  <span className={`${styles.ticketIcono} ${meta.clsTono}`}><meta.Icono /></span>

                  <div className={styles.ticketCuerpo}>
                    <div className={styles.ticketLinea1}>
                      <span className={`${styles.badgeTipo} ${meta.clsBadge}`}>{meta.etiqueta}</span>
                      <span className={styles.ticketOrigen}>{doc.origen}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.ticketArchivo}
                      onClick={() => handleDescargar(doc)}
                      title="Descargar para revisar"
                    >
                      <TipoArchivo mime={doc.tipo_mime} />
                      <span className={styles.ticketArchivoNombre}>{doc.nombre_original}</span>
                    </button>
                    <div className={styles.ticketMeta}>
                      <span>Subido {formatFecha(doc.creado_en)}</span>
                      {dias > 0 && (
                        <span className={`${styles.espera} ${dias >= 3 ? styles.esperaAlta : ''}`}>
                          {dias} día{dias === 1 ? '' : 's'} en espera
                        </span>
                      )}
                      {doc.subido_por && <span>por {doc.subido_por}</span>}
                    </div>
                  </div>

                  <div className={styles.ticketAcciones}>
                    <button
                      className={styles.btnDescargar}
                      onClick={() => handleDescargar(doc)}
                      disabled={enProceso}
                      title="Descargar"
                    >
                      <IconoDescarga />
                    </button>
                    <button
                      className={styles.btnRechazar}
                      onClick={() => handleResolver(doc, 'desaprobado')}
                      disabled={enProceso}
                    >
                      <IconoX /> Rechazar
                    </button>
                    <button
                      className={styles.btnAprobar}
                      onClick={() => handleResolver(doc, 'aprobado')}
                      disabled={enProceso}
                    >
                      <IconoCheck /> Aprobar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ── Chip de tipo de archivo ── */
function TipoArchivo({ mime }) {
  const es = t => mime?.includes(t);
  if (es('pdf')) return <span className={`${styles.fileBadge} ${styles.filePDF}`}>PDF</span>;
  if (es('sheet') || es('excel')) return <span className={`${styles.fileBadge} ${styles.fileXLS}`}>XLS</span>;
  return <span className={`${styles.fileBadge} ${styles.fileOtro}`}>DOC</span>;
}

/* ── Iconos ── */
function IconoProveedor() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
function IconoUnidad() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V8l7-4 7 4v13" /><path d="M9 21v-6h6v6" /><path d="M3 8h18" />
    </svg>
  );
}
function IconoCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconoX() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconoDescarga() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}
