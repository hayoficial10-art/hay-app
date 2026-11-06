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
              <span class="text-faint">Buscar productos, marcas y más…</span>
            </button>
            <button class="alegre-search__filter" data-nav="search" aria-label="Filtros de búsqueda" data-testid="btn-open-filters">${icon('filter')}</button>
          </div>
        </header>
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-home">
          ${HAY_APP_MODE && needsIdentity() ? identityBanner() : ''}
          <button class="promo-block promo-block--alegre" data-nav="publish-step1" data-testid="btn-home-publish" style="text-align:left;">
            <span class="promo-block__body">
              <span class="promo-block__badge">100% GRATIS</span>
              <span class="promo-block__title">¡Publica gratis y vende hoy mismo!</span>
              <span class="promo-block__text">Conecta directo con compradores en tu zona. Sin comisiones.</span>
              <span class="promo-block__btn">Empieza a vender ${icon('chevronRight')}</span>
            </span>
            <span class="promo-block__art" aria-hidden="true">${icon('tag')}</span>
          </button>
          <div class="benefits-row" data-testid="home-benefits">
            <span class="benefit benefit--cyan"><span class="benefit__icon">${icon('chat')}</span>Trato directo</span>
            <span class="benefit benefit--green"><span class="benefit__icon">${icon('check')}</span>0% comisión</span>
            <span class="benefit benefit--yellow"><span class="benefit__icon">${icon('pin')}</span>Cerca de ti</span>
            <span class="benefit benefit--coral"><span class="benefit__icon">${icon('bolt')}</span>Venta rápida</span>
          </div>
          <div class="flex-between">
            <span class="section-label">Explorar categorías</span>
          </div>
          <div class="chip-row chip-row--tiles" data-testid="home-categories">
            ${categoryChips()}
          </div>
          <div class="pill-row pill-row--color" data-testid="home-seller-type">
            ${SELLER_TYPE_FILTERS.map((s, i) => `<span class="pill ${i === 0 ? 'is-selected' : ''}" data-seller-type="${s.value}">${s.label}</span>`).join('')}
          </div>
          <div class="flex-between">
            <span class="section-label">Cerca de ti</span>
            <button class="text-xs link-cyan" data-nav="search" data-testid="btn-see-all">Ver todo ${icon('chevronRight')}</button>
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
          <h1 class="screen-title">Buscar</h1>
          <div class="flex-row">
            <div class="searchbar grow">
              ${icon('search')}
              <input type="text" placeholder="Ej. bicicleta, iPhone, sofá..." value="${HAY_APP_MODE ? '' : 'silla'}" data-testid="input-search" />
            </div>
            <button class="icon-btn" id="openFiltersBtn" aria-label="Filtros" data-testid="btn-open-filters">${icon('filter')}</button>
          </div>
          <div class="pill-row pill-row--color" data-testid="search-seller-type">
            ${SELLER_TYPE_FILTERS.map((s, i) => `<span class="pill ${i === 0 ? 'is-selected' : ''}" data-seller-type="${s.value}">${s.label}</span>`).join('')}
          </div>
          <div class="chip-row chip-row--color" data-testid="search-categories" style="overflow-x:auto; flex-wrap:nowrap;">
            ${categoryChips()}
          </div>
          <div class="flex-between">
            <span class="text-xs text-muted" data-testid="search-results-count">${PRODUCTS.length} resultados</span>
            <span class="text-xs fw-800 link-cyan">Ordenar: Relevancia ▾</span>
          </div>
          <div class="product-grid" data-testid="search-results-grid">
            ${HAY_APP_MODE ? '<p class="empty-msg" style="grid-column:1/-1;">Cargando…</p>' : PRODUCTS.map((p) => productCard(p)).join('')}
          </div>
        </div>
      </div>

      <!-- Panel de filtros (overlay): precio/distancia/condición, decorativos por ahora -->
      <div class="filters-overlay" id="filtersOverlay" style="display:none; position:absolute; inset:0; background:rgba(28,27,51,0.45); z-index:60;">
        <div style="position:absolute; bottom:0; left:0; right:0; background:#ffffff; border-radius:var(--radius-2xl) var(--radius-2xl) 0 0; max-height:86%; display:flex; flex-direction:column;">
          <div class="topbar" style="padding-top:var(--space-5)">
            <span class="topbar__title">Filtros</span>
            <button class="icon-btn icon-btn--ghost" id="closeFiltersBtn" aria-label="Cerrar filtros" data-testid="btn-close-filters">${icon('close')}</button>
          </div>
          <div class="screen-body">
            <div class="screen-content" style="gap:var(--space-5)">
              <p class="text-xs text-muted" style="font-weight:700;">Precio, distancia y condición se afinan pronto — por ahora usa las categorías y el filtro Personas/Negocios de arriba.</p>
              <div class="card stack-sm">
                <div class="flex-row"><span class="list-row__icon tone-green">${icon('tag')}</span><span class="list-row__title">Precio</span></div>
                <div class="flex-row">
                  <div class="field grow"><input type="text" placeholder="Mín. $0" /></div>
                  <span class="text-faint">—</span>
                  <div class="field grow"><input type="text" placeholder="Máx. $200" /></div>
                </div>
              </div>
              <div class="card stack-sm">
                <div class="flex-row"><span class="list-row__icon tone-cyan">${icon('pin')}</span><span class="list-row__title">Distancia</span></div>
                <div class="chip-row">
                  <span class="chip">1 mi</span><span class="chip is-active">5 mi</span><span class="chip">10 mi</span><span class="chip">25 mi</span>
                </div>
              </div>
              <div class="card stack-sm">
                <div class="flex-row"><span class="list-row__icon tone-yellow">${icon('shield')}</span><span class="list-row__title">Estado</span></div>
                <div class="pill-row">
                  <span class="pill">Nuevo</span><span class="pill is-selected">Como nuevo</span><span class="pill">Usado</span>
                </div>
              </div>
            </div>
          </div>
          <div class="bottom-cta">
            <button class="btn btn--outline" id="clearFiltersBtn" data-testid="btn-clear-filters">Limpiar</button>
            <button class="btn btn--turquoise" id="applyFiltersBtn" data-testid="btn-apply-filters">Aplicar filtros</button>
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
      <div class="topbar" style="padding-top:var(--space-3);"><h1 class="topbar__title screen-title" style="font-size:var(--text-xl)">Mensajes</h1><button class="icon-btn" aria-label="Buscar chats" data-testid="btn-search-chats">${icon('search')}</button></div>
      <div class="screen-body" data-testid="screen-messages">
        ${!CURRENT_USER ? `
          <div class="empty-state">${heroIcon('chat', 'cyan', { size: 130 })}<p class="empty-msg" style="margin-top:0;">Inicia sesión para ver tus conversaciones.</p></div>
        ` : THREADS_LOADING ? `
          <p class="empty-msg">Cargando conversaciones...</p>
        ` : THREADS.length === 0 ? `
          <div class="empty-state">${heroIcon('chat', 'cyan', { size: 130 })}<p class="empty-msg" style="margin-top:0;">Todavía no tienes mensajes.<br/>Escríbele a un vendedor desde el detalle de un producto.</p></div>
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
    html: () => `
    <div class="phone__screen screen--fucsia-top">
      ${statusBar()}
      <div class="screen-body">
        <!-- V1.33: cabecera fucsia; la foto de perfil queda montada sobre su borde -->
        <header class="fucsia-header profile-header" data-testid="profile-header">
          <h1 class="screen-title">Mi perfil</h1>
          <button class="icon-btn icon-btn--white" data-nav="settings" aria-label="Configuración" data-testid="btn-open-settings-from-profile">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z"/></svg>
          </button>
        </header>
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-profile">
          <div class="stack text-center profile-hero" style="align-items:center; gap:var(--space-3);">
            ${HAY_APP_MODE && !CURRENT_USER ? `
            ${heroIcon('user', 'cyan', { size: 130 })}
            <p style="font-family:var(--font-display); font-weight:700; font-size:24px; color:var(--hay-navy);">Entra a tu cuenta</p>
            <p class="screen-subtitle">Para publicar, chatear y ver tus ventas.</p>
            <button class="btn btn--turquoise" data-nav="login" data-testid="btn-profile-login">Iniciar sesión</button>
            <button class="btn btn--outline" data-nav="register" data-testid="btn-profile-register">Crear cuenta</button>
            ` : `
            ${userAvatar('lg', 'fucsia', 'profile-avatar')}
            <p style="font-family:var(--font-display); font-weight:600; font-size:24px; color:var(--hay-navy); line-height:1.2; word-break:break-word;">${CURRENT_USER ? (CURRENT_USER.businessName || CURRENT_USER.email) : 'María Jiménez'}</p>
            ${HAY_APP_MODE ? (() => {
              const r = RATINGS_CACHE.get(CURRENT_USER.id);
              return r && r.count
                ? `<span class="rating-pill" data-testid="profile-rating">${r.average.toFixed(1).replace('.', ',')} ${icon('star')} <small>(${r.count} calificaci${r.count === 1 ? 'ón' : 'ones'})</small></span>`
                : `<span class="rating-pill" data-testid="profile-rating"><small>Todavía sin calificaciones</small></span>`;
            })() : `<span class="rating-pill">4,0 ${icon('star')} <small>(32 ventas)</small></span>`}
            <span class="text-xs text-faint" style="font-weight:700;">${HAY_APP_MODE ? 'Sesión activa' : CURRENT_USER ? 'Miami, FL · Sesión activa' : 'Miami, FL · Miembro desde 2023 (invitado, sin sesión)'}</span>
            <button class="btn btn--turquoise" style="width:auto; padding-left:var(--space-8); padding-right:var(--space-8);" data-nav="edit-profile" data-testid="btn-edit-profile-cta">${icon('edit')} Editar perfil</button>
            `}
          </div>

          ${HAY_APP_MODE && needsIdentity() ? identityBanner() : ''}
          <div class="option-list">
            <button class="option-row" data-nav="my-listings" data-testid="btn-go-my-listings">
              <span class="list-row__icon tone-pink">${icon('boxOpen')}</span>
              <div class="list-row__body"><p class="list-row__title">Mis publicaciones</p><p class="list-row__sub">Ver lo que publicaste con esta cuenta</p></div>
              ${icon('chevronRight', 'list-row__chevron')}
            </button>
            <button class="option-row" data-nav="favorites" data-testid="btn-go-favorites">
              <span class="list-row__icon tone-cyan">${icon('heart')}</span>
              <div class="list-row__body"><p class="list-row__title">Favoritos</p><p class="list-row__sub">${HAY_APP_MODE ? 'Tus productos guardados' : '6 productos guardados'}</p></div>
              ${icon('chevronRight', 'list-row__chevron')}
            </button>
            <button class="option-row" data-nav="notifications" data-testid="btn-go-notifications">
              <span class="list-row__icon tone-green">${icon('bell')}</span>
              <div class="list-row__body"><p class="list-row__title">Notificaciones</p><p class="list-row__sub">${HAY_APP_MODE ? 'Avisos de tu cuenta' : '3 nuevas'}</p></div>
              ${icon('chevronRight', 'list-row__chevron')}
            </button>
            ${CURRENT_USER ? `<button class="option-row" data-nav="verify-identity" data-testid="btn-go-verify-identity">
              <span class="list-row__icon tone-yellow">${icon('shield')}</span>
              <div class="list-row__body"><p class="list-row__title">Verificación de identidad</p><p class="list-row__sub">${({ verified: 'Verificada ✓', submitted: 'Enviada ✓', rejected: 'No pasó · repítela' })[CURRENT_USER.identityStatus] || 'Pendiente · necesaria para publicar'}</p></div>
              ${icon('chevronRight', 'list-row__chevron')}
            </button>` : ''}
            <button class="option-row" data-nav="settings" data-testid="btn-go-settings">
              <span class="list-row__icon tone-pink">${icon('help')}</span>
              <div class="list-row__body"><p class="list-row__title">Configuración</p><p class="list-row__sub">Cuenta, privacidad, ayuda</p></div>
              ${icon('chevronRight', 'list-row__chevron')}
            </button>
          </div>
          ${HAY_APP_MODE ? `<p class="app-version" data-testid="app-version-profile">HAY · versión ${HAY_VERSION}</p>` : ''}
        </div>
      </div>
      ${tabBar('profile')}
    </div>`,
  },
];
