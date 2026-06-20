-- AlterTable
ALTER TABLE `documentos_unidad` ADD COLUMN `estado` ENUM('pendiente', 'aprobado', 'desaprobado') NOT NULL DEFAULT 'pendiente';
