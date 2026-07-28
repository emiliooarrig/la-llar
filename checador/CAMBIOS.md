# Cambios en la integración de checadores

> Fecha: 2026-07-26
> Alcance: webhook de asistencias (`POST /api/webhook/asistencia`), esquema de
> base de datos, seed de demostración y formulario de Empleados.

Este documento resume los cambios hechos sobre la integración de los checadores
físicos, el motivo de cada uno y cómo se verificaron.

---

## Contexto

Los checadores no insertan directo a MySQL: el agente `checador/agent.py` lee las
marcas por TCP/IP y las reenvía al webhook protegido con token de dispositivo
(`x-device-token`). El token ata el dispositivo a **una** unidad; el empleado se
resuelve por `lector_uid` **dentro de esa unidad**, porque el mismo `lector_uid`
puede repetirse entre cocinas.

Durante una batería de pruebas al webhook (mismo `lector_uid` en distintas
sucursales) se confirmó que la **distinción por unidad funciona correctamente**,
y se detectaron dos anomalías. Los cambios de abajo corresponden a esas dos.

---

## 1. Idempotencia del webhook (marcas duplicadas)

### Problema

El webhook insertaba la marca de forma incondicional y no existía candado de
unicidad. El agente usa entrega **at-least-once**: si el POST falla por timeout
—incluso cuando el backend ya había guardado la marca— la marca se re-encola y se
reenvía. Resultado: **filas duplicadas** en `asistencias` (se reprodujo enviando
la misma marca 4 veces → 4 filas), inflando conteos y jornadas.

### Solución

Clave natural única sobre la marca cruda: un checador no produce dos marcas
idénticas (mismo empleado, mismo tipo, mismo segundo).

- **`backend/prisma/schema.prisma`** — modelo `asistencias`:
  ```prisma
  @@unique([empleado_id, tipo, timestamp])
  ```
- **Migración** `backend/prisma/migrations/20260726150000_asistencias_idempotencia/`
  agrega el `UNIQUE INDEX` `asistencias_empleado_id_tipo_timestamp_key`.
- **`backend/src/controllers/webhookController.js`** — el `create` captura el
  error `P2002` (violación de la clave única): si la marca ya existía, responde
  **`200 { registrado: false, duplicada: true }`** con el `id` de la marca
  original, en lugar de crear un duplicado. `empleadoId` se declara fuera del
  `try` para poder localizar la marca existente en el `catch`.

### Comportamiento resultante

| Envío | Respuesta |
|-------|-----------|
| Primera marca | `201 { registrado: true }` |
| Reenvío de la misma marca | `200 { registrado: false, duplicada: true }` (mismo `id`, sin insertar) |

El agente considera "entregada" cualquier respuesta `2xx`, así que el `200` hace
que saque la marca de su cola de reintentos sin generar duplicados. **No hubo que
cambiar el agente.**

### Verificación

- Antes de aplicar el índice se comprobó que no hubiera duplicados previos que lo
  bloquearan (0 grupos duplicados).
- Con la misma marca enviada 4 veces: `201` la primera, `200 duplicada` las tres
  siguientes → **1 sola fila**.
- La distinción por unidad sigue intacta: el mismo `lector_uid`/tipo/timestamp en
  otra sucursal es otro `empleado_id`, por lo que tiene su propia clave natural y
  sí se registra.

---

## 2. Convención de `lector_uid` alineada al ID del dispositivo

### Problema

El agente envía `lector_uid = str(att.user_id)` — el **ID de usuario numérico**
que asigna el checador NGTeco (`"1"`, `"2"`, …). El seed y el formulario usaban
`UID001…UID012`. Con esa convención, en producción **toda marca real daría 404**
("Empleado no encontrado en esta unidad"), salvo que el administrador capturara a
mano los IDs numéricos del dispositivo.

### Solución (puntos 1 y 2 de la propuesta)

1. **Seed (`backend/prisma/seed.js`)**
   - Los 12 empleados de demo usan ahora el ID numérico del checador. Los valores
     `'1'`, `'2'` y `'3'` **se repiten entre las 4 sucursales** (p. ej. `uid '1'`
     existe en Central, Norte, Sur y Oriente), reflejando el caso real y haciendo
     que los propios datos de ejemplo demuestren la distinción por unidad.
   - `generarAsistencias(admin, { central, norte })` acota los lookups por
     sucursal (`lector_uid + sucursal_id`), porque el UID ya no es único global y
     un `findFirst` solo por `lector_uid` podría traer al empleado equivocado.

2. **Formulario de Empleados (`frontend/src/pages/Empleados.jsx`)**
   - Placeholder: `Ej. UID013` → `Ej. 13`.
   - Texto de ayuda corregido (antes decía "Debe ser irrepetible", engañoso):
     ahora *"Debe coincidir exactamente con el ID de usuario configurado en el
     checador (normalmente numérico). Único dentro de cada sucursal."*

### Migración de datos existentes

- Los empleados de demo que ya estaban en la BD con `UID001…` se **actualizaron
  en su lugar** (mismos `id`, conservando sus asistencias/justificaciones/
  correcciones) en lugar de recrearlos, para no duplicar filas. Los espacios de
  nombres viejo (`UID0xx`) y nuevo (`1`, `2`, `3`) no se solapan, así que la
  actualización no provoca colisión con la clave única `(lector_uid, sucursal_id)`.
- Se respetó al empleado creado manualmente **#16 "Emilio Arriaga Guzman"
  (uid `13`)**: no es dato de demo y no se tocó.
- No se creó una migración Prisma para este punto: es un cambio de datos + código
  (el tipo de la columna `lector_uid` no cambió).

> **Nota operativa:** si algún checador real ya estaba dado de alta con otra
> convención de IDs, hay que capturar cada `lector_uid` tal como lo emite el
> dispositivo, o las marcas darán 404.

---

## 3. Propuestas pendientes (no implementadas)

Del análisis del problema #2 quedaron dos mejoras propuestas, aún sin aplicar:

- **Normalización canónica del `lector_uid`.** Definir una forma única (el NGTeco
  no rellena con ceros → guardar el numérico tal cual, sin padding) y aplicarla
  igual en el agente y en el alta de empleados, para evitar desajustes por
  ceros/espacios.
- **Diagnóstico de UIDs desconocidos.** Hoy un `lector_uid` no encontrado responde
  `404` de forma silenciosa. Se propuso loguear en el webhook esos 404 (uid +
  unidad) para detectar rápido qué empleados faltan por mapear al arrancar un
  checador nuevo.

---

## Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `backend/prisma/schema.prisma` | `@@unique([empleado_id, tipo, timestamp])` en `asistencias` |
| `backend/prisma/migrations/20260726150000_asistencias_idempotencia/migration.sql` | Nuevo `UNIQUE INDEX` |
| `backend/src/controllers/webhookController.js` | Manejo idempotente de `P2002` (respuesta `200 duplicada`) |
| `backend/prisma/seed.js` | `lector_uid` numérico y repetido entre unidades; lookups de asistencias acotados por sucursal |
| `frontend/src/pages/Empleados.jsx` | Placeholder y texto de ayuda del campo `lector_uid` |
