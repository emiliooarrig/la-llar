const { PrismaClient } = require('@prisma/client');
const { calcularAbierta } = require('./ventanasController');

const prisma = new PrismaClient();

/* Alertas de facturación (spec 001 HU-6).
 *
 * Son IN-APP: se calculan al vuelo desde los datos que ya existen y se
 * pintan en el panel. No hay tabla de alertas ni estado de "leída" —una
 * alerta aquí no es un mensaje que alguien envía, es una situación que se
 * da o no se da—, y por eso tampoco hay nada que sincronizar ni que limpiar.
 *
 * ── Plan para las alertas por correo ─────────────────────────────────
 * El negocio las quiere in-app ahora y por correo más adelante. Cuando
 * toque, este controlador NO cambia: lo que se añade es un proceso aparte
 * que corre cada mañana, llama a estas mismas funciones y manda lo que
 * encuentre. Lo que haría falta entonces:
 *   1. Un transporte de correo (nodemailer + SMTP de Hostinger) en
 *      `src/lib/correo.js`, con las credenciales en el .env.
 *   2. Una tabla `alertas_enviadas` (tipo, referencia_id, enviado_en) para
 *      no mandar el mismo aviso todos los días: es el único estado nuevo
 *      que el correo necesita y que el panel no.
 *   3. Un disparador diario. En Hostinger, un cron que llame a un script
 *      `scripts/enviar_alertas.js`; no hace falta meter un planificador
 *      dentro del proceso de Express.
 *   4. Plantillas de texto por tipo de alerta, en español y con el enlace
 *      directo a la pantalla que resuelve cada una.
 * Deliberadamente no se ha escrito nada de eso todavía: sin el SMTP
 * decidido, serían tres archivos que nadie ha podido probar.
 */

/** Documentos y facturas esperando revisión del administrador. */
async function porRevisar() {
  const [facturas, complementos] = await Promise.all([
    prisma.facturas.findMany({
      where: { estado: 'pendiente' },
      select: {
        id: true, uuid_fiscal: true, serie_folio: true, total: true, creado_en: true,
        proveedor: { select: { id: true, nombre: true } },
        empresa: { select: { id: true, nombre: true } },
      },
      orderBy: { creado_en: 'asc' },
    }),
    prisma.complementos_pago.findMany({
      where: { estado: 'pendiente' },
      select: {
        id: true, creado_en: true, uuid_fiscal: true,
        factura: {
          select: {
            id: true, serie_folio: true, uuid_fiscal: true,
            proveedor: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { creado_en: 'asc' },
    }),
  ]);

  return [
    ...facturas.map((f) => ({
      tipo: 'factura_por_revisar',
      referencia_id: f.id,
      proveedor_id: f.proveedor?.id ?? null,
      titulo: `Factura ${f.serie_folio || f.uuid_fiscal} de ${f.proveedor?.nombre ?? 'un proveedor'}`,
      detalle: `${f.empresa?.nombre ?? 'Sin empresa'} · $${f.total.toFixed(2)}`,
      desde: f.creado_en,
    })),
    ...complementos.map((c) => ({
      tipo: 'complemento_por_revisar',
      referencia_id: c.factura.id,
      proveedor_id: c.factura.proveedor?.id ?? null,
      titulo: `Complemento de pago de la factura ${c.factura.serie_folio || c.factura.uuid_fiscal}`,
      detalle: c.factura.proveedor?.nombre ?? 'Proveedor',
      desde: c.creado_en,
    })),
  ].sort((a, b) => new Date(a.desde) - new Date(b.desde));
}

/** Facturas pagadas cuyo complemento nadie ha subido: el proveedor está
 *  frenado y probablemente no lo sabe. */
async function complementosPendientes() {
  const facturas = await prisma.facturas.findMany({
    where: { pago_realizado: true, complemento: { is: null } },
    select: {
      id: true, uuid_fiscal: true, serie_folio: true, fecha_pago_marcado: true, total: true,
      proveedor: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha_pago_marcado: 'asc' },
  });

  return facturas.map((f) => ({
    tipo: 'complemento_pendiente',
    referencia_id: f.id,
    proveedor_id: f.proveedor?.id ?? null,
    titulo: `Falta el complemento de pago de la factura ${f.serie_folio || f.uuid_fiscal}`,
    detalle: `${f.proveedor?.nombre ?? 'Proveedor'} · pagada el ${fechaCorta(f.fecha_pago_marcado)}`,
    desde: f.fecha_pago_marcado,
  }));
}

/* Proveedores que no subieron nada durante la ventana de carga.
 *
 * Se mide contra la VENTANA DE CARGA programada, no contra la semana
 * natural (respuesta del negocio a la pregunta abierta §7): lo que el
 * administrador quiere saber es quién incumplió el plazo que él abrió, y
 * ese plazo no tiene por qué caer en lunes.
 *
 * Sin ventana programada no hay periodo contra el que medir, y la alerta
 * se calla en vez de inventarse uno. */
async function sinSubirEnPeriodo() {
  const ventana = await prisma.ventanas_carga.findUnique({ where: { modulo: 'proveedores' } });
  if (!ventana?.desde || !ventana?.hasta) {
    return { aplica: false, motivo: 'La ventana de carga de proveedores no tiene un periodo programado.', proveedores: [] };
  }

  const desde = new Date(ventana.desde);
  const hasta = new Date(ventana.hasta);

  const proveedores = await prisma.proveedores.findMany({
    where: { activo: true },
    select: {
      id: true, nombre: true,
      _count: {
        select: {
          facturas: { where: { creado_en: { gte: desde, lte: hasta } } },
          documentos_proveedor: { where: { creado_en: { gte: desde, lte: hasta } } },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  });

  const morosos = proveedores.filter((p) => p._count.facturas === 0 && p._count.documentos_proveedor === 0);

  return {
    aplica: true,
    periodo: { desde: ventana.desde, hasta: ventana.hasta, abierta: calcularAbierta(ventana) },
    proveedores: morosos.map((p) => ({
      tipo: 'sin_subir_en_periodo',
      referencia_id: p.id,
      proveedor_id: p.id,
      titulo: p.nombre,
      detalle: 'No ha subido nada en el periodo de carga',
      desde: ventana.desde,
    })),
  };
}

function fechaCorta(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

/* ── GET /api/alertas (administrador) ────────────────────────────────── */
async function listar(_req, res) {
  try {
    const [revisar, complementos, periodo] = await Promise.all([
      porRevisar(),
      complementosPendientes(),
      sinSubirEnPeriodo(),
    ]);

    res.json({
      total: revisar.length + complementos.length + periodo.proveedores.length,
      por_revisar: revisar,
      complementos_pendientes: complementos,
      sin_subir: periodo,
    });
  } catch (e) {
    console.error('Error al listar alertas:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/alertas/mias (proveedor) ───────────────────────────────── */
// Lo que el proveedor necesita saber nada más entrar: qué le falta subir y
// qué le rechazaron. Es la otra mitad de HU-6.
async function mias(req, res) {
  const proveedorId = req.usuario.proveedor_id;
  if (!proveedorId) return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const [pendientesComplemento, rechazadas, bloqueo] = await Promise.all([
      prisma.facturas.findMany({
        where: { proveedor_id: proveedorId, pago_realizado: true, complemento: { is: null } },
        select: { id: true, uuid_fiscal: true, serie_folio: true, fecha_pago_marcado: true },
        orderBy: { fecha_pago_marcado: 'asc' },
      }),
      prisma.facturas.findMany({
        where: { proveedor_id: proveedorId, estado: 'desaprobado' },
        select: {
          id: true, uuid_fiscal: true, serie_folio: true,
          observaciones: { orderBy: { creado_en: 'desc' }, take: 1, select: { texto: true, creado_en: true } },
        },
        orderBy: { creado_en: 'desc' },
      }),
      prisma.proveedores.findUnique({
        where: { id: proveedorId },
        select: { bloqueado_facturar: true, motivo_bloqueo: true },
      }),
    ]);

    const alertas = [
      ...pendientesComplemento.map((f) => ({
        tipo: 'sube_complemento',
        referencia_id: f.id,
        titulo: `Sube el complemento de pago de la factura ${f.serie_folio || f.uuid_fiscal}`,
        detalle: 'Ya se marcó como pagada. Hasta que lo subas no podrás enviar otra factura.',
        desde: f.fecha_pago_marcado,
      })),
      ...rechazadas.map((f) => ({
        tipo: 'factura_rechazada',
        referencia_id: f.id,
        titulo: `Se rechazó la factura ${f.serie_folio || f.uuid_fiscal}`,
        detalle: f.observaciones[0]?.texto ?? 'Revisa las observaciones.',
        desde: f.observaciones[0]?.creado_en ?? null,
      })),
    ];

    if (bloqueo?.bloqueado_facturar) {
      alertas.unshift({
        tipo: 'bloqueado',
        referencia_id: proveedorId,
        titulo: 'Tienes la facturación bloqueada',
        detalle: bloqueo.motivo_bloqueo || 'Contacta al administrador.',
        desde: null,
      });
    }

    res.json({ total: alertas.length, alertas });
  } catch (e) {
    console.error('Error al listar alertas del proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, mias, porRevisar, complementosPendientes, sinSubirEnPeriodo };
