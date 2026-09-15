import { useState } from 'react';
import api from '../services/api';
import Modal from './Modal';
import Campo from './Campo';
import Insignia from './Insignia';
import { IconoCalendario, IconoCerrar } from './Iconos';
import { etiquetaVentana, aDatetimeLocal } from '../lib/ventanas';
import { confirmar, toast, avisoError } from '../lib/alertas';
import styles from './VentanaCarga.module.css';

function formatDatetime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/* Control de la ventana de carga, idéntico para proveedores y unidades.
   Vivía duplicado en las dos pantallas de catálogo, con sus propios
   modales, sus propios botones y sus propios textos de confirmación. */
export default function VentanaCarga({ modulo, ventana, onCambio, quien }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ desde: '', hasta: '' });
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState(false);

  const programada = Boolean(ventana?.desde && ventana?.hasta);
  const estado = etiquetaVentana(ventana);

  function abrir() {
    setForm({ desde: aDatetimeLocal(ventana?.desde), hasta: aDatetimeLocal(ventana?.hasta) });
    setErrores({});
    setModal(true);
  }

  async function guardar(e) {
    e.preventDefault();
    const fallos = {};
    if (!form.desde) fallos.desde = 'Indica cuándo abre.';
    if (!form.hasta) fallos.hasta = 'Indica cuándo cierra.';
    if (form.desde && form.hasta && new Date(form.hasta) <= new Date(form.desde)) {
      fallos.hasta = 'El cierre debe ser posterior a la apertura.';
    }
    setErrores(fallos);
    if (Object.keys(fallos).length > 0) return;

    setOcupado(true);
    try {
      const { data } = await api.put(`/ventanas/${modulo}/programacion`, {
        desde: new Date(form.desde).toISOString(),
        hasta: new Date(form.hasta).toISOString(),
      });
      onCambio(data);
      setModal(false);
      toast('Programación guardada');
    } catch (err) {
      await avisoError(err.response?.data?.error ?? 'No se pudo guardar la programación.');
    } finally {
      setOcupado(false);
    }
  }

  async function limpiar() {
    const ok = await confirmar({
      titulo: '¿Eliminar la programación?',
      texto: 'La ventana volverá al modo manual y quedará cerrada hasta que la abras.',
      confirmar: 'Eliminar programación',
      destructivo: true,
    });
    if (!ok) return;

    setOcupado(true);
    try {
      const { data } = await api.delete(`/ventanas/${modulo}/programacion`);
      onCambio(data);
      toast('Programación eliminada');
    } catch {
      await avisoError('No se pudo limpiar la programación.');
    } finally {
      setOcupado(false);
    }
  }

  /* Abrir o cerrar la ventana cambia lo que pueden hacer otras personas
     ahora mismo: se confirma aunque sea reversible. */
  async function alternarManual() {
    const abierta = ventana?.abierta;
    const ok = await confirmar({
      titulo: abierta ? '¿Cerrar la ventana de carga?' : '¿Abrir la ventana de carga?',
      texto: abierta
        ? `${quien} dejarán de poder subir documentos de inmediato.`
        : `${quien} podrán subir documentos de inmediato.`,
      confirmar: abierta ? 'Cerrar ventana' : 'Abrir ventana',
      destructivo: abierta,
    });
    if (!ok) return;

    setOcupado(true);
    try {
      const { data } = await api.patch(`/ventanas/${modulo}`);
      onCambio(data);
      toast(data.abierta ? 'Ventana abierta' : 'Ventana cerrada');
    } catch {
      await avisoError('No se pudo cambiar el estado de la ventana.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className={styles.controles}>
        <span className={styles.estado}>
          <Insignia tono={estado.tono}>{estado.texto}</Insignia>
          {programada && (
            <span className={`${styles.rango} num`}>
              {formatDatetime(ventana.desde)} → {formatDatetime(ventana.hasta)}
            </span>
          )}
        </span>

        <button type="button" className="btn btn--neutro btn--sm" onClick={abrir} disabled={ocupado || !ventana}>
          <IconoCalendario /> {programada ? 'Editar horario' : 'Programar'}
        </button>

        {programada ? (
          <button type="button" className="btn btn--peligro btn--sm" onClick={limpiar} disabled={ocupado}>
            <IconoCerrar /> Quitar horario
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn--sm ${ventana?.abierta ? 'btn--peligro' : 'btn--exito'}`}
            onClick={alternarManual}
            disabled={ocupado}
          >
            {ventana?.abierta ? 'Cerrar ahora' : 'Abrir ahora'}
          </button>
        )}
      </div>

      {modal && (
        <Modal
          titulo="Programar la ventana de carga"
          subtitulo={`${quien} sólo podrán subir documentos dentro de este intervalo.`}
          onCerrar={() => setModal(false)}
          bloqueado={ocupado}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(false)} disabled={ocupado}>
                Cancelar
              </button>
              <button type="submit" form="form-ventana" className="btn btn--primario" disabled={ocupado}>
                {ocupado && <span className="spinner" />} Guardar horario
              </button>
            </>
          }
        >
          <form id="form-ventana" onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e4)' }}>
            <Campo etiqueta="Apertura" id="v-desde" error={errores.desde}>
              <input
                id="v-desde" type="datetime-local"
                className={`control${errores.desde ? ' control--invalido' : ''}`}
                value={form.desde}
                onChange={e => setForm(p => ({ ...p, desde: e.target.value }))}
                disabled={ocupado} data-foco-inicial
              />
            </Campo>
            <Campo
              etiqueta="Cierre" id="v-hasta" error={errores.hasta}
              pista="Fuera del intervalo la ventana se cierra sola, sin que tengas que entrar."
            >
              <input
                id="v-hasta" type="datetime-local"
                className={`control${errores.hasta ? ' control--invalido' : ''}`}
                value={form.hasta}
                onChange={e => setForm(p => ({ ...p, hasta: e.target.value }))}
                disabled={ocupado}
              />
            </Campo>
          </form>
        </Modal>
      )}
    </>
  );
}
