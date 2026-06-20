import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../logo.jpg';
import styles from './LogoInicio.module.css';

// Cada rol regresa a su propio menú principal (Dashboard).
const HOME_POR_ROL = {
  administrador: '/admin',
  gerente: '/gerente',
  proveedor: '/proveedor',
};

/* La marca (logo) es el acceso permanente al menú principal: en cualquier
 * módulo, un clic sobre el logo lleva al Dashboard del rol del usuario.
 * Reemplaza al antiguo botón "Menú" del header. Acepta `className` para
 * que cada módulo controle el tamaño del logo (clase `.logoSmall`). */
export default function LogoInicio({ className }) {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const destino = HOME_POR_ROL[usuario?.rol] || '/';

  return (
    <button
      type="button"
      className={styles.boton}
      onClick={() => navigate(destino)}
      title="Ir al menú principal"
      aria-label="Ir al menú principal"
    >
      <img src={logo} alt="La Llar" className={className} />
    </button>
  );
}
