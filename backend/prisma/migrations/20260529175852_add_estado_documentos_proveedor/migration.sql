-- AlterTable
ALTER TABLE `documentos_proveedor` ADD COLUMN `estado` ENUM('pendiente', 'aprobado', 'desaprobado') NOT NULL DEFAULT 'pendiente';
