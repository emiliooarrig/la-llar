import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
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

function RedirigirSegunRol() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol === 'administrador') return <Navigate to="/admin" replace />;
  if (usuario.rol === 'gerente') return <Navigate to="/gerente" replace />;
  if (usuario.rol === 'proveedor') return <Navigate to="/proveedor/documentos" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/admin/asistencias"
            element={
              <RutaProtegida roles={['administrador']}>
                <Asistencias />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/empleados"
            element={
              <RutaProtegida roles={['administrador']}>
                <Empleados />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/usuarios"
            element={
              <RutaProtegida roles={['administrador']}>
                <Usuarios />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/pendientes"
            element={
              <RutaProtegida roles={['administrador']}>
                <Pendientes />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/historicos"
            element={
              <RutaProtegida roles={['administrador']}>
                <Historicos />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/proveedores/:id"
            element={
              <RutaProtegida roles={['administrador']}>
                <ProveedorDetalle />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/proveedores"
            element={
              <RutaProtegida roles={['administrador']}>
                <AdminProveedores />
              </RutaProtegida>
            }
          />

          <Route
            path="/proveedor/documentos"
            element={
              <RutaProtegida roles={['proveedor']}>
                <MisDocumentos />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/unidades/:id"
            element={
              <RutaProtegida roles={['administrador']}>
                <UnidadDetalle />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/unidades"
            element={
              <RutaProtegida roles={['administrador']}>
                <AdminUnidades />
              </RutaProtegida>
            }
          />

          <Route
            path="/gerente/unidades"
            element={
              <RutaProtegida roles={['gerente']}>
                <MisUnidades />
              </RutaProtegida>
            }
          />

          <Route
            path="/gerente/asistencias"
            element={
              <RutaProtegida roles={['gerente']}>
                <Asistencias />
              </RutaProtegida>
            }
          />

          <Route
            path="/admin/*"
            element={
              <RutaProtegida roles={['administrador']}>
                <Dashboard />
              </RutaProtegida>
            }
          />

          <Route
            path="/gerente/*"
            element={
              <RutaProtegida roles={['gerente']}>
                <Dashboard />
              </RutaProtegida>
            }
          />

          <Route
            path="/proveedor/*"
            element={
              <RutaProtegida roles={['proveedor']}>
                <Dashboard />
              </RutaProtegida>
            }
          />

          <Route
            path="/sin-acceso"
            element={
              <div style={{ textAlign: 'center', padding: '80px 24px' }}>
                <h2>Sin acceso</h2>
                <p style={{ marginTop: '8px', color: '#6B6560' }}>
                  No tienes permisos para ver esta página.
                </p>
              </div>
            }
          />

          <Route path="/" element={<RedirigirSegunRol />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
