/* screens-motos.js — V2.0: HAY Motos.
   Tres secciones principales: Usadas (Inicio), Nuevas y Negocios.

   - Nuevas: buscador + tipo de moto. Arriba lo que publican los negocios
     en HAY (ordenado por cercanía) y abajo, AUTOMÁTICO, motos nuevas de
     tiendas del país (Google Shopping). Al tocar una moto de la web se
     abre su ficha con fotos, precio, tienda y los concesionarios de esa
     marca más cerca de ti (dirección, mapa, llamar, WhatsApp).
   - Negocios: concesionarios, repuestos, talleres y accesorios de la web
     (Google Maps), cerca de ti o en la ciudad que escribas.
   Más adelante los negocios podrán suscribirse para mostrar más cosas. */

const TIPOS_MOTO = [
  { v: '', l: 'Todas' },
  { v: 'scooter', l: 'Scooter' },
  { v: 'paseo', l: 'Paseo' },
  { v: 'deportiva', l: 'Deportiva' },
  { v: 'doble-proposito', l: 'Doble propósito' },
  { v: 'trabajo', l: 'Trabajo' },
  { v: 'electrica', l: 'Eléctrica' },
];

const TIPOS_NEGOCIO = [
  { v: 'venta', l: 'Venta de motos', ic: 'moto' },
  { v: 'repuestos', l: 'Repuestos', ic: 'tools' },
  { v: 'talleres', l: 'Talleres', ic: 'briefcase' },
  { v: 'accesorios', l: 'Accesorios', ic: 'shield' },
];

const MOTOS_STATE = {
  nuevas: { q: '', tipo: '', key: null, data: null },
  negocios: { tipo: 'venta', ciudad: '', key: null, data: null },
  list: [], // motos de la web que se ven ahora en «Nuevas»
  current: null, // moto de la web abierta en su ficha
  donde: { key: null, data: null },
  bizShown: [], // negocios que se ven ahora en pantalla
  biz: null, // negocio abierto en su ficha
  bizBack: 'negocios',
  fotos: new Map(), // dataId → fotos
};

/* ------------------------------- API -------------------------------- */
async function apiMotos(which, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') sp.set(k, String(v)); });
  try {
    const res = await fetch(`${HAY_API_BASE}/motos/${which}?${sp}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: (data && data.error) || 'No se pudo consultar ahora.', code: data && data.code };
    return data;
  } catch (e) {
    return { error: 'Sin conexión. Revisa tu internet.' };
  }
}

/* ----------------------------- Piezas UI ----------------------------- */
function motoSections(active) {
  const tile = (id, nav, ic, label, sub) => `
    <button class="moto-sec moto-sec--${id} ${active === id ? 'is-active' : ''}" data-nav="${nav}" data-testid="moto-sec-${id}" aria-current="${active === id}">
      <span class="moto-sec__icon">${icon(ic)}</span>
      <span class="moto-sec__label">${label}</span>
      <span class="moto-sec__sub">${sub}</span>
    </button>`;
  return `<nav class="moto-secs" aria-label="Secciones de HAY Motos" data-testid="moto-sections">
    ${tile('usadas', 'home', 'moto', 'Usadas', 'De personas y negocios')}
    ${tile('nuevas', 'nuevas', 'sparkle', 'Nuevas', 'Cerca de ti')}
    ${tile('negocios', 'negocios', 'store', 'Negocios', 'Todo el país')}
  </nav>`;
}

function motosHeader(title) {
  const loc = HAY_APP_MODE ? getSavedLocation() : null;
  return `<header class="alegre-header home-header">
    <div class="alegre-header__row">
      <button class="home-location" title="Usar mi ubicación (GPS)" data-action="gps-home">${icon('pin')}<span>${(loc && loc.zone) || (loc ? 'Mi ubicación' : 'Ubicación')}</span></button>
      <h1 class="motos-title">${title}</h1>
      <button class="icon-btn icon-btn--white" data-nav="notifications" aria-label="Notificaciones" style="flex-shrink:0;">${icon('bell')}${unreadBadgeHtml()}</button>
    </div>
  </header>`;
}

const motoEsc = (s) => escapeText(s == null ? '' : String(s));
const onlyDigits = (s) => String(s || '').replace(/[^0-9]/g, '');

function telHref(phone) {
  const raw = String(phone || '').trim();
  let d = onlyDigits(raw);
  if (!d) return '';
  if (raw.startsWith('+')) return 'tel:+' + d;
  if (d.startsWith('0')) return 'tel:+58' + d.slice(1); // número venezolano local
  return 'tel:' + d;
}

function waLink(phone) {
  let d = onlyDigits(phone);
  if (!d) return '';
  if (d.startsWith('0')) d = '58' + d.slice(1); // número venezolano sin código de país
  return `https://wa.me/${d}`;
}

function negocioCard(n) {
  const idx = MOTOS_STATE.bizShown.push(n) - 1;
  const stars = n.rating ? `★ ${String(n.rating).replace('.', ',')}${n.reviews ? ` (${n.reviews})` : ''}` : '';
  const open = n.openState ? `<span class="biz-card__open ${/abierto|open/i.test(n.openState) && !/cerrado|closed/i.test(n.openState) ? 'is-open' : ''}">${motoEsc(n.openState)}</span>` : '';
  const btn = (href, ic, label, cls = '') => href ? `<a class="biz-btn ${cls}" href="${motoEsc(href)}" target="_blank" rel="noopener noreferrer">${icon(ic)}<span>${label}</span></a>` : '';
  const mapHref = n.mapsLink || (n.lat !== null && n.lat !== undefined ? `https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lng}` : '');
  return `<article class="biz-card" data-testid="biz-card">
    <button class="biz-card__top" data-nav="negocio" data-biz-idx="${idx}" aria-label="Ver ${motoEsc(n.name)}">
      ${n.thumb ? `<img class="biz-card__img" src="${motoEsc(n.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="biz-card__img biz-card__img--ph">${icon('store')}</span>`}
      <div class="biz-card__who">
        <p class="biz-card__name">${motoEsc(n.name)}</p>
        <span class="biz-card__meta">${[n.type, stars, n.distKm !== null && n.distKm !== undefined ? n.distKm.toString().replace('.', ',') + ' km' : ''].filter(Boolean).map(motoEsc).join(' · ')}</span>
        ${open}
      </div>
      ${icon('chevronRight', 'biz-card__go')}
    </button>
    ${n.address ? `<p class="biz-card__addr">${icon('pin')}<span>${motoEsc(n.address)}</span></p>` : ''}
    <div class="biz-card__btns">
      ${n.dataId ? `<button class="biz-btn biz-btn--fotos" data-nav="negocio" data-biz-idx="${idx}">${icon('gallery')}<span>Fotos</span></button>` : ''}
      ${n.phone ? `<a class="biz-btn biz-btn--call" href="${motoEsc(telHref(n.phone))}">${icon('phoneCall')}<span>Llamar</span></a>` : ''}
      ${n.phone ? btn(waLink(n.phone), 'chat', 'WhatsApp', 'biz-btn--wa') : ''}
      ${btn(mapHref, 'pin', 'Mapa')}
      ${btn(n.website, 'globe', 'Web')}
    </div>
  </article>`;
}

function motoWebCard(m, i) {
  return `<button class="moto-card" data-nav="moto-nueva" data-moto-idx="${i}" data-testid="moto-web-${i}">
    <span class="moto-card__img">${m.thumb ? `<img src="${motoEsc(m.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : icon('moto')}</span>
    ${i === 0 && m.price !== null ? '<span class="moto-card__best">Mejor precio</span>' : ''}
    <span class="moto-card__body">
      ${m.priceText ? `<span class="moto-card__price">${motoEsc(m.priceText)}</span>` : ''}
      <span class="moto-card__name">${motoEsc(m.title)}</span>
      <span class="moto-card__store">${icon('store')} ${motoEsc(m.store)}</span>
    </span>
  </button>`;
}

function motosMsg(text, action) {
  return `<p class="motos-msg">${text}${action || ''}</p>`;
}
const needLocMsg = () => motosMsg('Toca <strong>Ubicación</strong> arriba para ver lo que hay cerca de ti.');
const notConfiguredMsg = () => motosMsg('La búsqueda automática en la web todavía no está activada (falta la clave SERPAPI_KEY en el servidor).');

/* ---------------------------- Pantallas ---------------------------- */
const SCREENS_MOTOS = [
  {
    id: 'nuevas',
    block: 'main',
    label: 'Motos nuevas',
    html: () => `
    <div class="phone__screen screen--alegre">
      ${statusBar()}
      <div class="screen-body">
        ${motosHeader('Motos nuevas')}
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-nuevas">
          ${motoSections('nuevas')}
          <div class="searchbar searchbar--white">
            ${icon('search')}
            <input type="search" enterkeyhint="search" placeholder="Marca o modelo (ej. Bera, Yamaha 125)" value="${motoEsc(MOTOS_STATE.nuevas.q)}" data-testid="input-nuevas" />
          </div>
          <div class="moto-chips" data-testid="nuevas-tipos">
            ${TIPOS_MOTO.map((t) => `<button class="chip ${MOTOS_STATE.nuevas.tipo === t.v ? 'is-active' : ''}" data-tipo="${t.v}">${t.l}</button>`).join('')}
          </div>
          <section data-testid="nuevas-hay">
            <div class="motos-head"><h2>En negocios de HAY</h2><span>Más cerca primero</span></div>
            <div class="product-grid" id="nuevasHay"><p class="empty-msg" style="grid-column:1/-1;">Cargando…</p></div>
          </section>
          <section data-testid="nuevas-web">
            <div class="motos-head"><h2>En tiendas del país</h2><span id="nuevasWebNote">Automático · web</span></div>
            <div class="moto-grid" id="nuevasWeb"><p class="motos-msg">Cargando…</p></div>
          </section>
        </div>
      </div>
      ${tabBar('home', { labels: true })}
    </div>`,
  },

  {
    id: 'moto-nueva',
    block: 'main',
    label: 'Ficha de moto nueva',
    html: () => {
      const m = MOTOS_STATE.current;
      if (!m) {
        return `<div class="phone__screen">${statusBar()}${topBar({ back: 'nuevas', title: 'Moto nueva', testid: 'moto-nueva' })}<div class="screen-body"><p class="empty-msg">Vuelve a «Nuevas» y elige una moto.</p></div>${tabBar('home')}</div>`;
      }
      const photos = (m.photos && m.photos.length ? m.photos : m.thumb ? [m.thumb] : []);
      const otras = MOTOS_STATE.list.filter((x) => x !== m && m.marca && x.marca === m.marca).slice(0, 6);
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'nuevas', title: 'Moto nueva', testid: 'moto-nueva' })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-moto-nueva">
          <div class="moto-gallery">
            ${photos.length ? photos.map((u) => `<img src="${motoEsc(u)}" alt="" referrerpolicy="no-referrer" />`).join('') : `<span class="moto-gallery__ph">${icon('moto')}</span>`}
          </div>
          <div class="moto-info">
            <h2 class="moto-info__title">${motoEsc(m.title)}</h2>
            ${m.priceText ? `<p class="moto-info__price">${motoEsc(m.priceText)}</p>` : ''}
            <div class="moto-info__tags">
              ${m.marca ? `<span class="badge badge--cyan">${motoEsc(m.marca)}</span>` : ''}
              ${m.cc ? `<span class="badge badge--paused">${m.cc} cc</span>` : ''}
              <span class="badge badge--paused">Nueva</span>
            </div>
            <p class="moto-info__store">${icon('store')} Vendida por <strong>${motoEsc(m.store || 'tienda en línea')}</strong>${m.delivery ? ' · ' + motoEsc(m.delivery) : ''}</p>
            ${m.link ? `<a class="btn btn--yellow" href="${motoEsc(m.link)}" target="_blank" rel="noopener noreferrer" data-testid="btn-moto-tienda">${icon('globe')} Ver en la tienda</a>` : ''}
          </div>
          <section>
            <div class="motos-head"><h2>Dónde comprarla cerca de ti</h2><span>${m.marca ? 'Concesionarios ' + motoEsc(m.marca) : 'Concesionarios'}</span></div>
            <div id="motoDonde" data-testid="moto-donde"><p class="motos-msg">Buscando negocios cerca de ti…</p></div>
          </section>
          ${otras.length ? `<section>
            <div class="motos-head"><h2>Más ${motoEsc(m.marca)} nuevas</h2><span>Otros precios</span></div>
            <div class="moto-grid">${otras.map((x) => motoWebCard(x, MOTOS_STATE.list.indexOf(x))).join('')}</div>
          </section>` : ''}
          <p class="motos-note">Información tomada automáticamente de la web. Confirma precio y disponibilidad con el negocio antes de pagar.</p>
        </div>
      </div>
      ${tabBar('home')}
    </div>`;
    },
  },

  {
    id: 'negocios',
    block: 'main',
    label: 'Negocios de motos',
    html: () => {
      const st = MOTOS_STATE.negocios;
      return `
    <div class="phone__screen screen--alegre">
      ${statusBar()}
      <div class="screen-body">
        ${motosHeader('Negocios')}
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-negocios">
          ${motoSections('negocios')}
          <div class="biz-tipos" data-testid="negocios-tipos">
            ${TIPOS_NEGOCIO.map((t) => `<button class="biz-tipo ${st.tipo === t.v ? 'is-active' : ''}" data-tipo="${t.v}"><span class="biz-tipo__icon">${icon(t.ic)}</span>${t.l}</button>`).join('')}
          </div>
          <form class="biz-city" data-testid="negocios-ciudad">
            <div class="searchbar searchbar--white grow">
              ${icon('pin')}
              <input type="search" enterkeyhint="search" placeholder="Ciudad (ej. Valencia, Maracaibo)" value="${motoEsc(st.ciudad)}" data-testid="input-ciudad" />
            </div>
            <button class="btn btn--turquoise btn--sm" type="submit">Buscar</button>
          </form>
          <p class="motos-sub" id="negociosSub">${st.ciudad ? 'En ' + motoEsc(st.ciudad) + ' · <button class="link-btn" data-action="negocios-cerca">Ver cerca de mí</button>' : 'Cerca de ti · escribe una ciudad para buscar en todo el país'}</p>
          <div class="biz-list" id="negociosList" data-testid="negocios-list"><p class="motos-msg">Cargando…</p></div>
          <div class="biz-promo">
            <strong>¿Tienes un negocio de motos?</strong>
            <span>Muy pronto podrás aparecer destacado en HAY Motos con tus fotos, catálogo y precios.</span>
          </div>
        </div>
      </div>
      ${tabBar('home', { labels: true })}
    </div>`;
    },
  },

  {
    id: 'negocio',
    block: 'main',
    label: 'Ficha de negocio',
    html: () => {
      const n = MOTOS_STATE.biz;
      const back = MOTOS_STATE.bizBack || 'negocios';
      if (!n) return `<div class="phone__screen">${statusBar()}${topBar({ back, title: 'Negocio', testid: 'negocio' })}<div class="screen-body"><p class="empty-msg">Vuelve y elige un negocio.</p></div>${tabBar('home')}</div>`;
      const stars = n.rating ? `★ ${String(n.rating).replace('.', ',')}${n.reviews ? ` (${n.reviews} opiniones)` : ''}` : '';
      const mapHref = n.mapsLink || (typeof n.lat === 'number' ? `https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lng}` : '');
      const a = (href, ic, label, cls = '', blank = true) => href ? `<a class="biz-btn ${cls}" href="${motoEsc(href)}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ''}>${icon(ic)}<span>${label}</span></a>` : '';
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back, title: 'Negocio', testid: 'negocio' })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-negocio">
          <div class="biz-hero">
            ${n.thumb ? `<img class="biz-hero__img" src="${motoEsc(n.thumb)}" alt="" referrerpolicy="no-referrer" />` : `<span class="biz-hero__img biz-card__img--ph">${icon('store')}</span>`}
            <div>
              <h2 class="biz-hero__name">${motoEsc(n.name)}</h2>
              <p class="biz-card__meta">${[n.type, stars, typeof n.distKm === 'number' ? 'a ' + String(n.distKm).replace('.', ',') + ' km' : ''].filter(Boolean).map(motoEsc).join(' · ')}</p>
              ${n.openState ? `<span class="biz-card__open ${/abierto|open/i.test(n.openState) && !/cerrado|closed/i.test(n.openState) ? 'is-open' : ''}">${motoEsc(n.openState)}</span>` : ''}
            </div>
          </div>
          <div class="biz-card__btns">
            ${n.phone ? a(telHref(n.phone), 'phoneCall', 'Llamar', 'biz-btn--call', false) : ''}
            ${n.phone ? a(waLink(n.phone), 'chat', 'WhatsApp', 'biz-btn--wa') : ''}
            ${a(mapHref, 'pin', 'Cómo llegar')}
            ${a(n.website, 'globe', 'Web')}
          </div>
          <section>
            <div class="motos-head"><h2>Fotos</h2><span>Google Maps</span></div>
            <div class="biz-fotos" id="bizFotos" data-testid="biz-fotos"><p class="motos-msg">Cargando fotos…</p></div>
          </section>
          ${n.address ? `<p class="biz-card__addr">${icon('pin')}<span>${motoEsc(n.address)}</span></p>` : ''}
          ${typeof n.lat === 'number' ? osmMap(n.lat, n.lng, 'negocio-map') : ''}
          <p class="motos-note">Fotos e información tomadas automáticamente de Google Maps (las suben el negocio y sus clientes). Confirma disponibilidad y precios con el negocio.</p>
        </div>
      </div>
      ${tabBar('home')}
    </div>`;
    },
  },
];

/* --------------------------- Comportamiento --------------------------- */
function wireMotos(phoneEl, screenId) {
  if (screenId === 'nuevas') return wireNuevas(phoneEl);
  if (screenId === 'negocios') return wireNegocios(phoneEl);
  if (screenId === 'moto-nueva') return loadDonde(phoneEl);
  if (screenId === 'negocio') return loadFotos(phoneEl);
}

async function loadFotos(phoneEl) {
  const n = MOTOS_STATE.biz;
  const box = phoneEl.querySelector('#bizFotos');
  if (!n || !box) return;
  if (!n.dataId) { box.innerHTML = motosMsg('Este negocio no tiene fotos disponibles.'); return; }
  let data = MOTOS_STATE.fotos.get(n.dataId);
  if (!data) {
    data = await apiMotos('fotos', { data_id: n.dataId });
    if (!data.error) MOTOS_STATE.fotos.set(n.dataId, data);
  }
  if (phoneEl.dataset.currentScreen !== 'negocio' || MOTOS_STATE.biz !== n) return;
  if (data.error) { box.innerHTML = motosMsg(motoEsc(data.error)); return; }
  if (data.configured === false) { box.innerHTML = notConfiguredMsg(); return; }
  const list = data.fotos || [];
  box.innerHTML = list.length
    ? list.map((f) => `<a class="biz-foto" href="${motoEsc(f.image)}" target="_blank" rel="noopener noreferrer"><img src="${motoEsc(f.thumb || f.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></a>`).join('')
    : motosMsg('Este negocio todavía no tiene fotos en Google Maps.' + (data.demo ? ' (datos de ejemplo)' : ''));
}

let NUEVAS_TIMER = null;
function wireNuevas(phoneEl) {
  const input = phoneEl.querySelector('[data-testid="input-nuevas"]');
  if (input) input.addEventListener('input', () => {
    MOTOS_STATE.nuevas.q = input.value.trim();
    clearTimeout(NUEVAS_TIMER);
    NUEVAS_TIMER = setTimeout(() => loadNuevas(phoneEl), 600);
  });
  phoneEl.querySelectorAll('[data-testid="nuevas-tipos"] .chip').forEach((chip) => chip.addEventListener('click', (e) => {
    e.stopPropagation();
    phoneEl.querySelectorAll('[data-testid="nuevas-tipos"] .chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    MOTOS_STATE.nuevas.tipo = chip.dataset.tipo || '';
    loadNuevas(phoneEl);
  }));
  // recordar qué moto de la web se abre (antes de que navegue)
  const web = phoneEl.querySelector('#nuevasWeb');
  if (web) web.addEventListener('click', (e) => {
    const card = e.target.closest('[data-moto-idx]');
    if (card) MOTOS_STATE.current = MOTOS_STATE.list[Number(card.dataset.motoIdx)] || null;
  });
  loadNuevas(phoneEl);
}

async function loadNuevas(phoneEl) {
  const st = MOTOS_STATE.nuevas;
  const loc = getSavedLocation();
  const hayBox = phoneEl.querySelector('#nuevasHay');
  const webBox = phoneEl.querySelector('#nuevasWeb');
  if (!hayBox || !webBox) return;
  const tipoLabel = (TIPOS_MOTO.find((t) => t.v === st.tipo) || {}).l || '';
  const q = [st.q, st.tipo ? tipoLabel : ''].filter(Boolean).join(' ');

  // 1) Lo que publican los negocios en HAY (nuevo, categoría Motos), por cercanía
  apiFetchFeed({ category: 'Motos', condition: 'nuevo', q: st.q, limit: 20 }).then((page) => {
    if (phoneEl.dataset.currentScreen !== 'nuevas') return;
    if (!page) { hayBox.innerHTML = '<p class="empty-msg" style="grid-column:1/-1;">No se pudo cargar.</p>'; return; }
    rememberListings(page.items);
    const items = page.items.map(mapListingFromApi);
    hayBox.innerHTML = items.length
      ? items.map((p) => productCard(p)).join('')
      : '<p class="empty-msg" style="grid-column:1/-1;">Todavía ningún negocio publicó motos nuevas' + (st.q ? ' con esa búsqueda' : '') + '.</p>';
    if (typeof wireFavButtons === 'function') wireFavButtons(phoneEl);
  });

  // 2) Automático: motos nuevas de tiendas del país (web)
  if (!loc) { webBox.innerHTML = needLocMsg(); return; }
  const key = [q.toLowerCase(), loc.lat, loc.lng].join('|');
  if (st.key === key && st.data) return renderNuevasWeb(phoneEl, st.data);
  webBox.innerHTML = '<p class="motos-msg">Buscando motos nuevas en tiendas de tu país…</p>';
  const data = await apiMotos('nuevas', { q: st.q, tipo: st.tipo, lat: loc.lat, lng: loc.lng });
  if (phoneEl.dataset.currentScreen !== 'nuevas') return;
  const now = [[MOTOS_STATE.nuevas.q, MOTOS_STATE.nuevas.tipo ? tipoLabel : ''].filter(Boolean).join(' ').toLowerCase(), loc.lat, loc.lng].join('|');
  if (now !== key) return; // ya cambió la búsqueda
  if (!data.error) { st.key = key; st.data = data; }
  renderNuevasWeb(phoneEl, data);
}

function renderNuevasWeb(phoneEl, data) {
  const webBox = phoneEl.querySelector('#nuevasWeb');
  if (!webBox) return;
  if (data.error) { webBox.innerHTML = motosMsg(motoEsc(data.error)); return; }
  if (data.configured === false) { webBox.innerHTML = notConfiguredMsg(); MOTOS_STATE.list = []; return; }
  MOTOS_STATE.list = data.motos || [];
  const note = phoneEl.querySelector('#nuevasWebNote');
  if (note) note.textContent = 'Automático' + (data.countryName ? ' · ' + data.countryName : '') + (data.demo ? ' · ejemplo' : '');
  webBox.innerHTML = MOTOS_STATE.list.length
    ? MOTOS_STATE.list.map(motoWebCard).join('')
    : '<p class="motos-msg">No encontramos motos nuevas en tiendas para esta búsqueda.</p>';
}

async function loadDonde(phoneEl) {
  const m = MOTOS_STATE.current;
  const box = phoneEl.querySelector('#motoDonde');
  if (!m || !box) return;
  const wrap = phoneEl.querySelector('.screen-content');
  if (wrap) wrap.addEventListener('click', (e) => {
    const card = e.target.closest('[data-moto-idx]');
    if (card) MOTOS_STATE.current = MOTOS_STATE.list[Number(card.dataset.motoIdx)] || null;
  });
  const loc = getSavedLocation();
  if (!loc) { box.innerHTML = needLocMsg(); return; }
  const key = [m.marca || '', loc.lat, loc.lng].join('|');
  let data = MOTOS_STATE.donde.key === key ? MOTOS_STATE.donde.data : null;
  if (!data) {
    data = await apiMotos('donde', { marca: m.marca || '', lat: loc.lat, lng: loc.lng });
    if (!data.error) MOTOS_STATE.donde = { key, data };
  }
  if (phoneEl.dataset.currentScreen !== 'moto-nueva' || MOTOS_STATE.current !== m) return;
  if (data.error) { box.innerHTML = motosMsg(motoEsc(data.error)); return; }
  if (data.configured === false) { box.innerHTML = notConfiguredMsg(); return; }
  const list = data.negocios || [];
  MOTOS_STATE.bizShown = [];
  const first = list.find((n) => typeof n.lat === 'number');
  box.innerHTML = list.length
    ? (first ? `<div class="moto-map">${osmMap(first.lat, first.lng, 'moto-donde-map')}<p class="motos-sub">${icon('pin')} El más cercano: <strong>${motoEsc(first.name)}</strong></p></div>` : '')
      + `<div class="biz-list">${list.map((n) => negocioCard(n)).join('')}</div>`
    : '<p class="motos-msg">No encontramos concesionarios cerca. Mira la sección <button class="link-btn" data-nav="negocios">Negocios</button>.</p>';
}

function wireNegocios(phoneEl) {
  const st = MOTOS_STATE.negocios;
  phoneEl.querySelectorAll('[data-testid="negocios-tipos"] .biz-tipo').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    phoneEl.querySelectorAll('[data-testid="negocios-tipos"] .biz-tipo').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    st.tipo = b.dataset.tipo;
    loadNegocios(phoneEl);
  }));
  const form = phoneEl.querySelector('[data-testid="negocios-ciudad"]');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    st.ciudad = form.querySelector('input').value.trim();
    navigateTo(phoneEl, 'negocios', { skipFetch: true });
  });
  const cerca = phoneEl.querySelector('[data-action="negocios-cerca"]');
  if (cerca) cerca.addEventListener('click', (e) => {
    e.stopPropagation();
    st.ciudad = '';
    navigateTo(phoneEl, 'negocios', { skipFetch: true });
  });
  loadNegocios(phoneEl);
}

async function loadNegocios(phoneEl) {
  const st = MOTOS_STATE.negocios;
  const box = phoneEl.querySelector('#negociosList');
  if (!box) return;
  const loc = getSavedLocation();
  if (!loc && !st.ciudad) { box.innerHTML = needLocMsg(); return; }
  const key = [st.tipo, st.ciudad.toLowerCase(), loc ? loc.lat + ',' + loc.lng : ''].join('|');
  if (st.key === key && st.data) return renderNegocios(box, st.data);
  box.innerHTML = '<p class="motos-msg">Buscando negocios…</p>';
  const data = await apiMotos('negocios', { tipo: st.tipo, ciudad: st.ciudad, lat: loc && loc.lat, lng: loc && loc.lng });
  if (phoneEl.dataset.currentScreen !== 'negocios') return;
  if ([st.tipo, st.ciudad.toLowerCase(), loc ? loc.lat + ',' + loc.lng : ''].join('|') !== key) return;
  if (!data.error) { st.key = key; st.data = data; }
  renderNegocios(box, data);
}

function renderNegocios(box, data) {
  if (data.error) { box.innerHTML = motosMsg(motoEsc(data.error)); return; }
  if (data.configured === false) { box.innerHTML = notConfiguredMsg(); return; }
  const list = data.negocios || [];
  MOTOS_STATE.bizShown = [];
  box.innerHTML = list.length
    ? list.map((n) => negocioCard(n)).join('')
    : '<p class="motos-msg">No encontramos negocios para esta búsqueda. Prueba con otra ciudad.</p>';
}
