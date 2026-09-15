const VERSION = 'v1.0';

/* El remate superior imita la perforación de una comanda: es el borde de
   corte del ticket, el mismo lenguaje que el tablero de pase y la bandeja
   de pendientes. Sistema interno: sin redes ni enlaces externos. */
export default function Footer() {
  return (
    <footer className="pie-app">
      <div className="pie-app__interior">
        <span className="pie-app__marca">
          <strong>La Llar</strong> · Sistema de Gestión Interna
        </span>
        <span className="pie-app__meta num">
          Uso interno · {VERSION} · © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}
