import api from '../services/api';
import { avisoError } from './alertas';

/* Bajar un archivo era diez copias del mismo bloque de `createObjectURL`,
   `appendChild`, `click`, `remove`, `revokeObjectURL` repartidas por las
   páginas; en tres de ellas faltaba el `revokeObjectURL`. */
export async function descargarArchivo(ruta, nombre) {
  try {
    const res = await api.get(ruta, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.setAttribute('download', nombre || 'documento');
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.URL.revokeObjectURL(url);
    return true;
  } catch {
    await avisoError('No se pudo descargar el archivo. Revisa tu conexión e inténtalo de nuevo.');
    return false;
  }
}
