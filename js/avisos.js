/* avisos.js — V1.35
 *   1. Avisos de mensajes nuevos: la app pregunta al servidor cada 10 s
 *      (GET /api/me/inbox). Si llegó algo: suena, vibra, muestra un aviso
 *      arriba (o una notificación del teléfono si la app está en segundo
 *      plano), suma el número rojo en Mensajes y en la campana, y lo
 *      guarda en la pantalla Notificaciones.
 *   2. Silenciar: en Configuración → «Silenciar mensajes» (sin sonido ni
 *      vibración) y «Silenciar notificaciones» (sin avisos en pantalla ni
 *      del teléfono). Se guarda en este teléfono.
 *   3. GPS y mapa: ubicación del teléfono, nombre de la zona, distancia y
 *      mapa de OpenStreetMap (sin claves ni librerías).
 *   4. Miniaturas de fotos para que las tarjetas del feed carguen rápido.
 */

/* ---------------- Preferencias (este teléfono) ---------------- */
const PREFS_KEY = 'hay_prefs';
function getPrefs() {
  try {
    return { muteMessages: false, muteNotifications: false, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
  } catch (e) {
    return { muteMessages: false, muteNotifications: false };
  }
}
function setPref(key, value) {
  const p = getPrefs();
  p[key] = value;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
}

/* ---------------- Sonido ----------------
   Se genera con el propio teléfono (Web Audio): no hay archivo que
   descargar. Android solo deja sonar después del primer toque en la app,
   por eso el sonido se "desbloquea" con el primer toque. */
let AUDIO_CTX = null;
function unlockAudio() {
  try {
    if (!AUDIO_CTX) AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)();
    if (AUDIO_CTX.state === 'suspended') AUDIO_CTX.resume();
  } catch (e) {}
}
['pointerdown', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockAudio, { passive: true }));

function playMessageSound() {
  if (getPrefs().muteMessages) return;
  try {
    unlockAudio();
    const ctx = AUDIO_CTX;
    if (ctx && ctx.state === 'running') {
      const t = ctx.currentTime;
      [[880, 0], [1320, 0.16]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.35, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.3);
      });
    }
  } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) {}
}

/* ---------------- Notificaciones guardadas ---------------- */
const MAX_NOTIFS = 50;
function notifsKey() { return CURRENT_USER ? 'hay_notifs_' + CURRENT_USER.id : null; }
function sinceKey() { return CURRENT_USER ? 'hay_inbox_since_' + CURRENT_USER.id : null; }
function loadNotifs() {
  const k = notifsKey();
  if (!k) return [];
  try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; }
}
function saveNotifs(list) {
  const k = notifsKey();
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(list.slice(0, MAX_NOTIFS))); } catch (e) {}
}
function unreadCount() {
  return loadNotifs().filter((n) => !n.read).length;
}
function markNotifsRead(threadId) {
  const list = loadNotifs();
  let changed = false;
  for (const n of list) if (!n.read && (!threadId || n.threadId === threadId)) { n.read = true; changed = true; }
  if (changed) { saveNotifs(list); updateUnreadBadges(); }
}

// Número rojo en la pestaña Mensajes y en la campana de Inicio
function unreadBadgeHtml() {
  const n = HAY_APP_MODE ? unreadCount() : 0;
  return n ? `<span class="unread-badge" data-unread-badge>${n > 9 ? '9+' : n}</span>` : '';
}
function updateUnreadBadges() {
  const html = unreadBadgeHtml();
  document.querySelectorAll('[data-testid="tab-chat"], [data-testid="btn-notifications"]').forEach((el) => {
    el.querySelectorAll('[data-unread-badge]').forEach((b) => b.remove());
    if (html) el.insertAdjacentHTML('beforeend', html);
  });
}

/* ---------------- Aviso en pantalla ---------------- */
function notifTitle(n) {
  const who = n.fromEmail ? n.fromEmail.split('@')[0] : 'Alguien';
  return n.type === 'offer' ? `Nueva oferta de ${who}` : `Mensaje nuevo de ${who}`;
}
function notifBody(n) {
  const about = n.listingTitle ? ` · ${n.listingTitle}` : '';
  return (n.type === 'offer' && n.amount ? `$${n.amount} — ` : '') + n.text + about;
}
function escapeText(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function showToast(n) {
  document.querySelectorAll('.hay-toast').forEach((t) => t.remove());
  const el = document.createElement('button');
  el.className = 'hay-toast';
  el.setAttribute('data-testid', 'message-toast');
  el.innerHTML = `<span class="hay-toast__icon">${icon(n.type === 'offer' ? 'gift' : 'chat')}</span><span class="hay-toast__body"><strong>${escapeText(notifTitle(n))}</strong><span>${escapeText(notifBody(n))}</span></span>`;
  el.addEventListener('click', () => { el.remove(); openChatFromNotif(n); });
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 5200);
  setTimeout(() => el.remove(), 5600);
}

// Notificación del teléfono (cuando la app está en segundo plano)
async function showSystemNotification(n) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opts = { body: notifBody(n), icon: 'assets/icono-hay-192.png', badge: 'assets/icono-hay-192.png', tag: 'hay-' + n.threadId, renotify: true, data: { threadId: n.threadId } };
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) await reg.showNotification(notifTitle(n), opts);
    else new Notification(notifTitle(n), opts);
    return true;
  } catch (e) {
    return false;
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
}

function openChatFromNotif(n) {
  const phoneEl = document.getElementById('phone-app');
  if (!phoneEl || !CURRENT_USER) return;
  CURRENT_CHAT = {
    threadId: n.threadId,
    listingId: n.listingId,
    listingTitle: n.listingTitle,
    otherUserId: n.fromUserId,
    otherUserEmail: n.fromEmail,
  };
  CHAT_MESSAGES = [];
  markNotifsRead(n.threadId);
  navigateTo(phoneEl, 'chat-detail');
}

/* ---------------- Consulta periódica de mensajes nuevos ---------------- */
let INBOX_TIMER = null;
let INBOX_BUSY = false;
const INBOX_EVERY_MS = 10000;

function stopInboxPoll() {
  clearInterval(INBOX_TIMER);
  INBOX_TIMER = null;
}
function startInboxPoll() {
  if (!HAY_APP_MODE || !CURRENT_USER) return;
  stopInboxPoll();
  checkInbox();
  INBOX_TIMER = setInterval(checkInbox, INBOX_EVERY_MS);
  updateUnreadBadges();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && INBOX_TIMER) checkInbox(); });

async function checkInbox() {
  if (INBOX_BUSY || !CURRENT_USER) return;
  INBOX_BUSY = true;
  try {
    const key = sinceKey();
    let since = null;
    try { since = localStorage.getItem(key); } catch (e) {}
    const data = await apiFetchInbox(since);
    if (!data || !CURRENT_USER || sinceKey() !== key) return;
    try { localStorage.setItem(key, data.now); } catch (e) {}
    const items = (data.items || []).slice().reverse(); // del más viejo al más nuevo
    if (!since || !items.length) return; // primera vez en este teléfono: no se avisa lo viejo
    const phoneEl = document.getElementById('phone-app');
    const screen = phoneEl && phoneEl.dataset.currentScreen;
    const list = loadNotifs();
    const known = new Set(list.map((n) => n.id));
    const fresh = items.filter((m) => !known.has(m.id));
    if (!fresh.length) return;
    for (const m of fresh) {
      const viewing = screen === 'chat-detail' && CURRENT_CHAT && CURRENT_CHAT.threadId === m.threadId && !document.hidden;
      list.unshift({ ...m, read: viewing });
    }
    saveNotifs(list);
    updateUnreadBadges();
    playMessageSound();
    const last = fresh[fresh.length - 1];
    const prefs = getPrefs();
    if (!prefs.muteNotifications) {
      const viewingLast = screen === 'chat-detail' && CURRENT_CHAT && CURRENT_CHAT.threadId === last.threadId;
      if (document.hidden) showSystemNotification(last);
      else if (!viewingLast) showToast(last);
    }
    // repintar las listas abiertas
    if (phoneEl && !document.hidden) {
      if (screen === 'messages') navigateTo(phoneEl, 'messages');
      else if (screen === 'notifications') navigateTo(phoneEl, 'notifications', { skipFetch: true });
    }
  } finally {
    INBOX_BUSY = false;
  }
}

// Al tocar una notificación del teléfono, el service worker abre el chat
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.type !== 'open-thread') return;
    const n = loadNotifs().find((x) => x.threadId === ev.data.threadId);
    if (n) openChatFromNotif(n);
  });
}

/* ---------------- GPS y mapa ---------------- */
const LOC_KEY = 'hay_loc';
function getSavedLocation() {
  try {
    const l = JSON.parse(localStorage.getItem(LOC_KEY));
    return l && typeof l.lat === 'number' ? l : null;
  } catch (e) {
    return null;
  }
}
function saveLocation(loc) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch (e) {}
}

// Pide la ubicación al teléfono. Devuelve { lat, lng, zone } o lanza un error con el motivo en palabras.
function getGpsLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este teléfono o navegador no permite usar la ubicación.'));
    if (!window.isSecureContext) return reject(new Error('La ubicación solo funciona con la app abierta en https.'));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lng = Math.round(pos.coords.longitude * 100) / 100;
        const geo = await apiReverseGeo(lat, lng);
        const loc = { lat, lng, zone: geo.ok ? geo.zone : '', at: Date.now() };
        saveLocation(loc);
        resolve(loc);
      },
      (err) => {
        const msg = err.code === 1
          ? 'No diste permiso de ubicación. Actívalo en Ajustes del teléfono → Aplicaciones → HAY (o Chrome) → Permisos → Ubicación, y vuelve a tocar.'
          : err.code === 2
          ? 'No se pudo obtener la ubicación. Revisa que el GPS (Ubicación) del teléfono esté encendido.'
          : 'El GPS tardó demasiado. Sal a un lugar abierto o revisa que la Ubicación esté encendida, y vuelve a tocar.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

function distanceKm(a, b) {
  if (!a || !b || typeof a.lat !== 'number' || typeof b.lat !== 'number') return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distanceLabel(p) {
  const me = getSavedLocation();
  if (!me || p.lat === null || p.lat === undefined) return '';
  const km = distanceKm(me, { lat: p.lat, lng: p.lng });
  if (km === null) return '';
  return km < 1 ? 'a menos de 1 km' : `a ${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

// Mapa de OpenStreetMap (iframe, sin claves). Ubicación aproximada.
function osmMap(lat, lng, testid = 'osm-map') {
  const d = 0.012;
  const bbox = [lng - d, lat - d, lng + d, lat + d].map((v) => v.toFixed(4)).join(',');
  return `<div class="osm-map" data-testid="${testid}">
    <iframe title="Mapa de la ubicación aproximada" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
      src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(4)},${lng.toFixed(4)}"></iframe>
    <a class="osm-map__credit" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}" target="_blank" rel="noopener">Abrir mapa · © OpenStreetMap</a>
  </div>`;
}

/* ---------------- Miniaturas ---------------- */
// Reduce una foto (data URL o URL) a ~480 px para las tarjetas del feed (~30-60 KB).
function makeThumb(src, maxSide = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('no se pudo leer la foto'));
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = src;
  });
}

// Moderador: genera las miniaturas de las publicaciones antiguas (antes de v1.35)
async function backfillThumbs(onProgress) {
  let done = 0;
  for (let round = 0; round < 50; round++) {
    const items = await apiFetchListingsWithoutThumbs();
    if (!items) throw new Error('no se pudo consultar el servidor');
    if (!items.length) return done;
    for (const l of items) {
      const thumbs = {};
      for (const u of l.photoUrls) {
        try { thumbs[u] = await makeThumb(photoSrc(u)); } catch (e) {}
      }
      await apiUploadThumbs(l.id, thumbs);
      done += 1;
      if (onProgress) onProgress(done);
    }
  }
  return done;
}
