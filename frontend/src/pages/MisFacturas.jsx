import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import PanelFacturas from '../components/PanelFacturas';
import SelectorEmpresa from '../components/SelectorEmpresa';
import VisorPDF from '../components/VisorPDF';
import {
  IconoSubir, IconoAlerta, IconoInfo, IconoDocumentos, IconoDescargar, IconoCheck, IconoOjo,
} from '../components/Iconos';
import { descargarArchivo } from '../lib/descargas';
import { toast, avisoError } from '../lib/alertas';
import { referenciaFactura } from '../lib/facturas';
import styles from './MisFacturas.module.css';

/* Portal de facturación del proveedor (spec 001 HU-2, HU-4, HU-7, HU-8).
 *
 * Todo lo que frena una subida se dice ARRIBA y antes de que el proveedor
 * prepare nada: bloqueo del administrador, complemento pendiente. Un botón
 * deshabilitado sin explicación acaba siempre en una llamada telefónica. */

const FORM_VACIO = { xml: null, pdf: null, empresa_id: '' };

export default function MisFacturas() {
  const refXml = useRef(null);
  const refPdf = useRef(null);

  const [proveedor, setProveedor] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [bloqueoComplemento, setBloqueoComplemento] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [ejemplo, setEjemplo] = useState(null);
  const [verEjemplo, setVerEjemplo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);   // 'factura' | { complementoDe: factura }
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const { data: perfil } = await api.get('/proveedores');
      setProveedor(perfil);

      /* Los tres bloques secundarios no deben tumbar la página si fallan:
         sin ejemplo publicado o sin alertas, las facturas se siguen viendo. */
      const [lista, avisos, guia] = await Promise.allSettled([
        api.get(`/proveedores/${perfil.id}/facturas`),
        api.get('/alertas/mias'),
        api.get('/config/ejemplo-factura/info'),
      ]);

      if (lista.status === 'fulfilled') {
        setFacturas(lista.value.data.facturas ?? []);
        setBloqueoComplemento(lista.value.data.complemento_pendiente ?? null);
      } else {
        setError('No se pudieron cargar tus facturas. Revisa tu conexión.');
      }
      if (avisos.status === 'fulfilled') setAlertas(avisos.value.data.alertas ?? []);
      if (guia.status === 'fulfilled' && guia.value.data.publicado) setEjemplo(guia.value.data);
    } catch {
      setError('No se pudo cargar tu perfil. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  const bloqueado = Boolean(proveedor?.bloqueado_facturar);
  const puedeSubir = !bloqueado && !bloqueoComplemento;

  /* ── Subida ─────────────────────────────────────────────── */
  function abrirFactura() {
    setForm(FORM_VACIO);
    setErrores({});
    setModal({ tipo: 'factura' });
  }

  function abrirComplemento(factura) {
    setForm(FORM_VACIO);
    setErrores({});
    setModal({ tipo: 'complemento', factura });
  }

  function elegir(campo, archivo) {
    setForm(p => ({ ...p, [campo]: archivo }));
    if (errores[campo]) setErrores(p => ({ ...p, [campo]: undefined }));
  }

  async function enviar(e) {
    e.preventDefault();
    const esComplemento = modal.tipo === 'complemento';

    const fallos = {};
    if (!form.xml) fallos.xml = 'Falta el XML del comprobante.';
    else if (!form.xml.name.toLowerCase().endsWith('.xml')) fallos.xml = 'El archivo debe ser .xml';
    if (!form.pdf) fallos.pdf = 'Falta el PDF.';
    else if (!form.pdf.name.toLowerCase().endsWith('.pdf')) fallos.pdf = 'El archivo debe ser .pdf';
    if (!esComplemento && !form.empresa_id) fallos.empresa_id = 'Indica a qué empresa facturas.';
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    const datos = new FormData();
    datos.append('xml', form.xml);
    datos.append('pdf', form.pdf);
    if (!esComplemento) datos.append('empresa_id', form.empresa_id);

    const ruta = esComplemento
      ? `/facturas/${modal.factura.id}/complemento`
      : `/proveedores/${proveedor.id}/facturas`;

    setEnviando(true);
    try {
      await api.post(ruta, datos, { headers: { 'Content-Type': undefined } });
      setModal(null);
      toast(esComplemento ? 'Complemento enviado: queda en revisión' : 'Factura enviada: queda en revisión');
      await cargar();   // el bloqueo y las alertas cambian con la subida
    } catch (err) {
      const mensaje = err.response?.data?.error || 'No se pudo enviar. Inténtalo de nuevo.';
      /* El duplicado y el CFDI mal timbrado se anclan al campo del XML, que
         es el archivo que hay que cambiar. */
      if (/folio fiscal|XML|CFDI|timbrado/i.test(mensaje)) setErrores({ xml: mensaje });
      else if (/PDF/i.test(mensaje)) setErrores({ pdf: mensaje });
      else await avisoError(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  const facturaComplemento = facturas.find(f => f.id === bloqueoComplemento?.id);

  return (
    <Layout
      titulo="Mis facturas"
      subtitulo={proveedor ? `${proveedor.nombre}${proveedor.rfc ? ` · RFC ${proveedor.rfc}` : ''}` : undefined}
      migas={[{ etiqueta: 'Mis facturas' }]}
      acciones={
        <button
          type="button" className="btn btn--primario"
          onClick={abrirFactura}
          disabled={!puedeSubir || cargando}
          title={
            bloqueado ? 'Tienes la facturación bloqueada'
              : bloqueoComplemento ? 'Sube primero el complemento de pago pendiente'
              : 'Subir una factura'
          }
        >
          <IconoSubir /> Subir factura
        </button>
      }
    >
      <div className={styles.avisos}>
        {bloqueado && (
          <div className="aviso aviso--error" role="alert">
            <IconoAlerta />
            <span>
              <strong>Tu facturación está bloqueada.</strong>{' '}
              {proveedor.motivo_bloqueo || 'Contacta al administrador.'}
            </span>
          </div>
        )}

        {bloqueoComplemento && !bloqueado && (
          <div className="aviso aviso--atencion" role="alert">
            <IconoAlerta />
            <span>
              Falta el complemento de pago de la factura <strong>{bloqueoComplemento.referencia}</strong>.
              No podrás subir otra factura hasta que lo envíes.
            </span>
            {facturaComplemento && (
              <span className="aviso__cola">
                <button type="button" className="btn btn--primario btn--sm" onClick={() => abrirComplemento(facturaComplemento)}>
                  Subir complemento
                </button>
              </span>
            )}
          </div>
        )}

        {alertas.filter(a => a.tipo === 'factura_rechazada').map(a => (
          <div className="aviso aviso--error" key={`${a.tipo}-${a.referencia_id}`}>
            <IconoInfo />
            <span><strong>{a.titulo}.</strong> {a.detalle}</span>
          </div>
        ))}
      </div>

      {/* Ejemplo de factura (HU-7): el material de apoyo va antes de la
          tabla, que es donde sirve de algo —cuando todavía no ha subido—. */}
      {ejemplo && (
        <div className={styles.ejemplo}>
          <span className={styles.ejemploIcono}><IconoDocumentos tamano={22} /></span>
          <span className={styles.ejemploTexto}>
            <span className={styles.ejemploTitulo}>Ejemplo de factura</span>
            <span className={styles.ejemploPista}>
              Así debe verse lo que subes. Documento de referencia, no hay que llenarlo.
            </span>
          </span>
          <span className={styles.ejemploAcciones}>
            <button type="button" className="btn btn--neutro btn--sm" onClick={() => setVerEjemplo(true)}>
              <IconoOjo /> Ver ejemplo
            </button>
            <button
              type="button" className="btn btn--neutro btn--sm"
              onClick={() => descargarArchivo('/config/ejemplo-factura', ejemplo.nombre_original)}
            >
              <IconoDescargar /> Descargar
            </button>
          </span>
        </div>
      )}

      {/* Vista previa en el navegador: consultar el ejemplo no debería dejar
          una copia más en la carpeta de descargas del proveedor. */}
      <VisorPDF
        doc={verEjemplo ? ejemplo : null}
        url="/config/ejemplo-factura?inline=1"
        onCerrar={() => setVerEjemplo(false)}
      />

      <PanelFacturas
        facturas={facturas}
        esAdmin={false}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        onCambio={f => setFacturas(prev => prev.map(x => (x.id === f.id ? f : x)))}
        vacio={{
          titulo: 'Todavía no has subido facturas',
          texto: puedeSubir
            ? 'Usa «Subir factura» y adjunta el XML y el PDF de tu CFDI.'
            : 'Cuando se levante el bloqueo podrás subir tus facturas aquí.',
          icono: IconoSubir,
        }}
      />

      {modal && (
        <Modal
          titulo={modal.tipo === 'complemento' ? 'Subir complemento de pago' : 'Subir factura'}
          subtitulo={modal.tipo === 'complemento'
            ? `De la factura ${referenciaFactura(modal.factura)}`
            : 'Adjunta el XML y el PDF del mismo CFDI.'}
          onCerrar={() => setModal(null)}
          bloqueado={enviando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={enviando}>
                Cancelar
              </button>
              <button type="submit" form="form-factura" className="btn btn--primario" disabled={enviando}>
                {enviando && <span className="spinner" />}
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </>
          }
        >
          <form id="form-factura" onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            {modal.tipo !== 'complemento' && (
              <Campo
                etiqueta="Empresa a la que facturas" error={errores.empresa_id} id="f-empresa"
                pista="Debe coincidir con el RFC receptor de tu CFDI."
              >
                <SelectorEmpresa
                  id="f-empresa"
                  valor={form.empresa_id}
                  onChange={v => elegir('empresa_id', v)}
                  className={`control${errores.empresa_id ? ' control--invalido' : ''}`}
                  disabled={enviando}
                  autoSeleccionarUnica
                />
              </Campo>
            )}

            <div className={styles.campos}>
              <Campo etiqueta="XML del CFDI" error={errores.xml} id="f-xml">
                <input
                  ref={refXml} id="f-xml" type="file" accept=".xml,application/xml,text/xml"
                  style={{ display: 'none' }} disabled={enviando}
                  onChange={e => elegir('xml', e.target.files?.[0] ?? null)}
                />
                <button
                  type="button" disabled={enviando}
                  className={`${styles.archivo}${form.xml ? ` ${styles.archivoElegido}` : ''}`}
                  onClick={() => refXml.current?.click()}
                >
                  <span className={styles.archivoIcono}>
                    {form.xml ? <IconoCheck tamano={20} /> : <IconoSubir tamano={20} />}
                  </span>
                  <span className={styles.archivoTexto}>
                    <span className={styles.archivoNombre}>{form.xml ? form.xml.name : 'Elegir archivo .xml'}</span>
                    <span className={styles.archivoPista}>{form.xml ? 'Pulsa para cambiarlo' : 'El comprobante timbrado'}</span>
                  </span>
                </button>
              </Campo>

              <Campo etiqueta="PDF de la factura" error={errores.pdf} id="f-pdf">
                <input
                  ref={refPdf} id="f-pdf" type="file" accept=".pdf,application/pdf"
                  style={{ display: 'none' }} disabled={enviando}
                  onChange={e => elegir('pdf', e.target.files?.[0] ?? null)}
                />
                <button
                  type="button" disabled={enviando}
                  className={`${styles.archivo}${form.pdf ? ` ${styles.archivoElegido}` : ''}`}
                  onClick={() => refPdf.current?.click()}
                >
                  <span className={styles.archivoIcono}>
                    {form.pdf ? <IconoCheck tamano={20} /> : <IconoSubir tamano={20} />}
                  </span>
                  <span className={styles.archivoTexto}>
                    <span className={styles.archivoNombre}>{form.pdf ? form.pdf.name : 'Elegir archivo .pdf'}</span>
                    <span className={styles.archivoPista}>{form.pdf ? 'Pulsa para cambiarlo' : 'La representación impresa'}</span>
                  </span>
                </button>
              </Campo>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
