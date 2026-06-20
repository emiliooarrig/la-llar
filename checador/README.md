# Agente del checador NGTeco

Salda la deuda técnica de la integración directa a MySQL: en lugar de que el
checador inserte en la base de datos, este agente lee las marcas del dispositivo
por TCP/IP y las reenvía al backend a través del webhook protegido
`POST /api/webhook/asistencia`.

## Cómo funciona

1. Al arrancar, procesa la **cola local de reintentos** (`cola_pendiente.db`)
   por si quedaron marcas sin enviar.
2. Entra en un bucle que hace *polling* al checador **cada 30 s**.
3. Por cada marca nueva extrae `lector_uid`, `tipo` (entrada/salida) y
   `timestamp`, y la envía al webhook con el header `x-device-token`.
4. Si el envío falla (timeout, red caída, API caída), la marca se guarda en la
   cola SQLite local y se reintenta luego (hasta 5 intentos por marca).

El backend identifica al empleado por `lector_uid` **dentro de la unidad** a la
que pertenece el token del dispositivo, porque el mismo `lector_uid` puede
repetirse entre cocinas.

## Instalación

```bash
cd checador
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # y edita los valores
```

## Configuración (`.env`)

| Variable        | Descripción                                   | Por defecto              |
|-----------------|-----------------------------------------------|--------------------------|
| `CHECADOR_IP`   | IP del checador NGTeco (requerido)            | —                        |
| `CHECADOR_PORT` | Puerto TCP del checador                        | `4370`                   |
| `API_URL`       | Base del backend Express                       | `http://localhost:4000`  |
| `DEVICE_TOKEN`  | Token del dispositivo (`x-device-token`)       | —                        |
| `DISPOSITIVO_ID`| Etiqueta del dispositivo (auditoría)           | `NGTECO`                 |

El `DEVICE_TOKEN` debe coincidir con uno de los configurados en
`backend/.env → CHECADOR_DISPOSITIVOS`, que es quien ata el dispositivo a su
unidad.

## Ejecución

```bash
python3 agent.py
```

En producción conviene supervisarlo (systemd, pm2 o similar) para que se
reinicie automáticamente.
