const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { UPLOADS_DIR, borrarArchivos } = require('../middleware/upload');

const prisma = new PrismaClient();

/* Vales azules: reembolso de gastos menores (spec 002).
 *
 * El vale es un PAPEL. Alguien adelantó dinero de su bolsillo, le dieron un
 * vale azul firmado a mano, lo escanea y pide que se lo devuelvan. Todo lo
 * que hace este módulo es llevar la cuenta de ese papel.
 *
 * Tres reglas de negocio, las tres del negocio y no del programador:
 *   1. Tope de $500 por vale.
 *   2. Un vale a la vez por solicitante, hasta que el anterior se resuelva.
 *   3. El folio del papel no se puede cobrar dos veces.
 */

/* Tope fijo. Vive aquí y en ningún otro sitio: el día que el negocio lo
 * cambie, se cambia una vez. La UI lo lee del endpoint de reglas, no lo
 * repite, justamente para que no puedan discrepar. */
const TOPE_VALE = 500;

const MOTIVO_MAX = 300;
const CONCEPTO_MAX = 300;
const UID_MAX = 64;

/* Estados que dejan al solicitante bloqueado. `no_autorizado` bloquea a
 * propósito, igual que `pendiente`: un vale que la empresa decidió no
 * reembolsar no desaparece solo, alguien tiene que cerrarlo. */
const ESTADOS_SIN_RESOLVER = ['pendiente', 'no_autorizado'];

const INCLUDE_VALE = {
  empresa: { select: { id: true, nombre: true } },
};

/** El monto viaja como cadena y se compara como centavos enteros. Con
 *  `parseFloat`, un vale de 500.00 puede quedar en 500.00000000001 y
 *  rechazarse por pasarse del tope por una millonésima de peso. */
function aCentavos(texto) {
  const limpio = String(texto ?? '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [entera, decimal = ''] = limpio.split('.');
  return Number(entera) * 100 + Number((decimal + '00').slice(0, 2));
}

const deCentavos = (c) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

/** Serializa el Decimal de Prisma como cadena con dos decimales. */
function serializarVale(vale) {
  if (!vale) return vale;
  return { ...vale, monto: vale.monto != null ? vale.monto.toFixed(2) : null };
}

/* El folio se teclea a mano de un papel: el mismo vale escrito como `a-123`
 * y `A-123 ` tiene que ser el mismo vale. Sin normalizar, el índice único
 * no los vería iguales y el reembolso se pagaría dos veces. */
function normalizarUid(texto) {
  return String(texto ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/* ── Alcance ──────────────────────────────────────────────────────────
 * Quien solicita solo ve lo suyo. `solicitante_id` sale de `req.usuario.id`,
 * nunca del cuerpo de la petición: si el cliente pudiera elegir a nombre de
 * quién sube, el bloqueo de "uno a la vez" no valdría nada. */
const esAutorizador = (usuario) => usuario.rol === 'administrador';

/** El vale que tiene bloqueado a un solicitante, si lo hay. */
function valeQueBloquea(solicitanteId) {
  return prisma.vales.findFirst({
    where: { solicitante_id: solicitanteId, estado: { in: ESTADOS_SIN_RESOLVER } },
    orderBy: { creado_en: 'asc' },
    select: { id: true, uid: true, estado: true, monto: true, creado_en: true },
  });
}

/* ── GET /api/vales/reglas ────────────────────────────────────────────
 * Las reglas que la pantalla enseña en su panel informativo (HU-2). Van en
 * un endpoint y no escritas en el JSX para que el tope no exista en dos
 * sitios: si el negocio lo cambia, la pantalla se entera sola. */
async function reglas(req, res) {
  try {
    const bloqueante = esAutorizador(req.usuario) ? null : await valeQueBloquea(req.usuario.id);

    res.json({
      tope: deCentavos(TOPE_VALE * 100),
      reglas: [
        `Cada vale está topado a $${TOPE_VALE}.`,
        'El vale tiene que venir firmado a mano por quien autoriza el gasto; se revisa sobre el escaneo.',
        'Solo puedes tener un vale sin resolver: hasta que el anterior se autorice, no se admite otro.',
      ],
      vale_sin_resolver: bloqueante
        ? { id: bloqueante.id, uid: bloqueante.uid, estado: bloqueante.estado }
        : null,
    });
  } catch (e) {
    console.error('Error al obtener las reglas de vales:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/vales ──────────────────────────────────────────────────
 * Alta de un vale. Las validaciones van de la más barata a la más cara y de
 * la más general a la más concreta, para que el solicitante reciba el
 * mensaje que le sirve y no el primero que falle por casualidad. */
async function crear(req, res) {
  const limpiar = () => borrarArchivos([req.file?.filename]);

  if (!req.file) {
    return res.status(400).json({ error: 'Sube el comprobante del vale en PDF.' });
  }

  try {
    /* 1. Monto: el tope es la regla que más se incumple, y la única que el
     *    solicitante puede comprobar antes de escanear nada. */
    const centavos = aCentavos(req.body?.monto);
    if (centavos === null) {
      await limpiar();
      return res.status(400).json({ error: 'El monto no es válido. Escríbelo como 123.45, sin símbolos.' });
    }
    if (centavos <= 0) {
      await limpiar();
      return res.status(400).json({ error: 'El monto tiene que ser mayor que cero.' });
    }
    if (centavos > TOPE_VALE * 100) {
      await limpiar();
      return res.status(400).json({
        error: `Los vales azules están topados a $${TOPE_VALE}. Este es de $${deCentavos(centavos)}.`,
        tope: deCentavos(TOPE_VALE * 100),
      });
    }

    /* 2. Folio del papel. Obligatorio: sin él no hay anti-duplicado. */
    const uid = normalizarUid(req.body?.uid);
    if (!uid) {
      await limpiar();
      return res.status(400).json({ error: 'Captura el folio impreso en el vale.' });
    }
    if (uid.length > UID_MAX) {
      await limpiar();
      return res.status(400).json({ error: `El folio no puede exceder ${UID_MAX} caracteres` });
    }

    const concepto = typeof req.body?.concepto === 'string' ? req.body.concepto.trim() : '';
    if (concepto.length > CONCEPTO_MAX) {
      await limpiar();
      return res.status(400).json({ error: `El concepto no puede exceder ${CONCEPTO_MAX} caracteres` });
    }

    /* 3. Empresa. Un gerente NO la elige: sale de su sucursal (spec 000 §5).
     *    Aceptar la del cuerpo para un gerente sería dejar que el navegador
     *    decidiera a qué entidad jurídica se carga el gasto. */
    const empresaId = await resolverEmpresa(req);
    if (empresaId.error) {
      await limpiar();
      return res.status(400).json({ error: empresaId.error });
    }

    /* 4. Uno a la vez. Va después de las validaciones de formato para que
     *    quien se equivocó de monto vea el error del monto, no el bloqueo. */
    const bloqueante = await valeQueBloquea(req.usuario.id);
    if (bloqueante) {
      await limpiar();
      return res.status(409).json({
        error: bloqueante.estado === 'pendiente'
          ? `Tu vale ${bloqueante.uid} sigue en revisión. Solo puedes tener uno sin resolver.`
          : `Tu vale ${bloqueante.uid} quedó sin autorizar. Habla con el autorizador para cerrarlo antes de subir otro.`,
        vale_sin_resolver: { id: bloqueante.id, uid: bloqueante.uid, estado: bloqueante.estado },
      });
    }

    /* 5. Duplicado. La comprobación previa da el mensaje; el índice único de
     *    la base es lo que de verdad lo impide ante dos altas simultáneas. */
    const repetido = await prisma.vales.findUnique({ where: { uid }, select: { id: true } });
    if (repetido) {
      await limpiar();
      return res.status(409).json({ error: `El vale con folio ${uid} ya está registrado.`, uid });
    }

    const vale = await prisma.vales.create({
      data: {
        solicitante_id: req.usuario.id,
        empresa_id: empresaId.valor,
        monto: deCentavos(centavos),
        uid,
        concepto: concepto || null,
        ruta_comprobante: req.file.filename,
        nombre_original: req.file.originalname,
        tipo_mime: req.file.mimetype,
        estado: 'pendiente',
      },
      include: INCLUDE_VALE,
    });

    res.status(201).json(serializarVale(vale));
  } catch (e) {
    await limpiar();
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Ese folio de vale ya está registrado.' });
    }
    console.error('Error al crear vale:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* La empresa de un gerente sale de su sucursal; el administrador la elige.
 * Es la regla que fijó la spec 000 §5 para todo registro con empresa. */
async function resolverEmpresa(req) {
  if (req.usuario.rol === 'gerente') {
    if (!req.usuario.sucursal_id) {
      return { error: 'Tu usuario no tiene una unidad asignada; el administrador debe asignarte una.' };
    }
    const sucursal = await prisma.sucursales.findUnique({
      where: { id: req.usuario.sucursal_id },
      select: { empresa_id: true },
    });
    if (!sucursal?.empresa_id) {
      return { error: 'Tu unidad no tiene empresa asignada. Avisa al administrador.' };
    }
    return { valor: sucursal.empresa_id };
  }

  const empresaId = parseInt(req.body?.empresa_id);
  if (Number.isNaN(empresaId)) return { error: 'Indica a qué empresa se carga el vale' };

  const empresa = await prisma.empresas.findUnique({ where: { id: empresaId } });
  if (!empresa || !empresa.activo) {
    return { error: 'La empresa indicada no existe o está dada de baja' };
  }
  return { valor: empresa.id };
}


/* ── GET /api/vales ───────────────────────────────────────────────────
 * El solicitante ve los suyos; el autorizador los ve todos, con filtros. */
async function listar(req, res) {
  const where = {};

  if (esAutorizador(req.usuario)) {
    const empresaId = parseInt(req.query.empresa);
    if (!Number.isNaN(empresaId)) where.empresa_id = empresaId;
    if (['pendiente', 'autorizado', 'no_autorizado'].includes(req.query.estado)) {
      where.estado = req.query.estado;
    }
  } else {
    // El alcance NO se toma de la query: se impone.
    where.solicitante_id = req.usuario.id;
  }

  try {
    const vales = await prisma.vales.findMany({
      where,
      include: INCLUDE_VALE,
      orderBy: [{ estado: 'asc' }, { creado_en: 'desc' }],
    });

    // Los nombres de solicitantes y autorizadores, en una sola consulta.
    const ids = [...new Set(vales.flatMap((v) => [v.solicitante_id, v.autorizado_por]).filter(Boolean))];
    const usuarios = ids.length
      ? await prisma.usuarios.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
      : [];
    const nombre = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

    const filas = vales.map((v) => ({
      ...serializarVale(v),
      solicitante: nombre[v.solicitante_id] ?? null,
      autorizador: v.autorizado_por ? (nombre[v.autorizado_por] ?? null) : null,
    }));

    const bloqueante = esAutorizador(req.usuario) ? null : await valeQueBloquea(req.usuario.id);

    res.json({
      vales: filas,
      // Lo que la pantalla necesita para decidir si deja subir otro.
      vale_sin_resolver: bloqueante ? { id: bloqueante.id, uid: bloqueante.uid, estado: bloqueante.estado } : null,
      tope: deCentavos(TOPE_VALE * 100),
    });
  } catch (e) {
    console.error('Error al listar vales:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/** Trae el vale comprobando el alcance. { error, status } o { vale }. */
async function valeConAlcance(req, seleccion = INCLUDE_VALE) {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return { error: 'Identificador inválido', status: 400 };

  const vale = await prisma.vales.findUnique({ where: { id }, include: seleccion });
  if (!vale) return { error: 'Vale no encontrado', status: 404 };

  if (!esAutorizador(req.usuario) && vale.solicitante_id !== req.usuario.id) {
    return { error: 'Acceso denegado', status: 403 };
  }
  return { vale };
}

/* ── GET /api/vales/:id ───────────────────────────────────────────────── */
async function obtener(req, res) {
  try {
    const { vale, error, status } = await valeConAlcance(req);
    if (error) return res.status(status).json({ error });

    const ids = [vale.solicitante_id, vale.autorizado_por].filter(Boolean);
    const usuarios = await prisma.usuarios.findMany({
      where: { id: { in: ids } }, select: { id: true, nombre: true },
    });
    const nombre = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

    res.json({
      ...serializarVale(vale),
      solicitante: nombre[vale.solicitante_id] ?? null,
      autorizador: vale.autorizado_por ? (nombre[vale.autorizado_por] ?? null) : null,
    });
  } catch (e) {
    console.error('Error al obtener vale:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/vales/:id/comprobante ───────────────────────────────────
 * El escaneo del papel. `inline=1` lo entrega para el visor; sin el
 * parámetro, se descarga. */
async function descargarComprobante(req, res) {
  try {
    const { vale, error, status } = await valeConAlcance(req, undefined);
    if (error) return res.status(status).json({ error });

    const ruta = path.join(UPLOADS_DIR, vale.ruta_comprobante);
    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ error: 'El comprobante no está en el servidor.' });
    }

    if (req.query.inline === '1') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(vale.nombre_original)}"`);
      return res.sendFile(ruta);
    }
    return res.download(ruta, vale.nombre_original);
  } catch (e) {
    console.error('Error al servir el comprobante del vale:', e);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}


/* ── PATCH /api/vales/:id/autorizar (administrador) ───────────────────
 * La "firma autorizada" del negocio es el garabato del papel, no algo que
 * el sistema dibuje. Lo que se guarda aquí es la constancia de que alguien
 * abrió el escaneo, comprobó que venía firmado y dio el visto bueno:
 * `autorizado_por` + `fecha_autorizacion`.
 *
 * Nota de control interno: nada impide que un administrador autorice un vale
 * que él mismo subió. Se deja así a propósito —si hay un solo administrador,
 * bloquearlo dejaría sus vales sin poder resolverse nunca— pero la constancia
 * lo deja a la vista: el listado enseña solicitante y autorizador, y cuando
 * son la misma persona se nota. Si el negocio quiere separarlo, es una línea.
 */
async function autorizar(req, res) {
  try {
    const { vale, error, status } = await valeConAlcance(req);
    if (error) return res.status(status).json({ error });

    if (vale.estado === 'autorizado') {
      return res.status(409).json({ error: 'Este vale ya estaba autorizado.' });
    }

    const actualizado = await prisma.vales.update({
      where: { id: vale.id },
      data: {
        estado: 'autorizado',
        autorizado_por: req.usuario.id,
        fecha_autorizacion: new Date(),
        // Autorizar cierra el asunto: el motivo de un rechazo anterior deja
        // de aplicar y no debe seguir a la vista del solicitante.
        motivo_rechazo: null,
      },
      include: INCLUDE_VALE,
    });

    res.json({ ...serializarVale(actualizado), autorizador: req.usuario.nombre });
  } catch (e) {
    console.error('Error al autorizar vale:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── PATCH /api/vales/:id/rechazar (administrador) ────────────────────
 * El motivo es obligatorio: un vale "no autorizado" a secas deja al
 * solicitante sin saber si le falta la firma, si se pasó del tope o si el
 * gasto no procede — y como un vale sin resolver le bloquea el siguiente,
 * no saberlo lo deja parado. */
async function rechazar(req, res) {
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!motivo) {
    return res.status(400).json({ error: 'Para no autorizar un vale hay que escribir el motivo.' });
  }
  if (motivo.length > MOTIVO_MAX) {
    return res.status(400).json({ error: `El motivo no puede exceder ${MOTIVO_MAX} caracteres` });
  }

  try {
    const { vale, error, status } = await valeConAlcance(req);
    if (error) return res.status(status).json({ error });

    const actualizado = await prisma.vales.update({
      where: { id: vale.id },
      data: {
        estado: 'no_autorizado',
        autorizado_por: req.usuario.id,   // quién lo resolvió, aunque fuera en contra
        fecha_autorizacion: new Date(),
        motivo_rechazo: motivo,
      },
      include: INCLUDE_VALE,
    });

    res.json({ ...serializarVale(actualizado), autorizador: req.usuario.nombre });
  } catch (e) {
    console.error('Error al rechazar vale:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── DELETE /api/vales/:id (administrador) ────────────────────────────
 * Cierra un vale no autorizado y libera al solicitante.
 *
 * Es la única salida del callejón: un vale no autorizado bloquea al
 * solicitante y él no puede quitárselo de encima —si pudiera, el bloqueo no
 * serviría de nada—. Alguien con autoridad tiene que cerrarlo.
 *
 * Solo se archivan los NO autorizados: un vale autorizado es el respaldo de
 * un reembolso que se pagó y no se borra nunca. */
async function archivar(req, res) {
  try {
    const { vale, error, status } = await valeConAlcance(req, undefined);
    if (error) return res.status(status).json({ error });

    if (vale.estado !== 'no_autorizado') {
      return res.status(409).json({
        error: vale.estado === 'autorizado'
          ? 'Un vale autorizado es el respaldo de un pago: no se archiva.'
          : 'Resuelve el vale (autorízalo o recházalo) antes de archivarlo.',
      });
    }

    await prisma.vales.delete({ where: { id: vale.id } });
    await borrarArchivos([vale.ruta_comprobante]);

    res.json({ ok: true, id: vale.id });
  } catch (e) {
    console.error('Error al archivar vale:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  reglas,
  crear,
  listar,
  obtener,
  descargarComprobante,
  valeConAlcance,
  autorizar,
  rechazar,
  archivar,
  serializarVale,
  valeQueBloquea,
  esAutorizador,
  aCentavos,
  deCentavos,
  normalizarUid,
  TOPE_VALE,
  ESTADOS_SIN_RESOLVER,
  INCLUDE_VALE,
  MOTIVO_MAX,
};
