# Publicar HAY en Microsoft Azure (paso a paso)

Alternativa a Render (ver `PUBLICAR.md`). Funciona igual; la diferencia es el
precio y el panel. HAY no necesita base de datos ni máquinas virtuales: todo
corre en **un solo App Service**, que ya trae disco persistente.

## Qué poner en la calculadora de Azure

| Servicio | Configuración | Costo aprox. |
|---|---|---|
| **App Service** | Región: East US · SO: **Linux** · Nivel: **Basic** · Instancia: **B1** (1 núcleo, 1,75 GB RAM, 10 GB de disco) · 1 instancia · 730 h | **~13 USD/mes** |
| Azure Communication Services → Email *(opcional, más adelante)* | Para "recuperar contraseña" por correo | centavos al mes |
| **Azure Database for PostgreSQL – Servidor flexible** | Nivel **Burstable B1ms** · 32 GB | **~15–20 USD/mes** |
| App Service Domain *(opcional)* | Un dominio propio, ej. `hayapp.com` | ~12 USD/año |

**No hace falta agregar:** Máquinas virtuales, otras Bases de datos, Cuenta de
almacenamiento, IA, Redes, etc. (las fotos y los datos viven en el disco `/home`
del App Service, que viene incluido).

> No uses el nivel **Free F1** para gente real: solo da 60 minutos de CPU al día,
> 1 GB de disco y Microsoft no lo admite para producción.

---

## Paso 1 — Código en GitHub
Igual que en `PUBLICAR.md`, Paso 1: repositorio privado `hay-app` con todo el
contenido de la carpeta `v1.28`.

## Paso 2 — Crear el App Service
1. <https://portal.azure.com> → **Crear un recurso** → **Aplicación web**.
2. Completa:
   - **Grupo de recursos:** nuevo → `hay`
   - **Nombre:** `hay-app` (tu enlace será `https://hay-app.azurewebsites.net`; si está ocupado, prueba otro)
   - **Publicar:** Código · **Pila del entorno de ejecución:** **Node 20 LTS** (o la LTS más nueva)
   - **Sistema operativo:** **Linux** · **Región:** East US
   - **Plan de precios:** crear nuevo → **Basic B1**
3. **Revisar y crear** → **Crear**. Espera a que diga "Implementación completada".

## Paso 3 — Configuración (variables)
En tu App Service → **Configuración** (o **Variables de entorno**) → **Configuración de la aplicación** → **+ Nueva**:

| Nombre | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/home/data` |
| `ADMIN_EMAIL` | el correo con el que tú vas a entrar a HAY |
| `IDENTITY_KEY` | una frase larga y secreta inventada por ti (mín. 40 caracteres, ej. mezcla de palabras y números). **Guárdala en un lugar seguro y no la cambies nunca**: cifra las fotos de cédula. |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `true` |
| `DATABASE_URL` | `postgres://USUARIO:CLAVE@SERVIDOR.postgres.database.azure.com:5432/hay?sslmode=require` (se copia desde el servidor PostgreSQL creado: *Configuración → Conectar*) |

**Guardar**. Luego, en **Configuración general**:
- **Comando de inicio:** `node backend/server.js`
- **Solo HTTPS:** Activado
- **Always On:** Activado
- **Guardar**.

## Paso 4 — Conectar con GitHub
App Service → **Centro de implementación** → Origen: **GitHub** → autoriza →
elige tu repositorio `hay-app`, rama `main` → **Guardar**. Azure publica solo, y
vuelve a publicar cada vez que subas archivos nuevos a GitHub.

Comprobar: abre `https://TU-APP.azurewebsites.net/health` → debe decir
`"mode":"production"`.

## Paso 5 — Google, textos legales e instalar
Igual que en `PUBLICAR.md`, Pasos 3, 4 y 5, usando tu enlace de Azure.

## Respaldo
App Service → **Copias de seguridad**: revisa que estén activadas (incluyen la
carpeta `/home/data` con usuarios, publicaciones, fotos y cédulas cifradas).

## Si algo falla
App Service → **Secuencia de registro** (Log stream): copia lo que diga y
envíamelo.
