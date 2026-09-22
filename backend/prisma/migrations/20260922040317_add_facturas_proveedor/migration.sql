-- AlterTable
ALTER TABLE `proveedores` ADD COLUMN `bloqueado_facturar` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dias_credito` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `motivo_bloqueo` VARCHAR(300) NULL;

-- CreateTable
CREATE TABLE `facturas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proveedor_id` INTEGER NOT NULL,
    `empresa_id` INTEGER NOT NULL,
    `uuid_fiscal` VARCHAR(36) NOT NULL,
    `rfc_emisor` VARCHAR(13) NULL,
    `rfc_receptor` VARCHAR(13) NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `fecha_cfdi` DATETIME(3) NULL,
    `serie_folio` VARCHAR(60) NULL,
    `moneda` VARCHAR(3) NULL,
    `estado` ENUM('pendiente', 'aprobado', 'desaprobado') NOT NULL DEFAULT 'pendiente',
    `ruta_xml` VARCHAR(500) NOT NULL,
    `ruta_pdf` VARCHAR(500) NOT NULL,
    `nombre_xml` VARCHAR(255) NOT NULL,
    `nombre_pdf` VARCHAR(255) NOT NULL,
    `subido_por` INTEGER NOT NULL,
    `aprobado_por` INTEGER NULL,
    `fecha_aprobacion` DATETIME(3) NULL,
    `pago_realizado` BOOLEAN NOT NULL DEFAULT false,
    `fecha_pago_marcado` DATETIME(3) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `facturas_uuid_fiscal_key`(`uuid_fiscal`),
    INDEX `facturas_proveedor_id_estado_idx`(`proveedor_id`, `estado`),
    INDEX `facturas_empresa_id_fecha_aprobacion_idx`(`empresa_id`, `fecha_aprobacion`),
    INDEX `facturas_proveedor_id_pago_realizado_idx`(`proveedor_id`, `pago_realizado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `complementos_pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factura_id` INTEGER NOT NULL,
    `uuid_fiscal` VARCHAR(36) NULL,
    `ruta_xml` VARCHAR(500) NOT NULL,
    `ruta_pdf` VARCHAR(500) NOT NULL,
    `nombre_xml` VARCHAR(255) NOT NULL,
    `nombre_pdf` VARCHAR(255) NOT NULL,
    `estado` ENUM('pendiente', 'aprobado', 'desaprobado') NOT NULL DEFAULT 'pendiente',
    `subido_por` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `complementos_pago_factura_id_key`(`factura_id`),
    UNIQUE INDEX `complementos_pago_uuid_fiscal_key`(`uuid_fiscal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observaciones_documento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factura_id` INTEGER NOT NULL,
    `texto` VARCHAR(500) NOT NULL,
    `autor_id` INTEGER NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `observaciones_documento_factura_id_idx`(`factura_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invitaciones_proveedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token_hash` VARCHAR(64) NOT NULL,
    `email` VARCHAR(200) NULL,
    `creada_por` INTEGER NOT NULL,
    `expira_en` DATETIME(3) NOT NULL,
    `usado_en` DATETIME(3) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invitaciones_proveedor_token_hash_key`(`token_hash`),
    INDEX `invitaciones_proveedor_expira_en_idx`(`expira_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `facturas` ADD CONSTRAINT `facturas_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facturas` ADD CONSTRAINT `facturas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `complementos_pago` ADD CONSTRAINT `complementos_pago_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `observaciones_documento` ADD CONSTRAINT `observaciones_documento_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
