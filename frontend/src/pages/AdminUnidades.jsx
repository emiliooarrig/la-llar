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
function IconoMas() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function IconoLapiz() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
  );
}
function IconoOjo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconoOjoOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
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

const FORM_UNI_VACIO = { nombre: '', dias: [1, 2, 3, 4, 5, 6] };

// Días de la semana en ISO (1=Lunes … 7=Domingo).
const DIAS_LABORALES = [
  { iso: 1, corta: 'Lun' },
  { iso: 2, corta: 'Mar' },
  { iso: 3, corta: 'Mié' },
  { iso: 4, corta: 'Jue' },
  { iso: 5, corta: 'Vie' },
  { iso: 6, corta: 'Sáb' },
  { iso: 7, corta: 'Dom' },
];

// Convierte "1,2,3,4,5,6" → [1,2,3,4,5,6]. Fallback: lunes a sábado.
function parseDiasLaborales(str) {
  if (!str) return [1, 2, 3, 4, 5, 6];
  const dias = String(str).split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 7);
  return dias.length ? dias : [1, 2, 3, 4, 5, 6];
}

/* Orden estable del catálogo: activas primero, luego alfabético. */
function ordenarUnidades(a, b) {
  if (a.activo !== b.activo) return Number(b.activo) - Number(a.activo);
  return a.nombre.localeCompare(b.nombre);
}

/* ── Componente principal ───────────────────────────────── */
export default function AdminUnidades() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const [unidades, setUnidades] = useState([]);
  const [ventana, setVentana]   = useState(null);
  const [cargando, setCargando] = useState(true);

  // Modal de programación
  const [modalProg, setModalProg] = useState(false);
  const [form, setForm]           = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [toggling, setToggling]   = useState(false);

  // CRUD del catálogo de unidades
  const [modalUni, setModalUni]       = useState(false);
  const [modoUni, setModoUni]         = useState('crear'); // 'crear' | 'editar'
  const [editandoUni, setEditandoUni] = useState(null);
  const [formUni, setFormUni]         = useState(FORM_UNI_VACIO);
  const [guardandoUni, setGuardandoUni] = useState(false);

  // Filtros del listado
  const [busqueda, setBusqueda]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas'); // todas | activas | inactivas
  const [filtroDocs, setFiltroDocs]     = useState('todas'); // todas | pendientes | sin

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [resU, resV] = await Promise.all([
        api.get('/unidades?incluir_inactivos=1'),
        api.get('/ventanas/unidades'),
      ]);
      setUnidades([...resU.data].sort(ordenarUnidades));
      setVentana(resV.data);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los datos.', confirmButtonColor: '#E8621A' });
    } finally {
      setCargando(false);
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
      const res = await api.put('/ventanas/unidades/programacion', {
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
      const res = await api.delete('/ventanas/unidades/programacion');
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
        ? 'Los gerentes ya no podrán subir documentos.'
        : 'Los gerentes podrán subir documentos de inmediato.',
      icon: 'question', showCancelButton: true,
      confirmButtonColor: ventana?.abierta ? '#D93025' : '#2E7D32',
      cancelButtonColor: '#9E9892',
      confirmButtonText: `Sí, ${accion}`, cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    setToggling(true);
    try {
      const res = await api.patch('/ventanas/unidades');
      setVentana(res.data);
      Swal.fire({ icon: 'success', title: `Ventana ${res.data.abierta ? 'abierta' : 'cerrada'}`, timer: 1300, showConfirmButton: false, timerProgressBar: true });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el estado.', confirmButtonColor: '#E8621A' });
    } finally {
      setToggling(false);
    }
  }

  /* ── CRUD del catálogo de unidades ───────────────────── */
  function abrirCrearUni() {
    setModoUni('crear');
    setEditandoUni(null);
    setFormUni(FORM_UNI_VACIO);
    setModalUni(true);
  }

  function abrirEditarUni(uni) {
    setModoUni('editar');
    setEditandoUni(uni);
    setFormUni({ nombre: uni.nombre, dias: parseDiasLaborales(uni.dias_laborales) });
    setModalUni(true);
  }

  function toggleDiaUni(iso) {
    setFormUni(p => {
      const dias = p.dias.includes(iso)
        ? p.dias.filter(d => d !== iso)
        : [...p.dias, iso].sort((a, b) => a - b);
      return { ...p, dias };
    });
  }

  function cerrarModalUni() {
    if (guardandoUni) return;
    setModalUni(false);
    setEditandoUni(null);
    setFormUni(FORM_UNI_VACIO);
  }

  async function handleGuardarUni() {
    const nombre = formUni.nombre.trim();
    if (!nombre) {
      Swal.fire({ icon: 'warning', title: 'Nombre requerido', text: 'Escribe el nombre de la unidad.', confirmButtonColor: '#E8621A' });
      return;
    }
    if (formUni.dias.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Días laborales requeridos', text: 'Selecciona al menos un día laboral para la unidad.', confirmButtonColor: '#E8621A' });
      return;
    }
    const payload = { nombre, dias_laborales: formUni.dias };

    setGuardandoUni(true);
    try {
      let unidad;
      if (modoUni === 'crear') {
        const res = await api.post('/unidades', payload);
        unidad = res.data;
        setUnidades(prev => [...prev, unidad].sort(ordenarUnidades));
      } else {
        const res = await api.put(`/unidades/${editandoUni.id}`, payload);
        unidad = res.data;
        setUnidades(prev => prev.map(u => (u.id === unidad.id ? unidad : u)).sort(ordenarUnidades));
      }
      setModalUni(false);
      setEditandoUni(null);
      setFormUni(FORM_UNI_VACIO);
      Swal.fire({
        icon: 'success',
        title: modoUni === 'crear' ? 'Unidad agregada' : 'Cambios guardados',
        timer: 1500, showConfirmButton: false, timerProgressBar: true,
      });
    } catch (e) {
      const msg = e.response?.data?.error ?? 'No se pudo guardar la unidad.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardandoUni(false);
    }
  }

  async function handleToggleUni(uni) {
    const desactivar = uni.activo;
    const r = await Swal.fire({
      title: desactivar ? '¿Desactivar unidad?' : '¿Reactivar unidad?',
      text: desactivar
        ? `"${uni.nombre}" dejará de aparecer en los selectores. Su historial de documentos y empleados se conserva.`
        : `"${uni.nombre}" volverá a estar disponible en el sistema.`,
      icon: 'question', showCancelButton: true,
      confirmButtonColor: desactivar ? '#D93025' : '#2E7D32',
      cancelButtonColor: '#9E9892',
      confirmButtonText: desactivar ? 'Sí, desactivar' : 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    try {
      const res = await api.patch(`/unidades/${uni.id}/activo`);
      setUnidades(prev => prev.map(u => (u.id === uni.id ? res.data : u)).sort(ordenarUnidades));
      Swal.fire({
        icon: 'success',
        title: res.data.activo ? 'Unidad reactivada' : 'Unidad desactivada',
        timer: 1300, showConfirmButton: false, timerProgressBar: true,
      });
    } catch (e) {
      const msg = e.response?.data?.error ?? 'No se pudo cambiar el estado.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
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

  /* ── Derivados de filtrado ───────────────────────────── */
  const pendientesDe = uni => uni.documentos_unidad?.filter(d => d.estado === 'pendiente').length ?? 0;

  const totalActivas   = unidades.filter(u => u.activo).length;
  const totalInactivas = unidades.length - totalActivas;

  const termino = busqueda.trim().toLowerCase();
  const unidadesFiltradas = unidades.filter(uni => {
    if (termino && !uni.nombre.toLowerCase().includes(termino)) return false;
    if (filtroEstado === 'activas'    && !uni.activo) return false;
    if (filtroEstado === 'inactivas'  &&  uni.activo) return false;
    if (filtroDocs === 'pendientes' && pendientesDe(uni) === 0) return false;
    if (filtroDocs === 'sin' && (uni._count?.documentos_unidad ?? 0) > 0) return false;
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
            <h1 className={styles.tituloPagina}>Unidades</h1>
            <p className={styles.subtituloPagina}>
              Documentación por cocina / sucursal · {unidades.length} unidad{unidades.length !== 1 ? 'es' : ''} en el sistema
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

        {/* ── Barra del catálogo (CRUD) ── */}
        <div className={styles.catalogoBarra}>
          <div className={styles.catalogoTitulo}>
            <span className={styles.catalogoLabel}>Catálogo de unidades</span>
            <span className={styles.catalogoConteo}>
              {totalActivas} activa{totalActivas !== 1 ? 's' : ''}
              <span className={styles.catalogoConteoMuted}> · {totalInactivas} inactiva{totalInactivas !== 1 ? 's' : ''}</span>
            </span>
          </div>
          <button className={styles.btnNuevoProv} onClick={abrirCrearUni}>
            <IconoMas />
            Nueva unidad
          </button>
        </div>

        {/* ── Filtros del listado ── */}
        <div className={styles.filtroBarra}>
          <div className={styles.buscador}>
            <span className={styles.buscadorIcono}><IconoBuscar /></span>
            <input
              type="text"
              className={styles.inputBuscar}
              placeholder="Buscar unidad por nombre…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          <div className={styles.filtros}>
            <div className={styles.filtroGrupo}>
              <span className={styles.filtroLabel}>Estado</span>
              <div className={styles.segmento}>
                {[
                  { v: 'todas',     t: 'Todas' },
                  { v: 'activas',   t: 'Activas' },
                  { v: 'inactivas', t: 'Inactivas' },
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
                  { v: 'todas',      t: 'Todas' },
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
            Cargando unidades...
          </div>
        ) : unidades.length === 0 ? (
          <div className={styles.estadoVacio}>No hay unidades registradas.</div>
        ) : unidadesFiltradas.length === 0 ? (
          <div className={styles.estadoVacio}>
            {hayFiltros
              ? 'Ninguna unidad coincide con los filtros aplicados.'
              : 'No hay unidades registradas.'}
          </div>
        ) : (
          <div className={styles.gridProveedores}>
            {unidadesFiltradas.map(uni => {
              const total      = uni._count?.documentos_unidad ?? 0;
              const pendientes = pendientesDe(uni);
              const empleados  = uni.empleados_activos ?? 0;
              return (
                <div
                  key={uni.id}
                  className={`${styles.tarjetaProveedor} ${!uni.activo ? styles.tarjetaInactiva : ''}`}
                  onClick={() => navigate(`/admin/unidades/${uni.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/admin/unidades/${uni.id}`)}
                >
                  <div className={styles.tarjetaAvatar}>{uni.nombre.charAt(0)}</div>
                  <div className={styles.tarjetaInfo}>
                    <p className={styles.tarjetaNombre}>
                      {uni.nombre}
                      {!uni.activo && <span className={styles.chipInactivo}>Inactiva</span>}
                    </p>
                    <p className={styles.tarjetaRfc}>
                      {empleados} empleado{empleados !== 1 ? 's' : ''} activo{empleados !== 1 ? 's' : ''}
                    </p>
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
                      title="Editar unidad"
                      aria-label="Editar unidad"
                      onClick={e => { e.stopPropagation(); abrirEditarUni(uni); }}
                    >
                      <IconoLapiz />
                    </button>
                    <button
                      className={uni.activo ? styles.btnDesactivarProv : styles.btnReactivarProv}
                      title={uni.activo ? 'Desactivar unidad' : 'Reactivar unidad'}
                      aria-label={uni.activo ? 'Desactivar unidad' : 'Reactivar unidad'}
                      onClick={e => { e.stopPropagation(); handleToggleUni(uni); }}
                    >
                      {uni.activo ? <IconoOjoOff /> : <IconoOjo />}
                    </button>
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
                Los gerentes podrán subir documentos de su unidad únicamente dentro del intervalo
                indicado. Fuera de ese rango la ventana quedará cerrada automáticamente.
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

      {/* ── Modal de alta / edición de unidad ─────────── */}
      {modalUni && (
        <div
          className={styles.overlayProg}
          onMouseDown={e => e.target === e.currentTarget && cerrarModalUni()}
        >
          <div className={styles.modalProg}>
            <div className={styles.modalProgHeader}>
              <h2 className={styles.modalProgTitulo}>
                {modoUni === 'crear' ? 'Nueva unidad' : 'Editar unidad'}
              </h2>
              <button className={styles.modalProgCerrar} onClick={cerrarModalUni} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            <div className={styles.modalProgCuerpo}>
              <p className={styles.modalProgDesc}>
                Una unidad es una cocina o sucursal. Su nombre la identifica en asistencias,
                empleados y documentación.
              </p>

              <div className={styles.campoProg}>
                <label className={styles.etiquetaProg}>Nombre de la unidad *</label>
                <input
                  type="text"
                  className={styles.inputTexto}
                  placeholder="Ej. Cocina Centro"
                  value={formUni.nombre}
                  onChange={e => setFormUni(p => ({ ...p, nombre: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && !guardandoUni && handleGuardarUni()}
                  maxLength={150}
                  disabled={guardandoUni}
                  autoFocus
                />
                <span className={styles.inputHintProv}>Debe ser único en el sistema.</span>
              </div>

              <div className={styles.campoProg}>
                <label className={styles.etiquetaProg}>Días laborales *</label>
                <div className={styles.diasSelector}>
                  {DIAS_LABORALES.map(d => (
                    <button
                      key={d.iso}
                      type="button"
                      className={`${styles.diaChip} ${formUni.dias.includes(d.iso) ? styles.diaChipActivo : ''}`}
                      onClick={() => toggleDiaUni(d.iso)}
                      disabled={guardandoUni}
                      aria-pressed={formUni.dias.includes(d.iso)}
                    >
                      {d.corta}
                    </button>
                  ))}
                </div>
                <span className={styles.inputHintProv}>
                  Marca los días en que opera la unidad. Los días sin registro ni justificación
                  se contarán como falta en el resumen de asistencias.
                </span>
              </div>
            </div>

            <div className={styles.modalProgPie}>
              <button className={styles.btnCancelarProg} onClick={cerrarModalUni} disabled={guardandoUni}>
                Cancelar
              </button>
              <button className={styles.btnGuardarProg} onClick={handleGuardarUni} disabled={guardandoUni}>
                {guardandoUni
                  ? <span className={styles.spinnerBtn} />
                  : (modoUni === 'crear' ? 'Agregar unidad' : 'Guardar cambios')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
