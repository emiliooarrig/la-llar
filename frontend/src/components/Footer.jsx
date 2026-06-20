import styles from './Footer.module.css';
import logo from '../logo.jpg';

const VERSION = 'v1.0';

/* Pie compartido para todos los módulos (no en el Login).
   Sistema interno: sin redes sociales ni enlaces externos. */
export default function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.interior}>
        <div className={styles.marca}>
          <img src={logo} alt="La Llar" className={styles.logoImg} />
          <span className={styles.marcaTexto}>
            <span className={styles.marcaNombre}>Sistema de Gestión Interna</span>
            <span className={styles.marcaTag}>Soluciones de cocina</span>
          </span>
        </div>

        <div className={styles.meta}>
          <span className={styles.copyright}>
            © {anio} La Llar
            <span className={styles.separador}>·</span>
            <span className={styles.version}>{VERSION}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
