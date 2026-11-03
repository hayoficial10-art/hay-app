# HAY — VERSION.md

**VERSIÓN:** 1.34
**FECHA:** 2 de noviembre de 2026
**BASE:** v1.32. Contiene todo lo de la v1.32, más lo nuevo (v1.33 y v1.34).

## V1.34 — sin botones blancos
- Los botones secundarios (Galería, Crear cuenta, Limpiar…) ahora son **verdes**.
- La campana y la configuración de las cabeceras fucsia, y «Publicar» del bloque azul, ahora son **amarillos**.
- El corazón de las tarjetas va en un **círculo fucsia claro**.
- Los botones redondos de volver, cerrar y filtros ahora son **azul claro**.
- Las casillas vacías de fotos ahora son **fucsia claro**.

## V1.33
**ESTADO:** Probado en un navegador real (Chromium, pantalla de teléfono de 390 y 360 px). Detalle abajo.

## OBJETIVO
Corregir tres problemas reportados en la app publicada y pasar la app a los colores fucsia de las pantallas aprobadas.

## COMPLETADO
### 1. Fotos de personas y contenido sexual (antes se podía publicar una cara)
- Antes de aceptar cada foto de una publicación (nueva o editada), el teléfono la revisa (`js/moderacion.js`):
  - **Personas:** detector de caras SSD MobileNet (face-api). Si encuentra una cara, la foto no se acepta.
  - **Contenido sexual:** clasificador MobileNetV2 (nsfwjs). Si la marca como desnudo o sexual, la foto no se acepta.
- Corre dentro del teléfono, sin enviar la foto a nadie. Los modelos se sirven desde la propia app (`vendor/`, ~9,5 MB). Se descargan la primera vez que alguien agrega una foto y después quedan guardados 30 días.
- En el paso 1 de Publicar hay un aviso: «Solo fotos del artículo. No se permiten fotos de personas ni contenido sexual o violento.»
- Si una foto se rechaza, el motivo aparece debajo de los botones.

### 2. Editar perfil: ahora sí se puede poner la foto de perfil
- Antes, el botón de la cámara no hacía nada y la pantalla decía «muy pronto».
- Ahora hay dos botones: **Tomar foto**, que abre la cámara frontal, y **Galería**. También se puede quitar la foto.
- La foto se recorta cuadrada (512 px) y se guarda en el servidor con la ruta nueva `POST /api/me/avatar`. `photoData: null` la quita.
- Se ve en Mi perfil y en Editar perfil. Al eliminar la cuenta, también se borra.

### 3. Agregar fotos: la cámara se abre directo
- Antes había un solo botón con `multiple`, y Android solo ofrecía la galería.
- Ahora hay **Tomar foto**, que abre la cámara trasera (`capture="environment"`), y **Galería**, que permite elegir varias.

### 4. Colores fucsia (pantallas aprobadas el 02/11/2026)
- Paleta (`css/tokens.css`):
  - fucsia **#E8336F**: color de marca;
  - azul **#178DBA**: acción principal;
  - verde **#4FB82E**;
  - amarillo **#FFC627**;
  - tinta **#1B2A4E**.
- Letra **Nunito**.
- `css/tema-fucsia.css` (nuevo), solo apariencia:
  - **Inicio:** cabecera fucsia con el logo, «Cerca de ti», la campana y el buscador. Todos / Personas / Negocios van en azul, verde y amarillo, del mismo tamaño, y el elegido lleva borde oscuro y ✓. Las categorías alternan fucsia, azul, verde y amarillo, todas de la misma altura.
  - **Mi perfil:** cabecera fucsia, foto de perfil en círculo fucsia montada sobre la cabecera, botón Editar perfil en azul y opciones en tarjetas blancas con íconos de colores alternados.
  - **Logo HAY:** cada letra de un color (H azul, A amarillo vivo, Y verde) con borde blanco.
  - **Barra de abajo:** cada ícono con su color (Inicio fucsia, Buscar azul, Mensajes verde, Perfil dorado) y el + amarillo.
- `manifest.webmanifest` y `theme-color` pasan a fucsia.

## PRUEBAS REALIZADAS
- **Revisión de fotos:**
  - una selfie muy de cerca, con los ojos cerrados, se **rechazó** como persona;
  - un balón dibujado se **aceptó**;
  - la primera revisión tardó 7,7 s (descarga de modelos) y las siguientes ~1,4 a 6,4 s en la computadora de pruebas.
- **Publicar:**
  - el botón Tomar foto tiene `capture="environment"`;
  - con la selfie: 0 fotos agregadas y aparece el mensaje;
  - con el balón: 1 foto agregada y sin error.
- **Foto de perfil:**
  - se sube desde Galería y aparece «Foto de perfil guardada ✓»;
  - se ve en Editar perfil y en Mi perfil (`/uploads/…jpg`);
  - Tomar foto usa la cámara frontal (`capture="user"`).
- **Inicio:** los filtros Personas/Negocios y las categorías siguen funcionando. A 360 px no hay scroll horizontal.
- **Navegación y prototipo:** Inicio, Buscar, Mensajes y Perfil se recorren sin errores de JavaScript. El prototipo muestra sus 36 pantallas sin errores.

## LÍMITES (importante)
- **Violencia:** no hay un detector confiable que corra en el teléfono. Queda prohibida en los términos y se controla con el botón Reportar.
- **Caras:**
  - El umbral es bajo (0,2) para atrapar selfies difíciles. Puede rechazar por error alguna foto de objeto; el mensaje explica cómo repetirla.
  - Una persona de espaldas, sin cara visible, no se detecta.
- **Dónde corre la revisión:** en el teléfono, no en el servidor. Alguien con conocimientos técnicos podría saltársela. Para esos casos quedan los reportes y la moderación.
- **Publicaciones viejas:** las que ya tienen fotos de personas no se revisan solas; hay que borrarlas a mano.
- **App de la Play Store:** el color de su barra y de su pantalla de carga cambia solo si se genera un `.aab` nuevo. Lo demás se actualiza solo desde Render.

## PRÓXIMO
- Reemplazar en el servidor las fotos ya publicadas que muestren personas.
- Tema fucsia en el resto de las pantallas que todavía usan el estilo de la v1.32 (detalle, chat, publicar pasos 2–5), si se aprueba.

---

# Historial anterior

**VERSIÓN:** 1.32
**FECHA:** 7 de octubre de 2026
**BASE:** v1.30 (la versión "para publicar" que está en Render). Contiene todo lo de la v1.30, más lo nuevo.
**ESTADO:** Rediseño visual aplicado en toda la app y probado en un navegador real (detalle abajo).

## OBJETIVO
Aplicar a la app real el rediseño "Mercado de colores": alegre, colorido, minimalista y plano, con bloques de color sólidos y **sin degradados**, siguiendo el diseño de las 12 pantallas aprobado en Claude Design.

## COMPLETADO

### 1. Sistema visual nuevo (`css/tokens.css`)
- Paleta de 5 colores, cada uno con un trabajo fijo:
  - **Azul #3D5AFE**: acción principal y selección (texto blanco).
  - **Girasol #FFC53D**: botón + de Publicar, etiquetas de precio y CTA de conversión (texto tinta).
  - **Menta #1FC69A**: aceptar, éxito y verificado (texto tinta).
  - **Tomate #FF6542**: ofertas, favoritos y avisos (texto tinta).
  - **Lila #A78BFA**: bloques decorativos (texto tinta).
  - Tinta **#1C1B33** para el texto. Rojo propio **#C42B0E** para errores y acciones destructivas.
- Tipografía: **Fredoka** (títulos y precios) + **DM Sans** (todo lo demás). Antes: Nunito.
- Superficies planas: fondo blanco y gris cálido #F4F3EF. Sin sombras de color; solo una sombra suave en lo que flota (hojas y modales).
- Los nombres de las variables viejas se mantienen (`--hay-turquoise`, `--hay-pink`…) para no tocar la lógica. Solo cambian sus valores.

### 2. Cero degradados
- Se quitaron **todos** los degradados: fondo de pantalla, dibujos de producto, avatares, círculos de ícono, mapa y página del prototipo. Verificado con búsqueda: no queda ningún `gradient` en `css/` ni en `js/`.

### 3. Componentes rediseñados (`css/components.css`)
- Botones tipo píldora de 54 px, planos. Nuevos `btn--ink` (tinta) y `btn--danger` (rojo, para Eliminar y Descartar).
- Campos y buscador sobre gris cálido, con borde azul al escribir.
- Chips de categoría de colores sólidos que se alternan; el seleccionado va en tinta.
- Barra inferior con etiquetas en todas las pantallas, pastilla azul clara en la pestaña activa y botón + girasol de esquinas redondeadas.
- Tarjeta de producto: la foto manda, el precio va en una etiqueta girasol sobre la foto y el corazón en un círculo blanco.
- Categorías de Publicar como bloques de color sólido, con check al elegir.
- Avatares e íconos en bloques de color de esquinas redondeadas.
- Chat: burbuja de oferta en tomate claro con el monto grande.

### 4. Pantallas
- **Logo plano** (H, A, Y en bloques de color) en toda la app, en lugar de la imagen con relieve brillante.
- **Bienvenida**: fondo azul con figuras de color.
- **Entrar / Crear cuenta**: bloque girasol arriba ("Hola, qué bueno verte").
- **Inicio**: título "¿Qué buscas hoy?", ubicación en pastilla y bloque azul **"¿Algo que ya no usas? → Publicar"** (pide sesión e identidad igual que el botón +).
- **Detalle**: foto a todo lo ancho, hoja blanca con precio grande, vendedor y descripción, y abajo "Hacer oferta" + "Escribir".
- **Publicado**: pantalla menta con confeti plano.
- **Perfil**: bloque lila arriba.
- **Mensajes**: avatares de colores distintos.

### 5. Favoritos reales (nuevo)
- El corazón ya **guarda de verdad** en el teléfono (localStorage), sin necesitar cuenta. Funciona en las tarjetas y en el Detalle.
- "Tus favoritos" lista lo guardado. Quitar un favorito lo saca de la lista. Si está vacía, aparece "Explorar productos".
- Antes, el corazón solo cambiaba de color y en la app se olvidaba al salir.

### 6. Textos en "tú"
- Se corrigió el voseo en la app y en los mensajes del servidor ("tenés" → "tienes", "Iniciá" → "Inicia", "a vos mismo" → "a ti mismo", "Volvé" → "Vuelve", etc.).

### 7. Otros
- `theme-color` y `manifest`: azul #3D5AFE. Las páginas legales usan los colores y letras nuevos.
- Service worker: caché renombrada a `hay-v1.32`.
- `/health` responde `version: 1.32`. `package.json` → 1.32.0.

## PRUEBAS REALIZADAS (en esta versión, navegador Chromium real a 390×844)
- **Recorridos en navegador: 31/31 PASS, 0 errores de consola.** Cubren:
  - Bienvenida y logo nuevo.
  - Favoritos: guardar, que persista al recargar, listarlos, quitarlos y el estado vacío.
  - Corazón del Detalle.
  - Publicar desde Inicio sin sesión (pide entrar), y login por formulario.
  - Publicar completo: foto → categoría → detalles → precio/zona → revisión → publicado → aparece en Inicio.
  - Filtro por categoría y búsqueda por texto.
  - Oferta de la compradora → chat → mensaje de texto.
  - La vendedora acepta la oferta → "Marcar como vendido".
  - Perfil.
- **API: 12/12 PASS**: versión, registro, duplicado, login bueno/malo, publicar con y sin sesión, feed, mensaje a uno mismo (texto en tú), eliminar cuenta (texto en tú) y sesión invalidada.
- **Galería de prototipo (index.html)**: 36 pantallas, 0 errores.
- Capturas de las 36 pantallas revisadas una por una.
- Nota: en el entorno de pruebas no hay acceso a Google Fonts, así que las capturas usan una letra de respaldo. En el teléfono, con internet, se ven Fredoka y DM Sans.

## LO QUE FALTA
- **Ícono de la app, gráfico destacado y capturas de Play Store** (`assets/icon-*.png`, `play-store/`): siguen con el logo viejo con relieve. Hay que rehacerlos con el logo plano antes de subirlos a la tienda.
- Las notificaciones siguen vacías (el servidor todavía no genera avisos). Los mensajes y ofertas se ven en la pestaña Mensajes.
- Los favoritos viven en cada teléfono. Si se cambia de teléfono, no se pasan. Sincronizarlos con la cuenta queda para más adelante.

## CÓMO PUBLICAR
Igual que la v1.30 (`PUBLICAR.md`): reemplaza los archivos del repositorio `hay-app` en GitHub por los de esta carpeta. Render vuelve a desplegar solo. No hay cambios de base de datos ni de variables de entorno.
