import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import EstadoDato from '../components/EstadoDato';
import Insignia from '../components/Insignia';
import { IconoEmpleados, IconoDocumentos, IconoUnidades, IconoAsistencias, IconoCheck } from '../components/Iconos';
import styles from './Dashboard.module.css';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaHoy() {
  return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fechaCorta(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/* Sólo el administrador tiene panel: gerente y proveedor entran
   directamente a su módulo (ver INICIO_POR_ROL). Una portada con dos
   tarjetas de acceso, teniendo el rail al lado, sobraba. */
export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(false);
    try {
      const { data } = await api.get('/dashboard/kpis');
      setKpis(data);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Layout titulo="Resumen del día" subtitulo={fechaHoy()}>
      {error ? (
        <div className="tarjeta">
          <EstadoDato
            estado="error"
            titulo="No se pudo cargar el resumen"
            texto="Los módulos siguen disponibles desde el menú lateral."
            onReintentar={cargar}
          />
        </div>
      ) : cargando || !kpis ? (
        <TableroCargando />
      ) : (
        <Tablero kpis={kpis} />
      )}
    </Layout>
  );
}

function Tablero({ kpis }) {
  const { empleados, documentosPendientes, ventanas, asistenciaHoy } = kpis;
  const maxEstacion = Math.max(...empleados.porSucursal.map(s => s.total), 1);
  const hayPendientes = documentosPendientes.total > 0;
  const pct = asistenciaHoy.plantilla > 0
    ? Math.round((asistenciaHoy.presentes / asistenciaHoy.plantilla) * 100)
    : 0;

  return (
    <div className={styles.tablero}>
      {/* Brigada activa — cifra estrella con desglose por estación */}
      <article className={`${styles.card} ${styles.cardBrigada}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${styles.iconoNaranja}`}><IconoEmpleados tamano={17} trazo={2} /></span>
          <span className={styles.cardEtiqueta}>Brigada activa</span>
        </div>
        <div className={styles.brigadaCifra}>
          <span className={styles.numeroHero}>{empleados.activos}</span>
          <span className={styles.numeroUnidad}>
            en plantilla
            {empleados.inactivos > 0 && ` · ${empleados.inactivos} inactivo${empleados.inactivos === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className={styles.estaciones}>
          {empleados.porSucursal.map(s => (
            <div key={s.id} className={styles.estacion}>
              <span className={styles.estacionNombre}>{s.nombre}</span>
              <span className={styles.estacionBarraPista}>
                <span className={styles.estacionBarra} style={{ width: `${(s.total / maxEstacion) * 100}%` }} />
              </span>
              <span className={styles.estacionTotal}>{s.total}</span>
            </div>
          ))}
        </div>
      </article>

      {/* Por revisar — lámpara de calor: ámbar si hay cola, verde en calma */}
      <article className={`${styles.card} ${styles.cardComandas} ${hayPendientes ? styles.comandasAlerta : styles.comandasCalma}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${hayPendientes ? styles.iconoAmbar : styles.iconoOliva}`}>
            <IconoDocumentos tamano={17} trazo={2} />
          </span>
          <span className={styles.cardEtiqueta}>Por revisar</span>
        </div>
        {hayPendientes ? (
          <>
            <div className={styles.comandasCifra}>
              <span className={styles.numeroGrande}>{documentosPendientes.total}</span>
              <span className={styles.numeroUnidad}>
                documento{documentosPendientes.total === 1 ? '' : 's'} esperan aprobación
              </span>
            </div>
            <div className={styles.comandasRieles}>
              <Riel etiqueta="Proveedores" valor={documentosPendientes.proveedores} to="/admin/pendientes?tipo=proveedor" />
              <Riel etiqueta="Unidades" valor={documentosPendientes.unidades} to="/admin/pendientes?tipo=unidad" />
            </div>
          </>
        ) : (
          <div className={styles.todoAlDia}>
            <span className={styles.checkOk}><IconoCheck tamano={19} /></span>
            <div>
              <div className={styles.todoAlDiaTitulo}>Todo al día</div>
              <div className={styles.todoAlDiaSub}>No hay documentos por revisar.</div>
            </div>
          </div>
        )}
      </article>

      {/* El pase — letreros de ventanilla */}
      <article className={`${styles.card} ${styles.cardPase}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${styles.iconoAcero}`}><IconoUnidades tamano={17} trazo={2} /></span>
          <span className={styles.cardEtiqueta}>Ventanas de carga</span>
        </div>
        <Letrero etiqueta="Proveedores" abierta={ventanas.proveedores} to="/admin/proveedores" />
        <Letrero etiqueta="Unidades" abierta={ventanas.unidades} to="/admin/unidades" />
      </article>

      {/* Servicio de hoy — barra de llenado */}
      <article className={`${styles.card} ${styles.cardServicio}`}>
        <div className={styles.cardEncabezado}>
          <span className={`${styles.cardIcono} ${styles.iconoNaranja}`}><IconoAsistencias tamano={17} trazo={2} /></span>
          <span className={styles.cardEtiqueta}>Asistencia de hoy</span>
        </div>
        <div className={styles.servicioCifra}>
          <span className={styles.numeroGrande}>{asistenciaHoy.presentes}</span>
          <span className={styles.numeroUnidad}>de {asistenciaHoy.plantilla} registraron entrada</span>
        </div>
        <span className={styles.fillPista}>
          <span className={styles.fillBarra} style={{ width: `${pct}%` }} />
        </span>
        <div className={styles.servicioPie}>
          {/* Un cero sin contexto parece un fallo del sistema; la última
              marca dice si el checador está vivo. */}
          {asistenciaHoy.presentes === 0
            ? <>Sin registros hoy · última actividad <strong>{fechaCorta(asistenciaHoy.ultimaActividad)}</strong></>
            : <>{pct}% de la brigada presente</>}
        </div>
      </article>
    </div>
  );
}

function Riel({ etiqueta, valor, to }) {
  return (
    <Link to={to} className={styles.riel}>
      <span className={styles.rielEtiqueta}>{etiqueta}</span>
      <span className={styles.rielValor}>{valor}</span>
    </Link>
  );
}

function Letrero({ etiqueta, abierta, to }) {
  return (
    <Link to={to} className={styles.letrero}>
      <span className={styles.letreroEtiqueta}>{etiqueta}</span>
      <Insignia tono={abierta ? 'exito' : 'neutro'}>{abierta ? 'Abierta' : 'Cerrada'}</Insignia>
    </Link>
  );
}

function TableroCargando() {
  return (
    <div className={styles.tablero} aria-busy="true" aria-label="Cargando resumen">
      <div className={`${styles.card} ${styles.cardBrigada} ${styles.skel}`} />
      <div className={`${styles.card} ${styles.cardComandas} ${styles.skel}`} />
      <div className={`${styles.card} ${styles.cardPase} ${styles.skel}`} />
      <div className={`${styles.card} ${styles.cardServicio} ${styles.skel}`} />
    </div>
  );
}
