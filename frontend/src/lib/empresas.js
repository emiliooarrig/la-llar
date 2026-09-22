import api from '../services/api';

/* Catálogo de empresas (La Llar / Confia Alimentos) con caché en memoria.
 *
 * El selector de empresa va a aparecer en los filtros de facturas, en los de
 * vales y en cada formulario de alta de ambos. Sin caché, abrir una pantalla
 * con dos selectores serían dos peticiones idénticas, y volver atrás y entrar
 * otra vez, dos más — para un catálogo de dos filas que cambia una vez al año.
 *
 * La caché vive en memoria, no en localStorage: dura lo que la pestaña. Un
 * catálogo de empresas cacheado entre sesiones es un catálogo que se queda
 * viejo sin que nadie se entere, y aquí basta con no pedirlo cuatro veces
 * seguidas. Tras crear, renombrar o dar de baja una empresa hay que llamar a
 * `invalidarEmpresas()` para que la siguiente lectura vuelva a la red.
 */

const cache = {
  activas: null,   // Promise<Empresa[]> | null
  todas: null,     // Promise<Empresa[]> | null  (solo administrador)
};

/** Empresas del catálogo. `incluirInactivos` solo surte efecto para el admin:
 *  el backend ignora el parámetro para el resto de roles. */
export function cargarEmpresas({ incluirInactivos = false } = {}) {
  const clave = incluirInactivos ? 'todas' : 'activas';

  if (!cache[clave]) {
    // Se guarda la promesa, no el resultado: dos componentes que montan a la
    // vez comparten una sola petición en vuelo en lugar de lanzar dos.
    cache[clave] = api
      .get(incluirInactivos ? '/empresas?incluir_inactivos=1' : '/empresas')
      .then(({ data }) => (Array.isArray(data) ? data : []))
      .catch(error => {
        // Un fallo no se cachea: el siguiente intento vuelve a pedirlo.
        cache[clave] = null;
        throw error;
      });
  }

  return cache[clave];
}

/** Olvida lo cacheado. Llamar tras cualquier alta, edición o baja. */
export function invalidarEmpresas() {
  cache.activas = null;
  cache.todas = null;
}

/** Nombre de una empresa por id, para etiquetar filas de un listado mezclado.
 *  Devuelve un guion largo si no la encuentra, nunca `undefined`: la etiqueta
 *  de empresa se pinta en tablas y un hueco vacío ahí se lee como un bug. */
export function nombreEmpresa(empresas, id) {
  if (id == null) return '—';
  const empresa = empresas?.find(e => e.id === Number(id));
  return empresa ? empresa.nombre : '—';
}

/** Valor del filtro "Todas": cadena vacía, para que `useFiltrosURL` lo trate
 *  como predeterminado y no lo escriba en la barra de direcciones. */
export const TODAS_LAS_EMPRESAS = '';
