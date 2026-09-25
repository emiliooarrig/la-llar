import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import BarraFiltros from '../components/BarraFiltros';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import Insignia, { Formato } from '../components/Insignia';
import VisorPDF from '../components/VisorPDF';
import VisorXML from '../components/VisorXML';
import SelectorEmpresa from '../components/SelectorEmpresa';
import {
  IconoAclaracion, IconoOjo, IconoDocumentos, IconoDescargar, IconoSubir,
  IconoCandado, IconoAtras, IconoCheck, IconoFactura, IconoAlerta,
} from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { formatFecha, formatFechaHora, normalizar } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { toast, avisoError } from '../lib/alertas';
import { ETIQUETA_ESTADO, ETIQUETA_ESTADO_COMPLEMENTO, formatImporte, folioCorto } from '../lib/facturas';
import styles from './Aclaraciones.module.css';

/* Aclaraciones de proveedores (spec 003).
 *
 * Una sola pantalla para los dos papeles, como Vales: el proveedor ve sus
 * aclaraciones, el administrador las de todos. A la izquierda la bandeja; a
 * la derecha el caso abierto, con los documentos y el hilo JUNTOS, que es
 * justo lo que pide la HU-2: entender el caso sin ir a buscar la factura a
 * otra pantalla.
 *
 * Las aclaraciones se abren desde la factura (menú «Abrir aclaración» del
 * panel de facturas), no desde aquí: así la referencia al documento sale
 * sola y nadie tiene que teclear un folio.
 */

const NOTA_MAX = 1000;
const FILTROS_BASE = { q: '', estado: 'todas', empresa: '', id: '' };

const ETIQUETA_ORIGEN = { factura: 'Factura', complemento: 'Complemento de pago', soporte: 'Soporte' };

/** ¿A quién le toca mover ficha? Lo dice el rol de quien escribió la última
 *  nota: si fue la otra parte, la aclaración espera respuesta de este lado. */
function esperaMiRespuesta(aclaracion, rol) {
  if (aclaracion.estado !== 'abierta' || !aclaracion.ultima_nota_rol) return false;
  return rol === 'proveedor'
    ? aclaracion.ultima_nota_rol === 'administrador'
    : aclaracion.ultima_nota_rol === 'proveedor';
}

export default function Aclaraciones() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'administrador';

  const { filtros, setFiltro, setFiltros } = useFiltrosURL(FILTROS_BASE);
  const seleccion = filtros.id ? Number(filtros.id) : null;

  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get('/aclaraciones');
      setLista(data);
    } catch {
      setError('No se pudieron cargar las aclaraciones. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    const q = normalizar(filtros.q);
    return lista.filter(a => {
      if (filtros.estado !== 'todas' && a.estado !== filtros.estado) return false;
      if (filtros.empresa && String(a.empresa_id) !== String(filtros.empresa)) return false;
      if (!q) return true;
      return normalizar(a.asunto).includes(q) || normalizar(a.proveedor?.nombre).includes(q);
    });
  }, [lista, filtros.q, filtros.estado, filtros.empresa]);

  const conteo = useMemo(() => ({
    abiertas: lista.filter(a => a.estado === 'abierta').length,
    porResponder: lista.filter(a => esperaMiRespuesta(a, usuario?.rol)).length,
  }), [lista, usuario?.rol]);

  const hayFiltros = filtros.q !== '' || filtros.estado !== 'todas' || filtros.empresa !== '';
  const limpiar = () => setFiltros({ q: '', estado: 'todas', empresa: '' });

  return (
    <Layout
      titulo="Aclaraciones"
      subtitulo={esAdmin
        ? 'Dudas de proveedores sobre sus facturas y complementos, con los documentos a la vista.'
        : 'Aclara dudas sobre tus facturas sin mandar archivos por correo.'}
      migas={[{ etiqueta: 'Aclaraciones' }]}
    >
      {!cargando && !error && lista.length > 0 && (
        <div className={styles.cifras}>
          <div className={styles.cifra}>
            <span className={styles.cifraNumero}>{conteo.abiertas}</span>
            <span className={styles.cifraEtiqueta}>{conteo.abiertas === 1 ? 'abierta' : 'abiertas'}</span>
          </div>
          <div className={styles.cifra}>
            <span className={`${styles.cifraNumero}${conteo.porResponder ? ` ${styles.cifraAtencion}` : ''}`}>
              {conteo.porResponder}
            </span>
            <span className={styles.cifraEtiqueta}>
              {conteo.porResponder === 1 ? 'espera tu respuesta' : 'esperan tu respuesta'}
            </span>
          </div>
        </div>
      )}

      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: esAdmin ? 'Buscar por asunto o proveedor…' : 'Buscar por asunto…',
        }}
        campos={[{
          etiqueta: 'Estado',
          valor: filtros.estado,
          onChange: v => setFiltro('estado', v),
          opciones: [
            { valor: 'todas', texto: 'Todas' },
            { valor: 'abierta', texto: 'Abiertas' },
            { valor: 'cerrada', texto: 'Cerradas' },
          ],
        }]}
        extra={esAdmin && (
          <div className="barra-filtros__campo">
            <label className="barra-filtros__etiqueta" htmlFor="filtro-empresa-acl">Empresa</label>
            <SelectorEmpresa
              id="filtro-empresa-acl"
              valor={filtros.empresa}
              onChange={v => setFiltro('empresa', v)}
              incluirTodas
            />
          </div>
        )}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <div className={`${styles.mesa}${seleccion ? ` ${styles.mesaConDetalle}` : ''}`}>
        <section className={styles.bandeja} aria-label="Lista de aclaraciones">
          <Bandeja
            filas={filtradas}
            total={lista.length}
            cargando={cargando}
            error={error}
            onReintentar={cargar}
            seleccion={seleccion}
            onElegir={id => setFiltro('id', String(id))}
            esAdmin={esAdmin}
            rol={usuario?.rol}
            hayFiltros={hayFiltros}
          />
        </section>

        <section className={styles.caso} aria-label="Detalle de la aclaración">
          {seleccion ? (
            <DetalleAclaracion
              key={seleccion}
              id={seleccion}
              usuario={usuario}
              onVolver={() => setFiltro('id', '')}
              onCambio={cargar}
            />
          ) : (
            <div className={styles.casoVacio}>
              <IconoAclaracion tamano={30} />
              <p className={styles.casoVacioTitulo}>Elige una aclaración</p>
              <p className={styles.casoVacioTexto}>
                {esAdmin
                  ? 'Verás sus documentos y el hilo completo con el proveedor.'
                  : 'Para abrir una nueva, ve a Mis facturas y usa «Abrir aclaración» en el menú de la factura.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

/* ── Bandeja ──────────────────────────────────────────────────────── */
function Bandeja({ filas, total, cargando, error, onReintentar, seleccion, onElegir, esAdmin, rol, hayFiltros }) {
  if (cargando) {
    return (
      <ul className={styles.lista}>
        {[0, 1, 2].map(i => (
          <li key={i} className={styles.itemEsqueleto}>
            <span className="esqueleto esqueleto--linea" style={{ width: '70%' }} />
            <span className="esqueleto esqueleto--linea" style={{ width: '40%' }} />
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div className={styles.bandejaVacia}>
        <p>{error}</p>
        <button type="button" className="btn btn--neutro btn--sm" onClick={onReintentar}>Reintentar</button>
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className={styles.bandejaVacia}>
        <p className={styles.bandejaVaciaTitulo}>
          {hayFiltros ? 'Ninguna aclaración coincide' : 'No hay aclaraciones'}
        </p>
        <p>
          {hayFiltros ? 'Prueba con otro término o limpia los filtros.'
            : esAdmin ? 'Cuando un proveedor abra una aclaración aparecerá aquí.'
            : 'Si tienes una duda sobre una factura, ábrela desde Mis facturas.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className={styles.lista}>
        {filas.map(a => {
          const espera = esperaMiRespuesta(a, rol);
          const activa = a.id === seleccion;
          return (
            <li key={a.id}>
              <button
                type="button"
                className={`${styles.item}${activa ? ` ${styles.itemActivo}` : ''}${a.estado === 'cerrada' ? ` ${styles.itemCerrado}` : ''}`}
                onClick={() => onElegir(a.id)}
                aria-current={activa ? 'true' : undefined}
              >
                <span className={styles.itemFila}>
                  <span className={styles.itemAsunto}>{a.asunto}</span>
                  {espera && <span className={styles.puntoEspera} title="Espera tu respuesta" aria-label="Espera tu respuesta" />}
                </span>
                {esAdmin && <span className={styles.itemProveedor}>{a.proveedor?.nombre}</span>}
                <span className={styles.itemMeta}>
                  <Insignia tono={a.estado === 'abierta' ? 'pendiente' : 'neutro'}>
                    {a.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                  </Insignia>
                  <span>{a.empresa?.nombre}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatFecha(a.ultima_actividad)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {filas.length < total && (
        <p className={styles.bandejaPie}>{filas.length} de {total}</p>
      )}
    </>
  );
}

/* ── Detalle de una aclaración ────────────────────────────────────── */
function DetalleAclaracion({ id, usuario, onVolver, onCambio }) {
  const esAdmin = usuario?.rol === 'administrador';
  const archivoRef = useRef(null);
  const hiloRef = useRef(null);

  const [acl, setAcl] = useState(null);
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const [errorNota, setErrorNota] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [cierre, setCierre] = useState(null);       // null | { nota }
  const [cerrando, setCerrando] = useState(false);
  const [visorPdf, setVisorPdf] = useState(null);   // { doc, url }
  const [visorXml, setVisorXml] = useState(null);   // { factura, url, titulo }

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get(`/aclaraciones/${id}`);
      setAcl(data);
      setError(null);
    } catch (e) {
      setError(e.response?.status === 403
        ? 'No tienes acceso a esta aclaración.'
        : e.response?.status === 404
          ? 'Esta aclaración no existe.'
          : 'No se pudo cargar la aclaración.');
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  // El hilo arranca por el final: lo último que se dijo es lo que importa.
  useEffect(() => {
    if (hiloRef.current) hiloRef.current.scrollTop = hiloRef.current.scrollHeight;
  }, [acl?.notas?.length]);

  if (error) {
    return (
      <div className={styles.casoVacio}>
        <IconoAlerta tamano={26} />
        <p className={styles.casoVacioTitulo}>{error}</p>
        <button type="button" className="btn btn--neutro btn--sm" onClick={onVolver}>Volver a la lista</button>
      </div>
    );
  }

  if (!acl) {
    return (
      <div className={styles.casoCargando}>
        <span className="esqueleto esqueleto--fila" style={{ width: '55%' }} />
        <span className="esqueleto esqueleto--linea" style={{ width: '35%' }} />
        <span className="esqueleto esqueleto--fila" style={{ width: '90%', marginTop: 24 }} />
        <span className="esqueleto esqueleto--fila" style={{ width: '80%' }} />
      </div>
    );
  }

  const abierta = acl.estado === 'abierta';

  async function enviarNota(e) {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!limpio) { setErrorNota('Escribe algo antes de enviar.'); return; }

    setEnviando(true);
    try {
      const { data } = await api.post(`/aclaraciones/${id}/notas`, { texto: limpio });
      setAcl(prev => ({ ...prev, notas: [...prev.notas, data] }));
      setTexto('');
      onCambio();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo enviar la nota.');
      if (err.response?.status === 409) cargar();
    } finally {
      setEnviando(false);
    }
  }

  async function adjuntar(archivo) {
    if (!archivo) return;
    const datos = new FormData();
    datos.append('archivo', archivo);
    setSubiendo(true);
    try {
      const { data } = await api.post(`/aclaraciones/${id}/documentos`, datos);
      setAcl(prev => ({ ...prev, documentos: [...prev.documentos, data] }));
      toast('Soporte adjuntado');
      onCambio();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo adjuntar el archivo.');
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  }

  async function confirmarCierre(e) {
    e.preventDefault();
    setCerrando(true);
    try {
      await api.patch(`/aclaraciones/${id}/cerrar`, { nota: cierre.nota.trim() });
      setCierre(null);
      toast('Aclaración cerrada');
      await cargar();
      onCambio();
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo cerrar la aclaración.');
    } finally {
      setCerrando(false);
    }
  }

  /* Facturas y complementos se piden a /api/facturas, su dueño, que ya
     comprueba el alcance. El visor XML necesita la factura completa (RFC,
     fecha, empresa), así que se pide antes de abrirlo. */
  async function verXml(doc) {
    try {
      const { data: f } = await api.get(`/facturas/${doc.factura_id}`);
      if (doc.origen === 'complemento') {
        setVisorXml({
          factura: { ...f.complemento, empresa: f.empresa, total: null },
          url: `/facturas/${f.id}/xml?complemento=1&inline=1`,
          titulo: f.complemento?.nombre_xml ?? 'Complemento de pago',
        });
      } else {
        setVisorXml({ factura: f, url: `/facturas/${f.id}/xml?inline=1`, titulo: f.nombre_xml });
      }
    } catch {
      await avisoError('No se pudo abrir el comprobante.');
    }
  }

  function verPdf(doc) {
    if (doc.origen === 'soporte') {
      setVisorPdf({
        doc: { nombre_original: doc.nombre_original, tipo_mime: doc.tipo_mime },
        url: `/aclaraciones/${id}/documentos/${doc.id}/archivo?inline=1`,
      });
      return;
    }
    const complemento = doc.origen === 'complemento';
    setVisorPdf({
      doc: { nombre_original: `${complemento ? 'Complemento' : 'Factura'} ${doc.serie_folio || folioCorto(doc.uuid_fiscal)}.pdf`, tipo_mime: 'application/pdf' },
      url: `/facturas/${doc.factura_id}/pdf${complemento ? '?complemento=1' : ''}`,
    });
  }

  return (
    <article className={styles.detalle}>
      <header className={styles.cabecera}>
        <button type="button" className={`btn btn--fantasma btn--sm ${styles.volver}`} onClick={onVolver}>
          <IconoAtras tamano={15} /> Todas las aclaraciones
        </button>
        <div className={styles.cabeceraFila}>
          <div className={styles.cabeceraTexto}>
            <h2 className={styles.asunto}>{acl.asunto}</h2>
            <p className={styles.sub}>
              {esAdmin && <><strong>{acl.proveedor?.nombre}</strong> · </>}
              {acl.empresa?.nombre} · Abierta el {formatFecha(acl.creado_en)}
              {acl.creado_por_nombre ? ` por ${acl.creado_por_nombre}` : ''}
            </p>
          </div>
          <div className={styles.cabeceraAcciones}>
            <Insignia tono={abierta ? 'pendiente' : 'neutro'}>{abierta ? 'Abierta' : 'Cerrada'}</Insignia>
            {esAdmin && abierta && (
              <button type="button" className="btn btn--neutro btn--sm" onClick={() => setCierre({ nota: '' })}>
                <IconoCheck tamano={15} /> Cerrar aclaración
              </button>
            )}
          </div>
        </div>
      </header>

      {!abierta && (
        <div className={`aviso ${styles.avisoCerrada}`} role="status">
          <IconoCandado />
          <span>
            Cerrada el {formatFechaHora(acl.cerrada_en)}
            {acl.cerrada_por_nombre ? ` por ${acl.cerrada_por_nombre}` : ''}. Queda como histórico de solo lectura.
          </span>
        </div>
      )}

      {/* HU-2 · todos los documentos del caso, juntos y con visor. */}
      <section className={styles.documentos} aria-label="Documentos de la aclaración">
        <div className={styles.seccionCabeza}>
          <span className={styles.seccionTitulo}>
            Documentos <span className={styles.seccionConteo}>{acl.documentos.length}</span>
          </span>
          {abierta && (
            <>
              <input
                ref={archivoRef} type="file" hidden
                accept=".pdf,.xlsx,.docx,application/pdf"
                onChange={e => adjuntar(e.target.files?.[0])}
              />
              <button
                type="button" className="btn btn--fantasma btn--sm"
                onClick={() => archivoRef.current?.click()} disabled={subiendo}
                title="PDF, Excel o Word, máximo 10 MB"
              >
                {subiendo ? <span className="spinner" /> : <IconoSubir tamano={15} />}
                {subiendo ? 'Subiendo…' : 'Adjuntar soporte'}
              </button>
            </>
          )}
        </div>

        <ul className={styles.docs}>
          {acl.documentos.map(d => (
            <Documento key={d.id} doc={d} onVerPdf={verPdf} onVerXml={verXml} aclaracionId={id} />
          ))}
        </ul>
      </section>

      {/* HU-3 · el hilo. */}
      <section className={styles.conversacion} aria-label="Notas de la aclaración">
        <div className={styles.seccionCabeza}>
          <span className={styles.seccionTitulo}>
            Notas <span className={styles.seccionConteo}>{acl.notas.length}</span>
          </span>
        </div>

        <ol className={styles.hilo} ref={hiloRef}>
          {acl.notas.map(n => {
            const mia = n.autor_id === usuario?.id;
            return (
              <li key={n.id} className={`${styles.nota} ${mia ? styles.notaMia : styles.notaOtra}`}>
                <div className={`${styles.globo} ${n.autor_rol === 'administrador' ? styles.globoAdmin : styles.globoProveedor}`}>
                  <p className={styles.notaTexto}>{n.texto}</p>
                </div>
                <p className={styles.notaPie}>
                  {mia ? 'Tú' : (n.autor ?? 'Usuario')}
                  {!mia && n.autor_rol && (
                    <span className={styles.notaRol}>
                      {n.autor_rol === 'administrador' ? 'Administración' : 'Proveedor'}
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <time dateTime={n.creado_en}>{formatFechaHora(n.creado_en)}</time>
                </p>
              </li>
            );
          })}
        </ol>

        {abierta ? (
          <form className={styles.redactor} onSubmit={enviarNota} noValidate>
            <textarea
              id="nota-acl"
              className={`control ${styles.redactorCampo}${errorNota ? ' control--invalido' : ''}`}
              rows={3} maxLength={NOTA_MAX}
              placeholder={esAdmin ? 'Responde al proveedor…' : 'Escribe a la administración…'}
              value={texto}
              onChange={e => { setTexto(e.target.value); if (errorNota) setErrorNota(null); }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviarNota(e); }}
              disabled={enviando}
              aria-label="Escribe una nota"
              aria-describedby="nota-acl-pista"
            />
            <div className={styles.redactorPie}>
              <span id="nota-acl-pista" className={errorNota ? 'error-campo' : 'pista'}>
                {errorNota ?? `${texto.length}/${NOTA_MAX} · Ctrl + Enter para enviar`}
              </span>
              <button type="submit" className="btn btn--primario btn--sm" disabled={enviando}>
                {enviando && <span className="spinner" />}Enviar nota
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {visorPdf && <VisorPDF doc={visorPdf.doc} url={visorPdf.url} onCerrar={() => setVisorPdf(null)} />}
      {visorXml && (
        <VisorXML
          factura={visorXml.factura} url={visorXml.url} titulo={visorXml.titulo}
          onCerrar={() => setVisorXml(null)}
        />
      )}

      {cierre && (
        <Modal
          titulo="Cerrar la aclaración"
          subtitulo={acl.asunto}
          onCerrar={() => setCierre(null)}
          bloqueado={cerrando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setCierre(null)} disabled={cerrando}>
                Cancelar
              </button>
              <button type="submit" form="form-cierre" className="btn btn--primario" disabled={cerrando}>
                {cerrando && <span className="spinner" />}Cerrar aclaración
              </button>
            </>
          }
        >
          <form id="form-cierre" onSubmit={confirmarCierre} noValidate>
            <Campo
              etiqueta="Resolución" id="cierre-nota" opcional
              pista="Queda como última nota del hilo. Después nadie podrá escribir ni adjuntar."
            >
              <textarea
                id="cierre-nota" className="control" rows={3} maxLength={NOTA_MAX}
                placeholder="Ej. Se emitió nota de crédito por la diferencia."
                value={cierre.nota}
                onChange={e => setCierre({ nota: e.target.value })}
                disabled={cerrando} data-foco-inicial
              />
            </Campo>
          </form>
        </Modal>
      )}
    </article>
  );
}

/* ── Un documento de la aclaración ────────────────────────────────── */
function Documento({ doc, onVerPdf, onVerXml, aclaracionId }) {
  if (!doc.disponible) {
    return (
      <li className={`${styles.doc} ${styles.docNoDisponible}`}>
        <span className={styles.docIcono}><IconoFactura /></span>
        <span className={styles.docCuerpo}>
          <span className={styles.docTipo}>{ETIQUETA_ORIGEN[doc.origen]}</span>
          <span className={styles.docNombre}>El documento ya no está disponible.</span>
        </span>
      </li>
    );
  }

  if (doc.origen === 'soporte') {
    const esPdf = doc.tipo_mime?.includes('pdf');
    return (
      <li className={styles.doc}>
        <span className={`${styles.docIcono} ${styles.docIconoSoporte}`}><IconoDocumentos /></span>
        <span className={styles.docCuerpo}>
          <span className={styles.docTipo}>Soporte <Formato mime={doc.tipo_mime} /></span>
          <span className={styles.docNombre} title={doc.nombre_original}>{doc.nombre_original}</span>
          <span className={styles.docMeta}>
            {doc.subido_por_nombre ? `${doc.subido_por_nombre} · ` : ''}{formatFecha(doc.creado_en)}
          </span>
        </span>
        <span className={styles.docAcciones}>
          {esPdf && (
            <button type="button" className="btn-icono" onClick={() => onVerPdf(doc)} title="Ver" aria-label={`Ver ${doc.nombre_original}`}>
              <IconoOjo />
            </button>
          )}
          <button
            type="button" className="btn-icono" title="Descargar" aria-label={`Descargar ${doc.nombre_original}`}
            onClick={() => descargarArchivo(`/aclaraciones/${aclaracionId}/documentos/${doc.id}/archivo`, doc.nombre_original)}
          >
            <IconoDescargar />
          </button>
        </span>
      </li>
    );
  }

  const complemento = doc.origen === 'complemento';
  const etiquetaEstado = (complemento ? ETIQUETA_ESTADO_COMPLEMENTO : ETIQUETA_ESTADO)[doc.estado_documento];

  return (
    <li className={styles.doc}>
      <span className={styles.docIcono}><IconoFactura /></span>
      <span className={styles.docCuerpo}>
        <span className={styles.docTipo}>
          {ETIQUETA_ORIGEN[doc.origen]}
          {etiquetaEstado && <Insignia estado={doc.estado_documento} punto={false}>{etiquetaEstado}</Insignia>}
        </span>
        <span className={styles.docNombre}>
          {complemento ? 'De la factura ' : ''}{doc.serie_folio || folioCorto(complemento ? doc.uuid_factura : doc.uuid_fiscal)}
          {!complemento && doc.total && <span className={styles.docImporte}>{formatImporte(doc.total)}</span>}
        </span>
        <span className={`${styles.docMeta} mono`} title={doc.uuid_fiscal ?? ''}>
          {doc.uuid_fiscal ?? 'Sin folio fiscal'}
        </span>
      </span>
      <span className={styles.docAcciones}>
        <button type="button" className="btn btn--fantasma btn--sm" onClick={() => onVerPdf(doc)}>
          <IconoOjo tamano={15} /> PDF
        </button>
        <button type="button" className="btn btn--fantasma btn--sm" onClick={() => onVerXml(doc)}>
          <IconoDocumentos tamano={15} /> XML
        </button>
      </span>
    </li>
  );
}
