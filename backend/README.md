# Backend — Sistema de Gestión La Llar

API REST en Node.js + Express sobre MySQL con Prisma. Sirve a `frontend/` y recibe las
marcas de los checadores a través de `checador/agent.py`.

---

## Requisitos

- Node.js 20 o superior (el runner de pruebas es el integrado de Node).
- MySQL / MariaDB corriendo y accesible desde `DATABASE_URL`.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # y completar los valores reales
npm run db:migrate        # aplica las migraciones de prisma/migrations
npm run db:seed           # admin inicial, ventanas de carga y catálogo de empresas
npm run dev               # nodemon en el puerto de PORT (por defecto 4000)
```

## Scripts

| Script                | Qué hace                                                      |
|-----------------------|---------------------------------------------------------------|
| `npm run dev`         | Servidor con recarga automática (nodemon).                    |
| `npm start`           | Servidor en modo producción.                                  |
| `npm test`            | Corre toda la suite de pruebas.                               |
| `npm run test:watch`  | Igual, re-ejecutando al guardar.                              |
| `npm run db:migrate`  | `prisma migrate dev`.                                         |
| `npm run db:generate` | Regenera el cliente de Prisma.                                |
| `npm run db:seed`     | Seed idempotente de producción.                               |
| `npm run db:studio`   | Explorador visual de la base de datos.                        |

## Pruebas

El runner es el **integrado de Node** (`node --test`), no Vitest ni Jest: las pruebas
que ya existían en el repo (`jwtRevocacion`, `loginRateLimit`, `uploadFormato`) se
escribieron con `node:test` y no hay ninguna necesidad que un runner externo cubra y
éste no. Se evita así una dependencia más y una reescritura de suites que funcionan.

```bash
npm test                                   # toda la suite
node --test tests/empresas.test.js         # un solo archivo
node --test --test-name-pattern "empresa"  # por nombre de prueba
```

**Las pruebas corren contra la base de datos real** que indique `DATABASE_URL`, no
contra mocks: son pruebas de integración de endpoints, como pide la constitución del
proyecto (§8). Cada suite crea los registros temporales que necesita y los borra al
terminar (`test.before` / `test.after`), así que se pueden correr repetidas veces sin
ensuciar los datos. Requisitos para que pasen:

- La base de datos debe estar levantada y migrada (`npm run db:migrate`).
- `npm run db:seed` debe haberse corrido al menos una vez (varias pruebas dan por
  hecho que existe el catálogo de empresas).

Convenciones al añadir una suite: un archivo `tests/<tema>.test.js`, nombres de prueba
en español que describan el invariante (no el método), y limpieza de lo que se creó.

## Estructura

```
prisma/
  schema.prisma          fuente única del modelo de datos
  migrations/            migraciones versionadas (no se editan una vez aplicadas)
  seed.js                seed idempotente de producción
scripts/
  backfill_empresas_sucursales.js   asigna empresa a cada sucursal
  demo/                  datos de muestra para demostraciones
src/
  index.js               arranque y montaje de routers
  routes/                un router por dominio
  controllers/           lógica de cada dominio
  middleware/            auth, upload, rateLimit, deviceAuth
tests/                   pruebas de integración
uploads/                 archivos subidos (no versionado)
```

## Variables de entorno

Ver `.env.example`. Las que no son evidentes:

- `TRUST_PROXY` — saltos de proxy delante del backend. `0` = expuesto directo.
  Necesario para que el rate limit del login distinga IPs reales.
- `CHECADOR_DISPOSITIVOS` — JSON con los checadores autorizados (token, unidad).
- `EMPRESA_POR_DEFECTO` — empresa a la que se asignan las sucursales sin mapa
  explícito en el backfill. Por defecto `La Llar`.
- `MAPA_SUCURSAL_EMPRESA` — JSON `{"<sucursal>": "<empresa>"}` para el backfill.
