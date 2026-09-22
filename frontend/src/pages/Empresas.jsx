import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import TablaDatos from '../components/TablaDatos';
import BarraFiltros from '../components/BarraFiltros';
import Modal from '../components/Modal';
import Insignia from '../components/Insignia';
import Campo from '../components/Campo';
import { IconoMas, IconoLapiz, IconoOjo, IconoOjoOff, IconoSucursal } from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { invalidarEmpresas } from '../lib/empresas';
import { normalizar } from '../lib/formato';
import { confirmar, toast, avisoError } from '../lib/alertas';
import styles from './Empresas.module.css';

/* Catálogo de empresas: las razones sociales a las que se factura
   (La Llar y Confia Alimentos). Es el catálogo más pequeño del sistema
   —dos filas que cambian una vez al año— pero el de consecuencias más
   caras: una factura clasificada en la empresa equivocada es un problema
   fiscal, no un dato mal escrito. De ahí que la baja pida confirmación y
   que renombrar avise de que arrastra los históricos. */

const NOMBRE_MAX = 120;
const FORM_VACIO = { nombre: '' };
const FILTROS_BASE = { q: '', estado: 'todos' };

function ordenarEmpresas(a, b) {
  if (a.activo !== b.activo) return Number(b.activo) - Number(a.activo);
  return a.nombre.localeCompare(b.nombre, 'es');
}

function validar(form) {
  const e = {};
  const nombre = form.nombre.trim();
  if (!nombre) e.nombre = 'El nombre de la empresa es obligatorio.';
  else if (nombre.length > NOMBRE_MAX) e.nombre = `Máximo ${NOMBRE_MAX} caracteres.`;
  return e;
}

export default function Empresas() {
  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  const [empresas, setEmpresas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);   // null | { modo, editando }
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      // El catálogo pide también las inactivas: son las únicas que se pueden
      // reactivar, y si no salen aquí no salen en ningún sitio.
      const { data } = await api.get('/empresas?incluir_inactivos=1');
      setEmpresas([...data].sort(ordenarEmpresas));
    } catch {
      setError('No se pudieron obtener las empresas. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  const filtradas = useMemo(() => {
    const q = normalizar(filtros.q);
    return empresas.filter(e => {
      const texto = !q || normalizar(e.nombre).includes(q);
      const estado = filtros.estado === 'todos'
        || (filtros.estado === 'activas' && e.activo)
        || (filtros.estado === 'inactivas' && !e.activo);
      return texto && estado;
    });
  }, [empresas, filtros]);

  /* ── Modal ──────────────────────────────────────────────── */
  function abrirCrear() {
    setForm(FORM_VACIO);
    setErrores({});
    setModal({ modo: 'crear', editando: null });
  }

  function abrirEditar(empresa) {
    setForm({ nombre: empresa.nombre });
    setErrores({});
    setModal({ modo: 'editar', editando: empresa });
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

    const payload = { nombre: form.nombre.trim() };

    setGuardando(true);
    try {
      if (modal.modo === 'crear') {
        const { data } = await api.post('/empresas', payload);
        setEmpresas(prev => [...prev, data].sort(ordenarEmpresas));
      } else {
        const { data } = await api.put(`/empresas/${modal.editando.id}`, payload);
        setEmpresas(prev => prev.map(x => (x.id === data.id ? data : x)).sort(ordenarEmpresas));
      }
      invalidarEmpresas();   // los selectores de factura y vale ya no valen
      setModal(null);
      toast(modal.modo === 'crear' ? 'Empresa creada' : 'Cambios guardados');
    } catch (err) {
      const mensaje = err.response?.data?.error || 'Ocurrió un error al guardar.';
      /* El conflicto más común es el nombre repetido: se ancla al campo en
         lugar de abrir un diálogo, para que se corrija sin perder el foco. */
      if (/ya existe|nombre/i.test(mensaje)) setErrores({ nombre: mensaje });
      else await avisoError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  /* Dar de baja una empresa no borra nada, pero la saca de los formularios
     de facturas y vales: eso sí cambia el trabajo de otras personas, así que
     se confirma diciendo exactamente qué pasa con lo ya emitido. */
  async function alternarActivo(empresa) {
    const unidades = empresa._count?.sucursales ?? 0;
    const ok = await confirmar({
      titulo: empresa.activo ? '¿Dar de baja la empresa?' : '¿Reactivar la empresa?',
      texto: empresa.activo
        ? `${empresa.nombre} dejará de aparecer al registrar facturas y vales. ` +
          `Las ya registradas conservan su empresa` +
          (unidades > 0 ? `, y sus ${unidades} ${unidades === 1 ? 'unidad seguirá asignada' : 'unidades seguirán asignadas'}.` : '.')
        : `${empresa.nombre} volverá a poder elegirse al registrar facturas y vales.`,
      confirmar: empresa.activo ? 'Dar de baja' : 'Reactivar',
      destructivo: empresa.activo,
    });
    if (!ok) return;

    try {
      const { data } = await api.patch(`/empresas/${empresa.id}/activo`);
      setEmpresas(prev => prev.map(x => (x.id === data.id ? data : x)).sort(ordenarEmpresas));
      invalidarEmpresas();
      toast(empresa.activo ? 'Empresa dada de baja' : 'Empresa reactivada');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo cambiar el estado de la empresa.');
    }
  }

  /* ── Columnas ───────────────────────────────────────────── */
  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Empresa',
      orden: e => e.nombre,
      clase: 'celda-elastica',
      render: e => <span className={styles.nombre}>{e.nombre}</span>,
    },
    {
      clave: 'sucursales',
      titulo: 'Unidades',
      orden: e => e._count?.sucursales ?? 0,
      render: e => {
        const n = e._count?.sucursales ?? 0;
        return n === 0
          ? <span className={styles.unidadesVacio}>Sin unidades</span>
          : <span className={styles.unidades}><IconoSucursal tamano={13} />{n} {n === 1 ? 'unidad' : 'unidades'}</span>;
      },
    },
    {
      clave: 'activo',
      titulo: 'Estado',
      orden: e => Number(e.activo),
      render: e => <Insignia tono={e.activo ? 'exito' : 'neutro'}>{e.activo ? 'Activa' : 'Dada de baja'}</Insignia>,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: e => (
        <span className="acciones-fila">
          <button
            type="button" className="btn-icono tono-naranja"
            onClick={() => abrirEditar(e)}
            title="Editar empresa" aria-label={`Editar ${e.nombre}`}
          >
            <IconoLapiz />
          </button>
          <button
            type="button"
            className={`btn-icono ${e.activo ? 'tono-error' : 'tono-exito'}`}
            onClick={() => alternarActivo(e)}
            title={e.activo ? 'Dar de baja' : 'Reactivar'}
            aria-label={`${e.activo ? 'Dar de baja' : 'Reactivar'} ${e.nombre}`}
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
      titulo="Empresas"
      subtitulo="Las razones sociales a las que se factura. Cada factura y cada vale pertenece a una."
      migas={[{ etiqueta: 'Empresas' }]}
      acciones={
        <button type="button" className="btn btn--primario" onClick={abrirCrear}>
          <IconoMas /> Nueva empresa
        </button>
      }
    >
      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: 'Buscar por nombre…',
        }}
        campos={[{
          etiqueta: 'Estado',
          valor: filtros.estado,
          onChange: v => setFiltro('estado', v),
          opciones: [
            { valor: 'todos', texto: 'Todas' },
            { valor: 'activas', texto: 'Activas' },
            { valor: 'inactivas', texto: 'Dadas de baja' },
          ],
        }]}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <TablaDatos
        columnas={columnas}
        filas={filtradas}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        claseFila={e => (e.activo ? undefined : 'fila-inactiva')}
        etiqueta="empresas"
        totalSinFiltrar={empresas.length}
        claveFiltros={clave}
        vacio={{
          titulo: hayFiltros ? 'Ninguna empresa coincide' : 'Todavía no hay empresas',
          texto: hayFiltros
            ? 'Prueba con otro término o limpia los filtros.'
            : 'Da de alta la primera razón social con «Nueva empresa».',
        }}
      />

      {modal && (
        <Modal
          titulo={modo === 'crear' ? 'Nueva empresa' : 'Editar empresa'}
          subtitulo={modo === 'editar'
            ? 'El cambio de nombre se refleja en todos los registros de esta empresa, incluidos los históricos.'
            : 'Aparecerá al registrar facturas y vales.'}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-empresa" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />}
                {modo === 'crear' ? 'Crear empresa' : 'Guardar cambios'}
              </button>
            </>
          }
        >
          <form id="form-empresa" onSubmit={guardar} noValidate>
            <Campo
              etiqueta="Nombre o razón social" error={errores.nombre} id="e-nombre"
              pista="Tal como debe aparecer en los resúmenes y exportaciones."
            >
              <input
                id="e-nombre" className={`control${errores.nombre ? ' control--invalido' : ''}`}
                type="text" placeholder="Ej. Confia Alimentos"
                maxLength={NOMBRE_MAX}
                value={form.nombre} onChange={ev => cambiar('nombre', ev.target.value)}
                disabled={guardando} data-foco-inicial autoComplete="off"
              />
            </Campo>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
