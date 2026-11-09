# HAY — VERSION.md

**VERSIÓN:** 1.61
**FECHA:** 9 de noviembre de 2026
**BASE:** v1.60.

## V1.61 — botones de fotos más pequeños

- «Tomar foto» y «Galería» más pequeños e iguales en Publicar, Verificar identidad y Editar perfil.
- Versión 1.61 (app, servidor, service worker).


---

## V1.60 — fichas iguales en cada fila

- Categorías (Inicio, Buscar y Publicar): todas las fichas del mismo ancho y alto;
  los nombres largos pasan a dos líneas dentro de la ficha.
- Todos/Personas/Negocios, Nuevo/Como nuevo/Usado y Activas/Pausadas/Vendidas: partes iguales.
- La ficha marcada solo cambia de color (sin borde oscuro).
- Versión 1.60 (app, servidor, service worker).


---

## V1.59 — mismo tamaño para lo que es igual

- Tres medidas en toda la app: botón grande (44), ficha o botón chico (34) y botón redondo (38).
- Categorías, Todos/Personas/Negocios, Activas/Pausadas/Vendidas, Nuevo/Como nuevo/Usado y
  Aceptar/Rechazar: todas del mismo alto y letra.
- Inicio: las categorías ahora son las mismas fichas que en Buscar (antes eran cuadros grandes).
- Versión 1.59 (app, servidor, service worker).


---

## V1.58 — app más sencilla

- Botones, títulos e íconos más pequeños en todas las pantallas (nuevo archivo css/minimal.css).
- Botón atrás o X en las pantallas que no lo tenían: Buscar, Oferta enviada, ¡Publicado!,
  Reporte enviado, Registro completado, Verificación completada, Enlace enviado y Calificar.
- Menos texto: se acortaron títulos, avisos y explicaciones en todas las pantallas.
- Inicio: se quitan el bloque «Publica gratis» y las 4 fichas (Trato directo, 0% comisión…),
  repetidos con el botón +. La publicidad de arriba queda debajo de las categorías.
- Buscar: se quitan el panel de filtros y «Ordenar», que no funcionaban.
- Publicar: categorías en fichas pequeñas; ventana de salida sin ícono grande y con texto corto.
- Detalle: se quita «Compartir» (no funcionaba). Mensajes: se quita la lupa (no funcionaba).
- Registro y entrada: se quita «Continuar con Apple» (no funcionaba).
- Mi perfil: se quitan lo repetido (Favoritos, Crear publicación, engranaje, aviso de verificada);
  «Cerrar sesión» queda solo en Mi perfil.
- Versión 1.58 (app, servidor, service worker).


---

## V1.57 — la publicidad no interviene al iniciar la app

- Los anuncios empiezan a cargar 5 segundos después de que la app termina de abrir.
- Cada anuncio carga solo cuando el usuario se acerca a él al bajar por Inicio.
- Mientras el anuncio no llega, el recuadro está oculto y no deja espacio en blanco.
  Si no llega en 15 segundos, se quita.
- Nada más cambia.
- Versión 1.57 (app, servidor, service worker).


---

## V1.56 — corrección: los recuadros de publicidad salían vacíos

- El bloqueo de la v1.54 impedía que Adsterra cargara el anuncio. Se ajusta para que cargue,
  manteniendo el bloqueo que impide sacar al usuario de la app.
- Si a los 8 segundos no llega ningún anuncio, el espacio de publicidad se oculta.
- Nada más cambia.
- Versión 1.56 (app, servidor, service worker).


---

## V1.55 — cierre de la venta y retiro automático

- Al aceptar una oferta:
  - Las demás ofertas de ese producto se rechazan solas y ya no se pueden aceptar otras ni hacer nuevas.
  - Aparece en el chat una nota: acordar por el chat lugar, hora y forma de pago; pagar al recibir.
- Si en 3 días no se marca la venta, HAY la cierra sola: queda vendida al comprador de la oferta,
  sale de Inicio y se avisa en el chat.
- Publicación sin actividad durante 30 días: se retira sola (queda en «Pausadas» con el aviso).
  «Reanudar» la renueva por 30 días más.
- «Marcar como vendida» desde «Mis publicaciones» toma el comprador y el precio de la oferta aceptada.
- Producto vendido o pausado: nadie más puede escribir ni ofertar. Vendedor y comprador sí siguen
  hablando por el chat para la entrega.
- El comprador también puede calificar: botón «Calificar» en el chat cuando la venta está cerrada.
- Corregido: en la oferta enviada, «OFERTA» y el monto no se veían (azul sobre azul).
- Al abrir la app ya no se repite la pantalla de bienvenida.
- Versión 1.55 (app, servidor, service worker).


---

## V1.54 — corrección: la publicidad sacaba al usuario de la app

- Los anuncios de Adsterra redirigían toda la app a otra página (un casino) y no dejaban entrar.
- Ahora cada anuncio queda encerrado en su recuadro (iframe con `sandbox`): no puede cambiar la
  página de la app. Solo abre una pestaña nueva si el usuario toca el anuncio.
- Nada más cambia.
- Versión 1.54 (app, servidor, service worker).


---

## V1.53 — corrección: los anuncios no se mostraban

- Cada anuncio ahora se carga desde una página propia del sitio (`assets/anuncio-320.html` y
  `assets/anuncio-300.html`) en vez de un iframe `srcdoc`. Con `srcdoc` la dirección del anuncio
  era «about:srcdoc» y Adsterra no reconocía el dominio aprobado (hay-app.onrender.com).
- Los anuncios cargan apenas aparecen (sin espera).
- Nada más cambia.
- Versión 1.53 (app, servidor, service worker).


---

## V1.52 — anuncios de Adsterra en Inicio

- Archivo nuevo `js/anuncios.js` (cargado en `app.html` y guardado en la caché del service worker).
- Solo en la pantalla de **Inicio**:
  - Banner **320x50** debajo del recuadro «¿Algo que ya no usas?».
  - Banner **300x250** cada 8 publicaciones en la lista de productos (también al cargar más con el scroll).
- Cada anuncio lleva arriba la palabra «Publicidad» y va dentro de su propio iframe, para que su código no afecte a la app.
- Sin anuncios en registro, verificación, publicar, chat ni demás pantallas. Sin popunder ni anuncios para adultos.
- Nada más cambia.
- Versión 1.52 (app, servidor, service worker).


---

## V1.51 — pantalla «Administrador»

- Configuración: debajo de «Panel de moderador» está la opción nueva **Administrador**
  («Vincular con WhatsApp y correo»). Solo la ven los administradores.
- Pantalla nueva **Administrador** con dos tarjetas: «Vincular con WhatsApp» (número) y
  «Vincular con correo». Por ahora es solo la pantalla: los botones dicen
  «Esta opción estará lista pronto».
- Nada más cambia.
- Versión 1.51 (app, servidor, service worker).


---


## V1.50 — tamaños y simetría en todas las pantallas

- Se revisaron todas las pantallas (acceso, Inicio, Buscar, Publicar, Detalle,
  ofertas, chat, venta, calificación, reportes, Mi perfil, Configuración, Seguridad,
  moderación y verificación) con las medidas de la v1.49. Cambios en `css/simetria.css`:
  - Barras de abajo con dos botones: los dos del mismo ancho y alto (antes «Hacer oferta»
    y «Cancelar» de Confirmar venta eran más angostos).
  - Pantallas con la barra de abajo: lo último de la página ya no queda tapado por el botón +.
  - Publicar: las categorías van en 2 columnas del mismo ancho.
  - Buscar: Todos / Personas / Negocios en tres partes iguales.
  - Pestañas (Mis publicaciones y otras): partes iguales.
  - Seguridad: botones «Llamar» y «WhatsApp» del mismo ancho.
- Botones que se veían verdes con letras rojas ahora son rojos como «Cerrar sesión» de
  Mi perfil: «Cerrar sesión» en Configuración y «Eliminar publicación (moderador)».
- «Hacer oferta» en el Detalle es verde, del mismo tamaño que «Escribir».
- Las fotos de los productos no cambian.
- Versión 1.50 (app, servidor, service worker).


---

## V1.49 — tamaños y simetría de referencia; selfie desde la galería

- Tamaños y simetría tomados de las pantallas de referencia (los colores siguen
  siendo los de HAY; las tarjetas con fotos de los productos no cambian).
  Todo en `css/simetria.css`:
  - Márgenes laterales iguales de 16 px en todas las pantallas.
  - Inicio: las 4 ventajas son botones del mismo tamaño, con el ícono alineado.
  - Mi perfil: «Mis publicaciones», «Favoritos» y «Notificaciones» pasan a ser
    3 botones iguales y centrados; abajo quedan en lista «Verificación de identidad»
    y «Configuración y ayuda».
  - Filas de lista (Mi perfil y Configuración) con el mismo alto (58 px), mismo ícono
    redondo de 40 px y línea separadora entre filas.
  - Configuración: los íconos de «Términos de uso» y «Panel de moderador» se veían vacíos;
    ahora se ven.
  - Barra de abajo: 5 espacios del mismo ancho y botón central redondo de 60 px.
  - Esquinas iguales (16 px) en bloques y tarjetas.
- Verificación de identidad: la selfie ahora tiene dos botones, «Tomar selfie» y
  «Galería», igual que la cédula. La comparación cara–cédula sigue igual.
- Versión 1.49 (app, servidor, service worker).



---

## V1.48 — vuelve el logo de letras dentro de la app

- Se deshizo la v1.47: arriba dentro de la app (Inicio, acceso, bienvenida, Mi perfil)
  vuelve el logo de las letras HAY con el lema (`assets/hay-logo-v2.png`).
- El logo nuevo (tienda con carrito) sigue como ícono de la app y en la pantalla de
  inicio, como en la v1.46.
- Versión 1.48 (app, servidor, service worker).

## V1.47 — (deshecha en la v1.48) logo nuevo también dentro de la app



---

## V1.46 — logo nuevo para el ícono y el inicio de la app

- Logo nuevo (tienda con toldo rojo y blanco, carrito con bolsas, «HAY» en 3D y el lema
  sobre la franja tricolor):
  - **Ícono de la app** (pantalla de inicio del teléfono, navegador y Play Store):
    `assets/icono-hay3-192.png`, `icono-hay3-512.png`, `icono-hay3-maskable-512.png`
    (con margen azul para que Android no lo recorte), `icono-hay3-apple-180.png` y
    `play-store/icono-512.png`. Nombre nuevo para que el teléfono baje el ícono nuevo.
  - **Pantalla de inicio de la app** (lo primero que se ve al abrirla): el logo nuevo
    centrado sobre fondo claro (`assets/hay-logo-inicio.png`).
- El logo de arriba dentro de la app (Inicio, Mi perfil) sigue siendo el de las letras HAY.
- Versión 1.46 (app, servidor, service worker).



---

## V1.45 — Publicar en una sola página (diseño Stitch)

- Publicar ya no va por 5 pasos: todo está en una sola página con cuatro tarjetas:
  1. **Fotos del producto** (Tomar foto / Galería, hasta 6, la primera es la portada).
  2. **¿Qué estás vendiendo?** (título, categoría en fichas, estado Nuevo / Como nuevo / Usado).
  3. **Fija tu precio** (precio en dólares, equivalencia en bolívares con el dólar BCV,
     «Acepto ofertas»).
  4. **Detalles y ubicación** (descripción, «Usar mi ubicación actual», zona de entrega
     y el aviso «Venta segura cara a cara»).
  Al final, el botón amarillo **«Publicar artículo ahora»**.
- Antes de enviar se revisa que haya al menos una foto, un título y un precio; si falta
  algo, la app lo dice arriba del botón.
- Las fotos se siguen revisando igual (en el teléfono y en el servidor): no se permiten
  personas, contenido sexual ni violento.
- «Editar» una publicación abre esta misma página con los datos cargados.
- Al tocar «Usar mi ubicación actual» la página no salta arriba.
- Versión 1.45 (app, servidor, service worker).



---

## V1.44 — Mi perfil, Detalle y Chat con el diseño nuevo

### Mi perfil (diseño Stitch)
- Título «Mi perfil» con el botón de Configuración en turquesa.
- Tarjeta blanca con la foto, el nombre, el estado de la verificación (verde verificada,
  amarillo pendiente, coral si no pasó), la calificación, el correo y «Miembro desde».
- Si la identidad está verificada: aviso turquesa «Tu cuenta está protegida y verificada».
  Si falta: el aviso de siempre para verificarse.
- Botón amarillo grande «Crear nueva publicación».
- Opciones en una sola tarjeta con íconos de colores: Mis publicaciones, Favoritos
  guardados, Verificación de identidad (con su estado), Notificaciones y alertas,
  Configuración y ayuda.
- Botón rojo «Cerrar sesión» y, al final, el logo con la versión.
- Sin cifras inventadas: solo se muestran datos reales de la cuenta.
- Sin sesión: tarjeta con «Iniciar sesión» (amarillo) y «Crear cuenta» (verde).

### Detalle del producto
- Los botones sobre la foto (volver, compartir, favorito) ya no son blancos:
  turquesa, y el corazón en coral.

### Chat
- Mis mensajes en azul marino con letra blanca; los del otro en tarjeta blanca.
- Arriba de la conversación, la tarjeta «Consejo de compra segura HAY».

### Sin cambios de forma
- Publicar sigue en pasos (fotos, datos, precio, ubicación…) con sus revisiones; solo
  tomó los colores nuevos. Verificación de identidad igual, con los colores nuevos.

- Versión 1.44 (app, servidor, service worker).



---

## V1.43 — Inicio más limpio

- Los botones **Todos / Personas / Negocios** ya no ocupan una fila grande: ahora son
  pequeños y van a la derecha del título «Cerca de ti», así las publicaciones se ven antes.
  El filtro funciona igual que antes.
- Se quitó «Ver todo» de esa fila (el buscador de arriba hace lo mismo).
- Bloque amarillo más sencillo y un poco más pequeño: «Publica gratis y vende hoy» /
  «Sin comisiones, directo con quien compra.» y el botón «Empieza a vender».
- Versión 1.43 (app, servidor, service worker).



---

## V1.42 — el teléfono baja el ícono nuevo

### Error
Tras la v1.41, al reinstalar la app seguía saliendo el ícono viejo: Chrome tenía
guardados los archivos del ícono con el mismo nombre.

### Arreglo
- Los íconos tienen nombre nuevo, así Chrome los baja otra vez:
  `assets/icono-hay-192.png`, `assets/icono-hay-512.png`,
  `assets/icono-hay-maskable-512.png`, `assets/icono-hay-apple-180.png`.
- La barra de arriba del navegador y de la app instalada ya no es fucsia: toma el
  fondo claro de la app (#F5F7FB).
- Versión 1.42 (app, servidor, service worker).



---

## V1.41 — ícono nuevo de la app

- El ícono de la app (pantalla de inicio del teléfono, pestaña del navegador y Play Store)
  es ahora el logo oficial 3D con el lema, sobre fondo blanco:
  `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable-512.png`
  (con margen para que Android no lo recorte), `assets/apple-touch-icon.png` y
  `play-store/icono-512.png`.
- Versión 1.41 (app, servidor, service worker).



---

## V1.40 — diseño nuevo «alegre» (Google Stitch) y logo oficial

### Logo
- El logo de arriba es ahora la imagen oficial 3D (H amarilla, A turquesa, «y» coral, con el
  lema «Lo tienes, publícalo, véndelo.» y las tres rayas de color), con fondo transparente:
  sin borde ni recuadro blanco. Archivo: `assets/hay-logo-v2.png`.
- Se usa en todas las pantallas que llevaban el logo de letras (Inicio, bienvenida, acceso)
  y en Términos, Privacidad y Eliminar cuenta.

### Colores (archivo nuevo `css/tema-alegre.css`)
- Paleta del logo, todo en colores sólidos (sin degradados): turquesa #22C7E8, amarillo
  #FFC21A, coral #FF4F6D, verde #6BD43A, anaranjado #F5A300, tinta #1B2350, fondo #F5F7FB.
- Sobre turquesa, amarillo, coral y verde el texto va en tinta azul marino.
- El fucsia de las cabeceras pasa a turquesa.
- Ningún botón blanco: «Continuar con Google» va en azul marino y «Continuar con Apple» en turquesa.

### Barra de navegación de abajo
- Cada ícono con su color: Inicio turquesa, Favoritos coral, Publicar amarillo (botón
  redondo central), Mensajes verde, Perfil anaranjado. La pestaña activa va dentro de
  una pastilla de su color.
- **Favoritos** ocupa el lugar de **Buscar** (el buscador sigue arriba en Inicio).

### Inicio
- Cabecera clara: ubicación, logo al centro y campana; buscador blanco con botón de
  filtros turquesa.
- Bloque amarillo «¡Publica gratis y vende hoy mismo!» con el botón «Empieza a vender».
- Fila de ventajas: Trato directo, 0 % comisión, Cerca de ti, Venta rápida.
- «Explorar categorías» con cuadros de colores (mismo filtro de siempre).
- Tarjetas de producto blancas con sombra suave; el precio en bolívares sigue igual.

### Versión
- `HAY_VERSION`, `APP_VERSION`, `package.json` y el service worker pasan a 1.40 (la app
  se actualiza sola en los teléfonos al abrirla).



---

**VERSIÓN:** 1.39
**FECHA:** 4 de noviembre de 2026
**BASE:** v1.38. Contiene todo lo de la v1.38, más lo nuevo de la v1.39.

## V1.39 — no se pueden publicar fotos de personas

### Error
Se pudo publicar una selfie (publicación «Cara»). El detector de caras del teléfono
(SSD MobileNet) no ve una cara que llena toda la foto: a esa selfie le dio 0,09
(el límite es 0,2), menos que a un frasco de colonia (0,10–0,21). Bajar el límite
no sirve: rechazaría los objetos. Se probaron también BlazeFace y CenterNet en el
teléfono y tampoco separan bien caras de objetos en estas fotos.

### Arreglo
- **En el servidor, con Google Cloud Vision:** cada foto de una publicación (nueva o
  editada) se revisa también con **detección de caras** y **detección de objetos**.
  Se rechaza si hay una cara (confianza ≥ 0,5) o una persona o parte del cuerpo
  («Person», «Human face»…, confianza ≥ 0,6). El vendedor ve: «Una de las fotos no
  se permite: parece que se ve una persona…».
- Las **fotos de perfil** no se revisan por personas (ahí la cara es lo normal);
  siguen revisándose por sexo y violencia.
- La revisión del teléfono queda igual, como primer filtro.
- `render.yaml` ahora pide `GOOGLE_VISION_KEY`. **Sin esa clave el bloqueo de
  personas no funciona.** Ver PUBLICAR.md.

### El moderador puede eliminar cualquier publicación
- En el detalle de una publicación ajena, el moderador ve el botón rojo
  **«Eliminar publicación (moderador)»**. Pide confirmación y la borra.
- El servidor lo permite solo a quien tenga el email de `ADMIN_EMAIL` (Render).
  Cada borrado queda en los Logs: «Moderador … eliminó la publicación …».



---

## V1.38 — verificación sencilla y automática, control de fotos, bolívares, actualización

### 1. Verificación de identidad: sencilla y automática
- **Cédula:** Tomar foto o Galería.
- **Selfie:** solo con la cámara normal del teléfono (sin galería, sin escaneo de movimientos).
- **Enviar:** no espera nada. El registro y la verificación nunca se frenan.
- **Comparación:** después de enviar, el teléfono compara por detrás la cara de la selfie con la de la cédula y el servidor decide solo:
  - **coincide** → «Verificada ✓»;
  - **no coincide**, o no se ve una de las caras → «No pasó». Inicio y Mi perfil avisan «Tu verificación no pasó… repítela» y no se puede publicar hasta repetirla;
  - **sin conexión para comparar** → queda «Enviada», se puede publicar y se reintenta al abrir la app.
- Nadie tiene que revisar a mano. El panel de moderador solo muestra el resultado.
- Ruta nueva: `POST /api/me/identity/check`.

### 2. Control de fotos al publicar: sexo, violencia, heridos, muertos
- **En el teléfono (ya existía):**
  - no se acepta una foto donde se vea una persona, viva, herida o muerta;
  - no se acepta contenido sexual (nsfwjs).
- **Nuevo, en el servidor, con Google Cloud Vision (SafeSearch):** revisa cada foto de publicaciones y de perfil, y rechaza:
  - contenido sexual («adult» probable, o «racy» muy probable);
  - **violencia** probable;
  - **heridas, sangre o cuerpos** («medical» probable).
- **Cómo se activa:** con la variable `GOOGLE_VISION_KEY` en Render. Sin ella, quedan solo las revisiones del teléfono.

### 3. Dólar BCV y bolívares
- Ruta nueva `GET /api/dolar`: tasa oficial BCV (fuente ve.dolarapi.com, consultada como máximo cada 30 min).
- `DOLAR_BCV` en Render permite fijarla a mano.
- **Dónde se ve el precio en bolívares** («≈ Bs …»):
  - en cada tarjeta;
  - en el detalle;
  - en Publicar paso 4, en vivo mientras se escribe, con la tasa del día;
  - en la revisión del paso 5.

### 4. El enlace no se actualizaba en algunos teléfonos
- **Causa:** el teléfono abría la copia guardada de una versión vieja.
- **Ahora, al abrir:** la app compara su versión con la del servidor. Si es distinta:
  1. borra la copia guardada;
  2. se recarga una sola vez (no entra en bucle).

### Archivos
**Cambiados respecto de la 1.37 publicada:**
- `js/app.js`, `js/api.js`, `js/screens-account.js`, `js/screens-main.js`, `js/screens-publish.js`, `js/screens-transaction.js`
- `css/avisos.css`, `backend/server.js`, `sw.js`, `package.json`, `VERSION.md`

### Pruebas (Chromium, 390 px; servicios del dólar y de Vision simulados)
- La selfie solo tiene cámara.
- Enviar tardó 89 ms.
- **Verificación:**
  - no coincide → rechazada, aviso en Inicio, publicar da 403;
  - repetida y coincide → verificada.
- **Fotos:**
  - con violencia → bloqueada con mensaje;
  - normal → publicada.
- **Bolívares:**
  - tarjeta $15 → ≈ Bs 13.398,26;
  - Publicar $100 → ≈ Bs 89.321,73.
- **Versión vieja:** se recargó una vez y no entró en bucle.
- Sin errores de JavaScript.

### Límites
- **Comparación de caras:** usa modelos que el teléfono descarga de jsDelivr (~6,5 MB). No se pudo probar con caras reales aquí.
- **Revisión en el teléfono:** la comparación corre en el teléfono. Alguien con conocimientos técnicos podría saltársela.
- **Google Cloud Vision:**
  - necesita una clave de Google Cloud con facturación activada;
  - las primeras 1.000 fotos al mes son gratis;
  - sin la clave, la violencia y las heridas sin persona visible no se detectan.

---

## (Anterior) V1.37 — base v1.36

## V1.37 — verificación de identidad de verdad
**Pedido:** que no se pueda hacer trampa con fotos de la galería, y que se compruebe que la persona de la selfie es la de la cédula.

### Selfie en vivo
- Ya no se puede subir de la galería.
- Se toma con la cámara frontal **dentro de la app**: no se abre la app de cámara, así Android no cierra HAY.
- Pasos:
  1. Pide poner la cara dentro de un óvalo.
  2. Pide **dos movimientos al azar** entre tres: acercar la cara, girar a la izquierda o girar a la derecha. Los comprueba el detector de caras que ya trae la app (SSD MobileNet).
  3. Pide mirar de frente y toma la foto sola.
- Si no hay permiso de cámara, explica cómo darlo.

### Foto de la cédula
- Sigue con **Tomar foto** y **Galería**: es un documento y Galería sirve en los teléfonos que se cierran al abrir la cámara.
- Ahora se revisa que en la foto se vea una cara. Si no se ve, se rechaza y se pide repetirla.

### Comparación de caras
- Al tocar «Enviar verificación», el teléfono compara la cara de la selfie con la de la cédula. Usa el modelo de reconocimiento de face-api: una distancia menor que 0,55 cuenta como la misma persona.
- **Si no coincide**, pide repetir la selfie. A la segunda vez ofrece «Enviar para revisión manual».
- **Si los modelos no se pueden descargar** (sin conexión, 60 s de espera), se envía igual, marcada para revisión manual.
- Los modelos de comparación (~6,5 MB) se descargan de jsDelivr la primera vez y quedan guardados.

### Servidor y moderador
- El servidor guarda el resultado junto a las fotos: retos hechos, distancia, si coincide y si necesita revisión.
- En **Panel de moderador → Verificaciones** cada persona sale con **«Cara coincide ✓ (distancia)»** o **«Revisar a mano»**.

### Archivos
- **Nuevo:** `js/verificacion.js`
- **Cambiados:**
  - `js/app.js`, `js/api.js`, `js/screens-account.js`
  - `css/avisos.css`, `app.html`, `index.html`
  - `backend/server.js`, `sw.js`, `package.json`, `VERSION.md`

### Pruebas (Chromium, pantalla de 390 px, cámara simulada)
- La selfie no tiene Galería.
- Una cédula sin cara se rechazó con mensaje.
- La cámara se abre dentro de la app y pide la cara en el óvalo.
- No coincide 2 veces → revisión manual.
- Sin modelos → revisión manual.
- Coincide → enviada.
- El moderador vio 1 «Cara coincide» y 2 «Revisar a mano».
- Sin errores de JavaScript.

### Límites
- **Movimientos y comparación sin persona real:** no se pudieron probar aquí, porque no había una persona ante la cámara ni acceso al CDN de los modelos. Hay que probarlo en un teléfono real.
- **Revisión en el teléfono:** la revisión corre en el teléfono. Alguien con conocimientos técnicos podría saltársela; para eso queda la revisión del moderador.
- **Revisión manual:** quien queda en «revisión manual» igual puede publicar. El moderador ve la marca y decide.

---

## (Anterior) V1.36 — base v1.35

## V1.36 — la foto de la cédula no cargaba
**Problema reportado:** en la verificación de seguridad, la foto de la cédula no cargaba.

**Causas encontradas:**
- Cada foto solo tenía la opción de cámara. En teléfonos con poca memoria, Android cierra la app mientras la cámara está abierta y la foto se pierde sin aviso.
- La foto se copiaba entera a texto antes de achicarla, unos 5 a 10 MB en memoria.
- Una foto en formato HEIC no se podía abrir y el error no se explicaba.

**Cambios:**
- Cada foto (cédula y selfie) tiene dos botones: **Tomar foto** y **Galería**.
- La foto se abre con menos memoria (`createImageBitmap`) y respeta la orientación de la cámara.
- Mientras se prepara la foto aparece «Preparando la foto…».
- Si el teléfono cerró la app al abrir la cámara, la app vuelve sola a la pantalla de verificación (o a Publicar o Editar perfil) y explica que se use «Galería».
- Si la foto es HEIC y el teléfono no la abre, el mensaje explica cómo cambiar la cámara a JPG.

**Archivos cambiados (7):**
- `js/app.js`, `js/api.js`, `js/screens-account.js`
- `backend/server.js` (versión), `sw.js` (versión), `package.json`, `VERSION.md`

**Pruebas (Chromium, pantalla de 390 px):**
- Hay dos botones por foto.
- La cédula cargó desde Galería.
- Una foto HEIC mostró el mensaje claro.
- La verificación se envió.
- Al simular el cierre de la app por la cámara, la app volvió a Verificación con el aviso.
- Sin errores de JavaScript.

---

## (Anterior) V1.35 — base v1.34

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
