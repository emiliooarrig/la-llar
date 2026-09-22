/* Backfill de `empresa_id` en `sucursales`.
 *
 * La columna nació opcional para que la migración no rompiera los datos que
 * ya estaban en producción (constitución §3: toda columna nueva opcional o
 * con default). Este script es el que la deja poblada, y la spec 000 exige
 * que al terminar no quede ni una sucursal con `empresa_id` NULL.
 *
 * ── Pregunta abierta de la spec (§7) ────────────────────────────────────
 * El mapa real "qué sucursal pertenece a qué empresa" es un dato de negocio
 * que todavía nadie ha dado. En lugar de inventarlo —la constitución §10
 * prohíbe inventar reglas de negocio— el script lo lee de fuera y, para lo
 * que no venga en el mapa, aplica la empresa por defecto. Cuando el negocio
 * entregue el mapa, se corre otra vez con `--forzar` y las asignaciones
 * quedan corregidas sin tocar una línea de código.
 *
 * ── Fuentes del mapa, en orden de prioridad ─────────────────────────────
 *   1. `--mapa=<ruta.json>`            fichero JSON
 *   2. `MAPA_SUCURSAL_EMPRESA` (.env)  JSON en una variable de entorno
 *   3. `scripts/mapa_sucursales_empresas.json`, si existe
 * Formato en los tres casos: { "<nombre o id de sucursal>": "<nombre de empresa>" }
 *
 *   {
 *     "Cocina Central":  "La Llar",
 *     "Sucursal Norte":  "Confia Alimentos",
 *     "3":               "La Llar"
 *   }
 *
 * ── Uso ─────────────────────────────────────────────────────────────────
 *   node scripts/backfill_empresas_sucursales.js                 # solo rellena huecos
 *   node scripts/backfill_empresas_sucursales.js --forzar        # reasigna también las ya asignadas
 *   node scripts/backfill_empresas_sucursales.js --simular       # no escribe: enseña qué haría
 *   node scripts/backfill_empresas_sucursales.js --defecto="Confia Alimentos"
 *   node scripts/backfill_empresas_sucursales.js --mapa=./mapa.json
 *
 * Es idempotente: correrlo dos veces seguidas deja exactamente el mismo
 * estado y la segunda vez no escribe nada.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMPRESA_POR_DEFECTO = 'La Llar';
const MAPA_POR_DEFECTO = path.join(__dirname, 'mapa_sucursales_empresas.json');

/* ── Argumentos ──────────────────────────────────────────────────────── */
function leerArgumentos(argv) {
  const opciones = { forzar: false, simular: false, mapa: null, defecto: null };
  for (const arg of argv) {
    if (arg === '--forzar') opciones.forzar = true;
    else if (arg === '--simular' || arg === '--dry-run') opciones.simular = true;
    else if (arg.startsWith('--mapa=')) opciones.mapa = arg.slice('--mapa='.length);
    else if (arg.startsWith('--defecto=')) opciones.defecto = arg.slice('--defecto='.length);
    else throw new Error(`Opción no reconocida: ${arg}`);
  }
  return opciones;
}

/* ── Mapa sucursal → empresa ─────────────────────────────────────────── */
function parsearMapa(texto, origen) {
  let crudo;
  try {
    crudo = JSON.parse(texto);
  } catch (e) {
    throw new Error(`El mapa de ${origen} no es JSON válido: ${e.message}`);
  }
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error(`El mapa de ${origen} debe ser un objeto { "sucursal": "empresa" }`);
  }
  // Las claves se normalizan aquí para que el mapa pueda escribirse con la
  // ortografía que use el negocio ("cocina central") y siga casando.
  const mapa = new Map();
  for (const [sucursal, empresa] of Object.entries(crudo)) {
    if (typeof empresa !== 'string' || !empresa.trim()) {
      throw new Error(`El mapa de ${origen} asigna un valor inválido a "${sucursal}"`);
    }
    mapa.set(normalizar(sucursal), empresa.trim());
  }
  return mapa;
}

function cargarMapa(opciones) {
  if (opciones.mapa) {
    const ruta = path.resolve(opciones.mapa);
    if (!fs.existsSync(ruta)) throw new Error(`No existe el archivo de mapa: ${ruta}`);
    return { mapa: parsearMapa(fs.readFileSync(ruta, 'utf8'), ruta), origen: ruta };
  }
  if (process.env.MAPA_SUCURSAL_EMPRESA) {
    return {
      mapa: parsearMapa(process.env.MAPA_SUCURSAL_EMPRESA, 'MAPA_SUCURSAL_EMPRESA'),
      origen: 'variable de entorno MAPA_SUCURSAL_EMPRESA',
    };
  }
  if (fs.existsSync(MAPA_POR_DEFECTO)) {
    return {
      mapa: parsearMapa(fs.readFileSync(MAPA_POR_DEFECTO, 'utf8'), MAPA_POR_DEFECTO),
      origen: MAPA_POR_DEFECTO,
    };
  }
  return { mapa: new Map(), origen: null };
}

/** Sin acentos, sin espacios de sobra y en minúsculas: el mapa lo escribe una
 *  persona a mano y "Sucursal Sur " no debería fallar por un espacio. */
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/* ── Backfill ────────────────────────────────────────────────────────── */
async function main() {
  const opciones = leerArgumentos(process.argv.slice(2));
  const { mapa, origen } = cargarMapa(opciones);

  const nombreDefecto = opciones.defecto || process.env.EMPRESA_POR_DEFECTO || EMPRESA_POR_DEFECTO;

  const empresas = await prisma.empresas.findMany();
  if (empresas.length === 0) {
    throw new Error('No hay empresas en el catálogo. Corre primero `npm run db:seed`.');
  }
  const porNombre = new Map(empresas.map(e => [normalizar(e.nombre), e]));

  const empresaDefecto = porNombre.get(normalizar(nombreDefecto));
  if (!empresaDefecto) {
    throw new Error(
      `La empresa por defecto "${nombreDefecto}" no está en el catálogo. ` +
      `Disponibles: ${empresas.map(e => e.nombre).join(', ')}`
    );
  }

  // Comprobar el mapa completo ANTES de escribir: un mapa con una empresa mal
  // escrita debe abortar entero, no dejar media tabla asignada.
  for (const [sucursal, nombreEmpresa] of mapa) {
    if (!porNombre.has(normalizar(nombreEmpresa))) {
      throw new Error(
        `El mapa asigna "${sucursal}" a la empresa "${nombreEmpresa}", que no existe en el catálogo. ` +
        `Disponibles: ${empresas.map(e => e.nombre).join(', ')}`
      );
    }
  }

  const sucursales = await prisma.sucursales.findMany({ orderBy: { id: 'asc' } });

  console.log(`Mapa: ${origen || 'no se encontró ninguno (todo irá a la empresa por defecto)'}`);
  console.log(`Empresa por defecto: ${empresaDefecto.nombre}`);
  console.log(`Sucursales: ${sucursales.length}${opciones.simular ? '  · SIMULACIÓN (no se escribe nada)' : ''}`);
  console.log('');

  const resumen = { asignadas: 0, sinCambio: 0, porMapa: 0, porDefecto: 0 };

  for (const sucursal of sucursales) {
    const destino =
      porNombre.get(normalizar(mapa.get(normalizar(sucursal.nombre)) || '')) ||
      porNombre.get(normalizar(mapa.get(String(sucursal.id)) || ''));

    const deMapa = Boolean(destino);
    const empresa = destino || empresaDefecto;

    // Sin --forzar solo se rellenan huecos: el script no pisa una asignación
    // que alguien haya corregido a mano desde la base o la UI.
    const respetarExistente = sucursal.empresa_id !== null && !opciones.forzar;
    const yaCorrecta = sucursal.empresa_id === empresa.id;

    if (respetarExistente || yaCorrecta) {
      resumen.sinCambio += 1;
      const actual = empresas.find(e => e.id === sucursal.empresa_id);
      console.log(`  =  ${sucursal.nombre} → ${actual ? actual.nombre : '(sin empresa)'}  (sin cambio)`);
      continue;
    }

    if (!opciones.simular) {
      await prisma.sucursales.update({
        where: { id: sucursal.id },
        data: { empresa_id: empresa.id },
      });
    }
    resumen.asignadas += 1;
    if (deMapa) resumen.porMapa += 1; else resumen.porDefecto += 1;
    console.log(`  →  ${sucursal.nombre} → ${empresa.nombre}  (${deMapa ? 'mapa' : 'por defecto'})`);
  }

  console.log('');
  console.log(`Asignadas: ${resumen.asignadas} (${resumen.porMapa} por mapa, ${resumen.porDefecto} por defecto) · sin cambio: ${resumen.sinCambio}`);

  const huerfanas = await prisma.sucursales.count({ where: { empresa_id: null } });
  if (huerfanas > 0 && !opciones.simular) {
    throw new Error(`Quedaron ${huerfanas} sucursales sin empresa. Revisa el mapa.`);
  }
  console.log(huerfanas === 0
    ? 'Ninguna sucursal quedó sin empresa.'
    : `Simulación: quedarían ${huerfanas} sin empresa.`);

  if (resumen.porDefecto > 0) {
    console.log('');
    console.log('AVISO: hubo sucursales asignadas por defecto, no por un mapa del negocio.');
    console.log('Cuando el negocio entregue el mapa sucursal→empresa, vuelve a correr el');
    console.log('script con --forzar para corregir las asignaciones.');
  }
}

main()
  .catch(e => { console.error('\nBackfill abortado:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
