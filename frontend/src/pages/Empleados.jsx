import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Empleados.module.css';

/* ── Iconos SVG inline ─────────────────────────────────── */
function IconoMas() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconoLapiz() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconoOjo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconoBusqueda() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconoCerrar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ── Helpers ────────────────────────────────────────────── */
function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const FORM_VACIO = { nombre: '', lector_uid: '', sucursal_id: '' };

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

/* ── Componente principal ───────────────────────────────── */
export default function Empleados() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  // Datos
  const [empleados, setEmpleados]   = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando]     = useState(true);

  // Filtros
  const [busqueda, setBusqueda]           = useState('');
  const [filtroEstado, setFiltroEstado]   = useState('todos');
  const [filtroSucursal, setFiltroSucursal] = useState('');

  // Modal
  const [modalAbierto, setModalAbierto]             = useState(false);
  const [modoModal, setModoModal]                   = useState('crear');
  const [empleadoEditando, setEmpleadoEditando]     = useState(null);
  const [form, setForm]                             = useState(FORM_VACIO);
  const [guardando, setGuardando]                   = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [resE, resS] = await Promise.all([
        api.get('/empleados'),
        api.get('/sucursales'),
      ]);
      setEmpleados(resE.data);
      setSucursales(resS.data);
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar',
        text: 'No se pudieron obtener los datos. Verifica la conexión.',
        confirmButtonColor: '#E8621A',
      });
    } finally {
      setCargando(false);
    }
  }

  /* ── Filtrado reactivo ─────────────────────────────── */
  const empleadosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return empleados.filter(emp => {
      const coincideTexto =
        q === '' ||
        emp.nombre.toLowerCase().includes(q) ||
        emp.lector_uid.toLowerCase().includes(q);
      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && emp.activo) ||
        (filtroEstado === 'inactivos' && !emp.activo);
      const coincideSucursal =
        filtroSucursal === '' || emp.sucursal_id === parseInt(filtroSucursal);
      return coincideTexto && coincideEstado && coincideSucursal;
    });
  }, [empleados, busqueda, filtroEstado, filtroSucursal]);

  /* ── Abrir modal ───────────────────────────────────── */
  function abrirCrear() {
    setModoModal('crear');
    setEmpleadoEditando(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  }

  function abrirEditar(emp) {
    setModoModal('editar');
    setEmpleadoEditando(emp);
    setForm({
      nombre: emp.nombre,
      lector_uid: emp.lector_uid,
      sucursal_id: String(emp.sucursal_id),
    });
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalAbierto(false);
    setEmpleadoEditando(null);
    setForm(FORM_VACIO);
  }

  /* ── Guardar (crear o editar) ──────────────────────── */
  async function handleGuardar() {
    const { nombre, lector_uid, sucursal_id } = form;
    if (!nombre.trim() || !lector_uid.trim() || !sucursal_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Completa todos los campos requeridos.',
        confirmButtonColor: '#E8621A',
      });
      return;
    }

    setGuardando(true);
    const payload = {
      nombre: nombre.trim(),
      lector_uid: lector_uid.trim(),
      sucursal_id,
    };

    try {
      if (modoModal === 'crear') {
        const res = await api.post('/empleados', payload);
        setEmpleados(prev =>
          [res.data, ...prev].sort((a, b) =>
            Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre)
          )
        );
      } else {
        const res = await api.put(`/empleados/${empleadoEditando.id}`, payload);
        setEmpleados(prev => prev.map(e => (e.id === res.data.id ? res.data : e)));
      }
      cerrarModal();
      Swal.fire({
        icon: 'success',
        title: modoModal === 'crear' ? 'Empleado creado' : 'Cambios guardados',
        timer: 1400,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (e) {
      const msg = e.response?.data?.error || 'Ocurrió un error al guardar.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardando(false);
    }
  }

  /* ── Toggle activo ─────────────────────────────────── */
  async function handleToggle(emp) {
    const accion = emp.activo ? 'desactivar' : 'activar';
    const result = await Swal.fire({
      title: `¿${emp.activo ? 'Desactivar' : 'Activar'} empleado?`,
      text: `${emp.nombre} será ${emp.activo ? 'dado de baja' : 'reactivado'} en el sistema.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: emp.activo ? '#D93025' : '#2E7D32',
      cancelButtonColor: '#9E9892',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await api.patch(`/empleados/${emp.id}/activo`);
      setEmpleados(prev => prev.map(e => (e.id === res.data.id ? res.data : e)));
      Swal.fire({
        icon: 'success',
        title: `Empleado ${emp.activo ? 'desactivado' : 'activado'}`,
        timer: 1200,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cambiar el estado del empleado.',
        confirmButtonColor: '#E8621A',
      });
    }
  }

  /* ── Logout ────────────────────────────────────────── */
  async function handleLogout() {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Se cerrará tu sesión actual.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#E8621A',
      cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
      logout();
      navigate('/login', { replace: true });
    }
  }

  /* ── Render ────────────────────────────────────────── */
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
          <button className={styles.botonSalir} onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className={styles.contenido}>

        {/* Encabezado de página */}
        <div className={styles.paginaHeader}>
          <div>
            <h1 className={styles.tituloPagina}>Empleados</h1>
            <p className={styles.subtituloPagina}>Alta, edición y baja de empleados del sistema</p>
          </div>
          <button className={styles.botonCrear} onClick={abrirCrear}>
            <IconoMas />
            Nuevo empleado
          </button>
        </div>

        {/* Filtros */}
        <div className={styles.filtros}>
          <div className={styles.campoBusqueda}>
            <span className={styles.iconoBusqueda}>
              <IconoBusqueda />
            </span>
            <input
              type="text"
              className={styles.inputBusqueda}
              placeholder="Buscar por nombre o UID..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className={styles.selectFiltro}
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </select>

          <select
            className={styles.selectFiltro}
            value={filtroSucursal}
            onChange={e => setFiltroSucursal(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th className={styles.colId}>#</th>
                <th>Nombre</th>
                <th>UID Lector</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th className={styles.thAcciones}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="7" className={styles.estadoTabla}>
                    <div className={styles.cargandoSpinner} />
                    Cargando empleados...
                  </td>
                </tr>
              ) : empleadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.estadoTabla}>
                    No se encontraron empleados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                empleadosFiltrados.map(emp => (
                  <tr key={emp.id} className={!emp.activo ? styles.filaInactiva : ''}>
                    <td className={styles.colId}>{emp.id}</td>
                    <td className={styles.colNombre}>{emp.nombre}</td>
                    <td>
                      <span className={styles.colUid}>{emp.lector_uid}</span>
                    </td>
                    <td>{emp.sucursal?.nombre ?? '—'}</td>
                    <td>
                      <span className={emp.activo ? styles.badgeActivo : styles.badgeInactivo}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className={styles.colFecha}>{formatFecha(emp.creado_en)}</td>
                    <td className={styles.colAcciones}>
                      <div className={styles.acciones}>
                        <button
                          className={styles.btnEditar}
                          onClick={() => abrirEditar(emp)}
                          title="Editar empleado"
                        >
                          <IconoLapiz />
                        </button>
                        <button
                          className={emp.activo ? styles.btnDesactivar : styles.btnActivar}
                          onClick={() => handleToggle(emp)}
                          title={emp.activo ? 'Desactivar empleado' : 'Activar empleado'}
                        >
                          {emp.activo ? <IconoOjoOff /> : <IconoOjo />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!cargando && empleados.length > 0 && (
            <p className={styles.pieTabla}>
              Mostrando{' '}
              <strong>{empleadosFiltrados.length}</strong>{' '}
              de{' '}
              <strong>{empleados.length}</strong>{' '}
              empleados
            </p>
          )}
        </div>
      </main>

      <Footer />

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div
          className={styles.overlay}
          onMouseDown={e => e.target === e.currentTarget && cerrarModal()}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>
                {modoModal === 'crear' ? 'Nuevo empleado' : 'Editar empleado'}
              </h2>
              <button
                className={styles.modalCerrar}
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                <IconoCerrar />
              </button>
            </div>

            <div className={styles.modalCuerpo}>
              <div className={styles.campo}>
                <label className={styles.etiqueta}>Nombre completo *</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Ej. Juan Pérez López"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  disabled={guardando}
                  autoFocus
                />
              </div>

              <div className={styles.campo}>
                <label className={styles.etiqueta}>UID del lector *</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Ej. UID013"
                  value={form.lector_uid}
                  onChange={e => setForm(p => ({ ...p, lector_uid: e.target.value }))}
                  disabled={guardando}
                />
                <span className={styles.inputHint}>
                  Identificador único del checador físico. Debe ser irrepetible.
                </span>
              </div>

              <div className={styles.campo}>
                <label className={styles.etiqueta}>Sucursal *</label>
                <select
                  className={styles.input}
                  value={form.sucursal_id}
                  onChange={e => setForm(p => ({ ...p, sucursal_id: e.target.value }))}
                  disabled={guardando}
                >
                  <option value="">— Seleccionar sucursal —</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.modalPie}>
              <button
                className={styles.btnCancelar}
                onClick={cerrarModal}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                className={styles.btnGuardar}
                onClick={handleGuardar}
                disabled={guardando}
              >
                {guardando
                  ? <span className={styles.spinnerBtn} />
                  : modoModal === 'crear' ? 'Crear empleado' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
