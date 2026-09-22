-- `dias_credito` pasa a admitir NULL para poder distinguir dos cosas que un
-- `DEFAULT 0` no nulo confunde:
--   0    → el proveedor paga de contado (condición comercial decidida)
--   NULL → nadie ha configurado sus días de crédito todavía
--
-- La spec 001 HU-10 lo exige: el resumen semanal asume 0 en ambos casos pero
-- solo debe marcar como "sin configurar" los que de verdad lo están.
--
-- Los valores existentes pasan a NULL porque la columna se creó en este mismo
-- ciclo con el default y ningún proveedor tiene todavía un plazo pactado en
-- el sistema: el 0 que tienen es el del DEFAULT, no una decisión de nadie.
ALTER TABLE `proveedores` MODIFY `dias_credito` INT NULL DEFAULT NULL;
UPDATE `proveedores` SET `dias_credito` = NULL WHERE `dias_credito` = 0;
