# Publicar HAY en Google Play (paso a paso)

HAY se publica en Play Store como una **app de Android que abre la app web a
pantalla completa**: sin barra del navegador, con ícono propio y se instala
desde la tienda como cualquier app. Google lo llama *Trusted Web Activity*
(TWA). Se usa en apps grandes y está permitido por Google.

**Antes de empezar, HAY ya tiene que estar publicada en internet**
(`PUBLICAR.md`) y abrir bien desde el celular en `https://TU-DOMINIO`.

---

## Qué necesitas

| Qué | Costo | Notas |
|---|---|---|
| Cuenta de **Google Play Console** | 25 USD, pago único | Recomendado: cuenta de **Organización** (necesita número D-U-N-S, que es gratis) |
| App publicada en internet | — | Ver `PUBLICAR.md` |
| Correo de soporte | — | ej. soporte@tudominio.com |
| Imágenes y textos | — | Ya listos en la carpeta `play-store/` |

### Cuenta personal u organización
- **Organización (recomendado):** necesitas tu negocio registrado (RIF) y un
  número **D-U-N-S**, que se pide gratis en
  <https://www.dnb.com/duns-number/get-a-duns.html> y tarda de días a semanas.
  **No** te obliga a hacer la prueba cerrada de 12 personas.
- **Personal:** más rápida de abrir, pero Google exige que, antes de publicar,
  la app pase una **prueba cerrada con al menos 12 personas durante 14 días
  seguidos**.

---

## Paso 1 — Crear la app de Android con PWABuilder (gratis, sin programar)

1. Entra a <https://www.pwabuilder.com> y escribe tu enlace
   (ej. `https://hay-app.onrender.com`). Clic en **Start**.
2. Clic en **Package For Stores** → **Android** → **Generate Package**.
3. Revisa estas opciones antes de generar (los nombres exactos pueden variar un poco en la página):
   - **Package ID:** `app.hay.twa` (o `com.tudominio.hay`). **No se puede
     cambiar nunca después.**
   - **App name:** `HAY` · **Launcher name:** `HAY`
   - **Theme color:** `#22C7E8` · **Background color:** `#FFFFFF`
   - **Signing key:** *Create new*. Completa tu nombre y organización.
4. Clic en **Download**. Se baja un `.zip` con:
   - `app-release-bundle.aab` → **el archivo que se sube a Play Store**
   - `signing.keystore` + `signing-key-info.txt` → **la llave de tu app**
   - `assetlinks.json`

> 🔐 **Guarda `signing.keystore` y `signing-key-info.txt` en 2 lugares seguros**
> (Google Drive + pendrive). Si los pierdes, no podrás actualizar la app.

## Paso 2 — Crear la app en Play Console

1. <https://play.google.com/console> → **Crear app**.
   - Nombre: **HAY: compra y vende cerca** · Idioma: Español (Latinoamérica)
   - App · Gratis → acepta las declaraciones → **Crear app**.
2. Completa **Configurar tu app** con los textos de
   `play-store/TEXTOS-TIENDA.md`: política de privacidad, acceso a la app,
   anuncios, clasificación de contenido, público objetivo, seguridad de los
   datos y eliminación de cuenta.
3. **Ficha de la tienda:** pega los textos y sube el ícono, el gráfico
   destacado y las 5 capturas de la carpeta `play-store/`.

## Paso 3 — Subir la app

1. **Prueba → Prueba interna** (o **Prueba cerrada** si tu cuenta es
   personal) → **Crear versión**.
2. Acepta **Play App Signing** (Google guarda una copia de la llave de firma).
3. Sube `app-release-bundle.aab` → **Guardar** → **Revisar versión** →
   **Iniciar lanzamiento**.

## Paso 4 — Conectar la app con tu sitio (para que no se vea la barra del navegador)

1. En Play Console → **Prueba y lanzamiento → Configuración → Integridad de la
   app → Firma de apps**. Copia la **huella SHA-256 del certificado de firma de
   apps** (formato `AB:CD:12:...`).
2. Busca también la huella SHA-256 que viene en `assetlinks.json` del zip de
   PWABuilder (es la de tu llave de subida).
3. En **Render** → `hay-app` → **Environment**, agrega:
   - `ANDROID_PACKAGE` = `app.hay.twa` (el mismo Package ID del Paso 1)
   - `ANDROID_CERT_SHA256` = las **dos** huellas separadas por coma
4. Guarda y espera a que Render se reinicie. Comprueba abriendo
   `https://TU-DOMINIO/.well-known/assetlinks.json`: debe mostrar tu paquete y
   tus huellas.

## Paso 5 — Probar y publicar

1. Instala la app desde el enlace de prueba en tu Android. Debe abrir **a
   pantalla completa, sin barra de direcciones**. Si ves la barra, revisa el
   Paso 4.
2. **Cuenta personal:** invita a 12 o más personas a la prueba cerrada y
   espera 14 días. Después pide el **acceso a producción**.
   **Cuenta de organización:** pasa directo a **Producción → Crear versión**.
3. Google revisa la app (normalmente de unas horas a unos días).

---

## Actualizaciones

Casi todo se actualiza **sin pasar por la Play Store**: subes los archivos
nuevos a GitHub → Render publica → la app en los teléfonos se actualiza sola,
porque carga desde tu servidor. Solo hay que subir un `.aab` nuevo si cambias el
ícono, el nombre o los colores de la app de Android.

## Si algo falla
- **Se ve la barra del navegador:** Asset Links mal configurado (Paso 4).
- **Google rechaza por "Acceso a la app":** falta la cuenta de prueba con
  identidad verificada.
- **Rechazo por "eliminación de cuenta":** revisa que
  `https://TU-DOMINIO/eliminar-cuenta.html` abra.
