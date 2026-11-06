/**
 * HAY — Backend (V1.35)
 * -----------------------------------------------------------------
 * Servidor HTTP hecho SOLO con módulos nativos de Node.js, sin
 * dependencias de npm: se publica y se corre sin "npm install".
 *
 *   node backend/server.js           (puerto 3000, o la variable PORT)
 *
 * V1.29 — escalabilidad:
 *   - Los datos pasan por backend/store.js: PostgreSQL si hay
 *     DATABASE_URL (producción), o archivos JSON en la PC.
 *   - GET /api/listings se pagina (limit + cursor) y filtra en el
 *     servidor (categoría, tipo de vendedor, texto, vendedor).
 *   - Las fotos pasan por backend/storage.js: disco del servidor o un
 *     almacenamiento con CDN compatible con S3 (Cloudflare R2, S3...).
 *
 * Variables de entorno:
 *   NODE_ENV=production   modo producción
 *   DATABASE_URL          PostgreSQL (postgres://usuario:clave@host:puerto/base)
 *   DB_POOL_SIZE          conexiones simultáneas a la base (por defecto 10)
 *   DATA_DIR              carpeta de datos (modo archivo, fotos locales, importación)
 *   ADMIN_EMAIL           correo(s) de moderador, separados por coma
 *   IDENTITY_KEY          clave para cifrar fotos de cédula/selfie
 *   REQUIRE_IDENTITY      "false" para no exigir verificación (solo pruebas)
 *   S3_* / PHOTOS_PUBLIC_URL  almacenamiento de fotos (ver storage.js)
 *   V1.35 — correos (bienvenida, verificación completada, aviso al admin):
 *   MAIL_FROM + RESEND_API_KEY | BREVO_API_KEY | SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS
 *   PUBLIC_URL            dirección pública de la app (para los enlaces de los correos)
 *
 * Endpoints: ver PUBLICAR.md y los VERSION.md de cada versión.
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { createStore } = require('./store');
const mailer = require('./mailer');
const { createStorage } = require('./storage');

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------
const APP_VERSION = '1.41';
const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = '808367638236-pobrnraejr0tofn8dho0orgrqhkiact6.apps.googleusercontent.com';
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const FRONTEND_DIR = path.join(__dirname, '..');
const ADMIN_EMAILS = String(process.env.ADMIN_EMAIL || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const REQUIRE_IDENTITY = process.env.REQUIRE_IDENTITY !== 'false';
const IDENTITY_KEY = process.env.IDENTITY_KEY
  ? crypto.createHash('sha256').update(String(process.env.IDENTITY_KEY)).digest()
  : null;
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_THUMB_BYTES = 250 * 1024;
// V1.38: revisión de fotos en el servidor con Google Cloud Vision (SafeSearch):
// contenido sexual, violencia, heridas y sangre. Se activa con GOOGLE_VISION_KEY.
const GOOGLE_VISION_KEY = String(process.env.GOOGLE_VISION_KEY || '').trim();
const VISION_URL = process.env.VISION_URL || 'https://vision.googleapis.com/v1/images:annotate';
// V1.38: tasa oficial del dólar (BCV) para mostrar la equivalencia en bolívares
const DOLAR_URL = process.env.DOLAR_URL || 'https://ve.dolarapi.com/v1/dolares/oficial'; // V1.35: miniatura de cada foto (para las tarjetas del feed)
const FEED_MAX_LIMIT = 50;
const LEGACY_FEED_LIMIT = 300; // pedido sin "limit" (galería de prototipo)

function shouldBeAdmin(email, usersCountBefore) {
  if (ADMIN_EMAILS.length) return ADMIN_EMAILS.includes(String(email).toLowerCase());
  // Sin ADMIN_EMAIL: en desarrollo el primer usuario queda admin; en producción nadie.
  return !IS_PROD && usersCountBefore === 0;
}

// Productos de muestra (solo modo desarrollo, para la galería de prototipo)
const SEED_LISTINGS = IS_PROD ? [] : [
  { id: 'p1', title: 'Bicicleta montaña rodado 26', price: 180, category: 'Deportes y aire libre', sellerType: 'persona', condition: 'Usado', description: 'Bicicleta rodado 26 en buen estado, frenos y cambios recién ajustados. Ideal para uso diario o senderos ligeros. Se entrega con casco de regalo.', zone: 'Wynwood, Miami, FL', dist: '2.1 mi', art: 1, icon: 'bike', acceptsOffers: true, photos: 3, createdAt: '2026-09-01T10:00:00.000Z' },
  { id: 'p2', title: 'Silla de oficina ergonómica', price: 95, category: 'Hogar y línea blanca', sellerType: 'persona', condition: 'Como nuevo', description: 'Silla ergonómica, poco uso.', zone: 'Miami, FL', dist: '0.8 mi', art: 2, icon: 'sofa', acceptsOffers: true, photos: 4, createdAt: '2026-09-02T10:00:00.000Z' },
  { id: 'p3', title: 'iPhone 12 128GB', price: 340, category: 'Electrónica', sellerType: 'persona', condition: 'Usado', description: 'iPhone 12, batería al 87%.', zone: 'Miami, FL', dist: '1.4 mi', art: 3, icon: 'phone', acceptsOffers: false, photos: 5, createdAt: '2026-09-03T10:00:00.000Z' },
  { id: 'p4', title: 'Mesa de centro madera', price: 60, category: 'Hogar y línea blanca', sellerType: 'persona', condition: 'Usado', description: 'Mesa de centro de madera maciza.', zone: 'Miami, FL', dist: '3.6 mi', art: 4, icon: 'sofa', acceptsOffers: true, photos: 2, createdAt: '2026-09-04T10:00:00.000Z' },
  { id: 'p5', title: 'Chaqueta de cuero talla M', price: 45, category: 'Ropa y accesorios', sellerType: 'persona', condition: 'Como nuevo', description: 'Chaqueta de cuero genuino, talla M.', zone: 'Miami, FL', dist: '1.1 mi', art: 1, icon: 'shirt', acceptsOffers: true, photos: 3, createdAt: '2026-09-05T10:00:00.000Z' },
  { id: 'p6', title: 'Set de libros de cocina (x6)', price: 25, category: 'Libros, música y hobbies', sellerType: 'persona', condition: 'Usado', description: 'Seis libros de cocina en buen estado.', zone: 'Miami, FL', dist: '2.9 mi', art: 2, icon: 'book', acceptsOffers: false, photos: 1, createdAt: '2026-09-06T10:00:00.000Z' },
  { id: 'p7', title: 'Balón de básquetbol Spalding', price: 15, category: 'Deportes y aire libre', sellerType: 'persona', condition: 'Usado', description: 'Balón oficial Spalding, poco uso.', zone: 'Miami, FL', dist: '0.5 mi', art: 3, icon: 'ball', acceptsOffers: false, photos: 2, createdAt: '2026-09-07T10:00:00.000Z' },
  { id: 'p8', title: 'Caja de herramientas completa', price: 70, category: 'Herramientas y construcción', sellerType: 'persona', condition: 'Usado', description: 'Caja de herramientas con set completo.', zone: 'Miami, FL', dist: '4.2 mi', art: 4, icon: 'tools', acceptsOffers: true, photos: 3, createdAt: '2026-09-08T10:00:00.000Z' },
  { id: 'p9', title: 'Juguetes de bloques armables', price: 20, category: 'Niños y bebés', sellerType: 'persona', condition: 'Como nuevo', description: 'Set de bloques armables, casi sin uso.', zone: 'Miami, FL', dist: '1.9 mi', art: 1, icon: 'toy', acceptsOffers: false, photos: 2, createdAt: '2026-09-09T10:00:00.000Z' },
  { id: 'p10', title: 'Sofá 2 plazas gris', price: 220, category: 'Hogar y línea blanca', sellerType: 'persona', condition: 'Usado', description: 'Sofá de 2 plazas, color gris.', zone: 'Miami, FL', dist: '2.4 mi', art: 2, icon: 'sofa', acceptsOffers: true, photos: 4, createdAt: '2026-09-10T10:00:00.000Z' },
];

// Números de emergencia iniciales (911 oficial + CICPC indicados por el usuario)
const SEED_EMERGENCY_NUMBERS = [
  { id: 'e1', label: 'Emergencias nacional (911)', phone: '911', type: 'call' },
  { id: 'e2', label: 'CICPC — línea de emergencia 24h', phone: '0800-242-72-24', type: 'call' },
  { id: 'e3', label: 'CICPC — Tu Denuncia Móvil (WhatsApp)', phone: '0424-740-56-82', type: 'whatsapp' },
  { id: 'e4', label: 'CICPC — Tu Denuncia Móvil (WhatsApp)', phone: '0424-279-06-19', type: 'whatsapp' },
];

const store = createStore({
  databaseUrl: process.env.DATABASE_URL || null,
  poolSize: Number(process.env.DB_POOL_SIZE) || 10,
  dataDir: DATA_DIR,
  seedListings: SEED_LISTINGS,
  seedEmergency: SEED_EMERGENCY_NUMBERS,
});
const photoStorage = createStorage({ uploadsDir: UPLOADS_DIR });

const BUSINESS_CATEGORIES = ['Alimentos', 'Salud', 'Belleza y estética', 'Agro y vivero', 'Servicios', 'Servicios públicos', 'Otros negocios'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function samePassword(password, user) {
  const a = Buffer.from(hashPassword(password, user.salt), 'hex');
  const b = Buffer.from(String(user.passwordHash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await store.sessions.create(token, userId, new Date().toISOString());
  return token;
}

// Usuario dueño del token (o null)
async function currentUser(req) {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer\s+([a-f0-9]{16,128})$/i);
  if (!match) return null;
  const session = await store.sessions.get(match[1]);
  if (!session) return null;
  if (Date.now() - new Date(session.createdAt).getTime() > SESSION_TTL_MS) {
    await store.sessions.remove(match[1]);
    return null;
  }
  const user = await store.users.get(session.userId);
  // ADMIN_EMAIL puede asignarse después de creada la cuenta
  if (user && ADMIN_EMAILS.length && ADMIN_EMAILS.includes(user.email) && !user.isAdmin) {
    user.isAdmin = true;
    await store.users.update(user.id, user);
  }
  return user;
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
    isAdmin: Boolean(u.isAdmin),
    accountType: u.accountType || 'persona',
    businessName: u.businessName || null,
    businessCategory: u.businessCategory || null,
    identityStatus: (u.identity && u.identity.status) || 'none',
    identityReason: (u.identity && u.identity.status === 'rejected' && u.identity.check && u.identity.check.nota) || null, // V1.38
    avatarUrl: u.avatarUrl || null, // V1.33: foto de perfil
    identityRequired: REQUIRE_IDENTITY,
    hasPassword: Boolean(u.passwordHash),
  };
}

// Privacidad: el público no ve el correo completo del vendedor
function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return 'Usuario HAY';
  return local.slice(0, Math.min(3, local.length)) + '•••@' + domain.split('.')[0].slice(0, 1) + '•••';
}
function publicListing(l) {
  return { ...l, sellerEmail: l.sellerBusinessName || maskEmail(l.sellerEmail) };
}

// Fotos: validar data URL (tipo real + tamaño)
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
function decodeImageDataUrl(d, { minBytes = 0 } = {}) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
  if (!m) return { error: 'Formato de foto inválido (se acepta JPG, PNG o WEBP)' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_PHOTO_BYTES) return { error: 'La foto es demasiado grande (máx. 1,5 MB)' };
  if (buf.length < minBytes) return { error: 'La foto es demasiado pequeña o está vacía' };
  const sig = buf.slice(0, 12).toString('hex');
  const okSig = sig.startsWith('ffd8ff') || sig.startsWith('89504e47') || (sig.startsWith('52494646') && buf.slice(8, 12).toString() === 'WEBP');
  if (!okSig) return { error: 'El archivo no parece ser una imagen válida' };
  return { buf, mime: m[1] };
}
async function savePhotos(dataUrls) {
  if (!Array.isArray(dataUrls)) return { urls: [] };
  if (dataUrls.length > MAX_PHOTOS) return { error: `Máximo ${MAX_PHOTOS} fotos por publicación` };
  const decoded = [];
  for (const d of dataUrls) {
    const r = decodeImageDataUrl(d);
    if (r.error) return { error: r.error.replace('La foto es', 'Una de las fotos es') };
    decoded.push(r);
  }
  const urls = [];
  for (const r of decoded) {
    const name = crypto.randomBytes(12).toString('hex') + '.' + PHOTO_TYPES[r.mime];
    urls.push(await photoStorage.put(name, r.buf, r.mime));
  }
  return { urls };
}

// V1.35: miniaturas (~480 px) que el teléfono genera junto a cada foto.
// thumbData[i] corresponde a urls[i]. Devuelve { url de la foto: url de la miniatura }.
// Una miniatura inválida o faltante no impide publicar: esa tarjeta usa la foto grande.
async function saveThumbs(urls, thumbData) {
  const out = {};
  if (!Array.isArray(thumbData)) return out;
  for (let i = 0; i < urls.length && i < thumbData.length; i++) {
    const r = decodeImageDataUrl(thumbData[i]);
    if (r.error || r.buf.length > MAX_THUMB_BYTES) continue;
    const name = crypto.randomBytes(12).toString('hex') + '-t.' + PHOTO_TYPES[r.mime];
    out[urls[i]] = await photoStorage.put(name, r.buf, r.mime);
  }
  return out;
}

// V1.38: revisión de fotos con Google Cloud Vision SafeSearch. Devuelve el
// motivo en palabras si una foto no se permite, o null. Sin GOOGLE_VISION_KEY,
// o si Vision no responde, no bloquea (queda la revisión del teléfono).
const LIKELIHOOD = { UNKNOWN: 0, VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5 };
function postJSONUrl(url, payload, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(payload);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(u, { method: 'POST', timeout: timeoutMs, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + out.slice(0, 200)));
        try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('tiempo de espera agotado')));
    req.on('error', reject);
    req.end(body);
  });
}
// V1.39: en las fotos de PUBLICACIONES también se buscan personas (caras y
// cuerpos), porque el detector del teléfono no ve las caras muy de cerca
// (ej. una selfie que llena toda la foto). Las fotos de perfil no se revisan
// por personas: ahí la cara es lo normal.
const UMBRAL_CARA_VISION = 0.5;     // faceAnnotations[].detectionConfidence
const UMBRAL_PERSONA_VISION = 0.6;  // localizedObjectAnnotations "Person"
const PARTES_PERSONA = new Set(['Person', 'Human face', 'Human head', 'Human body', 'Human hand', 'Human leg', 'Human arm', 'Human foot', 'Human eye', 'Human mouth', 'Human nose', 'Human ear', 'Human beard', 'Human hair']);
async function moderatePhotos(dataUrls, { personas = false } = {}) {
  if (!GOOGLE_VISION_KEY || !Array.isArray(dataUrls) || !dataUrls.length) return null;
  const features = [{ type: 'SAFE_SEARCH_DETECTION' }];
  if (personas) features.push({ type: 'FACE_DETECTION', maxResults: 3 }, { type: 'OBJECT_LOCALIZATION', maxResults: 15 });
  const requests = [];
  for (const d of dataUrls.slice(0, MAX_PHOTOS)) {
    const m = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
    if (m) requests.push({ image: { content: m[1] }, features });
  }
  if (!requests.length) return null;
  try {
    const out = await postJSONUrl(VISION_URL + '?key=' + encodeURIComponent(GOOGLE_VISION_KEY), { requests });
    for (const r of out.responses || []) {
      const s = r.safeSearchAnnotation || {};
      const v = (k) => LIKELIHOOD[s[k]] || 0;
      if (v('adult') >= 4 || v('racy') >= 5) return 'Una de las fotos no se permite: parece tener contenido sexual.';
      if (v('violence') >= 4) return 'Una de las fotos no se permite: parece mostrar violencia.';
      if (v('medical') >= 4) return 'Una de las fotos no se permite: parece mostrar heridas, sangre o cuerpos.';
      if (personas) {
        const cara = (r.faceAnnotations || []).some((f) => (f.detectionConfidence || 0) >= UMBRAL_CARA_VISION);
        const persona = (r.localizedObjectAnnotations || []).some((o) => PARTES_PERSONA.has(o.name) && (o.score || 0) >= UMBRAL_PERSONA_VISION);
        if (cara || persona) return 'Una de las fotos no se permite: parece que se ve una persona. En HAY solo van fotos del artículo, sin personas. Toma la foto solo al artículo, con un fondo liso.';
      }
    }
    return null;
  } catch (e) {
    console.warn('[HAY backend] Revisión de fotos (Vision) no disponible:', e.message);
    return null;
  }
}

// V1.38: tasa oficial del dólar en bolívares (BCV). Se consulta como máximo
// cada 30 minutos. DOLAR_BCV permite fijarla a mano si el servicio falla.
let DOLAR = { tasa: null, fecha: null, fuente: null, at: 0 };
function getJSONUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { timeout: timeoutMs, headers: { 'User-Agent': 'HAY-app/' + APP_VERSION, Accept: 'application/json' } }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('tiempo de espera agotado')));
    req.on('error', reject);
  });
}
async function dolarBCV() {
  const manual = Number(process.env.DOLAR_BCV);
  if (manual > 0) return { tasa: manual, fecha: null, fuente: 'manual' };
  if (DOLAR.tasa && Date.now() - DOLAR.at < 30 * 60 * 1000) return DOLAR;
  try {
    const j = await getJSONUrl(DOLAR_URL);
    const tasa = Number(j.promedio || j.venta || j.price);
    if (tasa > 0) DOLAR = { tasa: Math.round(tasa * 10000) / 10000, fecha: j.fechaActualizacion || null, fuente: 'BCV', at: Date.now() };
  } catch (e) {
    console.warn('[HAY backend] No se pudo consultar el dólar BCV:', e.message);
  }
  return DOLAR;
}

// V1.35: ubicación aproximada de una publicación (redondeada a ~1 km, por privacidad)
function roundCoord(v, min, max) {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || Number.isNaN(n) || n < min || n > max) return null;
  return Math.round(n * 100) / 100;
}

// V1.35: nombre de la zona a partir de coordenadas (OpenStreetMap / Nominatim).
// Nominatim pide máx. 1 consulta por segundo y un User-Agent propio: se
// espacian las consultas y se guardan las respuestas.
const GEO_CACHE = new Map();
let GEO_NEXT_SLOT = 0;
function reverseGeocode(lat, lng) {
  const key = lat.toFixed(2) + ',' + lng.toFixed(2);
  if (GEO_CACHE.has(key)) return Promise.resolve(GEO_CACHE.get(key));
  const wait = Math.max(0, GEO_NEXT_SLOT - Date.now());
  GEO_NEXT_SLOT = Date.now() + wait + 1100;
  return new Promise((resolve) => setTimeout(resolve, wait)).then(() => new Promise((resolve, reject) => {
    const req = https.get(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=es&lat=${lat}&lon=${lng}`,
      { timeout: 8000, headers: { 'User-Agent': `HAY-app/${APP_VERSION} (marketplace; ${process.env.PUBLIC_URL || 'hay-app.onrender.com'})` } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error('el servicio de mapas respondió ' + res.statusCode));
          try {
            const a = (JSON.parse(body) || {}).address || {};
            const local = a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet || a.town || a.city_district || a.city || a.municipality || '';
            const big = a.city || a.town || a.municipality || a.county || a.state || '';
            const zone = [local, big !== local ? big : '', a.state && a.state !== big ? a.state : ''].filter(Boolean).slice(0, 2).join(', ');
            if (GEO_CACHE.size > 5000) GEO_CACHE.clear();
            GEO_CACHE.set(key, zone);
            resolve(zone);
          } catch (e) {
            reject(new Error('respuesta inesperada del servicio de mapas'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('el servicio de mapas no respondió')));
    req.on('error', reject);
  }));
}

// V1.35: correos automáticos (no detienen la respuesta si fallan)
function appUrlFor(req) {
  return process.env.PUBLIC_URL || (req.headers.host ? 'https://' + req.headers.host + '/' : '');
}
function sendWelcomeEmails(req, user, method) {
  const appUrl = appUrlFor(req);
  mailer.sendMail({ to: user.email, ...mailer.welcomeEmail({ name: user.businessName, appUrl, identityPending: REQUIRE_IDENTITY }) });
  for (const admin of ADMIN_EMAILS) {
    if (admin !== user.email) mailer.sendMail({ to: admin, ...mailer.adminNewUserEmail({ email: user.email, accountType: user.accountType, businessName: user.businessName, method }) });
  }
}

// V1.33: borra del disco una foto guardada localmente (/uploads/...); las de S3/R2 quedan.
function removeLocalPhoto(url) {
  if (!url || photoStorage.kind !== 'local' || !String(url).startsWith('/uploads/')) return;
  try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(url))); } catch (e) {}
}

// Identidad: cifrado AES-256-GCM (si hay IDENTITY_KEY)
function encryptIdentity(buf) {
  if (!IDENTITY_KEY) return buf;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', IDENTITY_KEY, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
function decryptIdentity(name, raw) {
  if (!raw) return null;
  if (!name.endsWith('.enc')) return raw;
  if (!IDENTITY_KEY) return null;
  const d = crypto.createDecipheriv('aes-256-gcm', IDENTITY_KEY, raw.slice(0, 12));
  d.setAuthTag(raw.slice(12, 28));
  return Buffer.concat([d.update(raw.slice(28)), d.final()]);
}
async function saveIdentityFile(userId, kind, buf) {
  const name = `${userId}-${kind}-${crypto.randomBytes(8).toString('hex')}.${IDENTITY_KEY ? 'enc' : 'img'}`;
  await store.identity.put(name, encryptIdentity(buf));
  return name;
}

// Login con Google: verificar el token contra Google (nunca confiar en el frontend)
function verifyGoogleAccessToken(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken),
      { timeout: 8000 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error('Token de Google inválido o vencido'));
          let payload;
          try {
            payload = JSON.parse(body);
          } catch (e) {
            return reject(new Error('Respuesta inesperada de Google: ' + e.message));
          }
          if (payload.aud !== GOOGLE_CLIENT_ID) return reject(new Error('El token no fue emitido para esta app'));
          resolve(payload);
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado consultando a Google')));
    req.on('error', reject);
  });
}

// Conversaciones: id = publicación + los dos usuarios (orden fijo)
function threadIdFor(listingId, userIdA, userIdB) {
  const sorted = [userIdA, userIdB].sort();
  return `${listingId}__${sorted[0]}__${sorted[1]}`;
}
function parseThreadId(threadId) {
  const parts = String(threadId).split('__');
  if (parts.length < 3) return null;
  const idB = parts.pop();
  const idA = parts.pop();
  return { listingId: parts.join('__'), idA, idB };
}

// Límite de intentos por IP (frena fuerza bruta). Por servidor.
const RATE = new Map();
function rateLimited(req, key, max = 20, windowMs = 10 * 60 * 1000) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const k = key + ':' + ip;
  const now = Date.now();
  const entry = RATE.get(k) || { count: 0, start: now };
  if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
  entry.count += 1;
  RATE.set(k, entry);
  return entry.count > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of RATE) if (now - v.start > 10 * 60 * 1000) RATE.delete(k);
}, 5 * 60 * 1000).unref();

// Archivos estáticos: la app y las fotos locales, desde el mismo dominio
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.md': 'text/plain; charset=utf-8',
};
const PUBLIC_TOP = new Set(['app.html', 'index.html', 'prototipo.html', 'terminos.html', 'privacidad.html', 'eliminar-cuenta.html', 'manifest.webmanifest', 'sw.js']);
const PUBLIC_DIRS = new Set(['css', 'js', 'assets', 'vendor']); // V1.33: vendor = revisión de fotos (modelos)
function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch (e) {
    return false;
  }
  // Nunca permitir "..", barras invertidas ni bytes nulos
  if (rel.split('/').some((seg) => seg === '..' || seg === '.') || rel.includes('\\') || rel.includes('\0')) return false;
  let baseDir = FRONTEND_DIR;
  if (rel === '') rel = 'app.html';
  const top = rel.split('/')[0];
  if (top === 'uploads') {
    baseDir = UPLOADS_DIR;
    rel = rel.slice('uploads/'.length);
  } else if (!(PUBLIC_TOP.has(rel) || PUBLIC_DIRS.has(top))) {
    return false; // backend/, datos, etc. nunca se sirven
  }
  const full = path.resolve(baseDir, rel);
  if (!full.startsWith(path.resolve(baseDir) + path.sep)) return false;
  let st;
  try { st = fs.statSync(full); } catch (e) { return false; }
  if (!st.isFile()) return false;
  const ext = path.extname(full).toLowerCase();
  // V1.35: ETag → si el teléfono ya tiene el archivo, responde "304 sin cambios"
  // (antes se volvían a descargar todos los .js y .css en cada apertura).
  const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ETag: etag,
    Vary: 'Accept-Encoding',
    // V1.33: los modelos de revisión de fotos (vendor/, ~9,5 MB) se guardan 30 días en el teléfono
    'Cache-Control': top === 'uploads' ? 'public, max-age=31536000, immutable' : top === 'vendor' ? 'public, max-age=2592000' : 'no-cache',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  // V1.35: texto comprimido con gzip (los .js y .css pesan ~4 veces menos)
  const gzipOk = COMPRESSIBLE.has(ext) && st.size < 4e6 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gzipOk) {
    let cached = GZIP_CACHE.get(full);
    if (!cached || cached.etag !== etag) {
      cached = { etag, buf: zlib.gzipSync(fs.readFileSync(full), { level: 9 }) };
      GZIP_CACHE.set(full, cached);
    }
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': cached.buf.length });
    res.end(req.method === 'HEAD' ? undefined : cached.buf);
    return true;
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(full).pipe(res);
  return true;
}
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.md']);
const GZIP_CACHE = new Map();

function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 12e6) {
        req.destroy();
        reject(new Error('Body demasiado grande'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
// Lee el JSON del cuerpo; si es inválido responde 400 y devuelve null
async function jsonBody(req, res) {
  try {
    const raw = await readBody(req);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    sendJSON(res, 400, { error: 'JSON inválido en el cuerpo de la petición: ' + e.message });
    return null;
  }
}

// ---------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const M = req.method;
  const api = (...segs) => parts[0] === 'api' && segs.every((s, i) => s === '*' ? Boolean(parts[i + 1]) : parts[i + 1] === s) && parts.length === segs.length + 1;

  if (M === 'OPTIONS') return sendJSON(res, 204, {});

  // Forzar HTTPS en producción (el hosting avisa con x-forwarded-proto)
  if (IS_PROD && req.headers['x-forwarded-proto'] === 'http') {
    res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
    return res.end();
  }

  if ((M === 'GET' || M === 'HEAD') && parts[0] !== 'api' && url.pathname !== '/health') {
    if (serveStatic(req, res, url.pathname)) return;
  }

  // V1.30: Digital Asset Links — prueba ante Android/Play Store que la app
  // de la tienda y este sitio son del mismo dueño. Con esto la app se abre
  // a pantalla completa, sin barra del navegador.
  //   ANDROID_PACKAGE       ej. app.hay.twa
  //   ANDROID_CERT_SHA256   huella(s) SHA-256 del certificado de firma (Play Console
  //                         → Integridad de la app), separadas por coma
  if (M === 'GET' && url.pathname === '/.well-known/assetlinks.json') {
    const pkg = String(process.env.ANDROID_PACKAGE || '').trim();
    const fps = String(process.env.ANDROID_CERT_SHA256 || '').split(',').map((f) => f.trim().toUpperCase()).filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
    if (!pkg || !fps.length) return sendJSON(res, 404, { error: 'Asset Links no configurado (faltan ANDROID_PACKAGE y ANDROID_CERT_SHA256)' });
    const body = JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fps } }]);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' });
    return res.end(body);
  }

  if (M === 'GET' && url.pathname === '/health') {
    return sendJSON(res, 200, { ok: true, service: 'hay-backend', version: APP_VERSION, mode: IS_PROD ? 'production' : 'development', db: store.kind, photos: photoStorage.kind, mail: mailer.mailerKind(), photoReview: GOOGLE_VISION_KEY ? 'vision' : 'phone' });
  }

  // ------------------------------ Publicaciones -----------------------
  if (M === 'GET' && api('listings')) {
    // V1.29: paginado y filtrado en el servidor.
    //   ?limit=20&cursor=...&category=&sellerType=&q=&sellerId=
    // Sin "limit" (galería de prototipo) devuelve un arreglo, con tope.
    const sp = url.searchParams;
    const paged = sp.has('limit');
    const limit = paged ? Math.min(Math.max(parseInt(sp.get('limit'), 10) || 20, 1), FEED_MAX_LIMIT) : LEGACY_FEED_LIMIT;
    const result = await store.listings.feed({
      category: sp.get('category') || null,
      sellerType: sp.get('sellerType') || null,
      q: (sp.get('q') || '').trim().slice(0, 60) || null,
      sellerId: sp.get('sellerId') || null,
      limit,
      cursor: sp.get('cursor') || null,
    });
    const items = result.items.map(publicListing);
    return sendJSON(res, 200, paged ? { items, nextCursor: result.nextCursor } : items);
  }

  if (M === 'GET' && api('listings', 'mine')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para ver tus publicaciones' });
    return sendJSON(res, 200, await store.listings.bySeller(user.id));
  }

  if (M === 'GET' && api('listings', '*')) {
    const found = await store.listings.get(parts[2]);
    if (!found) return sendJSON(res, 404, { error: 'Publicación no encontrada' });
    return sendJSON(res, 200, publicListing(found));
  }

  if (M === 'POST' && api('listings')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para publicar' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const missing = ['title', 'price', 'category', 'condition'].filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length) return sendJSON(res, 400, { error: 'Faltan campos obligatorios: ' + missing.join(', ') });
    const price = Number(body.price);
    if (Number.isNaN(price) || price < 0) return sendJSON(res, 400, { error: 'El precio debe ser un número válido y no negativo' });
    if (REQUIRE_IDENTITY && !(user.identity && user.identity.status && user.identity.status !== 'rejected')) {
      return sendJSON(res, 403, { error: 'Antes de publicar tienes que verificar tu identidad (foto de cédula + selfie).', code: 'IDENTITY_REQUIRED' });
    }
    const blocked = await moderatePhotos(body.photoData || [], { personas: true });
    if (blocked) return sendJSON(res, 400, { error: blocked, code: 'PHOTO_BLOCKED' });
    const saved = await savePhotos(body.photoData || []);
    if (saved.error) return sendJSON(res, 400, { error: saved.error });
    if (IS_PROD && saved.urls.length === 0) return sendJSON(res, 400, { error: 'Agrega al menos una foto de tu producto' });
    const thumbs = await saveThumbs(saved.urls, body.thumbData);
    const listing = await store.listings.insert({
      title: String(body.title).slice(0, 60),
      price,
      category: String(body.category).slice(0, 60),
      condition: String(body.condition).slice(0, 30),
      description: body.description ? String(body.description).slice(0, 3000) : '',
      zone: body.zone ? String(body.zone).slice(0, 80) : '',
      dist: '',
      art: (crypto.randomInt(4)) + 1,
      icon: body.icon ? String(body.icon).slice(0, 20) : 'tag',
      acceptsOffers: Boolean(body.acceptsOffers),
      photoUrls: saved.urls,
      ...(Object.keys(thumbs).length ? { photoThumbs: thumbs } : {}),
      lat: roundCoord(body.lat, -90, 90),
      lng: roundCoord(body.lng, -180, 180),
      photos: saved.urls.length || Number(body.photos) || 0,
      createdAt: new Date().toISOString(),
      sellerType: user.accountType || 'persona',
      sellerBusinessName: user.accountType === 'negocio' ? user.businessName : null,
      sellerId: user.id,
      sellerEmail: user.email,
      status: 'active',
    });
    return sendJSON(res, 201, listing);
  }

  if (M === 'PUT' && api('listings', '*')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para editar una publicación' });
    const existing = await store.listings.get(parts[2]);
    if (!existing) return sendJSON(res, 404, { error: 'Publicación no encontrada' });
    if (existing.sellerId !== user.id) return sendJSON(res, 403, { error: 'No puedes editar una publicación que no es tuya' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const missing = ['title', 'price', 'category', 'condition'].filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length) return sendJSON(res, 400, { error: 'Faltan campos obligatorios: ' + missing.join(', ') });
    const price = Number(body.price);
    if (Number.isNaN(price) || price < 0) return sendJSON(res, 400, { error: 'El precio debe ser un número válido y no negativo' });
    const keep = Array.isArray(body.keepPhotoUrls)
      ? body.keepPhotoUrls.filter((u) => (existing.photoUrls || []).includes(u))
      : existing.photoUrls || [];
    const blockedEdit = await moderatePhotos(body.photoData || [], { personas: true });
    if (blockedEdit) return sendJSON(res, 400, { error: blockedEdit, code: 'PHOTO_BLOCKED' });
    const savedEdit = await savePhotos(body.photoData || []);
    if (savedEdit.error) return sendJSON(res, 400, { error: savedEdit.error });
    const photoUrls = keep.concat(savedEdit.urls).slice(0, MAX_PHOTOS);
    if (IS_PROD && photoUrls.length === 0) return sendJSON(res, 400, { error: 'La publicación necesita al menos una foto' });
    const newThumbs = await saveThumbs(savedEdit.urls, body.thumbData);
    const photoThumbs = {};
    for (const u of photoUrls) {
      const t = (existing.photoThumbs && existing.photoThumbs[u]) || newThumbs[u];
      if (t) photoThumbs[u] = t;
    }
    const hasCoords = body.lat !== undefined || body.lng !== undefined;
    const updated = await store.listings.update(existing.id, {
      ...existing,
      photoUrls,
      photoThumbs,
      lat: hasCoords ? roundCoord(body.lat, -90, 90) : existing.lat ?? null,
      lng: hasCoords ? roundCoord(body.lng, -180, 180) : existing.lng ?? null,
      photos: photoUrls.length,
      title: String(body.title).slice(0, 60),
      price,
      category: String(body.category).slice(0, 60),
      condition: String(body.condition).slice(0, 30),
      description: body.description !== undefined ? String(body.description).slice(0, 3000) : existing.description,
      zone: body.zone ? String(body.zone).slice(0, 80) : existing.zone,
      icon: body.icon ? String(body.icon).slice(0, 20) : existing.icon,
      acceptsOffers: body.acceptsOffers !== undefined ? Boolean(body.acceptsOffers) : existing.acceptsOffers,
      updatedAt: new Date().toISOString(),
    });
    return sendJSON(res, 200, updated);
  }

  if (M === 'PATCH' && api('listings', '*', 'status')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para cambiar el estado de una publicación' });
    const listing = await store.listings.get(parts[2]);
    if (!listing) return sendJSON(res, 404, { error: 'Publicación no encontrada' });
    if (listing.sellerId !== user.id) return sendJSON(res, 403, { error: 'No puedes cambiar el estado de una publicación que no es tuya' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const VALID_STATUSES = ['active', 'paused', 'sold'];
    if (!VALID_STATUSES.includes(body.status)) return sendJSON(res, 400, { error: 'Estado inválido. Debe ser: ' + VALID_STATUSES.join(', ') });
    if (body.status === 'sold') {
      if (body.buyerId !== undefined && body.buyerId !== null) {
        const buyerId = String(body.buyerId);
        if (!(await store.users.get(buyerId))) return sendJSON(res, 404, { error: 'El comprador indicado no existe' });
        if (buyerId === user.id) return sendJSON(res, 400, { error: 'No puedes venderte tu propia publicación' });
        listing.soldTo = buyerId;
      }
      if (body.finalPrice !== undefined && body.finalPrice !== null) {
        const finalPrice = Number(body.finalPrice);
        if (Number.isNaN(finalPrice) || finalPrice <= 0) return sendJSON(res, 400, { error: 'El precio final debe ser un número válido y mayor a 0' });
        listing.finalPrice = finalPrice;
      }
    }
    listing.status = body.status;
    listing.updatedAt = new Date().toISOString();
    return sendJSON(res, 200, await store.listings.update(listing.id, listing));
  }

  if (M === 'DELETE' && api('listings', '*')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para eliminar una publicación' });
    const found = await store.listings.get(parts[2]);
    if (!found) return sendJSON(res, 404, { error: 'Publicación no encontrada' });
    // V1.39: el moderador (ADMIN_EMAIL) puede eliminar cualquier publicación.
    if (found.sellerId !== user.id && !user.isAdmin) return sendJSON(res, 403, { error: 'No puedes eliminar una publicación que no es tuya' });
    await store.listings.remove(found.id);
    if (found.sellerId !== user.id) console.log('[HAY backend] Moderador', user.email, 'eliminó la publicación', found.id, '(' + found.title + ') de', found.sellerEmail);
    return sendJSON(res, 200, { ok: true, deletedId: found.id });
  }

  // ------------------------------ Mensajes ----------------------------
  if (M === 'POST' && api('messages')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para enviar mensajes' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const listingId = String(body.listingId || '');
    const toUserId = String(body.toUserId || '');
    const text = String(body.text || '').trim();
    if (!listingId || !toUserId || !text) return sendJSON(res, 400, { error: 'Faltan campos obligatorios: listingId, toUserId, text' });
    if (toUserId === user.id) return sendJSON(res, 400, { error: 'No puedes enviarte un mensaje a ti mismo' });
    if (!(await store.users.get(toUserId))) return sendJSON(res, 404, { error: 'El destinatario no existe' });
    const type = body.type === 'offer' ? 'offer' : 'text';
    let amount = null;
    if (type === 'offer') {
      amount = Number(body.amount);
      if (Number.isNaN(amount) || amount <= 0) return sendJSON(res, 400, { error: 'El monto de la oferta debe ser un número válido y mayor a 0' });
    }
    const threadId = threadIdFor(listingId, user.id, toUserId);
    const message = await store.messages.insert({
      threadId,
      listingId,
      fromUserId: user.id,
      toUserId,
      text: text.slice(0, 2000),
      type,
      amount,
      offerStatus: type === 'offer' ? 'pending' : null,
      createdAt: new Date().toISOString(),
    });
    return sendJSON(res, 201, { message, threadId });
  }

  if (M === 'GET' && api('threads', '*', 'messages')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para ver esta conversación' });
    const parsed = parseThreadId(parts[2]);
    if (!parsed) return sendJSON(res, 400, { error: 'Id de conversación inválido' });
    if (user.id !== parsed.idA && user.id !== parsed.idB) return sendJSON(res, 403, { error: 'No puedes ver una conversación que no es tuya' });
    const otherUserId = user.id === parsed.idA ? parsed.idB : parsed.idA;
    const [otherUser, listing, messages] = await Promise.all([
      store.users.get(otherUserId),
      store.listings.get(parsed.listingId),
      store.messages.byThread(parts[2]),
    ]);
    return sendJSON(res, 200, {
      threadId: parts[2],
      listingId: parsed.listingId,
      listingTitle: listing ? listing.title : null,
      otherUser: otherUser ? { id: otherUser.id, email: otherUser.email } : { id: otherUserId, email: null },
      messages,
    });
  }

  if (M === 'GET' && api('threads')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para ver tus mensajes' });
    const lasts = await store.messages.lastPerThread(user.id);
    const otherIds = [...new Set(lasts.map((m) => (m.fromUserId === user.id ? m.toUserId : m.fromUserId)))];
    const [emails, titles] = await Promise.all([
      store.users.emails(otherIds),
      store.listings.titles([...new Set(lasts.map((m) => m.listingId))]),
    ]);
    const threads = lasts.map((m) => {
      const otherUserId = m.fromUserId === user.id ? m.toUserId : m.fromUserId;
      return {
        threadId: m.threadId,
        listingId: m.listingId,
        listingTitle: titles[m.listingId] || null,
        otherUser: { id: otherUserId, email: emails[otherUserId] || null },
        lastMessage: { text: m.text, createdAt: m.createdAt, fromUserId: m.fromUserId },
      };
    });
    threads.sort((a, b) => (a.lastMessage.createdAt < b.lastMessage.createdAt ? 1 : -1));
    return sendJSON(res, 200, threads);
  }

  if (M === 'PATCH' && api('messages', '*', 'offer-response')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para responder una oferta' });
    const msg = await store.messages.get(parts[2]);
    if (!msg) return sendJSON(res, 404, { error: 'Mensaje no encontrado' });
    if (msg.type !== 'offer') return sendJSON(res, 400, { error: 'Ese mensaje no es una oferta' });
    if (msg.toUserId !== user.id) return sendJSON(res, 403, { error: 'Solo el destinatario de la oferta puede responderla' });
    if (msg.offerStatus !== 'pending') return sendJSON(res, 400, { error: 'Esta oferta ya fue respondida' });
    const body = await jsonBody(req, res);
    if (!body) return;
    if (!['accepted', 'rejected', 'countered'].includes(body.response)) {
      return sendJSON(res, 400, { error: 'La respuesta debe ser "accepted", "rejected" o "countered"' });
    }
    if (body.response === 'countered') {
      const counterAmount = Number(body.counterAmount);
      if (Number.isNaN(counterAmount) || counterAmount <= 0) return sendJSON(res, 400, { error: 'El monto de la contraoferta debe ser un número válido y mayor a 0' });
      msg.offerStatus = 'countered';
      await store.messages.update(msg.id, msg);
      const counterMessage = await store.messages.insert({
        threadId: msg.threadId,
        listingId: msg.listingId,
        fromUserId: user.id,
        toUserId: msg.fromUserId,
        text: `Contraoferta: $${counterAmount}`,
        type: 'offer',
        amount: counterAmount,
        offerStatus: 'pending',
        parentOfferId: msg.id,
        createdAt: new Date().toISOString(),
      });
      return sendJSON(res, 200, { message: msg, counterMessage });
    }
    msg.offerStatus = body.response;
    await store.messages.update(msg.id, msg);
    return sendJSON(res, 200, { message: msg });
  }

  // V1.35: mensajes recibidos desde una fecha — la app pregunta cada pocos
  // segundos para sonar y avisar de mensajes nuevos. "now" es la hora del
  // servidor, que la app usa como "since" en la próxima consulta.
  if (M === 'GET' && api('me', 'inbox')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Sesión inválida o expirada' });
    const now = new Date().toISOString();
    const sinceRaw = url.searchParams.get('since');
    const sinceMs = Date.parse(sinceRaw || '');
    if (!sinceRaw || Number.isNaN(sinceMs)) return sendJSON(res, 200, { now, items: [] });
    const since = new Date(Math.max(sinceMs, Date.now() - 7 * 24 * 3600 * 1000)).toISOString();
    const msgs = await store.messages.incoming(user.id, since, 20);
    const [emails, titles] = await Promise.all([
      store.users.emails([...new Set(msgs.map((m) => m.fromUserId))]),
      store.listings.titles([...new Set(msgs.map((m) => m.listingId))]),
    ]);
    return sendJSON(res, 200, {
      now,
      items: msgs.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        listingId: m.listingId,
        listingTitle: titles[m.listingId] || null,
        fromUserId: m.fromUserId,
        fromEmail: emails[m.fromUserId] || null,
        text: String(m.text || '').slice(0, 140),
        type: m.type,
        amount: m.amount,
        createdAt: m.createdAt,
      })),
    });
  }

  // V1.38: tasa oficial del dólar (BCV)
  if (M === 'GET' && api('dolar')) {
    const d = await dolarBCV();
    if (!d.tasa) return sendJSON(res, 503, { error: 'La tasa del dólar no está disponible en este momento' });
    return sendJSON(res, 200, { tasa: d.tasa, fecha: d.fecha, fuente: d.fuente });
  }

  // V1.35: nombre de la zona para las coordenadas del GPS del teléfono
  if (M === 'GET' && api('geo', 'reverse')) {
    if (rateLimited(req, 'geo', 60)) return sendJSON(res, 429, { error: 'Demasiadas consultas de ubicación. Espera unos minutos.' });
    const lat = roundCoord(url.searchParams.get('lat'), -90, 90);
    const lng = roundCoord(url.searchParams.get('lng'), -180, 180);
    if (lat === null || lng === null) return sendJSON(res, 400, { error: 'Coordenadas inválidas' });
    try {
      return sendJSON(res, 200, { lat, lng, zone: await reverseGeocode(lat, lng) });
    } catch (e) {
      return sendJSON(res, 502, { error: 'No se pudo obtener el nombre de la zona: ' + e.message, lat, lng });
    }
  }

  // V1.35: miniaturas de las fotos publicadas antes de esta versión. El
  // teléfono del moderador las genera (el servidor no tiene con qué
  // achicar imágenes) y las sube aquí, una publicación a la vez.
  if (M === 'GET' && api('admin', 'listings-without-thumbs')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'Solo moderadores' });
    const list = await store.listings.withoutThumbs(30);
    return sendJSON(res, 200, { items: list.map((l) => ({ id: l.id, title: l.title, photoUrls: l.photoUrls || [] })) });
  }

  if (M === 'POST' && api('admin', 'listings', '*', 'thumbs')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'Solo moderadores' });
    const listing = await store.listings.get(parts[3]);
    if (!listing) return sendJSON(res, 404, { error: 'Publicación no encontrada' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const urls = listing.photoUrls || [];
    const thumbData = urls.map((u) => (body.thumbs && body.thumbs[u]) || null);
    const thumbs = await saveThumbs(urls, thumbData);
    // aunque alguna no se pueda generar, se marca para no volver a intentarlo siempre
    listing.photoThumbs = { ...(listing.photoThumbs || {}), ...thumbs };
    await store.listings.update(listing.id, listing);
    return sendJSON(res, 200, { ok: true, saved: Object.keys(thumbs).length });
  }

  // ------------------------------ Calificaciones ----------------------
  if (M === 'POST' && api('ratings')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para calificar' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const listing = body.listingId ? await store.listings.get(String(body.listingId)) : null;
    if (!listing) return sendJSON(res, 404, { error: 'Publicación no encontrada' });
    if (listing.status !== 'sold') return sendJSON(res, 400, { error: 'Solo se puede calificar una transacción de una publicación ya vendida' });
    if (!listing.soldTo) return sendJSON(res, 400, { error: 'Esta publicación no tiene un comprador registrado, no se puede calificar' });
    let toUserId;
    if (user.id === listing.sellerId) toUserId = listing.soldTo;
    else if (user.id === listing.soldTo) toUserId = listing.sellerId;
    else return sendJSON(res, 403, { error: 'Solo el comprador o el vendedor de esta transacción pueden calificarla' });
    const stars = Number(body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return sendJSON(res, 400, { error: 'La calificación debe ser un número entero de 1 a 5' });
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : '';
    if (await store.ratings.exists(listing.id, user.id)) return sendJSON(res, 400, { error: 'Ya calificaste esta transacción' });
    try {
      const rating = await store.ratings.insert({
        listingId: listing.id,
        listingTitle: listing.title,
        fromUserId: user.id,
        toUserId,
        stars,
        comment,
        createdAt: new Date().toISOString(),
      });
      return sendJSON(res, 201, rating);
    } catch (e) {
      if (e.code === 'DUPLICATE') return sendJSON(res, 400, { error: 'Ya calificaste esta transacción' });
      throw e;
    }
  }

  if (M === 'GET' && api('users', '*', 'ratings')) {
    const ratings = await store.ratings.forUser(parts[2]);
    const count = ratings.length;
    const average = count ? ratings.reduce((sum, r) => sum + r.stars, 0) / count : null;
    return sendJSON(res, 200, {
      userId: parts[2],
      count,
      average: average !== null ? Math.round(average * 10) / 10 : null,
      ratings: ratings.map((r) => ({ id: r.id, listingTitle: r.listingTitle, stars: r.stars, comment: r.comment, createdAt: r.createdAt })),
    });
  }

  // ------------------------------ Reportes ----------------------------
  if (M === 'POST' && api('reports')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión para enviar un reporte' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const VALID_TYPES = ['user', 'problem'];
    if (!VALID_TYPES.includes(body.type)) return sendJSON(res, 400, { error: 'Tipo de reporte inválido. Debe ser: ' + VALID_TYPES.join(', ') });
    let targetUserId = null;
    if (body.type === 'user') {
      if (!body.targetUserId) return sendJSON(res, 400, { error: 'Falta indicar a quién se está reportando' });
      if (!(await store.users.get(String(body.targetUserId)))) return sendJSON(res, 404, { error: 'El usuario reportado no existe' });
      if (body.targetUserId === user.id) return sendJSON(res, 400, { error: 'No puedes reportarte a ti mismo' });
      targetUserId = String(body.targetUserId);
    }
    let listingId = null;
    if (body.listingId) {
      if (!(await store.listings.get(String(body.listingId)))) return sendJSON(res, 404, { error: 'La publicación indicada no existe' });
      listingId = String(body.listingId);
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : '';
    if (!reason) return sendJSON(res, 400, { error: 'Debes indicar un motivo para el reporte' });
    const details = typeof body.details === 'string' ? body.details.trim().slice(0, 1000) : '';
    const report = await store.reports.insert({
      type: body.type,
      fromUserId: user.id,
      targetUserId,
      listingId,
      reason,
      details,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return sendJSON(res, 201, { id: report.id, status: report.status, createdAt: report.createdAt });
  }

  if (M === 'GET' && api('reports')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'No tienes permiso de moderador' });
    const reports = await store.reports.all();
    const ids = [...new Set(reports.flatMap((r) => [r.fromUserId, r.targetUserId]).filter(Boolean))];
    const emails = await store.users.emails(ids);
    return sendJSON(res, 200, reports.map((r) => ({
      ...r,
      fromUserEmail: emails[r.fromUserId] || null,
      targetUserEmail: r.targetUserId ? emails[r.targetUserId] || null : null,
    })));
  }

  if (M === 'PATCH' && api('reports', '*')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'No tienes permiso de moderador' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const VALID_STATUSES = ['open', 'reviewed', 'dismissed'];
    if (!VALID_STATUSES.includes(body.status)) return sendJSON(res, 400, { error: 'Estado inválido. Debe ser: ' + VALID_STATUSES.join(', ') });
    const report = await store.reports.get(parts[2]);
    if (!report) return sendJSON(res, 404, { error: 'Reporte no encontrado' });
    report.status = body.status;
    report.moderatorNote = typeof body.moderatorNote === 'string' ? body.moderatorNote.trim().slice(0, 500) : (report.moderatorNote || '');
    report.reviewedBy = user.id;
    report.reviewedAt = new Date().toISOString();
    return sendJSON(res, 200, await store.reports.update(report.id, report));
  }

  // ------------------------------ Números de emergencia ---------------
  if (M === 'GET' && api('emergency-numbers')) return sendJSON(res, 200, await store.emergency.all());

  if ((M === 'POST' && api('emergency-numbers')) || ((M === 'PATCH' || M === 'DELETE') && api('emergency-numbers', '*'))) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'No tienes permiso de administrador' });
    if (M === 'DELETE') {
      if (!(await store.emergency.remove(parts[2]))) return sendJSON(res, 404, { error: 'Número no encontrado' });
      return sendJSON(res, 200, { ok: true });
    }
    const body = await jsonBody(req, res);
    if (!body) return;
    if (M === 'POST') {
      const label = String(body.label || '').trim();
      const phone = String(body.phone || '').trim();
      if (!label || !phone) return sendJSON(res, 400, { error: 'La etiqueta y el número son obligatorios' });
      const created = await store.emergency.insert({ label: label.slice(0, 80), phone: phone.slice(0, 40), type: body.type === 'whatsapp' ? 'whatsapp' : 'call' });
      return sendJSON(res, 201, created);
    }
    const entry = await store.emergency.get(parts[2]);
    if (!entry) return sendJSON(res, 404, { error: 'Número no encontrado' });
    if (body.label !== undefined) entry.label = String(body.label).trim().slice(0, 80);
    if (body.phone !== undefined) entry.phone = String(body.phone).trim().slice(0, 40);
    if (body.type !== undefined) entry.type = body.type === 'whatsapp' ? 'whatsapp' : 'call';
    if (!entry.label || !entry.phone) return sendJSON(res, 400, { error: 'La etiqueta y el número son obligatorios' });
    return sendJSON(res, 200, await store.emergency.update(entry.id, entry));
  }

  // ------------------------------ Cuentas -----------------------------
  if (M === 'POST' && api('auth', 'register')) {
    if (rateLimited(req, 'auth-register')) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !EMAIL_RE.test(email) || email.length > 200) return sendJSON(res, 400, { error: 'Ingresa un email válido' });
    if (password.length < 8) return sendJSON(res, 400, { error: 'La contraseña debe tener al menos 8 caracteres' });
    const accountType = body.accountType === 'negocio' ? 'negocio' : 'persona';
    let businessName = null;
    let businessCategory = null;
    if (accountType === 'negocio') {
      businessName = String(body.businessName || '').trim().slice(0, 80);
      businessCategory = String(body.businessCategory || '').trim();
      if (!businessName) return sendJSON(res, 400, { error: 'Ingresa el nombre comercial de tu negocio' });
      if (!BUSINESS_CATEGORIES.includes(businessCategory)) return sendJSON(res, 400, { error: 'Elige una categoría de negocio válida' });
    }
    if (await store.users.byEmail(email)) return sendJSON(res, 409, { error: 'Ya existe una cuenta con ese email' });
    const salt = crypto.randomBytes(16).toString('hex');
    let newUser;
    try {
      newUser = await store.users.insert({
        email,
        salt,
        passwordHash: hashPassword(password, salt),
        accountType,
        businessName,
        businessCategory,
        createdAt: new Date().toISOString(),
        isAdmin: shouldBeAdmin(email, await store.users.count()),
      });
    } catch (e) {
      if (e.code === '23505') return sendJSON(res, 409, { error: 'Ya existe una cuenta con ese email' });
      throw e;
    }
    sendWelcomeEmails(req, newUser, 'password'); // V1.35
    return sendJSON(res, 201, { token: await createSession(newUser.id), user: publicUser(newUser), isNew: true, welcomeEmail: mailer.mailerKind() !== 'none' });
  }

  if (M === 'POST' && api('auth', 'login')) {
    if (rateLimited(req, 'auth-login')) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = await store.users.byEmail(email);
    if (!user) return sendJSON(res, 401, { error: 'Email o contraseña incorrectos' });
    if (!user.passwordHash) return sendJSON(res, 401, { error: 'Esta cuenta se creó con Google. Inicia sesión con el botón de Google.' });
    if (!samePassword(password, user)) return sendJSON(res, 401, { error: 'Email o contraseña incorrectos' });
    return sendJSON(res, 200, { token: await createSession(user.id), user: publicUser(user) });
  }

  if (M === 'POST' && api('auth', 'google')) {
    if (rateLimited(req, 'auth-google')) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const accessToken = String(body.accessToken || '');
    if (!accessToken) return sendJSON(res, 400, { error: 'Falta el token de Google' });
    let googlePayload;
    try {
      googlePayload = await verifyGoogleAccessToken(accessToken);
    } catch (e) {
      return sendJSON(res, 401, { error: 'No se pudo verificar el token de Google: ' + e.message });
    }
    if (!googlePayload.email || googlePayload.email_verified !== 'true') return sendJSON(res, 400, { error: 'Tu cuenta de Google no tiene el email verificado' });
    const email = String(googlePayload.email).trim().toLowerCase();
    let user = await store.users.byEmail(email);
    let isNew = false;
    if (!user) {
      isNew = true;
      user = await store.users.insert({
        email,
        salt: null,
        passwordHash: null,
        googleId: googlePayload.sub || null,
        createdAt: new Date().toISOString(),
        isAdmin: shouldBeAdmin(email, await store.users.count()),
      });
    } else if (!user.googleId && googlePayload.sub) {
      user.googleId = googlePayload.sub;
      await store.users.update(user.id, user);
    }
    if (isNew) sendWelcomeEmails(req, user, 'google'); // V1.35
    return sendJSON(res, 200, { token: await createSession(user.id), user: publicUser(user), isNew, welcomeEmail: isNew && mailer.mailerKind() !== 'none' });
  }

  if (M === 'POST' && api('auth', 'logout')) {
    const match = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
    if (match) await store.sessions.remove(match[1]);
    return sendJSON(res, 200, { ok: true });
  }

  if (M === 'POST' && api('auth', 'forgot-password')) {
    if (rateLimited(req, 'auth-forgot-password')) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
    const body = await jsonBody(req, res);
    if (!body) return;
    // Sin servicio de email: en producción no se genera ningún enlace
    // (devolverlo en la respuesta permitiría robar cuentas).
    if (IS_PROD) return sendJSON(res, 503, { error: 'La recuperación de contraseña por correo todavía no está activa. Escribinos a soporte para recuperar tu cuenta.' });
    const email = String(body.email || '').trim().toLowerCase();
    const user = await store.users.byEmail(email);
    const genericResponse = { ok: true, message: 'Si el email existe, se generó un enlace de recuperación.' };
    if (!user) return sendJSON(res, 200, genericResponse);
    const token = crypto.randomBytes(32).toString('hex');
    await store.resetTokens.create(token, user.id, Date.now() + RESET_TOKEN_TTL_MS);
    const resetLink = `http://localhost:8080/index.html?resetToken=${token}`;
    console.log(`[HAY backend] (modo desarrollo) enlace de recuperación para ${email}: ${resetLink}`);
    return sendJSON(res, 200, { ...genericResponse, devResetToken: token, devResetLink: resetLink });
  }

  if (M === 'POST' && api('auth', 'reset-password')) {
    const body = await jsonBody(req, res);
    if (!body) return;
    const token = String(body.token || '');
    const newPassword = String(body.newPassword || '');
    const entry = token ? await store.resetTokens.get(token) : null;
    if (!entry) return sendJSON(res, 400, { error: 'El enlace de recuperación es inválido o ya fue usado' });
    if (Date.now() > entry.expiresAt) {
      await store.resetTokens.remove(token);
      return sendJSON(res, 400, { error: 'El enlace de recuperación expiró. Pide uno nuevo.' });
    }
    if (newPassword.length < 8) return sendJSON(res, 400, { error: 'La contraseña debe tener al menos 8 caracteres' });
    const user = await store.users.get(entry.userId);
    if (!user) return sendJSON(res, 404, { error: 'Usuario no encontrado' });
    user.salt = crypto.randomBytes(16).toString('hex');
    user.passwordHash = hashPassword(newPassword, user.salt);
    await store.users.update(user.id, user);
    await store.resetTokens.remove(token);
    await store.sessions.removeByUser(user.id); // cierra sesiones abiertas con la clave vieja
    return sendJSON(res, 200, { ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión con la nueva.' });
  }

  // ------------------------------ Identidad ---------------------------
  if (M === 'POST' && api('me', 'identity')) {
    if (rateLimited(req, 'identity', 10)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const ced = decodeImageDataUrl(body.cedulaPhoto, { minBytes: 2000 });
    if (ced.error) return sendJSON(res, 400, { error: 'Foto de cédula: ' + ced.error });
    const sel = decodeImageDataUrl(body.selfiePhoto, { minBytes: 2000 });
    if (sel.error) return sendJSON(res, 400, { error: 'Selfie: ' + sel.error });
    const old = user.identity;
    user.identity = {
      status: 'submitted',
      check: null, // V1.38: la comparación de caras llega después (POST /api/me/identity/check)
      cedulaFile: await saveIdentityFile(user.id, 'cedula', ced.buf),
      selfieFile: await saveIdentityFile(user.id, 'selfie', sel.buf),
      submittedAt: new Date().toISOString(),
    };
    await store.users.update(user.id, user);
    if (old) for (const f of [old.cedulaFile, old.selfieFile]) if (f) await store.identity.remove(f);
    // V1.35: correo "verificación de seguridad completada"
    mailer.sendMail({ to: user.email, ...mailer.identityDoneEmail({ name: user.businessName, appUrl: appUrlFor(req) }) });
    return sendJSON(res, 200, { ok: true, user: publicUser(user), email: mailer.mailerKind() !== 'none' });
  }

  // V1.38: resultado de la comparación selfie ↔ cédula, calculado en el teléfono
  // después de enviar la verificación. No cambia el estado del usuario: solo
  // informa al moderador.
  if (M === 'POST' && api('me', 'identity', 'check')) {
    if (rateLimited(req, 'identity-check', 20)) return sendJSON(res, 429, { error: 'Demasiados intentos.' });
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.identity) return sendJSON(res, 400, { error: 'Primero envía la verificación' });
    const c = await jsonBody(req, res);
    if (!c) return;
    const distancia = typeof c.distancia === 'number' && Number.isFinite(c.distancia) ? Math.round(c.distancia * 1000) / 1000 : null;
    const coincide = Boolean(c.coincide) && distancia !== null;
    // Sin cara en alguna de las dos fotos = no se pudo comprobar: también se rechaza
    const sinCara = Boolean(c.sinCara);
    user.identity.check = { distancia, coincide, nota: c.nota ? String(c.nota).slice(0, 200) : null, at: new Date().toISOString() };
    // V1.38: decisión automática. Coincide → verificada. No coincide o sin cara → rechazada
    // (la persona la repite). Si el teléfono no pudo comparar, queda «enviada» y lo vuelve a intentar.
    if (coincide) user.identity.status = 'verified';
    else if (distancia !== null || sinCara) user.identity.status = 'rejected';
    await store.users.update(user.id, user);
    return sendJSON(res, 200, { ok: true, user: publicUser(user) });
  }

  // V1.33: foto de perfil (la cámara o la galería del teléfono, desde Editar perfil).
  // photoData = imagen en data URL; null la quita.
  if (M === 'POST' && api('me', 'avatar')) {
    if (rateLimited(req, 'avatar', 20)) return sendJSON(res, 429, { error: 'Demasiados cambios seguidos. Espera unos minutos y vuelve a probar.' });
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    const body = await jsonBody(req, res);
    if (!body) return;
    const old = user.avatarUrl || null;
    if (body.photoData === null) {
      user.avatarUrl = null;
    } else {
      const blockedAv = await moderatePhotos([body.photoData]);
      if (blockedAv) return sendJSON(res, 400, { error: blockedAv.replace('Una de las fotos', 'La foto') });
      const saved = await savePhotos([body.photoData]);
      if (saved.error) return sendJSON(res, 400, { error: saved.error.replace('Una de las fotos es', 'La foto es') });
      if (!saved.urls.length) return sendJSON(res, 400, { error: 'Falta la foto' });
      user.avatarUrl = saved.urls[0];
    }
    await store.users.update(user.id, user);
    removeLocalPhoto(old);
    return sendJSON(res, 200, { ok: true, user: publicUser(user) });
  }

  if (M === 'GET' && api('admin', 'identities')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'Solo moderadores' });
    const list = (await store.users.withIdentity())
      .map((u) => ({ userId: u.id, email: u.email, status: u.identity.status, submittedAt: u.identity.submittedAt, check: u.identity.check || null }))
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    return sendJSON(res, 200, { identities: list });
  }

  if (M === 'GET' && api('admin', 'identities', '*', '*') && (parts[4] === 'cedula' || parts[4] === 'selfie')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'Solo moderadores' });
    const target = await store.users.get(parts[3]);
    if (!target || !target.identity) return sendJSON(res, 404, { error: 'Sin verificación' });
    const name = parts[4] === 'cedula' ? target.identity.cedulaFile : target.identity.selfieFile;
    let buf = null;
    try {
      buf = decryptIdentity(name, await store.identity.get(name));
    } catch (e) {
      buf = null;
    }
    if (!buf) return sendJSON(res, 404, { error: 'No se pudo leer la foto' });
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    return res.end(buf);
  }

  // V1.30: eliminar la cuenta (requisito de Google Play). Borra la cuenta,
  // sus publicaciones y fotos, sus sesiones y sus fotos de identidad. Los
  // mensajes que ya recibieron otras personas quedan, pero a nombre de
  // "Usuario eliminado"; los reportes se conservan para moderación.
  if (M === 'DELETE' && api('me')) {
    if (rateLimited(req, 'delete-account', 10)) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Debes iniciar sesión' });
    const body = await jsonBody(req, res);
    if (!body) return;
    if (String(body.confirm || '').trim().toUpperCase() !== 'ELIMINAR') return sendJSON(res, 400, { error: 'Para confirmar escribe ELIMINAR' });
    if (user.passwordHash && !samePassword(String(body.password || ''), user)) return sendJSON(res, 401, { error: 'La contraseña no es correcta' });
    const listings = await store.listings.removeBySeller(user.id);
    if (photoStorage.kind === 'local') {
      for (const l of listings) for (const u of [...(l.photoUrls || []), ...Object.values(l.photoThumbs || {})]) {
        if (String(u).startsWith('/uploads/')) { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(u))); } catch (e) {} }
      }
    }
    if (user.identity) for (const f of [user.identity.cedulaFile, user.identity.selfieFile]) if (f) await store.identity.remove(f);
    removeLocalPhoto(user.avatarUrl);
    await store.sessions.removeByUser(user.id);
    await store.users.remove(user.id);
    console.log(`[HAY backend] Cuenta ${user.id} eliminada a pedido del usuario (${listings.length} publicaciones).`);
    return sendJSON(res, 200, { ok: true, deletedListings: listings.length });
  }

  if (M === 'GET' && api('me')) {
    const user = await currentUser(req);
    if (!user) return sendJSON(res, 401, { error: 'Sesión inválida o expirada' });
    return sendJSON(res, 200, { user: publicUser(user) });
  }

  return sendJSON(res, 404, { error: 'Ruta no encontrada: ' + M + ' ' + url.pathname });
}

// Un error inesperado nunca debe tumbar el servidor: se registra y se responde 500
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[HAY backend] Error en', req.method, req.url, '-', err && err.stack ? err.stack : err);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Error interno del servidor. Prueba de nuevo en un momento.' });
    else res.end();
  });
});
server.keepAliveTimeout = 65000; // por encima del balanceador del hosting
server.headersTimeout = 66000;

async function start() {
  await store.init();
  await store.sessions.purgeOlderThan(new Date(Date.now() - SESSION_TTL_MS).toISOString());
  server.listen(PORT, () => {
    console.log(`[HAY backend] v${APP_VERSION} · modo ${IS_PROD ? 'PRODUCCIÓN' : 'desarrollo'} · datos: ${store.kind === 'postgres' ? 'PostgreSQL' : 'archivos en ' + DATA_DIR} · fotos: ${photoStorage.kind}`);
    if (IS_PROD && store.kind !== 'postgres') console.warn('[HAY backend] AVISO: producción sin DATABASE_URL — usando archivos. Para muchos usuarios configura PostgreSQL.');
    if (IS_PROD && REQUIRE_IDENTITY && !IDENTITY_KEY) console.warn('[HAY backend] AVISO: sin IDENTITY_KEY las fotos de cédula se guardan sin cifrar.');
    if (mailer.mailerKind() === 'none') console.warn('[HAY backend] AVISO: sin servicio de correo (MAIL_FROM + RESEND_API_KEY, BREVO_API_KEY o SMTP_*): no se envían los correos de bienvenida ni de verificación.');
    if (IS_PROD && !ADMIN_EMAILS.length) console.warn('[HAY backend] AVISO: no hay ADMIN_EMAIL configurado; nadie podrá moderar reportes.');
    console.log(`[HAY backend] escuchando en http://localhost:${PORT}`);
  });
}

// Apagado ordenado (el hosting manda SIGTERM al redesplegar)
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[HAY backend] ${sig}: cerrando...`);
    server.close(async () => {
      try { await store.close(); } catch (e) {}
      process.exit(0);
    });
    // las conexiones inactivas (keep-alive) se cierran ya; las activas terminan su pedido
    if (server.closeIdleConnections) server.closeIdleConnections();
    setTimeout(() => process.exit(0), 8000).unref();
  });
}

start().catch((e) => {
  console.error('[HAY backend] No se pudo iniciar:', e && e.message ? e.message : e);
  process.exit(1);
});
