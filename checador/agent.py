#!/usr/bin/env python3
"""
Agente del checador NGTeco (La Llar).

Se conecta por TCP/IP a un checador NGTeco usando pyzk, lee periódicamente
las marcas nuevas de asistencia y las reenvía al backend Express vía el
webhook protegido `POST /api/webhook/asistencia`.

Tolerancia a fallos:
  - Si el envío HTTP falla (timeout, red caída, API no disponible), la marca
    NO se descarta: se guarda en una cola local SQLite (cola_pendiente.db).
  - La cola se reintenta de forma periódica; cada marca tiene un contador de
    intentos y se descarta solo tras MAX_INTENTOS.
  - Cada marca se procesa dentro de su propio try/except: un fallo individual
    nunca detiene el agente ni corta la conexión con el checador.

Configuración (archivo .env junto a este script):
  CHECADOR_IP        IP del checador            (requerido)
  CHECADOR_PORT      Puerto TCP del checador    (por defecto 4370)
  API_URL            Base del backend Express   (por defecto http://localhost:4000)
  DEVICE_TOKEN       Token x-device-token        (requerido)
  DISPOSITIVO_ID     Etiqueta del dispositivo   (por defecto "NGTECO")
"""

import os
import sys
import time
import logging
import sqlite3
from datetime import datetime

import requests
from dotenv import load_dotenv

try:
    from zk import ZK
except ImportError:
    print("Falta la dependencia 'pyzk'. Instala con: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

# ── Configuración ────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

CHECADOR_IP = os.getenv("CHECADOR_IP", "192.168.0.175").strip()
CHECADOR_PORT = int(os.getenv("CHECADOR_PORT", "4370"))
API_URL = os.getenv("API_URL", "http://localhost:4000").rstrip("/")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "").strip()
DISPOSITIVO_ID = os.getenv("DISPOSITIVO_ID", "NGTECO").strip()

WEBHOOK_URL = f"{API_URL}/api/webhook/asistencia"
DB_PATH = os.path.join(BASE_DIR, "cola_pendiente.db")

INTERVALO_POLLING = 30   # segundos entre lecturas del checador
MAX_INTENTOS = 5         # reintentos máximos por marca antes de descartarla
HTTP_TIMEOUT = 10        # segundos de timeout por petición HTTP

# Mapeo de los estados de marca del checador (punch) a nuestro tipo.
# NGTeco/ZK: 0=Check In, 1=Check Out, 4=Overtime In, 5=Overtime Out.
# Como respaldo, los pares se tratan como entrada y los impares como salida.
PUNCH_A_TIPO = {0: "entrada", 1: "salida", 4: "entrada", 5: "salida"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("checador")


# ── Cola local (SQLite) ──────────────────────────────────────────────────────
def init_db():
    """Crea la cola de reintentos y la tabla de estado si no existen."""
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS cola_pendiente (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                lector_uid TEXT    NOT NULL,
                tipo       TEXT    NOT NULL,
                timestamp  TEXT    NOT NULL,
                intentos   INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        db.execute(
            "CREATE TABLE IF NOT EXISTS estado (clave TEXT PRIMARY KEY, valor TEXT)"
        )


def guardar_en_cola(lector_uid, tipo, timestamp):
    """Persiste una marca que no se pudo enviar, con el contador de intentos en 0."""
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            "INSERT INTO cola_pendiente (lector_uid, tipo, timestamp, intentos) VALUES (?, ?, ?, 0)",
            (lector_uid, tipo, timestamp),
        )
    log.warning("Marca encolada para reintento: uid=%s tipo=%s ts=%s", lector_uid, tipo, timestamp)


def obtener_estado(clave, por_defecto=None):
    with sqlite3.connect(DB_PATH) as db:
        fila = db.execute("SELECT valor FROM estado WHERE clave = ?", (clave,)).fetchone()
    return fila[0] if fila else por_defecto


def guardar_estado(clave, valor):
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            "INSERT INTO estado (clave, valor) VALUES (?, ?) "
            "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            (clave, str(valor)),
        )


# ── Envío HTTP ───────────────────────────────────────────────────────────────
def enviar_asistencia(lector_uid, tipo, timestamp):
    """POST al webhook. Lanza excepción si la respuesta no es 2xx (o si falla la red)."""
    respuesta = requests.post(
        WEBHOOK_URL,
        headers={"x-device-token": DEVICE_TOKEN},
        json={
            "lector_uid": lector_uid,
            "tipo": tipo,
            "timestamp": timestamp,
            "dispositivo_id": DISPOSITIVO_ID,
        },
        timeout=HTTP_TIMEOUT,
    )
    if not (200 <= respuesta.status_code < 300):
        raise RuntimeError(f"HTTP {respuesta.status_code}: {respuesta.text[:200]}")


def procesar_cola():
    """Reintenta las marcas pendientes con menos de MAX_INTENTOS intentos.

    Las que se envían se eliminan; las que fallan incrementan su contador.
    """
    with sqlite3.connect(DB_PATH) as db:
        pendientes = db.execute(
            "SELECT id, lector_uid, tipo, timestamp, intentos FROM cola_pendiente WHERE intentos < ?",
            (MAX_INTENTOS,),
        ).fetchall()

    if not pendientes:
        return

    log.info("Procesando %d marca(s) pendiente(s) en la cola...", len(pendientes))
    for fila_id, lector_uid, tipo, timestamp, intentos in pendientes:
        try:
            enviar_asistencia(lector_uid, tipo, timestamp)
            with sqlite3.connect(DB_PATH) as db:
                db.execute("DELETE FROM cola_pendiente WHERE id = ?", (fila_id,))
            log.info("Marca reenviada y removida de la cola: uid=%s ts=%s", lector_uid, timestamp)
        except Exception as e:  # noqa: BLE001 — un fallo no debe detener el resto
            with sqlite3.connect(DB_PATH) as db:
                db.execute(
                    "UPDATE cola_pendiente SET intentos = intentos + 1 WHERE id = ?", (fila_id,)
                )
            log.warning(
                "Reintento fallido (%d/%d) uid=%s: %s", intentos + 1, MAX_INTENTOS, lector_uid, e
            )


# ── Checador ─────────────────────────────────────────────────────────────────
def mapear_tipo(att):
    """Traduce el estado de marca (punch) del checador a 'entrada'/'salida'."""
    punch = getattr(att, "punch", None)
    if punch in PUNCH_A_TIPO:
        return PUNCH_A_TIPO[punch]
    if isinstance(punch, int):
        return "entrada" if punch % 2 == 0 else "salida"
    return "entrada"


def conectar_checador():
    """Abre la conexión TCP/IP con el checador NGTeco."""
    zk = ZK(CHECADOR_IP, port=CHECADOR_PORT, timeout=HTTP_TIMEOUT, force_udp=False, ommit_ping=True)
    conn = zk.connect()
    log.info("Conectado al checador en %s:%d", CHECADOR_IP, CHECADOR_PORT)
    return conn


def procesar_nuevas_marcas(conn):
    """Lee las marcas del checador y reenvía solo las posteriores a la última vista."""
    registros = conn.get_attendance() or []

    ultimo = obtener_estado("ultimo_timestamp")
    ultimo_dt = datetime.fromisoformat(ultimo) if ultimo else None

    # Primer arranque sin estado: fija la línea base en la marca más reciente del
    # dispositivo para no reenviar todo el histórico ya almacenado en la BD.
    if ultimo_dt is None:
        if registros:
            base = max(att.timestamp for att in registros)
            guardar_estado("ultimo_timestamp", base.isoformat())
            log.info("Primer arranque: línea base fijada en %s (histórico omitido).", base)
        return

    nuevos = sorted((att for att in registros if att.timestamp > ultimo_dt), key=lambda a: a.timestamp)
    if not nuevos:
        return

    log.info("%d marca(s) nueva(s) detectada(s).", len(nuevos))
    max_ts = ultimo_dt
    for att in nuevos:
        lector_uid = str(att.user_id)
        tipo = mapear_tipo(att)
        timestamp = att.timestamp.strftime("%Y-%m-%dT%H:%M:%S")
        try:
            enviar_asistencia(lector_uid, tipo, timestamp)
            log.info("Marca enviada: uid=%s tipo=%s ts=%s", lector_uid, tipo, timestamp)
        except Exception as e:  # noqa: BLE001 — encolar y seguir con la siguiente
            log.warning("Envío fallido (uid=%s): %s", lector_uid, e)
            guardar_en_cola(lector_uid, tipo, timestamp)
        # Avanza la línea base aunque haya fallado: la marca quedó en la cola.
        if att.timestamp > max_ts:
            max_ts = att.timestamp

    guardar_estado("ultimo_timestamp", max_ts.isoformat())


# ── Bucle principal ──────────────────────────────────────────────────────────
def validar_config():
    faltantes = []
    if not CHECADOR_IP:
        faltantes.append("CHECADOR_IP")
    if not DEVICE_TOKEN:
        faltantes.append("DEVICE_TOKEN")
    if faltantes:
        log.error("Faltan variables en .env: %s", ", ".join(faltantes))
        sys.exit(1)


def main():
    validar_config()
    init_db()
    log.info("Agente del checador iniciado. Webhook: %s", WEBHOOK_URL)

    # Antes de escuchar nuevas marcas, vacía la cola de reintentos pendientes.
    try:
        procesar_cola()
    except Exception as e:  # noqa: BLE001
        log.error("Error procesando la cola al arrancar: %s", e)

    conn = None
    while True:
        try:
            if conn is None:
                conn = conectar_checador()

            procesar_nuevas_marcas(conn)
            procesar_cola()

        except KeyboardInterrupt:
            log.info("Detención solicitada por el usuario.")
            break
        except Exception as e:  # noqa: BLE001 — nunca dejar morir el agente
            log.error("Error en el ciclo principal: %s", e)
            # La conexión pudo quedar inservible: se reabrirá en la próxima vuelta.
            try:
                if conn is not None:
                    conn.disconnect()
            except Exception:  # noqa: BLE001
                pass
            conn = None

        time.sleep(INTERVALO_POLLING)

    if conn is not None:
        try:
            conn.disconnect()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    main()
