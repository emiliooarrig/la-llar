# Sistema de Diseño — La Llar (Panel de Gestión)

Sistema interno de gestión para una empresa de soluciones de cocina (multi-sucursal).
Roles: administrador, gerente, proveedor.

---

## Dirección y feel

**Tablero de pase de cocina**, no una grilla de analytics SaaS. El panel es la pizarra del briefing operativo: cálido, organizado, tangible. El administrador entra al inicio del día y debe leer el pulso operativo en 3 segundos (¿hay brigada?, ¿hay papeleo esperándome?, ¿el pase está abierto?, ¿checaron hoy?) y saltar al módulo correcto.

- **Temperatura:** cálida (mundo de cocina: fuego, harina, acero inox, hierba fresca).
- **Densidad:** media-espaciosa, respira pero es eficiente.
- **Tono:** serio pero acogedor. Profesional, nunca lúdico ni corporativo-frío.

**Regla anti-genérico:** ninguna pantalla debe poder identificarse como "dashboard de plantilla". Cada tarjeta/dato emerge de su significado operativo, no de un molde icono-arriba-número-grande-label-abajo repetido.

---

## Depth (profundidad) — UNA estrategia

**Sombras sutiles + bordes.** No mezclar con otras estrategias.

- Tarjetas/superficies: `border: 1.5px solid var(--color-gris)` + `box-shadow: var(--sombra-sm)`.
- Hover de elemento accionable: subir a `var(--sombra-md)` + `transform: translateY(-1px)`.
- Bordes que separan dentro de una tarjeta: `1px solid var(--color-gris-claro)` (más suave).
- Acento de estado: borde-izquierdo de 4px con color semántico (ej. ámbar si hay pendientes, verde si está en calma).
- Inputs: borde `1.5px`, focus = borde naranja + `box-shadow: 0 0 0 3px rgba(232,98,26,0.10)`.

Borde harsh = falla. Si el borde es lo primero que ves, está muy fuerte.

---

## Tokens (definidos en `frontend/src/index.css`)

NO usar hex sueltos en componentes; mapear a estos tokens. Los pocos hex permitidos por su significado fijo: acero `#1565C0` y ámbar `#E8A317` (no existen como token aún).

### Color
| Token | Valor | Significado |
|---|---|---|
| `--color-naranja` | `#E8621A` | Marca / acción primaria / fuego. Acento ÚNICO. |
| `--color-naranja-oscuro` | `#C44E0E` | Hover de acción, texto sobre tinte naranja |
| `--color-naranja-claro` | `#F58137` | — |
| `--color-blanco` | `#FFFFFF` | Superficie de tarjeta |
| `--color-blanco-hueso` | `#FAF8F5` | Canvas (harina/cerámica). Fondo de página e inputs "inset" |
| `--color-gris-claro` | `#F2F0ED` | Pistas de barra, separadores suaves, thead |
| `--color-gris` | `#D1CEC9` | Borde estándar |
| `--color-gris-medio` | `#9E9892` | Texto muted / metadata / iconos inactivos |
| `--color-texto` | `#2D2926` | Texto primario |
| `--color-texto-suave` | `#6B6560` | Texto secundario / labels |
| `--color-error` | `#D93025` | Destructivo / cerrado / revocado |
| `--color-exito` | `#2E7D32` | En orden / activo / abierto |

### Jerarquía de texto (4 niveles — usar los 4)
1. Primario → `--color-texto`
2. Secundario → `--color-texto-suave`
3. Metadata/muted → `--color-gris-medio`
4. Placeholder/disabled → `--color-gris-medio` con opacidad

### Radio y sombra
`--radio: 10px` (tarjetas) · `--radio-sm: 6px` (botones, inputs, contenedores de icono) · `--radio-lg: 16px` (modales).
`--sombra-sm` (reposo) · `--sombra-md` (hover) · `--sombra-lg` / `0 20px 60px rgba(0,0,0,.18)` (modal).

---

## Spacing

**Base 4px.** Múltiplos: 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 / 40.
- Gap entre iconos y texto: 8–12.
- Padding de tarjeta: 18–24 (simétrico).
- Gap de grid de tarjetas: 14–16.
- Separación entre secciones: 32–36.
- Padding de página (`.contenido`): `40px 32px` desktop, `24–28px 16px` móvil. `max-width` 1080–1200, centrado.

---

## Tipografía

`Inter, system-ui, sans-serif` (única familia).
- **Cifra hero** (número estrella): 46px / 700 / `letter-spacing: -0.03em` / `font-variant-numeric: tabular-nums`.
- **Cifra grande** (KPI secundario): 34px / 700 / `-0.02em` / tabular-nums.
- **Título de página:** 24–27px / 700 / `-0.02em`.
- **Título de tarjeta/módulo:** 15.5–16px / 600.
- **Eyebrow / etiqueta de sección:** 12px / 700 / `text-transform: uppercase` / `letter-spacing: 0.05–0.08em` / color `--color-texto-suave` o `--color-gris-medio`.
- **Body/desc:** 13–14px / 400–500 / `--color-texto-suave`.
- **Todo número de dato lleva `font-variant-numeric: tabular-nums`.**

---

## Color por rol (identidad)

El **rol es color de identidad** — reutilizar en badges, avatares, contenedores de icono, acentos. Tres colores ya presentes en el sistema:

| Rol | Color | Tinte fondo | Texto/icono |
|---|---|---|---|
| Administrador | naranja (marca) | `rgba(232,98,26,0.12)` | `--color-naranja-oscuro` |
| Gerente | acero `#1565C0` | `rgba(21,101,192,0.10)` | `#1565C0` |
| Proveedor | oliva (`--color-exito`) | `rgba(46,125,50,0.10)` | `--color-exito` |

## Color semántico de estado

| Estado | Color | Uso |
|---|---|---|
| En orden / activo / abierto | `--color-exito` | letrero "Abierta", badge "Con acceso", "Todo al día" |
| Atención / pendiente | ámbar `#E8A317` (texto `#9A6700`, tinte `rgba(232,163,23,0.16)`) | papeleo por revisar (lámpara de calor) |
| Cerrado / revocado / destructivo | `--color-error` | letrero "Cerrada", badge "Revocado" |
| Neutro / sin alcance | `--color-gris-claro` + `--color-gris-medio` | "Cerrada" apagada, "Acceso total" |

**Un solo acento (naranja).** El color comunica significado, nunca decora. Mismo hue para superficies; solo cambia la luz.

---

## Patrones de componente

### Contenedor de icono (presencia)
Iconos standalone van en un contenedor cuadrado tintado, nunca sueltos:
`width/height` 32 (KPI) o 46 (tarjeta de módulo), `border-radius: var(--radio-sm)`, fondo = tinte del tono (rol o semántico), color = versión oscura. Iconos: **set de línea SVG inline** (stroke `1.8–2`, `currentColor`), nunca emojis.

### Tarjeta de módulo (acceso) — `Dashboard`
`<Link>` horizontal: contenedor-icono tintado + (título 15.5/600 + desc 13/suave) + flecha que aparece al hover (`opacity 0→1`, `translateX(-4→0)`, color → naranja). Hover de tarjeta: borde naranja + `sombra-md` + `translateY(-1px)`.

### Tablero de KPIs ("tablero de pase") — SIGNATURE
Grid de 12 columnas; cada tarjeta con **estructura interna DISTINTA** según su dato (nunca 4 tiles iguales):
- **Hero + desglose de barras** (ej. brigada activa → barras proporcionales por sucursal). `grid-column: span 5; grid-row: span 2`.
- **Riel accionable** con borde-izq semántico (ámbar si hay trabajo / verde en calma) y sub-rieles clickables. `span 7`.
- **Letreros de estado** ABIERTA/CERRADA tipo placa de ventanilla, filas clickables. `span 4`.
- **Barra de llenado** (presentes/plantilla) + nota de contexto que evita el "cero muerto" (ej. "última actividad: 29 may"). `span 3`.

Colapsa a 2 columnas ≤980px (hero a ancho completo) y 1 columna ≤640px.
Barras: pista `--color-gris-claro` h6–8px radio 3–4px; relleno `--color-naranja`; transición `width 0.5s cubic-bezier(0.22,1,0.36,1)`.
Encabezado común de tarjeta: contenedor-icono + eyebrow uppercase.

### Tarjeta de identidad (listas de personas) — `Usuarios`
Avatar circular con iniciales (color del rol) + (nombre 600 + email 12.5/suave apilados) + chip de alcance (sucursal/proveedor) + badge de rol (punto + texto, color del rol). Fila propia marcada con chip "Tú".

### Selector segmentado (en vez de `<select>` para decisiones clave)
Tarjetas-botón en grid (ej. elegir rol): icono en círculo + label; estado activo = borde + `box-shadow: 0 0 0 3px rgba(color,0.10)` + tinte del color. Elegir una opción revela campos condicionales (`animation` de entrada suave).

### Tabla
Wrapper: `--color-blanco` + borde `1.5px` + `--radio` + overflow hidden + `sombra-sm`. `thead` fondo `--color-gris-claro`, th uppercase 12px. Filas hover `rgba(250,248,245,0.8)`. Fila inactiva `opacity: 0.55`. Pie con conteo "Mostrando X de Y".

### Modal
Overlay `rgba(45,41,38,0.45)` + `fadeIn`. Caja `--radio-lg`, `max-width` 480–520, `slideUp 0.2s`. Header (título 18/700 + botón cerrar) / cuerpo (gap 18, scroll si crece) / pie (Cancelar fantasma + Guardar naranja con spinner).

### Footer — `components/Footer.jsx`
Pie compartido en TODO módulo salvo el Login (sistema interno: sin redes sociales ni enlaces externos). **Signature:** remate superior con **perforación de comanda** (`::before` con `repeating-linear-gradient(90deg, gris 0 7px, transparent 7px 15px)`, alto 2px) — el borde de corte del ticket, atando con el lenguaje de comandas del tablero y la bandeja. Interior `max-width 1200`, flex space-between: izquierda = sello "La Llar" (chip naranja) + nombre "Sistema de Gestión Interna" + tag muted "Soluciones de cocina"; derecha = píldora uppercase "Uso interno" (con candado SVG) + `© {año} La Llar · vX.Y` (tabular-nums). Se ancla al fondo con `margin-top: auto`, lo que exige que `.pagina` sea `display:flex; flex-direction:column; min-height:100vh` (header sticky + main + footer como hijos flex; modales overlay quedan fuera de flujo). Colapsa a columna ≤680px.

### Marca = volver al menú — `components/LogoInicio.jsx`
El **logo ES el acceso al menú principal**: en TODO módulo (incl. Dashboard, salvo Login) el logo del header va envuelto en `LogoInicio`, un botón **role-aware** (admin→/admin, gerente→/gerente, proveedor→/proveedor) que navega al Dashboard del rol. Reemplaza al antiguo botón pill "Menú" (`BotonMenu`, eliminado). Uso: `<LogoInicio className={styles.logoSmall} />` como primer hijo de `.marca` (el `className` controla el tamaño del logo). Botón transparente sin borde; microfeedback `opacity .85` + `translateY(-1px)` al hover; anillo de foco naranja `0 0 0 3px rgba(232,98,26,0.18)` para accesibilidad. Patrón "logo = home" universal.

### Estados de dato (obligatorios)
- **Cargando:** skeleton con shimmer (`linear-gradient` que cruza, `1.3s`), respetando el tamaño final de la tarjeta. Spinner naranja para tablas.
- **Vacío:** mensaje centrado en `--color-texto-suave`.
- **Error:** caja con borde-izq `--color-error` + botón "Reintentar".
- Todo elemento interactivo: hover, focus, disabled.

---

## Animación
Micro-interacciones 0.15s; transiciones de barra/llenado 0.5s con `cubic-bezier(0.22,1,0.36,1)` (deceleración). Sin spring/bounce.

---

## Checklist anti-default (correr antes de mostrar)
1. **Swap test:** ¿si cambio el layout por un dashboard genérico se sentiría distinto? Debe sentirse.
2. **Squint test:** al desenfocar se percibe jerarquía y nada salta (bordes susurran).
3. **Signature test:** puedo señalar ≥5 elementos del "tablero de pase" / identidad por rol.
4. **Token test:** las clases suenan al dominio (`.estacion`, `.letrero`, `.riel`, `.brigada`, `.tablero`), no `.card-1`.
5. Cuatro niveles de texto en uso, no dos.
6. Un solo acento (naranja); el resto comunica estado/rol.
