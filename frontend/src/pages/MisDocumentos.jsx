import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './MisDocumentos.module.css';

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
  const texto = { pendiente: 'En revisión', aprobado: 'Aprobado', desaprobado: 'Desaprobado' };
  return <span className={map[estado] ?? styles.badgePendiente}>{texto[estado] ?? estado}</span>;
}

export default function MisDocumentos() {
  const navigate  = useNavigate();
  const { usuario, logout } = useAuth();
  const inputRef  = useRef(null);

  const [proveedor, setProveedor] = useState(null);
  const [ventana, setVentana]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [subiendo, setSubiendo]   = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [resP, resV] = await Promise.all([
        api.get('/proveedores'),
        api.get('/ventanas/proveedores'),
      ]);
      setProveedor(resP.data);
      setVentana(resV.data);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar tus documentos.', confirmButtonColor: '#E8621A' });
    } finally {
      setCargando(false);
    }
  }

  async function handleSeleccionArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ventanaAbierta) {
      Swal.fire({ icon: 'warning', title: 'Ventana cerrada', text: 'El administrador no ha habilitado la carga de documentos en este momento.', confirmButtonColor: '#E8621A' });
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await api.post(`/proveedores/${proveedor.id}/documentos`, formData, {
        headers: { 'Content-Type': undefined },
      });
      setProveedor(prev => ({
        ...prev,
        documentos_proveedor: [res.data, ...(prev.documentos_proveedor ?? [])],
      }));
      Swal.fire({ icon: 'success', title: 'Documento subido', text: 'Quedará en revisión hasta que el administrador lo apruebe.', confirmButtonColor: '#E8621A' });
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Error al subir el archivo.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setSubiendo(false);
    }
  }

  async function handleDescargar(doc) {
    try {
      const res = await api.get(`/proveedores/documentos/${doc.id}/descargar`, { responseType: 'blob' });
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

  async function handleLogout() {
    const r = await Swal.fire({
      title: '¿Cerrar sesión?', text: 'Se cerrará tu sesión actual.', icon: 'question',
      showCancelButton: true, confirmButtonColor: '#E8621A', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar',
    });
    if (r.isConfirmed) { logout(); navigate('/login', { replace: true }); }
  }

  const docs = proveedor?.documentos_proveedor ?? [];

  // Calcula si la ventana está efectivamente abierta (manual o por intervalo)
  function calcularAbierta(v) {
    if (!v) return false;
    const now = new Date();
    if (v.desde && v.hasta) return now >= new Date(v.desde) && now <= new Date(v.hasta);
    return v.abierta ?? false;
  }

  function getMensajeVentana(v) {
    if (!v) return null;
    const now = new Date();
    const fmt = iso => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    if (v.desde && v.hasta) {
      const d = new Date(v.desde);
      const h = new Date(v.hasta);
      if (now < d)  return `La carga estará disponible desde el ${fmt(v.desde)} hasta el ${fmt(v.hasta)}.`;
      if (now <= h) return `La carga está abierta hasta el ${fmt(v.hasta)}.`;
      return `El período de carga venció el ${fmt(v.hasta)}. Contacta al administrador.`;
    }
    return 'La carga de documentos está temporalmente deshabilitada. Contacta al administrador para habilitarla.';
  }

  const ventanaAbierta = calcularAbierta(ventana);
  const mensajeVentana = getMensajeVentana(ventana);

  return (
    <div className={styles.pagina}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.marca}>
          <LogoInicio className={styles.logoSmall} />
          <span className={styles.appNombre}>Portal de Proveedores</span>
        </div>
        <div className={styles.usuario}>
          <div className={styles.infoUsuario}>
            <span className={styles.nombreUsuario}>{usuario?.nombre}</span>
            <span className={styles.rolBadge}>Proveedor</span>
          </div>
          <button className={styles.botonSalir} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.contenido}>

        {cargando ? (
          <div className={styles.cargandoWrap}>
            <div className={styles.cargandoSpinner} />
            Cargando tus documentos...
          </div>
        ) : (
          <>
            {/* Card de perfil */}
            <div className={styles.perfilCard}>
              <div className={styles.perfilAvatar}>
                {proveedor?.nombre?.charAt(0) ?? '?'}
              </div>
              <div className={styles.perfilInfo}>
                <h1 className={styles.perfilNombre}>{proveedor?.nombre}</h1>
                {proveedor?.rfc && <p className={styles.perfilRfc}>RFC: {proveedor.rfc}</p>}
              </div>
              <div className={styles.perfilAcciones}>
                <span className={ventanaAbierta ? styles.ventanaAbierta : styles.ventanaCerrada}>
                  {ventanaAbierta ? 'Carga habilitada' : 'Carga deshabilitada'}
                </span>
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
                  disabled={subiendo || !ventanaAbierta}
                  title={!ventanaAbierta ? 'La ventana de carga está cerrada' : 'Subir un documento'}
                >
                  <IconoSubir />
                  {subiendo ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </div>

            {!ventanaAbierta && mensajeVentana && (
              <div className={styles.alertaVentana}>
                <IconoInfo />
                {mensajeVentana}
              </div>
            )}

            {/* Tabla de documentos */}
            <div className={styles.seccionDocs}>
              <h2 className={styles.seccionTitulo}>Mis documentos ({docs.length})</h2>
              <div className={styles.tablaWrapper}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Estado</th>
                      <th>Fecha de carga</th>
                      <th className={styles.thDescargar}>Descargar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className={styles.estadoTabla}>
                          No has subido documentos aún.
                          {ventanaAbierta && ' Usa el botón "Subir documento" para comenzar.'}
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
                          <td className={styles.colDescargar}>
                            <button
                              className={styles.btnDescargar}
                              onClick={() => handleDescargar(doc)}
                              title="Descargar archivo"
                            >
                              <IconoDescarga />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ── Iconos ─────────────────────────────────────────────── */
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
function IconoInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
