-- Nuevo módulo de ventana: permiso temporal (intervalo desde/hasta) para que
-- los gerentes puedan editar las asistencias de los empleados de su unidad.
ALTER TABLE `ventanas_carga` MODIFY `modulo` ENUM('proveedores', 'unidades', 'asistencias') NOT NULL;

INSERT INTO `ventanas_carga` (`modulo`, `abierta`) VALUES ('asistencias', false);
