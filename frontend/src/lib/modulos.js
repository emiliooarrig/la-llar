import {
  IconoAsistencias, IconoProveedores, IconoUnidades, IconoEmpleados,
  IconoUsuarios, IconoDocumentos, IconoHistorico,
} from '../components/Iconos';

export const ETIQUETA_ROL = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  proveedor: 'Proveedor',
};

/** Portada de cada rol: a dónde manda el login y a dónde vuelve el logo. */
export const INICIO_POR_ROL = {
  administrador: '/admin',
  gerente: '/gerente/asistencias',
  proveedor: '/proveedor/documentos',
};

/* Fuente única de la navegación: alimenta el rail lateral y las tarjetas
   del panel. Antes esta lista sólo existía dentro de Dashboard.jsx. */
export const MODULOS = {
  administrador: [
    { titulo: 'Asistencias', desc: 'Entradas y salidas por unidad.', to: '/admin/asistencias', Icono: IconoAsistencias },
    { titulo: 'Por revisar', desc: 'Documentos esperando aprobación.', to: '/admin/pendientes', Icono: IconoDocumentos, contador: 'pendientes' },
    { titulo: 'Proveedores', desc: 'Catálogo y documentos de proveedores.', to: '/admin/proveedores', Icono: IconoProveedores },
    { titulo: 'Unidades', desc: 'Cocinas, sucursales y su papeleo.', to: '/admin/unidades', Icono: IconoUnidades },
    { titulo: 'Empleados', desc: 'Alta, edición y baja de la plantilla.', to: '/admin/empleados', Icono: IconoEmpleados },
    { titulo: 'Usuarios', desc: 'Accesos al sistema: roles y credenciales.', to: '/admin/usuarios', Icono: IconoUsuarios },
    { titulo: 'Histórico', desc: 'Archivo permanente de documentos.', to: '/admin/historicos', Icono: IconoHistorico },
  ],
  gerente: [
    { titulo: 'Asistencias', desc: 'Entradas y salidas de tu unidad.', to: '/gerente/asistencias', Icono: IconoAsistencias },
    { titulo: 'Unidades', desc: 'Documentos de tu cocina.', to: '/gerente/unidades', Icono: IconoUnidades },
  ],
  proveedor: [
    { titulo: 'Mis documentos', desc: 'Sube y consulta tu documentación.', to: '/proveedor/documentos', Icono: IconoDocumentos },
  ],
};

export function modulosDe(rol) {
  return MODULOS[rol] || [];
}
