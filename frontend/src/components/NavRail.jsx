import { NavLink } from 'react-router-dom';
import { modulosDe } from '../lib/modulos';
import { usePendientes } from '../hooks/usePendientes';

/* Rail de módulos: antes el único camino entre módulos era volver al
   panel. Con un rol de un solo módulo no se pinta — una barra de
   navegación con un elemento es decoración, no navegación. */
export default function NavRail({ rol }) {
  const modulos = modulosDe(rol);
  const pendientes = usePendientes(rol === 'administrador');

  if (modulos.length < 2) return null;

  return (
    <nav className="rail" aria-label="Módulos">
      <p className="rail__titulo">Módulos</p>
      <div className="rail__lista">
        {modulos.map(({ titulo, to, Icono, contador }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `rail__item${isActive ? ' rail__item--activo' : ''}`}
          >
            <Icono />
            <span>{titulo}</span>
            {contador === 'pendientes' && pendientes > 0 && (
              <span className="rail__conteo" title={`${pendientes} por revisar`}>{pendientes}</span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
