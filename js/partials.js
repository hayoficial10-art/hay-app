/* partials.js — genera HTML de componentes compartidos para garantizar consistencia
   entre TODAS las pantallas (status bar y tab bar inferior). */

function statusBar() {
  return `
  <div class="statusbar">
    <span>9:41</span>
    <div class="statusbar__icons">
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><rect x="0" y="6" width="3" height="5" rx="0.5" fill="currentColor"/><rect x="4.5" y="4" width="3" height="7" rx="0.5" fill="currentColor"/><rect x="9" y="2" width="3" height="9" rx="0.5" fill="currentColor"/><rect x="13.5" y="0" width="2.5" height="11" rx="0.5" fill="currentColor" opacity="0.35"/></svg>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M8 2.5c2.3 0 4.4.9 6 2.5l-1.4 1.4A6.8 6.8 0 0 0 8 4.5a6.8 6.8 0 0 0-4.6 1.9L2 5c1.6-1.6 3.7-2.5 6-2.5z" fill="currentColor"/><circle cx="8" cy="9" r="1.3" fill="currentColor"/></svg>
      <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor"/><rect x="2" y="2" width="14" height="7" rx="1.2" fill="currentColor"/><rect x="19.5" y="3.5" width="2" height="4" rx="1" fill="currentColor"/></svg>
    </div>
  </div>`;
}

/* V1.32: logotipo plano de HAY (H, A, Y en bloques de color sólido).
   size = alto de cada bloque en px. opts.lift sube la "A" un poquito
   (versión de bienvenida); opts.onBlue pone la "Y" en blanco para que
   se lea sobre el fondo azul. */
/* V1.40: el logo es la imagen oficial 3D (letras H, A, y con el lema
   debajo), con fondo transparente. size = alto aproximado de las letras;
   la imagen mide 1,7 veces eso porque incluye el lema. Las opciones
   lift/onBlue/onYellow ya no cambian nada (se aceptan por compatibilidad). */
function hayLogo(size = 30, opts = {}) {
  const h = Math.round(size * 1.7);
  return `<img class="hay-logo-img" src="assets/hay-logo-v2.png" alt="HAY — Lo tienes, publícalo, véndelo." style="height:${h}px" decoding="async"${opts.testid ? ` data-testid="${opts.testid}"` : ''} />`;
}

/* V1.33: avatar del usuario — su foto de perfil si la tiene, si no sus iniciales. */
function userAvatar(size = 'lg', tone = 2, testid = '') {
  const u = typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : null;
  const t = testid ? ` data-testid="${testid}"` : '';
  if (u && u.avatarUrl) return `<div class="avatar avatar--${size} avatar--photo"${t}><img src="${u.avatarUrl}" alt="Tu foto de perfil" /></div>`;
  return `<div class="avatar avatar--${size} avatar--${tone}"${t}>${u ? u.email.slice(0, 2).toUpperCase() : 'MJ'}</div>`;
}

/* activeTab: 'home' | 'search' | 'publish' | 'chat' | 'profile'
   V1.32: las etiquetas se ven siempre, en todas las pantallas (opts.labels
   se mantiene por compatibilidad, ya no cambia nada). */
function tabBar(activeTab, opts = {}) {
  const item = (key, iconName, label) => `
    <button class="tabbar__item ${activeTab === key ? 'is-active' : ''}" data-nav="${TAB_TARGETS[key]}" aria-label="${label}" data-testid="tab-${key}">
      ${icon(iconName)}
      <span>${label}</span>
    </button>`;

  // V1.40: Favoritos ocupa el lugar de Buscar (el buscador está arriba en Inicio)
  return `
  <nav class="tabbar tabbar--labels tabbar--color" aria-label="Navegación principal">
    ${item('home', 'home', 'Inicio')}
    ${item('favorites', 'heart', 'Favoritos')}
    <button class="tabbar__item tabbar__item--fab" data-nav="publish-step1" aria-label="Publicar" data-testid="tab-publish">
      <span class="tabbar__fab-circle">${icon('plus')}</span>
      <span>Publicar</span>
    </button>
    ${item('chat', 'chat', 'Mensajes').replace('</button>', `${unreadBadgeHtml()}</button>`)}
    ${item('profile', 'user', 'Perfil')}
  </nav>`;
}

const TAB_TARGETS = {
  home: 'home',
  search: 'search',
  favorites: 'favorites',
  chat: 'messages',
  profile: 'profile',
};

/* Topbar reutilizable para pantallas internas */
function topBar({ back, title, right, testid, stacked }) {
  return `
  <header class="topbar ${stacked ? 'topbar--stacked' : ''}">
    ${back ? `<button class="icon-btn" data-nav="${back}" aria-label="Volver" data-testid="btn-back-${testid||''}">${icon('back')}</button>` : ''}
    <h1 class="topbar__title">${title}</h1>
    ${right || '<span style="width:40px"></span>'}
  </header>`;
}

function stars(filled) {
  let out = '<span class="stars">';
  for (let i = 0; i < 5; i++) {
    out += `<span class="${i < filled ? '' : 'is-empty'}">${icon('star')}</span>`;
  }
  out += '</span>';
  return out;
}

function stepperDots(current, total) {
  let out = '<div class="stepper">';
  for (let i = 1; i <= total; i++) {
    const cls = i < current ? 'is-done' : i === current ? 'is-current' : '';
    out += `<div class="stepper__dot ${cls}"></div>`;
  }
  out += '</div>';
  return out;
}

/* ---------------------------------------------------------------
   V1.26 — piezas visuales nuevas de las referencias
   --------------------------------------------------------------- */

/* Ícono grande en círculo de color con "rayitos" alrededor (el recurso
   visual que usan casi todas las referencias: Código, Verificación,
   Publicado, Oferta, Confirmado, Reportar...).
   tone: 'cyan' | 'green' | 'yellow' | 'pink' */
function heroIcon(iconName, tone = 'cyan', opts = {}) {
  const size = opts.size || 150;
  const angles = [0, 32, 148, 180, 212, 328, 115, 65];
  const rays = angles
    .map((a, i) => {
      const r = (a * Math.PI) / 180;
      const r1 = i % 2 ? 41 : 40;
      const r2 = i % 2 ? 46 : 48;
      const x1 = 50 + r1 * Math.cos(r), y1 = 50 - r1 * Math.sin(r);
      const x2 = 50 + r2 * Math.cos(r), y2 = 50 - r2 * Math.sin(r);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
    })
    .join('');
  const circleInner = opts.text
    ? `<span style="font-size:${Math.round(size * 0.26)}px; font-weight:900; line-height:1;">${opts.text}</span>`
    : icon(iconName);
  return `
  <div class="hero hero--${tone} ${opts.halo ? 'hero--halo' : ''}" style="width:${size}px;height:${size}px;" ${opts.testid ? `data-testid="${opts.testid}"` : ''}>
    ${opts.halo ? '' : `<svg class="hero__rays" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">${rays}</svg>`}
    <div class="hero__circle">${circleInner}</div>
    ${opts.badge ? `<span class="hero__badge">${icon(opts.badge)}</span>` : ''}
  </div>`;
}

/* Color del borde del marco de teléfono de cada pantalla, siguiendo
   las referencias: cian = inicio y registro, verde = explorar,
   amarillo = publicar, rosa = transacción, violeta = cuenta. */
const FRAME_COLORS = {
  cyan: 'var(--hay-turquoise)',
  green: 'var(--hay-green)',
  yellow: 'var(--hay-yellow)',
  pink: 'var(--hay-pink)',
  purple: 'var(--hay-purple)',
};
const SCREEN_FRAME = {
  splash: 'cyan', 'onboarding-slides': 'cyan', register: 'cyan', login: 'cyan', 'forgot-password': 'cyan', 'forgot-password-sent': 'cyan',
  home: 'green', search: 'green', favorites: 'green', messages: 'pink', profile: 'purple',
  'publish-step1': 'yellow', 'publish-step2': 'yellow', 'publish-step3': 'yellow', 'publish-step4': 'yellow', 'publish-step5': 'yellow', 'publish-success': 'yellow', 'exit-publish-confirm': 'yellow',
  'product-detail': 'pink', 'make-offer': 'pink', 'offer-sent': 'pink', 'seller-profile': 'pink', 'chat-detail': 'pink', 'confirm-sale': 'pink', 'rate-transaction': 'pink', report: 'pink', 'report-sent': 'pink',
  'my-listings': 'purple', notifications: 'purple', 'edit-profile': 'purple', settings: 'purple', safety: 'purple', 'safety-admin': 'purple', 'moderation-panel': 'purple', 'verify-identity': 'cyan', 'delete-account': 'purple', 'register-success': 'cyan', 'identity-success': 'cyan',
};
function frameColorFor(screenId) {
  return FRAME_COLORS[SCREEN_FRAME[screenId] || 'cyan'];
}

/* V1.27: imagen de una publicación — la foto real si la tiene, o el
   dibujo de color de siempre (publicaciones de muestra / sin foto).
   cls: clases extra del contenedor (ej. 'ph-art--wide'); inner: HTML
   extra dentro (ej. la etiqueta de condición). */
function listingArt(p, cls = '', style = '', inner = '', opts = {}) {
  const url = p && p.photoUrls && p.photoUrls[0];
  if (url) {
    // V1.35: las tarjetas usan la miniatura (~40 KB) en vez de la foto grande (hasta 1,3 MB)
    const thumb = !opts.full && p.photoThumbs && p.photoThumbs[url];
    const eager = opts.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    return `<div class="ph-art ph-art--photo ${cls}" style="${style}"><img src="${photoSrc(thumb || url)}" alt="${String(p.title || 'Foto del producto').replace(/"/g, '&quot;')}" ${eager} decoding="async" />${inner}</div>`;
  }
  return `<div class="ph-art ph-art--${(p && p.art) || 1} ${cls}" style="${style}">${icon((p && p.icon) || 'tag')}${inner}</div>`;
}

/* ---------------------------------------------------------------
   V1.32 — Favoritos reales, guardados en el teléfono (localStorage).
   No hace falta cuenta ni servidor: cada teléfono recuerda sus
   favoritos. Se guarda una copia pequeña de cada publicación para poder
   mostrar la lista aunque la publicación ya no esté cargada en memoria.
   --------------------------------------------------------------- */
const FAVS_KEY = 'hay_favs';
const MAX_FAVS = 200;
function loadFavs() {
  try {
    const v = JSON.parse(localStorage.getItem(FAVS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}
function saveFavs(list) {
  try { localStorage.setItem(FAVS_KEY, JSON.stringify(list.slice(0, MAX_FAVS))); } catch (e) {}
}
function isFav(id) {
  return Boolean(id) && loadFavs().some((f) => f.id === id);
}
/* Copia mínima de la publicación (mismo formato que usa productCard) */
function favSnapshot(id) {
  let p = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find((x) => x.id === id);
  if (!p && typeof findListingById === 'function') {
    const l = findListingById(id);
    if (l) p = mapListingFromApi(l);
  }
  if (!p) return null;
  return {
    id: p.id, title: p.title, price: p.price, cond: p.cond, zone: p.zone || '', dist: p.dist || '',
    art: p.art || 1, icon: p.icon || 'tag', photoUrls: (p.photoUrls || []).slice(0, 1),
    sellerType: p.sellerType || 'persona', sellerBusinessName: p.sellerBusinessName || null,
  };
}
/* Agrega o quita; devuelve true si quedó guardado */
function toggleFav(id) {
  const list = loadFavs();
  const i = list.findIndex((f) => f.id === id);
  if (i >= 0) {
    list.splice(i, 1);
    saveFavs(list);
    return false;
  }
  const snap = favSnapshot(id);
  if (!snap) return false;
  list.unshift(snap);
  saveFavs(list);
  return true;
}
/* Conecta los corazones de un contenedor (tarjetas y botón del detalle) */
function wireFavButtons(root) {
  root.querySelectorAll('[data-fav-id]:not([data-fav-wired])').forEach((btn) => {
    btn.setAttribute('data-fav-wired', '1');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = btn.getAttribute('data-fav-id');
      const on = toggleFav(id);
      root.querySelectorAll(`[data-fav-id="${id}"]`).forEach((b) => {
        b.classList.toggle('is-fav', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', on ? 'Quitar de favoritos' : 'Guardar en favoritos');
      });
      // en la lista de favoritos, quitar uno lo saca de la lista
      if (!on && root.dataset.currentScreen === 'favorites') {
        const card = btn.closest('.product-card');
        if (card) card.remove();
        const left = root.querySelectorAll('[data-testid="favorites-list"] .product-card').length;
        const countEl = root.querySelector('[data-testid="favorites-count"]');
        if (countEl) countEl.textContent = left === 1 ? '1 producto guardado' : `${left} productos guardados`;
        if (!left && typeof navigateTo === 'function') navigateTo(root, 'favorites', { skipFetch: true });
      }
    });
  });
}
