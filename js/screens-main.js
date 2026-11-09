/* screens-main.js — Bloque 2: Navegación principal (pantallas 6-10) */

/* PRODUCTS empieza con estos 10 de muestra como RESPALDO — si el backend
   (backend/server.js) está corriendo, setProducts() los reemplaza por los
   datos reales al arrancar la app (ver app.js → init()). Si el backend no
   está disponible, el prototipo sigue funcionando con estos datos fijos. */
let PRODUCTS = [
  { id: 'p1', title: 'Bicicleta montaña rodado 26', price: 180, dist: '2.1 mi', art: 1, icon: 'ball', cond: 'Usado', category: 'Deportes y aire libre', sellerType: 'persona' },
  { id: 'p2', title: 'Silla de oficina ergonómica', price: 95, dist: '0.8 mi', art: 2, icon: 'sofa', cond: 'Como nuevo', category: 'Hogar y línea blanca', sellerType: 'persona' },
  { id: 'p3', title: 'iPhone 12 128GB', price: 340, dist: '1.4 mi', art: 3, icon: 'phone', cond: 'Usado', category: 'Electrónica', sellerType: 'persona' },
  { id: 'p4', title: 'Mesa de centro madera', price: 60, dist: '3.6 mi', art: 4, icon: 'sofa', cond: 'Usado', category: 'Hogar y línea blanca', sellerType: 'persona' },
  { id: 'p5', title: 'Chaqueta de cuero talla M', price: 45, dist: '1.1 mi', art: 1, icon: 'shirt', cond: 'Como nuevo', category: 'Ropa y accesorios', sellerType: 'persona' },
  { id: 'p6', title: 'Set de libros de cocina (x6)', price: 25, dist: '2.9 mi', art: 2, icon: 'book', cond: 'Usado', category: 'Libros, música y hobbies', sellerType: 'persona' },
  { id: 'p7', title: 'Balón de básquetbol Spalding', price: 15, dist: '0.5 mi', art: 3, icon: 'ball', cond: 'Usado', category: 'Deportes y aire libre', sellerType: 'persona' },
  { id: 'p8', title: 'Caja de herramientas completa', price: 70, dist: '4.2 mi', art: 4, icon: 'tools', cond: 'Usado', category: 'Herramientas y construcción', sellerType: 'persona' },
  { id: 'p9', title: 'Juguetes de bloques armables', price: 20, dist: '1.9 mi', art: 1, icon: 'toy', cond: 'Como nuevo', category: 'Niños y bebés', sellerType: 'persona' },
  { id: 'p10', title: 'Sofá 2 plazas gris', price: 220, dist: '2.4 mi', art: 2, icon: 'sofa', cond: 'Usado', category: 'Hogar y línea blanca', sellerType: 'persona' },
];

/* Convierte el formato de publicación del backend (campo "condition")
   al formato que ya esperaba productCard() en este archivo (campo "cond"),
   para no tener que tocar productCard() ni sus estilos. */
function mapListingFromApi(l) {
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    dist: l.dist || '0 mi',
    art: l.art || 1,
    icon: l.icon || 'tag',
    cond: l.condition,
    category: l.category || 'Otros',
    sellerType: l.sellerType || 'persona',
    sellerBusinessName: l.sellerBusinessName || null,
    zone: l.zone || '',
    photoUrls: l.photoUrls || [],
    photoThumbs: l.photoThumbs || null, // V1.35: miniaturas
    lat: l.lat ?? null, // V1.35: ubicación aproximada
    lng: l.lng ?? null,
  };
}

function setProducts(apiListings) {
  if (!Array.isArray(apiListings)) return;
  // V1.27: en la app real, un backend vacío significa "no hay
  // publicaciones todavía" — nunca se muestran los productos de muestra.
  if (apiListings.length === 0 && !HAY_APP_MODE) return;
  PRODUCTS = apiListings.map(mapListingFromApi);
}

/* V1.26: mismo contenido y mismos data-* de siempre (la navegación a
   Detalle y el corazón de favoritos no cambian), con el diseño de las
   referencias: foto, título, precio en grande y corazón a la derecha.
   opts.variant = 'row' → tarjeta horizontal (referencia "Tus favoritos"). */
function productCard(p, opts = {}) {
  // V1.32: el corazón refleja y guarda favoritos reales (ver partials.js)
  const favOn = opts.fav || isFav(p.id);
  const fav = favOn ? 'is-fav' : '';
  const isBusiness = p.sellerType === 'negocio';
  const favBtn = `<span class="product-card__fav ${fav}" role="button" tabindex="0" aria-pressed="${favOn}" aria-label="${favOn ? 'Quitar de favoritos' : 'Guardar en favoritos'}" data-fav-id="${p.id}" data-testid="btn-fav-${p.id}">${icon('heart')}</span>`;
  const businessChip = isBusiness ? `<span class="badge badge--cyan" style="align-self:flex-start;">${p.sellerBusinessName || 'Negocio'}</span>` : '';
  if (opts.variant === 'row') {
    return `
  <button class="product-card product-card--row" style="position:relative; text-align:left;" data-nav="product-detail" data-listing-id="${p.id}" data-testid="card-product-${p.id}">
    ${listingArt(p)}
    <div class="product-card__body">
      <p class="product-card__title">${p.title}</p>
      <span class="product-card__price" style="font-size:var(--text-lg);">$${p.price}</span>
      ${businessChip}
      <span class="badge badge--paused" style="align-self:flex-start;">${p.cond}</span>
      <span class="product-card__meta">${icon('pin')} ${placeLabel(p)}</span>
    </div>
    ${favBtn}
  </button>`;
  }
  // V1.32: precio como etiqueta girasol sobre la foto y corazón en un
  // círculo blanco arriba a la derecha (mismos data-* de siempre).
  return `
  <button class="product-card" style="position:relative; text-align:left;" data-nav="product-detail" data-listing-id="${p.id}" data-testid="card-product-${p.id}">
    ${listingArt(p, 'ph-art--wide', '', `<span class="ph-art__badge">${p.cond}</span><span class="ph-art__price product-card__price">$${p.price}</span>${favBtn}`)}
    <p class="product-card__title">${p.title}</p>
    ${HAY_APP_MODE && bsLabel(p.price) ? `<span class="price-bs" data-testid="price-bs">${bsLabel(p.price)}</span>` : ''}
    ${businessChip}
    <span class="product-card__meta">${icon('pin')} ${placeLabel(p)}</span>
  </button>`;
}

/* V1.27: zona real de la publicación (antes decía siempre "Miami, FL"). */
function placeLabel(p) {
  const zone = p.zone || (HAY_APP_MODE ? '' : 'Miami, FL');
  // V1.35: distancia real si el teléfono ya tiene tu ubicación (GPS) y la publicación la suya
  const dist = HAY_APP_MODE ? distanceLabel(p) : p.dist && p.dist !== '0 mi' ? p.dist : '';
  return [zone, dist].filter(Boolean).join(' · ') || 'Cerca de ti';
}

/* V1.35: aviso "Falta tu verificación de seguridad" (Inicio y Mi perfil) */
function identityBanner() {
  const rechazada = CURRENT_USER && CURRENT_USER.identityStatus === 'rejected';
  return `<button class="identity-banner" data-nav="verify-identity" data-testid="identity-pending-banner">
    <span class="identity-banner__icon">${icon('shield')}</span>
    <span class="identity-banner__text">${rechazada
      ? '<strong>Tu verificación no pasó</strong>La cara de la selfie no coincide con la de la cédula. Repítela para poder publicar.'
      : '<strong>Falta tu verificación de seguridad</strong>Foto de tu cédula y una selfie. La necesitas para publicar.'}</span>
    <span class="identity-banner__go">Verificar</span>
  </button>`;
}

/* V1.26: chips de categoría con ícono (referencia "Inicio"). */
function categoryChips() {
  return `
    <span class="chip chip--turquoise is-active" data-cat="Todos">${icon('boxOpen')} Todos</span>
    ${CATEGORY_ICONS.map((c) => `<span class="chip" data-cat="${c.label}">${icon(c.icon)} ${c.label}</span>`).join('')}`;
}

/* V1.23: lista única de categorías (sirve tanto para personas como para
   negocios — lo que distingue a un negocio de una persona es el tipo de
   cuenta del vendedor, no la categoría del producto). */
const CATEGORY_ICONS = [
  { label: 'Hogar y línea blanca', icon: 'sofa' },
  { label: 'Electrónica', icon: 'phone' },
  { label: 'Ropa y accesorios', icon: 'shirt' },
  { label: 'Belleza', icon: 'sparkle' },
  { label: 'Niños y bebés', icon: 'toy' },
  { label: 'Animales y mascotas', icon: 'paw' },
  { label: 'Vehículos', icon: 'car' },
  { label: 'Deportes y aire libre', icon: 'ball' },
  { label: 'Herramientas y construcción', icon: 'tools' },
  { label: 'Libros, música y hobbies', icon: 'book' },
  { label: 'Alimentos', icon: 'utensils' },
  { label: 'Salud', icon: 'cross' },
  { label: 'Agro y vivero', icon: 'leaf' },
  { label: 'Servicios', icon: 'briefcase' },
  { label: 'Servicios públicos', icon: 'bolt' },
  { label: 'Otros', icon: 'tag' },
];

/* V1.23: filtro Todos / Personas / Negocios, independiente de la
   categoría. Hasta que exista el tipo de cuenta Negocio (V1.24), todas
   las publicaciones son de tipo 'persona' — el filtro ya queda listo y
   funcionando para cuando existan cuentas de negocio. */
const SELLER_TYPE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'persona', label: 'Personas' },
  { value: 'negocio', label: 'Negocios' },
];

const SCREENS_MAIN = [
  {
    id: 'home',
    block: 'main',
    label: '6. Inicio (Feed)',
    html: () => `
    <div class="phone__screen screen--alegre">
      ${statusBar()}
      <div class="screen-body">
        <!-- V1.40: cabecera clara (diseño Stitch): logo al centro, ubicación y campana; buscador blanco con botón de filtros turquesa -->
        <header class="alegre-header home-header" data-testid="home-header">
          <div class="alegre-header__row">
            ${HAY_APP_MODE
              ? `<button class="home-location" title="Usar mi ubicación (GPS)" data-action="gps-home" data-testid="btn-home-gps">${icon('pin')}<span>${(getSavedLocation() && getSavedLocation().zone) || (getSavedLocation() ? 'Mi ubicación' : 'Ubicación')}</span></button>`
              : `<span class="home-location" title="Ubicación actual">${icon('pin')}<span>Miami, FL</span></span>`}
            ${hayLogo(38)}
            <button class="icon-btn icon-btn--white" data-nav="notifications" aria-label="Notificaciones" data-testid="btn-notifications" style="flex-shrink:0;">${icon('bell')}${unreadBadgeHtml()}</button>
          </div>
          <div class="alegre-search">
            <button class="searchbar searchbar--white" style="text-align:left" data-nav="search" data-testid="btn-open-search">
              ${icon('search')}
              <span class="text-faint">Buscar</span>
            </button>
          </div>
        </header>
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-home">
          ${HAY_APP_MODE && needsIdentity() ? identityBanner() : ''}
          <div class="chip-row chip-row--tiles" data-testid="home-categories">
            ${categoryChips()}
          </div>
          <!-- V1.43: Todos / Personas / Negocios, pequeños, al lado de «Cerca de ti» -->
          <div class="feed-head">
            <span class="section-label">Cerca de ti</span>
            <div class="pill-row pill-row--mini" data-testid="home-seller-type">
              ${SELLER_TYPE_FILTERS.map((s, i) => `<span class="pill ${i === 0 ? 'is-selected' : ''}" data-seller-type="${s.value}">${s.label}</span>`).join('')}
            </div>
          </div>
          <div class="product-grid" data-testid="home-product-grid">
            ${HAY_APP_MODE && !PRODUCTS.length ? `<p class="empty-msg" style="grid-column:1/-1;">Cargando publicaciones…</p>` : PRODUCTS.length ? PRODUCTS.slice(0, HAY_APP_MODE ? 60 : 8).map((p) => productCard(p)).join('') : `<div class="empty-state" style="grid-column:1/-1; padding:var(--space-6) 0;">${heroIcon('boxOpen', 'cyan', { size: 120 })}<p class="empty-msg" style="margin-top:0;">Todavía no hay publicaciones.<br/>¡Sé el primero en publicar con el botón +!</p></div>`}
          </div>
        </div>
      </div>
      ${tabBar('home', { labels: true })}
    </div>`,
  },

  {
    id: 'search',
    block: 'main',
    label: '7. Buscar',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-search">
          <div class="flex-row">
            <button class="icon-btn" data-nav="home" aria-label="Volver" data-testid="btn-back-search">${icon('back')}</button>
            <div class="searchbar grow">
              ${icon('search')}
              <input type="text" placeholder="¿Qué buscas?" value="${HAY_APP_MODE ? '' : 'silla'}" data-testid="input-search" />
            </div>
          </div>
          <div class="pill-row pill-row--mini" data-testid="search-seller-type">
            ${SELLER_TYPE_FILTERS.map((s, i) => `<span class="pill ${i === 0 ? 'is-selected' : ''}" data-seller-type="${s.value}">${s.label}</span>`).join('')}
          </div>
          <div class="chip-row chip-row--color" data-testid="search-categories" style="overflow-x:auto; flex-wrap:nowrap;">
            ${categoryChips()}
          </div>
          <span class="text-xs text-muted" data-testid="search-results-count">${PRODUCTS.length} resultados</span>
          <div class="product-grid" data-testid="search-results-grid">
            ${HAY_APP_MODE ? '<p class="empty-msg" style="grid-column:1/-1;">Cargando…</p>' : PRODUCTS.map((p) => productCard(p)).join('')}
          </div>
        </div>
      </div>

      ${tabBar('home')}
    </div>`,
  },

  {
    id: 'messages',
    block: 'main',
    label: '9. Mensajes',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="topbar" style="padding-top:var(--space-3);"><h1 class="topbar__title screen-title" style="font-size:var(--text-xl)">Mensajes</h1></div>
      <div class="screen-body" data-testid="screen-messages">
        ${!CURRENT_USER ? `
          <div class="empty-state">${heroIcon('chat', 'cyan', { size: 130 })}<p class="empty-msg" style="margin-top:0;">Inicia sesión para ver tus conversaciones.</p></div>
        ` : THREADS_LOADING ? `
          <p class="empty-msg">Cargando conversaciones...</p>
        ` : THREADS.length === 0 ? `
          <div class="empty-state">${heroIcon('chat', 'cyan', { size: 130 })}<p class="empty-msg" style="margin-top:0;">Todavía no tienes mensajes.</p></div>
        ` : `<div class="conversation-list">` + THREADS.map((t, i) => `
        <button class="conversation-row" style="width:100%; text-align:left;" data-thread-id="${t.threadId}" data-testid="conversation-${t.threadId}">
          <div class="avatar avatar--md avatar--${(i % 4) + 1}">${(t.otherUser.email || '?').charAt(0).toUpperCase()}</div>
          <div class="conversation-row__body">
            <div class="conversation-row__top">
              <span class="conversation-row__name">${t.otherUser.email || 'Usuario'}</span>
              <span class="conversation-row__time">${new Date(t.lastMessage.createdAt).toLocaleDateString()}</span>
            </div>
            <span class="conversation-row__msg">${t.listingTitle ? t.listingTitle + ': ' : ''}${t.lastMessage.text}</span>
          </div>
        </button>`).join('') + `</div>`}
      </div>
      ${tabBar('chat')}
    </div>`,
  },

  {
    id: 'profile',
    block: 'main',
    label: '10. Perfil',
    // V1.43: diseño Stitch — título claro, tarjeta del usuario, aviso de cuenta
    // verificada, botón amarillo para publicar, opciones en una sola tarjeta
    // y «Cerrar sesión» abajo. Solo datos reales (sin cifras inventadas).
    html: () => {
      const u = CURRENT_USER;
      const logged = Boolean(u) || !HAY_APP_MODE;
      const status = u ? u.identityStatus : 'none';
      const verified = status === 'verified';
      const name = u ? (u.businessName || u.email) : 'María Jiménez';
      const since = u && u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }) : '';
      const ratingHtml = HAY_APP_MODE && u ? (() => {
        const r = RATINGS_CACHE.get(u.id);
        return r && r.count
          ? `<span class="rating-pill" data-testid="profile-rating">${icon('star')} ${r.average.toFixed(1).replace('.', ',')} <small>(${r.count} calificaci${r.count === 1 ? 'ón' : 'ones'})</small></span>`
          : `<span class="rating-pill" data-testid="profile-rating"><small>Todavía sin calificaciones</small></span>`;
      })() : `<span class="rating-pill">${icon('star')} 4,0 <small>(32 ventas)</small></span>`;
      const idLabel = ({ verified: 'Identidad verificada', submitted: 'Verificación enviada', rejected: 'Verificación no pasó' })[status] || 'Identidad sin verificar';
      const idTone = verified ? 'ok' : status === 'rejected' ? 'bad' : 'wait';
      const row = (nav, testid, tone, ic, title, extra = '') => `
            <button class="option-row" data-nav="${nav}" data-testid="${testid}">
              <span class="list-row__icon tone-${tone}">${icon(ic)}</span>
              <div class="list-row__body"><p class="list-row__title">${title}</p></div>
              ${extra}${icon('chevronRight', 'list-row__chevron')}
            </button>`;
      return `
    <div class="phone__screen screen--alegre">
      ${statusBar()}
      <div class="screen-body">
        <header class="profile-head" data-testid="profile-header">
          <h1 class="screen-title">Mi perfil</h1>
        </header>
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-profile">
          ${!logged ? `
          <div class="profile-card profile-card--guest">
            ${heroIcon('user', 'cyan', { size: 120 })}
            <p class="profile-card__name" style="text-align:center;">Entra a tu cuenta</p>
                        <button class="btn btn--yellow" data-nav="login" data-testid="btn-profile-login">Iniciar sesión</button>
            <button class="btn btn--green" data-nav="register" data-testid="btn-profile-register">Crear cuenta</button>
          </div>` : `
          <div class="profile-card" data-testid="profile-card">
            <div class="profile-card__top">
              <div class="profile-card__avatar">${userAvatar('lg', 'fucsia', 'profile-avatar')}${verified ? `<span class="profile-card__check" aria-label="Identidad verificada">${icon('check')}</span>` : ''}</div>
              <div class="profile-card__who">
                <p class="profile-card__name">${name}</p>
                <span class="id-pill id-pill--${idTone}" data-testid="profile-id-status"><span class="id-pill__dot"></span>${idLabel}</span>
                ${ratingHtml}
              </div>
            </div>
            <div class="profile-card__facts">
              ${u && name !== u.email ? `<p>${icon('mail')}<span>${u.email}</span></p>` : ''}
              ${since ? `<p>${icon('star')}<span>Miembro desde ${since}</span></p>` : ''}
            </div>
            <button class="btn btn--turquoise btn--sm" data-nav="edit-profile" data-testid="btn-edit-profile-cta">${icon('edit')} Editar perfil</button>
          </div>
          <!-- V1.49: tres accesos iguales y centrados (tamaños y simetría de referencia) -->
          <div class="quick-tiles quick-tiles--2" data-testid="profile-quick-tiles">
            <button class="quick-tile quick-tile--cyan" data-nav="my-listings" data-testid="btn-go-my-listings"><span class="quick-tile__icon">${icon('boxOpen')}</span><span class="quick-tile__label">Mis publicaciones</span></button>
            <button class="quick-tile quick-tile--yellow" data-nav="notifications" data-testid="btn-go-notifications"><span class="quick-tile__icon">${icon('bell')}</span><span class="quick-tile__label">Notificaciones</span></button>
          </div>
          <div class="option-list option-list--card">
            ${u ? row('verify-identity', 'btn-go-verify-identity', 'green', 'shield', 'Verificación de identidad', `<span class="option-row__tag option-row__tag--${idTone}">${({ verified: 'Verificada', submitted: 'Enviada', rejected: 'Repetir' })[status] || 'Pendiente'}</span>`) : ''}
            ${row('settings', 'btn-go-settings', 'purple', 'help', 'Configuración')}
          </div>
          ${u ? `<button class="btn profile-logout" data-nav="login" data-testid="btn-logout">${icon('logout')} Cerrar sesión</button>` : ''}`}
          <div class="profile-foot">
            ${HAY_APP_MODE ? `<p class="app-version" data-testid="app-version-profile">HAY · versión ${HAY_VERSION}</p>` : ''}
          </div>
        </div>
      </div>
      ${tabBar('profile')}
    </div>`;
    },
  },
];
