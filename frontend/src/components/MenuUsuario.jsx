import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDensidad } from '../hooks/useDensidad';
import { iniciales } from '../lib/formato';
import { confirmar, toast } from '../lib/alertas';
import api from '../services/api';
import Modal from './Modal';
import { IconoCandado, IconoSalir, IconoOjo, IconoOjoOff, IconoAlerta } from './Iconos';

const PASSWORD_MIN = 8;
const FORM_VACIO = { actual: '', nueva: '', confirmar: '' };

const CAMPOS = [
  { clave: 'actual', etiqueta: 'Contraseña actual', autoComplete: 'current-password' },
  { clave: 'nueva', etiqueta: 'Nueva contraseña', autoComplete: 'new-password', pista: `Mínimo ${PASSWORD_MIN} caracteres y distinta de la actual.` },
  { clave: 'confirmar', etiqueta: 'Confirmar nueva contraseña', autoComplete: 'new-password' },
];

/* Valida en el momento y devuelve el error por campo. Antes cada regla
   abría un diálogo modal que había que cerrar para volver al formulario. */
function validar({ actual, nueva, confirmar: conf }) {
  const errores = {};
  if (!actual) errores.actual = 'Escribe tu contraseña actual.';
  if (!nueva) errores.nueva = 'Escribe la nueva contraseña.';
  else if (nueva.length < PASSWORD_MIN) errores.nueva = `Debe tener al menos ${PASSWORD_MIN} caracteres.`;
  else if (nueva === actual) errores.nueva = 'Debe ser distinta de la actual.';
  if (!conf) errores.confirmar = 'Repite la nueva contraseña.';
  else if (nueva && conf !== nueva) errores.confirmar = 'No coincide con la nueva contraseña.';
  return errores;
}

export default function MenuUsuario() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { densidad, setDensidad } = useDensidad();

  const [abierto, setAbierto] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [ver, setVer] = useState({});
  const [guardando, setGuardando] = useState(false);
  const cajaRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) { if (!cajaRef.current?.contains(e.target)) setAbierto(false); }
    function escape(e) { if (e.key === 'Escape') setAbierto(false); }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  function abrirModal() {
    setForm(FORM_VACIO);
    setErrores({});
    setVer({});
    setAbierto(false);
    setModal(true);
  }

  async function salir() {
    setAbierto(false);
    if (await confirmar({ titulo: '¿Cerrar sesión?', texto: 'Se cerrará tu sesión en este navegador.', confirmar: 'Cerrar sesión' })) {
      logout();
      navigate('/login', { replace: true });
    }
  }

  async function guardar(e) {
    e.preventDefault();
    const fallos = validar(form);
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setGuardando(true);
    try {
      await api.put('/auth/password', { passwordActual: form.actual, passwordNueva: form.nueva });
      setModal(false);
      setForm(FORM_VACIO);
      toast('Contraseña actualizada');
    } catch (err) {
      const mensaje = err.response?.data?.error || 'No se pudo actualizar la contraseña.';
      /* El backend sólo puede rechazar por la contraseña actual, así que el
         error se ancla a ese campo en vez de flotar en un diálogo. */
      setErrores({ actual: mensaje });
    } finally {
      setGuardando(false);
    }
  }

  function cambiar(clave, valor) {
    setForm(p => ({ ...p, [clave]: valor }));
    if (errores[clave]) setErrores(p => ({ ...p, [clave]: undefined }));
  }

  return (
    <div className="yo" ref={cajaRef}>
      <button
        type="button"
        className={`yo__boton yo__boton--${usuario?.rol}`}
        onClick={() => setAbierto(v => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Mi cuenta"
      >
        {iniciales(usuario?.nombre)}
      </button>

      {abierto && (
        <div className="yo__panel" role="menu">
          <div className="yo__cabecera">
            <span className="yo__cabecera-nombre">{usuario?.nombre}</span>
            <span className="yo__cabecera-correo">{usuario?.email}</span>
          </div>

          <div className="yo__densidad">
            <span className="yo__densidad-label" id="densidad-label">Densidad</span>
            <div className="yo__segmento" role="group" aria-labelledby="densidad-label">
              <button
                type="button" className="yo__segmento-btn"
                aria-pressed={densidad === 'comoda'} onClick={() => setDensidad('comoda')}
              >
                Cómoda
              </button>
              <button
                type="button" className="yo__segmento-btn"
                aria-pressed={densidad === 'compacta'} onClick={() => setDensidad('compacta')}
              >
                Compacta
              </button>
            </div>
          </div>

          <div className="yo__grupo">
            <button type="button" className="yo__item" role="menuitem" onClick={abrirModal}>
              <IconoCandado /> Cambiar contraseña
            </button>
          </div>

          <div className="yo__grupo">
            <button type="button" className="yo__item yo__item--salir" role="menuitem" onClick={salir}>
              <IconoSalir /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {modal && (
        <Modal
          titulo="Cambiar contraseña"
          onCerrar={() => setModal(false)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(false)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" form="form-password" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />} Actualizar
              </button>
            </>
          }
        >
          <form id="form-password" onSubmit={guardar} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
              {CAMPOS.map((c, i) => (
                <div className="campo" key={c.clave}>
                  <label className="etiqueta" htmlFor={`pwd-${c.clave}`}>{c.etiqueta}</label>
                  <div className="campo-con-boton">
                    <input
                      id={`pwd-${c.clave}`}
                      className={`control${errores[c.clave] ? ' control--invalido' : ''}`}
                      type={ver[c.clave] ? 'text' : 'password'}
                      value={form[c.clave]}
                      onChange={e => cambiar(c.clave, e.target.value)}
                      disabled={guardando}
                      autoComplete={c.autoComplete}
                      aria-invalid={Boolean(errores[c.clave])}
                      aria-describedby={errores[c.clave] ? `err-${c.clave}` : undefined}
                      data-foco-inicial={i === 0 ? '' : undefined}
                    />
                    <button
                      type="button" className="campo-con-boton__btn"
                      onClick={() => setVer(p => ({ ...p, [c.clave]: !p[c.clave] }))}
                      aria-label={ver[c.clave] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {ver[c.clave] ? <IconoOjoOff /> : <IconoOjo />}
                    </button>
                  </div>
                  {errores[c.clave]
                    ? <span className="error-campo" id={`err-${c.clave}`}><IconoAlerta tamano={13} />{errores[c.clave]}</span>
                    : c.pista && <span className="pista">{c.pista}</span>}
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
