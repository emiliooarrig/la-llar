#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
 * Datos de PRUEBA para desarrollo local. Cubren todos los módulos.
 *
 * NO forma parte de `prisma/seed.js` ni de la demo: son datos
 * desechables que se cargan SOBRE una base ya sembrada, solo
 * insertan (nunca modifican una fila existente) y se revierten
 * exactamente, porque todo lo creado queda anotado en un
 * manifiesto (`.manifiesto.json`, junto a este archivo).
 *
 * Uso (desde backend/):
 *   node scripts/pruebas/datos-prueba.js cargar
 *   node scripts/pruebas/datos-prueba.js revertir
 *
 * Los PDF y XML se generan de verdad en `uploads/` para que los
 * visores y las descargas funcionen. La generación es determinista
 * (PRNG con semilla fija): volver a cargar produce los mismos datos.
 *
 * Contraseña de todos los usuarios nuevos: Prueba1234!
 * ───────────────────────────────────────────────────────────── */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const PdfPrinter = require('pdfmake');
const { PrismaClient } = require('@prisma/client');
const t = require('../../src/lib/tiempo');

const prisma = new PrismaClient();
const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const MANIFIESTO = path.join(__dirname, '.manifiesto.json');
const PASSWORD = 'Prueba1234!';
const HOY = t.hoyMX();
const DESDE = '2026-07-01';             // inicio de las marcas generadas

/* ── Azar determinista ─────────────────────────────────────── */
function prng(semilla) {
  let h = 1779033703 ^ semilla.length;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const azar = prng('la-llar-datos-de-prueba');
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
const probable = (p) => azar() < p;

const uuidDe = (clave) => {
  const h = crypto.createHash('sha1').update(`prueba:${clave}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const fechaHora = (fecha, hora) => new Date(`${fecha}T${hora}:00Z`); // hora de pared en UTC (convención del sistema)
const hhmm = (min) => t.deMinutos(Math.max(0, Math.min(23 * 60 + 59, min)));

/* ── Manifiesto: todo lo creado, para revertir exacto ─────── */
const creado = { archivos: [] };
function anotar(tabla, id) {
  (creado[tabla] ??= []).push(id);
  return id;
}
async function crear(tabla, data) {
  const fila = await prisma[tabla].create({ data });
  anotar(tabla, fila.id);
  return fila;
}

/* ── Archivos ──────────────────────────────────────────────── */
const printer = new PdfPrinter({ Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } });

function pdf(clave, titulo, lineas) {
  const nombre = `${uuidDe(clave)}.pdf`;
  const doc = printer.createPdfKitDocument({
    defaultStyle: { font: 'Helvetica', fontSize: 11 },
    content: [
      { text: titulo, fontSize: 16, bold: true, margin: [0, 0, 0, 10] },
      ...lineas.map((l) => ({ text: l, margin: [0, 2, 0, 2] })),
      { text: 'Documento de PRUEBA generado para desarrollo local.', italics: true, color: '#999', margin: [0, 24, 0, 0] },
    ],
  });
  return new Promise((resolve, reject) => {
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => {
      fs.writeFileSync(path.join(UPLOADS, nombre), Buffer.concat(partes));
      creado.archivos.push(nombre);
      resolve(nombre);
    });
    doc.on('error', reject);
    doc.end();
  });
}

function xmlCFDI(clave, { uuid, serie, folio, fecha, total, rfcEmisor, nombreEmisor, rfcReceptor, pago = false }) {
  const nombre = `${uuidDe(clave)}.xml`;
  const subtotal = (Number(total) / 1.16).toFixed(2);
  const contenido = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="${serie}" Folio="${folio}"
  Fecha="${fecha}T10:30:00" Moneda="${pago ? 'XXX' : 'MXN'}" SubTotal="${pago ? '0' : subtotal}" Total="${pago ? '0' : total}"
  TipoDeComprobante="${pago ? 'P' : 'I'}">
  <cfdi:Emisor Rfc="${rfcEmisor}" Nombre="${nombreEmisor}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${rfcReceptor}" UsoCFDI="G01"/>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="${uuid}" FechaTimbrado="${fecha}T10:31:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>
`;
  fs.writeFileSync(path.join(UPLOADS, nombre), contenido);
  creado.archivos.push(nombre);
  return nombre;
}

/* ════════════════════════ CARGAR ════════════════════════ */
async function cargar() {
  if (fs.existsSync(MANIFIESTO)) {
    console.error('Ya hay datos de prueba cargados (existe .manifiesto.json). Corre primero:  node scripts/pruebas/datos-prueba.js revertir');
    process.exit(1);
  }
  fs.mkdirSync(UPLOADS, { recursive: true });

  try {
    await cargarTodo();
  } finally {
    // Aunque algo falle a la mitad, lo ya creado queda anotado y se puede revertir.
    fs.writeFileSync(MANIFIESTO, JSON.stringify({ cargado_en: new Date().toISOString(), ...creado }, null, 2));
  }

  console.log('\nDatos de prueba cargados. Resumen:');
  for (const [tabla, ids] of Object.entries(creado)) console.log(`  ${tabla.padEnd(26)} ${ids.length}`);
  console.log(`\nUsuarios nuevos: contraseña ${PASSWORD}. Para quitarlo todo:  node scripts/pruebas/datos-prueba.js revertir`);
}

async function cargarTodo() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.usuarios.findUnique({ where: { email: 'admin@lallar.com' } });
  if (!admin) throw new Error('La base no tiene el administrador de la semilla. Corre primero el seed.');
  const empresas = await prisma.empresas.findMany({ orderBy: { id: 'asc' } });
  const laLlar = empresas.find((e) => e.nombre === 'La Llar') ?? empresas[0];
  const confia = empresas.find((e) => /confia/i.test(e.nombre)) ?? empresas[1] ?? empresas[0];
  const RFC_RECEPTOR = { [laLlar.id]: 'LLA160315XYZ', [confia.id]: 'CAL170822QW1' };

  /* ── 1. Otro administrador (RRHH), para firmas y autorizaciones ── */
  const rrhh = await crear('usuarios', {
    nombre: 'Mariana Ortiz (RRHH)', email: 'rrhh.prueba@lallar.com', password: hash, rol: 'administrador',
  });
  await crear('usuarios', {
    nombre: 'Usuario Dado de Baja', email: 'baja.prueba@lallar.com', password: hash, rol: 'administrador', activo: false,
  });
  console.log('✓ usuarios administrativos');

  /* ── 2. Unidades nuevas: dos de Confia, con semanas distintas ── */
  const unidadesNuevas = [
    await crear('sucursales', { nombre: 'Cocina Confia Poniente', empresa_id: confia.id, dias_laborales: '1,2,3,4,5,6', inicio_semana: 3 }),
    await crear('sucursales', { nombre: 'Comedor Industrial Confia', empresa_id: confia.id, dias_laborales: '1,2,3,4,5', inicio_semana: 5 }),
  ];
  const gerentesNuevos = [];
  for (const [i, u] of unidadesNuevas.entries()) {
    gerentesNuevos.push(await crear('usuarios', {
      nombre: ['Ricardo Salas (Poniente)', 'Lucía Domínguez (Comedor)'][i],
      email: ['gerente.poniente@prueba.com', 'gerente.comedor@prueba.com'][i],
      password: hash, rol: 'gerente', sucursal_id: u.id,
    }));
  }
  console.log('✓ unidades de Confia con sus gerentes');

  /* ── 3. Empleados nuevos (con datos personales) ── */
  const NOMBRES = [
    ['Andrea Villalobos Pineda', 'VIPA920314'], ['Óscar Medina Rosales', 'MERO880702'],
    ['Karla Espinoza Luna', 'ESLK950101'], ['Tomás Ibarra Cruz', 'IACT900925'],
    ['Valeria Núñez Olvera', 'NUOV970611'], ['Héctor Galindo Soto', 'GASH851130'],
    ['Daniela Rangel Paz', 'RAPD930408'], ['Iván Cortés Mejía', 'COMI890217'],
    ['Paola Zamora Téllez', 'ZATP960822'], ['Rubén Aguirre Beltrán', 'AUBR870519'],
    ['Mónica Salinas Ochoa', 'SAOM940303'], ['Jorge Quintero Lara', 'QULJ910716'],
  ];
  const empleadosNuevos = [];
  for (const [i, [nombre, base]] of NOMBRES.entries()) {
    const unidad = unidadesNuevas[i < 7 ? 0 : 1];
    const [y, m, d] = [`19${base.slice(4, 6)}`, base.slice(6, 8), base.slice(8, 10)];
    empleadosNuevos.push(await crear('empleados', {
      nombre, sucursal_id: unidad.id, lector_uid: `P${pad3(i + 1)}`,
      rfc: `${base}${['AB1', 'K9Z', 'Q27', 'M4X'][i % 4]}`,
      curp: `${base}${i % 2 ? 'H' : 'M'}DFXXX0${i % 10}`.slice(0, 18),
      fecha_nacimiento: new Date(`${y}-${m}-${d}T00:00:00Z`),
      activo: i !== 11,               // uno dado de baja
    }));
  }
  console.log(`✓ ${empleadosNuevos.length} empleados nuevos`);

  /* ── 4. Horarios: fijos, rotativos y excepciones ── */
  const existentes = await prisma.empleados.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
  const conHorarioPrevio = new Set((await prisma.horarios_empleado.findMany({ select: { empleado_id: true } })).map((h) => h.empleado_id));

  // Turnos base por perfil.
  const TURNOS = { matutino: ['08:00', '17:00'], temprano: ['07:00', '15:00'], vespertino: ['12:00', '20:00'], comedor: ['06:30', '14:30'] };
  const planHorario = new Map();       // empleado_id → { tipo, turno, dias }
  /* Para los empleados que ya existían, el horario sale de SUS marcas: la
   * mediana de su primera entrada (redondeada hacia abajo a la media hora)
   * y de su última salida (a la media hora más cercana). Asignarles un
   * turno inventado convertiría sus marcas reales en retardos falsos. */
  const marcasPrevias = await prisma.asistencias.findMany({ select: { empleado_id: true, tipo: true, timestamp: true } });
  const porEmpleado = new Map();
  for (const m of marcasPrevias) {
    const clave = `${m.empleado_id}|${m.timestamp.toISOString().slice(0, 10)}`;
    const min = m.timestamp.getUTCHours() * 60 + m.timestamp.getUTCMinutes();
    const dia = porEmpleado.get(clave) ?? { eid: m.empleado_id, e: null, s: null };
    if (m.tipo === 'entrada') dia.e = dia.e == null ? min : Math.min(dia.e, min);
    else dia.s = dia.s == null ? min : Math.max(dia.s, min);
    porEmpleado.set(clave, dia);
  }
  const mediana = (xs) => { const o = [...xs].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; };
  for (const e of existentes) {
    if (conHorarioPrevio.has(e.id)) continue;
    if (empleadosNuevos.some((n) => n.id === e.id)) continue;
    const dias = [...porEmpleado.values()].filter((d) => d.eid === e.id);
    const entradas = dias.map((d) => d.e).filter((x) => x != null);
    const salidas = dias.map((d) => d.s).filter((x) => x != null);
    const turno = entradas.length >= 5 && salidas.length >= 5
      ? [hhmm(Math.floor(mediana(entradas) / 30) * 30), hhmm(Math.round(mediana(salidas) / 30) * 30)]
      : TURNOS.matutino;
    planHorario.set(e.id, { tipo: 'fijo', turno, dias: [1, 2, 3, 4, 5, 6] });
  }
  empleadosNuevos.forEach((e, i) => {
    if (!e.activo) return;
    if (i < 7) {
      // Poniente: dos rotativos (sin horario fijo), el resto fijo.
      if (i === 5 || i === 6) planHorario.set(e.id, { tipo: 'rotativo', dias: [1, 2, 3, 4, 5, 6] });
      else planHorario.set(e.id, { tipo: 'fijo', turno: i % 3 === 2 ? TURNOS.vespertino : TURNOS.matutino, dias: [1, 2, 3, 4, 5, 6] });
    } else {
      planHorario.set(e.id, { tipo: 'fijo', turno: i % 2 ? TURNOS.comedor : TURNOS.temprano, dias: [1, 2, 3, 4, 5] });
    }
  });

  for (const [eid, plan] of planHorario) {
    if (plan.tipo !== 'fijo') continue;
    for (const dia of plan.dias) {
      await crear('horarios_empleado', { empleado_id: eid, dia_semana: dia, entrada: plan.turno[0], salida: plan.turno[1] });
    }
  }

  // Rotativos: calendario por fecha de julio a octubre, alternando semanas
  // de mañana y de tarde, con un descanso entre semana.
  const turnosPorFecha = new Map();    // `${eid}|${fecha}` → turno | 'descanso'
  const finCalendario = '2026-10-31';
  for (const [eid, plan] of planHorario) {
    if (plan.tipo !== 'rotativo') continue;
    let semanaN = 0;
    for (const fecha of t.fechasEntre(DESDE, finCalendario)) {
      const dia = t.diaSemana(fecha);
      if (dia === 1) semanaN++;
      if (dia === 7) continue;
      const descanso = dia === (semanaN % 5) + 1;
      const turno = semanaN % 2 ? TURNOS.vespertino : TURNOS.temprano;
      await crear('turnos_fecha', {
        empleado_id: eid, fecha, descanso,
        entrada: descanso ? null : turno[0], salida: descanso ? null : turno[1], asignado_por: admin.id,
      });
      turnosPorFecha.set(`${eid}|${fecha}`, descanso ? 'descanso' : turno);
    }
  }
  // Excepciones sueltas para empleados fijos: un descanso y un cambio de turno.
  const fijos = [...planHorario].filter(([, p]) => p.tipo === 'fijo').map(([id]) => id);
  for (const [k, eid] of fijos.slice(0, 6).entries()) {
    const fecha = t.sumarDias('2026-08-10', k * 5);
    const cambio = k % 2 === 0;
    await crear('turnos_fecha', {
      empleado_id: eid, fecha, descanso: !cambio,
      entrada: cambio ? '10:00' : null, salida: cambio ? '19:00' : null, asignado_por: admin.id,
    });
    turnosPorFecha.set(`${eid}|${fecha}`, cambio ? ['10:00', '19:00'] : 'descanso');
  }
  console.log(`✓ horarios: ${creado.horarios_empleado?.length ?? 0} fijos, ${creado.turnos_fecha?.length ?? 0} turnos por fecha`);

  /* ── 5. Asistencias, justificaciones, correcciones y extras ── */
  const turnoDe = (eid, fecha) => {
    const f = turnosPorFecha.get(`${eid}|${fecha}`);
    if (f) return f === 'descanso' ? null : f;
    const plan = planHorario.get(eid);
    if (!plan || plan.tipo !== 'fijo') return null;
    return plan.dias.includes(t.diaSemana(fecha)) ? plan.turno : null;
  };

  // Días con marcas previas (semilla/demo): ahí no se genera nada.
  const previas = await prisma.asistencias.findMany({ select: { empleado_id: true, timestamp: true } });
  const ocupado = new Set(previas.map((p) => `${p.empleado_id}|${p.timestamp.toISOString().slice(0, 10)}`));
  const justPrevias = await prisma.justificaciones.findMany({ select: { empleado_id: true, fecha: true } });
  for (const j of justPrevias) ocupado.add(`${j.empleado_id}|${j.fecha}`);

  const perfiles = new Map();          // qué tan puntual es cada quien
  for (const [eid] of planHorario) perfiles.set(eid, probable(0.25) ? 'impuntual' : 'normal');
  // Garantiza al menos dos "casos de acta".
  [...planHorario.keys()].slice(0, 2).forEach((eid) => perfiles.set(eid, 'impuntual'));

  const hoyLimite = HOY;
  const marcas = [];
  const correccionesPend = [];
  for (const [eid] of planHorario) {
    const emp = existentes.find((e) => e.id === eid) ?? empleadosNuevos.find((e) => e.id === eid);
    // Desde julio para todos; los días que ya tenían marcas se saltan.
    const inicio = DESDE;
    const impuntual = perfiles.get(eid) === 'impuntual';

    // Vacaciones de una semana para algunos empleados nuevos.
    const vacaciones = empleadosNuevos.some((n) => n.id === eid) && probable(0.4)
      ? t.fechasEntre('2026-08-17', '2026-08-22') : [];

    for (const fecha of t.fechasEntre(inicio, hoyLimite)) {
      const clave = `${eid}|${fecha}`;
      if (ocupado.has(clave)) continue;
      const turno = turnoDe(eid, fecha);
      if (!turno) continue;

      if (vacaciones.includes(fecha)) {
        await crear('justificaciones', { empleado_id: eid, fecha, tipo: 'vacaciones', nota: 'Vacaciones programadas', creado_por: rrhh.id });
        continue;
      }
      if (fecha === HOY && probable(0.5)) continue;           // hoy aún no llega
      const r = azar();
      if (r < 0.025) continue;                                  // falta
      if (r < 0.04) {
        await crear('justificaciones', { empleado_id: eid, fecha, tipo: elegir(['incapacidad', 'permiso', 'falta_justificada']), nota: elegir(['IMSS folio 48213', 'Trámite personal', 'Cita médica', null]), creado_por: admin.id });
        continue;
      }

      const [te, ts] = turno.map(t.aMinutos);
      let entrada = te + entre(-12, 7);
      if (probable(impuntual ? 0.3 : 0.06)) entrada = te + entre(11, 48);   // retardo
      let salida = ts + entre(-2, 9);
      if (probable(0.14)) salida = ts + entre(16, 150);                        // extra
      const segE = pad2(entre(0, 59)); const segS = pad2(entre(0, 59));
      marcas.push({ empleado_id: eid, sucursal_id: emp.sucursal_id, tipo: 'entrada', timestamp: new Date(`${fecha}T${hhmm(entrada)}:${segE}Z`) });

      if (fecha === HOY) continue;                              // hoy: sin salida todavía
      if (probable(0.025)) {                                    // olvidó checar salida
        if (probable(0.6)) correccionesPend.push({ empleado_id: eid, fecha, entrada: hhmm(entrada), salida: hhmm(ts + entre(0, 5)) });
        continue;
      }
      marcas.push({ empleado_id: eid, sucursal_id: emp.sucursal_id, tipo: 'salida', timestamp: new Date(`${fecha}T${hhmm(salida)}:${segS}Z`) });
    }
  }

  // createMany no devuelve ids: se insertan y luego se leen por clave natural.
  for (let i = 0; i < marcas.length; i += 500) {
    await prisma.asistencias.createMany({ data: marcas.slice(i, i + 500), skipDuplicates: true });
  }
  const insertadas = await prisma.asistencias.findMany({
    where: { OR: chunkOr(marcas) },
    select: { id: true },
  });
  insertadas.forEach((a) => anotar('asistencias', a.id));

  for (const c of correccionesPend) {
    await crear('correcciones_asistencia', { ...c, corregido_por: admin.id });
  }
  console.log(`✓ ${insertadas.length} marcas del checador, ${creado.justificaciones?.length ?? 0} justificaciones, ${correccionesPend.length} correcciones`);

  // Horas extra asignadas a mano (incluye alguna en 0 que anula la calculada).
  const conExtra = [...planHorario.keys()].slice(0, 8);
  for (const [k, eid] of conExtra.entries()) {
    const fecha = t.sumarDias('2026-08-05', k * 4);
    if (fecha > HOY) continue;
    await crear('horas_extra_manual', {
      empleado_id: eid, fecha, minutos: k === 3 ? 0 : elegir([60, 90, 120, 180]),
      nota: k === 3 ? 'Se quedó por gusto; no se reconoce' : elegir(['Cubrió evento de la noche', 'Inventario mensual', 'Apoyo en otra cocina', 'Limpieza profunda']),
      asignado_por: k % 2 ? admin.id : rrhh.id,
    });
  }
  console.log(`✓ ${creado.horas_extra_manual?.length ?? 0} asignaciones de horas extra`);

  /* ── 6. Proveedores nuevos (casos de facturación) ── */
  const provNuevos = [
    { nombre: 'Abarrotes Mayoristas del Bajío SA de CV', rfc: 'AMB150610R42', dias_credito: 30 },
    { nombre: 'Pescados y Mariscos Ensenada', rfc: 'PME170202HT8', dias_credito: 15 },
    { nombre: 'Panificadora San Rafael', rfc: 'PSR120905LM3', dias_credito: 0 },
    { nombre: 'Desechables y Empaques Gómez', rfc: 'DEG190318UA1', dias_credito: null },
    { nombre: 'Frutas Selectas Michoacán', rfc: 'FSM160723Q56', dias_credito: 21, bloqueado_facturar: true, motivo_bloqueo: 'Facturas con precios distintos a la lista pactada. Aclarar con compras antes de facturar de nuevo.' },
    { nombre: 'Gas LP Industrial del Centro', rfc: 'GLI110101AA0', dias_credito: 7, activo: false },
  ];
  const proveedores = [];
  for (const [i, p] of provNuevos.entries()) {
    const prov = await crear('proveedores', p);
    const usuario = await crear('usuarios', {
      nombre: `Contacto ${p.nombre.split(' ')[0]}`, email: `proveedor${i + 1}.prueba@proveedores.com`,
      password: hash, rol: 'proveedor', proveedor_id: prov.id, activo: p.activo !== false,
    });
    proveedores.push({ ...prov, usuario });
  }
  console.log(`✓ ${proveedores.length} proveedores con su usuario`);

  /* ── 7. Documentos de proveedor y de unidad ── */
  const TIPOS_DOC = ['Constancia de situación fiscal', 'Opinión de cumplimiento SAT', 'Contrato de suministro', 'Lista de precios', 'Acta constitutiva'];
  for (const p of proveedores.slice(0, 5)) {
    for (let k = 0; k < entre(2, 4); k++) {
      const tipo = TIPOS_DOC[k];
      const archivo = await pdf(`docprov-${p.id}-${k}`, tipo, [p.nombre, `RFC ${p.rfc}`]);
      await crear('documentos_proveedor', {
        proveedor_id: p.id, nombre_original: `${tipo}.pdf`, ruta_archivo: archivo, tipo_mime: 'application/pdf',
        subido_por: p.usuario.id, estado: elegir(['pendiente', 'aprobado', 'aprobado', 'desaprobado']),
        creado_en: new Date(`2026-0${entre(7, 9)}-${pad2(entre(1, 20))}T1${entre(0, 8)}:00:00Z`),
      });
    }
  }
  const TIPOS_UNIDAD = ['Licencia de funcionamiento', 'Dictamen de protección civil', 'Bitácora de fumigación', 'Aviso de funcionamiento COFEPRIS'];
  const todasUnidades = await prisma.sucursales.findMany({ where: { activo: true } });
  for (const u of todasUnidades) {
    const gerente = await prisma.usuarios.findFirst({ where: { rol: 'gerente', sucursal_id: u.id } });
    for (let k = 0; k < 2; k++) {
      const tipo = TIPOS_UNIDAD[(u.id + k) % TIPOS_UNIDAD.length];
      const archivo = await pdf(`docunidad-${u.id}-${k}`, tipo, [u.nombre]);
      await crear('documentos_unidad', {
        sucursal_id: u.id, nombre_original: `${tipo} ${u.nombre}.pdf`, ruta_archivo: archivo, tipo_mime: 'application/pdf',
        subido_por: gerente?.id ?? admin.id, estado: elegir(['pendiente', 'aprobado', 'desaprobado', 'pendiente']),
      });
    }
  }
  console.log(`✓ ${creado.documentos_proveedor.length} documentos de proveedor, ${creado.documentos_unidad.length} de unidad`);

  /* ── 8. Facturas CFDI, observaciones y complementos ── */
  const emisores = [...proveedores.slice(0, 5), ...(await prisma.proveedores.findMany({ where: { id: { in: [2, 3, 4] } } })).map((p) => ({ ...p, usuario: null }))];
  const facturas = [];
  let folio = 5000;
  for (const [pi, p] of emisores.entries()) {
    const usuarioProv = p.usuario ?? await prisma.usuarios.findFirst({ where: { proveedor_id: p.id } });
    const n = pi === 4 ? 2 : entre(3, 5);
    for (let k = 0; k < n; k++) {
      folio++;
      const empresa = probable(0.35) ? confia : laLlar;
      const fecha = t.sumarDias('2026-07-06', entre(0, 75));
      if (fecha > HOY) continue;
      const total = (entre(1200, 48000) + entre(0, 99) / 100).toFixed(2);
      const uuid = uuidDe(`factura-${folio}`).toUpperCase();
      const serie = p.rfc?.slice(0, 1) ?? 'F';
      const xml = xmlCFDI(`fxml-${folio}`, { uuid, serie, folio, fecha, total, rfcEmisor: p.rfc ?? 'XAXX010101000', nombreEmisor: p.nombre, rfcReceptor: RFC_RECEPTOR[empresa.id] });
      const archivoPdf = await pdf(`fpdf-${folio}`, `Factura ${serie}-${folio}`, [p.nombre, `Receptor: ${empresa.nombre}`, `Total: $${total}`, `Folio fiscal: ${uuid}`]);

      const edad = (Date.parse(HOY) - Date.parse(fecha)) / 86400000;   // días desde la emisión
      let estado = edad > 10 ? elegir(['aprobado', 'aprobado', 'aprobado', 'desaprobado']) : elegir(['pendiente', 'pendiente', 'aprobado']);
      const aprobacion = estado === 'aprobado' ? new Date(`${t.sumarDias(fecha, entre(1, 6))}T16:00:00Z`) : null;
      const pagada = estado === 'aprobado' && edad > 25 && probable(0.7);

      const f = await crear('facturas', {
        proveedor_id: p.id, empresa_id: empresa.id, uuid_fiscal: uuid,
        rfc_emisor: p.rfc, rfc_receptor: RFC_RECEPTOR[empresa.id], total, fecha_cfdi: new Date(`${fecha}T10:30:00Z`),
        serie_folio: `${serie}-${folio}`, moneda: 'MXN', estado,
        ruta_xml: xml, ruta_pdf: archivoPdf, nombre_xml: `${serie}${folio}.xml`, nombre_pdf: `${serie}${folio}.pdf`,
        subido_por: usuarioProv?.id ?? admin.id, aprobado_por: aprobacion ? admin.id : null, fecha_aprobacion: aprobacion,
        pago_realizado: pagada, fecha_pago_marcado: pagada ? new Date(`${t.sumarDias(fecha, 20)}T12:00:00Z`) : null,
        creado_en: new Date(`${fecha}T11:00:00Z`),
      });
      facturas.push({ ...f, proveedor: p, usuarioProv });

      if (estado === 'desaprobado') {
        await crear('observaciones_documento', { factura_id: f.id, autor_id: admin.id, texto: elegir([
          'El RFC receptor no corresponde a la empresa facturada.',
          'El total no coincide con la orden de compra. Falta aplicar el descuento pactado.',
          'El PDF no corresponde al XML (folio distinto).',
        ]) });
      }
      // Complemento de pago: casi todas las pagadas lo tienen; una no (bloqueo secuencial).
      if (pagada && !(pi === 1 && k === 0)) {
        const uuidC = uuidDe(`comp-${folio}`).toUpperCase();
        const fc = t.sumarDias(fecha, 24);
        const cx = xmlCFDI(`cxml-${folio}`, { uuid: uuidC, serie: 'P', folio, fecha: fc, total: '0', rfcEmisor: p.rfc ?? 'XAXX010101000', nombreEmisor: p.nombre, rfcReceptor: RFC_RECEPTOR[empresa.id], pago: true });
        const cp = await pdf(`cpdf-${folio}`, `Complemento de pago P-${folio}`, [p.nombre, `Factura ${serie}-${folio}`]);
        await crear('complementos_pago', {
          factura_id: f.id, uuid_fiscal: uuidC, ruta_xml: cx, ruta_pdf: cp, nombre_xml: `P${folio}.xml`, nombre_pdf: `P${folio}.pdf`,
          estado: elegir(['aprobado', 'aprobado', 'pendiente']), subido_por: usuarioProv?.id ?? admin.id,
          creado_en: new Date(`${fc}T13:00:00Z`),
        });
      }
    }
  }
  console.log(`✓ ${facturas.length} facturas, ${creado.complementos_pago?.length ?? 0} complementos, ${creado.observaciones_documento?.length ?? 0} observaciones`);

  /* ── 9. Invitaciones de alta de proveedor ── */
  const tokenVigente = crypto.randomBytes(32).toString('hex');
  const hashTok = (tk) => crypto.createHash('sha256').update(tk).digest('hex');
  await crear('invitaciones_proveedor', { token_hash: hashTok(tokenVigente), email: 'nuevo.proveedor@prueba.com', creada_por: admin.id, expira_en: new Date(Date.now() + 5 * 86400000) });
  await crear('invitaciones_proveedor', { token_hash: hashTok(crypto.randomBytes(32).toString('hex')), email: 'vencida@prueba.com', creada_por: admin.id, expira_en: new Date('2026-08-01T00:00:00Z') });
  await crear('invitaciones_proveedor', { token_hash: hashTok(crypto.randomBytes(32).toString('hex')), email: proveedores[0].usuario.email, creada_por: admin.id, expira_en: new Date('2026-09-30T00:00:00Z'), usado_en: new Date('2026-07-02T15:00:00Z') });
  console.log(`✓ invitaciones (vigente: /registro/${tokenVigente})`);

  /* ── 10. Vales azules ── */
  const gerentes = await prisma.usuarios.findMany({ where: { rol: 'gerente', activo: true }, include: { sucursal: true } });
  const yaTienenPendiente = new Set((await prisma.vales.findMany({ where: { estado: { in: ['pendiente', 'no_autorizado'] } }, select: { solicitante_id: true } })).map((v) => v.solicitante_id));
  const CONCEPTOS = ['Gas para estufa de emergencia', 'Taxi para recoger pedido urgente', 'Hielo para evento', 'Refacción de licuadora', 'Garrafones de agua', 'Papel térmico para comandas', 'Estacionamiento en proveedor', 'Limones (faltante de pedido)'];
  let nVale = 0;
  for (const g of [...gerentes, rrhh]) {
    const empresaId = g.sucursal?.empresa_id ?? laLlar.id;
    const cuantos = entre(2, 4);
    for (let k = 0; k < cuantos; k++) {
      nVale++;
      const ultimo = k === cuantos - 1;
      // Solo el último puede quedar sin resolver: la regla es uno a la vez.
      let estado = 'autorizado';
      if (ultimo && !yaTienenPendiente.has(g.id)) estado = elegir(['pendiente', 'pendiente', 'no_autorizado', 'autorizado']);
      const fecha = t.sumarDias('2026-07-10', nVale * 3 % 70);
      const monto = `${entre(45, 500)}.${pad2(elegir([0, 0, 50, entre(0, 99)]))}`;
      const montoFinal = Number(monto) > 500 ? '500.00' : monto;
      const archivo = await pdf(`vale-${nVale}`, `Vale azul VA-${pad3(nVale + 100)}`, [`Solicita: ${g.nombre}`, `Monto: $${montoFinal}`, 'Firma: ______________ (escaneo)']);
      await crear('vales', {
        solicitante_id: g.id, empresa_id: empresaId, monto: montoFinal, uid: `VA-PRUEBA-${pad3(nVale + 100)}`,
        ruta_comprobante: archivo, nombre_original: `vale_${nVale + 100}.pdf`, tipo_mime: 'application/pdf',
        concepto: elegir(CONCEPTOS), estado,
        autorizado_por: estado === 'autorizado' ? elegir([admin.id, rrhh.id]) : null,
        fecha_autorizacion: estado === 'autorizado' ? new Date(`${t.sumarDias(fecha, 2)}T18:00:00Z`) : null,
        motivo_rechazo: estado === 'no_autorizado' ? 'El vale no viene firmado por el responsable del gasto.' : null,
        creado_en: new Date(`${fecha}T14:00:00Z`),
      });
    }
  }
  console.log(`✓ ${creado.vales.length} vales`);

  /* ── 11. Aclaraciones ── */
  const deProveedor = (pid) => facturas.filter((f) => f.proveedor_id === pid);
  const casos = [
    { f: deProveedor(proveedores[0].id)[0], asunto: 'El total no coincide con la orden de compra', abierta: true, notas: [
      ['p', 'La orden decía $12,400 más IVA y nos rechazaron por diferencia. ¿Qué parte falta?'],
      ['a', 'Falta aplicar el 3% de descuento por pronto pago. Reenvíen la factura corregida.'],
    ] },
    { f: deProveedor(proveedores[1].id)[0], asunto: 'Pago marcado pero no nos llega la transferencia', abierta: true, notas: [
      ['p', 'Aparece como pagada desde hace una semana pero no vemos el depósito.'],
      ['a', 'Se pagó el 12; les compartimos el comprobante bancario en soporte.'],
      ['p', 'Ya lo ubicamos, pero el monto trae una comisión. ¿Nos pueden confirmar?'],
    ], soporte: true },
    { f: deProveedor(proveedores[2].id)[0], asunto: 'Duda sobre la empresa a la que se factura', abierta: false, notas: [
      ['p', '¿Esta entrega de pan se factura a La Llar o a Confia?'],
      ['a', 'Las entregas al Comedor Industrial se facturan a Confia Alimentos.'],
      ['a', 'Resuelto: la factura quedó correcta.'],
    ] },
    { f: facturas.find((f) => f.estado === 'aprobado' && f.proveedor_id === proveedores[0].id), asunto: 'Solicitud de nota de crédito por producto dañado', abierta: true, porAdmin: true, notas: [
      ['a', 'Llegaron 4 cajas dañadas en esta entrega. Necesitamos nota de crédito.'],
    ] },
  ].filter((c) => c.f);

  for (const [i, c] of casos.entries()) {
    const provUsuario = c.f.usuarioProv ?? admin;
    const creadoEn = new Date(`${t.sumarDias(HOY, -20 + i * 4)}T15:00:00Z`);
    const acl = await crear('aclaraciones', {
      proveedor_id: c.f.proveedor_id, empresa_id: c.f.empresa_id, asunto: c.asunto,
      estado: c.abierta ? 'abierta' : 'cerrada', creado_por: c.porAdmin ? admin.id : provUsuario.id, creado_en: creadoEn,
      cerrada_por: c.abierta ? null : admin.id, cerrada_en: c.abierta ? null : new Date(creadoEn.getTime() + 3 * 86400000),
    });
    const doc = await prisma.aclaracion_documentos.create({ data: { aclaracion_id: acl.id, origen: 'factura', origen_id: c.f.id, subido_por: acl.creado_por, creado_en: creadoEn } });
    anotar('aclaracion_documentos', doc.id);
    const comp = await prisma.complementos_pago.findUnique({ where: { factura_id: c.f.id } });
    if (comp) anotar('aclaracion_documentos', (await prisma.aclaracion_documentos.create({ data: { aclaracion_id: acl.id, origen: 'complemento', origen_id: comp.id, subido_por: acl.creado_por } })).id);
    for (const [k, [quien, texto]] of c.notas.entries()) {
      await crear('aclaracion_notas', { aclaracion_id: acl.id, texto, autor_id: quien === 'a' ? admin.id : provUsuario.id, creado_en: new Date(creadoEn.getTime() + k * 7 * 3600000) });
    }
    if (c.soporte) {
      const archivo = await pdf(`soporte-${acl.id}`, 'Comprobante de transferencia', ['SPEI', `Referencia ${entre(100000, 999999)}`]);
      await crear('aclaracion_documentos', { aclaracion_id: acl.id, origen: 'soporte', ruta_archivo: archivo, nombre_original: 'comprobante_spei.pdf', tipo_mime: 'application/pdf', subido_por: admin.id });
    }
  }
  console.log(`✓ ${creado.aclaraciones?.length ?? 0} aclaraciones con ${creado.aclaracion_notas?.length ?? 0} notas`);

  /* ── 12. Histórico (unidad, proveedor y resúmenes de asistencia) ── */
  const HIST = [
    ['unidad', unidadesNuevas[0].id, unidadesNuevas[0].nombre, 'Licencia de funcionamiento 2025.pdf'],
    ['unidad', unidadesNuevas[1].id, unidadesNuevas[1].nombre, 'Dictamen protección civil 2025.pdf'],
    ['proveedor', proveedores[0].id, proveedores[0].nombre, 'Contrato de suministro 2025.pdf'],
    ['proveedor', proveedores[2].id, proveedores[2].nombre, 'Lista de precios 2025.pdf'],
    ['asistencia', empleadosNuevos[0].id, `${empleadosNuevos[0].nombre} · ${unidadesNuevas[0].nombre}`, `Resumen semanal - ${empleadosNuevos[0].nombre} - 2026-08-05 al 2026-08-11.pdf`],
    ['asistencia', empleadosNuevos[1].id, `${empleadosNuevos[1].nombre} · ${unidadesNuevas[0].nombre}`, `Resumen semanal - ${empleadosNuevos[1].nombre} - 2026-08-12 al 2026-08-18.pdf`],
  ];
  for (const [k, [origen, id, nombreOrigen, archivoNombre]] of HIST.entries()) {
    const archivo = await pdf(`hist-${k}`, archivoNombre.replace('.pdf', ''), [nombreOrigen]);
    await crear('documentos_historicos', {
      origen, origen_id: id, origen_nombre: nombreOrigen, nombre_original: archivoNombre, ruta_archivo: archivo,
      tipo_mime: 'application/pdf', subido_por: admin.id, subido_en: new Date('2026-08-20T12:00:00Z'), aprobado_por: rrhh.id,
    });
  }
  console.log(`✓ ${creado.documentos_historicos.length} documentos en el Histórico`);
}

/* Filtro OR por clave natural, para recuperar los ids de un createMany. */
function chunkOr(marcas) {
  return marcas.map((m) => ({ empleado_id: m.empleado_id, tipo: m.tipo, timestamp: m.timestamp }));
}
function pad2(n) { return String(n).padStart(2, '0'); }
function pad3(n) { return String(n).padStart(3, '0'); }

/* ════════════════════════ REVERTIR ════════════════════════ */
async function revertir() {
  if (!fs.existsSync(MANIFIESTO)) {
    console.log('No hay datos de prueba cargados (no existe .manifiesto.json). Nada que revertir.');
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));

  // Hijos antes que padres, para respetar las llaves foráneas.
  const ORDEN = [
    'aclaracion_notas', 'aclaracion_documentos', 'aclaraciones',
    'observaciones_documento', 'complementos_pago', 'facturas',
    'vales', 'invitaciones_proveedor', 'documentos_historicos',
    'documentos_proveedor', 'documentos_unidad',
    'horas_extra_manual', 'turnos_fecha', 'horarios_empleado',
    'correcciones_asistencia', 'justificaciones', 'asistencias',
    'empleados', 'usuarios', 'proveedores', 'sucursales',
  ];
  for (const tabla of ORDEN) {
    const ids = m[tabla] ?? [];
    for (let i = 0; i < ids.length; i += 1000) {
      await prisma[tabla].deleteMany({ where: { id: { in: ids.slice(i, i + 1000) } } });
    }
    if (ids.length) console.log(`  − ${tabla.padEnd(26)} ${ids.length}`);
  }
  let borrados = 0;
  for (const a of m.archivos ?? []) {
    try { fs.unlinkSync(path.join(UPLOADS, a)); borrados++; } catch { /* ya no estaba */ }
  }
  console.log(`  − archivos en uploads/          ${borrados}`);
  fs.unlinkSync(MANIFIESTO);
  console.log('\nDatos de prueba revertidos. La semilla y lo demás quedaron intactos.');
}

/* ── main ── */
const accion = process.argv[2];
(accion === 'cargar' ? cargar() : accion === 'revertir' ? revertir() : Promise.reject(new Error('Uso: node scripts/pruebas/datos-prueba.js cargar|revertir')))
  .catch((e) => { console.error('\nError:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
