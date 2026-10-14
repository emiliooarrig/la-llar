const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { UPLOADS_DIR, borrarArchivos } = require('../middleware/upload');

const prisma = new PrismaClient();

const CLAVE_EJEMPLO = 'ejemplo_factura';
const CLAVE_EJEMPLO_VALE = 'ejemplo_vale';

/* Ejemplos publicados: PDFs que el administrador sube para enseñar cómo
 * tiene que verse algo.
 *
 *   · Ejemplo de factura (spec 001 HU-7): lo consultan los proveedores.
 *   · Ejemplo de vale azul: lo consultan los gerentes desde el panel «Cómo
 *     funcionan los vales azules». Es el papel físico anotado, para que se
 *     vea qué secciones se llenan y cómo.
 *
 * Son plantilla, no documento de nadie: no pertenecen a ningún proveedor ni
 * a ningún vale ni entran en ningún flujo de aprobación, y por eso no viven
 * en `documentos_proveedor` ni en `vales` sino en `configuracion`.
 *
 * Se guardan como cualquier otra subida —UUID en disco, nombre original en
 * la base— y reemplazarlos borra el anterior: tener tres ejemplos antiguos
 * ocupando espacio es la forma de que algún día se sirva el equivocado.
 *
 * Los dos se comportan igual; lo único que cambia es la clave y el texto
 * de los errores, así que salen de la misma fábrica.
 */
function crearEjemplo(clave, nombre) {
  async function leer() {
    const fila = await prisma.configuracion.findUnique({ where: { clave } });
    return fila?.valor ?? null;
  }

  /* GET …/info — la pantalla pregunta primero: sin ejemplo publicado no
   * pinta el bloque, en vez de ofrecer una descarga que daría 404. */
  async function info(_req, res) {
    try {
      const ejemplo = await leer();
      if (!ejemplo) return res.json({ publicado: false });

      res.json({
        publicado: true,
        nombre_original: ejemplo.nombre_original,
        actualizado_en: ejemplo.actualizado_en,
      });
    } catch (e) {
      console.error(`Error al consultar el ejemplo de ${nombre}:`, e);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /* GET … — `inline=1` lo entrega para el visor; sin el parámetro, se
   * descarga. */
  async function descargar(req, res) {
    try {
      const ejemplo = await leer();
      if (!ejemplo) {
        return res.status(404).json({ error: `Todavía no hay un ejemplo de ${nombre} publicado.` });
      }

      const ruta = path.join(UPLOADS_DIR, ejemplo.ruta_archivo);
      if (!fs.existsSync(ruta)) {
        return res.status(404).json({ error: 'El archivo del ejemplo no está en el servidor.' });
      }

      if (req.query.inline === '1') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.sendFile(ruta);
      }
      return res.download(ruta, ejemplo.nombre_original);
    } catch (e) {
      console.error(`Error al descargar el ejemplo de ${nombre}:`, e);
      res.status(500).json({ error: 'Error al descargar el archivo' });
    }
  }

  /* PUT … (administrador) */
  async function publicar(req, res) {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    try {
      const anterior = await leer();
      const valor = {
        ruta_archivo: req.file.filename,
        nombre_original: req.file.originalname,
        actualizado_en: new Date().toISOString(),
      };

      await prisma.configuracion.upsert({
        where: { clave },
        create: { clave, valor, actualizado_por: req.usuario.id },
        update: { valor, actualizado_por: req.usuario.id },
      });

      // El anterior se borra DESPUÉS de que el nuevo esté guardado: si el
      // upsert falla, el ejemplo viejo sigue publicado en vez de desaparecer.
      if (anterior?.ruta_archivo) await borrarArchivos([anterior.ruta_archivo]);

      res.json({
        publicado: true,
        nombre_original: valor.nombre_original,
        actualizado_en: valor.actualizado_en,
      });
    } catch (e) {
      await borrarArchivos([req.file.filename]);
      console.error(`Error al publicar el ejemplo de ${nombre}:`, e);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  return { info, descargar, publicar };
}

const ejemploFactura = crearEjemplo(CLAVE_EJEMPLO, 'factura');
const ejemploVale = crearEjemplo(CLAVE_EJEMPLO_VALE, 'vale');

/* ── Reglas de asistencia (spec 004) ───────────────────────────────────
 * GET  /api/config/asistencia  — administrador y gerente (el gerente las
 *                                necesita para entender la evaluación)
 * PUT  /api/config/asistencia  — solo administrador
 *
 * Tienen su propia tabla tipada (`config_asistencia`) en vez de ir al
 * clave/valor JSON de arriba: la evaluación las lee en cada consulta y el
 * periodo es un enum que la base debe poder validar. */
const PERIODOS = ['semana', 'quincena', 'mes'];
const DEFAULT_ASISTENCIA = { tolerancia_min: 10, umbral_extra_min: 15, periodo_retardos: 'mes' };

const publicaAsistencia = (c) => ({
  tolerancia_min: c.tolerancia_min,
  umbral_extra_min: c.umbral_extra_min,
  periodo_retardos: c.periodo_retardos,
  actualizado_en: c.actualizado_en ?? null,
});

async function leerAsistencia(_req, res) {
  try {
    const fila = await prisma.config_asistencia.findUnique({ where: { id: 1 } });
    res.json(publicaAsistencia(fila ?? DEFAULT_ASISTENCIA));
  } catch (e) {
    console.error('Error al leer las reglas de asistencia:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function guardarAsistencia(req, res) {
  const tolerancia = Number(req.body?.tolerancia_min);
  const umbral = Number(req.body?.umbral_extra_min);
  const periodo = req.body?.periodo_retardos;

  // Topes de cordura: una tolerancia de 3 horas no es tolerancia, es otro
  // turno; y un umbral de extra mayor que un turno entero no dejaría contar
  // ninguna.
  if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 120) {
    return res.status(400).json({ error: 'La tolerancia debe ser un número entero de minutos entre 0 y 120.' });
  }
  if (!Number.isInteger(umbral) || umbral < 0 || umbral > 480) {
    return res.status(400).json({ error: 'El umbral de horas extra debe ser un número entero de minutos entre 0 y 480.' });
  }
  if (!PERIODOS.includes(periodo)) {
    return res.status(400).json({ error: 'El periodo de retardos debe ser semana, quincena o mes.' });
  }

  try {
    const datos = { tolerancia_min: tolerancia, umbral_extra_min: umbral, periodo_retardos: periodo, actualizado_por: req.usuario.id };
    const fila = await prisma.config_asistencia.upsert({ where: { id: 1 }, update: datos, create: { id: 1, ...datos } });
    res.json(publicaAsistencia(fila));
  } catch (e) {
    console.error('Error al guardar las reglas de asistencia:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  infoEjemploFactura: ejemploFactura.info,
  descargarEjemploFactura: ejemploFactura.descargar,
  publicarEjemploFactura: ejemploFactura.publicar,
  CLAVE_EJEMPLO,
  infoEjemploVale: ejemploVale.info,
  descargarEjemploVale: ejemploVale.descargar,
  publicarEjemploVale: ejemploVale.publicar,
  CLAVE_EJEMPLO_VALE,
  leerAsistencia, guardarAsistencia,
};
