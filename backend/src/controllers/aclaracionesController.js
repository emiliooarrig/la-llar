const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { UPLOADS_DIR, borrarArchivos } = require('../middleware/upload');

const prisma = new PrismaClient();

/* Aclaraciones de proveedores (spec 003).
 *
 * Una aclaración es un hilo: un asunto, los documentos sobre los que trata y
 * las notas que se cruzan proveedor y administración hasta resolverlo. Existe
 * para que la duda sobre una factura se resuelva DENTRO del sistema, con los
 * documentos a la vista, y no por correo con adjuntos que nadie encuentra
 * después.
 *
 * Tres reglas:
 *   1. Un proveedor solo existe para sí mismo: ve y escribe en SUS
 *      aclaraciones, y solo puede referenciar SUS documentos.
 *   2. Se abre sobre al menos un documento que ya existe (factura o
 *      complemento); la empresa se hereda de él.
 *   3. Solo el administrador la cierra, y cerrada es de solo lectura: toda
 *      escritura responde 409.
 *
 * La aclaración no toca los documentos que referencia: ni su estado de
 * aprobación ni sus archivos. Eso vive en la spec 001.
 */

const ASUNTO_MAX = 200;
const NOTA_MAX = 1000;
// Un tope para que un cliente no pueda mandar diez mil referencias en una
// petición. Una aclaración real habla de una factura, a lo sumo de unas pocas.
const DOCUMENTOS_MAX = 20;

// Orígenes que se REFERENCIAN al abrir. `soporte` no está: se sube dentro de
// la aclaración ya abierta, con su propio endpoint.
const ORIGENES_REFERENCIABLES = ['factura', 'complemento'];

const INCLUDE_RESUMEN = {
  proveedor: { select: { id: true, nombre: true, rfc: true } },
  empresa: { select: { id: true, nombre: true } },
  _count: { select: { documentos: true, notas: true } },
};

/* ── Alcance ──────────────────────────────────────────────────────────
 * El proveedor sale de `req.usuario.proveedor_id`, que `verificarToken` lee
 * de la base en cada petición, nunca del cuerpo ni de la URL (constitución
 * §3). */
const esAdmin = (usuario) => usuario.rol === 'administrador';

function fueraDeAlcance(usuario, proveedorId) {
  return usuario.rol === 'proveedor' && usuario.proveedor_id !== proveedorId;
}

function parsearId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Nombres de usuarios por id, en una sola consulta. Las columnas de autor
 *  no tienen FK declarada (mismo patrón que observaciones y vales). */
async function nombresDeUsuarios(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return {};
  const usuarios = await prisma.usuarios.findMany({
    where: { id: { in: unicos } },
    select: { id: true, nombre: true, rol: true },
  });
  return Object.fromEntries(usuarios.map((u) => [u.id, u]));
}

/* Middleware: carga la aclaración de `:id`, comprueba el alcance y la deja
 * en `req.aclaracion`. Va ANTES de multer en la ruta de adjuntar, para que
 * un proveedor ajeno o una aclaración cerrada se rechacen sin haber escrito
 * un solo byte en disco.
 *
 * `{ escritura: true }` además exige que siga abierta. */
function cargarAclaracion({ escritura = false } = {}) {
  return async function (req, res, next) {
    const id = parsearId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identificador inválido' });

    try {
      const aclaracion = await prisma.aclaraciones.findUnique({
        where: { id },
        select: { id: true, proveedor_id: true, empresa_id: true, estado: true },
      });
      if (!aclaracion) return res.status(404).json({ error: 'Aclaración no encontrada' });
      if (fueraDeAlcance(req.usuario, aclaracion.proveedor_id)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      if (escritura && aclaracion.estado === 'cerrada') {
        return res.status(409).json({
          error: 'Esta aclaración está cerrada y ya no admite cambios. Si el asunto sigue, abre una nueva.',
        });
      }
      req.aclaracion = aclaracion;
      next();
    } catch (e) {
      console.error('Error al cargar la aclaración:', e);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
}

/* Valida y normaliza la lista de documentos que llega al abrir. Devuelve
 * `{ error }` o `{ referencias: [{ origen, origen_id }] }` sin duplicados. */
function normalizarReferencias(lista) {
  if (!Array.isArray(lista) || lista.length === 0) {
    return { error: 'Indica al menos un documento (factura o complemento) sobre el que trata la aclaración.' };
  }
  if (lista.length > DOCUMENTOS_MAX) {
    return { error: `Una aclaración admite como máximo ${DOCUMENTOS_MAX} documentos.` };
  }

  const vistos = new Set();
  const referencias = [];
  for (const item of lista) {
    const origen = item?.origen;
    const origenId = parsearId(item?.origen_id);
    if (!ORIGENES_REFERENCIABLES.includes(origen) || !origenId) {
      return { error: 'Cada documento debe indicar su tipo (factura o complemento) y su identificador.' };
    }
    const clave = `${origen}:${origenId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    referencias.push({ origen, origen_id: origenId });
  }
  return { referencias };
}

/* Resuelve cada referencia a su dueño y su empresa. Una referencia
 * polimórfica no tiene FK que lo garantice, así que es aquí donde se decide
 * que el documento existe y de quién es (plan §6).
 *
 * El complemento no tiene empresa ni proveedor propios: los hereda de su
 * factura. */
async function resolverReferencias(referencias) {
  const idsFactura = referencias.filter((r) => r.origen === 'factura').map((r) => r.origen_id);
  const idsComplemento = referencias.filter((r) => r.origen === 'complemento').map((r) => r.origen_id);

  const [facturas, complementos] = await Promise.all([
    idsFactura.length
      ? prisma.facturas.findMany({
          where: { id: { in: idsFactura } },
          select: { id: true, proveedor_id: true, empresa_id: true },
        })
      : [],
    idsComplemento.length
      ? prisma.complementos_pago.findMany({
          where: { id: { in: idsComplemento } },
          select: { id: true, factura: { select: { proveedor_id: true, empresa_id: true } } },
        })
      : [],
  ]);

  const facturaPorId = new Map(facturas.map((f) => [f.id, f]));
  const complementoPorId = new Map(complementos.map((c) => [c.id, c.factura]));

  return referencias.map((r) => ({
    ...r,
    dueno: r.origen === 'factura' ? facturaPorId.get(r.origen_id) : complementoPorId.get(r.origen_id),
  }));
}

/* Arma el detalle de los documentos de una aclaración: para cada referencia,
 * lo mínimo para reconocerla en pantalla (folio, total, estado) y el id de
 * la factura con el que el visor pide sus archivos a /api/facturas, que ya
 * verifica el alcance por su cuenta. */
async function detalleDocumentos(documentos) {
  const idsFactura = documentos.filter((d) => d.origen === 'factura').map((d) => d.origen_id);
  const idsComplemento = documentos.filter((d) => d.origen === 'complemento').map((d) => d.origen_id);

  const [facturas, complementos] = await Promise.all([
    idsFactura.length
      ? prisma.facturas.findMany({
          where: { id: { in: idsFactura } },
          select: { id: true, serie_folio: true, uuid_fiscal: true, total: true, estado: true, creado_en: true },
        })
      : [],
    idsComplemento.length
      ? prisma.complementos_pago.findMany({
          where: { id: { in: idsComplemento } },
          select: {
            id: true, factura_id: true, uuid_fiscal: true, estado: true, creado_en: true,
            factura: { select: { serie_folio: true, uuid_fiscal: true } },
          },
        })
      : [],
  ]);

  const facturaPorId = new Map(facturas.map((f) => [f.id, f]));
  const complementoPorId = new Map(complementos.map((c) => [c.id, c]));

  return documentos.map((d) => {
    const base = {
      id: d.id,
      origen: d.origen,
      origen_id: d.origen_id,
      subido_por: d.subido_por,
      creado_en: d.creado_en,
    };

    if (d.origen === 'factura') {
      const f = facturaPorId.get(d.origen_id);
      if (!f) return { ...base, disponible: false };
      return {
        ...base,
        disponible: true,
        factura_id: f.id,
        serie_folio: f.serie_folio,
        uuid_fiscal: f.uuid_fiscal,
        total: f.total != null ? f.total.toFixed(2) : null,
        estado_documento: f.estado,
      };
    }

    if (d.origen === 'complemento') {
      const c = complementoPorId.get(d.origen_id);
      if (!c) return { ...base, disponible: false };
      return {
        ...base,
        disponible: true,
        factura_id: c.factura_id,
        serie_folio: c.factura?.serie_folio ?? null,
        uuid_fiscal: c.uuid_fiscal,
        uuid_factura: c.factura?.uuid_fiscal ?? null,
        estado_documento: c.estado,
      };
    }

    // Soporte: el archivo es de la aclaración. No se expone la ruta en
    // disco, solo lo que hace falta para pedirlo y nombrarlo.
    return {
      ...base,
      disponible: true,
      nombre_original: d.nombre_original,
      tipo_mime: d.tipo_mime,
    };
  });
}

/* ── POST /api/aclaraciones ───────────────────────────────────────────
 * Abrir una aclaración (HU-1). Cuerpo:
 *   { asunto, nota_inicial, documentos: [{ origen, origen_id }] }
 *
 * El proveedor abre sobre sus propios documentos. El administrador también
 * puede abrirla —p. ej. para pedir una explicación— y entonces el proveedor
 * se deduce de los documentos, no se elige: así es imposible abrir a nombre
 * de un proveedor una aclaración sobre la factura de otro. */
async function crear(req, res) {
  const asunto = String(req.body?.asunto ?? '').trim();
  const nota = String(req.body?.nota_inicial ?? '').trim();

  if (!asunto) return res.status(400).json({ error: 'Escribe el asunto de la aclaración.' });
  if (asunto.length > ASUNTO_MAX) {
    return res.status(400).json({ error: `El asunto admite como máximo ${ASUNTO_MAX} caracteres.` });
  }
  if (!nota) return res.status(400).json({ error: 'Explica en una nota qué necesitas aclarar.' });
  if (nota.length > NOTA_MAX) {
    return res.status(400).json({ error: `La nota admite como máximo ${NOTA_MAX} caracteres.` });
  }

  const { error, referencias } = normalizarReferencias(req.body?.documentos);
  if (error) return res.status(400).json({ error });

  try {
    const resueltas = await resolverReferencias(referencias);

    if (resueltas.some((r) => !r.dueno)) {
      return res.status(404).json({ error: 'Alguno de los documentos indicados no existe.' });
    }

    /* Un proveedor que referencia un documento ajeno recibe 403, no 404: el
     * documento existe y lo que falla es que no es suyo. */
    if (resueltas.some((r) => fueraDeAlcance(req.usuario, r.dueno.proveedor_id))) {
      return res.status(403).json({ error: 'Solo puedes abrir aclaraciones sobre tus propios documentos.' });
    }

    const proveedores = new Set(resueltas.map((r) => r.dueno.proveedor_id));
    if (proveedores.size > 1) {
      return res.status(400).json({ error: 'Todos los documentos de una aclaración deben ser del mismo proveedor.' });
    }

    /* La empresa se hereda (spec 003 §5), y una aclaración tiene una sola:
     * mezclar una factura a La Llar con otra a Confia sería mezclar dos
     * asuntos de dos razones sociales distintas. */
    const empresas = new Set(resueltas.map((r) => r.dueno.empresa_id));
    if (empresas.size > 1) {
      return res.status(400).json({
        error: 'Los documentos son de empresas distintas. Abre una aclaración por empresa.',
      });
    }

    const creada = await prisma.aclaraciones.create({
      data: {
        proveedor_id: [...proveedores][0],
        empresa_id: [...empresas][0],
        asunto,
        creado_por: req.usuario.id,
        documentos: {
          create: resueltas.map((r) => ({
            origen: r.origen,
            origen_id: r.origen_id,
            subido_por: req.usuario.id,
          })),
        },
        notas: { create: { texto: nota, autor_id: req.usuario.id } },
      },
      include: INCLUDE_RESUMEN,
    });

    res.status(201).json(creada);
  } catch (e) {
    console.error('Error al abrir la aclaración:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/aclaraciones ────────────────────────────────────────────
 * Proveedor: solo las suyas, siempre. Administrador: todas, con filtros
 * opcionales ?estado= ?empresa_id= ?proveedor_id=.
 *
 * Las abiertas van primero: son las que piden algo a alguien. */
async function listar(req, res) {
  const where = {};

  if (!esAdmin(req.usuario)) {
    where.proveedor_id = req.usuario.proveedor_id;
  } else if (req.query.proveedor_id) {
    const id = parsearId(req.query.proveedor_id);
    if (!id) return res.status(400).json({ error: 'Proveedor inválido' });
    where.proveedor_id = id;
  }

  if (req.query.estado) {
    if (!['abierta', 'cerrada'].includes(req.query.estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    where.estado = req.query.estado;
  }

  if (req.query.empresa_id) {
    const id = parsearId(req.query.empresa_id);
    if (!id) return res.status(400).json({ error: 'Empresa inválida' });
    where.empresa_id = id;
  }

  try {
    const aclaraciones = await prisma.aclaraciones.findMany({
      where,
      include: {
        ...INCLUDE_RESUMEN,
        // La última nota dice quién tiene la pelota: si la escribió el
        // proveedor, le toca responder a la administración, y viceversa.
        notas: { orderBy: { creado_en: 'desc' }, take: 1, select: { autor_id: true, creado_en: true } },
      },
      orderBy: [{ estado: 'asc' }, { creado_en: 'desc' }],
    });

    const autores = await nombresDeUsuarios(aclaraciones.map((a) => a.notas[0]?.autor_id));

    res.json(aclaraciones.map(({ notas, ...a }) => {
      const ultima = notas[0];
      return {
        ...a,
        ultima_actividad: ultima?.creado_en ?? a.creado_en,
        ultima_nota_rol: ultima ? autores[ultima.autor_id]?.rol ?? null : null,
      };
    }));
  } catch (e) {
    console.error('Error al listar aclaraciones:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/aclaraciones/:id ────────────────────────────────────────
 * Detalle (HU-2): documentos y notas juntos. El alcance ya lo comprobó
 * `cargarAclaracion`. */
async function obtener(req, res) {
  try {
    const aclaracion = await prisma.aclaraciones.findUnique({
      where: { id: req.aclaracion.id },
      include: {
        ...INCLUDE_RESUMEN,
        documentos: { orderBy: { creado_en: 'asc' } },
        notas: { orderBy: { creado_en: 'asc' } },
      },
    });

    const usuarios = await nombresDeUsuarios([
      aclaracion.creado_por,
      aclaracion.cerrada_por,
      ...aclaracion.notas.map((n) => n.autor_id),
      ...aclaracion.documentos.map((d) => d.subido_por),
    ]);
    const nombre = (id) => usuarios[id]?.nombre ?? null;

    const documentos = await detalleDocumentos(aclaracion.documentos);

    res.json({
      ...aclaracion,
      creado_por_nombre: nombre(aclaracion.creado_por),
      cerrada_por_nombre: nombre(aclaracion.cerrada_por),
      documentos: documentos.map((d) => ({ ...d, subido_por_nombre: nombre(d.subido_por) })),
      notas: aclaracion.notas.map((n) => ({
        ...n,
        autor: nombre(n.autor_id),
        autor_rol: usuarios[n.autor_id]?.rol ?? null,
      })),
    });
  } catch (e) {
    console.error('Error al obtener la aclaración:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/aclaraciones/:id/notas ─────────────────────────────────
 * Agregar una nota al hilo (HU-3). Queda con autor y fecha; nunca se edita
 * ni se borra. */
async function agregarNota(req, res) {
  const texto = String(req.body?.texto ?? '').trim();
  if (!texto) return res.status(400).json({ error: 'La nota no puede ir vacía.' });
  if (texto.length > NOTA_MAX) {
    return res.status(400).json({ error: `La nota admite como máximo ${NOTA_MAX} caracteres.` });
  }

  try {
    const nota = await prisma.aclaracion_notas.create({
      data: { aclaracion_id: req.aclaracion.id, texto, autor_id: req.usuario.id },
    });
    res.status(201).json({ ...nota, autor: req.usuario.nombre, autor_rol: req.usuario.rol });
  } catch (e) {
    console.error('Error al agregar la nota:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── POST /api/aclaraciones/:id/documentos ────────────────────────────
 * Adjuntar un archivo de soporte (spec 003 §7: el proveedor puede adjuntar,
 * validado con el mismo `upload.js`). El alcance y el estado ya se
 * comprobaron antes de que multer escribiera nada; aquí solo se registra. */
async function adjuntarSoporte(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

  try {
    const doc = await prisma.aclaracion_documentos.create({
      data: {
        aclaracion_id: req.aclaracion.id,
        origen: 'soporte',
        ruta_archivo: req.file.filename,
        nombre_original: req.file.originalname.slice(0, 255),
        tipo_mime: req.file.mimetype,
        subido_por: req.usuario.id,
      },
    });

    const { ruta_archivo, ...publico } = doc;
    res.status(201).json({ ...publico, disponible: true, subido_por_nombre: req.usuario.nombre });
  } catch (e) {
    // Sin fila que lo mencione, el archivo sería basura en uploads/.
    await borrarArchivos([req.file.filename]);
    console.error('Error al adjuntar el soporte:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/aclaraciones/:id/documentos/:docId/archivo ──────────────
 * Sirve un archivo de soporte. Las facturas y complementos referenciados NO
 * pasan por aquí: se piden a /api/facturas, que es su dueño y ya comprueba
 * el alcance. `inline=1` para el visor; sin él, descarga. */
async function descargarSoporte(req, res) {
  const docId = parsearId(req.params.docId);
  if (!docId) return res.status(400).json({ error: 'Identificador inválido' });

  try {
    const doc = await prisma.aclaracion_documentos.findFirst({
      where: { id: docId, aclaracion_id: req.aclaracion.id, origen: 'soporte' },
    });
    if (!doc || !doc.ruta_archivo) return res.status(404).json({ error: 'Documento no encontrado' });

    const ruta = path.join(UPLOADS_DIR, doc.ruta_archivo);
    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }

    // Inline solo para PDF: es lo único que el visor sabe enseñar. Un Excel
    // o un Word se descargan siempre.
    if (req.query.inline === '1' && doc.tipo_mime === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nombre_original)}"`);
      return res.sendFile(ruta);
    }
    return res.download(ruta, doc.nombre_original);
  } catch (e) {
    console.error('Error al servir el soporte de la aclaración:', e);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}

/* ── PATCH /api/aclaraciones/:id/cerrar (administrador) ───────────────
 * Cierra la aclaración (HU-3). Acepta una nota de cierre opcional —la
 * resolución—, que se guarda en la misma transacción: sin ella, el proveedor
 * vería el hilo cerrado sin saber en qué quedó. */
async function cerrar(req, res) {
  const nota = String(req.body?.nota ?? '').trim();
  if (nota.length > NOTA_MAX) {
    return res.status(400).json({ error: `La nota admite como máximo ${NOTA_MAX} caracteres.` });
  }

  try {
    /* `updateMany` con el estado en el filtro: si dos administradores
     * cierran a la vez, solo uno lo consigue y el otro recibe 409, en vez de
     * pisarse el `cerrada_por`. */
    const cerrada = await prisma.$transaction(async (tx) => {
      const { count } = await tx.aclaraciones.updateMany({
        where: { id: req.aclaracion.id, estado: 'abierta' },
        data: { estado: 'cerrada', cerrada_por: req.usuario.id, cerrada_en: new Date() },
      });
      if (count === 0) return null;
      if (nota) {
        await tx.aclaracion_notas.create({
          data: { aclaracion_id: req.aclaracion.id, texto: nota, autor_id: req.usuario.id },
        });
      }
      return tx.aclaraciones.findUnique({ where: { id: req.aclaracion.id }, include: INCLUDE_RESUMEN });
    });

    if (!cerrada) return res.status(409).json({ error: 'La aclaración ya estaba cerrada.' });
    res.json(cerrada);
  } catch (e) {
    console.error('Error al cerrar la aclaración:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  cargarAclaracion,
  crear,
  listar,
  obtener,
  agregarNota,
  adjuntarSoporte,
  descargarSoporte,
  cerrar,
  NOTA_MAX,
  ASUNTO_MAX,
};
