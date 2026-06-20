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

/* ── Constantes ─────────────────────────────────────────── */
const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

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

  /* ── Carga inicial: sucursales + empleados ──────────── */
  useEffect(() => {
    (async () => {
      try {
        const [resS, resE] = await Promise.all([
          api.get('/sucursales'),
          api.get('/empleados'),
        ]);
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
                ? 'Consulta de entradas y salidas de los empleados de tu unidad (solo lectura)'
                : 'Calendario de entradas y salidas por unidad y empleado'}
            </p>
          </div>
        </div>

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
                  <input type="time" className={styles.input} value={form.entrada} onChange={e => setForm(p => ({ ...p, entrada: e.target.value }))} disabled={guardando || esGerente} />
                </div>
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Salida</label>
                  <input type="time" className={styles.input} value={form.salida} onChange={e => setForm(p => ({ ...p, salida: e.target.value }))} disabled={guardando || esGerente} />
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
                <select className={styles.input} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} disabled={guardando || esGerente}>
                  <option value="">Sin justificación</option>
                  {TIPOS_JUSTIFICACION.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
                {!esGerente && (
                  <span className={styles.inputHint}>
                    Justifica el día como vacaciones, incapacidad u otro motivo.
                  </span>
                )}
              </div>

              {form.tipo && (
                <div className={styles.campo}>
                  <label className={styles.etiqueta}>Nota (opcional)</label>
                  <input type="text" className={styles.input} placeholder="Ej. Incapacidad IMSS folio 12345" maxLength={300} value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} disabled={guardando || esGerente} />
                </div>
              )}
            </div>

            <div className={styles.modalPie}>
              {esGerente ? (
                <button className={styles.btnCancelar} onClick={cerrarModal}>Cerrar</button>
              ) : (
                <>
                  {diasMes[diaModal.fecha]?.corregido && (
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
    </div>
  );
}
