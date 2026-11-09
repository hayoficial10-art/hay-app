/* api.js — capa de acceso al backend (V1.1)
   Archivo nuevo, justificación: separar las llamadas de red de la lógica
   de renderizado de pantallas (screens-*.js) y de la orquestación de
   navegación (app.js). Si el backend no está corriendo, cada función
   devuelve null y quien la llama debe usar el dato de respaldo local
   (fallback) — el prototipo nunca debe romperse por no tener backend. */

// V1.27: si la app la entrega el propio servidor de HAY (producción, o
// http://localhost:3000 en tu PC), la API está en el mismo dominio. Si
// se abre desde el servidor de archivos de desarrollo (puerto 8080) o
// con file://, se usa el backend local en el puerto 3000 como antes.
const HAY_ORIGIN = (location.protocol.startsWith('http') && location.port !== '8080' && location.port !== '8081')
  ? location.origin
  : 'http://localhost:3000';
const HAY_API_BASE = HAY_ORIGIN + '/api';
// V1.35: versión visible en la app (Configuración y Mi perfil)
const HAY_VERSION = '1.61';
// Modo app real (app.html) vs. galería de prototipo (index.html)
const HAY_APP_MODE = Boolean(window.HAY_APP_MODE);
// URL completa de una foto subida (/uploads/...)
function photoSrc(u) {
  if (!u) return '';
  return /^(https?:|data:)/.test(u) ? u : HAY_ORIGIN + u;
}
const HAY_TOKEN_KEY = 'hay_token';
// V1.22: mismo Client ID que se configuró en Google Cloud Console
// (proyecto "Proyecto HAY", tipo Aplicación web, origen autorizado
// http://localhost:8080). El backend usa este mismo valor para
// confirmar que el access token fue emitido para esta app.
const GOOGLE_CLIENT_ID = '808367638236-pobrnraejr0tofn8dho0orgrqhkiact6.apps.googleusercontent.com';
// Cliente de Google Identity Services, inicializado una sola vez la
// primera vez que hace falta (ver initGoogleAuth en app.js).
let GOOGLE_TOKEN_CLIENT = null;

/* Sesión (V1.2): el token vive en localStorage (persiste si se cierra
   el navegador) y CURRENT_USER en memoria (se repuebla al arrancar,
   ver init() en app.js, llamando a /api/me con el token guardado). */
let CURRENT_USER = null;
// V1.3: guarda el token de recuperación devuelto en modo desarrollo,
// para poder mostrarlo/usarlo en la pantalla "Enlace enviado" sin
// tener un servidor de email real conectado (ver server.js).
let PASSWORD_RESET_DEV_TOKEN = null;

function getToken() {
  try {
    return localStorage.getItem(HAY_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(HAY_TOKEN_KEY, token);
    else localStorage.removeItem(HAY_TOKEN_KEY);
  } catch (e) {
    console.warn('[HAY] No se pudo guardar el token de sesión.', e.message);
  }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetchListings() {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings`, { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[HAY] No se pudo conectar al backend (fetchListings). Usando datos locales de respaldo.', e.message);
    return null;
  }
}

async function apiCreateListing(payload) {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}`, status: res.status };
    }
    return { ok: true, listing: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message, status: 0 };
  }
}

/* --- Mis publicaciones (V1.4) --------------------------------------- */

let MY_LISTINGS = [];
let MY_LISTINGS_LOADING = false;

/* --- Detalle de producto real (V1.7) --------------------------------
   ALL_LISTINGS guarda los objetos completos que devuelve el backend
   (con sellerId/sellerEmail/descripción), a diferencia de PRODUCTS en
   screens-main.js que los simplifica para las tarjetas del feed.
   CURRENT_PRODUCT_ID marca qué publicación se está mirando en la
   pantalla de detalle. */
let ALL_LISTINGS = [];
let CURRENT_PRODUCT_ID = null;

function findListingById(id) {
  if (!id) return null;
  return ALL_LISTINGS.find((l) => l.id === id) || MY_LISTINGS.find((l) => l.id === id) || null;
}

/* --- Mensajería real (V1.7) ------------------------------------------
   CURRENT_CHAT guarda con quién y sobre qué publicación se está
   chateando en la pantalla de chat individual. threadId puede ser
   null si todavía no se mandó ningún mensaje real (conversación nueva). */
let CURRENT_CHAT = null;
let CHAT_MESSAGES = [];
let CHAT_LOADING = false;
let THREADS = [];
let THREADS_LOADING = false;
// V1.21: reportes cargados para el panel de moderador.
let REPORTS = [];
let REPORTS_LOADING = false;
// V1.25: números de emergencia (pantalla de Seguridad + su admin).
let EMERGENCY_NUMBERS = [];
let EMERGENCY_NUMBERS_LOADING = false;
// V1.8: última oferta enviada, para poder mostrar un resumen real en
// la pantalla "¡Oferta enviada!" en vez de datos de muestra fijos.
let LAST_OFFER = null;
// V1.10: cuando el vendedor toca "Marcar como vendido" desde una oferta
// aceptada, esto guarda con qué publicación/comprador/monto se llega a la
// pantalla "Confirmar venta" (antes esa pantalla era 100% fija: "Carlos M.",
// bici de muestra, $180/$165 siempre). LAST_SALE guarda el resultado real
// ya confirmado, para mostrarlo en "Calificar" en vez del "Carlos M." fijo.
let CURRENT_SALE = null;
let LAST_SALE = null;
// V1.17: promedio/estrellas seleccionadas en la pantalla "Calificar",
// y una caché simple userId -> {average, count} para no repetir el
// mismo fetch de calificaciones cada vez que se pinta una pantalla
// que muestra la reputación de un vendedor (detalle de producto,
// perfil del vendedor).
let SELECTED_RATING_STARS = 0;
const RATINGS_CACHE = new Map();
// V1.18: contexto del reporte que se está armando (a quién/qué se
// reporta y a qué pantalla volver al terminar). REPORT_REASON guarda
// el motivo elegido en los chips de la pantalla de reporte.
let REPORT_CONTEXT = null;
let REPORT_REASON = null;
// V1.12: id del mensaje de oferta que tiene abierto el formulario
// inline de "Contraofertar" (monto nuevo). Solo puede haber uno
// abierto a la vez; se cierra al enviar o al tocar otra oferta.
let COUNTER_OFFER_OPEN_FOR = null;

function threadIdFor(listingId, userIdA, userIdB) {
  const sorted = [userIdA, userIdB].sort();
  return `${listingId}__${sorted[0]}__${sorted[1]}`;
}

async function apiRespondOffer(messageId, response, counterAmount = null) {
  try {
    const body = { response };
    if (response === 'countered') body.counterAmount = counterAmount;
    const res = await fetch(`${HAY_API_BASE}/messages/${messageId}/offer-response`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, message: data.message, counterMessage: data.counterMessage || null };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiSendMessage(listingId, toUserId, text, extra = {}) {
  try {
    const res = await fetch(`${HAY_API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ listingId, toUserId, text, ...extra }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, message: data.message, threadId: data.threadId };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiFetchThreads() {
  try {
    const res = await fetch(`${HAY_API_BASE}/threads`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[HAY] No se pudo conectar al backend (fetchThreads).', e.message);
    return null;
  }
}

async function apiFetchThreadMessages(threadId) {
  try {
    const res = await fetch(`${HAY_API_BASE}/threads/${threadId}/messages`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[HAY] No se pudo conectar al backend (fetchThreadMessages).', e.message);
    return null;
  }
}

async function apiFetchMyListings() {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings/mine`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[HAY] No se pudo conectar al backend (fetchMyListings).', e.message);
    return null;
  }
}

async function apiDeleteListing(id) {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiUpdateListing(id, payload) {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, listing: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiSetListingStatus(id, status, extra = {}) {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status, ...extra }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, listing: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

/* --- Calificaciones reales (V1.17) ----------------------------------
   Antes "Calificar" (pantalla 21) era puramente visual: las estrellas
   se pintaban al tocarlas pero "Enviar calificación" solo navegaba a
   "Mis publicaciones" sin guardar nada. Tampoco existía ningún dato
   real de reputación: "Detalle de producto" y "Perfil del vendedor"
   mostraban siempre "5.0 (18 calificaciones)" fijo, sin importar el
   vendedor. Ahora se guarda de verdad y se muestra el promedio real. */

async function apiSubmitRating(listingId, stars, comment) {
  try {
    const res = await fetch(`${HAY_API_BASE}/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ listingId, stars, comment }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, rating: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiFetchUserRatings(userId) {
  try {
    const res = await fetch(`${HAY_API_BASE}/users/${userId}/ratings`, { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[HAY] No se pudo conectar al backend (fetchUserRatings).', e.message);
    return null;
  }
}

/* --- Reportes / moderación básica (V1.18) ----------------------------
   Antes "Reportar" (perfil del vendedor) y "Reportar un problema"
   (configuración) eran botones sin ninguna función. Ahora mandan un
   reporte real al backend, asociado a quién lo hizo. */

async function apiSubmitReport({ type, targetUserId, listingId, reason, details }) {
  try {
    const res = await fetch(`${HAY_API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ type, targetUserId, listingId, reason, details }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, report: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

/* --- Panel de moderador (V1.21) --------------------------------------
   Los reportes se guardan desde V1.18 pero nadie los veía — quedaban
   con status:"open" para siempre. Estas dos funciones alimentan el
   panel de moderador (visible solo para CURRENT_USER.isAdmin). */

async function apiFetchReports() {
  try {
    const res = await fetch(`${HAY_API_BASE}/reports`, { headers: { ...authHeaders() } });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, reports: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiUpdateReportStatus(reportId, status, moderatorNote) {
  try {
    const res = await fetch(`${HAY_API_BASE}/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status, moderatorNote }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, report: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

/* --- Números de emergencia (V1.25) ------------------------------------
   GET es público (se muestran a cualquiera, logueado o no). Agregar,
   editar y borrar es solo para el moderador/administrador. */

async function apiFetchEmergencyNumbers() {
  try {
    const res = await fetch(`${HAY_API_BASE}/emergency-numbers`);
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function apiAddEmergencyNumber(label, phone, type) {
  try {
    const res = await fetch(`${HAY_API_BASE}/emergency-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ label, phone, type }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, number: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiUpdateEmergencyNumber(id, fields) {
  try {
    const res = await fetch(`${HAY_API_BASE}/emergency-numbers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(fields),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, number: data };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiDeleteEmergencyNumber(id) {
  try {
    const res = await fetch(`${HAY_API_BASE}/emergency-numbers/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

/* --- Autenticación (V1.2) ------------------------------------------ */

async function apiRegister(email, password, extra) {
  try {
    const res = await fetch(`${HAY_API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(extra || {}) }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, token: data.token, user: data.user, isNew: true, welcomeEmail: Boolean(data.welcomeEmail) };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiLogin(email, password) {
  try {
    const res = await fetch(`${HAY_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, token: data.token, user: data.user };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

/* --- Login real con Google (V1.22) -----------------------------------
   El access token se consigue en el navegador (Google Identity
   Services, ver initGoogleAuth en app.js) con un clic genuino del
   usuario en nuestro propio botón "Continuar con Google". Acá solo se
   lo manda al backend, que es quien realmente lo verifica contra
   Google antes de loguear a nadie. */
async function apiLoginWithGoogle(accessToken) {
  try {
    const res = await fetch(`${HAY_API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, token: data.token, user: data.user, isNew: Boolean(data.isNew), welcomeEmail: Boolean(data.welcomeEmail) };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

// Contexto del intento de login con Google en curso (qué frame de
// teléfono lo pidió), para que el callback fijo de Google Identity
// Services (que se crea una sola vez) sepa dónde mostrar el resultado.
let GOOGLE_AUTH_CTX = null;

function ensureGoogleTokenClient() {
  if (GOOGLE_TOKEN_CLIENT) return true;
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return false;
  GOOGLE_TOKEN_CLIENT = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'openid email profile',
    callback: async (tokenResponse) => {
      const ctx = GOOGLE_AUTH_CTX;
      GOOGLE_AUTH_CTX = null;
      if (!ctx) return;
      const { phoneEl } = ctx;
      const errEl = phoneEl.querySelector('#authErrorMsg');
      phoneEl.querySelectorAll('[data-testid="btn-google-signup"], [data-testid="btn-google-login"]').forEach((b) => {
        b.disabled = false;
        b.innerHTML = `${icon('google')} Continuar con Google`;
      });
      if (tokenResponse.error) {
        if (errEl) { errEl.textContent = 'No se pudo conectar con Google: ' + tokenResponse.error; errEl.style.display = 'block'; }
        return;
      }
      const result = await apiLoginWithGoogle(tokenResponse.access_token);
      if (!result.ok) {
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      setToken(result.token);
      CURRENT_USER = result.user;
      startInboxPoll();
      // V1.35: cuenta nueva con Google → pantalla "Registro completado"
      if (result.isNew) {
        REGISTER_DONE = { welcomeEmail: result.welcomeEmail };
        navigateTo(phoneEl, 'register-success');
        return;
      }
      navigateTo(phoneEl, afterLoginTarget());
    },
  });
  return true;
}

async function apiFetchMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${HAY_API_BASE}/me`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch (e) {
    return null;
  }
}

async function apiLogout() {
  try {
    await fetch(`${HAY_API_BASE}/auth/logout`, { method: 'POST', headers: authHeaders() });
  } catch (e) {
    // Si el backend no responde, igual limpiamos la sesión local.
  }
  setToken(null);
  CURRENT_USER = null;
}

async function apiForgotPassword(email) {
  try {
    const res = await fetch(`${HAY_API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    // devResetToken/devResetLink solo existen en modo desarrollo (ver
    // server.js) — en producción, con email real conectado, no vendrían
    // en esta respuesta.
    return { ok: true, devResetToken: data.devResetToken || null };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

async function apiResetPassword(token, newPassword) {
  try {
    const res = await fetch(`${HAY_API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al backend: ' + e.message };
  }
}

/* --- Verificación de identidad (V1.28) -------------------------------- */
let IDENTITY_DRAFT = { cedula: null, selfie: null };
let PENDING_AFTER_LOGIN = null;
let PENDING_AFTER_IDENTITY = null;
let IDENTITIES = [];
let IDENTITIES_LOADING = false;

function needsIdentity() {
  // V1.38: una verificación rechazada (la cara no coincidió) se tiene que repetir
  return Boolean(CURRENT_USER && CURRENT_USER.identityRequired && (!CURRENT_USER.identityStatus || CURRENT_USER.identityStatus === 'none' || CURRENT_USER.identityStatus === 'rejected'));
}

async function apiSubmitIdentity(cedulaPhoto, selfiePhoto) {
  try {
    const res = await fetch(`${HAY_API_BASE}/me/identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cedulaPhoto, selfiePhoto }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, user: data.user, email: Boolean(data.email) };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al servidor: ' + e.message };
  }
}

// V1.33: foto de perfil (photoData en data URL; null la quita)
async function apiUploadAvatar(photoData) {
  try {
    const res = await fetch(`${HAY_API_BASE}/me/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ photoData }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al servidor: ' + e.message };
  }
}

async function apiFetchIdentities() {
  try {
    const res = await fetch(`${HAY_API_BASE}/admin/identities`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()).identities;
  } catch (e) {
    return null;
  }
}

// Devuelve una URL local (blob:) para mostrar la foto privada al moderador
async function apiFetchIdentityPhoto(userId, kind) {
  try {
    const res = await fetch(`${HAY_API_BASE}/admin/identities/${encodeURIComponent(userId)}/${kind}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch (e) {
    return null;
  }
}

/* --- V1.29: feed paginado (app real) ----------------------------------
   El servidor devuelve de a 20 publicaciones; al bajar se piden más.
   Filtros y búsqueda se resuelven en el servidor. */
const FEED_PAGE_SIZE = 20;
let APP_FEED = { items: [], nextCursor: null, loading: false, key: null, error: false };
let SELLER_LISTINGS = new Map(); // sellerId -> publicaciones activas

async function apiFetchFeed({ category, sellerType, q, sellerId, cursor, limit } = {}) {
  const sp = new URLSearchParams({ limit: String(limit || FEED_PAGE_SIZE) });
  if (category) sp.set('category', category);
  if (sellerType) sp.set('sellerType', sellerType);
  if (q) sp.set('q', q);
  if (sellerId) sp.set('sellerId', sellerId);
  if (cursor) sp.set('cursor', cursor);
  try {
    const res = await fetch(`${HAY_API_BASE}/listings?${sp}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function apiFetchListing(id) {
  try {
    const res = await fetch(`${HAY_API_BASE}/listings/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Guarda publicaciones completas en la caché que usan Detalle/Chat/Oferta
function rememberListings(list) {
  for (const l of list || []) {
    const i = ALL_LISTINGS.findIndex((x) => x.id === l.id);
    if (i === -1) ALL_LISTINGS.push(l);
    else ALL_LISTINGS[i] = l;
  }
  if (ALL_LISTINGS.length > 600) ALL_LISTINGS = ALL_LISTINGS.slice(-400);
}

/* V1.30: eliminar la cuenta (requisito de Google Play) */
async function apiDeleteAccount(password, confirm) {
  try {
    const res = await fetch(`${HAY_API_BASE}/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ password, confirm }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al servidor: ' + e.message };
  }
}


/* --- V1.35 ----------------------------------------------------------- */
// Pantallas de "Registro completado" y "Verificación completada"
let REGISTER_DONE = null; // { welcomeEmail }
let IDENTITY_DONE = null; // { email, next }
// V1.36: aviso en la pantalla de verificación (ej. el teléfono cerró la app al abrir la cámara)
let IDENTITY_NOTICE = null;


// Mensajes recibidos desde una fecha (avisos y sonido)
async function apiFetchInbox(since) {
  try {
    const res = await fetch(`${HAY_API_BASE}/me/inbox?since=${encodeURIComponent(since || '')}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Nombre de la zona para unas coordenadas del GPS
async function apiReverseGeo(lat, lng) {
  try {
    const res = await fetch(`${HAY_API_BASE}/geo/reverse?lat=${lat}&lng=${lng}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (data && data.error) || `Error HTTP ${res.status}` };
    return { ok: true, zone: data.zone || '' };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar al servidor: ' + e.message };
  }
}

// Moderador: fotos antiguas sin miniatura
async function apiFetchListingsWithoutThumbs() {
  try {
    const res = await fetch(`${HAY_API_BASE}/admin/listings-without-thumbs`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()).items || [];
  } catch (e) {
    return null;
  }
}
async function apiUploadThumbs(listingId, thumbs) {
  try {
    const res = await fetch(`${HAY_API_BASE}/admin/listings/${encodeURIComponent(listingId)}/thumbs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ thumbs }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// V1.38: resultado de la comparación de caras (por detrás, solo lo ve el moderador)
async function apiSendIdentityCheck(check) {
  try {
    const res = await fetch(`${HAY_API_BASE}/me/identity/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(check),
    });
    const data = await res.json().catch(() => null);
    return res.ok && data ? data.user : null;
  } catch (e) {
    return null;
  }
}

/* V1.38: dólar BCV → equivalencia en bolívares. La tasa se guarda en el
   teléfono para mostrarla aunque falle la conexión. */
let DOLAR_BCV = (() => { try { return JSON.parse(localStorage.getItem('hay_dolar')) || null; } catch (e) { return null; } })();
async function apiFetchDolar() {
  try {
    const res = await fetch(`${HAY_API_BASE}/dolar`);
    if (!res.ok) return DOLAR_BCV;
    const d = await res.json();
    if (d && d.tasa > 0) {
      DOLAR_BCV = d;
      try { localStorage.setItem('hay_dolar', JSON.stringify(d)); } catch (e) {}
    }
  } catch (e) {}
  return DOLAR_BCV;
}
function bsLabel(usd) {
  const n = Number(String(usd).replace(',', '.'));
  if (!DOLAR_BCV || !(DOLAR_BCV.tasa > 0) || !(n > 0)) return '';
  return '≈ Bs ' + (n * DOLAR_BCV.tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
