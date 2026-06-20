require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/* ── Helpers ──────────────────────────────────────────── */
async function upsertSucursal(nombre) {
  let s = await prisma.sucursales.findFirst({ where: { nombre } });
  if (!s) s = await prisma.sucursales.create({ data: { nombre } });
  return s;
}

async function upsertProveedor(nombre, rfc) {
  let p = await prisma.proveedores.findFirst({ where: { nombre } });
  if (!p) p = await prisma.proveedores.create({ data: { nombre, rfc } });
  return p;
}

function crearArchivoPDF(titulo) {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${uuidv4()}.pdf`;
  const contenido = `%PDF-1.4 Demo\n% Documento: ${titulo}\n% Generado: ${new Date().toISOString()}\n% Este es un archivo de muestra para el sistema La Llar.`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), contenido);
  return filename;
}

/* ── Main ─────────────────────────────────────────────── */
async function main() {
  /* Admin */
  const hashAdmin = await bcrypt.hash('Admin1234!', 10);
  const admin = await prisma.usuarios.upsert({
    where: { email: 'admin@lallar.com' },
    update: {},
    create: { nombre: 'Administrador', email: 'admin@lallar.com', password: hashAdmin, rol: 'administrador' },
  });
  console.log('Admin:', admin.email);

  /* Ventanas de carga */
  await prisma.ventanas_carga.upsert({ where: { modulo: 'proveedores' }, update: {}, create: { modulo: 'proveedores', abierta: false } });
  await prisma.ventanas_carga.upsert({ where: { modulo: 'unidades' }, update: {}, create: { modulo: 'unidades', abierta: false } });

  /* Sucursales */
  const central  = await upsertSucursal('Cocina Central');
  const norte    = await upsertSucursal('Sucursal Norte');
  const sur      = await upsertSucursal('Sucursal Sur');
  const oriente  = await upsertSucursal('Sucursal Oriente');
  console.log('Sucursales: 4');

  /* Empleados */
  const empleadosData = [
    { nombre: 'Ana García Martínez',    lector_uid: 'UID001', sucursal_id: central.id,  activo: true  },
    { nombre: 'Luis Hernández López',   lector_uid: 'UID002', sucursal_id: central.id,  activo: true  },
    { nombre: 'María Torres Ruiz',      lector_uid: 'UID003', sucursal_id: norte.id,    activo: true  },
    { nombre: 'Carlos Mendoza Vega',    lector_uid: 'UID004', sucursal_id: norte.id,    activo: true  },
    { nombre: 'Sofía Ramírez Castro',   lector_uid: 'UID005', sucursal_id: sur.id,      activo: true  },
    { nombre: 'Javier Morales Fuentes', lector_uid: 'UID006', sucursal_id: sur.id,      activo: true  },
    { nombre: 'Patricia Jiménez Reyes', lector_uid: 'UID007', sucursal_id: oriente.id,  activo: true  },
    { nombre: 'Roberto Sánchez Díaz',   lector_uid: 'UID008', sucursal_id: oriente.id,  activo: true  },
    { nombre: 'Elena Vargas Núñez',     lector_uid: 'UID009', sucursal_id: central.id,  activo: false },
    { nombre: 'Diego Peña Aguilar',     lector_uid: 'UID010', sucursal_id: norte.id,    activo: true  },
    { nombre: 'Gabriela Ríos Castillo', lector_uid: 'UID011', sucursal_id: sur.id,      activo: true  },
    { nombre: 'Fernando López Guzmán',  lector_uid: 'UID012', sucursal_id: oriente.id,  activo: true  },
  ];
  for (const d of empleadosData) {
    await prisma.empleados.upsert({ where: { lector_uid: d.lector_uid }, update: {}, create: d });
  }
  console.log('Empleados: 12');

  /* Proveedores */
  const prov1 = await upsertProveedor('Distribuidora Alimentos del Norte SA de CV', 'DAN210301ABC');
  const prov2 = await upsertProveedor('Carnes y Embutidos Hernández',               'CEH180615XYZ');
  const prov3 = await upsertProveedor('Verduras Orgánicas del Valle',                'VOV200815JKL');
  const prov4 = await upsertProveedor('Lácteos La Fuente',                           'LLF190420MNO');
  console.log('Proveedores: 4');

  /* Usuarios proveedor */
  const hashProv = await bcrypt.hash('Prov1234!', 10);
  const usuariosProv = [
    { email: 'norte@distribuidora.com',  nombre: 'Distribuidora Norte',   proveedor_id: prov1.id },
    { email: 'hernandez@carnes.com',     nombre: 'Carnes Hernández',       proveedor_id: prov2.id },
    { email: 'contacto@verdurvallle.com', nombre: 'Verduras del Valle',    proveedor_id: prov3.id },
    { email: 'ventas@lacteoslafuente.com', nombre: 'Lácteos La Fuente',    proveedor_id: prov4.id },
  ];
  for (const u of usuariosProv) {
    await prisma.usuarios.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: hashProv, rol: 'proveedor' },
    });
  }
  console.log('Usuarios proveedor: 4');

  /* Usuarios gerente (uno por sucursal) */
  const hashGerente = await bcrypt.hash('Gerente1234!', 10);
  const usuariosGerente = [
    { email: 'gerente.central@lallar.com', nombre: 'Gerente Cocina Central', sucursal_id: central.id },
    { email: 'gerente.norte@lallar.com',   nombre: 'Gerente Sucursal Norte', sucursal_id: norte.id },
    { email: 'gerente.sur@lallar.com',     nombre: 'Gerente Sucursal Sur',   sucursal_id: sur.id },
    { email: 'gerente.oriente@lallar.com', nombre: 'Gerente Sucursal Oriente', sucursal_id: oriente.id },
  ];
  for (const u of usuariosGerente) {
    await prisma.usuarios.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: hashGerente, rol: 'gerente' },
    });
  }
  console.log('Usuarios gerente: 4');

  /* Documentos de muestra */
  const docsDef = [
    // Prov 1 – Distribuidora del Norte
    { proveedor: prov1, titulo: 'Contrato_Suministro_2025.pdf',   estado: 'aprobado'     },
    { proveedor: prov1, titulo: 'Facturas_Enero_2025.pdf',         estado: 'pendiente'    },
    { proveedor: prov1, titulo: 'Acta_Constitutiva.pdf',           estado: 'aprobado'     },
    // Prov 2 – Carnes Hernández
    { proveedor: prov2, titulo: 'Carta_Presentacion.pdf',          estado: 'pendiente'    },
    { proveedor: prov2, titulo: 'Certificado_Sanitario_2025.pdf',  estado: 'desaprobado'  },
    // Prov 3 – Verduras del Valle (sin docs → muestra estado vacío)
    // Prov 4 – Lácteos
    { proveedor: prov4, titulo: 'Propuesta_Comercial_2025.pdf',    estado: 'pendiente'    },
  ];

  for (const def of docsDef) {
    const existe = await prisma.documentos_proveedor.findFirst({
      where: { proveedor_id: def.proveedor.id, nombre_original: def.titulo },
    });
    if (!existe) {
      const filename = crearArchivoPDF(def.titulo);
      await prisma.documentos_proveedor.create({
        data: {
          proveedor_id:    def.proveedor.id,
          nombre_original: def.titulo,
          ruta_archivo:    filename,
          tipo_mime:       'application/pdf',
          subido_por:      admin.id,
          estado:          def.estado,
        },
      });
    }
  }
  console.log(`Documentos de muestra: ${docsDef.length}`);

  /* Documentos de unidad de muestra */
  const docsUnidadDef = [
    // Cocina Central
    { sucursal: central, titulo: 'Inventario_Cocina_Central.pdf',   estado: 'aprobado'    },
    { sucursal: central, titulo: 'Bitacora_Limpieza_Enero.pdf',     estado: 'pendiente'   },
    // Sucursal Norte
    { sucursal: norte,   titulo: 'Permiso_Funcionamiento_Norte.pdf', estado: 'aprobado'   },
    { sucursal: norte,   titulo: 'Control_Temperaturas_Norte.pdf',   estado: 'desaprobado' },
    // Sucursal Sur (sin docs → muestra estado vacío)
    // Sucursal Oriente
    { sucursal: oriente, titulo: 'Acta_Fumigacion_Oriente.pdf',      estado: 'pendiente'   },
  ];

  for (const def of docsUnidadDef) {
    const existe = await prisma.documentos_unidad.findFirst({
      where: { sucursal_id: def.sucursal.id, nombre_original: def.titulo },
    });
    if (!existe) {
      const filename = crearArchivoPDF(def.titulo);
      await prisma.documentos_unidad.create({
        data: {
          sucursal_id:     def.sucursal.id,
          nombre_original: def.titulo,
          ruta_archivo:    filename,
          tipo_mime:       'application/pdf',
          subido_por:      admin.id,
          estado:          def.estado,
        },
      });
    }
  }
  console.log(`Documentos de unidad de muestra: ${docsUnidadDef.length}`);

  /* Asistencias + justificaciones de prueba (mayo 2026) */
  await generarAsistencias(admin);

  console.log('Seed completado.');
}

/* ── Asistencias de demostración ──────────────────────────
 * Genera un mes completo (mayo 2026) para tres empleados, con
 * distintos escenarios: jornada normal, día incompleto, semana de
 * vacaciones y periodo de incapacidad. Las marcas se guardan como
 * "hora de pared" en UTC (Date.UTC) para que se muestren sin
 * desplazamiento por zona horaria. */
async function generarAsistencias(admin) {
  const AÑO = 2026;
  const MES = 5; // mayo

  const ana   = await prisma.empleados.findUnique({ where: { lector_uid: 'UID001' } });
  const luis  = await prisma.empleados.findUnique({ where: { lector_uid: 'UID002' } });
  const maria = await prisma.empleados.findUnique({ where: { lector_uid: 'UID003' } });
  const objetivos = [ana, luis, maria].filter(Boolean);
  if (objetivos.length === 0) { console.log('Asistencias: sin empleados objetivo, se omite'); return; }

  const inicio = new Date(Date.UTC(AÑO, MES - 1, 1));
  const fin = new Date(Date.UTC(AÑO, MES, 1));
  const ids = objetivos.map(e => e.id);

  // Limpieza idempotente del mes para esos empleados.
  await prisma.asistencias.deleteMany({ where: { empleado_id: { in: ids }, timestamp: { gte: inicio, lt: fin } } });
  await prisma.justificaciones.deleteMany({ where: { empleado_id: { in: ids }, fecha: { gte: '2026-05-01', lte: '2026-05-31' } } });
  await prisma.correcciones_asistencia.deleteMany({ where: { empleado_id: { in: ids }, fecha: { gte: '2026-05-01', lte: '2026-05-31' } } });

  const diasEnMes = new Date(AÑO, MES, 0).getDate();
  const punches = [];
  const justifs = [];

  // jitter determinista (±minutos) según día, sin azar para reproducibilidad
  const jitter = (dia, semilla) => ((dia * 7 + semilla * 13) % 11) - 5;
  const clampMin = (min) => Math.min(59, Math.max(0, min));
  const reloj = (h, min) => `${String(h).padStart(2, '0')}:${String(clampMin(min)).padStart(2, '0')}`;
  const ts = (dia, hora) => {
    const [h, m] = hora.split(':').map(Number);
    return new Date(Date.UTC(AÑO, MES - 1, dia, h, m, 0));
  };
  const fechaStr = (dia) => `2026-05-${String(dia).padStart(2, '0')}`;
  const agregarJornada = (emp, dia, hEntrada, mEntrada, hSalida, mSalida) => {
    punches.push({ empleado_id: emp.id, sucursal_id: emp.sucursal_id, tipo: 'entrada', timestamp: ts(dia, reloj(hEntrada, mEntrada)) });
    punches.push({ empleado_id: emp.id, sucursal_id: emp.sucursal_id, tipo: 'salida',  timestamp: ts(dia, reloj(hSalida, mSalida)) });
  };

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const finde = [0, 6].includes(new Date(AÑO, MES - 1, dia).getDay());
    if (finde) continue;

    // Ana (UID001): jornada normal todo el mes, con un día incompleto.
    if (dia === 8) {
      // solo registró entrada (olvidó marcar salida) → incompleta
      punches.push({ empleado_id: ana.id, sucursal_id: ana.sucursal_id, tipo: 'entrada', timestamp: ts(dia, reloj(8, 3)) });
    } else {
      const j = jitter(dia, 1);
      agregarJornada(ana, dia, 8, 5 + j, 17, 5 + j);
    }

    // Luis (UID002): normal salvo semana de vacaciones (19–23 may).
    if (dia >= 19 && dia <= 23) {
      justifs.push({ empleado_id: luis.id, fecha: fechaStr(dia), tipo: 'vacaciones', nota: 'Vacaciones programadas', creado_por: admin.id });
    } else {
      const j = jitter(dia, 2);
      agregarJornada(luis, dia, 7, 55 + j, 16, 55 + j);
    }

    // María (UID003): incapacidad médica del 12 al 16 de mayo.
    if (dia >= 12 && dia <= 16) {
      justifs.push({ empleado_id: maria.id, fecha: fechaStr(dia), tipo: 'incapacidad', nota: 'Incapacidad IMSS folio 8842-26', creado_por: admin.id });
    } else {
      const j = jitter(dia, 3);
      agregarJornada(maria, dia, 9, 2 + j, 18, 5 + j);
    }
  }

  if (punches.length) await prisma.asistencias.createMany({ data: punches });
  if (justifs.length) await prisma.justificaciones.createMany({ data: justifs });
  console.log(`Asistencias: ${punches.length} marcas, ${justifs.length} justificaciones (mayo 2026)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
