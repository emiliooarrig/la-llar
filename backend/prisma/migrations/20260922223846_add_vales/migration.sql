-- CreateTable
CREATE TABLE `vales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitante_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `uid` VARCHAR(64) NOT NULL,
    `ruta_comprobante` VARCHAR(500) NOT NULL,
    `nombre_original` VARCHAR(255) NOT NULL,
    `tipo_mime` VARCHAR(100) NOT NULL,
    `concepto` VARCHAR(300) NULL,
    `estado` ENUM('pendiente', 'autorizado', 'no_autorizado') NOT NULL DEFAULT 'pendiente',
    `autorizado_por` INTEGER NULL,
    `fecha_autorizacion` DATETIME(3) NULL,
    `motivo_rechazo` VARCHAR(300) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vales_uid_key`(`uid`),
    INDEX `vales_solicitante_id_estado_idx`(`solicitante_id`, `estado`),
    INDEX `vales_empresa_id_estado_idx`(`empresa_id`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vales` ADD CONSTRAINT `vales_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
