import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Usuarios.module.css';

/* ── Iconos SVG inline ─────────────────────────────────── */
function IconoMas() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
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
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconoCerrar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconoRefrescar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
// Llave (administrador) — llave maestra
function IconoLlave() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
// Solideo/gorro (gerente) — supervisión de cocina
function IconoSupervisor() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
// Caja (proveedor) — abastecimiento
function IconoCaja() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function IconoSucursal() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" /><line x1="9" y1="9" x2="9" y2="9.01" /><line x1="9" y1="13" x2="9" y2="13.01" />
    </svg>
  );
}

/* ── Metadatos por rol ─────────────────────────────────── */
const ROLES_META = {
  administrador: { etiqueta: 'Administrador', Icono: IconoLlave, avatar: styles.avatarAdmin, badge: styles.rolAdmin, activo: styles.rolActivoAdmin, resIcono: styles.resumenIconoAdmin, resCard: styles.resumenAdmin },
  gerente:       { etiqueta: 'Gerente',       Icono: IconoSupervisor, avatar: styles.avatarGerente, badge: styles.rolGerente, activo: styles.rolActivoGerente, resIcono: styles.resumenIconoGerente, resCard: styles.resumenGerente },
  proveedor:     { etiqueta: 'Proveedor',     Icono: IconoCaja, avatar: styles.avatarProveedor, badge: styles.rolProveedor, activo: styles.rolActivoProveedor, resIcono: styles.resumenIconoProveedor, resCard: styles.resumenProveedor },
};
const ORDEN_ROLES = ['administrador', 'gerente', 'proveedor'];

/* ── Helpers ────────────────────────────────────────────── */
function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Genera una contraseña legible y razonablemente fuerte para el alta.
function generarPassword() {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const min = 'abcdefghijkmnpqrstuvwxyz';
  const num = '23456789';
  const sim = '!@#$%&*';
  const todos = may + min + num + sim;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  let out = pick(may) + pick(min) + pick(num) + pick(sim);
  for (let i = 0; i < 6; i++) out += pick(todos);
  return out.split('').sort(() => Math.random() - 0.5).join('');
}

const FORM_VACIO = { nombre: '', email: '', password: '', rol: '', sucursal_id: '', proveedor_id: '' };

/* ── Componente principal ───────────────────────────────── */
export default function Usuarios() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const [usuarios, setUsuarios]     = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando]     = useState(true);

  const [busqueda, setBusqueda]         = useState('');
  const [filtroRol, setFiltroRol]       = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [modalAbierto, setModalAbierto]   = useState(false);
  const [modoModal, setModoModal]         = useState('crear');
  const [editando, setEditando]           = useState(null);
  const [form, setForm]                   = useState(FORM_VACIO);
  const [verPassword, setVerPassword]     = useState(false);
  const [guardando, setGuardando]         = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [resU, resS, resP] = await Promise.all([
        api.get('/usuarios'),
        api.get('/sucursales'),
        api.get('/proveedores'),
      ]);
      setUsuarios(resU.data);
      setSucursales(resS.data);
      setProveedores(Array.isArray(resP.data) ? resP.data : []);
    } catch {
      Swal.fire({ icon: 'error', title: 'Error al cargar', text: 'No se pudieron obtener los datos. Verifica la conexión.', confirmButtonColor: '#E8621A' });
    } finally {
      setCargando(false);
    }
  }

  /* ── Conteo por rol (solo activos) ─────────────────── */
  const conteoRoles = useMemo(() => {
    const c = { administrador: 0, gerente: 0, proveedor: 0 };
    usuarios.forEach(u => { if (u.activo) c[u.rol] = (c[u.rol] || 0) + 1; });
    return c;
  }, [usuarios]);

  /* ── Filtrado ──────────────────────────────────────── */
  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return usuarios.filter(u => {
      const texto = q === '' || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const rol = filtroRol === '' || u.rol === filtroRol;
      const estado = filtroEstado === 'todos' || (filtroEstado === 'activos' && u.activo) || (filtroEstado === 'inactivos' && !u.activo);
      return texto && rol && estado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  /* ── Modal ─────────────────────────────────────────── */
  function abrirCrear() {
    setModoModal('crear');
    setEditando(null);
    setForm(FORM_VACIO);
    setVerPassword(false);
    setModalAbierto(true);
  }

  function abrirEditar(u) {
    setModoModal('editar');
    setEditando(u);
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol,
      sucursal_id: u.sucursal_id ? String(u.sucursal_id) : '',
      proveedor_id: u.proveedor_id ? String(u.proveedor_id) : '',
    });
    setVerPassword(false);
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_VACIO);
  }

  // Cambiar de rol limpia el alcance que no aplica.
  function elegirRol(rol) {
    setForm(p => ({ ...p, rol, sucursal_id: rol === 'gerente' ? p.sucursal_id : '', proveedor_id: rol === 'proveedor' ? p.proveedor_id : '' }));
  }

  function handleGenerar() {
    const nueva = generarPassword();
    setForm(p => ({ ...p, password: nueva }));
    setVerPassword(true);
  }

  /* ── Guardar ───────────────────────────────────────── */
  async function handleGuardar() {
    const { nombre, email, password, rol, sucursal_id, proveedor_id } = form;

    if (!nombre.trim() || !email.trim() || !rol) {
      return Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Nombre, correo y rol son obligatorios.', confirmButtonColor: '#E8621A' });
    }
    if (modoModal === 'crear' && password.length < 8) {
      return Swal.fire({ icon: 'warning', title: 'Contraseña débil', text: 'La contraseña debe tener al menos 8 caracteres.', confirmButtonColor: '#E8621A' });
    }
    if (rol === 'gerente' && !sucursal_id) {
      return Swal.fire({ icon: 'warning', title: 'Falta la sucursal', text: 'Un gerente debe tener una sucursal asignada.', confirmButtonColor: '#E8621A' });
    }
    if (rol === 'proveedor' && !proveedor_id) {
      return Swal.fire({ icon: 'warning', title: 'Falta el proveedor', text: 'Un proveedor debe tener un perfil asignado.', confirmButtonColor: '#E8621A' });
    }

    const payload = { nombre: nombre.trim(), email: email.trim(), rol, sucursal_id, proveedor_id };
    if (password) payload.password = password;

    setGuardando(true);
    try {
      if (modoModal === 'crear') {
        const res = await api.post('/usuarios', payload);
        setUsuarios(prev => [...prev, res.data].sort(ordenarUsuarios));
      } else {
        const res = await api.put(`/usuarios/${editando.id}`, payload);
        setUsuarios(prev => prev.map(u => (u.id === res.data.id ? res.data : u)).sort(ordenarUsuarios));
      }
      cerrarModal();
      Swal.fire({ icon: 'success', title: modoModal === 'crear' ? 'Usuario creado' : 'Cambios guardados', timer: 1400, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error || 'Ocurrió un error al guardar.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardando(false);
    }
  }

  /* ── Toggle activo ─────────────────────────────────── */
  async function handleToggle(u) {
    if (u.id === usuario?.id) {
      return Swal.fire({ icon: 'info', title: 'Acción no permitida', text: 'No puedes desactivar tu propia cuenta.', confirmButtonColor: '#E8621A' });
    }
    const accion = u.activo ? 'desactivar' : 'activar';
    const result = await Swal.fire({
      title: `¿${u.activo ? 'Revocar acceso' : 'Restaurar acceso'}?`,
      html: u.activo
        ? `<b>${u.nombre}</b> ya no podrá iniciar sesión en el sistema.`
        : `<b>${u.nombre}</b> volverá a tener acceso al sistema.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: u.activo ? '#D93025' : '#2E7D32',
      cancelButtonColor: '#9E9892',
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
      const res = await api.patch(`/usuarios/${u.id}/activo`);
      setUsuarios(prev => prev.map(x => (x.id === res.data.id ? res.data : x)).sort(ordenarUsuarios));
      Swal.fire({ icon: 'success', title: u.activo ? 'Acceso revocado' : 'Acceso restaurado', timer: 1200, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo cambiar el estado del usuario.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    }
  }

  /* ── Logout ────────────────────────────────────────── */
  async function handleLogout() {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?', text: 'Se cerrará tu sesión actual.', icon: 'question',
      showCancelButton: true, confirmButtonColor: '#E8621A', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) { logout(); navigate('/login', { replace: true }); }
  }

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        <div className={styles.marca}>
          <LogoInicio className={styles.logoSmall} />
          <span className={styles.appNombre}>Sistema de Gestión</span>
        </div>
        <div className={styles.usuario}>
          <div className={styles.infoUsuario}>
            <span className={styles.nombreUsuario}>{usuario?.nombre}</span>
            <span className={styles.rolBadge}>Administrador</span>
          </div>
          <button className={styles.botonSalir} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.contenido}>
        <div className={styles.paginaHeader}>
          <div>
            <h1 className={styles.tituloPagina}>Usuarios</h1>
            <p className={styles.subtituloPagina}>Accesos al sistema: roles, alcance y credenciales</p>
          </div>
          <button className={styles.botonCrear} onClick={abrirCrear}>
            <IconoMas /> Nuevo usuario
          </button>
        </div>

        {/* Resumen por rol */}
        <div className={styles.resumen}>
          {ORDEN_ROLES.map(rol => {
            const meta = ROLES_META[rol];
            const { Icono } = meta;
            return (
              <div key={rol} className={`${styles.resumenCard} ${meta.resCard}`}>
                <div className={`${styles.resumenIcono} ${meta.resIcono}`}><Icono /></div>
                <div>
                  <div className={styles.resumenNumero}>{conteoRoles[rol]}</div>
                  <div className={styles.resumenEtiqueta}>{meta.etiqueta}{conteoRoles[rol] === 1 ? '' : 'es'} activo{conteoRoles[rol] === 1 ? '' : 's'}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className={styles.filtros}>
          <div className={styles.campoBusqueda}>
            <span className={styles.iconoBusqueda}><IconoBusqueda /></span>
            <input type="text" className={styles.inputBusqueda} placeholder="Buscar por nombre o correo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className={styles.selectFiltro} value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="administrador">Administradores</option>
            <option value="gerente">Gerentes</option>
            <option value="proveedor">Proveedores</option>
          </select>
          <select className={styles.selectFiltro} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="activos">Con acceso</option>
            <option value="inactivos">Revocados</option>
          </select>
        </div>

        {/* Tabla */}
        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Alcance</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th className={styles.thAcciones}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan="6" className={styles.estadoTabla}><div className={styles.cargandoSpinner} />Cargando usuarios...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan="6" className={styles.estadoTabla}>No se encontraron usuarios con los filtros aplicados.</td></tr>
              ) : (
                filtrados.map(u => {
                  const meta = ROLES_META[u.rol] || ROLES_META.administrador;
                  const esYo = u.id === usuario?.id;
                  return (
                    <tr key={u.id} className={!u.activo ? styles.filaInactiva : ''}>
                      <td>
                        <div className={styles.identidad}>
                          <div className={`${styles.avatar} ${meta.avatar}`}>{iniciales(u.nombre)}</div>
                          <div className={styles.identidadTexto}>
                            <span className={styles.identidadNombre}>
                              {u.nombre}
                              {esYo && <span className={styles.tuChip}>Tú</span>}
                            </span>
                            <span className={styles.identidadEmail}>{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.badgeRol} ${meta.badge}`}>{meta.etiqueta}</span>
                      </td>
                      <td>
                        {u.rol === 'gerente' && u.sucursal ? (
                          <span className={styles.alcance}>
                            <span className={styles.alcanceIcono}><IconoSucursal /></span>
                            <span className={styles.alcanceTexto}>{u.sucursal.nombre}</span>
                          </span>
                        ) : u.rol === 'proveedor' && u.proveedor ? (
                          <span className={styles.alcance}>
                            <span className={styles.alcanceIcono}><IconoCaja /></span>
                            <span className={styles.alcanceTexto}>{u.proveedor.nombre}</span>
                          </span>
                        ) : (
                          <span className={styles.alcanceVacio}>Acceso total</span>
                        )}
                      </td>
                      <td>
                        <span className={u.activo ? styles.badgeActivo : styles.badgeInactivo}>
                          {u.activo ? 'Con acceso' : 'Revocado'}
                        </span>
                      </td>
                      <td className={styles.colFecha}>{formatFecha(u.creado_en)}</td>
                      <td className={styles.colAcciones}>
                        <div className={styles.acciones}>
                          <button className={styles.btnEditar} onClick={() => abrirEditar(u)} title="Editar usuario"><IconoLapiz /></button>
                          <button
                            className={u.activo ? styles.btnDesactivar : styles.btnActivar}
                            onClick={() => handleToggle(u)}
                            disabled={esYo}
                            title={esYo ? 'No puedes desactivar tu propia cuenta' : u.activo ? 'Revocar acceso' : 'Restaurar acceso'}
                          >
                            {u.activo ? <IconoOjoOff /> : <IconoOjo />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {!cargando && usuarios.length > 0 && (
            <p className={styles.pieTabla}>
              Mostrando <strong>{filtrados.length}</strong> de <strong>{usuarios.length}</strong> usuarios
            </p>
          )}
        </div>
      </main>

      <Footer />

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className={styles.overlay} onMouseDown={e => e.target === e.currentTarget && cerrarModal()}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>{modoModal === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
              <button className={styles.modalCerrar} onClick={cerrarModal} aria-label="Cerrar"><IconoCerrar /></button>
            </div>

            <div className={styles.modalCuerpo}>
              <div className={styles.campo}>
                <label className={styles.etiqueta}>Nombre completo *</label>
                <input className={styles.input} type="text" placeholder="Ej. Laura Méndez Ríos"
                  value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} disabled={guardando} autoFocus />
              </div>

              <div className={styles.campo}>
                <label className={styles.etiqueta}>Correo electrónico *</label>
                <input className={styles.input} type="email" placeholder="usuario@lallar.com"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={guardando} />
                <span className={styles.inputHint}>Será su identificador para iniciar sesión.</span>
              </div>

              {/* Selector segmentado de rol */}
              <div className={styles.campo}>
                <label className={styles.etiqueta}>Rol de acceso *</label>
                <div className={styles.rolSelector}>
                  {ORDEN_ROLES.map(rol => {
                    const meta = ROLES_META[rol];
                    const { Icono } = meta;
                    const activo = form.rol === rol;
                    return (
                      <button key={rol} type="button" disabled={guardando}
                        className={`${styles.rolOpcion} ${activo ? meta.activo : ''}`}
                        onClick={() => elegirRol(rol)}>
                        <span className={styles.rolOpcionIcono}><Icono /></span>
                        <span className={styles.rolOpcionTexto}>{meta.etiqueta}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alcance condicional */}
              {form.rol === 'gerente' && (
                <div className={`${styles.campo} ${styles.alcanceCampo}`}>
                  <label className={styles.etiqueta}>Sucursal asignada *</label>
                  <select className={styles.input} value={form.sucursal_id}
                    onChange={e => setForm(p => ({ ...p, sucursal_id: e.target.value }))} disabled={guardando}>
                    <option value="">— Seleccionar sucursal —</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <span className={styles.inputHint}>El gerente solo verá y operará sobre esta cocina.</span>
                </div>
              )}

              {form.rol === 'proveedor' && (
                <div className={`${styles.campo} ${styles.alcanceCampo}`}>
                  <label className={styles.etiqueta}>Perfil de proveedor *</label>
                  <select className={styles.input} value={form.proveedor_id}
                    onChange={e => setForm(p => ({ ...p, proveedor_id: e.target.value }))} disabled={guardando}>
                    <option value="">— Seleccionar proveedor —</option>
                    {proveedores.map(pr => <option key={pr.id} value={pr.id}>{pr.nombre}</option>)}
                  </select>
                  <span className={styles.inputHint}>El usuario solo verá y operará sobre este perfil.</span>
                </div>
              )}

              {/* Contraseña */}
              <div className={styles.campo}>
                <label className={styles.etiqueta}>
                  {modoModal === 'crear' ? 'Contraseña inicial *' : 'Restablecer contraseña'}
                </label>
                <div className={styles.passwordFila}>
                  <div className={styles.passwordWrap}>
                    <input className={styles.input} type={verPassword ? 'text' : 'password'}
                      placeholder={modoModal === 'crear' ? 'Mínimo 8 caracteres' : 'Dejar en blanco para conservar'}
                      value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      disabled={guardando} autoComplete="new-password" />
                    <button type="button" className={styles.togglePassword} onClick={() => setVerPassword(v => !v)}
                      title={verPassword ? 'Ocultar' : 'Mostrar'} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                      {verPassword ? <IconoOjoOff /> : <IconoOjo />}
                    </button>
                  </div>
                  <button type="button" className={styles.btnGenerar} onClick={handleGenerar} disabled={guardando} title="Generar contraseña segura">
                    <IconoRefrescar /> Generar
                  </button>
                </div>
                <span className={styles.inputHint}>
                  {modoModal === 'crear'
                    ? 'Compártela de forma segura; el usuario podrá usarla al iniciar sesión.'
                    : 'Solo se cambia si escribes una nueva. En blanco conserva la actual.'}
                </span>
              </div>
            </div>

            <div className={styles.modalPie}>
              <button className={styles.btnCancelar} onClick={cerrarModal} disabled={guardando}>Cancelar</button>
              <button className={styles.btnGuardar} onClick={handleGuardar} disabled={guardando}>
                {guardando ? <span className={styles.spinnerBtn} /> : modoModal === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Orden: con acceso primero, luego por rol (admin→gerente→proveedor), luego nombre. */
function ordenarUsuarios(a, b) {
  if (a.activo !== b.activo) return Number(b.activo) - Number(a.activo);
  const ra = ORDEN_ROLES.indexOf(a.rol), rb = ORDEN_ROLES.indexOf(b.rol);
  if (ra !== rb) return ra - rb;
  return a.nombre.localeCompare(b.nombre);
}
