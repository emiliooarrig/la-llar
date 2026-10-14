import { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../services/api';
import TransicionSesion from '../components/TransicionSesion';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const stored = localStorage.getItem('usuario');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }, []);

  /* Animación de entrada/salida de sesión. `alCubrir` corre cuando la
     cortina ya tapa la pantalla: ahí se navega o se limpia la sesión. */
  const [transicion, setTransicion] = useState(null);
  const contador = useRef(0);
  const transicionar = useCallback((tipo, nombre, alCubrir) => {
    contador.current += 1;
    setTransicion({ id: contador.current, tipo, nombre, alCubrir });
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, transicionar }}>
      {children}
      {transicion && (
        <TransicionSesion
          key={transicion.id}
          tipo={transicion.tipo}
          nombre={transicion.nombre}
          alCubrir={transicion.alCubrir}
          alTerminar={() => setTransicion(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
