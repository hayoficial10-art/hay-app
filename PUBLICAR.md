# Cómo poner HAY en internet (paso a paso)

Esta guía es para publicar **esta carpeta (`v1.27`)**. Al final tendrás un enlace
tipo `https://hay-app.onrender.com` que cualquiera puede abrir en el celular e
instalar como app.

Costo aproximado: **unos 14–15 USD al mes** (servidor Starter ~7 USD + base de
datos PostgreSQL Basic-256MB ~6–7 USD + disco de 1 GB para fotos). Desde la
v1.29 HAY usa una base de datos real para aguantar muchos usuarios. Se paga con tarjeta internacional (Visa/Mastercard). No uses el plan
gratis: se apaga solo y no guarda las fotos ni los datos de forma segura.

---

## Paso 1 — Subir el código a GitHub (gratis)

1. Crea una cuenta en <https://github.com> (si no tienes).
2. Arriba a la derecha: **+** → **New repository**.
   - Nombre: `hay-app`
   - Marca **Private**.
   - Clic en **Create repository**.
3. En la página del repositorio nuevo, clic en **uploading an existing file**.
4. Abre la carpeta `v1.27` en tu PC, selecciona **todo su contenido** (no la
   carpeta en sí, sino lo que hay adentro: `app.html`, `backend`, `css`, `js`,
   `assets`, `render.yaml`, etc.) y arrástralo a la página.
5. Abajo, clic en **Commit changes**.

## Paso 2 — Crear el servidor en Render

1. Crea una cuenta en <https://render.com> entrando **con tu cuenta de GitHub**.
2. Clic en **New +** → **Blueprint**.
3. Elige el repositorio `hay-app` y dale permiso a Render si lo pide.
4. Render lee el archivo `render.yaml` y te muestra: el servicio `hay-app`, la
   base de datos **`hay-db`** (PostgreSQL) y el disco `hay-data`. Te pedirá un valor para **ADMIN_EMAIL**: escribe el
   correo con el que tú vas a entrar a HAY (esa cuenta será la moderadora).
   Render también crea sola una clave **IDENTITY_KEY** (cifra las fotos de
   cédula). **No la cambies ni la borres nunca**: sin ella, las fotos de cédula
   ya guardadas no se pueden volver a abrir.
5. Clic en **Apply**. Agrega la tarjeta si te la pide.
6. Espera 2–5 minutos. Cuando diga **Live**, arriba verás tu enlace
   (ej. `https://hay-app.onrender.com`). Ábrelo: debería cargar HAY.
7. Para comprobar: abre `https://TU-ENLACE/health` → debe decir
   `"mode":"production"` y `"db":"postgres"`.

> **Si ya tenías HAY publicado con la v1.27/v1.28** (sin base de datos): al
> actualizar a la v1.29 con la base conectada, la primera vez que arranca copia
> sola todos los usuarios, publicaciones, chats, calificaciones, reportes y
> verificaciones a PostgreSQL. Nadie tiene que volver a iniciar sesión.

## Paso 3 — Permitir el login con Google en tu dominio nuevo

1. Entra a <https://console.cloud.google.com> con la cuenta del proyecto
   **Proyecto HAY**.
2. Menú ☰ → **APIs y servicios** → **Credenciales**.
3. Clic en tu cliente OAuth (tipo *Aplicación web*).
4. En **Orígenes autorizados de JavaScript** → **Agregar URI** → pega tu enlace
   de Render (ej. `https://hay-app.onrender.com`, sin barra al final).
5. **Guardar**. Puede tardar unos minutos en funcionar.
6. En **Pantalla de consentimiento de OAuth**, agrega los enlaces
   `https://TU-ENLACE/privacidad.html` y `https://TU-ENLACE/terminos.html`, y
   pásala a **En producción** (si sigue en *Prueba*, solo entran los correos que
   agregaste como prueba).

## Paso 4 — Completar los textos legales

Edita `terminos.html` y `privacidad.html` (en GitHub: abre el archivo → ícono
de lápiz) y reemplaza todo lo que está entre corchetes: `[NOMBRE O RAZÓN
SOCIAL…]`, `[CORREO DE SOPORTE]`, `[FECHA DE PUBLICACIÓN]`, `[NOMBRE DEL
HOSTING]` (Render). Al guardar, Render vuelve a publicar solo. Idealmente, que
los revise un abogado.

## Paso 5 — Instalar HAY en tu Android

1. Abre tu enlace en **Chrome** del celular.
2. Menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**.
3. Aparece el ícono de HAY como una app más.

---

## Actualizar la app más adelante

Cada vez que te entregue una versión nueva: en GitHub, sube los archivos
cambiados (arrastrar y soltar reemplaza los viejos) → Render la publica solo en
1–2 minutos. **Tus datos y fotos no se pierden**: viven en el disco `/var/data`,
separado del código.

## Activar los correos (v1.35)

La app envía 3 correos: **bienvenida** al usuario cuando termina el registro,
**verificación de seguridad completada**, y un **aviso al moderador**
(`ADMIN_EMAIL`) de cada usuario nuevo. Sin configurar esto, la app funciona
igual pero no envía correos.

En Render → servicio `hay-app` → **Environment**, agrega UNA de estas opciones:

**Opción A — Gmail (la más fácil):**
1. En tu cuenta de Google activa la verificación en 2 pasos.
2. Entra a https://myaccount.google.com/apppasswords y crea una
   "contraseña de aplicación" (16 letras).
3. Variables en Render:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = tu correo de Gmail
   - `SMTP_PASS` = la contraseña de aplicación (sin espacios)
   - `MAIL_FROM` = `HAY <tu-correo@gmail.com>`

**Opción B — Resend o Brevo (para muchos correos):** `RESEND_API_KEY` (o
`BREVO_API_KEY`) y `MAIL_FROM` con una dirección de un dominio verificado en
ese servicio.

Opcional: `PUBLIC_URL` = `https://hay-app.onrender.com/` (el enlace del botón
de los correos).

Para comprobarlo: abre `https://hay-app.onrender.com/health`; debe decir
`"mail":"smtp"` (o `"resend"` / `"brevo"`). Si un correo falla, el motivo
aparece en Render → **Logs** con la palabra `[HAY correo]`.

## Revisión de fotos con Google (v1.39 — NECESARIA para bloquear personas)

Para bloquear en el servidor fotos con **personas** (caras o cuerpos), violencia, heridas, sangre o contenido sexual.
Sin esta clave solo queda la revisión del teléfono, que **no ve las caras muy de cerca** (por eso se pudo publicar una selfie):
1. Entra a https://console.cloud.google.com con tu cuenta de Google, crea un proyecto (ej. HAY) y activa la facturación (las primeras 1.000 fotos al mes no se cobran).
2. Busca **Cloud Vision API** y toca **Habilitar**.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → Clave de API** y cópiala.
4. En Render → `hay-app` → **Environment**, agrega `GOOGLE_VISION_KEY` con esa clave y guarda.
5. Comprueba en `https://hay-app.onrender.com/health` que diga `"photoReview":"vision"` y `"version":"1.39"`.
6. Costo: cada foto de publicación usa 3 revisiones (contenido, caras y objetos). Google regala 1.000 de cada una al mes; después cuesta unos 1,50 US$ por cada 1.000.
7. Las publicaciones que ya existen con personas no se revisan solas: bórralas o páusalas a mano.

## Cuando crezca (más velocidad)

- **Más usuarios a la vez:** en Render → `hay-app` → *Scaling*, subir a más
  instancias o a un plan mayor. Con la base de datos esto ya funciona.
- **Base de datos más grande:** en `hay-db` → *Change plan* (Basic-1GB, Pro...).
- **Fotos con CDN (recomendado antes de tener varias instancias):** crear un
  bucket en **Cloudflare R2** (10 GB gratis, sin costo de descarga) y agregar en
  `hay-app` → *Environment* las variables `S3_ENDPOINT`, `S3_BUCKET`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto` y
  `PHOTOS_PUBLIC_URL`. Te guío cuando llegue el momento.

## Respaldo

La base de datos `hay-db` (plan pago) tiene copias de seguridad automáticas en
Render. El disco de fotos también tiene copias diarias. Aun así, conviene descargar de vez en
cuando una copia (te puedo preparar un botón de "exportar respaldo" en el panel
de moderador).

## Si algo falla

- Render → `hay-app` → **Logs**: ahí aparecen los errores. Cópiame lo que diga.
- El login con Google falla con "origin not allowed": falta el Paso 3.
