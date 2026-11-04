# HAY — VERSION.md

**VERSIÓN:** 1.35
**FECHA:** 4 de noviembre de 2026
**BASE:** v1.34. Contiene todo lo de la v1.34, más lo nuevo de la v1.35.

## V1.35 — avisos, correos, sonido, GPS y velocidad

### 1. Registro completado + correo de bienvenida
- Al crear la cuenta (con correo o con Google por primera vez) aparece la pantalla **«¡Registro completado!»**.
- Se envía al usuario el correo **«¡Bienvenido a HAY!»**.
- Al moderador (`ADMIN_EMAIL`) le llega el correo **«Nuevo usuario registrado en HAY»**.
- Si el servidor de correo está configurado, la pantalla dice «Te enviamos un correo de bienvenida».

### 2. Verificación de seguridad
- Si falta, se avisa:
  - en la pantalla de registro completado («Siguiente paso: verificación de seguridad»);
  - con un aviso amarillo en **Inicio** y en **Mi perfil**: «Falta tu verificación de seguridad».
- Al terminarla aparece **«¡Verificación completada!»** y se envía el correo **«Verificación de seguridad completada»**.
- El aviso amarillo desaparece.

### 3. Publicaciones más rápidas
- El servidor comprime los .js y .css con gzip (app.js: de 82 KB a 20 KB).
- Si el teléfono ya tiene un archivo, el servidor responde «sin cambios» (304) y no lo vuelve a mandar.
- La app abre desde la copia guardada en el teléfono y se actualiza en segundo plano. Antes esperaba siempre a la red.
- Cuando hay una versión nueva, la app se recarga sola una vez.
- La primera página de publicaciones se pide durante la pantalla de inicio, no después.
- Quien ya tiene sesión espera 0,5 s en la pantalla de inicio (antes 1,6 s).
- La letra Nunito ya no frena la apertura.

### 4. Mensajes: sonido, avisos y silenciar
- Antes no existía ningún aviso de mensajes nuevos.
- Ahora la app consulta cada 10 s (ruta nueva `GET /api/me/inbox`). Cuando llega un mensaje u oferta:
  - **suena** (dos tonos, generados en el teléfono) y vibra;
  - aparece un aviso arriba; al tocarlo se abre el chat;
  - si la app está en segundo plano, sale una notificación del teléfono (si el usuario dio permiso);
  - un **número rojo** marca los no leídos en Mensajes y en la campana;
  - el mensaje queda en la pantalla **Notificaciones** (antes estaba vacía).
- En **Configuración → Notificaciones** hay dos interruptores:
  - **Silenciar mensajes:** sin sonido ni vibración;
  - **Silenciar notificaciones:** sin avisos en pantalla ni del teléfono.
- Al quitar el silencio de mensajes suena una vez de prueba.

### 5. GPS y mapa
- **Publicar, paso 4:** botón **«Usar mi ubicación (GPS)»**. Hace tres cosas:
  - pide el permiso;
  - escribe el nombre de la zona, con OpenStreetMap (ruta nueva `GET /api/geo/reverse`);
  - muestra el mapa real.
- La ubicación se guarda **aproximada (~1 km)**, por privacidad.
- **Detalle del producto:** mapa real de la zona aproximada y distancia («a 2,3 km»).
- **Inicio:** tocar la ubicación de la cabecera activa el GPS. Las tarjetas muestran la distancia.
- Si el permiso está negado o el GPS apagado, la app explica qué hacer.

### 6. Imágenes más rápidas
- Cada foto nueva lleva una **miniatura** de ~480 px. En la prueba: 61 KB la foto y 8 KB la miniatura.
- Las tarjetas de Inicio y Buscar usan la miniatura. El detalle usa la foto grande.
- Las fotos vistas quedan guardadas en el teléfono (hasta 300) y la segunda vez aparecen al instante.
- **Fotos publicadas antes de la v1.35:** en Configuración → Panel de moderador → **«Optimizar fotos antiguas»**. Las prepara desde el teléfono del moderador.

### 7. Versión visible
- «HAY · versión 1.35» al final de **Configuración** y de **Mi perfil**.

### Configuración nueva en Render (correos)
Ver **PUBLICAR.md → «Activar los correos»**. Sin configurarlos, todo lo demás funciona, pero no salen correos.

### Archivos
- **Nuevos:**
  - `backend/mailer.js`
  - `js/avisos.js`
  - `css/avisos.css`
- **Cambiados:**
  - `backend/server.js` y `backend/store.js`
  - `js/app.js`, `js/api.js`, `js/partials.js` y los `js/screens-*.js`
  - `sw.js`, `app.html`, `index.html`
  - `render.yaml`, `package.json`, `PUBLICAR.md`

### Pruebas realizadas (Chromium, pantalla de 390 px; con archivos y con PostgreSQL)
- **Registro:** aparece «¡Registro completado!» y el aviso de verificación pendiente.
- **Correos:** se probaron con un servidor de correo de prueba. Salieron los 3 (bienvenida, aviso al moderador y verificación completada), con asunto y tildes correctos.
- **Verificación:** aparece «¡Verificación completada!» y el aviso amarillo de Inicio desaparece.
- **Mensaje de otro usuario:** a los 10 s aparecen el aviso, la vibración y el número rojo. Queda en Notificaciones.
- **Silenciado:** con los dos interruptores activados, otro mensaje no sonó ni mostró aviso, pero sí sumó al número rojo.
- **GPS:** con el GPS simulado (Cumanacoa) se guardó 10,25 / −63,92, se mostró el mapa y la tarjeta dijo «a menos de 1 km».
- **Miniaturas:** la tarjeta carga la miniatura (`…-t.jpg`). El botón «Optimizar fotos antiguas» generó la de una publicación vieja.
- **Velocidad:** gzip y 304 comprobados.
- **Service worker:** se registra y la segunda apertura funciona desde la copia guardada.
- **Prototipo** (`index.html`): sin errores de JavaScript.

## LÍMITES (v1.35)
- **Sonido y avisos con la app cerrada del todo:** no funcionan.
  - Funcionan con la app abierta o en segundo plano reciente.
  - Avisar con la app cerrada requiere «notificaciones push» (Web Push con servidor); no está en esta versión.
  - En segundo plano, Android puede espaciar las consultas.
- **Primer sonido:** Android solo deja sonar después de que la persona toque la pantalla una vez.
- **Nombre de la zona:** viene de OpenStreetMap. Si ese servicio no responde, el mapa y la distancia funcionan igual y se escribe la zona a mano. No se pudo probar desde aquí (sin salida a internet en la prueba).
- **Mapas y distancias:** solo para publicaciones donde se tocó «Usar mi ubicación». Las viejas siguen con la zona escrita.
- **Fotos antiguas:** siguen lentas hasta que el moderador toque «Optimizar fotos antiguas».
- **App de la Play Store:** se actualiza sola desde Render. No hace falta un `.aab` nuevo.

---

## (Anterior) V1.34 — base v1.32

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
