require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const empleadosRoutes = require('./routes/empleados');
const usuariosRoutes = require('./routes/usuarios');
const dashboardRoutes = require('./routes/dashboard');
const pendientesRoutes = require('./routes/pendientes');
const asistenciasRoutes = require('./routes/asistencias');
const sucursalesRoutes = require('./routes/sucursales');
const proveedoresRoutes = require('./routes/proveedores');
const unidadesRoutes = require('./routes/unidades');
const ventanasRoutes = require('./routes/ventanas');
const webhookRoutes = require('./routes/webhook');
const historicosRoutes = require('./routes/historicos');

const app = express();
const PORT = process.env.PORT;
const prisma = new PrismaClient();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pendientes', pendientesRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/ventanas', ventanasRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/historicos', historicosRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function iniciar() {
  try {
    await prisma.$connect();
    console.log('Conexión a la base de datos establecida');
  } catch (e) {
    console.error('No se pudo conectar a la base de datos:', e.message);
    console.error('Verifica que DATABASE_URL en backend/.env sea correcta y que MariaDB esté corriendo.');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Puerto ${PORT} en uso. Detén el proceso anterior o cambia PORT en .env`);
    } else {
      console.error('Error del servidor:', err);
    }
    process.exit(1);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin capturar:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  process.exit(1);
});

iniciar();
