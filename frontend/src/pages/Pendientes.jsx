import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import EstadoDato from '../components/EstadoDato';
import Insignia, { Formato } from '../components/Insignia';
import { IconoProveedores, IconoUnidades, IconoDescargar, IconoCheck, IconoCerrar } from '../components/Iconos';
import { formatFecha, diasDesde, plural } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { toast, avisoError } from '../lib/alertas';
import { invalidarPendientes } from '../hooks/usePendientes';
import styles from './Pendientes.module.css';

/* Cada origen mapea a su color de identidad y a su endpoint. */
const TIPO_META = {
  proveedor: { etiqueta: 'Proveedor', base: '/proveedores/documentos', tono: styles.tonoOliva, insignia: 'exito', Icono: IconoProveedores },
  unidad:    { etiqueta: 'Unidad',    base: '/unidades/documentos',    tono: styles.tonoNaranja, insignia: 'naranja', Icono: IconoUnidades },
};

export default function Pendientes() {
  const [params, setParams] = useSearchParams();
  const [datos, setDatos] = useState({ total: 0, proveedores: 0, unidades: 0, documentos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [procesando, setProcesando] = useState(null);

  const filtroTipo = params.get('tipo');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(false);
    try {
      const { data } = await api.get('/pendientes');
      setDatos(data);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  const documentos = useMemo(
    () => (filtroTipo ? datos.documentos.filter(d => d.tipo === filtroTipo) : datos.documentos),
    [datos.documentos, filtroTipo]
  );

  function filtrar(tipo) {
    const siguiente = new URLSearchParams(params);
    if (tipo) siguiente.set('tipo', tipo); else siguiente.delete('tipo');
    setParams(siguiente, { replace: true });
  }

  /* Aprobar y rechazar no piden confirmación: ambas son reversibles desde
     el detalle del proveedor o de la unidad. Pedir un "¿seguro?" por cada
     documento convertía una bandeja de veinte en sesenta clics. */
  async function resolver(doc, estado) {
    const meta = TIPO_META[doc.tipo];
    setProcesando(doc.key);
    try {
      await api.patch(`${meta.base}/${doc.doc_id}/estado`, { estado });
      setDatos(prev => ({
        ...prev,
        total: prev.total - 1,
        proveedores: prev.proveedores - (doc.tipo === 'proveedor' ? 1 : 0),
        unidades: prev.unidades - (doc.tipo === 'unidad' ? 1 : 0),
        documentos: prev.documentos.filter(d => d.key !== doc.key),
      }));
      invalidarPendientes();
      toast(estado === 'aprobado' ? 'Documento aprobado' : 'Documento rechazado');
    } catch {
      await avisoError('No se pudo actualizar el documento. Vuelve a intentarlo.');
    } finally {
      setProcesando(null);
    }
  }

  const hayCola = datos.total > 0;

  return (
    <Layout
      titulo="Por revisar"
      subtitulo="Documentos de proveedores y unidades esperando tu aprobación."
      migas={[{ etiqueta: 'Por revisar' }]}
    >
      <div className={`${styles.banda} ${hayCola ? styles.bandaAlerta : styles.bandaCalma}`}>
        <div className={styles.bandaCifra}>
          <span className={styles.bandaNumero}>{cargando ? '—' : datos.total}</span>
          <span className={styles.bandaTexto}>
            {hayCola ? `documento${datos.total === 1 ? '' : 's'} en cola` : 'todo al día'}
          </span>
        </div>

        <div className={`${styles.bandaChips} no-imprimir`}>
          <button type="button" className={`chip${!filtroTipo ? ' chip--activo' : ''}`} onClick={() => filtrar(null)}>
            Todos <span className="chip__conteo">{datos.total}</span>
          </button>
          <button type="button" className={`chip${filtroTipo === 'proveedor' ? ' chip--activo' : ''}`} onClick={() => filtrar('proveedor')}>
            Proveedores <span className="chip__conteo">{datos.proveedores}</span>
          </button>
          <button type="button" className={`chip${filtroTipo === 'unidad' ? ' chip--activo' : ''}`} onClick={() => filtrar('unidad')}>
            Unidades <span className="chip__conteo">{datos.unidades}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="tarjeta">
          <EstadoDato estado="error" titulo="No se pudo cargar la bandeja" onReintentar={cargar} />
        </div>
      ) : cargando ? (
        <div className={styles.cola} aria-busy="true">
          {[0, 1, 2].map(i => <div key={i} className={`${styles.ticket} ${styles.skel}`} />)}
        </div>
      ) : documentos.length === 0 ? (
        <div className="tarjeta">
          <EstadoDato
            estado="vacio"
            titulo={filtroTipo ? 'Sin pendientes en este origen' : 'Bandeja vacía'}
            texto={filtroTipo
              ? 'Prueba quitando el filtro para ver el resto de la cola.'
              : 'No hay documentos por revisar: todo está aprobado o rechazado.'}
          />
        </div>
      ) : (
        <div className={styles.cola}>
          {documentos.map(doc => {
            const meta = TIPO_META[doc.tipo];
            const dias = diasDesde(doc.creado_en);
            const ocupado = procesando === doc.key;
            return (
              <article key={doc.key} className={`${styles.ticket} ${ocupado ? styles.ticketProcesando : ''}`}>
                <span className={`${styles.ticketIcono} ${meta.tono}`}><meta.Icono tamano={19} /></span>

                <div className={styles.ticketCuerpo}>
                  <div className={styles.ticketLinea1}>
                    <Insignia tono={meta.insignia} punto={false}>{meta.etiqueta}</Insignia>
                    <span className={styles.ticketOrigen}>{doc.origen}</span>
                  </div>

                  <button
                    type="button"
                    className={styles.ticketArchivo}
                    onClick={() => descargarArchivo(`${meta.base}/${doc.doc_id}/descargar`, doc.nombre_original)}
                    title="Descargar para revisar"
                  >
                    <Formato mime={doc.tipo_mime} />
                    <span className={styles.ticketArchivoNombre}>{doc.nombre_original}</span>
                  </button>

                  <div className={styles.ticketMeta}>
                    <span>Subido {formatFecha(doc.creado_en)}</span>
                    {dias > 0 && (
                      <span className={`${styles.espera} ${dias >= 3 ? styles.esperaAlta : ''}`}>
                        {plural(dias, 'día')} en espera
                      </span>
                    )}
                    {doc.subido_por && <span>por {doc.subido_por}</span>}
                  </div>
                </div>

                <div className={styles.ticketAcciones}>
                  <button
                    type="button" className="btn-icono tono-acero"
                    onClick={() => descargarArchivo(`${meta.base}/${doc.doc_id}/descargar`, doc.nombre_original)}
                    disabled={ocupado} title="Descargar" aria-label={`Descargar ${doc.nombre_original}`}
                  >
                    <IconoDescargar />
                  </button>
                  <button
                    type="button" className="btn btn--sm btn--peligro"
                    onClick={() => resolver(doc, 'desaprobado')} disabled={ocupado}
                  >
                    <IconoCerrar tamano={14} /> Rechazar
                  </button>
                  <button
                    type="button" className="btn btn--sm btn--exito"
                    onClick={() => resolver(doc, 'aprobado')} disabled={ocupado}
                  >
                    <IconoCheck tamano={14} /> Aprobar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
