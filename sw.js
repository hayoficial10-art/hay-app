/* Service worker de HAY.
   V1.35 — más rápido:
   - La app (html, css, js, logos) se abre desde la copia guardada en el
     teléfono y se actualiza en segundo plano ("stale-while-revalidate").
     Antes esperaba siempre a la red, y con conexión lenta tardaba.
   - Las fotos de las publicaciones (/uploads/) se guardan en el teléfono:
     la segunda vez aparecen al instante. Máx. 300 fotos guardadas.
   - Al tocar una notificación de mensaje, abre la app en ese chat.
   Nunca guarda respuestas de la API (datos privados). */
const VERSION = '1.37';
const CACHE = 'hay-v' + VERSION;
const PHOTOS = 'hay-fotos-v1';
const MAX_PHOTOS = 300;
const SHELL = [
  'app.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/tema-fucsia.css', 'css/avisos.css', 'css/app-mode.css',
  'js/icons.js', 'js/api.js', 'js/avisos.js', 'js/moderacion.js', 'js/verificacion.js', 'js/partials.js', 'js/screens-onboarding.js', 'js/screens-main.js',
  'js/screens-publish.js', 'js/screens-transaction.js', 'js/screens-account.js', 'js/app.js',
  'assets/hay-logo.png', 'assets/icon-192.png', 'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' → baja la versión nueva del servidor, no la de la caché del navegador
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PHOTOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimPhotos() {
  const c = await caches.open(PHOTOS);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  // Fotos: primero la copia del teléfono (las fotos nunca cambian de contenido)
  if (url.pathname.startsWith('/uploads/')) {
    e.respondWith(
      caches.open(PHOTOS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          c.put(req, res.clone()).then(trimPhotos).catch(() => {});
        }
        return res;
      })
    );
    return;
  }

  // Modelos de revisión de fotos (pesados): los maneja la caché del navegador
  if (url.pathname.startsWith('/vendor/')) return;

  // Navegación a la app (/, /app.html): la copia guardada de app.html
  const isPage = req.mode === 'navigate';
  const key = isPage && (url.pathname === '/' || url.pathname === '/app.html') ? 'app.html' : req;

  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(key, { ignoreSearch: isPage });
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') c.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(network);
        return cached;
      }
      const res = await network;
      return res || (await c.match('app.html')) || Response.error();
    })
  );
});

// Tocar una notificación de mensaje → abrir (o enfocar) la app en ese chat
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const threadId = e.notification.data && e.notification.data.threadId;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list[0];
      if (client) {
        client.postMessage({ type: 'open-thread', threadId });
        return client.focus();
      }
      return self.clients.openWindow('app.html');
    })
  );
});
