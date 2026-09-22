-- El RFC identifica fiscalmente al proveedor. Con el alta por link (spec 001
-- HU-1) el catálogo ya no lo llena solo el administrador, así que la unicidad
-- deja de poder garantizarse con una comprobación en el controlador: dos
-- registros simultáneos con el mismo RFC crearían proveedores gemelos.
--
-- Admite varios NULL (MySQL no los considera duplicados), que es lo que
-- necesitan los proveedores dados de alta a mano sin RFC.
--
-- Comprobado antes de aplicar: 4 RFC no nulos, los 4 distintos.
CREATE UNIQUE INDEX `proveedores_rfc_key` ON `proveedores`(`rfc`);
