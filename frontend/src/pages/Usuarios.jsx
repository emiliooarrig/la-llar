import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import TablaDatos from '../components/TablaDatos';
import BarraFiltros from '../components/BarraFiltros';
import Modal from '../components/Modal';
import Insignia from '../components/Insignia';
import Campo from '../components/Campo';
import {
  IconoMas, IconoLapiz, IconoOjo, IconoOjoOff, IconoUsuarios, IconoUsuario,
  IconoCaja, IconoSucursal, IconoAlerta,
} from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { iniciales, formatFecha, normalizar } from '../lib/formato';
import { confirmar, toast, avisoError } from '../lib/alertas';
import styles from './Usuarios.module.css';

const ORDEN_ROLES = ['administrador', 'gerente', 'proveedor'];
const ROLES_META = {
  administrador: { etiqueta: 'Administrador', plural: 'Administradores', Icono: IconoUsuarios, insignia: 'naranja', censo: styles.censoAdmin },
  gerente:       { etiqueta: 'Gerente',       plural: 'Gerentes',        Icono: IconoUsuario,  insignia: 'acero',   censo: styles.censoGerente },
  proveedor:     { etiqueta: 'Proveedor',     plural: 'Proveedores',     Icono: IconoCaja,     insignia: 'exito',   censo: styles.censoProveedor },
};

const FORM_VACIO = { nombre: '', email: '', password: '', rol: '', sucursal_id: '', proveedor_id: '' };
const FILTROS_BASE = { q: '', rol: '', estado: 'todos' };

// Contraseña legible y razonablemente fuerte para el alta (sin caracteres ambiguos).
function generarPassword() {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const min = 'abcdefghijkmnpqrstuvwxyz';
  const num = '23456789';
  const sim = '!@#$%&*';
  const todos = may + min + num + sim;
  const pick = set => set[Math.floor(Math.random() * set.length)];
  let out = pick(may) + pick(min) + pick(num) + pick(sim);
  for (let i = 0; i < 6; i++) out += pick(todos);
  return out.split('').sort(() => Math.random() - 0.5).join('');
}

/* Orden base: con acceso primero, luego por rol, luego nombre. */
function ordenarUsuarios(a, b) {
  if (a.activo !== b.activo) return Number(b.activo) - Number(a.activo);
  const ra = ORDEN_ROLES.indexOf(a.rol);
  const rb = ORDEN_ROLES.indexOf(b.rol);
  if (ra !== rb) return ra - rb;
  return a.nombre.localeCompare(b.nombre, 'es');
}

function validar(form, modo) {
  const e = {};
  if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  if (!form.email.trim()) e.email = 'El correo es obligatorio.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'El formato del correo no es válido.';
  if (!form.rol) e.rol = 'Elige el rol de acceso.';
  if (modo === 'crear' && form.password.length < 8) e.password = 'Mínimo 8 caracteres.';
  else if (modo === 'editar' && form.password && form.password.length < 8) e.password = 'Mínimo 8 caracteres.';
  if (form.rol === 'gerente' && !form.sucursal_id) e.sucursal_id = 'Un gerente necesita una sucursal asignada.';
  if (form.rol === 'proveedor' && !form.proveedor_id) e.proveedor_id = 'Un proveedor necesita un perfil asignado.';
  return e;
}

export default function Usuarios() {
  const { usuario } = useAuth();
  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);   // null | { modo, editando }
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [verPassword, setVerPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [u, s, p] = await Promise.all([
        api.get('/usuarios'),
        api.get('/sucursales'),
        api.get('/proveedores'),
      ]);
      setUsuarios([...u.data].sort(ordenarUsuarios));
      setSucursales(s.data);
      setProveedores(Array.isArray(p.data) ? p.data : []);
    } catch {
      setError('No se pudieron obtener los usuarios. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  const conteo = useMemo(() => {
    const c = { total: 0, administrador: 0, gerente: 0, proveedor: 0 };
    usuarios.forEach(u => {
      if (!u.activo) return;
      c.total += 1;
      c[u.rol] = (c[u.rol] || 0) + 1;
    });
    return c;
  }, [usuarios]);

  const filtrados = useMemo(() => {
    const q = normalizar(filtros.q);
    return usuarios.filter(u => {
      const texto = !q || normalizar(u.nombre).includes(q) || normalizar(u.email).includes(q);
      const rol = !filtros.rol || u.rol === filtros.rol;
      const estado = filtros.estado === 'todos'
        || (filtros.estado === 'activos' && u.activo)
        || (filtros.estado === 'inactivos' && !u.activo);
      return texto && rol && estado;
    });
  }, [usuarios, filtros]);

  /* ── Modal ──────────────────────────────────────────────── */
  function abrirCrear() {
    setForm(FORM_VACIO);
    setErrores({});
    setVerPassword(false);
    setModal({ modo: 'crear', editando: null });
  }

  function abrirEditar(u) {
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol,
      sucursal_id: u.sucursal_id ? String(u.sucursal_id) : '',
      proveedor_id: u.proveedor_id ? String(u.proveedor_id) : '',
    });
    setErrores({});
    setVerPassword(false);
    setModal({ modo: 'editar', editando: u });
  }

  function cambiar(campo, valor) {
    setForm(p => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: undefined }));
  }

  // Cambiar de rol limpia el alcance que ya no aplica.
  function elegirRol(rol) {
    setForm(p => ({
      ...p,
      rol,
      sucursal_id: rol === 'gerente' ? p.sucursal_id : '',
      proveedor_id: rol === 'proveedor' ? p.proveedor_id : '',
    }));
    setErrores(p => ({ ...p, rol: undefined }));
  }

  async function guardar(e) {
    e.preventDefault();
    const fallos = validar(form, modal.modo);
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      rol: form.rol,
      sucursal_id: form.sucursal_id,
      proveedor_id: form.proveedor_id,
    };
    if (form.password) payload.password = form.password;

    setGuardando(true);
    try {
      if (modal.modo === 'crear') {
        const { data } = await api.post('/usuarios', payload);
        setUsuarios(prev => [...prev, data].sort(ordenarUsuarios));
      } else {
        const { data } = await api.put(`/usuarios/${modal.editando.id}`, payload);
        setUsuarios(prev => prev.map(u => (u.id === data.id ? data : u)).sort(ordenarUsuarios));
      }
      setModal(null);
      toast(modal.modo === 'crear' ? 'Usuario creado' : 'Cambios guardados');
    } catch (err) {
      const mensaje = err.response?.data?.error || 'Ocurrió un error al guardar.';
      /* El conflicto más común es el correo repetido: se ancla al campo. */
      if (/correo|email/i.test(mensaje)) setErrores({ email: mensaje });
      else await avisoError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  /* Revocar el acceso sí es una decisión con consecuencias para otra
     persona: es de las pocas que conserva confirmación. */
  async function alternarAcceso(u) {
    const ok = await confirmar({
      titulo: u.activo ? '¿Revocar el acceso?' : '¿Restaurar el acceso?',
      texto: u.activo
        ? `${u.nombre} dejará de poder iniciar sesión. Su historial se conserva.`
        : `${u.nombre} volverá a poder iniciar sesión con sus credenciales.`,
      confirmar: u.activo ? 'Revocar acceso' : 'Restaurar acceso',
      destructivo: u.activo,
    });
    if (!ok) return;

    try {
      const { data } = await api.patch(`/usuarios/${u.id}/activo`);
      setUsuarios(prev => prev.map(x => (x.id === data.id ? data : x)).sort(ordenarUsuarios));
      toast(u.activo ? 'Acceso revocado' : 'Acceso restaurado');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo cambiar el estado del usuario.');
    }
  }

  /* ── Columnas ───────────────────────────────────────────── */
  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Usuario',
      orden: u => u.nombre,
      clase: 'celda-elastica',
      render: u => (
        <div className={styles.identidad}>
          <span className={`${styles.avatar} ${styles[`avatar${u.rol.charAt(0).toUpperCase()}${u.rol.slice(1)}`]}`}>
            {iniciales(u.nombre)}
          </span>
          <span className={styles.identidadTexto}>
            <span className={styles.identidadNombre}>
              {u.nombre}
              {u.id === usuario?.id && <span className={styles.tuChip}>Tú</span>}
            </span>
            <span className={styles.identidadCorreo}>{u.email}</span>
          </span>
        </div>
      ),
    },
    {
      clave: 'rol',
      titulo: 'Rol',
      orden: u => ORDEN_ROLES.indexOf(u.rol),
      render: u => <Insignia tono={ROLES_META[u.rol]?.insignia}>{ROLES_META[u.rol]?.etiqueta}</Insignia>,
    },
    {
      clave: 'alcance',
      titulo: 'Alcance',
      render: u =>
        u.rol === 'gerente' && u.sucursal ? (
          <span className={styles.alcance}><IconoSucursal tamano={13} />{u.sucursal.nombre}</span>
        ) : u.rol === 'proveedor' && u.proveedor ? (
          <span className={styles.alcance}><IconoCaja tamano={13} />{u.proveedor.nombre}</span>
        ) : (
          <span className={styles.alcanceVacio}>Todo el sistema</span>
        ),
    },
    {
      clave: 'activo',
      titulo: 'Estado',
      orden: u => Number(u.activo),
      render: u => <Insignia tono={u.activo ? 'exito' : 'error'}>{u.activo ? 'Con acceso' : 'Revocado'}</Insignia>,
    },
    {
      clave: 'creado_en',
      titulo: 'Alta',
      orden: u => u.creado_en,
      clase: 'col-fecha',
      render: u => formatFecha(u.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: u => {
        const esYo = u.id === usuario?.id;
        return (
          <span className="acciones-fila">
            <button
              type="button" className="btn-icono tono-naranja"
              onClick={() => abrirEditar(u)}
              title="Editar usuario" aria-label={`Editar ${u.nombre}`}
            >
              <IconoLapiz />
            </button>
            <button
              type="button"
              className={`btn-icono ${u.activo ? 'tono-error' : 'tono-exito'}`}
              onClick={() => alternarAcceso(u)}
              disabled={esYo}
              title={esYo ? 'No puedes revocar tu propia cuenta' : u.activo ? 'Revocar acceso' : 'Restaurar acceso'}
              aria-label={`${u.activo ? 'Revocar' : 'Restaurar'} el acceso de ${u.nombre}`}
            >
              {u.activo ? <IconoOjoOff /> : <IconoOjo />}
            </button>
          </span>
        );
      },
    },
  ];

  const modo = modal?.modo;

  return (
    <Layout
      titulo="Usuarios"
      subtitulo="Quién entra al sistema, con qué rol y sobre qué alcance."
      migas={[{ etiqueta: 'Usuarios' }]}
      acciones={
        <button type="button" className="btn btn--primario" onClick={abrirCrear}>
          <IconoMas /> Nuevo usuario
        </button>
      }
    >
      {/* El censo por rol es también el filtro por rol. */}
      <div className={`${styles.censo} no-imprimir`} role="group" aria-label="Filtrar por rol">
        <button
          type="button"
          className={`${styles.censoItem} ${styles.censoTodos} ${!filtros.rol ? styles.censoActivo : ''}`}
          onClick={() => setFiltro('rol', '')}
          aria-pressed={!filtros.rol}
        >
          <span className={styles.censoNumero}>{conteo.total}</span>
          <span className={styles.censoEtiqueta}>con acceso</span>
        </button>
        {ORDEN_ROLES.map(rol => (
          <button
            key={rol}
            type="button"
            className={`${styles.censoItem} ${ROLES_META[rol].censo} ${filtros.rol === rol ? styles.censoActivo : ''}`}
            onClick={() => setFiltro('rol', filtros.rol === rol ? '' : rol)}
            aria-pressed={filtros.rol === rol}
          >
            <span className={styles.censoNumero}>{conteo[rol]}</span>
            <span className={styles.censoEtiqueta}>{ROLES_META[rol].plural.toLowerCase()}</span>
          </button>
        ))}
      </div>

      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: 'Buscar por nombre o correo…',
        }}
        campos={[{
          etiqueta: 'Estado',
          valor: filtros.estado,
          onChange: v => setFiltro('estado', v),
          opciones: [
            { valor: 'todos', texto: 'Todos' },
            { valor: 'activos', texto: 'Con acceso' },
            { valor: 'inactivos', texto: 'Revocados' },
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
        claseFila={u => (u.activo ? undefined : 'fila-inactiva')}
        etiqueta="usuarios"
        totalSinFiltrar={usuarios.length}
        claveFiltros={clave}
        vacio={{
          titulo: hayFiltros ? 'Ningún usuario coincide' : 'Todavía no hay usuarios',
          texto: hayFiltros
            ? 'Prueba con otro término o limpia los filtros.'
            : 'Crea el primer acceso al sistema con «Nuevo usuario».',
        }}
      />

      {modal && (
        <Modal
          titulo={modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
          subtitulo={modo === 'editar' ? modal.editando.email : 'El acceso se crea aquí; no hay registro público.'}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-usuario" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />}
                {modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </>
          }
        >
          <form id="form-usuario" onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <Campo etiqueta="Nombre completo" error={errores.nombre} id="u-nombre">
              <input
                id="u-nombre" className={`control${errores.nombre ? ' control--invalido' : ''}`}
                type="text" placeholder="Ej. Laura Méndez Ríos"
                value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
                disabled={guardando} data-foco-inicial
              />
            </Campo>

            <Campo
              etiqueta="Correo electrónico" error={errores.email} id="u-email"
              pista="Será su identificador para iniciar sesión."
            >
              <input
                id="u-email" className={`control${errores.email ? ' control--invalido' : ''}`}
                type="email" placeholder="usuario@lallar.com"
                value={form.email} onChange={e => cambiar('email', e.target.value)}
                disabled={guardando} autoComplete="off"
              />
            </Campo>

            <div className="campo">
              <span className="etiqueta">Rol de acceso</span>
              <div className={styles.rolSelector} role="group" aria-label="Rol de acceso">
                {ORDEN_ROLES.map(rol => {
                  const meta = ROLES_META[rol];
                  const activo = form.rol === rol;
                  return (
                    <button
                      key={rol} type="button" disabled={guardando}
                      className={`${styles.rolOpcion} ${activo ? styles[`rolActivo${rol.charAt(0).toUpperCase()}${rol.slice(1)}`] : ''}`}
                      onClick={() => elegirRol(rol)}
                      aria-pressed={activo}
                    >
                      <span className={styles.rolOpcionIcono}><meta.Icono tamano={16} /></span>
                      {meta.etiqueta}
                    </button>
                  );
                })}
              </div>
              {errores.rol && <span className="error-campo"><IconoAlerta tamano={13} />{errores.rol}</span>}
            </div>

            {form.rol === 'gerente' && (
              <Campo
                etiqueta="Sucursal asignada" error={errores.sucursal_id} id="u-sucursal"
                pista="El gerente sólo verá y operará sobre esta cocina."
              >
                <select
                  id="u-sucursal" className={`control${errores.sucursal_id ? ' control--invalido' : ''}`}
                  value={form.sucursal_id} onChange={e => cambiar('sucursal_id', e.target.value)} disabled={guardando}
                >
                  <option value="">Seleccionar sucursal…</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Campo>
            )}

            {form.rol === 'proveedor' && (
              <Campo
                etiqueta="Perfil de proveedor" error={errores.proveedor_id} id="u-proveedor"
                pista="El usuario sólo verá y operará sobre este perfil."
              >
                <select
                  id="u-proveedor" className={`control${errores.proveedor_id ? ' control--invalido' : ''}`}
                  value={form.proveedor_id} onChange={e => cambiar('proveedor_id', e.target.value)} disabled={guardando}
                >
                  <option value="">Seleccionar proveedor…</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </Campo>
            )}

            <Campo
              etiqueta={modo === 'crear' ? 'Contraseña inicial' : 'Restablecer contraseña'}
              error={errores.password}
              id="u-password"
              pista={modo === 'crear'
                ? 'Compártela por un canal seguro; el usuario puede cambiarla después.'
                : 'En blanco conserva la contraseña actual.'}
            >
              <div className={styles.passwordFila}>
                <div className="campo-con-boton" style={{ flex: 1 }}>
                  <input
                    id="u-password" className={`control${errores.password ? ' control--invalido' : ''}`}
                    type={verPassword ? 'text' : 'password'}
                    placeholder={modo === 'crear' ? 'Mínimo 8 caracteres' : 'Dejar en blanco para conservar'}
                    value={form.password} onChange={e => cambiar('password', e.target.value)}
                    disabled={guardando} autoComplete="new-password"
                  />
                  <button
                    type="button" className="campo-con-boton__btn"
                    onClick={() => setVerPassword(v => !v)}
                    aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {verPassword ? <IconoOjoOff /> : <IconoOjo />}
                  </button>
                </div>
                <button
                  type="button" className="btn btn--neutro"
                  onClick={() => { cambiar('password', generarPassword()); setVerPassword(true); }}
                  disabled={guardando}
                >
                  Generar
                </button>
              </div>
            </Campo>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
