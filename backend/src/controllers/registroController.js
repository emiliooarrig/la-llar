const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN = 8;
const VIGENCIA_HORAS = 72;
const NOMBRE_MAX = 150;

// RFC mexicano: 3 letras (moral) o 4 (física) + 6 dígitos de fecha + 3 de
// homoclave. Mismo criterio que el catálogo de proveedores.
const RE_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Alta de proveedores por link de invitación (spec 001 HU-1).
 *
 * El administrador genera un link, se lo pasa al proveedor por el canal que
 * sea, y el proveedor se da de alta solo. Esto sustituye al alta manual, en
 * la que el administrador tecleaba el RFC de otro y se inventaba una
 * contraseña que luego viajaba por WhatsApp.
 *
 * ── Por qué se guarda el hash del token y no el token ────────────────
 * La tabla `invitaciones_proveedor` es tan legible como cualquier otra para
 * quien tenga acceso a la base, a un respaldo o a un volcado de depuración.
 * Un token en claro ahí dentro es una cuenta de proveedor de regalo. Se
 * guarda su SHA-256 y el original solo existe en la URL que el administrador
 * copia: si se pierde, se genera otra invitación, no se recupera esta.
 *
 * SHA-256 a secas —sin bcrypt— es lo correcto aquí, al contrario que con las
 * contraseñas: el token son 256 bits aleatorios, no algo que una persona
 * pueda recordar, así que no hay diccionario que probar y el coste de
 * derivación no aporta nada.
 */

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Compara en tiempo constante. La comparación la hace la BD por índice, así
 *  que esto es para el camino en que ya tenemos las dos cadenas. */
function igualSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function urlDeRegistro(token) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  return `${base}/registro/${token}`;
}

/* ── POST /api/proveedores/invitaciones (administrador) ─────────────── */
async function crearInvitacion(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email && !RE_EMAIL.test(email)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }

  const horas = Number(req.body?.vigencia_horas ?? VIGENCIA_HORAS);
  if (!Number.isInteger(horas) || horas < 1 || horas > 720) {
    return res.status(400).json({ error: 'La vigencia debe ser un número de horas entre 1 y 720' });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expira_en = new Date(Date.now() + horas * 60 * 60 * 1000);

    const invitacion = await prisma.invitaciones_proveedor.create({
      data: {
        token_hash: hashToken(token),
        email: email || null,
        creada_por: req.usuario.id,
        expira_en,
      },
    });

    /* El token viaja UNA vez, aquí. No hay endpoint que lo devuelva después
     * porque no se guarda en claro en ningún sitio. */
    res.status(201).json({
      id: invitacion.id,
      url: urlDeRegistro(token),
      email: invitacion.email,
      expira_en: invitacion.expira_en,
    });
  } catch (e) {
    console.error('Error al crear invitación:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/proveedores/invitaciones (administrador) ──────────────── */
// Historial de invitaciones para saber cuáles siguen vivas. Nunca incluye el
// token: solo su estado.
async function listarInvitaciones(_req, res) {
  try {
    const invitaciones = await prisma.invitaciones_proveedor.findMany({
      orderBy: { creado_en: 'desc' },
      take: 100,
      select: { id: true, email: true, expira_en: true, usado_en: true, creado_en: true, creada_por: true },
    });

    const ahora = new Date();
    res.json(invitaciones.map((i) => ({
      ...i,
      estado: i.usado_en ? 'usada' : i.expira_en < ahora ? 'expirada' : 'vigente',
    })));
  } catch (e) {
    console.error('Error al listar invitaciones:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* Busca la invitación de un token y dice por qué no sirve, si no sirve.
 * Devuelve { invitacion } o { error, status }. */
async function resolverInvitacion(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    return { error: 'El link de registro no es válido.', status: 404 };
  }

  const invitacion = await prisma.invitaciones_proveedor.findUnique({
    where: { token_hash: hashToken(token) },
  });

  // Mismo mensaje para "no existe" y "token mal formado": no se confirma a un
  // desconocido si un token concreto existió alguna vez.
  if (!invitacion || !igualSeguro(invitacion.token_hash, hashToken(token))) {
    return { error: 'El link de registro no es válido.', status: 404 };
  }

  if (invitacion.usado_en) {
    return {
      error: 'Este link ya se usó para crear una cuenta. Pide al administrador uno nuevo.',
      status: 410,
    };
  }
  if (invitacion.expira_en < new Date()) {
    return {
      error: 'Este link de registro venció. Pide al administrador uno nuevo.',
      status: 410,
    };
  }

  return { invitacion };
}

/* ── GET /api/registro/:token (público) ─────────────────────────────── */
// La página de registro pregunta antes de pintar el formulario, para no
// hacer teclear treinta campos y fallar al enviar.
async function validarToken(req, res) {
  try {
    const { invitacion, error, status } = await resolverInvitacion(req.params.token);
    if (error) return res.status(status).json({ error });

    res.json({ ok: true, email: invitacion.email, expira_en: invitacion.expira_en });
  } catch (e) {
    console.error('Error al validar token de registro:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* Valida el formulario de alta. Devuelve { error } o los datos saneados. */
function validarDatosRegistro({ nombre, rfc, email, password }) {
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!nombreLimpio) return { error: 'El nombre o razón social es requerido' };
  if (nombreLimpio.length > NOMBRE_MAX) {
    return { error: `El nombre no puede exceder ${NOMBRE_MAX} caracteres` };
  }

  const rfcLimpio = typeof rfc === 'string' ? rfc.trim().toUpperCase() : '';
  if (!rfcLimpio) return { error: 'El RFC es requerido' };
  if (!RE_RFC.test(rfcLimpio)) {
    return { error: 'El RFC no tiene un formato válido (12 o 13 caracteres)' };
  }

  const emailLimpio = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!emailLimpio) return { error: 'El correo es requerido' };
  if (!RE_EMAIL.test(emailLimpio)) {
    return { error: 'El correo no tiene un formato válido' };
  }

  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return { error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` };
  }

  return { nombre: nombreLimpio, rfc: rfcLimpio, email: emailLimpio, password };
}

/* ── POST /api/registro/:token (público) ────────────────────────────── */
async function registrar(req, res) {
  const datos = validarDatosRegistro(req.body || {});
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const { invitacion, error, status } = await resolverInvitacion(req.params.token);
    if (error) return res.status(status).json({ error });

    /* Todo o nada: proveedor, usuario y consumo del token. Sin transacción,
     * un fallo a mitad dejaría un proveedor sin acceso o —peor— un token
     * consumido sin cuenta, y el proveedor se quedaría fuera con un link
     * que ya no sirve. */
    const creado = await prisma.$transaction(async (tx) => {
      /* El consumo del token va PRIMERO y condicionado a que siga sin usar.
       * Dos envíos simultáneos del mismo formulario: el segundo actualiza 0
       * filas y aborta. Es la garantía de "un solo uso" que una lectura
       * previa no puede dar. */
      const consumido = await tx.invitaciones_proveedor.updateMany({
        where: { id: invitacion.id, usado_en: null },
        data: { usado_en: new Date() },
      });
      if (consumido.count === 0) {
        throw Object.assign(new Error('token consumido'), { codigo: 'TOKEN_USADO' });
      }

      const duplicado = await tx.proveedores.findUnique({ where: { rfc: datos.rfc } });
      if (duplicado) {
        throw Object.assign(new Error('rfc duplicado'), { codigo: 'RFC_DUPLICADO' });
      }

      const correoTomado = await tx.usuarios.findUnique({ where: { email: datos.email } });
      if (correoTomado) {
        throw Object.assign(new Error('email duplicado'), { codigo: 'EMAIL_DUPLICADO' });
      }

      const proveedor = await tx.proveedores.create({
        data: { nombre: datos.nombre, rfc: datos.rfc },
      });

      const usuario = await tx.usuarios.create({
        data: {
          nombre: datos.nombre,
          email: datos.email,
          password: await bcrypt.hash(datos.password, BCRYPT_ROUNDS),
          rol: 'proveedor',
          activo: true,
          proveedor_id: proveedor.id,
        },
      });

      return { proveedor, usuario };
    });

    /* No se devuelve sesión iniciada: que el proveedor entre por el login
     * con lo que acaba de elegir confirma que la contraseña quedó bien y
     * deja un solo camino de entrada al sistema. */
    res.status(201).json({
      ok: true,
      proveedor: { id: creado.proveedor.id, nombre: creado.proveedor.nombre, rfc: creado.proveedor.rfc },
      email: creado.usuario.email,
    });
  } catch (e) {
    if (e.codigo === 'TOKEN_USADO') {
      return res.status(410).json({ error: 'Este link ya se usó para crear una cuenta. Pide al administrador uno nuevo.' });
    }
    if (e.codigo === 'RFC_DUPLICADO' || (e.code === 'P2002' && String(e.meta?.target).includes('rfc'))) {
      return res.status(409).json({ error: 'Ya existe un proveedor registrado con ese RFC. Contacta al administrador.' });
    }
    if (e.codigo === 'EMAIL_DUPLICADO' || (e.code === 'P2002' && String(e.meta?.target).includes('email'))) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Usa otro o recupera tu acceso con el administrador.' });
    }
    console.error('Error al registrar proveedor:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  crearInvitacion,
  listarInvitaciones,
  validarToken,
  registrar,
  hashToken,
  validarDatosRegistro,
  VIGENCIA_HORAS,
};
