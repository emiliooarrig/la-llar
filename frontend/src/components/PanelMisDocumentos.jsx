import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import Layout from './Layout';
import TablaDatos from './TablaDatos';
import Insignia, { Formato } from './Insignia';
import VisorPDF, { esVisualizable } from './VisorPDF';
import { IconoSubir, IconoDescargar, IconoOjo, IconoAlerta, IconoCheck, IconoInfo } from './Iconos';
import { formatFecha } from '../lib/formato';
import { descargarArchivo } from '../lib/descargas';
import { toast, avisoError } from '../lib/alertas';
import { ventanaAbierta, mensajeVentana } from '../lib/ventanas';
import styles from './PanelMisDocumentos.module.css';

const EXTENSIONES = ['.pdf', '.xlsx', '.docx'];
const extensionValida = nombre => EXTENSIONES.some(ext => nombre.toLowerCase().endsWith(ext));

const ETIQUETA_ESTADO = { pendiente: 'En revisión', aprobado: 'Aprobado', desaprobado: 'Rechazado' };

/* La pantalla de quien sube: proveedor y gerente ven exactamente lo mismo
   sobre su propio alcance. Antes eran dos archivos de 299 líneas. */
export default function PanelMisDocumentos({ recurso }) {
  const inputRef = useRef(null);

  const [entidad, setEntidad] = useState(null);
  const [ventana, setVentana] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [docVisor, setDocVisor] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [e, v] = await Promise.all([
        api.get(recurso.base),
        api.get(`/ventanas/${recurso.modulo}`),
      ]);
      setEntidad(e.data);
      setVentana(v.data);
    } catch {
      setError('No se pudieron cargar tus documentos. Revisa tu conexión.');
    } finally {
      setCargando(false);
    }
  }

  const docs = entidad?.[recurso.campoDocs] ?? [];
  const abierta = ventanaAbierta(ventana);
  const aviso = useMemo(() => mensajeVentana(ventana), [ventana]);

  const resumen = useMemo(() => ({
    pendiente: docs.filter(d => d.estado === 'pendiente').length,
    aprobado: docs.filter(d => d.estado === 'aprobado').length,
    desaprobado: docs.filter(d => d.estado === 'desaprobado').length,
  }), [docs]);

  async function subir(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!extensionValida(file.name)) {
      await avisoError('Sólo se aceptan archivos PDF, Excel (.xlsx) y Word (.docx).', 'Formato no permitido');
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const { data } = await api.post(`${recurso.base}/${entidad.id}/documentos`, formData, {
        headers: { 'Content-Type': undefined },
      });
      setEntidad(prev => ({ ...prev, [recurso.campoDocs]: [data, ...(prev[recurso.campoDocs] ?? [])] }));
      toast('Documento subido: queda en revisión');
    } catch (err) {
      await avisoError(err.response?.data?.error ?? 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }

  const columnas = [
    {
      clave: 'nombre_original',
      titulo: 'Archivo',
      orden: d => d.nombre_original,
      clase: 'celda-elastica',
      render: d => (
        <span className={styles.archivo}>
          <Formato mime={d.tipo_mime} />
          <span className="texto-cortado" title={d.nombre_original}>{d.nombre_original}</span>
        </span>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      orden: d => d.estado,
      render: d => <Insignia estado={d.estado}>{ETIQUETA_ESTADO[d.estado]}</Insignia>,
    },
    {
      clave: 'creado_en',
      titulo: 'Subido',
      orden: d => d.creado_en,
      clase: 'col-fecha',
      render: d => formatFecha(d.creado_en),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      thClase: 'th-acciones',
      clase: 'col-acciones',
      render: d => (
        <span className="acciones-fila">
          {esVisualizable(d) && (
            <button
              type="button" className="btn-icono" onClick={() => setDocVisor(d)}
              title="Ver documento" aria-label={`Ver ${d.nombre_original}`}
            >
              <IconoOjo />
            </button>
          )}
          <button
            type="button" className="btn-icono tono-acero"
            onClick={() => descargarArchivo(`${recurso.base}/documentos/${d.id}/descargar`, d.nombre_original)}
            title="Descargar" aria-label={`Descargar ${d.nombre_original}`}
          >
            <IconoDescargar />
          </button>
        </span>
      ),
    },
  ];

  return (
    <Layout
      titulo={recurso.titulo}
      subtitulo={entidad ? recurso.subtitulo(entidad) : undefined}
      acciones={
        <>
          <input
            ref={inputRef} type="file" accept=".pdf,.xlsx,.docx"
            style={{ display: 'none' }} onChange={subir}
          />
          <button
            type="button" className="btn btn--primario"
            onClick={() => inputRef.current?.click()}
            disabled={!abierta || subiendo || cargando}
            title={abierta ? 'Subir un documento' : 'La ventana de carga está cerrada'}
          >
            {subiendo ? <><span className="spinner" /> Subiendo…</> : <><IconoSubir /> Subir documento</>}
          </button>
        </>
      }
    >
      {/* El aviso dice siempre hasta cuándo o desde cuándo: un botón
          deshabilitado sin explicación obliga a llamar por teléfono. */}
      <div className={`aviso aviso--${aviso.tono}`}>
        {aviso.tono === 'exito' ? <IconoCheck /> : <IconoInfo />}
        <span>{aviso.texto}</span>
      </div>

      {/* Estado de la documentación en una línea, no en tres tarjetas. */}
      {!cargando && docs.length > 0 && (
        <p className={styles.resumen}>
          {resumen.pendiente > 0 && <><strong>{resumen.pendiente}</strong> en revisión</>}
          {resumen.pendiente > 0 && (resumen.aprobado > 0 || resumen.desaprobado > 0) && ' · '}
          {resumen.aprobado > 0 && <><strong>{resumen.aprobado}</strong> aprobado{resumen.aprobado === 1 ? '' : 's'}</>}
          {resumen.aprobado > 0 && resumen.desaprobado > 0 && ' · '}
          {resumen.desaprobado > 0 && (
            <span className={styles.rechazados}>
              <IconoAlerta tamano={13} /> <strong>{resumen.desaprobado}</strong> rechazado{resumen.desaprobado === 1 ? '' : 's'}: vuelve a subirlos corregidos
            </span>
          )}
        </p>
      )}

      <TablaDatos
        columnas={columnas}
        filas={docs}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        etiqueta="documentos"
        ordenInicial={{ clave: 'creado_en', dir: 'desc' }}
        vacio={{
          titulo: 'Todavía no has subido documentos',
          texto: abierta
            ? 'Usa «Subir documento» para enviar tu primer archivo (PDF, Excel o Word).'
            : 'Cuando el administrador abra la ventana de carga podrás subir tus archivos aquí.',
          icono: IconoSubir,
        }}
      />

      {docVisor && (
        <VisorPDF
          doc={docVisor}
          url={`${recurso.base}/documentos/${docVisor.id}/descargar`}
          onCerrar={() => setDocVisor(null)}
        />
      )}
    </Layout>
  );
}
