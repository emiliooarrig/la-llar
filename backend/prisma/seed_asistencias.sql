-- ============================================================
-- Datos de prueba — Módulo de Asistencias (mayo 2026)
-- La Llar · Sistema de Gestión Interna
--
-- Requisitos: la tabla 'justificaciones' debe existir (aplica la
-- migración 20260531120000_add_justificaciones o ejecuta
--   npx prisma migrate deploy   /   npm run db:migrate).
-- Asume los empleados del seed: id 1 (Ana, Central), id 2 (Luis,
-- Central) e id 3 (María, Norte). Es idempotente: borra y reinserta.
--
-- Ejecutar:  mysql -u root la_llar < seed_asistencias.sql
-- ============================================================

SET @ADMIN = (SELECT id FROM usuarios WHERE email = 'admin@lallar.com' LIMIT 1);

-- Limpieza del mes para los empleados de prueba (re-ejecutable)
DELETE FROM asistencias
  WHERE empleado_id IN (1, 2, 3)
    AND timestamp >= '2026-05-01 00:00:00' AND timestamp < '2026-06-01 00:00:00';

DELETE FROM justificaciones
  WHERE empleado_id IN (1, 2, 3)
    AND fecha BETWEEN '2026-05-01' AND '2026-05-31';

-- Marcas de entrada/salida (checador físico)
INSERT INTO asistencias (empleado_id, sucursal_id, tipo, timestamp) VALUES
(1, 1, 'entrada', '2026-05-01 08:09:00'),
(1, 1, 'salida', '2026-05-01 17:09:00'),
(2, 1, 'entrada', '2026-05-01 07:50:00'),
(2, 1, 'salida', '2026-05-01 16:50:00'),
(3, 2, 'entrada', '2026-05-01 09:00:00'),
(3, 2, 'salida', '2026-05-01 18:02:00'),
(1, 1, 'entrada', '2026-05-04 08:08:00'),
(1, 1, 'salida', '2026-05-04 17:08:00'),
(2, 1, 'entrada', '2026-05-04 07:59:00'),
(2, 1, 'salida', '2026-05-04 16:59:00'),
(3, 2, 'entrada', '2026-05-04 09:00:00'),
(3, 2, 'salida', '2026-05-04 18:01:00'),
(1, 1, 'entrada', '2026-05-05 08:04:00'),
(1, 1, 'salida', '2026-05-05 17:04:00'),
(2, 1, 'entrada', '2026-05-05 07:56:00'),
(2, 1, 'salida', '2026-05-05 16:56:00'),
(3, 2, 'entrada', '2026-05-05 09:05:00'),
(3, 2, 'salida', '2026-05-05 18:08:00'),
(1, 1, 'entrada', '2026-05-06 08:00:00'),
(1, 1, 'salida', '2026-05-06 17:00:00'),
(2, 1, 'entrada', '2026-05-06 07:52:00'),
(2, 1, 'salida', '2026-05-06 16:52:00'),
(3, 2, 'entrada', '2026-05-06 09:01:00'),
(3, 2, 'salida', '2026-05-06 18:04:00'),
(1, 1, 'entrada', '2026-05-07 08:07:00'),
(1, 1, 'salida', '2026-05-07 17:07:00'),
(2, 1, 'entrada', '2026-05-07 07:59:00'),
(2, 1, 'salida', '2026-05-07 16:59:00'),
(3, 2, 'entrada', '2026-05-07 09:00:00'),
(3, 2, 'salida', '2026-05-07 18:00:00'),
(1, 1, 'entrada', '2026-05-08 08:03:00'),
(2, 1, 'entrada', '2026-05-08 07:55:00'),
(2, 1, 'salida', '2026-05-08 16:55:00'),
(3, 2, 'entrada', '2026-05-08 09:04:00'),
(3, 2, 'salida', '2026-05-08 18:07:00'),
(1, 1, 'entrada', '2026-05-11 08:02:00'),
(1, 1, 'salida', '2026-05-11 17:02:00'),
(2, 1, 'entrada', '2026-05-11 07:54:00'),
(2, 1, 'salida', '2026-05-11 16:54:00'),
(3, 2, 'entrada', '2026-05-11 09:03:00'),
(3, 2, 'salida', '2026-05-11 18:06:00'),
(1, 1, 'entrada', '2026-05-12 08:09:00'),
(1, 1, 'salida', '2026-05-12 17:09:00'),
(2, 1, 'entrada', '2026-05-12 07:50:00'),
(2, 1, 'salida', '2026-05-12 16:50:00'),
(1, 1, 'entrada', '2026-05-13 08:05:00'),
(1, 1, 'salida', '2026-05-13 17:05:00'),
(2, 1, 'entrada', '2026-05-13 07:57:00'),
(2, 1, 'salida', '2026-05-13 16:57:00'),
(1, 1, 'entrada', '2026-05-14 08:01:00'),
(1, 1, 'salida', '2026-05-14 17:01:00'),
(2, 1, 'entrada', '2026-05-14 07:53:00'),
(2, 1, 'salida', '2026-05-14 16:53:00'),
(1, 1, 'entrada', '2026-05-15 08:08:00'),
(1, 1, 'salida', '2026-05-15 17:08:00'),
(2, 1, 'entrada', '2026-05-15 07:59:00'),
(2, 1, 'salida', '2026-05-15 16:59:00'),
(1, 1, 'entrada', '2026-05-18 08:07:00'),
(1, 1, 'salida', '2026-05-18 17:07:00'),
(2, 1, 'entrada', '2026-05-18 07:59:00'),
(2, 1, 'salida', '2026-05-18 16:59:00'),
(3, 2, 'entrada', '2026-05-18 09:00:00'),
(3, 2, 'salida', '2026-05-18 18:00:00'),
(1, 1, 'entrada', '2026-05-19 08:03:00'),
(1, 1, 'salida', '2026-05-19 17:03:00'),
(3, 2, 'entrada', '2026-05-19 09:04:00'),
(3, 2, 'salida', '2026-05-19 18:07:00'),
(1, 1, 'entrada', '2026-05-20 08:10:00'),
(1, 1, 'salida', '2026-05-20 17:10:00'),
(3, 2, 'entrada', '2026-05-20 09:00:00'),
(3, 2, 'salida', '2026-05-20 18:03:00'),
(1, 1, 'entrada', '2026-05-21 08:06:00'),
(1, 1, 'salida', '2026-05-21 17:06:00'),
(3, 2, 'entrada', '2026-05-21 09:07:00'),
(3, 2, 'salida', '2026-05-21 18:10:00'),
(1, 1, 'entrada', '2026-05-22 08:02:00'),
(1, 1, 'salida', '2026-05-22 17:02:00'),
(3, 2, 'entrada', '2026-05-22 09:03:00'),
(3, 2, 'salida', '2026-05-22 18:06:00'),
(1, 1, 'entrada', '2026-05-25 08:01:00'),
(1, 1, 'salida', '2026-05-25 17:01:00'),
(2, 1, 'entrada', '2026-05-25 07:53:00'),
(2, 1, 'salida', '2026-05-25 16:53:00'),
(3, 2, 'entrada', '2026-05-25 09:02:00'),
(3, 2, 'salida', '2026-05-25 18:05:00'),
(1, 1, 'entrada', '2026-05-26 08:08:00'),
(1, 1, 'salida', '2026-05-26 17:08:00'),
(2, 1, 'entrada', '2026-05-26 07:59:00'),
(2, 1, 'salida', '2026-05-26 16:59:00'),
(3, 2, 'entrada', '2026-05-26 09:00:00'),
(3, 2, 'salida', '2026-05-26 18:01:00'),
(1, 1, 'entrada', '2026-05-27 08:04:00'),
(1, 1, 'salida', '2026-05-27 17:04:00'),
(2, 1, 'entrada', '2026-05-27 07:56:00'),
(2, 1, 'salida', '2026-05-27 16:56:00'),
(3, 2, 'entrada', '2026-05-27 09:05:00'),
(3, 2, 'salida', '2026-05-27 18:08:00'),
(1, 1, 'entrada', '2026-05-28 08:00:00'),
(1, 1, 'salida', '2026-05-28 17:00:00'),
(2, 1, 'entrada', '2026-05-28 07:52:00'),
(2, 1, 'salida', '2026-05-28 16:52:00'),
(3, 2, 'entrada', '2026-05-28 09:01:00'),
(3, 2, 'salida', '2026-05-28 18:04:00'),
(1, 1, 'entrada', '2026-05-29 08:07:00'),
(1, 1, 'salida', '2026-05-29 17:07:00'),
(2, 1, 'entrada', '2026-05-29 07:59:00'),
(2, 1, 'salida', '2026-05-29 16:59:00'),
(3, 2, 'entrada', '2026-05-29 09:00:00'),
(3, 2, 'salida', '2026-05-29 18:00:00');

-- Justificaciones (vacaciones / incapacidad) registradas por el administrador
INSERT INTO justificaciones (empleado_id, fecha, tipo, nota, creado_por) VALUES
(3, '2026-05-12', 'incapacidad', 'Incapacidad IMSS folio 8842-26', @ADMIN),
(3, '2026-05-13', 'incapacidad', 'Incapacidad IMSS folio 8842-26', @ADMIN),
(3, '2026-05-14', 'incapacidad', 'Incapacidad IMSS folio 8842-26', @ADMIN),
(3, '2026-05-15', 'incapacidad', 'Incapacidad IMSS folio 8842-26', @ADMIN),
(2, '2026-05-19', 'vacaciones', 'Vacaciones programadas', @ADMIN),
(2, '2026-05-20', 'vacaciones', 'Vacaciones programadas', @ADMIN),
(2, '2026-05-21', 'vacaciones', 'Vacaciones programadas', @ADMIN),
(2, '2026-05-22', 'vacaciones', 'Vacaciones programadas', @ADMIN);
