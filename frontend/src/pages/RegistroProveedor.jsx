import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import Campo from '../components/Campo';
import { IconoOjo, IconoOjoOff, IconoAlerta, IconoCheck } from '../components/Iconos';
import shell from './Login.module.css';
import styles from './RegistroProveedor.module.css';
import logo from '../logo.jpg';

/* Alta propia del proveedor a partir del link que le pasa el administrador
   (spec 001 HU-1). Es, junto al login, la única pantalla pública: aquí no hay
   sesión todavía, así que no lleva Layout ni rail.

   Se valida el token ANTES de pintar el formulario. Hacer teclear RFC,
   correo y contraseña para decir al enviar "este link caducó" es la forma
   más segura de que el proveedor no lo intente una segunda vez. */

const RE_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

const FORM_VACIO = { nombre: '', rfc: '', email: '', password: '', confirmar: '' };

function validar(form) {
  const e = {};
  if (!form.nombre.trim()) e.nombre = 'Escribe tu nombre o razón social.';

  const rfc = form.rfc.trim().toUpperCase();
  if (!rfc) e.rfc = 'El RFC es obligatorio.';
  else if (!RE_RFC.test(rfc)) e.rfc = 'Revisa el RFC: son 12 caracteres (moral) o 13 (física).';

  if (!form.email.trim()) e.email = 'El correo es obligatorio.';
  else if (!RE_EMAIL.test(form.email.trim())) e.email = 'El correo no tiene un formato válido.';

  if (form.password.length < PASSWORD_MIN) e.password = `Mínimo ${PASSWORD_MIN} caracteres.`;
  if (form.confirmar !== form.password) e.confirmar = 'Las dos contraseñas no coinciden.';

  return e;
}

export default function RegistroProveedor() {
  const { token } = useParams();

  // 'validando' | 'formulario' | 'listo' | 'invalido'
  const [fase, setFase] = useState('validando');
  const [motivo, setMotivo] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [fallo, setFallo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    let vivo = true;

    api.get(`/registro/${token}`)
      .then(({ data }) => {
        if (!vivo) return;
        // El administrador pudo dejar anotado el correo al invitar: se
        // precarga, pero el proveedor puede cambiarlo.
        if (data.email) setForm(p => ({ ...p, email: data.email }));
        setFase('formulario');
      })
      .catch(err => {
        if (!vivo) return;
        setMotivo(err.response?.data?.error || 'Este link de registro no es válido.');
        setFase('invalido');
      });

    return () => { vivo = false; };
  }, [token]);

  function cambiar(clave, valor) {
    setForm(p => ({ ...p, [clave]: valor }));
    if (errores[clave]) setErrores(p => ({ ...p, [clave]: undefined }));
    if (fallo) setFallo(null);
  }

  async function enviar(e) {
    e.preventDefault();
    const fallos = validar(form);
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setEnviando(true);
    setFallo(null);
    try {
      await api.post(`/registro/${token}`, {
        nombre: form.nombre.trim(),
        rfc: form.rfc.trim().toUpperCase(),
        email: form.email.trim(),
        password: form.password,
      });
      setFase('listo');
    } catch (err) {
      const estado = err.response?.status;
      const mensaje = err.response?.data?.error || 'No se pudo completar el registro. Inténtalo de nuevo.';

      /* Un link caducado o ya usado no se arregla reintentando: la página
         cambia de estado en vez de dejar un formulario que nunca enviará. */
      if (estado === 410 || estado === 404) {
        setMotivo(mensaje);
        setFase('invalido');
        return;
      }
      // El conflicto se ancla al campo que lo causa, no a un aviso suelto.
      if (estado === 409 && /RFC/i.test(mensaje)) setErrores({ rfc: mensaje });
      else if (estado === 409) setErrores({ email: mensaje });
      else setFallo(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={shell.pagina}>
      <div className={shell.panel}>
        <div className={shell.encabezado}>
          <img src={logo} alt="La Llar" className={shell.logoImg} />
          <p className={shell.subtitulo}>
            {fase === 'listo' ? 'Registro completado' : 'Alta de proveedor'}
          </p>
        </div>

        {fase === 'validando' && (
          <p className={styles.cargando}><span className="spinner" /> Comprobando el link…</p>
        )}

        {fase === 'invalido' && (
          <div className={styles.desenlace}>
            <span className={`${styles.desenlaceIcono} ${styles.desenlaceError}`}><IconoAlerta /></span>
            <p className={styles.desenlaceTitulo}>No se puede usar este link</p>
            <p className={styles.desenlaceTexto}>{motivo}</p>
            <Link to="/login" className="btn btn--neutro">Ir al inicio de sesión</Link>
          </div>
        )}

        {fase === 'listo' && (
          <div className={styles.desenlace}>
            <span className={`${styles.desenlaceIcono} ${styles.desenlaceExito}`}><IconoCheck /></span>
            <p className={styles.desenlaceTitulo}>Tu cuenta quedó creada</p>
            <p className={styles.desenlaceTexto}>
              Entra con <strong>{form.email.trim()}</strong> y la contraseña que acabas de elegir.
              Desde ahí podrás subir tus facturas.
            </p>
            <Link to="/login" className="btn btn--primario">Iniciar sesión</Link>
          </div>
        )}

        {fase === 'formulario' && (
          <form className={shell.formulario} onSubmit={enviar} noValidate>
            {fallo && (
              <div className="aviso aviso--error" role="alert">
                <IconoAlerta /><span>{fallo}</span>
              </div>
            )}

            <div className={styles.rejilla}>
              <div className={styles.anchoCompleto}>
                <Campo
                  etiqueta="Nombre o razón social" error={errores.nombre} id="r-nombre"
                  pista="Tal como aparece en tus facturas."
                >
                  <input
                    id="r-nombre" className={`control${errores.nombre ? ' control--invalido' : ''}`}
                    type="text" placeholder="Ej. Distribuidora del Valle SA de CV"
                    value={form.nombre} onChange={e => cambiar('nombre', e.target.value)}
                    disabled={enviando} autoComplete="organization"
                  />
                </Campo>
              </div>

              <Campo etiqueta="RFC" error={errores.rfc} id="r-rfc">
                <input
                  id="r-rfc" className={`control${errores.rfc ? ' control--invalido' : ''}`}
                  type="text" placeholder="XAXX010101000" maxLength={13}
                  value={form.rfc}
                  onChange={e => cambiar('rfc', e.target.value.toUpperCase())}
                  disabled={enviando} autoComplete="off" spellCheck={false}
                />
              </Campo>

              <Campo etiqueta="Correo electrónico" error={errores.email} id="r-email">
                <input
                  id="r-email" className={`control${errores.email ? ' control--invalido' : ''}`}
                  type="email" placeholder="contacto@empresa.com"
                  value={form.email} onChange={e => cambiar('email', e.target.value)}
                  disabled={enviando} autoComplete="email"
                />
              </Campo>

              <div className={styles.anchoCompleto}>
                <Campo
                  etiqueta="Contraseña" error={errores.password} id="r-password"
                  pista={`Mínimo ${PASSWORD_MIN} caracteres. Será tu acceso al portal.`}
                >
                  <div className="campo-con-boton">
                    <input
                      id="r-password" className={`control${errores.password ? ' control--invalido' : ''}`}
                      type={verPassword ? 'text' : 'password'} placeholder="••••••••••••"
                      value={form.password} onChange={e => cambiar('password', e.target.value)}
                      disabled={enviando} autoComplete="new-password"
                    />
                    <button
                      type="button" className="campo-con-boton__btn"
                      onClick={() => setVerPassword(v => !v)}
                      aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verPassword ? <IconoOjoOff /> : <IconoOjo />}
                    </button>
                  </div>
                </Campo>
              </div>

              <div className={styles.anchoCompleto}>
                <Campo etiqueta="Repite la contraseña" error={errores.confirmar} id="r-confirmar">
                  <input
                    id="r-confirmar" className={`control${errores.confirmar ? ' control--invalido' : ''}`}
                    type={verPassword ? 'text' : 'password'} placeholder="••••••••••••"
                    value={form.confirmar} onChange={e => cambiar('confirmar', e.target.value)}
                    disabled={enviando} autoComplete="new-password"
                  />
                </Campo>
              </div>
            </div>

            <button type="submit" className={`btn btn--primario ${shell.botonEntrar}`} disabled={enviando}>
              {enviando ? <><span className="spinner" /> Creando tu cuenta…</> : 'Crear mi cuenta'}
            </button>
          </form>
        )}

        <p className={shell.nota}>¿Dudas con el alta? Contacta al administrador que te envió el link.</p>
      </div>
    </div>
  );
}
