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
  // El CFDI viaja como XML: es el comprobante fiscal de verdad, y sin él no
  // hay folio fiscal que deduplicar. Se acepta solo porque se PARSEA, nunca
  // se sirve al navegador como XML ni se transforma: ver `parsearCFDI`, que
  // desactiva entidades externas para cerrar la puerta a XXE.
  xml: {
    ext: '.xml',
    mime: 'application/xml',
    etiqueta: 'XML (.xml)',
  },
};

/* Los navegadores no se ponen de acuerdo con el MIME del XML: Chrome manda
 * 'text/xml', Firefox 'application/xml' y algunos clientes lo suben como
 * 'text/plain' o sin tipo. El MIME lo elige el cliente y no decide nada aquí
 * —decide el contenido—, así que se aceptan todos y se guarda el canónico. */
const MIMES_XML = ['application/xml', 'text/xml', 'text/plain', 'application/octet-stream'];

/* Qué formatos admite cada tipo de subida. La allowlist es POR ENDPOINT, no
 * global: que las facturas necesiten XML no es razón para que el cajón de
 * documentación genérica empiece a aceptarlo. Cada endpoint declara lo que
 * espera y todo lo demás se rechaza. */
const FORMATOS_DOCUMENTO = ['pdf', 'xlsx', 'docx']; // documentación genérica
const FORMATOS_CFDI = ['xml'];                      // el comprobante fiscal
const FORMATOS_PDF = ['pdf'];                       // representación impresa

const EXTENSIONES_PERMITIDAS = Object.values(FORMATOS).map((f) => f.ext);
const MIMES_PERMITIDOS = [...Object.values(FORMATOS).map((f) => f.mime), ...MIMES_XML];

const listaDe = (claves) => claves.map((c) => FORMATOS[c].etiqueta).join(', ');
const mensajeFormato = (claves) =>
  `Formato no permitido. Solo se aceptan archivos ${listaDe(claves)}.`;

// Mensaje del cajón genérico. Se conserva como constante exportada porque es
// el que esperan las pruebas y los controladores ya existentes.
const MENSAJE_FORMATO = mensajeFormato(FORMATOS_DOCUMENTO);

/* Firmas de contenido (magic bytes). El Content-Type y el nombre los controla
 * el cliente y son triviales de falsificar; los primeros bytes del archivo no. */
const FIRMA_PDF = Buffer.from('%PDF-', 'ascii');
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04" — base de xlsx/docx

// Dentro del ZIP de OOXML, los nombres de las entradas viajan sin comprimir en
// las cabeceras locales, así que distinguen la hoja de cálculo del documento.
const MARCA_XLSX = Buffer.from('xl/workbook.xml', 'ascii');
const MARCA_DOCX = Buffer.from('word/document.xml', 'ascii');

/* El XML no tiene magic bytes como tales: es texto. Lo que sí tiene es una
 * forma reconocible —declaración `<?xml` o directamente un elemento raíz—,
 * y eso basta para separarlo de un .exe renombrado. Se mira solo el arranque
 * del archivo, saltando el BOM de UTF-8 y los espacios de cortesía. */
const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf]);

function pareceXML(buffer) {
  let inicio = 0;
  if (buffer.subarray(0, 3).equals(BOM_UTF8)) inicio = 3;

  // Basta con los primeros bytes: un XML válido empieza por '<' casi ya.
  const cabecera = buffer.subarray(inicio, inicio + 512).toString('utf8').trimStart();
  if (!cabecera.startsWith('<')) return false;

  /* '<?xml ...' (declaración) o '<algo' / '<ns:algo' (elemento raíz, posible
   * comentario o DOCTYPE por delante).
   *
   * HTML, XHTML y SVG empiezan igual y se excluyen a mano. El SVG importa
   * más de lo que parece: es XML bien formado, así que pasaría este filtro,
   * y un `<svg onload="...">` es JavaScript ejecutable en cuanto un
   * navegador lo abra. Aquí solo se esperan comprobantes fiscales; cualquier
   * dialecto que un navegador sepa renderizar sobra. */
  if (/^<!doctype\s+(html|svg)/i.test(cabecera)) return false;
  if (/^<(html|svg|xhtml)[\s>:]/i.test(cabecera)) return false;
  if (/<svg[\s>]/i.test(cabecera)) return false;

  return /^<(\?xml[\s?]|!--|!doctype\s|[A-Za-z_][\w.-]*(:[A-Za-z_][\w.-]*)?[\s/>])/.test(cabecera);
}

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

  if (pareceXML(buffer)) return 'xml';

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
  limits: { fileSize: TAMANO_MAX, files: 2 },
});

/* Valida el contenido real y, solo si pasa, escribe el archivo en disco con un
 * nombre UUID y la extensión canónica del formato detectado. Deja `req.file`
 * con la misma forma que dejaba `diskStorage` (filename, path, mimetype), para
 * que los controladores no necesiten cambiar.
 *
 * Si el archivo no es válido: no se escribe nada en disco y se corta con 400,
 * de modo que el controlador nunca llega a insertar el registro en la BD. */
/* Valida un archivo contra la allowlist que le toca y lo escribe en disco.
 * Devuelve { error } —sin haber escrito nada— o { filename, mimetype }.
 * No responde: quien llama decide el status y, sobre todo, tiene ocasión de
 * limpiar los archivos hermanos que ya hubiera escrito. */
async function guardarSiEsValido(archivo, permitidos) {
  const formato = detectarFormato(archivo.buffer);
  if (!formato || !permitidos.includes(formato)) {
    return { error: mensajeFormato(permitidos) };
  }

  // El contenido manda: si alguien declaró PDF y subió un .docx, se rechaza en
  // vez de "corregirlo" en silencio.
  const declarado = path.extname(archivo.originalname || '').toLowerCase();
  if (declarado !== FORMATOS[formato].ext) {
    return {
      error: `El contenido del archivo no corresponde con su extensión ${declarado}. ${mensajeFormato(permitidos)}`,
    };
  }

  const filename = `${uuidv4()}${FORMATOS[formato].ext}`;
  const destino = path.join(UPLOADS_DIR, filename);

  try {
    await fs.promises.writeFile(destino, archivo.buffer);
  } catch (e) {
    console.error('Error al escribir el archivo subido:', e);
    return { error: 'No se pudo guardar el archivo', status: 500 };
  }

  return { filename, destino, mimetype: FORMATOS[formato].mime };
}

/* Borra archivos ya escritos. Se usa cuando una subida de varios ficheros
 * falla a la mitad: o entran todos, o no entra ninguno. */
async function borrarArchivos(nombres) {
  await Promise.all(
    nombres.filter(Boolean).map((n) =>
      fs.promises.unlink(path.join(UPLOADS_DIR, n)).catch(() => {})
    )
  );
}

async function persistirArchivo(req, res, next, permitidos = FORMATOS_DOCUMENTO) {
  if (!req.file) return next(); // el controlador responde "no se recibió archivo"

  const guardado = await guardarSiEsValido(req.file, permitidos);
  if (guardado.error) {
    return res.status(guardado.status || 400).json({ error: guardado.error });
  }

  req.file.filename = guardado.filename;
  req.file.path = guardado.destino;
  req.file.mimetype = guardado.mimetype; // MIME canónico, no el declarado
  delete req.file.buffer; // ya está en disco; libera memoria

  next();
}

/* Cadena completa para una subida: multer + validación de contenido + escritura.
 * Traduce los errores de multer (tamaño, formato) a un 400 con mensaje claro. */
function subirArchivo(campo, permitidos = FORMATOS_DOCUMENTO) {
  return function (req, res, next) {
    upload.single(campo)(req, res, (err) => {
      if (err) return res.status(400).json({ error: mensajeMulter(err) });
      persistirArchivo(req, res, next, permitidos);
    });
  };
}

/* Traduce los errores de multer a algo que se pueda leer sin ser programador. */
function mensajeMulter(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return 'El archivo supera el máximo de 10 MB.';
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return `No se esperaba el archivo "${err.field}". Revisa los campos del formulario.`;
  }
  return err.message;
}

/* Subida de una factura o un complemento de pago: DOS archivos en la misma
 * petición, `xml` y `pdf`, ambos obligatorios (spec 001 §5).
 *
 * Que sean obligatorios los dos es lo que obliga a tratar la subida como una
 * transacción: si el XML entra y el PDF resulta ser un ejecutable renombrado,
 * el XML ya escrito se borra antes de responder. Sin eso, `uploads/` se iría
 * llenando de mitades de facturas que ninguna fila de la base menciona.
 *
 * Deja `req.archivos = { xml: {...}, pdf: {...} }` con la misma forma que
 * `req.file`: filename, mimetype y el nombre original del cliente.
 */
const CAMPOS_FACTURA = [
  { name: 'xml', maxCount: 1 },
  { name: 'pdf', maxCount: 1 },
];

const REGLAS_FACTURA = { xml: FORMATOS_CFDI, pdf: FORMATOS_PDF };

function subirFactura() {
  const recoger = upload.fields(CAMPOS_FACTURA);

  return function (req, res, next) {
    recoger(req, res, async (err) => {
      if (err) return res.status(400).json({ error: mensajeMulter(err) });

      const faltantes = Object.keys(REGLAS_FACTURA).filter((campo) => !req.files?.[campo]?.[0]);
      if (faltantes.length > 0) {
        return res.status(400).json({
          error: faltantes.length === 2
            ? 'Una factura necesita el XML y el PDF. No se recibió ninguno de los dos.'
            : `Falta el archivo ${faltantes[0].toUpperCase()}. Una factura necesita el XML y el PDF.`,
        });
      }

      const escritos = [];
      const archivos = {};

      for (const [campo, permitidos] of Object.entries(REGLAS_FACTURA)) {
        const original = req.files[campo][0];
        const guardado = await guardarSiEsValido(original, permitidos);

        if (guardado.error) {
          await borrarArchivos(escritos);   // o entran los dos, o ninguno
          return res.status(guardado.status || 400).json({
            error: `${campo.toUpperCase()}: ${guardado.error}`,
          });
        }

        escritos.push(guardado.filename);
        archivos[campo] = {
          filename: guardado.filename,
          path: guardado.destino,
          mimetype: guardado.mimetype,
          originalname: original.originalname,
          buffer: original.buffer,   // el controlador parsea el CFDI sin releer disco
        };
      }

      req.archivos = archivos;
      next();
    });
  };
}

module.exports = {
  upload,
  subirArchivo,
  subirFactura,
  persistirArchivo,
  borrarArchivos,
  detectarFormato,
  UPLOADS_DIR,
  FORMATOS,
  FORMATOS_DOCUMENTO,
  FORMATOS_CFDI,
  FORMATOS_PDF,
  EXTENSIONES_PERMITIDAS,
  MENSAJE_FORMATO,
};
