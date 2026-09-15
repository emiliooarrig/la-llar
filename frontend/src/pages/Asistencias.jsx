import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import BarraFiltros from '../components/BarraFiltros';
import EstadoDato from '../components/EstadoDato';
import {
  IconoChevron, IconoDescargar, IconoCandado, IconoCalendario, IconoAlerta, IconoInfo,
} from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { confirmar, toast, avisoError } from '../lib/alertas';
import { aDatetimeLocal } from '../lib/ventanas';
import styles from './Asistencias.module.css';

/* ── Constantes de calendario ───────────────────────────── */
const DIAS_SEMANA = [
  { iso: 1, corta: 'Lun' }, { iso: 2, corta: 'Mar' }, { iso: 3, corta: 'Mié' },
  { iso: 4, corta: 'Jue' }, { iso: 5, corta: 'Vie' }, { iso: 6, corta: 'Sáb' },
  { iso: 7, corta: 'Dom' },
];
const NOMBRE_DIA_ISO = Object.fromEntries(DIAS_SEMANA.map(d => [d.iso, d.corta]));
const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPOS_JUSTIFICACION = [
  { valor: 'vacaciones', etiqueta: 'Vacaciones' },
  { valor: 'incapacidad', etiqueta: 'Incapacidad' },
  { valor: 'permiso', etiqueta: 'Permiso' },
  { valor: 'falta_justificada', etiqueta: 'Falta justificada' },
];
const ETIQUETA_JUST = Object.fromEntries(TIPOS_JUSTIFICACION.map(t => [t.valor, t.etiqueta]));

const pad = n => String(n).padStart(2, '0');
const mesActual = () => { const h = new Date(); return `${h.getFullYear()}-${pad(h.getMonth() + 1)}`; };
const HOY_STR = (() => { const h = new Date(); return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`; })();

// "1,2,3,4,5,6" → Set{1..6}. Sin dato, de lunes a sábado.
function parseDiasLaborales(str) {
  if (!str) return new Set([1, 2, 3, 4, 5, 6]);
  const dias = String(str).split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 7);
  return new Set(dias.length ? dias : [1, 2, 3, 4, 5, 6]);
}

// getDay(): 0=domingo … 6=sábado → ISO 1=lunes … 7=domingo.
const isoDeFecha = fecha => { const d = new Date(`${fecha}T00:00:00`).getDay(); return d === 0 ? 7 : d; };

/** Matriz de semanas (lunes a domingo) para un mes 'YYYY-MM'. */
function construirCalendario(mes) {
  const [y, m] = mes.split('-').map(Number);
  const diasEnMes = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;

  const celdas = Array(offset).fill(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push({ dia: d, fecha: `${mes}-${pad(d)}` });
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

// Minutos trabajados = última salida − primera entrada (sólo días cerrados).
function minutosTrabajados(dia) {
  if (!dia?.entrada || !dia?.salida) return 0;
  const [eh, em] = dia.entrada.split(':').map(Number);
  const [sh, sm] = dia.salida.split(':').map(Number);
  const diff = (sh * 60 + sm) - (eh * 60 + em);
  return diff > 0 ? diff : 0;
}

function formatearHoras(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0 && m === 0) return '0h';
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDatetime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Estado del permiso temporal de edición para gerentes. */
function estadoPermiso(v) {
  if (!v) return { clave: 'cerrado', texto: 'Sin permiso vigente' };
  const ahora = new Date();
  if (v.desde && v.hasta) {
    if (ahora < new Date(v.desde)) return { clave: 'programado', texto: `Programado · inicia el ${formatDatetime(v.desde)}` };
    if (ahora <= new Date(v.hasta)) return { clave: 'activo', texto: `Activo · termina el ${formatDatetime(v.hasta)}` };
    return { clave: 'cerrado', texto: 'Permiso vencido' };
  }
  return v.abierta
    ? { clave: 'activo', texto: 'Activo (sin fecha de término)' }
    : { clave: 'cerrado', texto: 'Sin permiso vigente' };
}

const FORM_DIA = { entrada: '', salida: '', tipo: '', nota: '' };

export default function Asistencias() {
  const { usuario } = useAuth();
  const esGerente = usuario?.rol === 'gerente';

  /* Los filtros viven en la URL: así el administrador puede mandarle a un
     gerente el mes exacto de un empleado, y recargar no pierde el sitio. */
  const { filtros, setFiltro, setFiltros } = useFiltrosURL({ unidad: '', empleado: '', mes: mesActual() });
  const { unidad, empleado: empleadoSel, mes } = filtros;

  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [errorBase, setErrorBase] = useState(null);

  const [diasMes, setDiasMes] = useState({});
  const [cargandoMes, setCargandoMes] = useState(false);

  const [diaModal, setDiaModal] = useState(null);
  const [form, setForm] = useState(FORM_DIA);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const [descargando, setDescargando] = useState(false);

  const [ventanaEdicion, setVentanaEdicion] = useState(null);
  const [modalPermiso, setModalPermiso] = useState(false);
  const [formPermiso, setFormPermiso] = useState({ desde: '', hasta: '' });
  const [erroresPermiso, setErroresPermiso] = useState({});
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);

  /* ── Carga base ─────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [s, e, v] = await Promise.all([
          api.get('/sucursales'),
          api.get('/empleados'),
          // Si falla, se asume cerrado; no debe bloquear la página.
          api.get('/ventanas/asistencias').catch(() => null),
        ]);
        setVentanaEdicion(v?.data ?? null);
        setEmpleados(e.data);

        // El gerente sólo opera sobre su unidad: se preselecciona y el
        // selector se limita a esa única sucursal.
        if (esGerente && usuario?.sucursal_id) {
          setSucursales(s.data.filter(x => x.id === usuario.sucursal_id));
          if (unidad !== String(usuario.sucursal_id)) setFiltro('unidad', String(usuario.sucursal_id));
        } else {
          setSucursales(s.data);
        }
      } catch {
        setErrorBase('No se pudieron obtener las unidades y la plantilla.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esGerente, usuario?.sucursal_id]);

  const empleadosUnidad = useMemo(() => {
    if (!unidad) return [];
    return empleados
      .filter(e => e.sucursal_id === Number(unidad) && e.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [empleados, unidad]);

  /* ── Mes del empleado seleccionado ──────────────────────── */
  useEffect(() => {
    if (!empleadoSel) { setDiasMes({}); return undefined; }
    let cancelado = false;
    (async () => {
      setCargandoMes(true);
      try {
        const { data } = await api.get('/asistencias', { params: { empleado_id: empleadoSel, mes } });
        if (cancelado) return;
        setDiasMes(Object.fromEntries(data.dias.map(d => [d.fecha, d])));
      } catch {
        if (!cancelado) await avisoError('No se pudieron cargar las asistencias del mes.');
      } finally {
        if (!cancelado) setCargandoMes(false);
      }
    })();
    return () => { cancelado = true; };
  }, [empleadoSel, mes]);

  const semanas = useMemo(() => construirCalendario(mes), [mes]);
  const empleadoActual = empleadosUnidad.find(e => e.id === Number(empleadoSel));

  const permiso = estadoPermiso(ventanaEdicion);
  const puedeEditar = !esGerente || permiso.clave === 'activo';

  const sucursalActual = sucursales.find(s => s.id === Number(unidad));
  const diasLaborales = useMemo(
    () => parseDiasLaborales(sucursalActual?.dias_laborales),
    [sucursalActual?.dias_laborales],
  );
  const etiquetaDiasLaborales = useMemo(
    () => [...diasLaborales].sort((a, b) => a - b).map(n => NOMBRE_DIA_ISO[n]).join(', '),
    [diasLaborales],
  );

  /* ── Resumen del mes ────────────────────────────────────── */
  const resumen = useMemo(() => {
    if (!empleadoSel) return null;

    const porSemana = semanas.map(semana => {
      let minutos = 0, completos = 0, incompletos = 0, justificados = 0, faltas = 0;
      let primera = null, ultima = null, contieneHoy = false;

      for (const celda of semana) {
        if (!celda) continue;
        if (!primera) primera = celda;
        ultima = celda;
        if (celda.fecha === HOY_STR) contieneHoy = true;

        const dia = diasMes[celda.fecha];
        minutos += minutosTrabajados(dia);

        if (dia?.justificacion) justificados++;
        else if (dia?.entrada && dia?.salida) completos++;
        else if (dia?.entrada || dia?.salida) incompletos++;
        else if (celda.fecha < HOY_STR && diasLaborales.has(isoDeFecha(celda.fecha))) faltas++;
      }

      return { primera, ultima, minutos, completos, incompletos, justificados, faltas, contieneHoy };
    }).filter(s => s.primera);

    const total = porSemana.reduce((acc, s) => ({
      minutos: acc.minutos + s.minutos,
      completos: acc.completos + s.completos,
      incompletos: acc.incompletos + s.incompletos,
      justificados: acc.justificados + s.justificados,
      faltas: acc.faltas + s.faltas,
    }), { minutos: 0, completos: 0, incompletos: 0, justificados: 0, faltas: 0 });

    return { porSemana, total };
  }, [empleadoSel, semanas, diasMes, diasLaborales]);

  /* ── Navegación ─────────────────────────────────────────── */
  function cambiarMes(delta) {
    const [y, m] = mes.split('-').map(Number);
    const nuevo = new Date(y, m - 1 + delta, 1);
    setFiltro('mes', `${nuevo.getFullYear()}-${pad(nuevo.getMonth() + 1)}`);
  }

  function cambiarUnidad(valor) {
    // Un solo cambio: cambiar de unidad invalida al empleado elegido.
    setFiltros({ unidad: valor, empleado: '' });
    setDiasMes({});
  }

  /* ── Día ────────────────────────────────────────────────── */
  function abrirDia(celda) {
    if (!celda || !empleadoSel) return;
    const dia = diasMes[celda.fecha];
    setErrores({});
    setForm({
      entrada: dia?.entrada || '',
      salida: dia?.salida || '',
      tipo: dia?.justificacion?.tipo || '',
      nota: dia?.justificacion?.nota || '',
    });
    setDiaModal(celda);
  }

  async function guardarDia(e) {
    e.preventDefault();
    if (form.entrada && form.salida && form.salida < form.entrada) {
      setErrores({ salida: 'La salida no puede ser anterior a la entrada.' });
      return;
    }

    setGuardando(true);
    try {
      const { data } = await api.put('/asistencias/dia', {
        empleado_id: Number(empleadoSel),
        fecha: diaModal.fecha,
        entrada: form.entrada || null,
        salida: form.salida || null,
        justificacion: form.tipo ? { tipo: form.tipo, nota: form.nota } : null,
      });
      setDiasMes(prev => ({ ...prev, [diaModal.fecha]: { fecha: diaModal.fecha, ...data } }));
      setDiaModal(null);
      toast('Día actualizado');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo guardar el día.');
    } finally {
      setGuardando(false);
    }
  }

  /* Revertir descarta una corrección manual: se confirma. */
  async function revertirDia() {
    const ok = await confirmar({
      titulo: '¿Revertir la corrección?',
      texto: 'El día volverá a mostrar las marcas originales del checador. La justificación se conserva.',
      confirmar: 'Revertir al checador',
    });
    if (!ok) return;

    setGuardando(true);
    try {
      const { data } = await api.put('/asistencias/dia', {
        empleado_id: Number(empleadoSel),
        fecha: diaModal.fecha,
        revertir: true,
        justificacion: form.tipo ? { tipo: form.tipo, nota: form.nota } : null,
      });
      setDiasMes(prev => ({ ...prev, [diaModal.fecha]: { fecha: diaModal.fecha, ...data } }));
      setDiaModal(null);
      toast('Corrección revertida');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo revertir la corrección.');
    } finally {
      setGuardando(false);
    }
  }

  /* ── Reporte PDF ────────────────────────────────────────── */
  async function descargarReporte() {
    if (!unidad || descargando) return;
    setDescargando(true);
    try {
      const res = await api.get('/asistencias/reporte', {
        params: { sucursal_id: unidad, mes },
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
    } catch (err) {
      // El error llega como Blob (responseType); intentamos leer el mensaje.
      let mensaje = 'No se pudo generar el reporte.';
      if (err.response?.data instanceof Blob) {
        try { mensaje = JSON.parse(await err.response.data.text()).error || mensaje; } catch { /* noop */ }
      }
      await avisoError(mensaje);
    } finally {
      setDescargando(false);
    }
  }

  /* ── Permiso de edición para gerentes ───────────────────── */
  function abrirPermiso() {
    setFormPermiso({ desde: aDatetimeLocal(ventanaEdicion?.desde), hasta: aDatetimeLocal(ventanaEdicion?.hasta) });
    setErroresPermiso({});
    setModalPermiso(true);
  }

  async function otorgarPermiso(e) {
    e.preventDefault();
    const fallos = {};
    if (!formPermiso.desde) fallos.desde = 'Indica cuándo empieza.';
    if (!formPermiso.hasta) fallos.hasta = 'Indica cuándo termina.';
    if (formPermiso.desde && formPermiso.hasta && new Date(formPermiso.hasta) <= new Date(formPermiso.desde)) {
      fallos.hasta = 'El término debe ser posterior al inicio.';
    }
    setErroresPermiso(fallos);
    if (Object.keys(fallos).length > 0) return;

    setGuardandoPermiso(true);
    try {
      const { data } = await api.put('/ventanas/asistencias/programacion', {
        desde: new Date(formPermiso.desde).toISOString(),
        hasta: new Date(formPermiso.hasta).toISOString(),
      });
      setVentanaEdicion(data);
      setModalPermiso(false);
      toast(`Permiso vigente hasta el ${formatDatetime(data.hasta)}`);
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo otorgar el permiso.');
    } finally {
      setGuardandoPermiso(false);
    }
  }

  async function revocarPermiso() {
    const ok = await confirmar({
      titulo: '¿Revocar el permiso?',
      texto: 'Los gerentes dejarán de poder editar asistencias de inmediato.',
      confirmar: 'Revocar permiso',
      destructivo: true,
    });
    if (!ok) return;

    setGuardandoPermiso(true);
    try {
      let res = await api.delete('/ventanas/asistencias/programacion');
      // Por si la ventana quedó abierta en modo manual, se cierra también.
      if (res.data.abierta) res = await api.patch('/ventanas/asistencias');
      setVentanaEdicion(res.data);
      setModalPermiso(false);
      toast('Permiso revocado');
    } catch {
      await avisoError('No se pudo revocar el permiso.');
    } finally {
      setGuardandoPermiso(false);
    }
  }

  const [anio, numMes] = mes.split('-').map(Number);
  const diaSeleccionado = diaModal ? diasMes[diaModal.fecha] : null;

  return (
    <Layout
      titulo="Asistencias"
      subtitulo={esGerente
        ? (puedeEditar
            ? 'Consulta y corrección temporal de las marcas de tu unidad.'
            : 'Entradas y salidas de tu unidad. Sólo lectura hasta que el administrador habilite la edición.')
        : 'Calendario de entradas y salidas por unidad y empleado.'}
      migas={[{ etiqueta: 'Asistencias' }]}
      acciones={
        <>
          {!esGerente && (
            <button
              type="button" className="btn btn--neutro" onClick={abrirPermiso}
              title="Habilitar temporalmente que los gerentes corrijan asistencias"
            >
              <IconoCandado abierto={permiso.clave === 'activo'} />
              Permiso de gerentes
            </button>
          )}
          <button
            type="button" className="btn btn--primario"
            onClick={descargarReporte}
            disabled={!unidad || descargando}
            title={unidad ? 'Descargar el reporte PDF de la unidad' : 'Elige una unidad para generar el reporte'}
          >
            {descargando ? <><span className="spinner" /> Generando…</> : <><IconoDescargar /> Reporte PDF</>}
          </button>
        </>
      }
    >
      {errorBase && (
        <div className="aviso aviso--error" role="alert">
          <IconoAlerta /><span>{errorBase}</span>
        </div>
      )}

      {esGerente && puedeEditar && (
        <div className="aviso aviso--exito">
          <IconoCandado abierto />
          <span>
            <strong>Edición habilitada.</strong> El administrador te dio permiso para corregir asistencias
            {ventanaEdicion?.hasta ? <> hasta el <strong>{formatDatetime(ventanaEdicion.hasta)}</strong>.</> : '.'}
          </span>
        </div>
      )}

      <BarraFiltros
        campos={[
          {
            etiqueta: 'Unidad',
            valor: unidad,
            onChange: cambiarUnidad,
            desactivado: esGerente,
            opciones: [
              ...(esGerente ? [] : [{ valor: '', texto: 'Elige una unidad…' }]),
              ...sucursales.map(s => ({ valor: String(s.id), texto: s.nombre })),
            ],
          },
          {
            etiqueta: 'Empleado',
            valor: empleadoSel,
            onChange: v => setFiltro('empleado', v),
            desactivado: !unidad,
            opciones: [
              { valor: '', texto: unidad ? 'Elige un empleado…' : 'Primero elige una unidad' },
              ...empleadosUnidad.map(e => ({ valor: String(e.id), texto: e.nombre })),
            ],
          },
        ]}
      />

      <div className={`${styles.leyenda} no-imprimir`}>
        <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoCompleta}`} /> Completa</span>
        <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoIncompleta}`} /> Incompleta</span>
        <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoJustificada}`} /> Justificada</span>
        <span className={styles.leyendaItem}><i className={`${styles.punto} ${styles.puntoSinDatos}`} /> Sin registro</span>
      </div>

      <section className={styles.calendario}>
        <div className={styles.barraMes}>
          <button type="button" className={styles.btnMes} onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
            <IconoChevron dir="izquierda" tamano={16} />
          </button>
          <h2 className={styles.tituloMes}>{NOMBRES_MES[numMes - 1]} {anio}</h2>
          <button type="button" className={styles.btnMes} onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
            <IconoChevron dir="derecha" tamano={16} />
          </button>
        </div>

        {!empleadoSel ? (
          <EstadoDato
            estado="vacio"
            icono={IconoCalendario}
            titulo="Elige una unidad y un empleado"
            texto="El calendario mostrará sus entradas, salidas y justificaciones del mes."
          />
        ) : (
          <div className={styles.rejilla}>
            {cargandoMes && <div className={styles.velo}><span className="spinner spinner--lg" /></div>}

            <div className={styles.semana}>
              {DIAS_SEMANA.map(d => (
                <div
                  key={d.iso}
                  className={`${styles.cabeceraDia} ${diasLaborales.has(d.iso) ? '' : styles.cabeceraDiaLibre}`}
                >
                  {d.corta}
                </div>
              ))}
            </div>

            {semanas.map((semana, i) => (
              <div key={i} className={styles.semana}>
                {semana.map((celda, j) => {
                  if (!celda) return <div key={j} className={styles.celdaVacia} />;
                  const dia = diasMes[celda.fecha];
                  const estado = estadoDia(dia);
                  const esHoy = celda.fecha === HOY_STR;
                  const esFuturo = celda.fecha > HOY_STR;
                  const esLaboral = diasLaborales.has(isoDeFecha(celda.fecha));
                  return (
                    <button
                      key={j}
                      type="button"
                      className={[
                        styles.celda,
                        styles[`celda_${estado}`],
                        esHoy ? styles.celdaHoy : '',
                        esFuturo ? styles.celdaFuturo : '',
                        !esLaboral && !esFuturo ? styles.celdaNoLaboral : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => abrirDia(celda)}
                      aria-label={`${celda.dia} de ${NOMBRES_MES[numMes - 1]}`}
                    >
                      <span className={styles.filaNumero}>
                        <span className={styles.numeroDia}>{celda.dia}</span>
                        {dia?.corregido && <i className={styles.corregido} title="Día corregido a mano" />}
                      </span>

                      {dia?.justificacion ? (
                        <span className={styles.etiquetaJust}>{ETIQUETA_JUST[dia.justificacion.tipo]}</span>
                      ) : (dia?.entrada || dia?.salida) ? (
                        <span className={styles.horario}>
                          <span className={styles.horaE}>{dia.entrada || '—'}</span>
                          <span className={styles.horaS}>{dia.salida || '—'}</span>
                        </span>
                      ) : (
                        <span className={styles.sinRegistro}>
                          {esFuturo ? '' : esLaboral ? 'Sin registro' : 'Descanso'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {empleadoSel && resumen && (
        <section className={styles.resumen}>
          <h2 className="seccion__titulo">
            Resumen del mes · {empleadoActual?.nombre}
          </h2>

          <div className={styles.resumenBanda}>
            <div className={styles.horasCifra}>
              <span className={styles.horasNumero}>{formatearHoras(resumen.total.minutos)}</span>
              <span className={styles.horasEtiqueta}>trabajadas en {NOMBRES_MES[numMes - 1].toLowerCase()}</span>
            </div>
            <div className={styles.desglose}>
              <span className={`${styles.desgloseItem} ${resumen.total.faltas > 0 ? styles.faltasAlerta : ''}`}>
                <span className={styles.desgloseNumero}>{resumen.total.faltas}</span>
                <span className={styles.desgloseEtiqueta}>Faltas</span>
              </span>
              <span className={styles.desgloseItem}>
                <span className={styles.desgloseNumero}>{resumen.total.completos}</span>
                <span className={styles.desgloseEtiqueta}>Completos</span>
              </span>
              <span className={styles.desgloseItem}>
                <span className={styles.desgloseNumero}>{resumen.total.incompletos}</span>
                <span className={styles.desgloseEtiqueta}>Incompletos</span>
              </span>
              <span className={styles.desgloseItem}>
                <span className={styles.desgloseNumero}>{resumen.total.justificados}</span>
                <span className={styles.desgloseEtiqueta}>Justificados</span>
              </span>
            </div>
          </div>

          <div className={`tabla-marco ${styles.tablaSemanas}`}>
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Semana</th>
                  <th scope="col" className="th-num">Horas</th>
                  <th scope="col" className="th-num">Completos</th>
                  <th scope="col" className="th-num">Incompletos</th>
                  <th scope="col" className="th-num">Justificados</th>
                  <th scope="col" className="th-num">Faltas</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porSemana.map((s, i) => (
                  <tr key={i} className={s.contieneHoy ? styles.filaActual : ''}>
                    <td>
                      Día {s.primera.dia}–{s.ultima.dia}
                      {s.contieneHoy && <span className={styles.badgeActual}>En curso</span>}
                    </td>
                    <td className={`col-num ${styles.celHoras}`}>{formatearHoras(s.minutos)}</td>
                    <td className="col-num">{s.completos}</td>
                    <td className="col-num">{s.incompletos}</td>
                    <td className="col-num">{s.justificados}</td>
                    <td className={`col-num ${s.faltas > 0 ? styles.celFalta : ''}`}>{s.faltas}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total del mes</strong></td>
                  <td className={`col-num ${styles.celHoras}`}>{formatearHoras(resumen.total.minutos)}</td>
                  <td className="col-num">{resumen.total.completos}</td>
                  <td className="col-num">{resumen.total.incompletos}</td>
                  <td className="col-num">{resumen.total.justificados}</td>
                  <td className={`col-num ${resumen.total.faltas > 0 ? styles.celFalta : ''}`}>{resumen.total.faltas}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className={styles.nota}>
            Las horas son la diferencia entre la primera entrada y la última salida de cada día.
            Una <strong>falta</strong> es un día laboral ya transcurrido sin registro ni justificación.
            Días laborales de esta unidad: <strong>{etiquetaDiasLaborales}</strong>.
          </p>
        </section>
      )}

      {/* ── Modal de día ── */}
      {diaModal && (
        <Modal
          titulo={new Date(`${diaModal.fecha}T00:00:00`).toLocaleDateString('es-MX',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          subtitulo={empleadoActual?.nombre}
          onCerrar={() => setDiaModal(null)}
          bloqueado={guardando}
          pie={puedeEditar ? (
            <>
              {/* Revertir borra una corrección que pudo hacer el administrador. */}
              {!esGerente && diaSeleccionado?.corregido && (
                <button type="button" className="btn btn--fantasma" onClick={revertirDia} disabled={guardando}>
                  Revertir al checador
                </button>
              )}
              <button type="button" className="btn btn--neutro" onClick={() => setDiaModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-dia" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />} Guardar día
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--neutro" onClick={() => setDiaModal(null)}>Cerrar</button>
          )}
        >
          <form id="form-dia" onSubmit={guardarDia} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <div className={styles.filaDoble}>
              <Campo etiqueta="Entrada" id="d-entrada">
                <input
                  id="d-entrada" type="time" className="control"
                  value={form.entrada} onChange={e => setForm(p => ({ ...p, entrada: e.target.value }))}
                  disabled={guardando || !puedeEditar} data-foco-inicial
                />
              </Campo>
              <Campo etiqueta="Salida" id="d-salida" error={errores.salida}>
                <input
                  id="d-salida" type="time"
                  className={`control${errores.salida ? ' control--invalido' : ''}`}
                  value={form.salida}
                  onChange={e => { setForm(p => ({ ...p, salida: e.target.value })); setErrores({}); }}
                  disabled={guardando || !puedeEditar}
                />
              </Campo>
            </div>

            {diaSeleccionado?.corregido && (
              <div className="aviso aviso--atencion">
                <IconoInfo />
                <span>
                  Día corregido a mano. Marcas originales del checador:{' '}
                  <span className={styles.original}>
                    {diaSeleccionado.original?.entrada || '—'} / {diaSeleccionado.original?.salida || '—'}
                  </span>. Las marcas crudas no se modifican.
                </span>
              </div>
            )}

            <p className={styles.divisor}>Justificación</p>

            <Campo
              etiqueta="Tipo" id="d-tipo"
              pista={puedeEditar ? 'Un día justificado no cuenta como falta en el resumen.' : undefined}
            >
              <select
                id="d-tipo" className="control" value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                disabled={guardando || !puedeEditar}
              >
                <option value="">Sin justificación</option>
                {TIPOS_JUSTIFICACION.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
              </select>
            </Campo>

            {form.tipo && (
              <Campo etiqueta="Nota" id="d-nota" opcional>
                <input
                  id="d-nota" type="text" className="control" maxLength={300}
                  placeholder="Ej. Incapacidad IMSS folio 12345"
                  value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                  disabled={guardando || !puedeEditar}
                />
              </Campo>
            )}
          </form>
        </Modal>
      )}

      {/* ── Modal de permiso ── */}
      {modalPermiso && (
        <Modal
          titulo="Permiso de edición para gerentes"
          subtitulo="Aplica a todas las unidades"
          onCerrar={() => setModalPermiso(false)}
          bloqueado={guardandoPermiso}
          pie={
            <>
              {(ventanaEdicion?.desde || ventanaEdicion?.abierta) && (
                <button type="button" className="btn btn--peligro" onClick={revocarPermiso} disabled={guardandoPermiso}>
                  Revocar
                </button>
              )}
              <button type="button" className="btn btn--neutro" onClick={() => setModalPermiso(false)} disabled={guardandoPermiso}>
                Cancelar
              </button>
              <button type="submit" form="form-permiso" className="btn btn--primario" disabled={guardandoPermiso}>
                {guardandoPermiso && <span className="spinner" />} Otorgar permiso
              </button>
            </>
          }
        >
          <form id="form-permiso" onSubmit={otorgarPermiso} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <div className={`aviso aviso--${permiso.clave === 'activo' ? 'exito' : 'atencion'}`} style={{ marginBottom: 0 }}>
              <IconoCandado abierto={permiso.clave === 'activo'} />
              <span>{permiso.texto}</span>
            </div>

            <p className="pista">
              Durante el intervalo indicado, cada gerente podrá corregir entradas y salidas y justificar
              días de los empleados de <strong>su propia unidad</strong>. Al terminar, el acceso vuelve
              a ser de sólo lectura automáticamente.
            </p>

            <div className={styles.filaDoble}>
              <Campo etiqueta="Inicio" id="p-desde" error={erroresPermiso.desde}>
                <input
                  id="p-desde" type="datetime-local"
                  className={`control${erroresPermiso.desde ? ' control--invalido' : ''}`}
                  value={formPermiso.desde}
                  onChange={e => setFormPermiso(p => ({ ...p, desde: e.target.value }))}
                  disabled={guardandoPermiso} data-foco-inicial
                />
              </Campo>
              <Campo etiqueta="Término" id="p-hasta" error={erroresPermiso.hasta}>
                <input
                  id="p-hasta" type="datetime-local"
                  className={`control${erroresPermiso.hasta ? ' control--invalido' : ''}`}
                  value={formPermiso.hasta}
                  min={formPermiso.desde}
                  onChange={e => setFormPermiso(p => ({ ...p, hasta: e.target.value }))}
                  disabled={guardandoPermiso}
                />
              </Campo>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
