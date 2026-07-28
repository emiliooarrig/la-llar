import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import LogoInicio from '../components/LogoInicio';
import Footer from '../components/Footer';
import api from '../services/api';
import styles from './Asistencias.module.css';

/* ── Iconos SVG inline ─────────────────────────────────── */
function IconoChevron({ dir = 'left' }) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
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

function IconoCalendario() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconoDescargar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconoCandado({ abierto = false }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      {abierto
        ? <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        : <path d="M7 11V7a5 5 0 0 1 10 0v4" />}
    </svg>
  );
}

/* ── Constantes ─────────────────────────────────────────── */
const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Nombre corto por número ISO de día (1=Lunes … 7=Domingo).
const NOMBRE_DIA_ISO = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };

// Convierte "1,2,3,4,5,6" → Set{1,2,3,4,5,6}. Fallback: lunes a sábado.
function parseDiasLaborales(str) {
  if (!str) return new Set([1, 2, 3, 4, 5, 6]);
  const dias = String(str).split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 7);
  return new Set(dias.length ? dias : [1, 2, 3, 4, 5, 6]);
}

// getDay(): 0=Domingo … 6=Sábado → ISO 1=Lunes … 7=Domingo.
function isoDeFecha(fecha) {
  const d = new Date(`${fecha}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const TIPOS_JUSTIFICACION = [
  { valor: 'vacaciones',        etiqueta: 'Vacaciones' },
  { valor: 'incapacidad',       etiqueta: 'Incapacidad' },
  { valor: 'permiso',           etiqueta: 'Permiso' },
  { valor: 'falta_justificada', etiqueta: 'Falta justificada' },
];

const ETIQUETA_JUST = TIPOS_JUSTIFICACION.reduce((acc, t) => ({ ...acc, [t.valor]: t.etiqueta }), {});

const FORM_VACIO = { entrada: '', salida: '', tipo: '', nota: '' };

const FORM_PERMISO_VACIO = { desde: '', hasta: '' };

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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Estado visible del permiso de edición para gerentes (ventana `asistencias`). */
function estadoPermiso(v) {
  if (!v) return { clave: 'cerrado', texto: 'Sin permiso vigente' };
  const now = new Date();
  if (v.desde && v.hasta) {
    if (now < new Date(v.desde)) return { clave: 'programado', texto: `Programado · inicia ${formatDatetime(v.desde)}` };
    if (now <= new Date(v.hasta)) return { clave: 'activo', texto: `Activo · termina ${formatDatetime(v.hasta)}` };
    return { clave: 'cerrado', texto: 'Permiso vencido' };
  }
  return v.abierta
    ? { clave: 'activo', texto: 'Activo (sin fecha de término)' }
    : { clave: 'cerrado', texto: 'Sin permiso vigente' };
}

/* ── Helpers de fecha ───────────────────────────────────── */
function pad(n) {
  return String(n).padStart(2, '0');
}

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;
}

const HOY_STR = (() => {
  const h = new Date();
  return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`;
})();

// Genera la matriz de semanas (lunes a domingo) para un mes 'YYYY-MM'.
function construirCalendario(mes) {
  const [y, m] = mes.split('-').map(Number);
  const primero = new Date(y, m - 1, 1);
  const diasEnMes = new Date(y, m, 0).getDate();
  // getDay(): 0=domingo … convertimos a 0=lunes
  const offset = (primero.getDay() + 6) % 7;

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push({ dia: d, fecha: `${mes}-${pad(d)}` });
  }
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

function estadoDia(dia) {
  if (!dia) return 'sinDatos';
  if (dia.justificacion) return 'justificada';
  if (dia.entrada && dia.salida) return 'completa';
  if (dia.entrada || dia.salida) return 'incompleta';
  return 'sinDatos';
}

// Minutos trabajados en un día = última salida − primera entrada.
// Solo se contabiliza cuando el día tiene entrada y salida.
function minutosTrabajados(dia) {
  if (!dia?.entrada || !dia?.salida) return 0;
  const [eh, em] = dia.entrada.split(':').map(Number);
  const [sh, sm] = dia.salida.split(':').map(Number);
  const diff = (sh * 60 + sm) - (eh * 60 + em);
  return diff > 0 ? diff : 0;
}

// Formatea minutos como "Xh Ym" (omite los minutos cuando son 0).
function formatearHoras(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0 && m === 0) return '0h';
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ── Componente principal ───────────────────────────────── */
export default function Asistencias() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const esGerente = usuario?.rol === 'gerente';

  // Datos base
  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados]   = useState([]);

  // Filtros
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [empleadoSel, setEmpleadoSel]       = useState('');
  const [mes, setMes]                       = useState(mesActual());

  // Datos del mes (mapa fecha → { entrada, salida, justificacion })
  const [diasMes, setDiasMes]   = useState({});
  const [cargandoMes, setCargandoMes] = useState(false);

  // Modal de día
  const [diaModal, setDiaModal] = useState(null); // { dia, fecha }
  const [form, setForm]         = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Descarga del reporte PDF de la unidad
  const [descargando, setDescargando] = useState(false);

  // Permiso temporal de edición para gerentes (ventana `asistencias`)
  const [ventanaEdicion, setVentanaEdicion] = useState(null);
  const [modalPermiso, setModalPermiso]     = useState(false);
  const [formPermiso, setFormPermiso]       = useState(FORM_PERMISO_VACIO);
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);

  /* ── Carga inicial: sucursales + empleados + permiso ── */
  useEffect(() => {
    (async () => {
      try {
        const [resS, resE, resV] = await Promise.all([
          api.get('/sucursales'),
          api.get('/empleados'),
          // Si falla, se asume cerrado; no bloquea la página.
          api.get('/ventanas/asistencias').catch(() => null),
        ]);
        setVentanaEdicion(resV?.data ?? null);
        // El gerente solo opera sobre su unidad: la preseleccionamos y
        // limitamos el selector a esa única sucursal.
        if (esGerente && usuario?.sucursal_id) {
          setSucursales(resS.data.filter(s => s.id === usuario.sucursal_id));
          setFiltroSucursal(String(usuario.sucursal_id));
        } else {
          setSucursales(resS.data);
        }
        setEmpleados(resE.data);
      } catch {
        Swal.fire({ icon: 'error', title: 'Error al cargar', text: 'No se pudieron obtener sucursales y empleados.', confirmButtonColor: '#E8621A' });
      }
    })();
  }, [esGerente, usuario?.sucursal_id]);

  /* ── Empleados de la unidad seleccionada ────────────── */
  const empleadosUnidad = useMemo(() => {
    if (!filtroSucursal) return [];
    return empleados
      .filter(e => e.sucursal_id === parseInt(filtroSucursal) && e.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [empleados, filtroSucursal]);

  /* ── Cargar el mes del empleado seleccionado ────────── */
  useEffect(() => {
    if (!empleadoSel) {
      setDiasMes({});
      return;
    }
    let cancelado = false;
    (async () => {
      setCargandoMes(true);
      try {
        const res = await api.get('/asistencias', { params: { empleado_id: empleadoSel, mes } });
        if (cancelado) return;
        const mapa = {};
        for (const d of res.data.dias) mapa[d.fecha] = d;
        setDiasMes(mapa);
      } catch {
        if (!cancelado) Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las asistencias del mes.', confirmButtonColor: '#E8621A' });
      } finally {
        if (!cancelado) setCargandoMes(false);
      }
    })();
    return () => { cancelado = true; };
  }, [empleadoSel, mes]);

  const semanas = useMemo(() => construirCalendario(mes), [mes]);
  const empleadoActual = empleadosUnidad.find(e => e.id === parseInt(empleadoSel));

  // El gerente solo puede editar mientras el permiso temporal esté vigente.
  const permiso = estadoPermiso(ventanaEdicion);
  const puedeEditar = !esGerente || permiso.clave === 'activo';

  // Días laborales configurados para la unidad seleccionada (Set de ISO 1..7).
  const sucursalActual = sucursales.find(s => s.id === parseInt(filtroSucursal));
  const diasLaborales = useMemo(
    () => parseDiasLaborales(sucursalActual?.dias_laborales),
    [sucursalActual?.dias_laborales],
  );
  const etiquetaDiasLaborales = useMemo(
    () => [...diasLaborales].sort((a, b) => a - b).map(n => NOMBRE_DIA_ISO[n]).join(', '),
    [diasLaborales],
  );

  /* ── Resumen ejecutivo (horas y faltas, semanal y mensual) ──
   * Se calcula en el navegador a partir de los días ya cargados,
   * reutilizando la misma estructura de semanas del calendario. */
  const resumen = useMemo(() => {
    if (!empleadoSel) return null;

    const semanasResumen = semanas.map((semana) => {
      let minutos = 0, completos = 0, incompletos = 0, justificados = 0, faltas = 0;
      let primera = null, ultima = null, contieneHoy = false;

      for (const celda of semana) {
        if (!celda) continue;
        if (!primera) primera = celda;
        ultima = celda;
        if (celda.fecha === HOY_STR) contieneHoy = true;

        const dia = diasMes[celda.fecha];
        minutos += minutosTrabajados(dia);

        if (dia?.justificacion) {
          justificados++;
        } else if (dia?.entrada && dia?.salida) {
          completos++;
        } else if (dia?.entrada || dia?.salida) {
          incompletos++;
        } else {
          // Falta: día laboral de la unidad ya transcurrido, sin registro.
          const esPasado = celda.fecha < HOY_STR;
          const esLaboral = diasLaborales.has(isoDeFecha(celda.fecha));
          if (esPasado && esLaboral) faltas++;
        }
      }

      return { primera, ultima, minutos, completos, incompletos, justificados, faltas, contieneHoy };
    }).filter(s => s.primera);

    const total = semanasResumen.reduce((acc, s) => ({
      minutos: acc.minutos + s.minutos,
      completos: acc.completos + s.completos,
      incompletos: acc.incompletos + s.incompletos,
      justificados: acc.justificados + s.justificados,
      faltas: acc.faltas + s.faltas,
    }), { minutos: 0, completos: 0, incompletos: 0, justificados: 0, faltas: 0 });

    return { semanasResumen, total };
  }, [empleadoSel, semanas, diasMes, diasLaborales]);

  /* ── Navegación de mes ──────────────────────────────── */
  function cambiarMes(delta) {
    const [y, m] = mes.split('-').map(Number);
    const nuevo = new Date(y, m - 1 + delta, 1);
    setMes(`${nuevo.getFullYear()}-${pad(nuevo.getMonth() + 1)}`);
  }

  function cambiarSucursal(valor) {
    setFiltroSucursal(valor);
    setEmpleadoSel('');
    setDiasMes({});
  }

  /* ── Modal de día ───────────────────────────────────── */
  function abrirDia(celda) {
    if (!celda || !empleadoSel) return;
    const dia = diasMes[celda.fecha];
    setDiaModal(celda);
    setForm({
      entrada: dia?.entrada || '',
      salida: dia?.salida || '',
      tipo: dia?.justificacion?.tipo || '',
      nota: dia?.justificacion?.nota || '',
    });
  }

  function cerrarModal() {
    if (guardando) return;
    setDiaModal(null);
    setForm(FORM_VACIO);
  }

  async function guardarDia() {
    if (form.entrada && form.salida && form.salida < form.entrada) {
      Swal.fire({ icon: 'warning', title: 'Horario inválido', text: 'La salida no puede ser anterior a la entrada.', confirmButtonColor: '#E8621A' });
      return;
    }

    setGuardando(true);
    try {
      const res = await api.put('/asistencias/dia', {
        empleado_id: parseInt(empleadoSel),
        fecha: diaModal.fecha,
        entrada: form.entrada || null,
        salida: form.salida || null,
        justificacion: form.tipo ? { tipo: form.tipo, nota: form.nota } : null,
      });
      setDiasMes(prev => ({ ...prev, [diaModal.fecha]: { fecha: diaModal.fecha, ...res.data } }));
      cerrarModal();
      Swal.fire({ icon: 'success', title: 'Día actualizado', timer: 1300, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo guardar el día.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardando(false);
    }
  }

  async function revertirDia() {
    const result = await Swal.fire({
      title: '¿Revertir corrección?',
      text: 'El día volverá a mostrar las marcas originales del checador. La justificación no se elimina.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#E8621A',
      cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, revertir',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    setGuardando(true);
    try {
      const res = await api.put('/asistencias/dia', {
        empleado_id: parseInt(empleadoSel),
        fecha: diaModal.fecha,
        revertir: true,
        justificacion: form.tipo ? { tipo: form.tipo, nota: form.nota } : null,
      });
      setDiasMes(prev => ({ ...prev, [diaModal.fecha]: { fecha: diaModal.fecha, ...res.data } }));
      cerrarModal();
      Swal.fire({ icon: 'success', title: 'Corrección revertida', timer: 1300, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo revertir la corrección.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardando(false);
    }
  }

  /* ── Descarga del reporte PDF de la unidad ──────────── */
  async function descargarReporte() {
    if (!filtroSucursal || descargando) return;
    setDescargando(true);
    try {
      const res = await api.get('/asistencias/reporte', {
        params: { sucursal_id: filtroSucursal, mes },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `reporte_${mes}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // El error llega como Blob (responseType); intentamos leer el mensaje.
      let msg = 'No se pudo generar el reporte.';
      if (e.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).error || msg; } catch { /* noop */ }
      }
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setDescargando(false);
    }
  }

  /* ── Permiso temporal de edición para gerentes (admin) ── */
  function abrirModalPermiso() {
    setFormPermiso({
      desde: toDatetimeLocal(ventanaEdicion?.desde),
      hasta: toDatetimeLocal(ventanaEdicion?.hasta),
    });
    setModalPermiso(true);
  }

  function cerrarModalPermiso() {
    if (guardandoPermiso) return;
    setModalPermiso(false);
    setFormPermiso(FORM_PERMISO_VACIO);
  }

  async function otorgarPermiso() {
    if (!formPermiso.desde || !formPermiso.hasta) {
      Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Indica el inicio y el término del permiso.', confirmButtonColor: '#E8621A' });
      return;
    }
    const dDesde = new Date(formPermiso.desde);
    const dHasta = new Date(formPermiso.hasta);
    if (dHasta <= dDesde) {
      Swal.fire({ icon: 'warning', title: 'Rango inválido', text: 'El término debe ser posterior al inicio.', confirmButtonColor: '#E8621A' });
      return;
    }

    setGuardandoPermiso(true);
    try {
      const res = await api.put('/ventanas/asistencias/programacion', {
        desde: dDesde.toISOString(),
        hasta: dHasta.toISOString(),
      });
      setVentanaEdicion(res.data);
      cerrarModalPermiso();
      Swal.fire({ icon: 'success', title: 'Permiso otorgado', text: `Los gerentes podrán editar asistencias hasta el ${formatDatetime(res.data.hasta)}.`, confirmButtonColor: '#E8621A' });
    } catch (e) {
      const msg = e.response?.data?.error || 'No se pudo otorgar el permiso.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#E8621A' });
    } finally {
      setGuardandoPermiso(false);
    }
  }

  async function revocarPermiso() {
    const r = await Swal.fire({
      title: '¿Revocar permiso?',
      text: 'Los gerentes dejarán de poder editar asistencias de inmediato.',
      icon: 'question', showCancelButton: true,
      confirmButtonColor: '#D93025', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, revocar', cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;

    setGuardandoPermiso(true);
    try {
      let res = await api.delete('/ventanas/asistencias/programacion');
      // Por si la ventana quedó abierta en modo manual, se cierra también.
      if (res.data.abierta) res = await api.patch('/ventanas/asistencias');
      setVentanaEdicion(res.data);
      cerrarModalPermiso();
      Swal.fire({ icon: 'success', title: 'Permiso revocado', timer: 1400, showConfirmButton: false, timerProgressBar: true });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo revocar el permiso.', confirmButtonColor: '#E8621A' });
    } finally {
      setGuardandoPermiso(false);
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

  /* ── Render ─────────────────────────────────────────── */
  const [anio, numMes] = mes.split('-').map(Number);

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
        <div className={styles.paginaHeader}>
          <div>
            <h1 className={styles.tituloPagina}>Asistencias</h1>
            <p className={styles.subtituloPagina}>
              {esGerente
                ? (puedeEditar
                    ? 'Consulta y edición temporal de asistencias de los empleados de tu unidad'
                    : 'Consulta de entradas y salidas de los empleados de tu unidad (solo lectura)')
                : 'Calendario de entradas y salidas por unidad y empleado'}
            </p>
          </div>
          <div className={styles.accionesHeader}>
            {!esGerente && (
              <button
                className={styles.btnPermiso}
                onClick={abrirModalPermiso}
                title="Otorgar a los gerentes un permiso temporal para editar asistencias"
              >
                <IconoCandado abierto={permiso.clave === 'activo'} />
                Permiso de gerentes
                <span className={`${styles.puntoPermiso} ${styles[`puntoPermiso_${permiso.clave}`]}`} />
              </button>
            )}
            <button
              className={styles.btnReporte}
              onClick={descargarReporte}
              disabled={!filtroSucursal || descargando}
              title={filtroSucursal ? 'Descargar reporte PDF de la unidad' : 'Selecciona una unidad para generar el reporte'}
            >
              {descargando ? <span className={styles.spinnerBtn} /> : <IconoDescargar />}
              {descargando ? 'Generando…' : 'Descargar reporte PDF'}
            </button>
          </div>
        </div>

        {/* Aviso al gerente cuando tiene permiso de edición vigente */}
        {esGerente && puedeEditar && (
          <div className={styles.avisoEdicion}>
            <IconoCandado abierto />
            <span>
              <strong>Edición habilitada.</strong>{' '}
              El administrador otorgó permiso para editar asistencias
              {ventanaEdicion?.hasta ? <> hasta el <strong>{formatDatetime(ventanaEdicion.hasta)}</strong>.</> : '.'}
            </span>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <div className={styles.campoFiltro}>
            <label className={styles.etiquetaFiltro}>Unidad</label>
            <select className={styles.selectFiltro} value={filtroSucursal} onChange={e => cambiarSucursal(e.target.value)} disabled={esGerente}>
              {!esGerente && <option value="">— Selecciona una unidad —</option>}
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div className={styles.campoFiltro}>
            <label className={styles.etiquetaFiltro}>Empleado</label>
            <select className={styles.selectFiltro} value={empleadoSel} onChange={e => setEmpleadoSel(e.target.value)} disabled={!filtroSucursal}>
              <option value="">{filtroSucursal ? '— Selecciona un empleado —' : 'Primero elige una unidad'}</option>
              {empleadosUnidad.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Leyenda */}
        <div className={styles.leyenda}>
          <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoCompleta}`} /> Completa</span>
          <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoIncompleta}`} /> Incompleta</span>
          <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoJustificada}`} /> Justificada</span>
          <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoSinDatos}`} /> Sin registro</span>
        </div>

        {/* Calendario */}
        <div className={styles.calendarioCard}>
          <div className={styles.calendarioBarra}>
            <button className={styles.btnMes} onClick={() => cambiarMes(-1)} aria-label="Mes anterior"><IconoChevron dir="left" /></button>
            <h2 className={styles.tituloMes}>{NOMBRES_MES[numMes - 1]} {anio}</h2>
            <button className={styles.btnMes} onClick={() => cambiarMes(1)} aria-label="Mes siguiente"><IconoChevron dir="right" /></button>
          </div>

          {!empleadoSel ? (
            <div className={styles.vacioCalendario}>
              <IconoCalendario />
              <p>Selecciona una unidad y un empleado para ver su calendario de asistencias.</p>
            </div>
          ) : (
            <div className={styles.calendarioWrap}>
              {cargandoMes && <div className={styles.overlayCarga}><div className={styles.spinner} /></div>}

              <div className={styles.gridSemana}>
                {DIAS_SEMANA.map(d => <div key={d} className={styles.cabeceraDia}>{d}</div>)}
              </div>

              {semanas.map((semana, i) => (
                <div key={i} className={styles.gridSemana}>
                  {semana.map((celda, j) => {
                    if (!celda) return <div key={j} className={styles.celdaVacia} />;
                    const dia = diasMes[celda.fecha];
                    const estado = estadoDia(dia);
                    const esHoy = celda.fecha === HOY_STR;
                    const esFuturo = celda.fecha > HOY_STR;
                    return (
                      <button
                        key={j}
                        className={`${styles.celda} ${styles[`celda_${estado}`]} ${esHoy ? styles.celdaHoy : ''} ${esFuturo ? styles.celdaFuturo : ''}`}
                        onClick={() => abrirDia(celda)}
                      >
                        <span className={styles.filaNumero}>
                          <span className={styles.numeroDia}>{celda.dia}</span>
                          {dia?.corregido && <span className={styles.marcaCorregido} title="Día corregido por el administrador">✎</span>}
                        </span>
                        {dia?.justificacion ? (
                          <span className={styles.etiquetaJust}>{ETIQUETA_JUST[dia.justificacion.tipo]}</span>
                        ) : (dia?.entrada || dia?.salida) ? (
                          <span className={styles.horario}>
                            <span className={styles.horaE}>{dia.entrada || '—'}</span>
                            <span className={styles.horaS}>{dia.salida || '—'}</span>
                          </span>
                        ) : (
                          <span className={styles.sinRegistro}>{esFuturo ? '' : 'Sin registro'}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen ejecutivo por empleado */}
        {empleadoSel && resumen && (
          <section className={styles.resumenSeccion}>
            <div className={styles.resumenHeader}>
              <h2 className={styles.resumenTitulo}>Resumen ejecutivo</h2>
              <p className={styles.resumenSub}>
                {empleadoActual?.nombre} · {NOMBRES_MES[numMes - 1]} {anio}
              </p>
            </div>

            {/* KPIs del mes */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiValor}>{formatearHoras(resumen.total.minutos)}</span>
                <span className={styles.kpiEtiqueta}>Horas trabajadas · mes</span>
              </div>
              <div className={`${styles.kpiCard} ${resumen.total.faltas > 0 ? styles.kpiCardAlerta : ''}`}>
                <span className={styles.kpiValor}>{resumen.total.faltas}</span>
                <span className={styles.kpiEtiqueta}>Faltas · mes</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiValor}>{resumen.total.completos}</span>
                <span className={styles.kpiEtiqueta}>Días completos</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiValor}>{resumen.total.justificados}</span>
                <span className={styles.kpiEtiqueta}>Días justificados</span>
              </div>
            </div>

            {/* Desglose semanal */}
            <div className={styles.tablaWrap}>
              <table className={styles.tablaResumen}>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Horas trabajadas</th>
                    <th>Completos</th>
                    <th>Incompletos</th>
                    <th>Justificados</th>
                    <th>Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.semanasResumen.map((s, i) => (
                    <tr key={i} className={s.contieneHoy ? styles.filaActual : ''}>
                      <td>
                        <span className={styles.semanaRango}>Día {s.primera.dia}–{s.ultima.dia}</span>
                        {s.contieneHoy && <span className={styles.badgeActual}>Actual</span>}
                      </td>
                      <td className={styles.celHoras}>{formatearHoras(s.minutos)}</td>
                      <td>{s.completos}</td>
                      <td>{s.incompletos}</td>
                      <td>{s.justificados}</td>
                      <td className={s.faltas > 0 ? styles.celFalta : ''}>{s.faltas}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total del mes</td>
                    <td className={styles.celHoras}>{formatearHoras(resumen.total.minutos)}</td>
                    <td>{resumen.total.completos}</td>
                    <td>{resumen.total.incompletos}</td>
                    <td>{resumen.total.justificados}</td>
                    <td className={resumen.total.faltas > 0 ? styles.celFalta : ''}>{resumen.total.faltas}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className={styles.resumenNota}>
              Las horas se calculan como la diferencia entre la primera entrada y la última salida de cada día.
              Una <strong>falta</strong> es un día laboral de la unidad ya transcurrido sin registro ni justificación.
              Días laborales de esta unidad: <strong>{etiquetaDiasLaborales}</strong>.
            </p>
          </section>
        )}
      </main>

      <Footer />

      {/* Modal de día */}
      {diaModal && (
        <div className={styles.overlay} onMouseDown={e => e.target === e.currentTarget && cerrarModal()}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitulo}>
                  {new Date(`${diaModal.fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <p className={styles.modalSub}>{empleadoActual?.nombre}</p>
              </div>
              <button className={styles.modalCerrar} onClick={cerrarModal} aria-label="Cerrar"><IconoCerrar /></button>
            </div>

            <div className={styles.modalCuerpo}>
              <div className={styles.filaHoras}>
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Entrada</label>
                  <input type="time" className={styles.input} value={form.entrada} onChange={e => setForm(p => ({ ...p, entrada: e.target.value }))} disabled={guardando || !puedeEditar} />
                </div>
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Salida</label>
                  <input type="time" className={styles.input} value={form.salida} onChange={e => setForm(p => ({ ...p, salida: e.target.value }))} disabled={guardando || !puedeEditar} />
                </div>
              </div>

              {diasMes[diaModal.fecha]?.corregido && (
                <div className={styles.avisoCorregido}>
                  <strong>✎ Día corregido.</strong>{' '}
                  Marcas originales del checador:{' '}
                  <span className={styles.refOriginal}>
                    {diasMes[diaModal.fecha].original?.entrada || '—'} / {diasMes[diaModal.fecha].original?.salida || '—'}
                  </span>
                  . Las marcas crudas no se modifican.
                </div>
              )}

              <div className={styles.divisor}><span>Justificación</span></div>

              <div className={styles.campo}>
                <label className={styles.etiqueta}>Tipo</label>
                <select className={styles.input} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} disabled={guardando || !puedeEditar}>
                  <option value="">Sin justificación</option>
                  {TIPOS_JUSTIFICACION.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
                {puedeEditar && (
                  <span className={styles.inputHint}>
                    Justifica el día como vacaciones, incapacidad u otro motivo.
                  </span>
                )}
              </div>

              {form.tipo && (
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Nota (opcional)</label>
                  <input type="text" className={styles.input} placeholder="Ej. Incapacidad IMSS folio 12345" maxLength={300} value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} disabled={guardando || !puedeEditar} />
                </div>
              )}
            </div>

            <div className={styles.modalPie}>
              {!puedeEditar ? (
                <button className={styles.btnCancelar} onClick={cerrarModal}>Cerrar</button>
              ) : (
                <>
                  {/* Revertir borra la corrección (puede ser del admin): solo administrador. */}
                  {!esGerente && diasMes[diaModal.fecha]?.corregido && (
                    <button className={styles.btnRevertir} onClick={revertirDia} disabled={guardando}>
                      Revertir a checador
                    </button>
                  )}
                  <button className={styles.btnCancelar} onClick={cerrarModal} disabled={guardando}>Cancelar</button>
                  <button className={styles.btnGuardar} onClick={guardarDia} disabled={guardando}>
                    {guardando ? <span className={styles.spinnerBtn} /> : 'Guardar día'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de permiso temporal de edición para gerentes (admin) */}
      {modalPermiso && (
        <div className={styles.overlay} onMouseDown={e => e.target === e.currentTarget && cerrarModalPermiso()}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTituloPermiso}>Permiso de edición para gerentes</h2>
                <p className={styles.modalSub}>Asistencias · todas las unidades</p>
              </div>
              <button className={styles.modalCerrar} onClick={cerrarModalPermiso} aria-label="Cerrar"><IconoCerrar /></button>
            </div>

            <div className={styles.modalCuerpo}>
              <p className={styles.permisoDesc}>
                Durante el intervalo indicado, cada gerente podrá corregir entradas/salidas y
                justificar días de los empleados de <strong>su propia unidad</strong>. Al terminar
                el intervalo, el acceso vuelve a ser de solo lectura automáticamente.
              </p>

              <div className={`${styles.estadoPermiso} ${styles[`estadoPermiso_${permiso.clave}`]}`}>
                <IconoCandado abierto={permiso.clave === 'activo'} />
                {permiso.texto}
              </div>

              <div className={`${styles.filaHoras} ${styles.filaPermiso}`}>
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Inicio *</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={formPermiso.desde}
                    onChange={e => setFormPermiso(p => ({ ...p, desde: e.target.value }))}
                    disabled={guardandoPermiso}
                  />
                </div>
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Término *</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={formPermiso.hasta}
                    onChange={e => setFormPermiso(p => ({ ...p, hasta: e.target.value }))}
                    disabled={guardandoPermiso}
                    min={formPermiso.desde}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalPie}>
              {(ventanaEdicion?.desde || ventanaEdicion?.hasta || ventanaEdicion?.abierta) && (
                <button className={styles.btnRevocarPermiso} onClick={revocarPermiso} disabled={guardandoPermiso}>
                  Revocar permiso
                </button>
              )}
              <button className={styles.btnCancelar} onClick={cerrarModalPermiso} disabled={guardandoPermiso}>Cancelar</button>
              <button className={styles.btnGuardar} onClick={otorgarPermiso} disabled={guardandoPermiso}>
                {guardandoPermiso ? <span className={styles.spinnerBtn} /> : 'Otorgar permiso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
