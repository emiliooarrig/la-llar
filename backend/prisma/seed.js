require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

/* ── Seed de producción ───────────────────────────────────
 * Deja el sistema listo para el despliegue: únicamente el usuario
 * administrador (para el primer acceso) y las ventanas de carga en su
 * estado inicial (cerradas). El resto de los datos —sucursales, empleados,
 * proveedores, usuarios, documentos y asistencias— se crea desde la propia
 * aplicación una vez en operación. */
async function main() {
  /* Admin: único acceso inicial. Cambiar la contraseña tras el primer login. */
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@lallar.com';
  const passwordPlano = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
  const hashAdmin = await bcrypt.hash(passwordPlano, 10);

  const admin = await prisma.usuarios.upsert({
    where: { email },
    update: {},
    create: { nombre: 'Administrador', email, password: hashAdmin, rol: 'administrador' },
  });
  console.log('Admin:', admin.email);

  /* Ventanas de carga en su estado inicial (cerradas). */
  await prisma.ventanas_carga.upsert({ where: { modulo: 'proveedores' }, update: {}, create: { modulo: 'proveedores', abierta: false } });
  await prisma.ventanas_carga.upsert({ where: { modulo: 'unidades' },    update: {}, create: { modulo: 'unidades',    abierta: false } });
  await prisma.ventanas_carga.upsert({ where: { modulo: 'asistencias' }, update: {}, create: { modulo: 'asistencias', abierta: false } });
  console.log('Ventanas de carga inicializadas (cerradas).');

  console.log('Seed de producción completado.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
