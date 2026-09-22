import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import TablaDatos from '../components/TablaDatos';
import SelectorEmpresa from '../components/SelectorEmpresa';
import { IconoDescargar, IconoChevron } from '../components/Iconos';
import { useFiltrosURL } from '../hooks/useFiltrosURL';
import { descargarArchivo } from '../lib/descargas';
import { formatImporte, folioCorto, formatFechaISO, lunesDe, sumarDiasISO } from '../lib/facturas';
import { plural } from '../lib/formato';
import styles from './ResumenFacturas.module.css';

/* Resumen semanal de facturas aprobadas (spec 001 HU-9).
 *
 * Lo que responde esta pantalla es "qué autorizamos a pagar esta semana y
 * para cuándo". Por eso el rango se mueve por semanas con dos flechas: el
 * administrador la consulta cada lunes, no escribe fechas sueltas.
 *
 * La tabla y las exportaciones salen del MISMO endpoint: el Excel y el PDF
 * los arma el servidor con los datos que está pintando esta pantalla, así
 * que no pueden discrepar. */

const FILTROS_BASE = { empresa: '', desde: '', hasta: '' };

export default function ResumenFacturas() {
  const { filtros, setFiltros, clave } = useFiltrosURL(FILTROS_BASE);

  // Sin fechas en la URL, la semana en curso.
  const desde = filtros.desde || lunesDe();
  const hasta = filtros.hasta || sumarDiasISO(lunesDe(), 6);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exportando, setExportando] = useState(null);

  const consulta = useMemo(() => {
    const p = new URLSearchParams({ desde, hasta });
    if (filtros.empresa) p.set('empresa', filtros.empresa);
    return p.toString();
  }, [desde, hasta, filtros.empresa]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await api.get(`/facturas/resumen?${consulta}`);
      setDatos(data);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo generar el resumen.');
    } finally {
      setCargando(false);
    }
  }, [consulta]);

  useEffect(() => { cargar(); }, [cargar]);

  function moverSemana(semanas) {
    setFiltros({ desde: sumarDiasISO(desde, semanas * 7), hasta: sumarDiasISO(hasta, semanas * 7) });
  }

  async function exportar(formato) {
    setExportando(formato);
    const nombre = `resumen-facturas_${desde}_${hasta}.${formato}`;
    await descargarArchivo(`/facturas/resumen?${consulta}&formato=${formato}`, nombre);
    setExportando(null);
  }

  const filas = datos?.filas ?? [];

  const columnas = [
    {
      clave: 'proveedor',
      titulo: 'Proveedor',
      orden: f => f.proveedor,
      clase: 'celda-elastica',
      render: f => (
        <span className={styles.apilado}>
          <span className="texto-cortado">{f.proveedor}</span>
          <span className={styles.apiladoSec}>{f.rfc || 'Sin RFC'}</span>
        </span>
      ),
    },
    { clave: 'empresa', titulo: 'Empresa', orden: f => f.empresa, render: f => f.empresa },
    {
      clave: 'comprobante',
      titulo: 'Comprobante',
      orden: f => f.serie_folio || f.uuid_fiscal,
      render: f => (
        <span className={styles.apilado}>
          <span>{f.serie_folio || 'Sin serie'}</span>
          <span className={styles.folio} title={f.uuid_fiscal}>{folioCorto(f.uuid_fiscal)}…</span>
        </span>
      ),
    },
    { clave: 'fecha_aprobacion', titulo: 'Aprobación', orden: f => f.fecha_aprobacion, clase: 'col-fecha', render: f => formatFechaISO(f.fecha_aprobacion) },
    {
      clave: 'dias_credito',
      titulo: 'Días crédito',
      orden: f => f.dias_credito,
      thClase: 'th-num',
      clase: 'col-num',
      render: f => (
        <span>
          {f.dias_credito}
          {f.dias_credito_sin_configurar && <><br /><span className={styles.sinConfigurar}>sin configurar</span></>}
        </span>
      ),
    },
    { clave: 'fecha_pago_estimada', titulo: 'Pago estimado', orden: f => f.fecha_pago_estimada, clase: 'col-fecha', render: f => formatFechaISO(f.fecha_pago_estimada) },
    {
      clave: 'total',
      titulo: 'Total',
      orden: f => Number(f.total),
      thClase: 'th-num',
      clase: styles.importe,
      render: f => formatImporte(f.total, f.moneda),
    },
  ];

  return (
    <Layout
      titulo="Resumen de facturas"
      subtitulo="Facturas aprobadas en el periodo, con su fecha de pago estimada."
      migas={[{ etiqueta: 'Resumen de facturas' }]}
    >
      <div className={`${styles.controles} no-imprimir`}>
        <div className={styles.control}>
          <span className={styles.controlEtiqueta}>Empresa</span>
          <SelectorEmpresa
            valor={filtros.empresa}
            onChange={v => setFiltros({ empresa: v })}
            incluirTodas
          />
        </div>

        <div className={styles.control}>
          <span className={styles.controlEtiqueta}>Periodo</span>
          <div className={styles.semana}>
            <button type="button" className="btn-icono" onClick={() => moverSemana(-1)} aria-label="Semana anterior">
              <IconoChevron dir="izquierda" />
            </button>
            <input
              type="date" className="control" value={desde} aria-label="Desde"
              onChange={e => setFiltros({ desde: e.target.value })}
            />
            <input
              type="date" className="control" value={hasta} aria-label="Hasta"
              onChange={e => setFiltros({ hasta: e.target.value })}
            />
            <button type="button" className="btn-icono" onClick={() => moverSemana(1)} aria-label="Semana siguiente">
              <IconoChevron dir="derecha" />
            </button>
          </div>
        </div>

        <div className={styles.cola}>
          <button
            type="button" className="btn btn--neutro"
            onClick={() => exportar('xlsx')}
            disabled={cargando || exportando !== null || filas.length === 0}
          >
            {exportando === 'xlsx' ? <span className="spinner" /> : <IconoDescargar />} Excel
          </button>
          <button
            type="button" className="btn btn--neutro"
            onClick={() => exportar('pdf')}
            disabled={cargando || exportando !== null || filas.length === 0}
          >
            {exportando === 'pdf' ? <span className="spinner" /> : <IconoDescargar />} PDF
          </button>
        </div>
      </div>

      {datos && !cargando && (
        <div className={styles.cifras}>
          <div className={styles.cifra}>
            <span className={styles.cifraNumero}>{datos.totales.facturas}</span>
            <span className={styles.cifraEtiqueta}>
              {datos.totales.facturas === 1 ? 'factura aprobada' : 'facturas aprobadas'}
            </span>
          </div>
          <div className={styles.cifra}>
            <span className={styles.cifraNumero}>{datos.totales.proveedores}</span>
            <span className={styles.cifraEtiqueta}>
              {datos.totales.proveedores === 1 ? 'proveedor' : 'proveedores'}
            </span>
          </div>
          {datos.totales.por_moneda.map(t => (
            <div className={styles.cifra} key={t.moneda}>
              <span className={`${styles.cifraNumero} ${styles.cifraImporte}`}>{formatImporte(t.total, t.moneda)}</span>
              <span className={styles.cifraEtiqueta}>total {t.moneda}</span>
            </div>
          ))}
          {datos.totales.sin_configurar > 0 && (
            <div className={styles.cifra}>
              <span className={`${styles.cifraNumero} ${styles.sinConfigurar}`} style={{ fontSize: 24 }}>
                {datos.totales.sin_configurar}
              </span>
              <span className={styles.cifraEtiqueta}>sin días de crédito configurados</span>
            </div>
          )}
        </div>
      )}

      <TablaDatos
        columnas={columnas}
        filas={filas}
        clave={f => f.factura_id}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        etiqueta="facturas"
        claveFiltros={clave}
        porPagina={25}
        vacio={{
          titulo: 'No hay facturas aprobadas en este periodo',
          texto: 'Cambia el rango de fechas o revisa las facturas pendientes de aprobación.',
        }}
      />
    </Layout>
  );
}
