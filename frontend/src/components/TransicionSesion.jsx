import { useEffect, useRef, useState } from 'react';
import styles from './TransicionSesion.module.css';
import logo from '../logo.jpg';

/* Tiempos en ms. El cambio de pantalla ocurre detrás de la cortina
   (`alCubrir`), así que el panel ya está cargando sus datos mientras
   se ve el saludo: la espera real es menor que la duración total. */
const TIEMPOS = {
  normal: { cubrir: 240, entrada: 700, salida: 650, descubrir: 360 },
  reducido: { cubrir: 0, entrada: 450, salida: 450, descubrir: 0 },
};

const TEXTOS = {
  entrada: { etiqueta: 'Iniciando sesión', saludo: 'Hola' },
  salida: { etiqueta: 'Cerrando sesión', saludo: 'Hasta pronto' },
};

function primerNombre(nombre) {
  return nombre?.trim().split(/\s+/)[0] || '';
}

/**
 * Cortina de entrada/salida de sesión. Se cubre la pantalla, se ejecuta
 * `alCubrir` (navegar, limpiar la sesión) y se descubre la pantalla nueva.
 * Clic o Escape la adelantan una vez que el cambio ya ocurrió.
 */
export default function TransicionSesion({ tipo, nombre, alCubrir, alTerminar }) {
  const [fase, setFase] = useState('cubriendo'); // cubriendo → mostrando → descubriendo
  const timers = useRef([]);
  const t = useRef(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? TIEMPOS.reducido : TIEMPOS.normal
  ).current;

  function programar(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  function descubrir() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFase('descubriendo');
    programar(alTerminar, t.descubrir);
  }

  useEffect(() => {
    programar(() => {
      alCubrir?.();
      setFase('mostrando');
      programar(descubrir, t[tipo]);
    }, t.cubrir);
    return () => timers.current.forEach(clearTimeout);
    // Una sola ejecución por transición: el padre la remonta con `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fase !== 'mostrando') return;
    function escape(e) { if (e.key === 'Escape') descubrir(); }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const { etiqueta, saludo } = TEXTOS[tipo];
  const nombreCorto = primerNombre(nombre);

  return (
    <div
      className={`${styles.cortina} ${styles[fase]} ${styles[tipo]}`}
      onClick={fase === 'mostrando' ? descubrir : undefined}
      role="status"
      aria-live="polite"
    >
      <div className={styles.contenido}>
        <div className={styles.hornilla}>
          <svg className={styles.aro} viewBox="0 0 120 120" aria-hidden="true">
            <circle className={styles.aroFondo} cx="60" cy="60" r="54" />
            <circle className={styles.aroFuego} cx="60" cy="60" r="54" pathLength="100" />
          </svg>
          <img src={logo} alt="" className={styles.logo} />
        </div>

        <p className={styles.etiqueta}>{etiqueta}</p>
        <p className={styles.saludo}>
          {saludo}{nombreCorto && <>, <span className={styles.nombre}>{nombreCorto}</span></>}
        </p>
        <span className={styles.corte} aria-hidden="true" />
      </div>
    </div>
  );
}
