import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INICIO_POR_ROL } from '../lib/modulos';
import { IconoOjo, IconoOjoOff, IconoAlerta } from '../components/Iconos';
import styles from './Login.module.css';
import logo from '../logo.jpg';

// Debe coincidir con LOGIN_MAX_INTENTOS del backend (middleware/rateLimit.js).
const INTENTOS_MAX = 5;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [fallo, setFallo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  function cambiar(clave, valor) {
    setForm(p => ({ ...p, [clave]: valor }));
    if (errores[clave]) setErrores(p => ({ ...p, [clave]: undefined }));
    if (fallo) setFallo(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    /* La validación vive junto al campo. Un modal que hay que cerrar para
       volver a escribir el correo estorba más de lo que ayuda. */
    const fallos = {};
    if (!form.email.trim()) fallos.email = 'Escribe tu correo.';
    if (!form.password) fallos.password = 'Escribe tu contraseña.';
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setCargando(true);
    setFallo(null);
    try {
      const usuario = await login(form.email, form.password);
      /* Sin diálogo de bienvenida: el panel que aparece ya es la confirmación,
         y el aviso anterior retrasaba 1.4 s cada entrada del día. */
      navigate(INICIO_POR_ROL[usuario.rol] || '/', { replace: true });
    } catch (error) {
      const datos = error.response?.data;
      const mensaje = datos?.error || 'No se pudo iniciar sesión. Intenta de nuevo.';

      if (error.response?.status === 429) {
        setFallo({ mensaje, detalle: null });
        return;
      }

      // A partir del segundo fallo avisamos cuántos intentos quedan.
      const restantes = datos?.intentosRestantes;
      const avisar = typeof restantes === 'number' && restantes < INTENTOS_MAX - 1;
      setFallo({
        mensaje,
        detalle: avisar
          ? restantes > 0
            ? `Te queda${restantes === 1 ? '' : 'n'} ${restantes} intento${restantes === 1 ? '' : 's'} antes de que el acceso se bloquee 15 minutos.`
            : 'Este fue tu último intento: el acceso queda bloqueado 15 minutos.'
          : null,
      });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.panel}>
        <div className={styles.encabezado}>
          <img src={logo} alt="La Llar" className={styles.logoImg} />
          <p className={styles.subtitulo}>Sistema de Gestión Interna</p>
        </div>

        <form className={styles.formulario} onSubmit={handleSubmit} noValidate>
          {fallo && (
            <div className="aviso aviso--error" role="alert">
              <IconoAlerta />
              <span>
                {fallo.mensaje}
                {fallo.detalle && <><br /><span className="pista">{fallo.detalle}</span></>}
              </span>
            </div>
          )}

          <div className="campo">
            <label className="etiqueta" htmlFor="email">Correo electrónico</label>
            <input
              id="email" name="email" type="email"
              className={`control${errores.email ? ' control--invalido' : ''}`}
              placeholder="usuario@empresa.com"
              value={form.email}
              onChange={e => cambiar('email', e.target.value)}
              autoComplete="email"
              disabled={cargando}
              aria-invalid={Boolean(errores.email)}
              aria-describedby={errores.email ? 'err-email' : undefined}
            />
            {errores.email && (
              <span className="error-campo" id="err-email"><IconoAlerta tamano={13} />{errores.email}</span>
            )}
          </div>

          <div className="campo">
            <label className="etiqueta" htmlFor="password">Contraseña</label>
            <div className="campo-con-boton">
              <input
                id="password" name="password"
                type={verPassword ? 'text' : 'password'}
                className={`control${errores.password ? ' control--invalido' : ''}`}
                placeholder="••••••••••••"
                value={form.password}
                onChange={e => cambiar('password', e.target.value)}
                autoComplete="current-password"
                disabled={cargando}
                aria-invalid={Boolean(errores.password)}
                aria-describedby={errores.password ? 'err-password' : undefined}
              />
              <button
                type="button" className="campo-con-boton__btn"
                onClick={() => setVerPassword(v => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verPassword ? <IconoOjoOff /> : <IconoOjo />}
              </button>
            </div>
            {errores.password && (
              <span className="error-campo" id="err-password"><IconoAlerta tamano={13} />{errores.password}</span>
            )}
          </div>

          <button type="submit" className={`btn btn--primario ${styles.botonEntrar}`} disabled={cargando}>
            {cargando ? <><span className="spinner" /> Entrando…</> : 'Iniciar sesión'}
          </button>
        </form>

        <p className={styles.nota}>¿Problemas para acceder? Contacta al administrador del sistema.</p>
      </div>
    </div>
  );
}
