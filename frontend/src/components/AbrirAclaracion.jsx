import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import Campo from './Campo';
import { IconoCheck } from './Iconos';
import { toast, avisoError } from '../lib/alertas';
import { RUTA_ACLARACIONES } from '../lib/modulos';
import { referenciaFactura, formatImporte } from '../lib/facturas';

/* Abrir una aclaración desde una factura (spec 003 HU-1, T-304).
 *
 * Se abre desde el documento y no desde una pantalla en blanco porque así
 * la referencia sale sola: el proveedor no tiene que buscar ni teclear el
 * folio de la factura sobre la que pregunta. Si la factura ya tiene
 * complemento se ofrece incluirlo, que es la duda más común («pagaron pero
 * no cuadra con el complemento»).
 *
 * Al crearla se lleva al usuario al hilo recién abierto: es donde va a
 * seguir la conversación.
 */
const ASUNTO_MAX = 200;
const NOTA_MAX = 1000;

export default function AbrirAclaracion({ factura, onCerrar }) {
  const { usuario } = useAuth();
  const navegar = useNavigate();

  const [asunto, setAsunto] = useState('');
  const [nota, setNota] = useState('');
  const [conComplemento, setConComplemento] = useState(Boolean(factura.complemento?.id));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const siguientes = {};
    if (!asunto.trim()) siguientes.asunto = 'Escribe de qué trata la aclaración.';
    if (!nota.trim()) siguientes.nota = 'Explica qué necesitas aclarar.';
    setErrores(siguientes);
    if (Object.keys(siguientes).length) return;

    const documentos = [{ origen: 'factura', origen_id: factura.id }];
    if (conComplemento && factura.complemento?.id) {
      documentos.push({ origen: 'complemento', origen_id: factura.complemento.id });
    }

    setGuardando(true);
    try {
      const { data } = await api.post('/aclaraciones', {
        asunto: asunto.trim(),
        nota_inicial: nota.trim(),
        documentos,
      });
      toast('Aclaración abierta');
      navegar(`${RUTA_ACLARACIONES[usuario.rol]}?id=${data.id}`);
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo abrir la aclaración.');
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Abrir aclaración"
      subtitulo={`Factura ${referenciaFactura(factura)} · ${formatImporte(factura.total, factura.moneda)}`}
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <button type="button" className="btn btn--neutro" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" form="form-aclaracion" className="btn btn--primario" disabled={guardando}>
            {guardando && <span className="spinner" />}
            {guardando ? 'Abriendo…' : 'Abrir aclaración'}
          </button>
        </>
      }
    >
      <form
        id="form-aclaracion" onSubmit={enviar} noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}
      >
        <Campo etiqueta="Asunto" error={errores.asunto} id="acl-asunto">
          <input
            id="acl-asunto" className={`control${errores.asunto ? ' control--invalido' : ''}`}
            type="text" maxLength={ASUNTO_MAX} data-foco-inicial autoComplete="off"
            placeholder="Ej. El total no coincide con la orden de compra"
            value={asunto}
            onChange={ev => { setAsunto(ev.target.value); if (errores.asunto) setErrores(p => ({ ...p, asunto: null })); }}
            disabled={guardando}
          />
        </Campo>

        <Campo
          etiqueta="Qué necesitas aclarar" error={errores.nota} id="acl-nota"
          pista={usuario?.rol === 'proveedor'
            ? 'La administración lo leerá con la factura a la vista.'
            : 'El proveedor lo leerá con la factura a la vista.'}
        >
          <textarea
            id="acl-nota" rows={4} maxLength={NOTA_MAX}
            className={`control${errores.nota ? ' control--invalido' : ''}`}
            placeholder="Cuenta el caso con el detalle que haga falta."
            value={nota}
            onChange={ev => { setNota(ev.target.value); if (errores.nota) setErrores(p => ({ ...p, nota: null })); }}
            disabled={guardando}
          />
        </Campo>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--e2)' }}>
          <legend className="etiqueta" style={{ marginBottom: 'var(--e2)' }}>Documentos de la aclaración</legend>
          <label style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center', fontSize: 13 }}>
            <IconoCheck tamano={15} /> Factura {referenciaFactura(factura)}
          </label>
          {factura.complemento?.id && (
            <label style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={conComplemento}
                onChange={ev => setConComplemento(ev.target.checked)} disabled={guardando}
              />
              Incluir su complemento de pago
            </label>
          )}
          <span className="pista">Dentro de la aclaración podrás adjuntar archivos de soporte.</span>
        </fieldset>
      </form>
    </Modal>
  );
}
