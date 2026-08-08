import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './MenuUsuario.module.css';

const ETIQUETA_ROL = { administrador: 'Administrador', gerente: 'Gerente', proveedor: 'Proveedor' };
const PASSWORD_MIN = 8;
const FORM_VACIO = { actual: '', nueva: '', confirmar: '' };

/* ── Iconos ────────────────────────────────────────────── */
function IconoUsuario() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconoCandado() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconoCerrar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconoOjo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconoSalir() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconoOjoOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/* Panel de cuenta del header. Agrupa las acciones sobre la sesión propia:
 * cambiar SU PROPIA contraseña (el backend resuelve el id desde el JWT, no
 * desde el formulario) y cerrar sesión. No expone datos ni acciones de otras
 * cuentas. Sustituye al botón "Salir" que antes vivía suelto en cada header. */
export default function MenuUsuario() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [abierto, setAbierto] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [ver, setVer] = useState({ actual: false, nueva: false, confirmar: false });
  const [guardando, setGuardando] = useState(false);

  const contenedorRef = useRef(null);

  // El panel se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) setAbierto(false);
    }
    function onEscape(e) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      document.removeEventListener('keydown', onEscape);
    };
  }, [abierto]);

  function abrirModal() {
    setForm(FORM_VACIO);
    setVer({ actual: false, nueva: false, confirmar: false });
    setAbierto(false);
    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) return;
    setModalAbierto(false);
    setForm(FORM_VACIO);
  }

  // Misma confirmación y destino que el antiguo botón "Salir" del header.
  async function handleLogout() {
    setAbierto(false);
    const result = await Swal.fire({
      title: '¿Cerrar sesión?', text: 'Se cerrará tu sesión actual.', icon: 'question',
      showCancelButton: true, confirmButtonColor: '#E8621A', cancelButtonColor: '#9E9892',
      confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) { logout(); navigate('/login', { replace: true }); }
  }

  function alertaError(texto) {
    Swal.fire({ icon: 'error', title: 'No se pudo cambiar', text: texto, confirmButtonColor: '#E8621A' });
  }

  async function handleGuardar(e) {
    e.preventDefault();

    const actual = form.actual;
    const nueva = form.nueva;
    const confirmar = form.confirmar;

    if (!actual || !nueva || !confirmar) {
      return alertaError('Completa los tres campos.');
    }
    if (nueva.length < PASSWORD_MIN) {
      return alertaError(`La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
    }
    if (nueva === actual) {
      return alertaError('La nueva contraseña debe ser distinta de la actual.');
    }
    if (nueva !== confirmar) {
      return alertaError('La confirmación no coincide con la nueva contraseña.');
    }

    setGuardando(true);
    try {
      await api.put('/auth/password', { passwordActual: actual, passwordNueva: nueva });
      setModalAbierto(false);
      setForm(FORM_VACIO);
      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: 'Úsala la próxima vez que inicies sesión.',
        confirmButtonColor: '#E8621A',
      });
    } catch (err) {
      alertaError(err.response?.data?.error || 'Ocurrió un error al actualizar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  const campos = [
    { clave: 'actual', etiqueta: 'Contraseña actual', autoComplete: 'current-password', hint: null },
    { clave: 'nueva', etiqueta: 'Nueva contraseña', autoComplete: 'new-password', hint: `Mínimo ${PASSWORD_MIN} caracteres y distinta de la actual.` },
    { clave: 'confirmar', etiqueta: 'Confirmar nueva contraseña', autoComplete: 'new-password', hint: 'Escríbela de nuevo para verificar.' },
  ];

  return (
    <div className={styles.contenedor} ref={contenedorRef}>
      <button
        type="button"
        className={styles.botonIcono}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Mi cuenta"
        aria-label="Mi cuenta"
      >
        <span className={styles.avatar}>{iniciales(usuario?.nombre)}</span>
      </button>

      {abierto && (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHeader}>
            <span className={styles.panelIcono}><IconoUsuario /></span>
            <div className={styles.panelInfo}>
              <span className={styles.panelNombre}>{usuario?.nombre}</span>
              <span className={styles.panelRol}>{ETIQUETA_ROL[usuario?.rol] || 'Usuario'}</span>
            </div>
          </div>
          <div className={styles.panelGrupo}>
            <button type="button" className={styles.panelItem} role="menuitem" onClick={abrirModal}>
              <IconoCandado /> Cambiar contraseña
            </button>
          </div>

          {/* Cerrar sesión va en su propio grupo: es la única acción que
              termina la sesión, así que no se mezcla con las de cuenta. */}
          <div className={`${styles.panelGrupo} ${styles.panelGrupoSalir}`}>
            <button type="button" className={`${styles.panelItem} ${styles.panelItemSalir}`} role="menuitem" onClick={handleLogout}>
              <IconoSalir /> Salir
            </button>
          </div>
        </div>
      )}

      {modalAbierto && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && cerrarModal()}>
          <form className={styles.modal} onSubmit={handleGuardar}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>Cambiar contraseña</h2>
              <button type="button" className={styles.modalCerrar} onClick={cerrarModal} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            <div className={styles.modalCuerpo}>
              {campos.map((c) => (
                <div className={styles.campo} key={c.clave}>
                  <label className={styles.etiqueta} htmlFor={`pwd-${c.clave}`}>{c.etiqueta} *</label>
                  <div className={styles.passwordWrap}>
                    <input
                      id={`pwd-${c.clave}`}
                      className={styles.input}
                      type={ver[c.clave] ? 'text' : 'password'}
                      value={form[c.clave]}
                      onChange={(e) => setForm((p) => ({ ...p, [c.clave]: e.target.value }))}
                      disabled={guardando}
                      autoComplete={c.autoComplete}
                    />
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() => setVer((p) => ({ ...p, [c.clave]: !p[c.clave] }))}
                      aria-label={ver[c.clave] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      title={ver[c.clave] ? 'Ocultar' : 'Mostrar'}
                    >
                      {ver[c.clave] ? <IconoOjoOff /> : <IconoOjo />}
                    </button>
                  </div>
                  {c.hint && <span className={styles.inputHint}>{c.hint}</span>}
                </div>
              ))}
            </div>

            <div className={styles.modalPie}>
              <button type="button" className={styles.btnCancelar} onClick={cerrarModal} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className={styles.btnGuardar} disabled={guardando}>
                {guardando ? <span className={styles.spinnerBtn} /> : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
