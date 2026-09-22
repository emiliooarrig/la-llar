import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import Insignia from '../components/Insignia';
import PanelFacturas from '../components/PanelFacturas';
import { IconoAlerta, IconoLapiz, IconoCandado } from '../components/Iconos';
import { plural } from '../lib/formato';
import { toast, avisoError } from '../lib/alertas';
import styles from './FacturasProveedor.module.css';

/* Facturación de un proveedor, vista del administrador (spec 001 HU-3,
   HU-4, HU-8, HU-10).

   Los dos ajustes que gobiernan la relación —días de crédito y bloqueo—
   viven arriba, no escondidos en un menú: son el contexto con el que se
   revisa todo lo que hay debajo. */

export default function FacturasProveedor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [proveedor, setProveedor] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null);   // 'credito' | 'bloqueo'
  const [form, setForm] = useState({ dias_credito: '', motivo: '' });
  const [errorForm, setErrorForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [perfil, lista] = await Promise.all([
        api.get(`/proveedores/${id}`),
        api.get(`/proveedores/${id}/facturas`),
      ]);
      setProveedor(perfil.data);
      setFacturas(lista.data.facturas ?? []);
    } catch (e) {
      await avisoError(e.response?.data?.error ?? 'No se pudo cargar el proveedor.');
      navigate('/admin/proveedores');
    } finally {
      setCargando(false);
    }
  }

  function abrirCredito() {
    setForm({ dias_credito: proveedor.dias_credito == null ? '' : String(proveedor.dias_credito), motivo: '' });
    setErrorForm(null);
    setModal('credito');
  }

  function abrirBloqueo() {
    setForm({ dias_credito: '', motivo: proveedor.motivo_bloqueo ?? '' });
    setErrorForm(null);
    setModal('bloqueo');
  }

  async function guardarCredito(e) {
    e.preventDefault();
    const dias = Number(form.dias_credito);
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
      setErrorForm('Escribe un número entero de días entre 0 y 365.');
      return;
    }

    setGuardando(true);
    try {
      const { data } = await api.patch(`/proveedores/${id}/credito`, { dias_credito: dias });
      setProveedor(p => ({ ...p, dias_credito: data.dias_credito }));
      setModal(null);
      toast('Días de crédito guardados');
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function alternarBloqueo(e) {
    e.preventDefault();
    const bloquear = !proveedor.bloqueado_facturar;
    const motivo = form.motivo.trim();

    if (bloquear && !motivo) {
      setErrorForm('Escribe el motivo. El proveedor lo va a leer cuando intente facturar.');
      return;
    }

    setGuardando(true);
    try {
      const { data } = await api.patch(`/proveedores/${id}/bloqueo`, { bloqueado: bloquear, motivo });
      setProveedor(p => ({ ...p, bloqueado_facturar: data.bloqueado_facturar, motivo_bloqueo: data.motivo_bloqueo }));
      setModal(null);
      toast(bloquear ? 'Facturación bloqueada' : 'Facturación desbloqueada');
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'No se pudo cambiar el bloqueo.');
    } finally {
      setGuardando(false);
    }
  }

  const pendientes = facturas.filter(f => f.estado === 'pendiente').length;

  return (
    <Layout
      titulo={proveedor?.nombre ?? 'Facturas'}
      subtitulo={proveedor
        ? `RFC ${proveedor.rfc || 'no especificado'} · ${plural(facturas.length, 'factura')}` +
          (pendientes > 0 ? ` · ${pendientes} por revisar` : '')
        : undefined}
      migas={[
        { etiqueta: 'Proveedores', to: '/admin/proveedores' },
        { etiqueta: proveedor?.nombre ?? '…', to: `/admin/proveedores/${id}` },
        { etiqueta: 'Facturas' },
      ]}
    >
      {proveedor?.bloqueado_facturar && (
        <div className="aviso aviso--error" role="alert" style={{ marginBottom: 'var(--e4)' }}>
          <IconoAlerta />
          <span>
            <strong>Este proveedor no puede facturar.</strong> {proveedor.motivo_bloqueo}
          </span>
        </div>
      )}

      <div className={styles.cabecera}>
        <div className={styles.ajustes}>
          <div className={styles.ajuste}>
            <span className={styles.ajusteEtiqueta}>Días de crédito</span>
            <span className={styles.ajusteValor}>
              {proveedor?.dias_credito == null
                ? <span className={styles.sinConfigurar}>Sin configurar</span>
                : proveedor.dias_credito === 0
                  ? 'De contado'
                  : plural(proveedor.dias_credito, 'día')}
            </span>
          </div>

          <div className={styles.ajuste}>
            <span className={styles.ajusteEtiqueta}>Facturación</span>
            <span className={styles.ajusteValor}>
              <Insignia tono={proveedor?.bloqueado_facturar ? 'error' : 'exito'}>
                {proveedor?.bloqueado_facturar ? 'Bloqueada' : 'Habilitada'}
              </Insignia>
            </span>
          </div>
        </div>

        <div className={styles.acciones}>
          <button type="button" className="btn btn--neutro btn--sm" onClick={abrirCredito} disabled={!proveedor}>
            <IconoLapiz /> Días de crédito
          </button>
          <button
            type="button" disabled={!proveedor}
            className={`btn btn--sm ${proveedor?.bloqueado_facturar ? 'btn--neutro' : 'btn--peligro'}`}
            onClick={abrirBloqueo}
          >
            <IconoCandado abierto={proveedor?.bloqueado_facturar} />
            {proveedor?.bloqueado_facturar ? 'Desbloquear' : 'Bloquear facturación'}
          </button>
        </div>
      </div>

      <PanelFacturas
        facturas={facturas}
        esAdmin
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        onCambio={f => setFacturas(prev => prev.map(x => (x.id === f.id ? f : x)))}
        vacio={{
          titulo: 'Este proveedor no ha subido facturas',
          texto: 'Cuando suba su primera factura aparecerá aquí para revisión.',
        }}
      />

      {modal === 'credito' && (
        <Modal
          titulo="Días de crédito"
          subtitulo={proveedor.nombre}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" form="form-credito" className="btn btn--primario" disabled={guardando}>
                {guardando && <span className="spinner" />}Guardar
              </button>
            </>
          }
        >
          <form id="form-credito" onSubmit={guardarCredito} noValidate>
            <Campo
              etiqueta="Días naturales entre la aprobación y el pago"
              error={errorForm} id="c-dias"
              pista="0 significa de contado. Se usa para calcular la fecha de pago estimada del resumen."
            >
              <input
                id="c-dias" type="number" min={0} max={365} step={1}
                className={`control${errorForm ? ' control--invalido' : ''}`}
                placeholder="Ej. 30"
                value={form.dias_credito}
                onChange={e => { setForm(p => ({ ...p, dias_credito: e.target.value })); setErrorForm(null); }}
                disabled={guardando} data-foco-inicial
              />
            </Campo>
          </form>
        </Modal>
      )}

      {modal === 'bloqueo' && (
        <Modal
          titulo={proveedor.bloqueado_facturar ? 'Desbloquear la facturación' : 'Bloquear la facturación'}
          subtitulo={proveedor.nombre}
          onCerrar={() => setModal(null)}
          bloqueado={guardando}
          pie={
            <>
              <button type="button" className="btn btn--neutro" onClick={() => setModal(null)} disabled={guardando}>Cancelar</button>
              <button
                type="submit" form="form-bloqueo" disabled={guardando}
                className={`btn ${proveedor.bloqueado_facturar ? 'btn--primario' : 'btn--peligro'}`}
              >
                {guardando && <span className="spinner" />}
                {proveedor.bloqueado_facturar ? 'Desbloquear' : 'Bloquear'}
              </button>
            </>
          }
        >
          <form id="form-bloqueo" onSubmit={alternarBloqueo} noValidate>
            {proveedor.bloqueado_facturar ? (
              <p style={{ fontSize: 13.5, color: 'var(--color-texto-suave)', lineHeight: 1.6 }}>
                {proveedor.nombre} volverá a poder subir facturas. El motivo actual
                («{proveedor.motivo_bloqueo}») se borrará.
              </p>
            ) : (
              <Campo
                etiqueta="Motivo del bloqueo" error={errorForm} id="b-motivo"
                pista="El proveedor lo verá al intentar subir una factura."
              >
                <textarea
                  id="b-motivo" rows={3} maxLength={300}
                  className={`control${errorForm ? ' control--invalido' : ''}`}
                  placeholder="Ej. Facturas con RFC receptor incorrecto de forma reiterada."
                  value={form.motivo}
                  onChange={e => { setForm(p => ({ ...p, motivo: e.target.value })); setErrorForm(null); }}
                  disabled={guardando} data-foco-inicial
                />
              </Campo>
            )}
          </form>
        </Modal>
      )}
    </Layout>
  );
}
