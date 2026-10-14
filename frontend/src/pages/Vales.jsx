import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import TablaDatos from '../components/TablaDatos';
import BarraFiltros from '../components/BarraFiltros';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import Insignia from '../components/Insignia';
import VisorPDF from '../components/VisorPDF';
import SelectorEmpresa from '../components/SelectorEmpresa';
import {
  IconoSubir, IconoOjo, IconoDescargar, IconoCheck, IconoCerrar,
  IconoAlerta, IconoInfo, IconoBasura, IconoDocumentos,
} from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { formatFecha, formatFechaHora, normalizar } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { confirmar, toast, avisoError } from '../lib/alertas';
import { formatImporte } from '../lib/facturas';
import styles from './Vales.module.css';

/* Vales azules: reembolso de gastos menores (spec 002).
 *
 * Una sola pantalla para los dos papeles. Quien solicita ve sus vales y el
 * botón de subir; quien autoriza ve la cola de todos con sus acciones. Son
 * la misma tabla con las mismas columnas, y partirla en dos páginas sería
 * garantizar que dentro de un mes muestren estados distintos del mismo dato.
 */

const ETIQUETA_ESTADO = {
  pendiente: 'En revisión',
  autorizado: 'Autorizado',
  no_autorizado: 'No autorizado',
};
const TONO_ESTADO = { pendiente: 'pendiente', autorizado: 'exito', no_autorizado: 'error' };

const FORM_VACIO = { monto: '', uid: '', concepto: '', empresa_id: '', archivo: null };
const FILTROS_BASE = { q: '', estado: 'todos', empresa: '' };

export default function Vales() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';
  const inputRef = useRef(null);
  const inputEjemploRef = useRef(null);

  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  const [vales, setVales] = useState([]);
  const [reglas, setReglas] = useState(null);
  const [sinResolver, setSinResolver] = useState(null);
  const [tope, setTope] = useState('500.00');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);       // 'alta' | { rechazar: vale }
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [visor, setVisor] = useState(null);

  const [ejemplo, setEjemplo] = useState(null);   // el ejemplo publicado, o null
  const [verEjemplo, setVerEjemplo] = useState(false);
  const [publicandoEjemplo, setPublicandoEjemplo] = useState(false);

  useEffect(() => { cargar(); cargarEjemplo(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [lista, info] = await Promise.all([
        api.get('/vales'),
        api.get('/vales/reglas'),
      ]);
      setVales(lista.data.vales ?? []);
      setSinResolver(lista.data.vale_sin_resolver ?? null);
      setTope(lista.data.tope ?? '500.00');
      setReglas(info.data.reglas ?? []);
    } catch {
      setError('No se pudieron cargar los vales. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  /* El ejemplo es material de apoyo: si no hay o falla la consulta, la
     página sigue sirviendo sin él. Va aparte de `cargar` porque no cambia
     al subir un vale. */
  async function cargarEjemplo() {
    try {
      const { data } = await api.get('/config/ejemplo-vale/info');
      setEjemplo(data.publicado ? data : null);
    } catch {
      setEjemplo(null);
    }
  }

  /* Publicar reemplaza: solo importa el ejemplo vigente (mismo criterio que
     el ejemplo de factura). */
  async function publicarEjemplo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
      await avisoError('El ejemplo debe ser un PDF.', 'Formato no permitido');
      return;
    }

    setPublicandoEjemplo(true);
    try {
      const datos = new FormData();
      datos.append('archivo', archivo);
      const { data } = await api.put('/config/ejemplo-vale', datos, {
        headers: { 'Content-Type': undefined },
      });
      setEjemplo(data);
      toast('Ejemplo publicado: los gerentes ya lo ven');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo publicar el ejemplo.');
    } finally {
      setPublicandoEjemplo(false);
    }
  }

  /* El administrador es a la vez autorizador y posible solicitante, así que
     su botón de subir solo se bloquea por SUS propios vales sin resolver. */
  const puedeSubir = !sinResolver;

  const filtradas = useMemo(() => {
    const q = normalizar(filtros.q);
    return vales.filter(v => {
      const texto = !q
        || normalizar(v.uid).includes(q)
        || normalizar(v.concepto).includes(q)
        || normalizar(v.solicitante).includes(q);
      const estado = filtros.estado === 'todos' || v.estado === filtros.estado;
      const empresa = !filtros.empresa || String(v.empresa_id) === String(filtros.empresa);
      return texto && estado && empresa;
    });
  }, [vales, filtros]);

  const conteo = useMemo(() => {
    const pendientes = vales.filter(v => v.estado === 'pendiente');
    const centavos = pendientes.reduce((s, v) => s + Math.round(Number(v.monto) * 100), 0);
    return {
      pendientes: pendientes.length,
      importe: `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`,
    };
  }, [vales]);

  /* ── Alta ───────────────────────────────────────────────── */
  function abrirAlta() {
    setForm(FORM_VACIO);
    setErrores({});
    setModal('alta');
  }

  function cambiar(campo, valor) {
    setForm(p => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: undefined }));
  }

  async function enviar(e) {
    e.preventDefault();

    /* Las mismas reglas que el servidor, dichas antes del viaje. El servidor
       manda: esto solo evita subir un PDF para que lo rechacen por el monto. */
    const fallos = {};
    const monto = form.monto.trim();
    if (!monto) fallos.monto = 'Escribe el monto del vale.';
    else if (!/^\d+(\.\d{1,2})?$/.test(monto)) fallos.monto = 'Escríbelo como 123.45, sin símbolos.';
    else if (Number(monto) <= 0) fallos.monto = 'Tiene que ser mayor que cero.';
    else if (Number(monto) > Number(tope)) fallos.monto = `Los vales azules están topados a $${tope}.`;

    if (!form.uid.trim()) fallos.uid = 'Captura el folio impreso en el vale.';
    if (!form.archivo) fallos.archivo = 'Adjunta el escaneo del vale en PDF.';
    else if (!form.archivo.name.toLowerCase().endsWith('.pdf')) fallos.archivo = 'El comprobante debe ser un PDF.';
    if (esAdmin && !form.empresa_id) fallos.empresa_id = 'Indica a qué empresa se carga.';

    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    const datos = new FormData();
    datos.append('comprobante', form.archivo);
    datos.append('monto', monto);
    datos.append('uid', form.uid.trim());
    if (form.concepto.trim()) datos.append('concepto', form.concepto.trim());
    // El gerente no manda empresa: el servidor la deriva de su unidad.
    if (esAdmin) datos.append('empresa_id', form.empresa_id);

    setGuardando(true);
    try {
      await api.post('/vales', datos, { headers: { 'Content-Type': undefined } });
      setModal(null);
      toast('Vale enviado: queda en revisión');
      await cargar();   // el bloqueo cambia con el alta
    } catch (err) {
      const mensaje = err.response?.data?.error || 'No se pudo enviar el vale.';
      if (/folio/i.test(mensaje)) setErrores({ uid: mensaje });
      else if (/topad|monto/i.test(mensaje)) setErrores({ monto: mensaje });
      else await avisoError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  /* ── Resolver (autorizador) ─────────────────────────────── */
  async function autorizar(vale) {
    const ok = await confirmar({
      titulo: '¿Autorizar el reembolso?',
      texto: `${formatImporte(vale.monto)} a ${vale.solicitante ?? 'el solicitante'}, folio ${vale.uid}. ` +
             'Comprueba en el escaneo que el vale viene firmado antes de autorizarlo.',
      confirmar: 'Autorizar',
    });
    if (!ok) return;

    try {
      const { data } = await api.patch(`/vales/${vale.id}/autorizar`);
      setVales(prev => prev.map(v => (v.id === data.id ? { ...v, ...data } : v)));
      if (sinResolver?.id === vale.id) setSinResolver(null);
      toast('Vale autorizado');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo autorizar el vale.');
    }
  }

  async function confirmarRechazo(e) {
    e.preventDefault();
    const texto = motivo.trim();
    if (!texto) {
      setErrores({ motivo: 'Escribe el motivo. El solicitante lo va a leer.' });
      return;
    }

    setGuardando(true);
    try {
      const { data } = await api.patch(`/vales/${modal.vale.id}/rechazar`, { motivo: texto });
      setVales(prev => prev.map(v => (v.id === data.id ? { ...v, ...data } : v)));
      if (sinResolver?.id === modal.vale.id) setSinResolver({ ...sinResolver, estado: 'no_autorizado' });
      setModal(null);
      toast('Vale no autorizado');
    } catch (err) {
      setErrores({ motivo: err.response?.data?.error || 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  async function archivar(vale) {
    const ok = await confirmar({
      titulo: '¿Archivar el vale?',
      texto: `Se borra el vale ${vale.uid} y su escaneo, y ${vale.solicitante ?? 'el solicitante'} podrá subir otro. ` +
             'Es la forma de cerrar un vale que no se va a reembolsar.',
      confirmar: 'Archivar',
      destructivo: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/vales/${vale.id}`);
      setVales(prev => prev.filter(v => v.id !== vale.id));
      if (sinResolver?.id === vale.id) setSinResolver(null);
      toast('Vale archivado');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo archivar el vale.');
    }
  }

  /* ── Columnas ───────────────────────────────────────────── */
  const columnas = [
    {
      clave: 'uid',
      titulo: 'Folio',
      orden: v => v.uid,
      render: v => <span className={styles.folio}>{v.uid}</span>,
    },
    ...(esAdmin ? [{
      clave: 'solicitante',
      titulo: 'Solicitante',
      orden: v => v.solicitante ?? '',
      clase: 'celda-elastica',
      render: v => (
        <span className={styles.apilado}>
          <span className="texto-cortado">{v.solicitante ?? '—'}</span>
          <span className={styles.apiladoSec}>{v.empresa?.nombre ?? '—'}</span>
        </span>
      ),
    }] : [{
      clave: 'concepto',
      titulo: 'Concepto',
      orden: v => v.concepto ?? '',
      clase: 'celda-elastica',
      render: v => <span className="texto-cortado">{v.concepto || '—'}</span>,
    }]),
    {
      clave: 'monto',
      titulo: 'Monto',
      orden: v => Number(v.monto),
      thClase: 'th-num',
      clase: styles.importe,
      render: v => formatImporte(v.monto),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      orden: v => v.estado,
      render: v => (
        <span>
          <Insignia tono={TONO_ESTADO[v.estado]}>{ETIQUETA_ESTADO[v.estado]}</Insignia>
          {v.estado === 'no_autorizado' && v.motivo_rechazo && (
            <span className={styles.motivo}>
              <IconoAlerta tamano={12} />{v.motivo_rechazo}
            </span>
          )}
          {v.estado === 'autorizado' && v.autorizador && (
            <span className={styles.apiladoSec} style={{ display: 'block', marginTop: 3 }}>
              {v.autorizador} · {formatFecha(v.fecha_autorizacion)}
            </span>
          )}
        </span>
      ),
    },
    {
      clave: 'creado_en',
      titulo: 'Subido',
      orden: v => v.creado_en,
      clase: 'col-fecha',
      render: v => formatFecha(v.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: v => (
        <span className="acciones-fila">
          <button
            type="button" className="btn-icono"
            onClick={() => setVisor(v)}
            title="Ver el vale escaneado" aria-label={`Ver el vale ${v.uid}`}
          >
            <IconoOjo />
          </button>
          <button
            type="button" className="btn-icono tono-acero"
            onClick={() => descargarArchivo(`/vales/${v.id}/comprobante`, v.nombre_original)}
            title="Descargar" aria-label={`Descargar el vale ${v.uid}`}
          >
            <IconoDescargar />
          </button>
          {esAdmin && v.estado === 'pendiente' && (
            <>
              <button
                type="button" className="btn-icono tono-exito"
                onClick={() => autorizar(v)}
                title="Autorizar" aria-label={`Autorizar el vale ${v.uid}`}
              >
                <IconoCheck />
              </button>
              <button
                type="button" className="btn-icono tono-error"
                onClick={() => { setMotivo(''); setErrores({}); setModal({ vale: v }); }}
                title="No autorizar" aria-label={`No autorizar el vale ${v.uid}`}
              >
                <IconoCerrar />
              </button>
            </>
          )}
          {esAdmin && v.estado === 'no_autorizado' && (
            <button
              type="button" className="btn-icono tono-error"
              onClick={() => archivar(v)}
              title="Archivar y liberar al solicitante" aria-label={`Archivar el vale ${v.uid}`}
            >
              <IconoBasura />
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Layout
      titulo="Vales de reembolso"
      subtitulo={esAdmin
        ? 'Gastos menores que la empresa reembolsa contra vale azul firmado.'
        : 'Pide el reembolso de un gasto menor que adelantaste.'}
      migas={[{ etiqueta: 'Vales' }]}
      acciones={
        <button
          type="button" className="btn btn--primario"
          onClick={abrirAlta}
          disabled={!puedeSubir || cargando}
          title={sinResolver ? 'Tienes un vale sin resolver' : 'Subir un vale'}
        >
          <IconoSubir /> Subir vale
        </button>
      }
    >
      {/* HU-2 · panel informativo con las tres reglas. */}
      <div className={styles.panel}>
        <span className={styles.panelIcono}><IconoInfo tamano={20} /></span>
        <div className={styles.panelCuerpo}>
          <span className={styles.panelTitulo}>Cómo funcionan los vales azules</span>
          <ul className={styles.panelLista}>
            {(reglas ?? []).map(r => <li key={r}>{r}</li>)}
          </ul>

          {/* El vale físico anotado: qué secciones del papel se llenan y
              cómo. El gerente solo lo ve si hay uno publicado; el
              administrador ve el bloque siempre, para poder publicarlo. */}
          {(ejemplo || esAdmin) && (
            <div className={styles.ejemplo}>
              <span className={styles.ejemploIcono}><IconoDocumentos tamano={20} /></span>
              <span className={styles.ejemploTexto}>
                <span className={styles.ejemploTitulo}>Ejemplo de vale llenado</span>
                <span className={styles.ejemploPista}>
                  {!ejemplo
                    ? 'Todavía no hay ejemplo publicado. Mientras no lo haya, los gerentes no ven esta guía.'
                    : esAdmin
                      ? `Lo que ven los gerentes. Actualizado el ${formatFecha(ejemplo.actualizado_en)}.`
                      : 'Qué secciones del vale físico se llenan y cómo. Revísalo antes de llenar el tuyo.'}
                </span>
              </span>
              <span className={styles.ejemploAcciones}>
                {ejemplo && (
                  <button type="button" className="btn btn--neutro btn--sm" onClick={() => setVerEjemplo(true)}>
                    <IconoOjo /> Ver ejemplo
                  </button>
                )}
                {esAdmin && (
                  <>
                    <input
                      ref={inputEjemploRef} type="file" accept=".pdf,application/pdf"
                      style={{ display: 'none' }} onChange={publicarEjemplo}
                    />
                    <button
                      type="button" className="btn btn--neutro btn--sm"
                      onClick={() => inputEjemploRef.current?.click()} disabled={publicandoEjemplo}
                    >
                      {publicandoEjemplo
                        ? <><span className="spinner" /> Publicando…</>
                        : <><IconoSubir /> {ejemplo ? 'Reemplazar' : 'Publicar ejemplo'}</>}
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <VisorPDF
        doc={verEjemplo ? ejemplo : null}
        url="/config/ejemplo-vale?inline=1"
        onCerrar={() => setVerEjemplo(false)}
      />

      {/* El bloqueo se explica, no solo se aplica: el solicitante tiene que
          saber qué vale lo frena y qué hacer con él. */}
      {sinResolver && (
        <div className={`aviso aviso--${sinResolver.estado === 'pendiente' ? 'atencion' : 'error'}`} role="alert">
          <IconoAlerta />
          <span>
            {sinResolver.estado === 'pendiente'
              ? <>Tu vale <strong>{sinResolver.uid}</strong> sigue en revisión. No puedes subir otro hasta que se autorice.</>
              : <>Tu vale <strong>{sinResolver.uid}</strong> quedó sin autorizar. Habla con el autorizador para cerrarlo antes de subir otro.</>}
          </span>
        </div>
      )}

      {esAdmin && !cargando && conteo.pendientes > 0 && (
        <div className={styles.cifras}>
          <div className={styles.cifra}>
            <span className={`${styles.cifraNumero} ${styles.cifraPendiente}`}>{conteo.pendientes}</span>
            <span className={styles.cifraEtiqueta}>
              {conteo.pendientes === 1 ? 'vale por revisar' : 'vales por revisar'}
            </span>
          </div>
          <div className={styles.cifra}>
            <span className={styles.cifraNumero}>{formatImporte(conteo.importe)}</span>
            <span className={styles.cifraEtiqueta}>importe pendiente de autorizar</span>
          </div>
        </div>
      )}

      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: esAdmin ? 'Buscar por folio, concepto o solicitante…' : 'Buscar por folio o concepto…',
        }}
        campos={[{
          etiqueta: 'Estado',
          valor: filtros.estado,
          onChange: v => setFiltro('estado', v),
          opciones: [
            { valor: 'todos', texto: 'Todos' },
            { valor: 'pendiente', texto: 'En revisión' },
            { valor: 'autorizado', texto: 'Autorizados' },
            { valor: 'no_autorizado', texto: 'No autorizados' },
          ],
        }]}
        extra={esAdmin && (
          <div className="barra-filtros__campo">
            <label className="barra-filtros__etiqueta" htmlFor="filtro-empresa-vales">Empresa</label>
            <SelectorEmpresa
              id="filtro-empresa-vales"
              valor={filtros.empresa}
              onChange={v => setFiltro('empresa', v)}
              incluirTodas
            />
          </div>
        )}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <TablaDatos
        columnas={columnas}
        filas={filtradas}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        etiqueta="vales"
        totalSinFiltrar={vales.length}
        claveFiltros={clave}
        ordenInicial={{ clave: 'creado_en', dir: 'desc' }}
        vacio={{
          titulo: hayFiltros ? 'Ningún vale coincide'
            : esAdmin ? 'No hay vales registrados' : 'Todavía no has subido vales',
          texto: hayFiltros ? 'Prueba con otro término o limpia los filtros.'
            : esAdmin ? 'Cuando alguien suba un vale aparecerá aquí para autorizarlo.'
            : `Usa «Subir vale» y adjunta el escaneo del papel firmado (máximo $${tope}).`,
          icono: IconoSubir,
        }}
      />

      {visor && (
        <VisorPDF
          doc={{ nombre_original: visor.nombre_original, tipo_mime: 'application/pdf' }}
          url={`/vales/${visor.id}/comprobante`}
          onCerrar={() => setVisor(null)}
        />
      )}

      {modal === 'alta' && (
        <Modal
          titulo="Subir vale de reembolso"
          subtitulo={`Escaneo del papel firmado. Máximo $${tope} por vale.`}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-vale" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />}
                {guardando ? 'Enviando…' : 'Enviar vale'}
              </button>
            </>
          }
        >
          <form id="form-vale" onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <div className={styles.campos}>
              <Campo etiqueta="Monto" error={errores.monto} id="v-monto" pista={`Tope: $${tope}`}>
                <span className={styles.montoCaja}>
                  <span className={styles.montoSimbolo}>$</span>
                  <input
                    id="v-monto" className={`control${errores.monto ? ' control--invalido' : ''}`}
                    type="text" inputMode="decimal" placeholder="0.00"
                    value={form.monto} onChange={e => cambiar('monto', e.target.value)}
                    disabled={guardando} data-foco-inicial autoComplete="off"
                  />
                </span>
              </Campo>

              <Campo
                etiqueta="Folio del vale" error={errores.uid} id="v-uid"
                pista="El número impreso en el papel."
              >
                <input
                  id="v-uid" className={`control mono${errores.uid ? ' control--invalido' : ''}`}
                  type="text" maxLength={64} placeholder="Ej. A-004512"
                  value={form.uid} onChange={e => cambiar('uid', e.target.value.toUpperCase())}
                  disabled={guardando} autoComplete="off" spellCheck={false}
                />
              </Campo>
            </div>

            {/* El gerente no elige empresa: sale de su unidad (spec 000). */}
            {esAdmin && (
              <Campo etiqueta="Empresa a la que se carga" error={errores.empresa_id} id="v-empresa">
                <SelectorEmpresa
                  id="v-empresa"
                  valor={form.empresa_id}
                  onChange={v => cambiar('empresa_id', v)}
                  className={`control${errores.empresa_id ? ' control--invalido' : ''}`}
                  disabled={guardando}
                  autoSeleccionarUnica
                />
              </Campo>
            )}

            <Campo etiqueta="Concepto" id="v-concepto" opcional pista="En qué se gastó. Ayuda a quien autoriza.">
              <input
                id="v-concepto" className="control" type="text" maxLength={300}
                placeholder="Ej. Taxi para recoger pedido urgente"
                value={form.concepto} onChange={e => cambiar('concepto', e.target.value)}
                disabled={guardando}
              />
            </Campo>

            <Campo etiqueta="Escaneo del vale" error={errores.archivo} id="v-archivo">
              <input
                ref={inputRef} id="v-archivo" type="file" accept=".pdf,application/pdf"
                style={{ display: 'none' }} disabled={guardando}
                onChange={e => cambiar('archivo', e.target.files?.[0] ?? null)}
              />
              <button
                type="button" disabled={guardando}
                className={`${styles.archivo}${form.archivo ? ` ${styles.archivoElegido}` : ''}`}
                onClick={() => inputRef.current?.click()}
              >
                <span className={styles.archivoIcono}>
                  {form.archivo ? <IconoCheck tamano={20} /> : <IconoSubir tamano={20} />}
                </span>
                <span className={styles.archivoTexto}>
                  <span className={styles.archivoNombre}>{form.archivo ? form.archivo.name : 'Elegir archivo .pdf'}</span>
                  <span className={styles.archivoPista}>
                    {form.archivo ? 'Pulsa para cambiarlo' : 'El vale firmado, escaneado o fotografiado en PDF'}
                  </span>
                </span>
              </button>
            </Campo>
          </form>
        </Modal>
      )}

      {modal?.vale && (
        <Modal
          titulo="No autorizar el vale"
          subtitulo={`${modal.vale.uid} · ${formatImporte(modal.vale.monto)} · ${modal.vale.solicitante ?? ''}`}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-rechazo" className="btn btn--peligro" disabled={guardando}>
                {guardando && <span className="spinner" />}No autorizar
              </button>
            </>
          }
        >
          <form id="form-rechazo" onSubmit={confirmarRechazo} noValidate>
            <Campo
              etiqueta="Motivo" error={errores.motivo} id="v-motivo"
              pista="El solicitante lo va a leer, y hasta que se cierre este vale no podrá subir otro."
            >
              <textarea
                id="v-motivo" rows={3} maxLength={300}
                className={`control${errores.motivo ? ' control--invalido' : ''}`}
                placeholder="Ej. El vale no viene firmado por el responsable del gasto."
                value={motivo}
                onChange={e => { setMotivo(e.target.value); if (errores.motivo) setErrores({}); }}
                disabled={guardando} data-foco-inicial
              />
            </Campo>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
