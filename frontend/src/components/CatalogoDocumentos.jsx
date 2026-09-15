import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from './Layout';
import BarraFiltros from './BarraFiltros';
import Modal from './Modal';
import EstadoDato from './EstadoDato';
import VentanaCarga from './VentanaCarga';
import { IconoMas, IconoLapiz, IconoOjo, IconoOjoOff, IconoFlecha } from './Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { normalizar, plural } from '../lib/formato';
import { confirmar, toast, avisoError } from '../lib/alertas';
import styles from './CatalogoDocumentos.module.css';

const FILTROS_BASE = { q: '', estado: 'todas', docs: 'todas' };

/* Catálogo de proveedores o de unidades: la misma pantalla con distinto
   sustantivo y distinto formulario de alta. Lo único que cambia de verdad
   son los campos de la entidad, así que llegan como render prop. */
export default function CatalogoDocumentos({ recurso, formulario }) {
  const navigate = useNavigate();
  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltrosURL(FILTROS_BASE);

  const [items, setItems] = useState([]);
  const [ventana, setVentana] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(formulario.vacio);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [lista, v] = await Promise.all([
        api.get(recurso.listaUrl),
        api.get(`/ventanas/${recurso.modulo}`),
      ]);
      setItems([...lista.data].sort(ordenar));
      setVentana(v.data);
    } catch {
      setError(`No se pudo cargar el catálogo de ${recurso.plural}.`);
    } finally {
      setCargando(false);
    }
  }

  function ordenar(a, b) {
    return Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es');
  }

  const pendientesDe = item => item[recurso.campoDocs]?.filter(d => d.estado === 'pendiente').length ?? 0;
  const totalDocsDe = item => item._count?.[recurso.campoDocs] ?? 0;

  const activos = items.filter(i => i.activo).length;

  const filtrados = useMemo(() => {
    const q = normalizar(filtros.q);
    return items.filter(item => {
      if (q && !normalizar(item.nombre).includes(q) && !normalizar(item.rfc || '').includes(q)) return false;
      if (filtros.estado === 'activas' && !item.activo) return false;
      if (filtros.estado === 'inactivas' && item.activo) return false;
      if (filtros.docs === 'pendientes' && pendientesDe(item) === 0) return false;
      if (filtros.docs === 'sin' && totalDocsDe(item) > 0) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filtros]);

  /* ── Alta y edición ─────────────────────────────────────── */
  function abrirCrear() {
    setForm(formulario.vacio);
    setErrores({});
    setModal({ modo: 'crear', editando: null });
  }

  function abrirEditar(item) {
    setForm(formulario.desde(item));
    setErrores({});
    setModal({ modo: 'editar', editando: item });
  }

  function cambiar(campo, valor) {
    setForm(p => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: undefined }));
  }

  async function guardar(e) {
    e.preventDefault();
    const fallos = formulario.validar(form);
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setGuardando(true);
    try {
      const payload = formulario.aPayload(form);
      if (modal.modo === 'crear') {
        const { data } = await api.post(recurso.base, payload);
        setItems(prev => [...prev, data].sort(ordenar));
      } else {
        const { data } = await api.put(`${recurso.base}/${modal.editando.id}`, payload);
        setItems(prev => prev.map(i => (i.id === data.id ? { ...i, ...data } : i)).sort(ordenar));
      }
      setModal(null);
      toast(modal.modo === 'crear' ? `${recurso.Singular} ${recurso.genero === 'f' ? 'agregada' : 'agregado'}` : 'Cambios guardados');
    } catch (err) {
      const mensaje = err.response?.data?.error ?? 'Ocurrió un error al guardar.';
      if (/nombre|rfc/i.test(mensaje)) setErrores({ nombre: mensaje });
      else await avisoError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(item) {
    const ok = await confirmar({
      titulo: item.activo
        ? `¿Desactivar ${recurso.determinanteSingular}?`
        : `¿Reactivar ${recurso.determinanteSingular}?`,
      texto: item.activo
        ? `${item.nombre} dejará de estar disponible en el sistema. Sus documentos se conservan.`
        : `${item.nombre} volverá a estar disponible en el sistema.`,
      confirmar: item.activo ? 'Desactivar' : 'Reactivar',
      destructivo: item.activo,
    });
    if (!ok) return;

    try {
      const { data } = await api.patch(`${recurso.base}/${item.id}/activo`);
      setItems(prev => prev.map(i => (i.id === data.id ? { ...i, ...data } : i)).sort(ordenar));
      toast(data.activo ? 'Reactivado' : 'Desactivado');
    } catch {
      await avisoError('No se pudo cambiar el estado.');
    }
  }

  const modo = modal?.modo;

  return (
    <Layout
      titulo={recurso.titulo}
      subtitulo={recurso.subtitulo}
      migas={[{ etiqueta: recurso.titulo }]}
      acciones={<VentanaCarga modulo={recurso.modulo} ventana={ventana} onCambio={setVentana} quien={recurso.quien} />}
    >
      <div className={styles.barra}>
        <p className={styles.conteo}>
          <strong>{activos}</strong> {activos === 1 ? recurso.singular : recurso.plural} en activo
          {items.length - activos > 0 && (
            <span className={styles.conteoMuted}> · {items.length - activos} sin actividad</span>
          )}
        </p>
        <button type="button" className="btn btn--primario" onClick={abrirCrear}>
          <IconoMas /> {recurso.textoNuevo}
        </button>
      </div>

      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: recurso.placeholderBusqueda,
        }}
        campos={[
          {
            etiqueta: 'Estado',
            valor: filtros.estado,
            onChange: v => setFiltro('estado', v),
            opciones: [
              { valor: 'todas', texto: 'Todos' },
              { valor: 'activas', texto: 'En activo' },
              { valor: 'inactivas', texto: 'Sin actividad' },
            ],
          },
          {
            etiqueta: 'Documentación',
            valor: filtros.docs,
            onChange: v => setFiltro('docs', v),
            opciones: [
              { valor: 'todas', texto: 'Toda' },
              { valor: 'pendientes', texto: 'Con pendientes' },
              { valor: 'sin', texto: 'Sin documentos' },
            ],
          },
        ]}
        conteo={!cargando ? `${filtrados.length} de ${items.length}` : null}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      {cargando ? (
        <div className="tarjeta"><EstadoDato estado="cargando" texto={`Cargando ${recurso.plural}…`} /></div>
      ) : error ? (
        <div className="tarjeta"><EstadoDato estado="error" titulo={error} onReintentar={cargar} /></div>
      ) : filtrados.length === 0 ? (
        <div className="tarjeta">
          <EstadoDato
            estado="vacio"
            titulo={hayFiltros ? 'Nada coincide con los filtros' : `Todavía no hay ${recurso.plural}`}
            texto={hayFiltros
              ? 'Prueba con otro término o limpia los filtros.'
              : `Empieza agregando ${recurso.determinanteSingular} con «${recurso.textoNuevo}».`}
          />
        </div>
      ) : (
        <ul className={styles.grid}>
          {filtrados.map(item => {
            const total = totalDocsDe(item);
            const pendientes = pendientesDe(item);
            return (
              <li key={item.id} className={`${styles.ficha} ${item.activo ? '' : styles.fichaInactiva}`}>
                {/* El enlace cubre la ficha; las acciones van encima y no lo
                    disparan. Antes la tarjeta era un div con onClick y
                    onKeyDown, invisible para la navegación por teclado. */}
                <a className={styles.fichaEnlace} href={recurso.rutaDetalle(item.id)}
                   onClick={e => { e.preventDefault(); navigate(recurso.rutaDetalle(item.id)); }}>
                  <span className={styles.inicial} aria-hidden="true">{item.nombre.charAt(0)}</span>
                  <span className={styles.fichaTexto}>
                    <span className={styles.fichaNombre}>
                      {item.nombre}
                      {!item.activo && <span className={styles.chipInactivo}>Sin actividad</span>}
                    </span>
                    <span className={styles.fichaMeta}>{recurso.metaFicha(item)}</span>
                  </span>
                  <span className={styles.fichaDocs}>
                    {total === 0
                      ? <span className={styles.sinDocs}>Sin documentos</span>
                      : <span className={styles.totalDocs}>{plural(total, 'documento')}</span>}
                    {pendientes > 0 && (
                      <span className={styles.pendientes}>{pendientes} por revisar</span>
                    )}
                  </span>
                  <span className={styles.fichaFlecha}><IconoFlecha tamano={15} /></span>
                </a>

                <span className={styles.fichaAcciones}>
                  <button
                    type="button" className="btn-icono tono-naranja"
                    onClick={() => abrirEditar(item)}
                    title="Editar" aria-label={`Editar ${item.nombre}`}
                  >
                    <IconoLapiz />
                  </button>
                  <button
                    type="button" className={`btn-icono ${item.activo ? 'tono-error' : 'tono-exito'}`}
                    onClick={() => alternarActivo(item)}
                    title={item.activo ? 'Desactivar' : 'Reactivar'}
                    aria-label={`${item.activo ? 'Desactivar' : 'Reactivar'} ${item.nombre}`}
                  >
                    {item.activo ? <IconoOjoOff /> : <IconoOjo />}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <Modal
          titulo={modo === 'crear' ? recurso.textoNuevo : `Editar ${recurso.singular}`}
          subtitulo={modo === 'editar' ? modal.editando.nombre : undefined}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-catalogo" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />}
                {modo === 'crear' ? 'Agregar' : 'Guardar cambios'}
              </button>
            </>
          }
        >
          <form id="form-catalogo" onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <formulario.Campos form={form} cambiar={cambiar} errores={errores} guardando={guardando} />
          </form>
        </Modal>
      )}
    </Layout>
  );
}
