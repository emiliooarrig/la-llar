import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Proveedores.module.css';

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

/* ── Helpers de tiempo ──────────────────────────────────── */
function formatDatetime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* Calcula el estado visible de la ventana */
function getEstadoVentana(v) {
  if (!v) return null;
  const now = new Date();
  if (v.desde && v.hasta) {
    const d = new Date(v.desde);
    const h = new Date(v.hasta);
    if (now < d) return { css: styles.ventanaFutura,  texto: `Programada · Abre ${formatDatetime(v.desde)}` };
    if (now <= h) return { css: styles.ventanaActiva, texto: `Activa · Cierra ${formatDatetime(v.hasta)}` };
    return            { css: styles.ventanaVencida,   texto: 'Programación vencida' };
  }
  return v.abierta
    ? { css: styles.ventanaActiva,  texto: 'Abierta manualmente' }
    : { css: styles.ventanaCerrada, texto: 'Cerrada' };
}

const FORM_VACIO = { desde: '', hasta: '' };

/* ── Iconos ─────────────────────────────────────────────── */
function IconoCalendario() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconoCerrar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconoTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}
function IconoMas() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function IconoLapiz() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function IconoOjo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconoOjoOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function IconoBuscar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

const FORM_PROV_VACIO = { nombre: '', rfc: '' };

/* Orden del catálogo: activos primero, luego alfabético. */
function ordenarProveedores(a, b) {
  if (a.activo !== b.activo) return Number(b.activo) - Number(a.activo);
  return a.nombre.localeCompare(b.nombre);
}

/* ── Componente principal ───────────────────────────────── */
export default function AdminProveedores() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const [proveedores, setProveedores] = useState([]);
  const [ventana, setVentana]         = useState(null);
  const [cargando, setCargando]       = useState(true);

  // Modal de programación
  const [modalProg, setModalProg]       = useState(false);
  const [form, setForm]                 = useState(FORM_VACIO);
  const [guardando, setGuardando]       = useState(false);
  const [limpiando, setLimpiando]       = useState(false);
  const [toggling, setToggling]         = useState(false);

  // Modal de alta / edición de proveedor (CRUD del catálogo)
  const [modalProv, setModalProv]       = useState(false);
  const [modoProv, setModoProv]         = useState('crear');
  const [editandoProv, setEditandoProv] = useState(null);
  const [formProv, setFormProv]         = useState(FORM_PROV_VACIO);
  const [guardandoProv, setGuardandoProv] = useState(false);

  // Filtros del listado
  const [busqueda, setBusqueda]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas'); // todas | activos | inactivos
  const [filtroDocs, setFiltroDocs]     = useState('todas'); // todas | pendientes | sin

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [resP, resV] = await Promise.all([
        api.get('/proveedores?incluir_inactivos=1'),
        api.get('/ventanas/proveedores'),
      ]);
      setProveedores([...resP.data].sort(ordenarProveedores));
      setVentana(resV.data);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los datos.', confirmButtonColor: '#E8621A' });
    } finally {
      setCargando(false);
    }
  }

  /* ── CRUD de proveedor ───────────────────────────────── */
  function abrirCrearProv() {
    setModoProv('crear');
    setEditandoProv(null);
    setFormProv(FORM_PROV_VACIO);
    setModalProv(true);
  }

  function abrirEditarProv(prov) {
    setModoProv('editar');
    setEditandoProv(prov);
    setFormProv({ nombre: prov.nombre, rfc: prov.rfc ?? '' });
    setModalProv(true);
  }

  function cerrarModalProv() {
    if (guardandoProv) return;
    setModalProv(false);
    setEditandoProv(null);
    setFormProv(FORM_PROV_VACIO);
  }

  async function handleGuardarProv() {
    const nombre = formProv.nombre.trim();
    const rfc = formProv.rfc.trim().toUpperCase();

    if (!nombre) {
      return Swal.fire({ icon: 'warning', title: 'Falta el nombre', text: 'El nombre del proveedor es obligatorio.', confirmButtonColor: '#E8621A' });
    }
    // El RFC es opcional, pero si se escribe debe tener un formato válido.
    if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
      return Swal.fire({ icon: 'warning', title: 'RFC inválido', text: 'El RFC debe tener 12 o 13 caracteres con el formato oficial.', confirmButtonColor: '#E8621A' });
    }

    const payload = { nombre, rfc: rfc || null };
    setGuardandoProv(true);
    try {
      if (modoProv === 'crear') {
        const res = await api.post('/proveedores', payload);
        setProveedores(prev => [...prev, res.data].sort(ordenarProveedores));
      } else {
        const res = await api.put(`/proveedores/${editandoProv.id}`, payload);
        setProveedores(prev => prev.map(p => (p.id === res.data.id ? res.data : p)).sort(ordenarProveedores));
      }
      cerrarModalProv();
      Swal.fire({
        icon: 'success',
        title: modoProv === 'crear' ? 'Proveedor agregado' : 'Cambios guardados',
        text: modoProv === 'crear' ? `${nombre} se registró en el catálogo.` : `Se actualizó la información de ${nombre}.`,
        timer: 1600, showConfirmButton: false, timerProgressBar: true,
      });
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo guardar el proveedor.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardandoProv(false);
    }
  }

  async function handleToggleProv(prov) {
    const r = await Swal.fire({
      title: prov.activo ? '¿Desactivar proveedor?' : '¿Reactivar proveedor?',
      html: prov.activo
        ? `<b>${prov.nombre}</b> se ocultará del catálogo. Sus documentos se conservan.`
        : `<b>${prov.nombre}</b> volverá a estar disponible en el catálogo.`,
      icon: 'question', showCancelButton: true,
      confirmButtonColor: prov.activo ? '#D93025' : '#2E7D32',
      cancelButtonColor: '#9E9892',
      confirmButtonText: prov.activo ? 'Sí, desactivar' : 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    try {
      const res = await api.patch(`/proveedores/${prov.id}/activo`);
      setProveedores(prev => prev.map(p => (p.id === res.data.id ? res.data : p)).sort(ordenarProveedores));
      Swal.fire({ icon: 'success', title: res.data.activo ? 'Proveedor reactivado' : 'Proveedor desactivado', timer: 1300, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo cambiar el estado del proveedor.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    }
  }

  /* ── Abrir modal con valores actuales ────────────────── */
  function abrirModal() {
    setForm({
      desde: toDatetimeLocal(ventana?.desde),
      hasta: toDatetimeLocal(ventana?.hasta),
    });
    setModalProg(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalProg(false);
    setForm(FORM_VACIO);
  }

  /* ── Guardar programación ────────────────────────────── */
  async function handleGuardarProg() {
    if (!form.desde || !form.hasta) {
      Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Ingresa la fecha de apertura y cierre.', confirmButtonColor: '#E8621A' });
      return;
    }
    const dDesde = new Date(form.desde);
    const dHasta = new Date(form.hasta);
    if (dHasta <= dDesde) {
      Swal.fire({ icon: 'warning', title: 'Rango inválido', text: 'El cierre debe ser posterior a la apertura.', confirmButtonColor: '#E8621A' });
      return;
    }

    setGuardando(true);
    try {
      const res = await api.put('/ventanas/proveedores/programacion', {
        desde: dDesde.toISOString(),
        hasta: dHasta.toISOString(),
      });
      setVentana(res.data);
      cerrarModal();
      Swal.fire({ icon: 'success', title: 'Programación guardada', timer: 1500, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error ?? 'No se pudo guardar la programación.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardando(false);
    }
  }

  /* ── Limpiar programación ────────────────────────────── */
  async function handleLimpiar() {
    const r = await Swal.fire({
      title: '¿Eliminar programación?',
      text: 'La ventana volverá al modo manual (actualmente cerrada).',
      icon: 'question', showCancelButton: true,
      confirmButtonColor: '#D93025', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, limpiar', cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    setLimpiando(true);
    try {
      const res = await api.delete('/ventanas/proveedores/programacion');
      setVentana(res.data);
      Swal.fire({ icon: 'success', title: 'Programación eliminada', timer: 1400, showConfirmButton: false, timerProgressBar: true });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo limpiar la programación.', confirmButtonColor: '#E8621A' });
    } finally {
      setLimpiando(false);
    }
  }

  /* ── Toggle manual ───────────────────────────────────── */
  async function handleToggleManual() {
    const accion = ventana?.abierta ? 'cerrar' : 'abrir';
    const r = await Swal.fire({
      title: `¿${ventana?.abierta ? 'Cerrar' : 'Abrir'} ventana?`,
      text: ventana?.abierta
        ? 'Los proveedores ya no podrán subir documentos.'
        : 'Los proveedores podrán subir documentos de inmediato.',
      icon: 'question', showCancelButton: true,
      confirmButtonColor: ventana?.abierta ? '#D93025' : '#2E7D32',
      cancelButtonColor: '#9E9892',
      confirmButtonText: `Sí, ${accion}`, cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    setToggling(true);
    try {
      const res = await api.patch('/ventanas/proveedores');
      setVentana(res.data);
      Swal.fire({ icon: 'success', title: `Ventana ${res.data.abierta ? 'abierta' : 'cerrada'}`, timer: 1300, showConfirmButton: false, timerProgressBar: true });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el estado.', confirmButtonColor: '#E8621A' });
    } finally {
      setToggling(false);
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

  const estado = getEstadoVentana(ventana);
  const tieneProgramacion = !!(ventana?.desde && ventana?.hasta);
  const ocupado = guardando || limpiando || toggling;
  const activos = proveedores.filter(p => p.activo).length;
  const inactivos = proveedores.length - activos;

  /* ── Derivados de filtrado ───────────────────────────── */
  const pendientesDe = prov => prov.documentos_proveedor?.filter(d => d.estado === 'pendiente').length ?? 0;

  const termino = busqueda.trim().toLowerCase();
  const proveedoresFiltrados = proveedores.filter(prov => {
    if (termino) {
      const enNombre = prov.nombre.toLowerCase().includes(termino);
      const enRfc = (prov.rfc ?? '').toLowerCase().includes(termino);
      if (!enNombre && !enRfc) return false;
    }
    if (filtroEstado === 'activos'   && !prov.activo) return false;
    if (filtroEstado === 'inactivos' &&  prov.activo) return false;
    if (filtroDocs === 'pendientes' && pendientesDe(prov) === 0) return false;
    if (filtroDocs === 'sin' && (prov._count?.documentos_proveedor ?? 0) > 0) return false;
    return true;
  });
  const hayFiltros = !!termino || filtroEstado !== 'todas' || filtroDocs !== 'todas';

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

        {/* Encabezado */}
        <div className={styles.paginaHeader}>
          <div>
            <h1 className={styles.tituloPagina}>Proveedores</h1>
            <p className={styles.subtituloPagina}>
              Gestión de documentos por proveedor · {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''}
            </p>
          </div>

          {/* ── Controles de ventana ── */}
          <div className={styles.ventanaControles}>
            {/* Badge + rango */}
            <div className={styles.ventanaWrapper}>
              {estado && <span className={estado.css}>{estado.texto}</span>}
              {tieneProgramacion && (
                <span className={styles.ventanaRango}>
                  {formatDatetime(ventana.desde)} → {formatDatetime(ventana.hasta)}
                </span>
              )}
            </div>

            {/* Botón programar/editar siempre visible */}
            <button
              className={styles.btnProgramar}
              onClick={abrirModal}
              disabled={ocupado || !ventana}
            >
              <IconoCalendario />
              {tieneProgramacion ? 'Editar programación' : 'Programar'}
            </button>

            {/* Si hay programación → limpiar | Si no → toggle manual */}
            {tieneProgramacion ? (
              <button
                className={styles.btnLimpiar}
                onClick={handleLimpiar}
                disabled={ocupado}
              >
                <IconoCerrar />
                Limpiar
              </button>
            ) : (
              ventana?.abierta ? (
                <button className={styles.btnManualCerrar} onClick={handleToggleManual} disabled={ocupado}>
                  Cerrar manualmente
                </button>
              ) : (
                <button className={styles.btnManualAbrir} onClick={handleToggleManual} disabled={ocupado}>
                  Abrir manualmente
                </button>
              )
            )}
          </div>
        </div>

        {/* Barra del catálogo: alta de proveedor */}
        <div className={styles.catalogoBarra}>
          <div className={styles.catalogoTitulo}>
            <h2 className={styles.catalogoLabel}>Catálogo de proveedores</h2>
            <span className={styles.catalogoConteo}>
              {activos} activo{activos !== 1 ? 's' : ''}
              {inactivos > 0 && <span className={styles.catalogoConteoMuted}> · {inactivos} inactivo{inactivos !== 1 ? 's' : ''}</span>}
            </span>
          </div>
          <button className={styles.btnNuevoProv} onClick={abrirCrearProv}>
            <IconoMas /> Nuevo proveedor
          </button>
        </div>

        {/* ── Filtros del listado ── */}
        <div className={styles.filtroBarra}>
          <div className={styles.buscador}>
            <span className={styles.buscadorIcono}><IconoBuscar /></span>
            <input
              type="text"
              className={styles.inputBuscar}
              placeholder="Buscar por nombre o RFC…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          <div className={styles.filtros}>
            <div className={styles.filtroGrupo}>
              <span className={styles.filtroLabel}>Estado</span>
              <div className={styles.segmento}>
                {[
                  { v: 'todas',     t: 'Todos' },
                  { v: 'activos',   t: 'Activos' },
                  { v: 'inactivos', t: 'Inactivos' },
                ].map(o => (
                  <button
                    key={o.v}
                    className={`${styles.segmentoBtn} ${filtroEstado === o.v ? styles.segmentoBtnActivo : ''}`}
                    onClick={() => setFiltroEstado(o.v)}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filtroGrupo}>
              <span className={styles.filtroLabel}>Documentación</span>
              <div className={styles.segmento}>
                {[
                  { v: 'todas',      t: 'Todos' },
                  { v: 'pendientes', t: 'Con pendientes' },
                  { v: 'sin',        t: 'Sin documentos' },
                ].map(o => (
                  <button
                    key={o.v}
                    className={`${styles.segmentoBtn} ${filtroDocs === o.v ? styles.segmentoBtnActivo : ''}`}
                    onClick={() => setFiltroDocs(o.v)}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid de tarjetas */}
        {cargando ? (
          <div className={styles.estadoVacio}>
            <div className={styles.cargandoSpinner} />
            Cargando proveedores...
          </div>
        ) : proveedores.length === 0 ? (
          <div className={styles.estadoVacio}>No hay proveedores registrados.</div>
        ) : proveedoresFiltrados.length === 0 ? (
          <div className={styles.estadoVacio}>
            {hayFiltros
              ? 'Ningún proveedor coincide con los filtros aplicados.'
              : 'No hay proveedores registrados.'}
          </div>
        ) : (
          <div className={styles.gridProveedores}>
            {proveedoresFiltrados.map(prov => {
              const total      = prov._count?.documentos_proveedor ?? 0;
              const pendientes = prov.documentos_proveedor?.filter(d => d.estado === 'pendiente').length ?? 0;
              return (
                <div
                  key={prov.id}
                  className={`${styles.tarjetaProveedor} ${!prov.activo ? styles.tarjetaInactiva : ''}`}
                  onClick={() => navigate(`/admin/proveedores/${prov.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/admin/proveedores/${prov.id}`)}
                >
                  <div className={styles.tarjetaAvatar}>{prov.nombre.charAt(0)}</div>
                  <div className={styles.tarjetaInfo}>
                    <p className={styles.tarjetaNombre}>
                      {prov.nombre}
                      {!prov.activo && <span className={styles.chipInactivo}>Inactivo</span>}
                    </p>
                    <p className={styles.tarjetaRfc}>{prov.rfc ?? 'Sin RFC registrado'}</p>
                  </div>
                  <div className={styles.tarjetaStats}>
                    {total === 0 ? (
                      <span className={styles.statSinDocs}>Sin documentos</span>
                    ) : (
                      <>
                        <span className={styles.statTotal}>{total} doc{total !== 1 ? 's' : ''}</span>
                        {pendientes > 0 && (
                          <span className={styles.statPendiente}>
                            {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    className={styles.tarjetaAcciones}
                    onKeyDown={e => e.stopPropagation()}
                  >
                    <button
                      className={styles.btnEditarProv}
                      onClick={e => { e.stopPropagation(); abrirEditarProv(prov); }}
                      title="Editar proveedor"
                      aria-label="Editar proveedor"
                    ><IconoLapiz /></button>
                    <button
                      className={prov.activo ? styles.btnDesactivarProv : styles.btnReactivarProv}
                      onClick={e => { e.stopPropagation(); handleToggleProv(prov); }}
                      title={prov.activo ? 'Desactivar proveedor' : 'Reactivar proveedor'}
                      aria-label={prov.activo ? 'Desactivar proveedor' : 'Reactivar proveedor'}
                    >{prov.activo ? <IconoOjoOff /> : <IconoOjo />}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      {/* ── Modal de programación ─────────────────────── */}
      {modalProg && (
        <div
          className={styles.overlayProg}
          onMouseDown={e => e.target === e.currentTarget && cerrarModal()}
        >
          <div className={styles.modalProg}>
            <div className={styles.modalProgHeader}>
              <h2 className={styles.modalProgTitulo}>Programar ventana de carga</h2>
              <button className={styles.modalProgCerrar} onClick={cerrarModal} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            <div className={styles.modalProgCuerpo}>
              <p className={styles.modalProgDesc}>
                Los proveedores podrán subir documentos únicamente dentro del intervalo indicado.
                Fuera de ese rango la ventana quedará cerrada automáticamente.
              </p>

              <div className={styles.campoProg}>
                <label className={styles.etiquetaProg}>Apertura *</label>
                <input
                  type="datetime-local"
                  className={styles.inputFecha}
                  value={form.desde}
                  onChange={e => setForm(p => ({ ...p, desde: e.target.value }))}
                  disabled={guardando}
                />
              </div>

              <div className={styles.campoProg}>
                <label className={styles.etiquetaProg}>Cierre *</label>
                <input
                  type="datetime-local"
                  className={styles.inputFecha}
                  value={form.hasta}
                  onChange={e => setForm(p => ({ ...p, hasta: e.target.value }))}
                  disabled={guardando}
                  min={form.desde}
                />
              </div>
            </div>

            <div className={styles.modalProgPie}>
              <button className={styles.btnCancelarProg} onClick={cerrarModal} disabled={guardando}>
                Cancelar
              </button>
              <button className={styles.btnGuardarProg} onClick={handleGuardarProg} disabled={guardando}>
                {guardando
                  ? <span className={styles.spinnerBtn} />
                  : 'Guardar programación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de alta / edición de proveedor ───────── */}
      {modalProv && (
        <div
          className={styles.overlayProg}
          onMouseDown={e => e.target === e.currentTarget && cerrarModalProv()}
        >
          <div className={styles.modalProg}>
            <div className={styles.modalProgHeader}>
              <h2 className={styles.modalProgTitulo}>
                {modoProv === 'crear' ? 'Nuevo proveedor' : 'Editar proveedor'}
              </h2>
              <button className={styles.modalProgCerrar} onClick={cerrarModalProv} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            <div className={styles.modalProgCuerpo}>
              <p className={styles.modalProgDesc}>
                {modoProv === 'crear'
                  ? 'Registra un proveedor en el catálogo. Después podrás asignarle un usuario y recibir su documentación.'
                  : 'Actualiza el nombre o el RFC del proveedor. Sus documentos no se ven afectados.'}
              </p>

              <div className={styles.campoProg}>
                <label className={styles.etiquetaProg}>Nombre o razón social *</label>
                <input
                  type="text"
                  className={styles.inputTexto}
                  placeholder="Ej. Distribuidora La Huerta S.A. de C.V."
                  value={formProv.nombre}
                  onChange={e => setFormProv(p => ({ ...p, nombre: e.target.value }))}
                  disabled={guardandoProv}
                  maxLength={150}
                  autoFocus
                />
              </div>

              <div className={styles.campoProg}>
                <label className={styles.etiquetaProg}>RFC</label>
                <input
                  type="text"
                  className={`${styles.inputTexto} ${styles.inputRfc}`}
                  placeholder="Opcional · Ej. XAXX010101000"
                  value={formProv.rfc}
                  onChange={e => setFormProv(p => ({ ...p, rfc: e.target.value.toUpperCase() }))}
                  disabled={guardandoProv}
                  maxLength={13}
                />
                <span className={styles.inputHintProv}>
                  12 caracteres (persona moral) o 13 (persona física). Puedes dejarlo en blanco.
                </span>
              </div>
            </div>

            <div className={styles.modalProgPie}>
              <button className={styles.btnCancelarProg} onClick={cerrarModalProv} disabled={guardandoProv}>
                Cancelar
              </button>
              <button className={styles.btnGuardarProg} onClick={handleGuardarProv} disabled={guardandoProv}>
                {guardandoProv
                  ? <span className={styles.spinnerBtn} />
                  : modoProv === 'crear' ? 'Agregar proveedor' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
