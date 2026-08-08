const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const TAMANO_MAX = 10 * 1024 * 1024; // 10 MB

/* Únicos formatos aceptados. La extensión con la que se guarda en disco sale
 * SIEMPRE de esta tabla —nunca del nombre que manda el cliente—, y solo se usa
 * después de confirmar el contenido real del archivo. */
const FORMATOS = {
  pdf: {
    ext: '.pdf',
    mime: 'application/pdf',
    etiqueta: 'PDF',
  },
  xlsx: {
    ext: '.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    etiqueta: 'Excel (.xlsx)',
  },
  docx: {
    ext: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    etiqueta: 'Word (.docx)',
  },
};

const EXTENSIONES_PERMITIDAS = Object.values(FORMATOS).map((f) => f.ext);
const MIMES_PERMITIDOS = Object.values(FORMATOS).map((f) => f.mime);
const LISTA_FORMATOS = Object.values(FORMATOS).map((f) => f.etiqueta).join(', ');
const MENSAJE_FORMATO = `Formato no permitido. Solo se aceptan archivos ${LISTA_FORMATOS}.`;

/* Firmas de contenido (magic bytes). El Content-Type y el nombre los controla
 * el cliente y son triviales de falsificar; los primeros bytes del archivo no. */
const FIRMA_PDF = Buffer.from('%PDF-', 'ascii');
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04" — base de xlsx/docx

// Dentro del ZIP de OOXML, los nombres de las entradas viajan sin comprimir en
// las cabeceras locales, así que distinguen la hoja de cálculo del documento.
const MARCA_XLSX = Buffer.from('xl/workbook.xml', 'ascii');
const MARCA_DOCX = Buffer.from('word/document.xml', 'ascii');

/* Identifica el formato REAL a partir del contenido. Devuelve la clave de
 * FORMATOS o null si el archivo no es ninguno de los tres permitidos. */
function detectarFormato(buffer) {
  if (!buffer || buffer.length < 8) return null;

  if (buffer.subarray(0, FIRMA_PDF.length).equals(FIRMA_PDF)) return 'pdf';

  if (buffer.subarray(0, FIRMA_ZIP.length).equals(FIRMA_ZIP)) {
    if (buffer.includes(MARCA_XLSX)) return 'xlsx';
    if (buffer.includes(MARCA_DOCX)) return 'docx';
    return null; // ZIP genérico (o .pptx, .odt, un .zip a secas): se rechaza
  }

  return null;
}

/* Primer filtro, barato: extensión declarada y MIME declarado. No basta —los
 * dos los pone el cliente— pero corta el 99 % de los casos antes de leer nada.
 * La verificación que de verdad decide es la de contenido, más abajo. */
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(ext) || !MIMES_PERMITIDOS.includes(file.mimetype)) {
    return cb(new Error(MENSAJE_FORMATO), false);
  }
  cb(null, true);
};

/* El archivo se retiene en memoria (tope 10 MB) en vez de escribirse directo a
 * disco: así un archivo con extensión o contenido no permitido nunca llega a
 * crear un fichero en el servidor. Solo `persistirArchivo` escribe, y únicamente
 * después de validar el contenido. */
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: TAMANO_MAX, files: 1 },
});

/* Valida el contenido real y, solo si pasa, escribe el archivo en disco con un
 * nombre UUID y la extensión canónica del formato detectado. Deja `req.file`
 * con la misma forma que dejaba `diskStorage` (filename, path, mimetype), para
 * que los controladores no necesiten cambiar.
 *
 * Si el archivo no es válido: no se escribe nada en disco y se corta con 400,
 * de modo que el controlador nunca llega a insertar el registro en la BD. */
async function persistirArchivo(req, res, next) {
  if (!req.file) return next(); // el controlador responde "no se recibió archivo"

  const formato = detectarFormato(req.file.buffer);
  if (!formato) {
    return res.status(400).json({ error: MENSAJE_FORMATO });
  }

  // El contenido manda: si alguien declaró PDF y subió un .docx, se rechaza en
  // vez de "corregirlo" en silencio.
  const declarado = path.extname(req.file.originalname || '').toLowerCase();
  if (declarado !== FORMATOS[formato].ext) {
    return res.status(400).json({
      error: `El contenido del archivo no corresponde con su extensión ${declarado}. ${MENSAJE_FORMATO}`,
    });
  }

  const filename = `${uuidv4()}${FORMATOS[formato].ext}`;
  const destino = path.join(UPLOADS_DIR, filename);

  try {
    await fs.promises.writeFile(destino, req.file.buffer);
  } catch (e) {
    console.error('Error al escribir el archivo subido:', e);
    return res.status(500).json({ error: 'No se pudo guardar el archivo' });
  }

  req.file.filename = filename;
  req.file.path = destino;
  req.file.mimetype = FORMATOS[formato].mime; // MIME canónico, no el declarado
  delete req.file.buffer; // ya está en disco; libera memoria

  next();
}

/* Cadena completa para una subida: multer + validación de contenido + escritura.
 * Traduce los errores de multer (tamaño, formato) a un 400 con mensaje claro. */
function subirArchivo(campo) {
  return function (req, res, next) {
    upload.single(campo)(req, res, (err) => {
      if (err) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el máximo de 10 MB.'
          : err.message;
        return res.status(400).json({ error: mensaje });
      }
      persistirArchivo(req, res, next);
    });
  };
}

module.exports = {
  upload,
  subirArchivo,
  persistirArchivo,
  detectarFormato,
  UPLOADS_DIR,
  FORMATOS,
  EXTENSIONES_PERMITIDAS,
  MENSAJE_FORMATO,
};
