-- CreateTable
CREATE TABLE `observaciones_doc_proveedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documento_id` INTEGER NOT NULL,
    `texto` VARCHAR(500) NOT NULL,
    `autor_id` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `observaciones_doc_proveedor_documento_id_idx`(`documento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observaciones_doc_unidad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documento_id` INTEGER NOT NULL,
    `texto` VARCHAR(500) NOT NULL,
    `autor_id` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `observaciones_doc_unidad_documento_id_idx`(`documento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `observaciones_doc_proveedor` ADD CONSTRAINT `observaciones_doc_proveedor_documento_id_fkey` FOREIGN KEY (`documento_id`) REFERENCES `documentos_proveedor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observaciones_doc_unidad` ADD CONSTRAINT `observaciones_doc_unidad_documento_id_fkey` FOREIGN KEY (`documento_id`) REFERENCES `documentos_unidad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
