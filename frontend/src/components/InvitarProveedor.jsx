import { useState } from 'react';
import api from '../services/api';
import Modal from './Modal';
import Campo from './Campo';
import { IconoMas, IconoCheck, IconoAlerta } from './Iconos';
import { toast } from '../lib/alertas';

/* Invitación de alta para un proveedor (spec 001 HU-1).
 *
 * El administrador genera un link y se lo hace llegar por el canal que
 * quiera; el proveedor rellena sus datos y elige su propia contraseña. Esto
 * sustituye al alta manual, en la que el administrador tecleaba el RFC de
 * otro e inventaba una contraseña que después viajaba por WhatsApp.
 *
 * El link se enseña UNA vez. No se guarda en claro en ninguna parte —la
 * base solo tiene su hash—, así que si se pierde se genera otro. La
 * pantalla lo dice explícitamente para que nadie cierre el diálogo dando
 * por hecho que podrá volver a consultarlo.
 */
export default function InvitarProveedor() {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState('');
  const [dias, setDias] = useState('3');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  function abrir() {
    setEmail(''); setDias('3'); setError(null); setResultado(null); setCopiado(false);
    setAbierto(true);
  }

  async function generar(e) {
    e.preventDefault();
    const horas = Number(dias) * 24;
    if (!Number.isInteger(horas) || horas < 1 || horas > 720) {
      setError('La vigencia debe estar entre 1 y 30 días.');
      return;
    }

    setGenerando(true);
    setError(null);
    try {
      const { data } = await api.post('/proveedores/invitaciones', {
        ...(email.trim() ? { email: email.trim() } : {}),
        vigencia_horas: horas,
      });
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar la invitación.');
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resultado.url);
      setCopiado(true);
      toast('Link copiado');
    } catch {
      // Sin permiso de portapapeles, el link sigue seleccionable a mano.
      setCopiado(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--neutro" onClick={abrir}>
        <IconoMas /> Invitar por link
      </button>

      {abierto && (
        <Modal
          titulo={resultado ? 'Link de registro listo' : 'Invitar a un proveedor'}
          subtitulo={resultado
            ? 'Cópialo ahora: por seguridad no se vuelve a mostrar.'
            : 'El proveedor se dará de alta él mismo y elegirá su contraseña.'}
          onCerrar={() => setAbierto(false)}
          bloqueado={generando}
          pie={resultado ? (
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setAbierto(false)}>Cerrar</button>
              <button type="button" className="btn btn--primario" onClick={copiar}>
                {copiado ? <><IconoCheck /> Copiado</> : 'Copiar link'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setAbierto(false)} disabled={generando}>
                Cancelar
              </button>
              <button type="submit" form="form-invitacion" className="btn btn--primario" disabled={generando}>
                {generando && <span className="spinner" />}Generar link
              </button>
            </>
          )}
        >
          {resultado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e3)' }}>
              <input
                className="control mono" readOnly value={resultado.url}
                onFocus={e => e.target.select()} aria-label="Link de registro"
                data-foco-inicial
              />
              <p className="pista">
                Caduca el {new Date(resultado.expira_en).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
                {' '}y solo sirve una vez.
              </p>
              <div className="aviso aviso--atencion">
                <IconoAlerta />
                <span>
                  Cualquiera con este link puede crear una cuenta de proveedor.
                  Mándalo solo a quien lo espera.
                </span>
              </div>
            </div>
          ) : (
            <form id="form-invitacion" onSubmit={generar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
              {error && (
                <div className="aviso aviso--error" role="alert"><IconoAlerta /><span>{error}</span></div>
              )}

              <Campo
                etiqueta="Correo del proveedor" id="i-email" opcional
                pista="Solo para dejar anotado a quién se invitó; se precarga en su formulario."
              >
                <input
                  id="i-email" className="control" type="email" placeholder="contacto@proveedor.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={generando} data-foco-inicial autoComplete="off"
                />
              </Campo>

              <Campo etiqueta="Vigencia del link" id="i-dias" pista="Pasado ese plazo el link deja de servir.">
                <select
                  id="i-dias" className="control" value={dias}
                  onChange={e => setDias(e.target.value)} disabled={generando}
                >
                  <option value="1">1 día</option>
                  <option value="3">3 días</option>
                  <option value="7">7 días</option>
                  <option value="15">15 días</option>
                  <option value="30">30 días</option>
                </select>
              </Campo>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
