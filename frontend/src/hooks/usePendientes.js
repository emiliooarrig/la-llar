import { useEffect, useState } from 'react';
import api from '../services/api';

/* El rail muestra cuántos documentos esperan revisión. Ese número se pide
   una vez y se comparte entre páginas: sin esta caché, cada navegación
   dispararía su propia petición de KPIs para pintar la misma cifra. */

let valor = null;
let cargando = false;
let pedidoEn = 0;
const suscriptores = new Set();
const VIGENCIA = 60_000;

function avisar() { suscriptores.forEach(fn => fn(valor)); }

export function invalidarPendientes() {
  pedidoEn = 0;
  cargar();
}

async function cargar() {
  if (cargando || Date.now() - pedidoEn < VIGENCIA) return;
  cargando = true;
  pedidoEn = Date.now();
  try {
    const { data } = await api.get('/dashboard/kpis');
    valor = data?.documentosPendientes?.total ?? 0;
    avisar();
  } catch {
    /* El contador es accesorio: si falla, el rail simplemente no lo pinta. */
  } finally {
    cargando = false;
  }
}

export function usePendientes(activo = true) {
  const [total, setTotal] = useState(valor);

  useEffect(() => {
    if (!activo) return;
    suscriptores.add(setTotal);
    cargar();
    return () => suscriptores.delete(setTotal);
  }, [activo]);

  return activo ? total : null;
}
