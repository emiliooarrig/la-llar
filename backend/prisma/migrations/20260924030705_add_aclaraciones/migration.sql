-- CreateTable
CREATE TABLE `aclaraciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proveedor_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `asunto` VARCHAR(200) NOT NULL,
    `estado` ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
    `creado_por` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cerrada_por` INTEGER NULL,
    `cerrada_en` DATETIME(3) NULL,

    INDEX `aclaraciones_proveedor_id_estado_idx`(`proveedor_id`, `estado`),
    INDEX `aclaraciones_empresa_id_estado_idx`(`empresa_id`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aclaracion_documentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aclaracion_id` INTEGER NOT NULL,
    `origen` ENUM('factura', 'complemento', 'soporte') NOT NULL,
    `origen_id` INTEGER NULL,
    `ruta_archivo` VARCHAR(500) NULL,
    `nombre_original` VARCHAR(255) NULL,
    `tipo_mime` VARCHAR(100) NULL,
    `subido_por` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `aclaracion_documentos_aclaracion_id_origen_origen_id_key`(`aclaracion_id`, `origen`, `origen_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aclaracion_notas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `aclaracion_id` INTEGER NOT NULL,
    `texto` VARCHAR(1000) NOT NULL,
    `autor_id` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `aclaracion_notas_aclaracion_id_idx`(`aclaracion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `aclaraciones` ADD CONSTRAINT `aclaraciones_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aclaraciones` ADD CONSTRAINT `aclaraciones_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aclaracion_documentos` ADD CONSTRAINT `aclaracion_documentos_aclaracion_id_fkey` FOREIGN KEY (`aclaracion_id`) REFERENCES `aclaraciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aclaracion_notas` ADD CONSTRAINT `aclaracion_notas_aclaracion_id_fkey` FOREIGN KEY (`aclaracion_id`) REFERENCES `aclaraciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
