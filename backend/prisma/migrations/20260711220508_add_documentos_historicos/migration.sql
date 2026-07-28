-- Módulo de documentación histórica.
-- Tabla nueva: documentos_historicos. Guarda los documentos que el
-- administrador retira del flujo activo (Proveedores / Unidades) mediante
-- "Mandar a Histórico".
--   subido_en    → timestamp original de subida del documento (se preserva).
--   subido_por   → usuario que subió el archivo originalmente.
--   aprobado_por → usuario (administrador) que aprobó el envío al histórico.
--   enviado_en   → momento en que se movió al histórico.

CREATE TABLE `documentos_historicos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `origen` ENUM('unidad', 'proveedor') NOT NULL,
    `origen_id` INTEGER NOT NULL,
    `origen_nombre` VARCHAR(150) NOT NULL,
    `nombre_original` VARCHAR(255) NOT NULL,
    `ruta_archivo` VARCHAR(500) NOT NULL,
    `tipo_mime` VARCHAR(100) NOT NULL,
    `subido_por` INTEGER NOT NULL,
    `subido_en` DATETIME(3) NOT NULL,
    `aprobado_por` INTEGER NOT NULL,
    `enviado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Índices para los filtros del módulo (por origen y búsqueda por nombre),
-- agregados por aparte con ALTER TABLE.
ALTER TABLE `documentos_historicos`
    ADD INDEX `documentos_historicos_origen_idx` (`origen`);

ALTER TABLE `documentos_historicos`
    ADD INDEX `documentos_historicos_nombre_original_idx` (`nombre_original`);
