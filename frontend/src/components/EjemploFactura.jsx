import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import Modal from './Modal';
import { IconoDocumentos, IconoSubir, IconoDescargar, IconoAlerta } from './Iconos';
import { descargarArchivo } from '../lib/descargas';
import { formatFechaHora } from '../lib/formato';
import { toast, avisoError } from '../lib/alertas';

/* Publicación del ejemplo de factura (spec 001 HU-7).
 *
 * Un PDF que enseña a los proveedores cómo debe verse lo que suben. Se
 * reemplaza subiendo otro: no hay historial de ejemplos porque solo importa
 * el vigente, y tener tres antiguos es la forma de que algún día se
 * descargue el equivocado.
 */
export default function EjemploFactura() {
  const inputRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [info, setInfo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    api.get('/config/ejemplo-factura/info')
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setCargando(false));
  }, [abierto]);

  async function subir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
      await avisoError('El ejemplo debe ser un PDF.', 'Formato no permitido');
      return;
    }

    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append('archivo', archivo);
      const { data } = await api.put('/config/ejemplo-factura', datos, {
        headers: { 'Content-Type': undefined },
      });
      setInfo(data);
      toast('Ejemplo publicado: los proveedores ya lo ven');
    } catch (err) {
      await avisoError(err.response?.data?.error || 'No se pudo publicar el ejemplo.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--neutro" onClick={() => setAbierto(true)}>
        <IconoDocumentos /> Ejemplo de factura
      </button>

      {abierto && (
        <Modal
          titulo="Ejemplo de factura"
          subtitulo="El PDF que los proveedores ven en su portal como referencia."
          onCerrar={() => setAbierto(false)}
          bloqueado={subiendo}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setAbierto(false)} disabled={subiendo}>
                Cerrar
              </button>
              <button
                type="button" className="btn btn--primario"
                onClick={() => inputRef.current?.click()} disabled={subiendo}
              >
                {subiendo ? <><span className="spinner" /> Publicando…</> : <><IconoSubir /> {info?.publicado ? 'Reemplazar' : 'Publicar ejemplo'}</>}
              </button>
            </>
          }
        >
          <input
            ref={inputRef} type="file" accept=".pdf,application/pdf"
            style={{ display: 'none' }} onChange={subir}
          />

          {cargando ? (
            <p className="pista">Consultando…</p>
          ) : info?.publicado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e3)' }}>
              <p style={{ fontSize: 13.5, color: 'var(--color-texto)' }}>
                Publicado: <strong>{info.nombre_original}</strong>
              </p>
              <p className="pista">Actualizado el {formatFechaHora(info.actualizado_en)}.</p>
              <div>
                <button
                  type="button" className="btn btn--neutro btn--sm"
                  onClick={() => descargarArchivo('/config/ejemplo-factura', info.nombre_original)}
                >
                  <IconoDescargar /> Ver el que está publicado
                </button>
              </div>
            </div>
          ) : (
            <div className="aviso aviso--atencion">
              <IconoAlerta />
              <span>
                Todavía no hay ejemplo publicado. Mientras no lo haya, los proveedores
                no ven ninguna guía en su portal.
              </span>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
