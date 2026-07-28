-- Idempotencia de marcas del checador.
-- Clave natural única (empleado_id, tipo, timestamp): un checador no produce
-- dos marcas idénticas para el mismo empleado en el mismo segundo. Evita
-- duplicados cuando el agente reenvía una marca que el backend ya guardó
-- (entrega at-least-once tras un timeout posterior al commit).

ALTER TABLE `asistencias`
    ADD UNIQUE INDEX `asistencias_empleado_id_tipo_timestamp_key` (`empleado_id`, `tipo`, `timestamp`);
