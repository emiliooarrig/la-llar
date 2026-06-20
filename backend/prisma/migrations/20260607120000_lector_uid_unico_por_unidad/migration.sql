-- El lector_uid deja de ser único globalmente y pasa a ser único por unidad.
-- Motivo: el checador físico de cada cocina puede asignar el mismo número de
-- lector a empleados distintos (mismo lector_uid, sucursal_id diferente).
-- El webhook de asistencias resuelve al empleado por (lector_uid, sucursal_id).

-- DropIndex
DROP INDEX `empleados_lector_uid_key` ON `empleados`;

-- CreateIndex
CREATE UNIQUE INDEX `empleados_lector_uid_sucursal_id_key` ON `empleados`(`lector_uid`, `sucursal_id`);
