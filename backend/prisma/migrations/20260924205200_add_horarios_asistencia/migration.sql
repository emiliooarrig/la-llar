-- CreateTable
CREATE TABLE `horarios_empleado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `dia_semana` INTEGER NOT NULL,
    `entrada` VARCHAR(5) NOT NULL,
    `salida` VARCHAR(5) NOT NULL,

    UNIQUE INDEX `horarios_empleado_empleado_id_dia_semana_key`(`empleado_id`, `dia_semana`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turnos_fecha` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `fecha` VARCHAR(10) NOT NULL,
    `entrada` VARCHAR(5) NULL,
    `salida` VARCHAR(5) NULL,
    `descanso` BOOLEAN NOT NULL DEFAULT false,
    `asignado_por` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `turnos_fecha_empleado_id_fecha_key`(`empleado_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horas_extra_manual` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empleado_id` INTEGER NOT NULL,
    `fecha` VARCHAR(10) NOT NULL,
    `minutos` INTEGER NOT NULL,
    `nota` VARCHAR(300) NULL,
    `asignado_por` INTEGER NOT NULL,
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `horas_extra_manual_empleado_id_fecha_key`(`empleado_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `config_asistencia` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `tolerancia_min` INTEGER NOT NULL DEFAULT 10,
    `umbral_extra_min` INTEGER NOT NULL DEFAULT 15,
    `periodo_retardos` ENUM('semana', 'quincena', 'mes') NOT NULL DEFAULT 'mes',
    `actualizado_por` INTEGER NULL,
    `actualizado_en` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `horarios_empleado` ADD CONSTRAINT `horarios_empleado_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turnos_fecha` ADD CONSTRAINT `turnos_fecha_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horas_extra_manual` ADD CONSTRAINT `horas_extra_manual_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fila única de reglas con los valores de la spec 004: tolerancia 10 min,
-- umbral de extra 15 min y retardos contados por mes.
INSERT INTO `config_asistencia` (`id`, `tolerancia_min`, `umbral_extra_min`, `periodo_retardos`, `actualizado_en`)
VALUES (1, 10, 15, 'mes', CURRENT_TIMESTAMP(3));
