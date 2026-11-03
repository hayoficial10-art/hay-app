/* V1.27 — service worker mínimo de HAY: permite instalar la app en
   Android y abrirla rápido. Estrategia "red primero": siempre intenta
   traer la versión nueva y usa la copia guardada solo si no hay
   conexión. Nunca guarda respuestas de la API (datos privados). */
const CACHE = 'hay-v1.34'; // V1.33: colores fucsia, cámara, foto de perfil y revisión de fotos
const SHELL = [
  'app.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/tema-fucsia.css', 'css/app-mode.css',
  'js/icons.js', 'js/api.js', 'js/moderacion.js', 'js/partials.js', 'js/screens-onboarding.js', 'js/screens-main.js',
  'js/screens-publish.js', 'js/screens-transaction.js', 'js/screens-account.js', 'js/app.js',
  'assets/hay-logo.png', 'assets/icon-192.png', 'assets/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && !url.pathname.startsWith('/uploads/')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('app.html')))
  );
});
