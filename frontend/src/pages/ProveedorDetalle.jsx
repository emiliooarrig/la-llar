import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Proveedores.module.css';

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function IconoTipoArchivo({ mime }) {
  const es = t => mime?.includes(t);
  if (es('pdf'))   return <span className={`${styles.iconoBadge} ${styles.iconoPDF}`}>PDF</span>;
  if (es('sheet') || es('excel')) return <span className={`${styles.iconoBadge} ${styles.iconoXLSX}`}>XLS</span>;
  return <span className={`${styles.iconoBadge} ${styles.iconoOther}`}>DOC</span>;
}

function BadgeEstado({ estado }) {
  const map = {
    pendiente:   styles.badgePendiente,
    aprobado:    styles.badgeAprobado,
    desaprobado: styles.badgeDesaprobado,
  };
  const texto = { pendiente: 'Pendiente', aprobado: 'Aprobado', desaprobado: 'Desaprobado' };
  return <span className={map[estado] ?? styles.badgePendiente}>{texto[estado] ?? estado}</span>;
}

export default function ProveedorDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const inputRef = useRef(null);

  const [proveedor, setProveedor]   = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [subiendo, setSubiendo]     = useState(false);
  const [cambiando, setCambiando]   = useState(null);
  const [eliminando, setEliminando] = useState(null);

  useEffect(() => { cargarProveedor(); }, [id]);

  async function cargarProveedor() {
    setCargando(true);
    try {
      const res = await api.get(`/proveedores/${id}`);
      setProveedor(res.data);
    } catch (e) {
      const msg = e.response?.data?.error ?? 'No se pudo cargar el proveedor.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
      navigate('/admin/proveedores');
    } finally {
      setCargando(false);
    }
  }

  /* ── Subir documento ─────────────────────────────────── */
  async function handleSeleccionArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await api.post(`/proveedores/${id}/documentos`, formData, {
        headers: { 'Content-Type': undefined },
      });
      setProveedor(prev => ({
        ...prev,
        documentos_proveedor: [res.data, ...(prev.documentos_proveedor ?? [])],
      }));
      Swal.fire({ icon: 'success', title: 'Documento subido', timer: 1400, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Error al subir el archivo.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setSubiendo(false);
    }
  }

  /* ── Descargar ───────────────────────────────────────── */
  async function handleDescargar(doc) {
    try {
      const res = await api.get(`/proveedores/documentos/${doc.id}/descargar`, {
        responseType: 'blob',
      });
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

  /* ── Cambiar estado ──────────────────────────────────── */
  async function handleEstado(doc, nuevoEstado) {
    const textos = {
      aprobado:    { titulo: '¿Aprobar documento?',    texto: `"${doc.nombre_original}" quedará como aprobado.`,    color: '#2E7D32' },
      desaprobado: { titulo: '¿Desaprobar documento?', texto: `"${doc.nombre_original}" quedará como desaprobado.`, color: '#D93025' },
      pendiente:   { titulo: '¿Volver a pendiente?',   texto: `"${doc.nombre_original}" regresará a revisión.`,      color: '#E65100' },
    };
    const cfg = textos[nuevoEstado];

    const result = await Swal.fire({
      title: cfg.titulo, text: cfg.texto, icon: 'question',
      showCancelButton: true,
      confirmButtonColor: cfg.color, cancelButtonColor: '#9E9892',
      confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    setCambiando(doc.id);
    try {
      const res = await api.patch(`/proveedores/documentos/${doc.id}/estado`, { estado: nuevoEstado });
      setProveedor(prev => ({
        ...prev,
        documentos_proveedor: prev.documentos_proveedor.map(d =>
          d.id === res.data.id ? { ...d, estado: res.data.estado } : d
        ),
      }));
      Swal.fire({ icon: 'success', title: 'Estado actualizado', timer: 1200, showConfirmButton: false, timerProgressBar: true });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el estado.', confirmButtonColor: '#E8621A' });
    } finally {
      setCambiando(null);
    }
  }

  /* ── Eliminar documento ─────────────────────────────── */
  async function handleEliminar(doc) {
    const result = await Swal.fire({
      title: '¿Eliminar documento?',
      html: `<span style="word-break:break-word">"<strong>${doc.nombre_original}</strong>" se eliminará permanentemente del sistema.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D93025',
      cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    setEliminando(doc.id);
    try {
      await api.delete(`/proveedores/documentos/${doc.id}`);
      setProveedor(prev => ({
        ...prev,
        documentos_proveedor: prev.documentos_proveedor.filter(d => d.id !== doc.id),
      }));
      Swal.fire({ icon: 'success', title: 'Documento eliminado', timer: 1200, showConfirmButton: false, timerProgressBar: true });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar el documento.', confirmButtonColor: '#E8621A' });
    } finally {
      setEliminando(null);
    }
  }

  async function handleLogout() {
    const r = await Swal.fire({
      title: '¿Cerrar sesión?', text: 'Se cerrará tu sesión actual.', icon: 'question',
      showCancelButton: true, confirmButtonColor: '#E8621A', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar',
    });
    if (r.isConfirmed) { logout(); navigate('/login', { replace: true }); }
  }

  const docs = proveedor?.documentos_proveedor ?? [];

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
          <button className={styles.botonSalir} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.contenido}>

        {/* Breadcrumb */}
        <div className={styles.navDetalle}>
          <button className={styles.btnVolver} onClick={() => navigate('/admin/proveedores')}>
            <IconoFlecha /> Proveedores
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbActual}>{proveedor?.nombre ?? '…'}</span>
        </div>

        {cargando ? (
          <div className={styles.estadoTabla}>
            <div className={styles.cargandoSpinner} />
            Cargando proveedor...
          </div>
        ) : (
          <>
            {/* Card de proveedor */}
            <div className={styles.detalleHeader}>
              <div className={styles.detalleAvatar}>{proveedor.nombre.charAt(0)}</div>
              <div className={styles.detalleInfo}>
                <p className={styles.detalleNombre}>{proveedor.nombre}</p>
                <p className={styles.detalleRfc}>RFC: {proveedor.rfc ?? 'No especificado'} · {docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
              </div>
              <div className={styles.detalleAcciones}>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleSeleccionArchivo}
                />
                <button
                  className={styles.btnSubir}
                  onClick={() => inputRef.current?.click()}
                  disabled={subiendo}
                >
                  <IconoSubir />
                  {subiendo ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </div>

            {/* Tabla de documentos */}
            <div className={styles.tablaWrapper}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th className={styles.thAcciones}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className={styles.estadoTabla}>
                        Este proveedor no tiene documentos subidos aún.
                      </td>
                    </tr>
                  ) : (
                    docs.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <div className={styles.iconoArchivo}>
                            <IconoTipoArchivo mime={doc.tipo_mime} />
                            <span className={styles.nombreArchivo} title={doc.nombre_original}>
                              {doc.nombre_original}
                            </span>
                          </div>
                        </td>
                        <td><BadgeEstado estado={doc.estado} /></td>
                        <td className={styles.colFecha}>{formatFecha(doc.creado_en)}</td>
                        <td className={styles.colAcciones}>
                          <div className={styles.acciones}>
                            {/* Descargar */}
                            <button
                              className={styles.btnDescargar}
                              onClick={() => handleDescargar(doc)}
                              title="Descargar"
                            >
                              <IconoDescarga />
                            </button>
                            {/* Aprobar (solo si no está aprobado) */}
                            {doc.estado !== 'aprobado' && (
                              <button
                                className={styles.btnAprobar}
                                onClick={() => handleEstado(doc, 'aprobado')}
                                disabled={cambiando === doc.id || eliminando === doc.id}
                                title="Aprobar documento"
                              >
                                <IconoCheck />
                              </button>
                            )}
                            {/* Desaprobar (solo si no está desaprobado) */}
                            {doc.estado !== 'desaprobado' && (
                              <button
                                className={styles.btnDesaprobar}
                                onClick={() => handleEstado(doc, 'desaprobado')}
                                disabled={cambiando === doc.id || eliminando === doc.id}
                                title="Desaprobar documento"
                              >
                                <IconoX />
                              </button>
                            )}
                            {/* Eliminar */}
                            <button
                              className={styles.btnEliminar}
                              onClick={() => handleEliminar(doc)}
                              disabled={eliminando === doc.id || cambiando === doc.id}
                              title="Eliminar documento"
                            >
                              <IconoTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {docs.length > 0 && (
                <p className={styles.pieTabla}>
                  {docs.length} documento{docs.length !== 1 ? 's' : ''} ·{' '}
                  {docs.filter(d => d.estado === 'pendiente').length} pendiente{docs.filter(d => d.estado === 'pendiente').length !== 1 ? 's' : ''} ·{' '}
                  {docs.filter(d => d.estado === 'aprobado').length} aprobado{docs.filter(d => d.estado === 'aprobado').length !== 1 ? 's' : ''} ·{' '}
                  {docs.filter(d => d.estado === 'desaprobado').length} desaprobado{docs.filter(d => d.estado === 'desaprobado').length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ── Iconos ─────────────────────────────────────────────── */
function IconoFlecha() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function IconoSubir() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
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
function IconoCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconoX() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconoTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}
