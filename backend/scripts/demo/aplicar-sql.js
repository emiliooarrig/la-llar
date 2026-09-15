#!/usr/bin/env node
/* Ejecuta un archivo .sql contra la base del proyecto usando la conexión de
 * Prisma. Existe porque el cliente `mysql` de Homebrew (9.7) no puede
 * autenticar contra este servidor: `mysql_native_password` ya no se
 * distribuye como plugin cargable.
 *
 * Uso:  node scripts/demo/aplicar-sql.js scripts/demo/demo-agosto-2026.sql
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const archivo = process.argv[2];
if (!archivo) {
  console.error('Falta la ruta del archivo .sql');
  process.exit(1);
}

/* Quita los comentarios de línea y parte en sentencias por el ';' final.
   El control de transacción lo lleva Prisma, así que START/COMMIT del
   archivo se ignoran: el lote entra entero o no entra. */
function sentencias(sql) {
  return sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !/^(START TRANSACTION|COMMIT|BEGIN)$/i.test(s.replace(/;$/, '').trim()));
}

(async () => {
  const prisma = new PrismaClient();
  const sql = fs.readFileSync(path.resolve(archivo), 'utf8');
  const lote = sentencias(sql);

  try {
    const resultados = await prisma.$transaction(
      lote.map(s => prisma.$executeRawUnsafe(s))
    );
    lote.forEach((s, i) => {
      const cabeza = s.split('\n')[0].slice(0, 72);
      console.log(`${String(resultados[i]).padStart(5)} filas  ${cabeza}…`);
    });
    console.log(`\n${lote.length} sentencias aplicadas.`);
  } catch (e) {
    console.error('\nNada se aplicó (la transacción se revirtió):\n', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
