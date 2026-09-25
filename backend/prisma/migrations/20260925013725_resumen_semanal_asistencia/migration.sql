-- AlterTable
ALTER TABLE `documentos_historicos` MODIFY `origen` ENUM('unidad', 'proveedor', 'asistencia') NOT NULL;

-- AlterTable
ALTER TABLE `sucursales` ADD COLUMN `inicio_semana` INTEGER NOT NULL DEFAULT 1;
