-- Datos personales básicos de los empleados (nómina).
-- Se agregan como columnas opcionales para no afectar registros existentes:
--   fecha_nacimiento → fecha de nacimiento (solo fecha, sin hora).
--   rfc              → RFC de persona física (13 caracteres).
--   curp             → CURP (18 caracteres).

ALTER TABLE `empleados`
    ADD COLUMN `fecha_nacimiento` DATE NULL,
    ADD COLUMN `rfc` VARCHAR(13) NULL,
    ADD COLUMN `curp` VARCHAR(18) NULL;
