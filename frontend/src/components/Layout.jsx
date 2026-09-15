import { Fragment, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL, INICIO_POR_ROL } from '../lib/modulos';
import NavRail from './NavRail';
import MenuUsuario from './MenuUsuario';
import Footer from './Footer';
import logo from '../logo.jpg';

/* Armazón de todo módulo: barra superior, rail, lienzo y pie.
   Este bloque estaba copiado en diez páginas y su CSS en siete
   módulos distintos; cualquier ajuste al header exigía siete
   ediciones sincronizadas. */
export default function Layout({
  titulo,
  subtitulo,
  migas,          // [{ etiqueta, to }] — el último elemento es la página actual
  acciones,
  children,
}) {
  const { usuario } = useAuth();
  const rol = usuario?.rol;
  const inicio = INICIO_POR_ROL[rol] || '/';

  /* Tres pestañas abiertas decían todas lo mismo. */
  useEffect(() => {
    document.title = titulo ? `${titulo} · La Llar` : 'La Llar — Sistema de Gestión';
  }, [titulo]);

  return (
    <div className="pagina">
      <a className="saltar-a-contenido" href="#contenido">Saltar al contenido</a>

      <header className="barra-sup">
        <div className="barra-sup__marca">
          <Link to={inicio} aria-label="Ir al inicio">
            <img src={logo} alt="La Llar" className="barra-sup__logo" />
          </Link>
          <span className="barra-sup__nombre">Sistema de Gestión</span>
        </div>

        <div className="barra-sup__yo">
          <span className="barra-sup__quien">
            <span className="barra-sup__quien-nombre">{usuario?.nombre}</span>
            <span className={`barra-sup__quien-rol rol-${rol}`}>{ETIQUETA_ROL[rol]}</span>
          </span>
          <MenuUsuario />
        </div>
      </header>

      <div className="cuerpo">
        <NavRail rol={rol} />

        <div className="principal">
          <main className="contenido" id="contenido">
            {migas?.length > 0 && (
              <nav className="migas" aria-label="Ruta">
                <Link to={inicio}>Inicio</Link>
                {migas.map((m, i) => (
                  <Fragment key={m.etiqueta}>
                    <span className="migas__sep" aria-hidden="true">/</span>
                    {m.to && i < migas.length - 1
                      ? <Link to={m.to}>{m.etiqueta}</Link>
                      : <span className="migas__actual" aria-current="page">{m.etiqueta}</span>}
                  </Fragment>
                ))}
              </nav>
            )}

            {titulo && (
              <div className="encabezado-pagina">
                <div>
                  <h1 className="encabezado-pagina__titulo">{titulo}</h1>
                  {subtitulo && <p className="encabezado-pagina__sub">{subtitulo}</p>}
                </div>
                {acciones && <div className="encabezado-pagina__acciones">{acciones}</div>}
              </div>
            )}

            {children}
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
