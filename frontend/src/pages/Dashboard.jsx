import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../services/api';
import styles from './Dashboard.module.css';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';

/* ── Iconos de módulo (set de línea consistente) ───────── */
function IcoAsistencias() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M9 16l2 2 4-4" />
    </svg>
  );
}
function IcoProveedores() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
function IcoUnidades() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V8l7-4 7 4v13" /><path d="M9 21v-6h6v6" /><path d="M3 8h18" />
    </svg>
  );
}
function IcoEmpleados() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IcoUsuarios() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
function IcoDocumentos() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

/* ── Iconos del tablero (KPIs) ─────────────────────────── */
function IcoBrigada() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IcoComandas() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IcoPase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}
function IcoServicio() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /><line x1="4.9" y1="4.9" x2="6.6" y2="6.6" /><line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
    </svg>
  );
}
function IcoFlecha() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ── Metadatos de módulos por rol ──────────────────────── */
const MODULOS = {
  administrador: [
    { titulo: 'Asistencias', desc: 'Entradas y salidas por sucursal.', to: '/admin/asistencias', Icono: IcoAsistencias, tono: 'acero' },
    { titulo: 'Proveedores', desc: 'Documentos de proveedores.', to: '/admin/proveedores', Icono: IcoProveedores, tono: 'oliva' },
    { titulo: 'Unidades', desc: 'Documentos de cocinas y sucursales.', to: '/admin/unidades', Icono: IcoUnidades, tono: 'naranja' },
    { titulo: 'Empleados', desc: 'Alta, edición y baja de empleados.', to: '/admin/empleados', Icono: IcoEmpleados, tono: 'acero' },
    { titulo: 'Usuarios', desc: 'Accesos al sistema: roles y credenciales.', to: '/admin/usuarios', Icono: IcoUsuarios, tono: 'naranja' },
    { titulo: 'Por revisar', desc: 'Documentos pendientes de aprobación.', to: '/admin/pendientes', Icono: IcoDocumentos, tono: 'oliva' },
  ],
  gerente: [
    { titulo: 'Asistencias', desc: 'Entradas y salidas de tu sucursal.', to: '/gerente/asistencias', Icono: IcoAsistencias, tono: 'acero' },
    { titulo: 'Unidades', desc: 'Documentos de tu cocina.', to: '/gerente/unidades', Icono: IcoUnidades, tono: 'naranja' },
  ],
  proveedor: [
    { titulo: 'Mis Documentos', desc: 'Sube y gestiona tus documentos.', to: '/proveedor/documentos', Icono: IcoDocumentos, tono: 'oliva' },
  ],
};

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaLarga(d = new Date()) {
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === 'administrador';

  const [kpis, setKpis] = useState(null);
  const [cargandoKpis, setCargandoKpis] = useState(esAdmin);
  const [errorKpis, setErrorKpis] = useState(false);

  useEffect(() => {
    if (!esAdmin) return;
    cargarKpis();
  }, [esAdmin]);

  async function cargarKpis() {
    setCargandoKpis(true);
    setErrorKpis(false);
    try {
      const res = await api.get('/dashboard/kpis');
      setKpis(res.data);
    } catch {
      setErrorKpis(true);
    } finally {
      setCargandoKpis(false);
    }
  }

  async function handleLogout() {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?', text: 'Se cerrará tu sesión actual.', icon: 'question',
      showCancelButton: true, confirmButtonColor: '#E8621A', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) { logout(); navigate('/login', { replace: true }); }
  }

  const modulos = MODULOS[usuario?.rol] || [];

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
            <span className={styles.rolBadge}>{ETIQUETA_ROL[usuario?.rol]}</span>
          </div>
          <button className={styles.botonSalir} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className={styles.contenido}>
        <div className={styles.bienvenida}>
          <h1 className={styles.titulo}>Hola, {usuario?.nombre?.split(' ')[0]}</h1>
          <p className={styles.descripcion}>
            <span className={styles.fechaHoy}>{fechaLarga()}</span>
          </p>
        </div>

        {esAdmin && (
          <section className={styles.seccion}>
            <h2 className={styles.seccionTitulo}>Resumen operativo</h2>
            {errorKpis ? (
              <div className={styles.errorBox}>
                <span>No se pudo cargar el resumen.</span>
                <button className={styles.btnReintentar} onClick={cargarKpis}>Reintentar</button>
              </div>
            ) : cargandoKpis || !kpis ? (
              <TableroSkeleton />
            ) : (
              <Tablero kpis={kpis} />
            )}
          </section>
        )}

        <section className={styles.seccion}>
          <h2 className={styles.seccionTitulo}>Módulos</h2>
          <div className={styles.modulos}>
            {modulos.map((m) => (
              <Link key={m.titulo} to={m.to} className={styles.tarjeta}>
                <span className={`${styles.tarjetaIcono} ${styles['tono_' + m.tono]}`}><m.Icono /></span>
                <div className={styles.tarjetaTexto}>
                  <h3 className={styles.tarjetaTitulo}>{m.titulo}</h3>
                  <p className={styles.tarjetaDesc}>{m.desc}</p>
                </div>
                <span className={styles.tarjetaFlecha}><IcoFlecha /></span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ── Tablero de pase (KPIs) ────────────────────────────── */
function Tablero({ kpis }) {
  const { empleados, documentosPendientes, ventanas, asistenciaHoy } = kpis;
  const maxEstacion = Math.max(...empleados.porSucursal.map((s) => s.total), 1);
  const hayPendientes = documentosPendientes.total > 0;
  const pct = asistenciaHoy.plantilla > 0 ? Math.round((asistenciaHoy.presentes / asistenciaHoy.plantilla) * 100) : 0;

  return (
    <div className={styles.tablero}>
      {/* Brigada activa — hero con desglose por estación */}
      <article className={`${styles.card} ${styles.cardBrigada}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${styles.iconoNaranja}`}><IcoBrigada /></span>
          <span className={styles.cardEtiqueta}>Brigada activa</span>
        </div>
        <div className={styles.brigadaCifra}>
          <span className={styles.numeroHero}>{empleados.activos}</span>
          <span className={styles.numeroUnidad}>en plantilla{empleados.inactivos > 0 ? ` · ${empleados.inactivos} inactivo${empleados.inactivos === 1 ? '' : 's'}` : ''}</span>
        </div>
        <div className={styles.estaciones}>
          {empleados.porSucursal.map((s) => (
            <div key={s.id} className={styles.estacion}>
              <span className={styles.estacionNombre}>{s.nombre}</span>
              <span className={styles.estacionBarraPista}>
                <span className={styles.estacionBarra} style={{ width: `${(s.total / maxEstacion) * 100}%` }} />
              </span>
              <span className={styles.estacionTotal}>{s.total}</span>
            </div>
          ))}
        </div>
      </article>

      {/* Por revisar — riel de comandas accionable */}
      <article className={`${styles.card} ${styles.cardComandas} ${hayPendientes ? styles.comandasAlerta : styles.comandasCalma}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${hayPendientes ? styles.iconoAmbar : styles.iconoOliva}`}><IcoComandas /></span>
          <span className={styles.cardEtiqueta}>Por revisar</span>
        </div>
        {hayPendientes ? (
          <>
            <div className={styles.comandasCifra}>
              <span className={styles.numeroGrande}>{documentosPendientes.total}</span>
              <span className={styles.numeroUnidad}>documento{documentosPendientes.total === 1 ? '' : 's'} esperan aprobación</span>
            </div>
            <div className={styles.comandasRieles}>
              <RielPendiente etiqueta="Proveedores" valor={documentosPendientes.proveedores} to="/admin/pendientes?tipo=proveedor" />
              <RielPendiente etiqueta="Unidades" valor={documentosPendientes.unidades} to="/admin/pendientes?tipo=unidad" />
            </div>
          </>
        ) : (
          <div className={styles.todoAlDia}>
            <span className={styles.checkOk}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <div>
              <div className={styles.todoAlDiaTitulo}>Todo al día</div>
              <div className={styles.todoAlDiaSub}>No hay documentos por revisar.</div>
            </div>
          </div>
        )}
      </article>

      {/* El pase — letreros de ventana */}
      <article className={`${styles.card} ${styles.cardPase}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${styles.iconoAcero}`}><IcoPase /></span>
          <span className={styles.cardEtiqueta}>Ventanas de carga</span>
        </div>
        <LetreroVentana etiqueta="Proveedores" abierta={ventanas.proveedores} to="/admin/proveedores" />
        <LetreroVentana etiqueta="Unidades" abierta={ventanas.unidades} to="/admin/unidades" />
      </article>

      {/* Servicio de hoy — barra de llenado */}
      <article className={`${styles.card} ${styles.cardServicio}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${styles.iconoNaranja}`}><IcoServicio /></span>
          <span className={styles.cardEtiqueta}>Asistencia de hoy</span>
        </div>
        <div className={styles.servicioCifra}>
          <span className={styles.numeroGrande}>{asistenciaHoy.presentes}</span>
          <span className={styles.numeroUnidad}>de {asistenciaHoy.plantilla} registraron entrada</span>
        </div>
        <span className={styles.fillPista}>
          <span className={styles.fillBarra} style={{ width: `${pct}%` }} />
        </span>
        <div className={styles.servicioPie}>
          {asistenciaHoy.presentes === 0
            ? <>Sin registros hoy · última actividad <strong>{fechaCorta(asistenciaHoy.ultimaActividad)}</strong></>
            : <>{pct}% de la brigada presente</>}
        </div>
      </article>
    </div>
  );
}

function RielPendiente({ etiqueta, valor, to }) {
  return (
    <Link to={to} className={styles.riel}>
      <span className={styles.rielEtiqueta}>{etiqueta}</span>
      <span className={styles.rielValor}>{valor}</span>
    </Link>
  );
}

function LetreroVentana({ etiqueta, abierta, to }) {
  return (
    <Link to={to} className={styles.letrero}>
      <span className={styles.letreroEtiqueta}>{etiqueta}</span>
      <span className={`${styles.letreroEstado} ${abierta ? styles.letreroAbierta : styles.letreroCerrada}`}>
        {abierta ? 'Abierta' : 'Cerrada'}
      </span>
    </Link>
  );
}

function TableroSkeleton() {
  return (
    <div className={styles.tablero}>
      <div className={`${styles.card} ${styles.cardBrigada} ${styles.skel}`} />
      <div className={`${styles.card} ${styles.cardComandas} ${styles.skel}`} />
      <div className={`${styles.card} ${styles.cardPase} ${styles.skel}`} />
      <div className={`${styles.card} ${styles.cardServicio} ${styles.skel}`} />
    </div>
  );
}
