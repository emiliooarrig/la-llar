import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INICIO_POR_ROL } from '../lib/modulos';
import { IconoCandado } from '../components/Iconos';

/* Antes esta pantalla era un bloque con estilos en línea dentro del
   router, sin salida: te decía que no y te dejaba ahí. */
export default function SinAcceso() {
  const { usuario } = useAuth();
  const inicio = INICIO_POR_ROL[usuario?.rol];

  return (
    <div className="pagina" style={{ justifyContent: 'center' }}>
      <div className="estado-dato">
        <span className="estado-dato__icono"><IconoCandado tamano={20} /></span>
        <div>
          <p className="estado-dato__titulo">Sin acceso</p>
          <p className="estado-dato__texto">
            Tu cuenta no tiene permisos para ver esta página. Si crees que es un
            error, pídele al administrador que revise tu rol.
          </p>
        </div>
        <Link className="btn btn--neutro btn--sm" to={inicio || '/login'}>
          {inicio ? 'Volver a mi inicio' : 'Ir al acceso'}
        </Link>
      </div>
    </div>
  );
}
