const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { UPLOADS_DIR, borrarArchivos } = require('../middleware/upload');
const { parsearCFDI, ErrorCFDI } = require('../lib/cfdi');
const { construirResumen, aFechaISO } = require('../lib/resumenFacturas');
const { aExcel, aPDF, nombreArchivo } = require('../lib/exportarResumen');

const prisma = new PrismaClient();

const OBSERVACION_MAX = 500;

/* Facturación de proveedores (spec 001).
 *
 * El ciclo de una factura, de principio a fin:
 *   sube (XML+PDF) → pendiente → aprobada → pagada → complemento → cerrada
 *
 * Y tres frenos que el negocio pidió explícitamente, en este orden:
 *   1. proveedor bloqueado a mano por el administrador (HU-8)
 *   2. complemento de pago pendiente de una factura ya pagada (HU-4)
 *   3. folio fiscal repetido (HU-2)
 *
 * Se comprueban en ese orden a propósito: el más general primero, para que
 * un proveedor bloqueado reciba "estás bloqueado" y no "esa factura ya
 * existe", que le diría algo que no necesita saber sobre el sistema.
 */

const INCLUDE_FACTURA = {
  empresa: { select: { id: true, nombre: true } },
  proveedor: { select: { id: true, nombre: true, rfc: true, dias_credito: true } },
  observaciones: { orderBy: { creado_en: 'desc' } },
  complemento: true,
};

/* Prisma devuelve Decimal como objeto. Sale como CADENA con dos decimales
 * fijos, nunca como número: "1160.00".
 *
 * Cadena, porque un `number` de JavaScript no representa exactamente todos
 * los importes y lo que aquí viaja es dinero. Y `toFixed(2)` en vez de
 * `toString()`, porque este último recorta los ceros finales y devolvería
 * "1160" —que al pintarlo se lee como si faltaran los centavos—. */
function serializarFactura(factura) {
  if (!factura) return factura;
  return { ...factura, total: factura.total != null ? factura.total.toFixed(2) : null };
}

/* ── Alcance ──────────────────────────────────────────────────────────
 * Un proveedor solo existe para sí mismo. El id de la URL no decide nada:
 * quien manda es `req.usuario.proveedor_id`, que `verificarToken` lee de la
 * base en cada petición (constitución §3). */
function fueraDeAlcance(usuario, proveedorId) {
  return usuario.rol === 'proveedor' && usuario.proveedor_id !== proveedorId;
}

/** Factura pagada más antigua sin complemento: la que bloquea al proveedor.
 *  FIFO — se salda la más vieja primero (plan §6). */
function facturaQueBloquea(proveedorId) {
  return prisma.facturas.findFirst({
    where: { proveedor_id: proveedorId, pago_realizado: true, complemento: { is: null } },
    orderBy: { fecha_pago_marcado: 'asc' },
    select: { id: true, uuid_fiscal: true, serie_folio: true, fecha_pago_marcado: true },
  });
}

/** Los tres frenos, en orden. Devuelve null si puede subir, o { status, error }. */
async function motivoParaNoFacturar(proveedor) {
  if (proveedor.bloqueado_facturar) {
    return {
      status: 403,
      error: proveedor.motivo_bloqueo
        ? `Tienes la facturación bloqueada: ${proveedor.motivo_bloqueo}. Contacta al administrador.`
        : 'Tienes la facturación bloqueada. Contacta al administrador.',
    };
  }

  const bloqueante = await facturaQueBloquea(proveedor.id);
  if (bloqueante) {
    const referencia = bloqueante.serie_folio || bloqueante.uuid_fiscal;
    return {
      status: 409,
      error: `Sube el complemento de pago de la factura ${referencia} antes de subir otra.`,
      factura_bloqueante: bloqueante.id,
    };
  }

  return null;
}

/* ── POST /api/proveedores/:id/facturas ──────────────────────────────── */
async function subirFactura(req, res) {
  const proveedorId = parseInt(req.params.id);
  const archivos = req.archivos;   // los dejó el middleware subirFactura()

  // Cualquier salida que no sea un 201 tiene que llevarse por delante los dos
  // archivos: si no, `uploads/` acumula facturas que ninguna fila menciona.
  const limpiar = () => borrarArchivos([archivos?.xml?.filename, archivos?.pdf?.filename]);

  if (Number.isNaN(proveedorId)) {
    await limpiar();
    return res.status(400).json({ error: 'Identificador de proveedor inválido' });
  }
  if (fueraDeAlcance(req.usuario, proveedorId)) {
    await limpiar();
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  try {
    const proveedor = await prisma.proveedores.findUnique({ where: { id: proveedorId } });
    if (!proveedor) {
      await limpiar();
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    /* Los frenos aplican al proveedor que sube. El administrador puede subir
     * en su nombre (alta asistida por teléfono) y no se le bloquea: si él
     * mismo puso el bloqueo, sabe lo que hace. */
    if (req.usuario.rol === 'proveedor') {
      const freno = await motivoParaNoFacturar(proveedor);
      if (freno) {
        await limpiar();
        // `status` es de uso interno: no forma parte de la respuesta.
        const { status, ...cuerpo } = freno;
        return res.status(status).json(cuerpo);
      }
    }

    // Empresa: obligatoria al crear (spec 000 HU-2). Se valida contra el
    // catálogo en vez de confiar en el número que llegue del navegador.
    const empresaId = parseInt(req.body?.empresa_id);
    if (Number.isNaN(empresaId)) {
      await limpiar();
      return res.status(400).json({ error: 'Indica a qué empresa se factura' });
    }
    const empresa = await prisma.empresas.findUnique({ where: { id: empresaId } });
    if (!empresa || !empresa.activo) {
      await limpiar();
      return res.status(400).json({ error: 'La empresa indicada no existe o está dada de baja' });
    }

    // Lectura del CFDI. El buffer viene del middleware: no se relee el disco.
    let cfdi;
    try {
      cfdi = parsearCFDI(archivos.xml.buffer);
    } catch (e) {
      await limpiar();
      if (e instanceof ErrorCFDI) return res.status(400).json({ error: e.message });
      throw e;
    }

    /* Anti-duplicado (HU-2). La comprobación previa existe para dar un
     * mensaje decente; la garantía de verdad es el índice único, que es lo
     * único que aguanta dos subidas simultáneas del mismo folio. */
    const yaExiste = await prisma.facturas.findUnique({
      where: { uuid_fiscal: cfdi.uuid },
      select: { id: true, proveedor_id: true, creado_en: true },
    });
    if (yaExiste) {
      await limpiar();
      return res.status(409).json({
        error: `La factura con folio fiscal ${cfdi.uuid} ya está registrada en el sistema.`,
        uuid_fiscal: cfdi.uuid,
      });
    }

    const factura = await prisma.facturas.create({
      data: {
        proveedor_id: proveedorId,
        empresa_id: empresa.id,
        uuid_fiscal: cfdi.uuid,
        rfc_emisor: cfdi.rfcEmisor,
        rfc_receptor: cfdi.rfcReceptor,
        total: cfdi.total,
        fecha_cfdi: cfdi.fecha,
        serie_folio: cfdi.serieFolio,
        moneda: cfdi.moneda,
        estado: 'pendiente',
        ruta_xml: archivos.xml.filename,
        ruta_pdf: archivos.pdf.filename,
        nombre_xml: archivos.xml.originalname,
        nombre_pdf: archivos.pdf.originalname,
        subido_por: req.usuario.id,
      },
      include: INCLUDE_FACTURA,
    });

    res.status(201).json(serializarFactura(factura));
  } catch (e) {
    await limpiar();
    // Carrera perdida contra otra subida del mismo folio: el índice único la
    // corta aquí. Mismo mensaje que la comprobación previa.
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'La factura con ese folio fiscal ya está registrada en el sistema.' });
    }
    console.error('Error al subir factura:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/proveedores/:id/facturas ───────────────────────────────── */
async function listarPorProveedor(req, res) {
  const proveedorId = parseInt(req.params.id);
  if (Number.isNaN(proveedorId)) return res.status(400).json({ error: 'Identificador inválido' });
  if (fueraDeAlcance(req.usuario, proveedorId)) return res.status(403).json({ error: 'Acceso denegado' });

  const where = { proveedor_id: proveedorId };
  if (['pendiente', 'aprobado', 'desaprobado'].includes(req.query.estado)) {
    where.estado = req.query.estado;
  }
  const empresaId = parseInt(req.query.empresa);
  if (!Number.isNaN(empresaId)) where.empresa_id = empresaId;

  try {
    const facturas = await prisma.facturas.findMany({
      where,
      include: INCLUDE_FACTURA,
      orderBy: { creado_en: 'desc' },
    });

    // El proveedor necesita saber si está frenado ANTES de preparar otra
    // factura: la pantalla desactiva el botón con este dato.
    const bloqueante = await facturaQueBloquea(proveedorId);

    res.json({
      facturas: facturas.map(serializarFactura),
      complemento_pendiente: bloqueante ? { id: bloqueante.id, referencia: bloqueante.serie_folio || bloqueante.uuid_fiscal } : null,
    });
  } catch (e) {
    console.error('Error al listar facturas:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/facturas/:facturaId ────────────────────────────────────── */
async function obtener(req, res) {
  const id = parseInt(req.params.facturaId);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const factura = await prisma.facturas.findUnique({ where: { id }, include: INCLUDE_FACTURA });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    if (fueraDeAlcance(req.usuario, factura.proveedor_id)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Los nombres de quienes escribieron observaciones, en una sola consulta.
    const autores = [...new Set(factura.observaciones.map((o) => o.autor_id))];
    const usuarios = autores.length
      ? await prisma.usuarios.findMany({ where: { id: { in: autores } }, select: { id: true, nombre: true } })
      : [];
    const nombrePorId = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

    res.json(serializarFactura({
      ...factura,
      observaciones: factura.observaciones.map((o) => ({ ...o, autor: nombrePorId[o.autor_id] ?? null })),
    }));
  } catch (e) {
    console.error('Error al obtener factura:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/facturas/:facturaId/xml | /pdf ─────────────────────────── */
// Sirve el archivo verificando el alcance. `inline=1` lo entrega para verlo
// en el visor; sin el parámetro, se descarga.
function descargarArchivo(campo) {
  return async function (req, res) {
    const id = parseInt(req.params.facturaId);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

    const esComplemento = req.query.complemento === '1';

    try {
      const factura = await prisma.facturas.findUnique({
        where: { id },
        select: {
          proveedor_id: true,
          ruta_xml: true, ruta_pdf: true, nombre_xml: true, nombre_pdf: true,
          complemento: { select: { ruta_xml: true, ruta_pdf: true, nombre_xml: true, nombre_pdf: true } },
        },
      });
      if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
      if (fueraDeAlcance(req.usuario, factura.proveedor_id)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const fuente = esComplemento ? factura.complemento : factura;
      if (!fuente) return res.status(404).json({ error: 'Esta factura no tiene complemento de pago' });

      const ruta = campo === 'xml' ? fuente.ruta_xml : fuente.ruta_pdf;
      const nombre = campo === 'xml' ? fuente.nombre_xml : fuente.nombre_pdf;

      const rutaCompleta = path.join(UPLOADS_DIR, ruta);
      if (!fs.existsSync(rutaCompleta)) {
        return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
      }

      if (req.query.inline === '1') {
        /* El XML se sirve como texto plano, nunca como application/xml: si el
         * navegador lo trata como XML puede seguir referencias de estilo y
         * ejecutar lo que traiga dentro. Aquí solo se va a mostrar el texto.
         * `nosniff` impide además que adivine el tipo por su cuenta. */
        res.setHeader('Content-Type', campo === 'xml' ? 'text/plain; charset=utf-8' : 'application/pdf');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
        return res.sendFile(rutaCompleta);
      }

      return res.download(rutaCompleta, nombre);
    } catch (e) {
      console.error('Error al servir archivo de factura:', e);
      res.status(500).json({ error: 'Error al descargar el archivo' });
    }
  };
}


/* ── PATCH /api/facturas/:facturaId/estado (administrador) ───────────
 * Aprobar o rechazar. El rechazo EXIGE observación (HU-3): "rechazada" a
 * secas obliga al proveedor a llamar por teléfono para saber qué corregir,
 * y es lo que esta regla existe para evitar.
 *
 * Aprobar fija `fecha_aprobacion`, que es lo que arranca el conteo de días
 * de crédito y mete la factura en el resumen semanal. */
async function actualizarEstado(req, res) {
  const id = parseInt(req.params.facturaId);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const { estado } = req.body || {};
  const ESTADOS = ['pendiente', 'aprobado', 'desaprobado'];
  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}` });
  }

  const observacion = typeof req.body?.observacion === 'string' ? req.body.observacion.trim() : '';
  if (estado === 'desaprobado' && !observacion) {
    return res.status(400).json({ error: 'Para rechazar una factura hay que escribir el motivo.' });
  }
  if (observacion.length > OBSERVACION_MAX) {
    return res.status(400).json({ error: `La observación no puede exceder ${OBSERVACION_MAX} caracteres` });
  }

  try {
    const actual = await prisma.facturas.findUnique({
      where: { id },
      select: { id: true, estado: true, pago_realizado: true, fecha_aprobacion: true },
    });
    if (!actual) return res.status(404).json({ error: 'Factura no encontrada' });

    /* Una factura ya pagada no se puede desaprobar: el dinero salió, y
     * cambiarle el estado dejaría el resumen semanal contando algo que no
     * concuerda con lo que se pagó. Para eso está la observación. */
    if (actual.pago_realizado && estado !== 'aprobado') {
      return res.status(409).json({
        error: 'Esta factura ya está marcada como pagada; su estado no puede cambiarse. Deja una observación si hay algo que aclarar.',
      });
    }

    const factura = await prisma.$transaction(async (tx) => {
      if (observacion) {
        await tx.observaciones_documento.create({
          data: { factura_id: id, texto: observacion, autor_id: req.usuario.id },
        });
      }

      return tx.facturas.update({
        where: { id },
        data: {
          estado,
          aprobado_por: estado === 'pendiente' ? null : req.usuario.id,
          /* La fecha de aprobación es la del visto bueno VIGENTE, y de ella
           * cuelga la fecha de pago. Dos matices:
           *
           *  · Aprobar algo ya aprobado no la mueve (`?? new Date()`): un
           *    doble clic o una reaprobación de trámite no deben correr el
           *    pago del proveedor unos días.
           *  · Rechazar la borra, así que aprobar DESPUÉS de un rechazo
           *    pone fecha nueva. Es lo correcto: si el visto bueno se
           *    retiró, el plazo de crédito no puede seguir contando desde
           *    una aprobación que dejó de existir. */
          fecha_aprobacion: estado === 'aprobado'
            ? (actual.fecha_aprobacion ?? new Date())
            : null,
        },
        include: INCLUDE_FACTURA,
      });
    });

    res.json(serializarFactura(factura));
  } catch (e) {
    console.error('Error al actualizar estado de factura:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/facturas/:facturaId/observaciones (administrador) ──────
 * Añadir una nota sin cambiar el estado. El historial es solo de añadir:
 * una observación no se edita ni se borra, porque es justo lo que hace
 * auditable la relación con el proveedor. */
async function agregarObservacion(req, res) {
  const id = parseInt(req.params.facturaId);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto) return res.status(400).json({ error: 'La observación no puede estar vacía' });
  if (texto.length > OBSERVACION_MAX) {
    return res.status(400).json({ error: `La observación no puede exceder ${OBSERVACION_MAX} caracteres` });
  }

  try {
    const existe = await prisma.facturas.findUnique({ where: { id }, select: { id: true } });
    if (!existe) return res.status(404).json({ error: 'Factura no encontrada' });

    const observacion = await prisma.observaciones_documento.create({
      data: { factura_id: id, texto, autor_id: req.usuario.id },
    });

    res.status(201).json({ ...observacion, autor: req.usuario.nombre });
  } catch (e) {
    console.error('Error al agregar observación:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── PATCH /api/facturas/:facturaId/pago (administrador) ──────────────
 * Marca que la factura ya se pagó (HU-4). No mueve dinero: registra que se
 * movió fuera del sistema, y eso es lo que dispara la obligación del
 * proveedor de subir el complemento de pago.
 *
 * Es reversible mientras no haya complemento: marcar un pago por error y no
 * poder deshacerlo dejaría al proveedor bloqueado sin salida. */
async function marcarPago(req, res) {
  const id = parseInt(req.params.facturaId);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const pagado = req.body?.pagado !== false;   // por omisión, marcar como pagada

  try {
    const actual = await prisma.facturas.findUnique({
      where: { id },
      select: { id: true, estado: true, pago_realizado: true, complemento: { select: { id: true } } },
    });
    if (!actual) return res.status(404).json({ error: 'Factura no encontrada' });

    // Solo se paga lo aprobado: pagar una factura rechazada o sin revisar es
    // un error de operación que el sistema puede evitar.
    if (pagado && actual.estado !== 'aprobado') {
      return res.status(409).json({ error: 'Solo se puede marcar el pago de una factura aprobada.' });
    }
    if (!pagado && actual.complemento) {
      return res.status(409).json({
        error: 'Esta factura ya tiene complemento de pago: no se puede deshacer el pago.',
      });
    }

    const factura = await prisma.facturas.update({
      where: { id },
      data: {
        pago_realizado: pagado,
        fecha_pago_marcado: pagado ? (actual.pago_realizado ? undefined : new Date()) : null,
      },
      include: INCLUDE_FACTURA,
    });

    res.json(serializarFactura(factura));
  } catch (e) {
    console.error('Error al marcar pago:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/facturas/:facturaId/complemento ────────────────────────
 * El complemento de pago (XML+PDF) que cierra el ciclo fiscal de una
 * factura ya pagada. Subirlo libera el bloqueo del proveedor. */
async function subirComplemento(req, res) {
  const id = parseInt(req.params.facturaId);
  const archivos = req.archivos;
  const limpiar = () => borrarArchivos([archivos?.xml?.filename, archivos?.pdf?.filename]);

  if (Number.isNaN(id)) {
    await limpiar();
    return res.status(400).json({ error: 'Identificador inválido' });
  }

  try {
    const factura = await prisma.facturas.findUnique({
      where: { id },
      select: {
        id: true, proveedor_id: true, pago_realizado: true, serie_folio: true, uuid_fiscal: true,
        complemento: { select: { id: true } },
      },
    });
    if (!factura) {
      await limpiar();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    if (fueraDeAlcance(req.usuario, factura.proveedor_id)) {
      await limpiar();
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (!factura.pago_realizado) {
      await limpiar();
      return res.status(409).json({
        error: 'El complemento de pago se sube cuando el administrador marca la factura como pagada.',
      });
    }
    if (factura.complemento) {
      await limpiar();
      return res.status(409).json({ error: 'Esta factura ya tiene su complemento de pago.' });
    }

    /* El complemento también es un CFDI timbrado, pero se es más indulgente
     * que con la factura: si el XML no trae timbre se guarda igual con
     * uuid null y el administrador lo rechaza a mano. Perder el documento
     * sería peor que archivarlo mal. */
    let uuid = null;
    try {
      uuid = parsearCFDI(archivos.xml.buffer).uuid;
    } catch (e) {
      if (!(e instanceof ErrorCFDI)) {
        await limpiar();
        throw e;
      }
    }

    if (uuid) {
      const repetido = await prisma.complementos_pago.findUnique({ where: { uuid_fiscal: uuid } });
      if (repetido) {
        await limpiar();
        return res.status(409).json({ error: `El complemento con folio fiscal ${uuid} ya está registrado.` });
      }
    }

    const complemento = await prisma.complementos_pago.create({
      data: {
        factura_id: factura.id,
        uuid_fiscal: uuid,
        ruta_xml: archivos.xml.filename,
        ruta_pdf: archivos.pdf.filename,
        nombre_xml: archivos.xml.originalname,
        nombre_pdf: archivos.pdf.originalname,
        estado: 'pendiente',
        subido_por: req.usuario.id,
      },
    });

    res.status(201).json(complemento);
  } catch (e) {
    await limpiar();
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Ese complemento de pago ya está registrado.' });
    }
    console.error('Error al subir complemento:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── PATCH /api/facturas/:facturaId/complemento/estado (administrador) ─ */
// El complemento se aprueba o rechaza igual que la factura. Rechazarlo NO
// vuelve a bloquear al proveedor: el documento ya está, lo que falta es que
// lo corrija, y eso se le dice con la observación.
async function actualizarEstadoComplemento(req, res) {
  const id = parseInt(req.params.facturaId);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Identificador inválido' });

  const { estado } = req.body || {};
  const ESTADOS = ['pendiente', 'aprobado', 'desaprobado'];
  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}` });
  }

  const observacion = typeof req.body?.observacion === 'string' ? req.body.observacion.trim() : '';
  if (estado === 'desaprobado' && !observacion) {
    return res.status(400).json({ error: 'Para rechazar un complemento hay que escribir el motivo.' });
  }

  try {
    const complemento = await prisma.complementos_pago.findUnique({ where: { factura_id: id } });
    if (!complemento) return res.status(404).json({ error: 'Esta factura no tiene complemento de pago' });

    const actualizado = await prisma.$transaction(async (tx) => {
      if (observacion) {
        await tx.observaciones_documento.create({
          data: { factura_id: id, texto: `[Complemento] ${observacion}`.slice(0, OBSERVACION_MAX), autor_id: req.usuario.id },
        });
      }
      return tx.complementos_pago.update({ where: { factura_id: id }, data: { estado } });
    });

    res.json(actualizado);
  } catch (e) {
    console.error('Error al actualizar estado del complemento:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}


/* ── GET /api/facturas/resumen (administrador) ────────────────────────
 * Resumen semanal de facturas APROBADAS (spec 001 HU-9), en JSON o como
 * archivo descargable. Los tres formatos salen del mismo cálculo, que es lo
 * que garantiza que el Excel y el PDF digan lo mismo que la pantalla.
 *
 *   ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&empresa=<id>&formato=json|xlsx|pdf
 *
 * El rango se aplica sobre `fecha_aprobacion`, no sobre la fecha del CFDI:
 * lo que el resumen responde es "qué autorizamos a pagar esta semana", y una
 * factura de hace un mes aprobada el martes entra en la semana del martes.
 */
async function resumen(req, res) {
  const { desde, hasta } = rangoSemana(req.query.desde, req.query.hasta);
  if (!desde) {
    return res.status(400).json({ error: 'Las fechas deben tener el formato YYYY-MM-DD' });
  }
  if (desde > hasta) {
    return res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final' });
  }

  const formato = req.query.formato || 'json';
  if (!['json', 'xlsx', 'pdf'].includes(formato)) {
    return res.status(400).json({ error: 'Formato inválido. Valores permitidos: json, xlsx, pdf' });
  }

  const where = {
    estado: 'aprobado',
    fecha_aprobacion: { gte: limiteDia(desde, 'inicio'), lte: limiteDia(hasta, 'fin') },
  };

  let nombreEmpresa = null;
  const empresaId = parseInt(req.query.empresa);
  if (!Number.isNaN(empresaId)) {
    const empresa = await prisma.empresas.findUnique({ where: { id: empresaId }, select: { nombre: true } });
    if (!empresa) return res.status(400).json({ error: 'La empresa indicada no existe' });
    where.empresa_id = empresaId;
    nombreEmpresa = empresa.nombre;
  }

  try {
    const facturas = await prisma.facturas.findMany({
      where,
      include: {
        proveedor: { select: { id: true, nombre: true, rfc: true, dias_credito: true } },
        empresa: { select: { id: true, nombre: true } },
        complemento: { select: { id: true, estado: true } },
      },
      orderBy: [{ fecha_aprobacion: 'asc' }, { id: 'asc' }],
    });

    const datos = construirResumen(facturas);
    const meta = { empresa: nombreEmpresa, desde, hasta };

    if (formato === 'json') {
      return res.json({ ...datos, periodo: { desde, hasta }, empresa: nombreEmpresa });
    }

    /* La exportación respeta el filtro activo y lo dice en el encabezado
     * (spec 000 HU-3): un Excel sin empresa ni periodo impresos es un Excel
     * que nadie puede volver a situar dos semanas después. */
    const archivo = formato === 'xlsx' ? await aExcel(datos, meta) : await aPDF(datos, meta);
    const nombre = nombreArchivo(meta, formato);

    res.setHeader('Content-Type', formato === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(archivo);
  } catch (e) {
    console.error('Error al generar el resumen de facturas:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* Rango del resumen. Sin parámetros, la semana natural en curso (lunes a
 * domingo), que es la unidad en la que el negocio programa los pagos. */
function rangoSemana(desdeQuery, hastaQuery) {
  const RE = /^\d{4}-\d{2}-\d{2}$/;

  if (desdeQuery || hastaQuery) {
    if (!RE.test(desdeQuery || '') || !RE.test(hastaQuery || '')) return { desde: null, hasta: null };
    return { desde: desdeQuery, hasta: hastaQuery };
  }

  const hoy = new Date();
  const diaSemana = (hoy.getDay() + 6) % 7;   // 0 = lunes
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diaSemana);
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  return { desde: aFechaISO(lunes), hasta: aFechaISO(domingo) };
}

/* 'YYYY-MM-DD' al instante local que abre o cierra ese día. Construir la
 * fecha con `new Date('2026-09-01')` la interpretaría como UTC y en México
 * dejaría fuera las aprobaciones de la mañana del primer día. */
function limiteDia(iso, extremo) {
  const [a, m, d] = iso.split('-').map(Number);
  return extremo === 'inicio'
    ? new Date(a, m - 1, d, 0, 0, 0, 0)
    : new Date(a, m - 1, d, 23, 59, 59, 999);
}

module.exports = {
  subirFactura,
  listarPorProveedor,
  obtener,
  actualizarEstado,
  agregarObservacion,
  marcarPago,
  subirComplemento,
  actualizarEstadoComplemento,
  resumen,
  descargarXml: descargarArchivo('xml'),
  descargarPdf: descargarArchivo('pdf'),
  serializarFactura,
  facturaQueBloquea,
  fueraDeAlcance,
  INCLUDE_FACTURA,
  OBSERVACION_MAX,
};
