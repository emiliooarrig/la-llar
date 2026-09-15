# Sistema de Diseño — La Llar (Panel de Gestión)

Sistema interno de gestión para una empresa de soluciones de cocina (multi-sucursal).
Roles: administrador, gerente, proveedor.

---

## Dirección y feel

**Tablero de pase de cocina**, no una grilla de analytics SaaS. El panel es la pizarra
del briefing operativo: cálido, organizado, tangible. El administrador entra al inicio
del día y debe leer el pulso operativo en 3 segundos (¿hay brigada?, ¿hay papeleo
esperándome?, ¿el pase está abierto?, ¿checaron hoy?) y saltar al módulo correcto.

- **Temperatura:** cálida (fuego, harina, acero inox, hierba fresca).
- **Densidad:** media, ajustable por el usuario (cómoda / compacta).
- **Tono:** serio pero acogedor. Profesional, nunca lúdico ni corporativo-frío.

**Regla anti-genérico:** ninguna pantalla debe poder identificarse como "dashboard de
plantilla". Cada tarjeta o dato emerge de su significado operativo, no de un molde
icono-arriba-número-grande-label-abajo repetido.

---

## Arquitectura de estilos — leer antes de escribir CSS

El sistema completo se carga **una sola vez** desde `src/index.css`:

| Hoja | Contenido |
|---|---|
| `styles/tokens.css` | Color, borde, sombra, radio, espaciado, densidad |
| `styles/base.css` | Reset, tipografía, foco visible, impresión, movimiento reducido |
| `styles/shell.css` | Barra superior, rail de módulos, lienzo, migas, menú de cuenta, pie |
| `styles/controles.css` | Botones, campos, insignias, filtros, chips, modal, menú de acciones |
| `styles/datos.css` | Tabla, estados de dato, paginación, utilidades `mono` / `apilado` |
| `styles/alertas.css` | Tema de SweetAlert2 |

**Un módulo CSS de página sólo contiene lo que es exclusivamente de esa página.**
Si algo se repite en dos pantallas, sube a la hoja global correspondiente. El shell,
la tabla y el modal llegaron a estar duplicados en siete archivos: no volver ahí.

**Nada de hex sueltos.** Todo color baja de `tokens.css`. Las únicas excepciones vivas
son los grises del bloque `@media print`.

---

## Depth (profundidad) — UNA estrategia

**Borde + sombra susurrada.** No mezclar con otras.

- Superficies: `border: var(--borde)` + `box-shadow: var(--sombra-sm)`.
- Hover de elemento accionable: cambio de **color de borde**, nunca de posición.
- Separadores internos: `var(--borde-suave)`.
- Acento de estado: borde-izquierdo de 3–4px con color semántico.
- Inputs: `var(--borde)`, fondo hueso (inset); foco = borde naranja + `var(--anillo-foco)`.

Borde harsh = falla. Si el borde es lo primero que ves, está muy fuerte.

---

## Color

Tokens en `styles/tokens.css`. Los que antes eran hex sueltos ya son tokens:
`--color-ambar` (lámpara de calor / atención) y `--color-acero` (identidad de gerente).

### Jerarquía de texto (cuatro niveles — usar los cuatro)
`--color-texto` → `--color-texto-suave` → `--texto-muted` → `--texto-desactivado`.

### Color por rol (identidad)
| Rol | Color | Tinte |
|---|---|---|
| Administrador | `--color-naranja` | `--tinte-naranja` |
| Gerente | `--color-acero` | `--tinte-acero` |
| Proveedor | `--color-exito` | `--tinte-exito` |

El cuadro de iniciales lleva el color del rol; **no** se añade una píldora que repita
en texto lo que el color ya dice en la barra superior.

### Estado
`--estado-pendiente` (ámbar) · `--estado-aprobado` (oliva) · `--estado-rechazado` (rojo).
Un solo acento (naranja). El color comunica significado, nunca decora.

---

## Movimiento — casi nada

Software empresarial: el usuario repite la misma tarea cincuenta veces al día, y una
animación que agrada la primera vez estorba la número cuarenta.

- **Permitido:** transiciones de 0.15s en `color`, `background-color`, `border-color`,
  `box-shadow`. Son respuesta al usuario, no adorno.
- **Prohibido:** `transform` en hover (nada de `translateY(-1px)`), entradas `slideUp`
  / `fadeIn`, esqueletos con destello, barras que crecen animadas.
- **Única animación del sistema:** el spinner, y sólo donde hay una espera real.
- `@media (prefers-reduced-motion: reduce)` está en `base.css` y anula lo que quede.

---

## Navegación

- **Rail de módulos** (`components/NavRail.jsx`), alimentado por `lib/modulos.js`.
  Fondo igual al lienzo, separado sólo por un borde; activo = tinte + canto naranja +
  `aria-current`. No se pinta para roles con menos de dos módulos.
  A ≤900px se acuesta bajo la barra y se desliza en horizontal (sin hamburguesa).
- **`components/Layout.jsx` es el armazón de todo módulo:** barra, rail, migas,
  encabezado de página, lienzo y pie. Ninguna página vuelve a montar su propio header.
- **`document.title`** lo pone `Layout` a partir del título de la página.
- **Cada rol aterriza en su trabajo** (`INICIO_POR_ROL`): el administrador en el panel;
  el gerente en asistencias; el proveedor en sus documentos. Sólo el administrador tiene
  panel — con rail al lado, una portada de tarjetas de acceso era ruido.

---

## Estado en la URL

Los filtros viven en el querystring vía `hooks/useFiltrosURL.js`: el botón atrás
funciona, recargar no pierde el contexto y una vista se puede compartir por mensaje.
Sólo se escriben los valores distintos del predeterminado.

---

## Escala de respuesta al usuario

| Situación | Forma |
|---|---|
| Validación de formulario | Inline bajo el campo (`components/Campo.jsx`) + `aria-invalid` |
| Éxito rutinario | `toast()` — cinta en la esquina, se va sola |
| Error que corta la tarea | `avisoError()` |
| Acción irreversible o que afecta a otra persona | `confirmar()` |

Todo pasa por `lib/alertas.js`. **Nunca importar `sweetalert2` en una página.**
Aprobar y rechazar documentos **no** se confirman: son reversibles, y pedir "¿seguro?"
por cada uno convertía una bandeja de veinte en sesenta clics.

---

## Componentes compartidos

| Componente | Para qué |
|---|---|
| `Layout` | Armazón de módulo (barra, rail, migas, encabezado, pie) |
| `TablaDatos` | Tabla con thead fijo, orden por columna, paginación y los tres estados |
| `BarraFiltros` | Buscador + selects + limpiar + conteo |
| `Modal` | Diálogo con foco atrapado, Escape y `aria-modal` |
| `Campo` | Etiqueta + control + error/pista |
| `EstadoDato` | Cargando / vacío / error, con reintento |
| `Insignia`, `Formato` | Estado documental y tipo de archivo |
| `MenuAcciones` | Acciones secundarias de fila (portal: la tabla lo recortaría) |
| `VentanaCarga` | Estado y programación de la ventana de carga |
| `Iconos` | Set de línea único (trazo 1.8, `currentColor`) |

Pares de pantallas que sólo cambian de sustantivo se resuelven con **un componente
parametrizado**, no con dos archivos: `DetalleDocumentos`, `PanelMisDocumentos`,
`CatalogoDocumentos`. Proveedor y unidad son el mismo flujo.

---

## Patrones con firma

- **Tablero de pase** (`Dashboard`): grid de 12 columnas donde cada tarjeta tiene
  estructura interna distinta según lo que mide. Nunca cuatro recuadros iguales.
- **Cola de comandas** (`Pendientes`): tickets con lámpara de calor ámbar/verde y
  resolución en línea.
- **Censo que filtra** (`Usuarios`): el conteo por rol **es** el filtro por rol. Un
  número y un `<select>` para el mismo dato eran dos controles de más.
- **Perforación de comanda**: remate de puntos en el pie y en el panel de login —
  el borde de corte del ticket abre y cierra el sistema.
- **Canto de color en el calendario** (`Asistencias`): el estado del día se lee en el
  borde izquierdo de la celda.

---

## Accesibilidad — mínimos no negociables

- `:focus-visible` global con anillo naranja (en `base.css`).
- Modales: foco atrapado, `Escape`, `role="dialog"`, `aria-modal`, foco devuelto.
- Todo botón de sólo icono lleva `aria-label`.
- Las tablas ordenables llevan `aria-sort` **en el `<th>`**.
- Enlace «Saltar al contenido» al principio de cada página.

---

## Impresión

`@media print` en `base.css`: se va el cromo de navegación (barra, rail, filtros,
acciones, paginación) y queda la tabla. Marcar con `.no-imprimir` lo que no deba salir.

---

## Checklist antes de mostrar

1. ¿El CSS nuevo está en la hoja global correcta, o duplica algo que ya existe?
2. ¿Algún hex suelto? ¿Algún `transform` en hover?
3. ¿Los cuatro niveles de texto en uso, no dos?
4. ¿Los filtros van a la URL?
5. ¿La acción pide confirmación sólo si es irreversible?
6. ¿Hay estado de carga, de vacío y de error?
7. ¿Se puede recorrer la pantalla entera con Tab?
