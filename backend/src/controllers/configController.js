const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { UPLOADS_DIR, borrarArchivos } = require('../middleware/upload');

const prisma = new PrismaClient();

const CLAVE_EJEMPLO = 'ejemplo_factura';

/* Ejemplo de factura (spec 001 HU-7).
 *
 * Un PDF que el administrador publica para enseñar a los proveedores cómo
 * tiene que verse lo que suben. Es plantilla, no documento de nadie: no
 * pertenece a ningún proveedor ni entra en ningún flujo de aprobación, y por
 * eso no vive en `documentos_proveedor` sino en `configuracion`.
 *
 * Se guarda como cualquier otra subida —UUID en disco, nombre original en la
 * base— y reemplazarlo borra el anterior: tener tres ejemplos antiguos
 * ocupando espacio es la forma de que algún día se sirva el equivocado.
 */

async function leerEjemplo() {
  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE_EJEMPLO } });
  return fila?.valor ?? null;
}

/* ── GET /api/config/ejemplo-factura/info ────────────────────────────── */
// La pantalla del proveedor pregunta primero: sin ejemplo publicado no pinta
// el bloque, en vez de ofrecer una descarga que daría 404.
async function infoEjemploFactura(_req, res) {
  try {
    const ejemplo = await leerEjemplo();
    if (!ejemplo) return res.json({ publicado: false });

    res.json({
      publicado: true,
      nombre_original: ejemplo.nombre_original,
      actualizado_en: ejemplo.actualizado_en,
    });
  } catch (e) {
    console.error('Error al consultar el ejemplo de factura:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* ── GET /api/config/ejemplo-factura ─────────────────────────────────── */
async function descargarEjemploFactura(req, res) {
  try {
    const ejemplo = await leerEjemplo();
    if (!ejemplo) {
      return res.status(404).json({ error: 'Todavía no hay un ejemplo de factura publicado.' });
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
    console.error('Error al descargar el ejemplo de factura:', e);
    res.status(500).json({ error: 'Error al descargar el archivo' });
  }
}

/* ── PUT /api/config/ejemplo-factura (administrador) ─────────────────── */
async function publicarEjemploFactura(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  try {
    const anterior = await leerEjemplo();

    await prisma.configuracion.upsert({
      where: { clave: CLAVE_EJEMPLO },
      create: {
        clave: CLAVE_EJEMPLO,
        valor: {
          ruta_archivo: req.file.filename,
          nombre_original: req.file.originalname,
          actualizado_en: new Date().toISOString(),
        },
        actualizado_por: req.usuario.id,
      },
      update: {
        valor: {
          ruta_archivo: req.file.filename,
          nombre_original: req.file.originalname,
          actualizado_en: new Date().toISOString(),
        },
        actualizado_por: req.usuario.id,
      },
    });

    // El anterior se borra DESPUÉS de que el nuevo esté guardado: si el
    // upsert falla, el ejemplo viejo sigue publicado en vez de desaparecer.
    if (anterior?.ruta_archivo) await borrarArchivos([anterior.ruta_archivo]);

    res.json({
      publicado: true,
      nombre_original: req.file.originalname,
      actualizado_en: new Date().toISOString(),
    });
  } catch (e) {
    await borrarArchivos([req.file.filename]);
    console.error('Error al publicar el ejemplo de factura:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { infoEjemploFactura, descargarEjemploFactura, publicarEjemploFactura, CLAVE_EJEMPLO };
