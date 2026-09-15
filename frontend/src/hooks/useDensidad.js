import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'llar:densidad';

function leer() {
  try { return localStorage.getItem(CLAVE) === 'compacta' ? 'compacta' : 'comoda'; }
  catch { return 'comoda'; }
}

/* Gerentes y administradores se pasan la jornada dentro de tablas. El modo
   compacto baja la fila de ~42px a ~32px —cerca de un 30% más de registros
   en la misma pantalla— sin tocar la tipografía: sólo reduce el aire de la
   celda (`--fila-y` / `--fila-x`). */
export function useDensidad() {
  const [densidad, setDensidad] = useState(leer);

  useEffect(() => {
    document.documentElement.dataset.densidad = densidad;
    try { localStorage.setItem(CLAVE, densidad); } catch { /* modo privado */ }
  }, [densidad]);

  const alternar = useCallback(
    () => setDensidad(d => (d === 'compacta' ? 'comoda' : 'compacta')),
    []
  );

  return { densidad, setDensidad, alternar };
}
