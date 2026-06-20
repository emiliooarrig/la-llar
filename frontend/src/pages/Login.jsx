import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';
import logo from '../logo.jpg';

const RUTA_POR_ROL = {
  administrador: '/admin',
  gerente: '/gerente',
  proveedor: '/proveedor/documentos',
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor ingresa tu correo y contraseña.',
        confirmButtonColor: '#E8621A',
      });
      return;
    }

    setCargando(true);
    try {
      const usuario = await login(form.email, form.password);
      const ruta = RUTA_POR_ROL[usuario.rol] || '/';

      await Swal.fire({
        icon: 'success',
        title: `¡Bienvenido, ${usuario.nombre}!`,
        text: 'Iniciando sesión...',
        timer: 1400,
        timerProgressBar: true,
        showConfirmButton: false,
        confirmButtonColor: '#E8621A',
      });

      navigate(ruta, { replace: true });
    } catch (error) {
      const mensaje =
        error.response?.data?.error || 'No se pudo iniciar sesión. Intenta de nuevo.';
      Swal.fire({
        icon: 'error',
        title: 'Acceso denegado',
        text: mensaje,
        confirmButtonColor: '#E8621A',
      });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.panel}>
        <div className={styles.encabezado}>
          <div className={styles.logo}>
            <img src={logo} alt="La Llar" className={styles.logoImg} />
          </div>
          <p className={styles.subtitulo}>Sistema de Gestión Interna</p>
        </div>

        <form className={styles.formulario} onSubmit={handleSubmit} noValidate>
          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.input}
              placeholder="usuario@empresa.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={cargando}
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="password">
              Contraseña
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="password"
                name="password"
                type={mostrarPassword ? 'text' : 'password'}
                className={styles.input}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={cargando}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.boton}
            disabled={cargando}
          >
            {cargando ? (
              <span className={styles.spinner} />
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <p className={styles.nota}>
          ¿Problemas para acceder? Contacta al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
