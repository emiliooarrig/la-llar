/* Set de línea único para todo el sistema. Antes cada página declaraba
   sus propios SVG inline, con grosores y tamaños que no coincidían entre
   módulos. Un solo trazo (1.8), un solo tamaño base (18), currentColor. */

function Svg({ children, tamano = 18, trazo = 1.8, ...props }) {
  return (
    <svg
      width={tamano} height={tamano} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={trazo}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" {...props}
    >
      {children}
    </svg>
  );
}

/* ── Módulos ──────────────────────────────────────────────── */
export const IconoAsistencias = p => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 16l2 2 4-4" /></Svg>;
export const IconoProveedores = p => <Svg {...p}><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></Svg>;
export const IconoUnidades = p => <Svg {...p}><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6M3 8h18" /></Svg>;
export const IconoEmpleados = p => <Svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
export const IconoUsuarios = p => <Svg {...p}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></Svg>;
export const IconoDocumentos = p => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></Svg>;
export const IconoHistorico = p => <Svg {...p}><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></Svg>;

/* ── Navegación ───────────────────────────────────────────── */
export const IconoFlecha = p => <Svg {...p}><path d="M5 12h14M12 5l7 7-7 7" /></Svg>;
export const IconoAtras = p => <Svg {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
export const IconoChevron = ({ dir = 'derecha', ...p }) => (
  <Svg {...p}>
    {dir === 'izquierda' ? <path d="M15 18l-6-6 6-6" />
      : dir === 'arriba' ? <path d="M18 15l-6-6-6 6" />
      : dir === 'abajo' ? <path d="M6 9l6 6 6-6" />
      : <path d="M9 18l6-6-6-6" />}
  </Svg>
);
export const IconoOrden = ({ dir, ...p }) => (
  <Svg trazo={2.2} {...p}>
    {dir === 'asc' ? <path d="M18 15l-6-6-6 6" />
      : dir === 'desc' ? <path d="M6 9l6 6 6-6" />
      : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
  </Svg>
);

/* ── Acciones ─────────────────────────────────────────────── */
export const IconoBuscar = p => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>;
export const IconoMas = p => <Svg trazo={2.2} {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconoLapiz = p => <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>;
export const IconoOjo = p => <Svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IconoOjoOff = p => <Svg {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M1 1l22 22" /></Svg>;
export const IconoCerrar = p => <Svg trazo={2.2} {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>;
export const IconoCheck = p => <Svg trazo={2.4} {...p}><path d="M20 6L9 17l-5-5" /></Svg>;
export const IconoDescargar = p => <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>;
export const IconoSubir = p => <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Svg>;
export const IconoBasura = p => <Svg {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></Svg>;
export const IconoArchivar = p => <Svg {...p}><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></Svg>;

/* ── Estado y contexto ────────────────────────────────────── */
export const IconoCandado = ({ abierto = false, ...p }) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    {abierto ? <path d="M7 11V7a5 5 0 0 1 9.9-1" /> : <path d="M7 11V7a5 5 0 0 1 10 0v4" />}
  </Svg>
);
export const IconoAlerta = p => <Svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></Svg>;
export const IconoInfo = p => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const IconoCalendario = p => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>;
export const IconoSucursal = p => <Svg {...p}><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" /></Svg>;
export const IconoCaja = p => <Svg {...p}><path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8M2 3h20v5H2zM10 12h4" /></Svg>;
export const IconoUsuario = p => <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>;
export const IconoSalir = p => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>;
export const IconoDensidad = p => <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>;
export const IconoInicio = p => <Svg {...p}><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></Svg>;
