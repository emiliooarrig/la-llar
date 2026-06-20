-- CreateTable
CREATE TABLE `correcciones_asistencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `fecha` VARCHAR(10) NOT NULL,
    `entrada` VARCHAR(5) NULL,
    `salida` VARCHAR(5) NULL,
    `corregido_por` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `correcciones_asistencia_empleado_id_fecha_key`(`empleado_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `correcciones_asistencia` ADD CONSTRAINT `correcciones_asistencia_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
