import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import { INICIO_POR_ROL } from './lib/modulos';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Empleados from './pages/Empleados';
import Usuarios from './pages/Usuarios';
import Pendientes from './pages/Pendientes';
import Asistencias from './pages/Asistencias';
import AdminProveedores from './pages/AdminProveedores';
import ProveedorDetalle from './pages/ProveedorDetalle';
import MisDocumentos from './pages/MisDocumentos';
import AdminUnidades from './pages/AdminUnidades';
import UnidadDetalle from './pages/UnidadDetalle';
import MisUnidades from './pages/MisUnidades';
import Historicos from './pages/Historicos';
import SinAcceso from './pages/SinAcceso';

/** Cada rol aterriza en lo primero que necesita ver al abrir el sistema. */
function RedirigirSegunRol() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={INICIO_POR_ROL[usuario.rol] || '/login'} replace />;
}

/** Envuelve un elemento en la comprobación de rol. */
function Protegida({ roles, children }) {
  return <RutaProtegida roles={roles}>{children}</RutaProtegida>;
}

const soloAdmin = children => <Protegida roles={['administrador']}>{children}</Protegida>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ── Administrador ── */}
          <Route path="/admin" element={soloAdmin(<Dashboard />)} />
          <Route path="/admin/asistencias" element={soloAdmin(<Asistencias />)} />
          <Route path="/admin/empleados" element={soloAdmin(<Empleados />)} />
          <Route path="/admin/usuarios" element={soloAdmin(<Usuarios />)} />
          <Route path="/admin/pendientes" element={soloAdmin(<Pendientes />)} />
          <Route path="/admin/historicos" element={soloAdmin(<Historicos />)} />
          <Route path="/admin/proveedores" element={soloAdmin(<AdminProveedores />)} />
          <Route path="/admin/proveedores/:id" element={soloAdmin(<ProveedorDetalle />)} />
          <Route path="/admin/unidades" element={soloAdmin(<AdminUnidades />)} />
          <Route path="/admin/unidades/:id" element={soloAdmin(<UnidadDetalle />)} />
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

          {/* ── Gerente ── */}
          <Route
            path="/gerente/asistencias"
            element={<Protegida roles={['gerente']}><Asistencias /></Protegida>}
          />
          <Route
            path="/gerente/unidades"
            element={<Protegida roles={['gerente']}><MisUnidades /></Protegida>}
          />
          <Route path="/gerente/*" element={<Navigate to="/gerente/asistencias" replace />} />

          {/* ── Proveedor ── */}
          <Route
            path="/proveedor/documentos"
            element={<Protegida roles={['proveedor']}><MisDocumentos /></Protegida>}
          />
          <Route path="/proveedor/*" element={<Navigate to="/proveedor/documentos" replace />} />

          <Route path="/sin-acceso" element={<SinAcceso />} />
          <Route path="/" element={<RedirigirSegunRol />} />
          <Route path="*" element={<RedirigirSegunRol />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
