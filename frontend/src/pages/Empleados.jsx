import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import TablaDatos from '../components/TablaDatos';
import BarraFiltros from '../components/BarraFiltros';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import Insignia from '../components/Insignia';
import { IconoMas, IconoLapiz, IconoOjo, IconoOjoOff } from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { formatFecha, normalizar } from '../lib/formato';
import { confirmar, toast, avisoError } from '../lib/alertas';
import styles from './Empleados.module.css';

const FORM_VACIO = { nombre: '', lector_uid: '', sucursal_id: '', fecha_nacimiento: '', rfc: '', curp: '' };
const FILTROS_BASE = { q: '', estado: 'todos', unidad: '' };

/* La fecha de nacimiento es un campo sólo-fecha (@db.Date): se formatea
   desde la porción 'YYYY-MM-DD' para evitar el corrimiento de día que
   provoca interpretar la medianoche UTC en la zona local. */
function formatFechaSolo(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
const fechaInput = iso => (iso ? iso.slice(0, 10) : '');

function ordenar(a, b) {
  return Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es');
}

function validar(form) {
  const e = {};
  if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  if (!form.lector_uid.trim()) e.lector_uid = 'El UID del checador es obligatorio.';
  if (!form.sucursal_id) e.sucursal_id = 'Asigna una unidad.';
  if (form.rfc && form.rfc.trim().length < 12) e.rfc = 'Un RFC tiene 12 o 13 caracteres.';
  if (form.curp && form.curp.trim().length !== 18) e.curp = 'La CURP tiene 18 caracteres.';
  return e;
}

export default function Empleados() {
  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [e, s] = await Promise.all([api.get('/empleados'), api.get('/sucursales')]);
      setEmpleados([...e.data].sort(ordenar));
      setSucursales(s.data);
    } catch {
      setError('No se pudo obtener la plantilla. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  const filtrados = useMemo(() => {
    const q = normalizar(filtros.q);
    return empleados.filter(emp => {
      const texto = !q
        || normalizar(emp.nombre).includes(q)
        || normalizar(emp.lector_uid).includes(q)
        || normalizar(emp.rfc || '').includes(q)
        || normalizar(emp.curp || '').includes(q);
      const estado = filtros.estado === 'todos'
        || (filtros.estado === 'activos' && emp.activo)
        || (filtros.estado === 'inactivos' && !emp.activo);
      const unidad = !filtros.unidad || emp.sucursal_id === Number(filtros.unidad);
      return texto && estado && unidad;
    });
  }, [empleados, filtros]);

  function abrirCrear() {
    setForm(FORM_VACIO);
    setErrores({});
    setModal({ modo: 'crear', editando: null });
  }

  function abrirEditar(emp) {
    setForm({
      nombre: emp.nombre,
      lector_uid: emp.lector_uid,
      sucursal_id: String(emp.sucursal_id),
      fecha_nacimiento: fechaInput(emp.fecha_nacimiento),
      rfc: emp.rfc ?? '',
      curp: emp.curp ?? '',
    });
    setErrores({});
    setModal({ modo: 'editar', editando: emp });
  }

  function cambiar(campo, valor) {
    setForm(p => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: undefined }));
  }

  async function guardar(e) {
    e.preventDefault();
    const fallos = validar(form);
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    const payload = {
      nombre: form.nombre.trim(),
      lector_uid: form.lector_uid.trim(),
      sucursal_id: form.sucursal_id,
      fecha_nacimiento: form.fecha_nacimiento || null,
      rfc: form.rfc.trim().toUpperCase() || null,
      curp: form.curp.trim().toUpperCase() || null,
    };

    setGuardando(true);
    try {
      if (modal.modo === 'crear') {
        const { data } = await api.post('/empleados', payload);
        setEmpleados(prev => [data, ...prev].sort(ordenar));
      } else {
        const { data } = await api.put(`/empleados/${modal.editando.id}`, payload);
        setEmpleados(prev => prev.map(x => (x.id === data.id ? data : x)).sort(ordenar));
      }
      setModal(null);
      toast(modal.modo === 'crear' ? 'Empleado dado de alta' : 'Cambios guardados');
    } catch (err) {
      const mensaje = err.response?.data?.error || 'Ocurrió un error al guardar.';
      /* El choque típico es un `lector_uid` ya usado en esa unidad. */
      if (/uid|lector/i.test(mensaje)) setErrores({ lector_uid: mensaje });
      else await avisoError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  /* Dar de baja saca a la persona de las listas de asistencia: se confirma. */
  async function alternarActivo(emp) {
    const ok = await confirmar({
      titulo: emp.activo ? '¿Dar de baja al empleado?' : '¿Reincorporar al empleado?',
      texto: emp.activo
        ? `${emp.nombre} dejará de aparecer en las listas de asistencia. Su historial se conserva.`
        : `${emp.nombre} volverá a la plantilla activa de su unidad.`,
      confirmar: emp.activo ? 'Dar de baja' : 'Reincorporar',
      destructivo: emp.activo,
    });
    if (!ok) return;

    try {
      const { data } = await api.patch(`/empleados/${emp.id}/activo`);
      setEmpleados(prev => prev.map(x => (x.id === data.id ? data : x)).sort(ordenar));
      toast(emp.activo ? 'Empleado dado de baja' : 'Empleado reincorporado');
    } catch {
      await avisoError('No se pudo cambiar el estado del empleado.');
    }
  }

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Empleado',
      orden: e => e.nombre,
      clase: 'celda-elastica',
      render: e => (
        <span className="apilado">
          <span className={styles.nombreEmpleado}>{e.nombre}</span>
          <span className={`mono mono--chip ${styles.uid}`} title="Identificador en el checador">
            {e.lector_uid}
          </span>
        </span>
      ),
    },
    {
      clave: 'sucursal',
      titulo: 'Unidad',
      orden: e => e.sucursal?.nombre || '',
      render: e => e.sucursal?.nombre ?? '—',
    },
    {
      clave: 'identificacion',
      titulo: 'RFC / CURP',
      render: e => (
        <span className={styles.identificacion}>
          <span className="mono">{e.rfc || <span className={styles.identificacionVacia}>Sin RFC</span>}</span>
          <span className="mono apilado__sec">{e.curp || <span className={styles.identificacionVacia}>Sin CURP</span>}</span>
        </span>
      ),
    },
    {
      clave: 'fecha_nacimiento',
      titulo: 'Nacimiento',
      orden: e => e.fecha_nacimiento,
      clase: 'col-fecha',
      render: e => formatFechaSolo(e.fecha_nacimiento),
    },
    {
      clave: 'activo',
      titulo: 'Estado',
      orden: e => Number(e.activo),
      render: e => <Insignia tono={e.activo ? 'exito' : 'neutro'}>{e.activo ? 'Activo' : 'Baja'}</Insignia>,
    },
    {
      clave: 'creado_en',
      titulo: 'Alta',
      orden: e => e.creado_en,
      clase: 'col-fecha',
      render: e => formatFecha(e.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: e => (
        <span className="acciones-fila">
          <button
            type="button" className="btn-icono tono-naranja" onClick={() => abrirEditar(e)}
            title="Editar empleado" aria-label={`Editar a ${e.nombre}`}
          >
            <IconoLapiz />
          </button>
          <button
            type="button"
            className={`btn-icono ${e.activo ? 'tono-error' : 'tono-exito'}`}
            onClick={() => alternarActivo(e)}
            title={e.activo ? 'Dar de baja' : 'Reincorporar'}
            aria-label={`${e.activo ? 'Dar de baja a' : 'Reincorporar a'} ${e.nombre}`}
          >
            {e.activo ? <IconoOjoOff /> : <IconoOjo />}
          </button>
        </span>
      ),
    },
  ];

  const modo = modal?.modo;

  return (
    <Layout
      titulo="Empleados"
      subtitulo="La plantilla que registra entradas y salidas en los checadores."
      migas={[{ etiqueta: 'Empleados' }]}
      acciones={
        <button type="button" className="btn btn--primario" onClick={abrirCrear}>
          <IconoMas /> Nuevo empleado
        </button>
      }
    >
      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: 'Buscar por nombre, UID, RFC o CURP…',
        }}
        campos={[
          {
            etiqueta: 'Unidad',
            valor: filtros.unidad,
            onChange: v => setFiltro('unidad', v),
            opciones: [{ valor: '', texto: 'Todas las unidades' },
              ...sucursales.map(s => ({ valor: String(s.id), texto: s.nombre }))],
          },
          {
            etiqueta: 'Estado',
            valor: filtros.estado,
            onChange: v => setFiltro('estado', v),
            opciones: [
              { valor: 'todos', texto: 'Todos' },
              { valor: 'activos', texto: 'Activos' },
              { valor: 'inactivos', texto: 'Dados de baja' },
            ],
          },
        ]}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <TablaDatos
        columnas={columnas}
        filas={filtrados}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        claseFila={e => (e.activo ? undefined : 'fila-inactiva')}
        etiqueta="empleados"
        totalSinFiltrar={empleados.length}
        claveFiltros={clave}
        vacio={{
          titulo: hayFiltros ? 'Ningún empleado coincide' : 'La plantilla está vacía',
          texto: hayFiltros
            ? 'Prueba con otro término o limpia los filtros.'
            : 'Da de alta al primer empleado para que el checador pueda reconocerlo.',
        }}
      />

      {modal && (
        <Modal
          titulo={modo === 'crear' ? 'Nuevo empleado' : 'Editar empleado'}
          subtitulo={modo === 'editar' ? modal.editando.nombre : undefined}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-empleado" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />}
                {modo === 'crear' ? 'Dar de alta' : 'Guardar cambios'}
              </button>
            </>
          }
        >
          <form id="form-empleado" onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <Campo etiqueta="Nombre completo" id="e-nombre" error={errores.nombre}>
              <input
                id="e-nombre" className={`control${errores.nombre ? ' control--invalido' : ''}`}
                type="text" placeholder="Ej. Ana Beltrán Cruz"
                value={form.nombre} onChange={ev => cambiar('nombre', ev.target.value)}
                disabled={guardando} data-foco-inicial
              />
            </Campo>

            <div className={styles.filaDoble}>
              <Campo
                etiqueta="UID del checador" id="e-uid" error={errores.lector_uid}
                pista="Único dentro de la unidad."
              >
                <input
                  id="e-uid" className={`control mono${errores.lector_uid ? ' control--invalido' : ''}`}
                  type="text" placeholder="Ej. 0042"
                  value={form.lector_uid} onChange={ev => cambiar('lector_uid', ev.target.value)}
                  disabled={guardando}
                />
              </Campo>

              <Campo etiqueta="Unidad" id="e-unidad" error={errores.sucursal_id}>
                <select
                  id="e-unidad" className={`control${errores.sucursal_id ? ' control--invalido' : ''}`}
                  value={form.sucursal_id} onChange={ev => cambiar('sucursal_id', ev.target.value)}
                  disabled={guardando}
                >
                  <option value="">Seleccionar unidad…</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Campo>
            </div>

            <Campo etiqueta="Fecha de nacimiento" id="e-nacimiento" opcional>
              <input
                id="e-nacimiento" className="control" type="date"
                value={form.fecha_nacimiento} onChange={ev => cambiar('fecha_nacimiento', ev.target.value)}
                disabled={guardando}
              />
            </Campo>

            <div className={styles.filaDoble}>
              <Campo etiqueta="RFC" id="e-rfc" error={errores.rfc} opcional>
                <input
                  id="e-rfc" className={`control mono${errores.rfc ? ' control--invalido' : ''}`}
                  type="text" maxLength={13} placeholder="XAXX010101000"
                  value={form.rfc} onChange={ev => cambiar('rfc', ev.target.value.toUpperCase())}
                  disabled={guardando}
                />
              </Campo>
              <Campo etiqueta="CURP" id="e-curp" error={errores.curp} opcional>
                <input
                  id="e-curp" className={`control mono${errores.curp ? ' control--invalido' : ''}`}
                  type="text" maxLength={18} placeholder="XAXX010101HDFAAA00"
                  value={form.curp} onChange={ev => cambiar('curp', ev.target.value.toUpperCase())}
                  disabled={guardando}
                />
              </Campo>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
