-- CreateTable
CREATE TABLE `configuracion` (
    `clave` VARCHAR(60) NOT NULL,
    `valor` JSON NOT NULL,
    `actualizado_por` INTEGER NULL,
    `actualizado_en` DATETIME(3) NOT NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
