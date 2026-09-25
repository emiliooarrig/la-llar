import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import TablaDatos from './TablaDatos';
import BarraFiltros from './BarraFiltros';
import Modal from './Modal';
import Insignia from './Insignia';
import Campo from './Campo';
import VisorPDF from './VisorPDF';
import VisorXML from './VisorXML';
import MenuAcciones from './MenuAcciones';
import AbrirAclaracion from './AbrirAclaracion';
import {
  IconoOjo, IconoDescargar, IconoCheck, IconoCerrar, IconoDocumentos, IconoAlerta, IconoAclaracion,
} from './Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { formatFecha, formatFechaHora, normalizar } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { toast, avisoError, confirmar } from '../lib/alertas';
import { ETIQUETA_ESTADO, ETIQUETA_ESTADO_COMPLEMENTO, formatImporte, folioCorto, referenciaFactura } from '../lib/facturas';
import styles from './PanelFacturas.module.css';

const FILTROS_BASE = { q: '', estado: 'todos' };

/* Tabla de facturas compartida por el portal del proveedor y el panel del
   administrador. Lo que cambia entre los dos es quién puede hacer qué, no
   cómo se ve una factura: separarlas en dos componentes garantizaría que
   dentro de un mes muestren estados distintos para el mismo dato.

   props:
     facturas        filas a mostrar
     esAdmin         habilita aprobar / rechazar / marcar pago
     mostrarProveedor  columna de proveedor (el panel del admin la quiere)
     onCambio(f)     una factura cambió: el contenedor actualiza su estado
     acciones        nodo extra para la barra de filtros
*/
export default function PanelFacturas({
  facturas,
  esAdmin = false,
  mostrarProveedor = false,
  cargando,
  error,
  onReintentar,
  onCambio,
  vacio,
}) {
  const { filtros, setFiltro, limpiar, hayFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  const [detalle, setDetalle] = useState(null);      // factura abierta en el modal
  const [visorPdf, setVisorPdf] = useState(null);    // { url, nombre, doc }
  const [visorXml, setVisorXml] = useState(null);    // { factura, url, titulo }
  const [revision, setRevision] = useState(null);    // { factura, estado }
  const [aclarar, setAclarar] = useState(null);      // factura sobre la que se abre aclaración
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorObs, setErrorObs] = useState(null);

  const filtradas = useMemo(() => {
    const q = normalizar(filtros.q);
    return facturas.filter(f => {
      const texto = !q
        || normalizar(f.uuid_fiscal).includes(q)
        || normalizar(f.serie_folio).includes(q)
        || normalizar(f.proveedor?.nombre).includes(q)
        || normalizar(f.empresa?.nombre).includes(q);
      const estado = filtros.estado === 'todos' || f.estado === filtros.estado;
      return texto && estado;
    });
  }, [facturas, filtros]);

  /* ── Revisión (aprobar / rechazar) ──────────────────────── */
  function abrirRevision(factura, estado) {
    setRevision({ factura, estado });
    setObservacion('');
    setErrorObs(null);
  }

  async function confirmarRevision(e) {
    e.preventDefault();
    const texto = observacion.trim();

    // Misma regla que el backend, dicha antes del viaje: rechazar sin
    // motivo deja al proveedor sin saber qué corregir (HU-3).
    if (revision.estado === 'desaprobado' && !texto) {
      setErrorObs('Escribe por qué se rechaza. El proveedor lo va a leer.');
      return;
    }

    setGuardando(true);
    try {
      const { data } = await api.patch(`/facturas/${revision.factura.id}/estado`, {
        estado: revision.estado,
        ...(texto ? { observacion: texto } : {}),
      });
      onCambio?.(data);
      setRevision(null);
      toast(revision.estado === 'aprobado' ? 'Factura aprobada' : 'Factura rechazada');
    } catch (err) {
      setErrorObs(err.response?.data?.error || 'No se pudo guardar la revisión.');
    } finally {
      setGuardando(false);
    }
  }

  async function marcarPago(factura) {
    const ok = await confirmar({
      titulo: '¿Marcar la factura como pagada?',
      texto: `Se le pedirá a ${factura.proveedor?.nombre ?? 'el proveedor'} que suba el complemento de pago, ` +
             'y no podrá enviar otra factura hasta que lo haga.',
      confirmar: 'Marcar como pagada',
    });
    if (!ok) return;

    try {
      const { data } = await api.patch(`/facturas/${factura.id}/pago`, { pagado: true });
      onCambio?.(data);
      toast('Pago registrado: el proveedor ya tiene el aviso');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo marcar el pago.');
    }
  }

  /* ── Columnas ───────────────────────────────────────────── */
  const columnas = [
    {
      clave: 'comprobante',
      titulo: 'Comprobante',
      orden: f => f.serie_folio || f.uuid_fiscal,
      clase: 'celda-elastica',
      render: f => (
        <span className={styles.proveedor}>
          <span className={styles.serie}>{f.serie_folio || 'Sin serie'}</span>
          <span className={styles.folio} title={f.uuid_fiscal}>{folioCorto(f.uuid_fiscal)}…</span>
        </span>
      ),
    },
    ...(mostrarProveedor ? [{
      clave: 'proveedor',
      titulo: 'Proveedor',
      orden: f => f.proveedor?.nombre ?? '',
      render: f => (
        <span className={styles.proveedor}>
          <span className="texto-cortado">{f.proveedor?.nombre ?? '—'}</span>
          <span className={styles.proveedorSec}>{f.proveedor?.rfc ?? 'Sin RFC'}</span>
        </span>
      ),
    }] : []),
    {
      clave: 'empresa',
      titulo: 'Empresa',
      orden: f => f.empresa?.nombre ?? '',
      render: f => f.empresa?.nombre ?? '—',
    },
    {
      clave: 'total',
      titulo: 'Total',
      orden: f => Number(f.total),
      thClase: 'th-num',
      clase: styles.importe,
      render: f => formatImporte(f.total, f.moneda),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      orden: f => f.estado,
      render: f => (
        <span className={styles.marcas}>
          <Insignia estado={f.estado}>{ETIQUETA_ESTADO[f.estado]}</Insignia>
          {f.pago_realizado && <Insignia tono="acero">Pagada</Insignia>}
          {f.pago_realizado && !f.complemento && <Insignia tono="naranja">Falta complemento</Insignia>}
          {f.complemento && (
            <Insignia tono={f.complemento.estado === 'aprobado' ? 'exito' : 'neutro'}>
              Complemento: {ETIQUETA_ESTADO_COMPLEMENTO[f.complemento.estado].toLowerCase()}
            </Insignia>
          )}
        </span>
      ),
    },
    {
      clave: 'creado_en',
      titulo: 'Subida',
      orden: f => f.creado_en,
      clase: 'col-fecha',
      render: f => formatFecha(f.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: f => (
        <span className="acciones-fila">
          <button
            type="button" className="btn-icono"
            onClick={() => setDetalle(f)}
            title="Ver detalle" aria-label={`Ver la factura ${referenciaFactura(f)}`}
          >
            <IconoOjo />
          </button>
          {esAdmin && f.estado === 'pendiente' && (
            <>
              <button
                type="button" className="btn-icono tono-exito"
                onClick={() => abrirRevision(f, 'aprobado')}
                title="Aprobar" aria-label={`Aprobar la factura ${referenciaFactura(f)}`}
              >
                <IconoCheck />
              </button>
              <button
                type="button" className="btn-icono tono-error"
                onClick={() => abrirRevision(f, 'desaprobado')}
                title="Rechazar" aria-label={`Rechazar la factura ${referenciaFactura(f)}`}
              >
                <IconoCerrar />
              </button>
            </>
          )}
          <MenuAcciones
            etiqueta={`Más acciones de la factura ${referenciaFactura(f)}`}
            opciones={[
              { etiqueta: 'Ver el PDF', Icono: IconoOjo, onClick: () => setVisorPdf({ doc: { nombre_original: f.nombre_pdf, tipo_mime: 'application/pdf' }, url: `/facturas/${f.id}/pdf` }) },
              { etiqueta: 'Ver el XML', Icono: IconoDocumentos, onClick: () => setVisorXml({ factura: f, url: `/facturas/${f.id}/xml?inline=1`, titulo: f.nombre_xml }) },
              { etiqueta: 'Descargar PDF', Icono: IconoDescargar, onClick: () => descargarArchivo(`/facturas/${f.id}/pdf`, f.nombre_pdf), separadorAntes: true },
              { etiqueta: 'Descargar XML', Icono: IconoDescargar, onClick: () => descargarArchivo(`/facturas/${f.id}/xml`, f.nombre_xml) },
              ...(f.complemento ? [
                { etiqueta: 'Ver el complemento (PDF)', Icono: IconoOjo, separadorAntes: true, onClick: () => setVisorPdf({ doc: { nombre_original: f.complemento.nombre_pdf, tipo_mime: 'application/pdf' }, url: `/facturas/${f.id}/pdf?complemento=1` }) },
                { etiqueta: 'Ver el complemento (XML)', Icono: IconoDocumentos, onClick: () => setVisorXml({ factura: { ...f.complemento, empresa: f.empresa, total: null }, url: `/facturas/${f.id}/xml?complemento=1&inline=1`, titulo: f.complemento.nombre_xml }) },
              ] : []),
              // Spec 003: la duda sobre una factura se habla con la factura
              // a la vista, no por correo con el PDF adjunto.
              { etiqueta: 'Abrir aclaración', Icono: IconoAclaracion, separadorAntes: true, onClick: () => setAclarar(f) },
              ...(esAdmin && f.estado === 'aprobado' && !f.pago_realizado ? [
                { etiqueta: 'Marcar como pagada', Icono: IconoCheck, separadorAntes: true, onClick: () => marcarPago(f) },
              ] : []),
              ...(esAdmin && f.estado !== 'pendiente' ? [
                { etiqueta: 'Volver a revisar', Icono: IconoAlerta, separadorAntes: true, onClick: () => abrirRevision(f, 'pendiente'), desactivado: f.pago_realizado },
              ] : []),
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <BarraFiltros
        busqueda={{
          valor: filtros.q,
          onChange: v => setFiltro('q', v),
          placeholder: 'Buscar por folio, proveedor o empresa…',
        }}
        campos={[{
          etiqueta: 'Estado',
          valor: filtros.estado,
          onChange: v => setFiltro('estado', v),
          opciones: [
            { valor: 'todos', texto: 'Todas' },
            { valor: 'pendiente', texto: 'En revisión' },
            { valor: 'aprobado', texto: 'Aprobadas' },
            { valor: 'desaprobado', texto: 'Rechazadas' },
          ],
        }]}
        onLimpiar={hayFiltros ? limpiar : null}
      />

      <TablaDatos
        columnas={columnas}
        filas={filtradas}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        etiqueta="facturas"
        totalSinFiltrar={facturas.length}
        claveFiltros={clave}
        ordenInicial={{ clave: 'creado_en', dir: 'desc' }}
        vacio={vacio ?? {
          titulo: hayFiltros ? 'Ninguna factura coincide' : 'Todavía no hay facturas',
          texto: hayFiltros ? 'Prueba con otro término o limpia los filtros.' : undefined,
        }}
      />

      {detalle && (
        <DetalleFactura factura={detalle} onCerrar={() => setDetalle(null)} />
      )}

      {visorPdf && (
        <VisorPDF doc={visorPdf.doc} url={visorPdf.url} onCerrar={() => setVisorPdf(null)} />
      )}

      {visorXml && (
        <VisorXML
          factura={visorXml.factura} url={visorXml.url} titulo={visorXml.titulo}
          onCerrar={() => setVisorXml(null)}
        />
      )}

      {aclarar && (
        <AbrirAclaracion factura={aclarar} onCerrar={() => setAclarar(null)} />
      )}

      {revision && (
        <Modal
          titulo={
            revision.estado === 'aprobado' ? 'Aprobar la factura'
              : revision.estado === 'desaprobado' ? 'Rechazar la factura'
              : 'Devolver a revisión'
          }
          subtitulo={`${referenciaFactura(revision.factura)} · ${formatImporte(revision.factura.total, revision.factura.moneda)}`}
          onCerrar={() => setRevision(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setRevision(null)} disabled={guardando}>
                Cancelar
              </button>
              <button
                type="submit" form="form-revision" disabled={guardando}
                className={`btn ${revision.estado === 'desaprobado' ? 'btn--peligro' : 'btn--primario'}`}
              >
                {guardando && <span className="spinner" />}
                {revision.estado === 'aprobado' ? 'Aprobar'
                  : revision.estado === 'desaprobado' ? 'Rechazar' : 'Devolver'}
              </button>
            </>
          }
        >
          <form id="form-revision" onSubmit={confirmarRevision} noValidate>
            <Campo
              etiqueta={revision.estado === 'desaprobado' ? 'Motivo del rechazo' : 'Observación'}
              error={errorObs}
              id="obs"
              opcional={revision.estado !== 'desaprobado'}
              pista={revision.estado === 'desaprobado'
                ? 'El proveedor lo verá junto a su factura: dile exactamente qué corregir.'
                : 'Queda en el historial de la factura.'}
            >
              <textarea
                id="obs" className={`control${errorObs ? ' control--invalido' : ''}`}
                rows={4} maxLength={500}
                placeholder={revision.estado === 'desaprobado'
                  ? 'Ej. El RFC receptor no corresponde a La Llar; debe ser LLA160315XYZ.'
                  : 'Añade una nota si hace falta.'}
                value={observacion}
                onChange={e => { setObservacion(e.target.value); if (errorObs) setErrorObs(null); }}
                disabled={guardando} data-foco-inicial
              />
            </Campo>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ── Detalle de una factura ─────────────────────────────────
   Todo lo que hay que saber de un comprobante en una pantalla: sus datos
   fiscales y el hilo completo de observaciones, que es el registro de qué
   se le dijo al proveedor y cuándo. */
function DetalleFactura({ factura, onCerrar }) {
  const [obs, setObs] = useState(factura.observaciones ?? []);
  const [cargando, setCargando] = useState(!factura.observaciones);

  useEffect(() => {
    // El listado trae las observaciones sin el nombre del autor; el detalle
    // sí lo resuelve, así que se vuelve a pedir la factura completa.
    let vivo = true;
    api.get(`/facturas/${factura.id}`)
      .then(({ data }) => { if (vivo) setObs(data.observaciones ?? []); })
      .catch(() => { /* se queda con lo que ya traía el listado */ })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [factura.id]);

  const datos = [
    { etiqueta: 'Folio fiscal', valor: factura.uuid_fiscal, mono: true },
    { etiqueta: 'Serie y folio', valor: factura.serie_folio },
    { etiqueta: 'RFC emisor', valor: factura.rfc_emisor, mono: true },
    { etiqueta: 'RFC receptor', valor: factura.rfc_receptor, mono: true },
    { etiqueta: 'Empresa', valor: factura.empresa?.nombre },
    { etiqueta: 'Fecha del CFDI', valor: factura.fecha_cfdi ? formatFecha(factura.fecha_cfdi) : null },
    { etiqueta: 'Aprobada el', valor: factura.fecha_aprobacion ? formatFecha(factura.fecha_aprobacion) : null },
    { etiqueta: 'Pago marcado', valor: factura.fecha_pago_marcado ? formatFecha(factura.fecha_pago_marcado) : null },
  ];

  return (
    <Modal
      titulo={`Factura ${referenciaFactura(factura)}`}
      subtitulo={`${factura.proveedor?.nombre ?? ''} · ${formatImporte(factura.total, factura.moneda)}`}
      onCerrar={onCerrar}
      ancho
      pie={<button type="button" className="btn btn--neutro" onClick={onCerrar}>Cerrar</button>}
    >
      <div className={styles.bloque}>
        <span className={styles.bloqueTitulo}>Datos del comprobante</span>
        <div className={styles.datos}>
          {datos.map(d => (
            <div className={styles.dato} key={d.etiqueta}>
              <span className={styles.datoEtiqueta}>{d.etiqueta}</span>
              <span className={`${styles.datoValor}${d.mono ? ` ${styles.datoMono}` : ''}`}>{d.valor || '—'}</span>
            </div>
          ))}
        </div>

        <div className={styles.separador} />

        <span className={styles.bloqueTitulo}>
          Observaciones{obs.length > 0 ? ` (${obs.length})` : ''}
        </span>
        {cargando && obs.length === 0 ? (
          <p className={styles.hiloVacio}>Cargando…</p>
        ) : obs.length === 0 ? (
          <p className={styles.hiloVacio}>No hay observaciones en esta factura.</p>
        ) : (
          <div className={styles.hilo}>
            {obs.map(o => (
              <div className={styles.nota} key={o.id}>
                <p className={styles.notaTexto}>{o.texto}</p>
                <p className={styles.notaPie}>
                  {o.autor ? `${o.autor} · ` : ''}{formatFechaHora(o.creado_en)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
