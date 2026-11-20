/* screens-motos.js — V2.0: HAY Motos.
   Cuatro secciones: Usadas (Inicio), Nuevas, Repuestos y accesorios, Negocios.

   - Usadas: las publican personas y negocios (solo usado / como nuevo).
   - Nuevas: SOLO de negocios. Por ahora salen AUTOMÁTICAS de la web
     (con foto real y precio), sin preferencia por ningún negocio: solo
     cuenta la cercanía a ti o a la zona que elijas. Más adelante se suman
     los negocios suscritos.
   - Repuestos y accesorios: Nuevos (negocios + web automática) y Usados
     (personas y negocios), por cercanía.
   - Negocios: concesionarios, repuestos, talleres y accesorios de la web. */

/* ------------------------------ Zonas ------------------------------ */
const ZONAS_VE = [
  ['Distrito Capital (Caracas)', 10.4806, -66.9036], ['Amazonas', 5.6639, -67.6236], ['Anzoátegui', 10.2167, -64.6333],
  ['Apure', 7.8878, -67.4724], ['Aragua', 10.2469, -67.5958], ['Barinas', 8.6226, -70.2075], ['Bolívar', 8.2995, -62.7272],
  ['Carabobo', 10.162, -68.0077], ['Cojedes', 9.6612, -68.5827], ['Delta Amacuro', 9.0619, -62.051], ['Falcón', 11.4045, -69.6734],
  ['Guárico', 9.9112, -67.3539], ['La Guaira', 10.6, -66.9333], ['Lara', 10.0678, -69.3474], ['Mérida', 8.5897, -71.1561],
  ['Miranda', 10.3442, -67.0433], ['Monagas', 9.7457, -63.1832], ['Nueva Esparta', 10.9577, -63.8697], ['Portuguesa', 9.0418, -69.7421],
  ['Sucre', 10.4564, -64.1675], ['Táchira', 7.7669, -72.225], ['Trujillo', 9.3667, -70.4333], ['Yaracuy', 10.3399, -68.7425], ['Zulia', 10.6427, -71.6125],
];
const ZONA_KEY = 'hay_zona';
function getZona() {
  try { const z = JSON.parse(localStorage.getItem(ZONA_KEY)); return z && typeof z.lat === 'number' ? z : null; } catch (e) { return null; }
}
function setZona(nombre) {
  const z = ZONAS_VE.find((x) => x[0] === nombre);
  try {
    if (z) localStorage.setItem(ZONA_KEY, JSON.stringify({ nombre: z[0], lat: z[1], lng: z[2] }));
    else localStorage.removeItem(ZONA_KEY);
  } catch (e) {}
}
/* Punto desde donde se mide la cercanía: la zona elegida o tu ubicación. */
const CENTRO_PAIS = { lat: 10.4806, lng: -66.9036, zone: 'Venezuela', pais: true }; // mientras no haya GPS ni zona
function motoCenter() {
  const z = getZona();
  if (z) return { lat: z.lat, lng: z.lng, zone: z.nombre };
  return getSavedLocation() || CENTRO_PAIS;
}
/* La app busca sola tu ubicación (una vez por visita). Si no se puede,
   igual muestra todo el país y puedes elegir una zona. */
let AUTO_GPS_TRIED = false;
function autoUbicar(phoneEl, screenId) {
  if (AUTO_GPS_TRIED || getZona() || getSavedLocation() || !HAY_APP_MODE) return;
  AUTO_GPS_TRIED = true;
  getGpsLocation().then(() => {
    if (phoneEl.dataset.currentScreen === screenId) navigateTo(phoneEl, screenId, { skipFetch: true });
  }).catch(() => {});
}
function zonaSelect() {
  const z = getZona();
  return `<label class="zona-select" data-testid="zona-select">
    ${icon('pin')}
    <select data-action="zona" aria-label="Zona">
      <option value="">${getSavedLocation() ? 'Cerca de mí' + (!z && getSavedLocation().zone ? ' (' + motoEsc(getSavedLocation().zone) + ')' : '') : 'Todo el país'}</option>
      ${ZONAS_VE.map(([n]) => `<option value="${n}" ${z && z.nombre === n ? 'selected' : ''}>${n}</option>`).join('')}
    </select>
  </label>`;
}

const TIPOS_MOTO = [
  { v: '', l: 'Todas' }, { v: 'scooter', l: 'Scooter' }, { v: 'paseo', l: 'Paseo' }, { v: 'deportiva', l: 'Deportiva' },
  { v: 'doble-proposito', l: 'Doble propósito' }, { v: 'trabajo', l: 'Trabajo' }, { v: 'electrica', l: 'Eléctrica' },
];
const TIPOS_NEGOCIO = [
  { v: 'venta', l: 'Venta de motos', ic: 'moto' }, { v: 'repuestos', l: 'Repuestos', ic: 'tools' },
  { v: 'talleres', l: 'Talleres', ic: 'briefcase' }, { v: 'accesorios', l: 'Accesorios', ic: 'shield' },
];
const CAT_REPUESTOS = 'Repuestos y accesorios';

const MOTOS_STATE = {
  nuevas: { q: '', tipo: '' },
  repuestos: { q: '', cond: 'todos' },
  negocios: { tipo: 'venta', key: null, data: null },
  web: new Map(), // caché de búsquedas en la web
  items: [], // artículos de la web que se ven ahora (Nuevas / Repuestos)
  usadas: [], // motos usadas de la web que se ven ahora en «Usadas»
  current: null, // artículo de la web abierto en su ficha
  currentBack: 'nuevas',
  donde: { key: null, data: null },
  bizShown: [], biz: null, bizBack: 'negocios',
  fotos: new Map(),
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
  const tile = (id, nav, ic, label) => `
    <button class="moto-sec moto-sec--${id} ${active === id ? 'is-active' : ''}" data-nav="${nav}" data-testid="moto-sec-${id}" aria-current="${active === id}">
      <span class="moto-sec__icon">${icon(ic)}</span>
      <span class="moto-sec__label">${label}</span>
    </button>`;
  return `<nav class="moto-secs" aria-label="Secciones de HAY Motos" data-testid="moto-sections">
    ${tile('nuevas', 'nuevas', 'sparkle', 'Nuevas')}
    ${tile('usadas', 'home', 'moto', 'Usadas')}
    ${tile('repuestos', 'repuestos', 'tools', 'Repuestos')}
    ${tile('negocios', 'negocios', 'store', 'Negocios')}
  </nav>`;
}

function motosHeader(title) {
  return `<header class="alegre-header home-header">
    <div class="alegre-header__row">
      <span class="hdr-spacer" aria-hidden="true"></span>
      <h1 class="motos-title">${hayMotosBrand()}<span class="sr-only">${title}</span></h1>
      <button class="icon-btn icon-btn--white" data-nav="notifications" aria-label="Notificaciones" style="flex-shrink:0;">${icon('bell')}${unreadBadgeHtml()}</button>
    </div>
  </header>`;
}

const motoEsc = (s) => escapeText(s == null ? '' : String(s));
const onlyDigits = (s) => String(s || '').replace(/[^0-9]/g, '');
const kmText = (d) => (d < 1 ? 'a menos de 1 km' : `a ${d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)} km`);

function telHref(phone) {
  const raw = String(phone || '').trim();
  const d = onlyDigits(raw);
  if (!d) return '';
  if (raw.startsWith('+')) return 'tel:+' + d;
  if (d.startsWith('0')) return 'tel:+58' + d.slice(1); // número venezolano local
  return 'tel:' + d;
}
function waLink(phone) {
  let d = onlyDigits(phone);
  if (!d) return '';
  if (d.startsWith('0')) d = '58' + d.slice(1);
  return `https://wa.me/${d}`;
}

/* Tarjeta única del marketplace (mismo tamaño para la web y para HAY):
   foto real con el precio encima, título, negocio y dónde está. */
function marketCard(it) {
  const noKm = motoCenter().pais; // sin GPS ni zona: no se dan km (serían desde Caracas)
  const where = noKm
    ? `${icon('pin')}<span${it.place ? '' : ' class="is-unknown"'}>${motoEsc(it.place || 'Venezuela')}</span>`
    : typeof it.distKm === 'number'
    ? `${icon('pin')}<span>${motoEsc(it.place ? it.place + ' · ' : '')}${kmText(it.distKm)}</span>`
    : `${icon('pin')}<span class="is-unknown">Ubicación sin confirmar</span>`;
  const nav = it.kind === 'hay' ? `data-nav="product-detail" data-listing-id="${motoEsc(it.id)}"`
    : it.kind === 'usada' ? `data-nav="moto-nueva" data-usada-idx="${it.idx}"` : `data-nav="moto-nueva" data-web-idx="${it.idx}"`;
  return `<button class="mk-card" ${nav} data-testid="mk-card">
    <span class="mk-card__img">
      <img src="${motoEsc(it.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
      ${it.priceText ? `<span class="mk-card__price">${motoEsc(it.priceText)}</span>` : ''}
      ${it.badge ? `<span class="mk-card__badge">${motoEsc(it.badge)}</span>` : ''}
    </span>
    <span class="mk-card__body">
      <span class="mk-card__name">${motoEsc(it.title)}</span>
      <span class="mk-card__store">${icon('store')}<span>${motoEsc(it.store || 'Tienda')}</span></span>
      <span class="mk-card__where">${where}</span>
    </span>
  </button>`;
}

/* Publicación de HAY → tarjeta (solo si tiene foto real) */
function hayToMarket(l, badge) {
  const url = l.photoUrls && l.photoUrls[0];
  if (!url) return null;
  const thumb = (l.photoThumbs && l.photoThumbs[url]) || url;
  const c = motoCenter();
  const d = c && typeof l.lat === 'number' ? distanceKm(c, { lat: l.lat, lng: l.lng }) : null;
  return {
    kind: 'hay', id: l.id, title: l.title, priceText: '$' + Number(l.price).toLocaleString('en-US'), photo: photoSrc(thumb),
    store: l.sellerBusinessName || 'Negocio', place: (l.zone || '').split(',')[0], distKm: typeof d === 'number' ? d : null, badge,
  };
}
function webToMarket(w, idx) {
  return {
    kind: w.kind === 'usada' ? 'usada' : 'web', idx, title: w.title, priceText: w.priceText, photo: w.thumb, store: w.store,
    place: w.place || (w.negocio && w.negocio.address ? lastPlace(w.negocio.address) : ''), distKm: typeof w.distKm === 'number' ? w.distKm : null,
  };
}
// «Av. X, Puerto La Cruz 6023, Anzoátegui» → «Puerto La Cruz»
function lastPlace(addr) {
  const parts = String(addr).split(',').map((s) => s.replace(/\d{4,}/g, '').trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '';
}

function negocioCard(n) {
  const idx = MOTOS_STATE.bizShown.push(n) - 1;
  const stars = n.rating ? `★ ${String(n.rating).replace('.', ',')}${n.reviews ? ` (${n.reviews})` : ''}` : '';
  const open = n.openState ? `<span class="biz-card__open ${/abierto|open/i.test(n.openState) && !/cerrado|closed/i.test(n.openState) ? 'is-open' : ''}">${motoEsc(n.openState)}</span>` : '';
  const btn = (href, ic, label, cls = '') => href ? `<a class="biz-btn ${cls}" href="${motoEsc(href)}" target="_blank" rel="noopener noreferrer">${icon(ic)}<span>${label}</span></a>` : '';
  const mapHref = n.mapsLink || (typeof n.lat === 'number' ? `https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lng}` : '');
  return `<article class="biz-card" data-testid="biz-card">
    <button class="biz-card__top" data-nav="negocio" data-biz-idx="${idx}" aria-label="Ver ${motoEsc(n.name)}">
      ${n.thumb ? `<img class="biz-card__img" src="${motoEsc(n.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="biz-card__img biz-card__img--ph">${icon('store')}</span>`}
      <div class="biz-card__who">
        <p class="biz-card__name">${motoEsc(n.name)}</p>
        <span class="biz-card__meta">${[n.type, stars, typeof n.distKm === 'number' ? kmText(n.distKm) : ''].filter(Boolean).map(motoEsc).join(' · ')}</span>
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

const motosMsg = (text) => `<p class="motos-msg">${text}</p>`;
const needLocMsg = () => motosMsg('Elige una zona arriba o toca <strong>Ubicación</strong> para ver lo que hay cerca de ti.');
const notConfiguredMsg = () => motosMsg('La búsqueda automática en la web todavía no está activada (falta la clave SERPAPI_KEY en el servidor).');

/* Pantalla de marketplace (Nuevas / Repuestos): mismo esqueleto */
function marketScreen({ id, title, placeholder, query, filtersHtml }) {
  return `
    <div class="phone__screen screen--alegre">
      ${statusBar()}
      <div class="screen-body">
        ${motosHeader(title)}
        <div class="screen-content" style="gap:var(--space-3)" data-testid="screen-${id}">
          ${motoSections(id)}
          <div class="searchbar searchbar--white">
            ${icon('search')}
            <input type="search" enterkeyhint="search" placeholder="${placeholder}" value="${motoEsc(query)}" data-testid="input-${id}" data-market-search />
            <button class="search-go" type="button" aria-label="Buscar" data-market-go>${icon('search')}</button>
          </div>
          ${zonaSelect()}
          ${filtersHtml}
          <p class="motos-sub" data-market-note></p>
          <div class="mk-grid" data-market-grid data-testid="${id}-grid"><p class="motos-msg">Cargando…</p></div>
        </div>
      </div>
      ${tabBar('home', { labels: true })}
    </div>`;
}

/* ---------------------------- Pantallas ---------------------------- */
const SCREENS_MOTOS = [
  {
    id: 'nuevas',
    block: 'main',
    label: 'Motos nuevas',
    html: () => marketScreen({
      id: 'nuevas', title: 'Motos nuevas', placeholder: 'Ej.: Bera León, Yamaha 125', query: MOTOS_STATE.nuevas.q,
      filtersHtml: `<div class="moto-chips" data-testid="nuevas-tipos">${TIPOS_MOTO.map((t) => `<button class="chip ${MOTOS_STATE.nuevas.tipo === t.v ? 'is-active' : ''}" data-tipo="${t.v}">${t.l}</button>`).join('')}</div>`,
    }),
  },

  {
    id: 'repuestos',
    block: 'main',
    label: 'Repuestos y accesorios',
    html: () => marketScreen({
      id: 'repuestos', title: 'Repuestos', placeholder: 'Ej.: casco, kit de arrastre, batería', query: MOTOS_STATE.repuestos.q,
      filtersHtml: `<div class="moto-chips" data-testid="repuestos-cond">${[['todos', 'Todos'], ['nuevos', 'Nuevos'], ['usados', 'Usados']].map(([v, l]) => `<button class="chip ${MOTOS_STATE.repuestos.cond === v ? 'is-active' : ''}" data-cond="${v}">${l}</button>`).join('')}</div>`,
    }),
  },

  {
    id: 'moto-nueva',
    block: 'main',
    label: 'Ficha de artículo nuevo',
    html: () => {
      const m = MOTOS_STATE.current;
      const back = MOTOS_STATE.currentBack || 'nuevas';
      const esMoto = back !== 'repuestos';
      const esUsada = Boolean(m && m.kind === 'usada');
      if (!m) {
        return `<div class="phone__screen">${statusBar()}${topBar({ back, title: 'Nuevo', testid: 'moto-nueva' })}<div class="screen-body"><p class="empty-msg">Vuelve y elige una publicación.</p></div>${tabBar('home')}</div>`;
      }
      const photos = (m.photos && m.photos.length ? m.photos : [m.thumb]).filter(Boolean);
      const n = m.negocio;
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back, title: esUsada ? 'Moto usada' : esMoto ? 'Moto nueva' : 'Repuesto nuevo', testid: 'moto-nueva' })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-moto-nueva">
          <div class="moto-gallery">${photos.map((u) => `<img src="${motoEsc(u)}" alt="" referrerpolicy="no-referrer" />`).join('')}</div>
          <div class="moto-info">
            <h2 class="moto-info__title">${motoEsc(m.title)}</h2>
            ${m.priceText ? `<p class="moto-info__price">${motoEsc(m.priceText)}</p>` : ''}
            <div class="moto-info__tags">
              ${m.marca ? `<span class="badge badge--cyan">${motoEsc(m.marca)}</span>` : ''}
              ${m.cc ? `<span class="badge badge--paused">${m.cc} cc</span>` : ''}
              <span class="badge badge--paused">${esUsada ? 'Usada' : 'Nuevo'}</span>
            </div>
            <p class="moto-info__store">${icon('store')} <strong>${motoEsc(m.store || 'Tienda')}</strong>${typeof m.distKm === 'number' ? ' · ' + (m.place ? motoEsc(m.place) + ', ' : '') + kmText(m.distKm) : ' · ubicación sin confirmar'}</p>
            ${m.link ? `<a class="btn btn--yellow" href="${motoEsc(m.link)}" target="_blank" rel="noopener noreferrer" data-testid="btn-moto-tienda">${icon('globe')} ${esUsada ? 'Ver anuncio original' : 'Ver publicación original'}</a>` : ''}
          </div>
          ${n ? `<section>
            <div class="motos-head"><h2>Dónde está</h2><span>Google Maps</span></div>
            <div class="biz-list">${(MOTOS_STATE.bizShown = [], negocioCard(n))}</div>
            ${typeof n.lat === 'number' ? osmMap(n.lat, n.lng, 'moto-nueva-map') : ''}
          </section>` : ''}
          ${esMoto && !esUsada ? `<section>
            <div class="motos-head"><h2>${n ? 'Otros concesionarios cerca' : 'Dónde comprarla cerca de ti'}</h2><span>${m.marca ? motoEsc(m.marca) : ''}</span></div>
            <div id="motoDonde" data-testid="moto-donde"><p class="motos-msg">Buscando negocios cerca…</p></div>
          </section>` : ''}
          <p class="motos-note">${esUsada ? 'Anuncio encontrado automáticamente en la web. HAY no verifica al vendedor: revisa la moto y sus papeles en persona antes de pagar.' : 'Información tomada automáticamente de la web. Confirma precio y disponibilidad con el negocio antes de pagar.'}</p>
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
        <div class="screen-content" style="gap:var(--space-3)" data-testid="screen-negocios">
          ${motoSections('negocios')}
          ${zonaSelect()}
          <div class="biz-tipos" data-testid="negocios-tipos">
            ${TIPOS_NEGOCIO.map((t) => `<button class="biz-tipo ${st.tipo === t.v ? 'is-active' : ''}" data-tipo="${t.v}"><span class="biz-tipo__icon">${icon(t.ic)}</span>${t.l}</button>`).join('')}
          </div>
          <div class="biz-list" id="negociosList" data-testid="negocios-list"><p class="motos-msg">Cargando…</p></div>
          <div class="biz-promo">
            <strong>¿Tienes un negocio de motos?</strong>
            <span>Muy pronto podrás publicar tus motos nuevas, repuestos y accesorios con fotos y precios.</span>
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
              <p class="biz-card__meta">${[n.type, stars, typeof n.distKm === 'number' ? kmText(n.distKm) : ''].filter(Boolean).map(motoEsc).join(' · ')}</p>
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
  // Selector de zona (Usadas, Nuevas, Repuestos, Negocios)
  const zona = phoneEl.querySelector('[data-action="zona"]');
  if (zona) zona.addEventListener('change', () => {
    setZona(zona.value);
    if (!zona.value && HAY_APP_MODE) { // «Cerca de mí»: ubicarte de nuevo con el GPS
      getGpsLocation().catch(() => null).then(() => navigateTo(phoneEl, screenId, { skipFetch: true }));
      return;
    }
    navigateTo(phoneEl, screenId, { skipFetch: true });
  });
  if (['home', 'nuevas', 'repuestos', 'negocios'].includes(screenId)) autoUbicar(phoneEl, screenId);
  if (screenId === 'home') return loadUsadasWeb(phoneEl);
  if (screenId === 'nuevas' || screenId === 'repuestos') return wireMarket(phoneEl, screenId);
  if (screenId === 'negocios') return wireNegocios(phoneEl);
  if (screenId === 'moto-nueva') return loadDonde(phoneEl);
  if (screenId === 'negocio') return loadFotos(phoneEl);
}

let MARKET_TIMER = null;
function wireMarket(phoneEl, screenId) {
  const st = MOTOS_STATE[screenId];
  const input = phoneEl.querySelector('[data-market-search]');
  if (input) input.addEventListener('input', () => {
    st.q = input.value.trim();
    clearTimeout(MARKET_TIMER);
    MARKET_TIMER = setTimeout(() => loadMarket(phoneEl, screenId), 600);
  });
  // V2.0.1: botón de buscar al final de la barra y tecla «Buscar» del teclado
  const goNow = () => { if (!input) return; st.q = input.value.trim(); clearTimeout(MARKET_TIMER); input.blur(); loadMarket(phoneEl, screenId); };
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goNow(); } });
  const goBtn = phoneEl.querySelector('[data-market-go]');
  if (goBtn) goBtn.addEventListener('click', (e) => { e.stopPropagation(); goNow(); });
  phoneEl.querySelectorAll('.moto-chips .chip').forEach((chip) => chip.addEventListener('click', (e) => {
    e.stopPropagation();
    phoneEl.querySelectorAll('.moto-chips .chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    if (screenId === 'nuevas') st.tipo = chip.dataset.tipo || '';
    else st.cond = chip.dataset.cond || 'todos';
    loadMarket(phoneEl, screenId);
  }));
  loadMarket(phoneEl, screenId);
}

/* Junta lo de HAY y lo de la web en UNA cuadrícula, ordenada por cercanía. */
async function loadMarket(phoneEl, screenId) {
  const st = MOTOS_STATE[screenId];
  const grid = phoneEl.querySelector('[data-market-grid]');
  const note = phoneEl.querySelector('[data-market-note]');
  if (!grid) return;
  const c = motoCenter();
  const isNuevas = screenId === 'nuevas';
  const cond = isNuevas ? 'nuevos' : st.cond;
  const tipoLabel = isNuevas && st.tipo ? (TIPOS_MOTO.find((t) => t.v === st.tipo) || {}).l : '';
  const reqKey = [screenId, st.q, st.tipo || '', cond, c ? c.lat + ',' + c.lng : ''].join('|');
  phoneEl.dataset.marketKey = reqKey;
  const dondeTxt = c.pais ? ' en todo el país' : ' cerca' + (c.zone ? ' de ' + motoEsc(c.zone) : ' de ti');
  grid.innerHTML = '<p class="motos-msg">Buscando' + (st.q ? ' «' + motoEsc(st.q) + '»' : '') + dondeTxt + '…</p>';

  // 1) HAY: nuevas → solo negocios; usados → personas y negocios
  const hayCalls = [];
  const hayQ = [st.q, tipoLabel].filter(Boolean).join(' ');
  const cat = isNuevas ? 'Motos' : CAT_REPUESTOS;
  if (cond !== 'usados') hayCalls.push(apiFetchFeed({ category: cat, condition: 'nuevo', sellerType: 'negocio', q: hayQ, limit: 30 }).then((p) => (p ? p.items : [])).then((l) => l.map((x) => hayToMarket(x, 'Negocio en HAY'))));
  if (cond !== 'nuevos') hayCalls.push(apiFetchFeed({ category: cat, condition: 'usado', q: hayQ, limit: 30 }).then((p) => (p ? p.items : [])).then((l) => { rememberListings(l); return l.map((x) => hayToMarket(x, 'Usado')); }));
  // 2) Web automática (solo nuevos, solo con ubicación o zona)
  let webPromise = Promise.resolve(null);
  if (cond !== 'usados' && c) {
    const wkey = [isNuevas ? 'n' : 'r', st.q.toLowerCase(), st.tipo || '', c.lat, c.lng].join('|');
    webPromise = MOTOS_STATE.web.has(wkey)
      ? Promise.resolve(MOTOS_STATE.web.get(wkey))
      : apiMotos(isNuevas ? 'nuevas' : 'repuestos', { q: st.q, tipo: st.tipo || '', lat: c.lat, lng: c.lng }).then((d) => { if (!d.error) MOTOS_STATE.web.set(wkey, d); return d; });
  }
  const [hayLists, web] = await Promise.all([Promise.all(hayCalls), webPromise]);
  if (phoneEl.dataset.currentScreen !== screenId || phoneEl.dataset.marketKey !== reqKey) return; // ya cambió la búsqueda

  MOTOS_STATE.items = (web && web.items) || [];
  const all = hayLists.flat().filter(Boolean).concat(MOTOS_STATE.items.map(webToMarket));
  all.sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9));

  const msgs = [];
  if (web && web.configured === false) msgs.push('La búsqueda automática en la web todavía no está activada (falta SERPAPI_KEY en el servidor).');
  else if (web && web.error) msgs.push(motoEsc(web.error));
  if (note) note.innerHTML = all.length ? `${all.length} resultado${all.length === 1 ? '' : 's'} · ${c.pais ? 'todo el país (elige tu zona para ver lo más cerca)' : 'más cerca' + (c.zone ? ' de ' + motoEsc(c.zone) : ' de ti') + ' primero'}${web && web.demo ? ' · datos de ejemplo' : ''}` : '';
  grid.innerHTML = (msgs.length ? msgs.map(motosMsg).join('') : '')
    + (all.length ? all.map(marketCard).join('') : (msgs.length ? '' : motosMsg('No encontramos resultados' + (st.q ? ' para «' + motoEsc(st.q) + '»' : '') + '. Prueba con otra búsqueda o zona.')));
  MOTOS_STATE.currentBack = screenId;
}

/* Usadas: motos usadas en venta en la web, por cercanía (debajo de las de HAY) */
async function loadUsadasWeb(phoneEl) {
  const grid = phoneEl.querySelector('[data-web-usadas-grid]');
  const note = phoneEl.querySelector('[data-web-usadas-note]');
  if (!grid) return;
  const c = motoCenter();
  const key = ['u', c.lat, c.lng].join('|');
  let data = MOTOS_STATE.web.get(key);
  if (!data) {
    data = await apiMotos('usadas', { zona: c.pais ? '' : c.zone || '', lat: c.lat, lng: c.lng });
    if (!data.error) MOTOS_STATE.web.set(key, data);
  }
  if (phoneEl.dataset.currentScreen !== 'home') return;
  MOTOS_STATE.currentBack = 'home';
  if (data.error) { grid.innerHTML = motosMsg(motoEsc(data.error)); return; }
  if (data.configured === false) { grid.innerHTML = notConfiguredMsg(); return; }
  MOTOS_STATE.usadas = data.items || [];
  if (note) note.textContent = MOTOS_STATE.usadas.length ? `${MOTOS_STATE.usadas.length} anuncios · ${c.pais ? 'todo el país' : 'más cerca' + (c.zone ? ' de ' + c.zone : ' de ti') + ' primero'}${data.demo ? ' · datos de ejemplo' : ''}` : '';
  grid.innerHTML = MOTOS_STATE.usadas.length
    ? MOTOS_STATE.usadas.map((w, i) => marketCard(webToMarket(w, i))).join('')
    : motosMsg('No encontramos motos usadas en venta en la web para esta zona.');
}

async function loadDonde(phoneEl) {
  const m = MOTOS_STATE.current;
  const box = phoneEl.querySelector('#motoDonde');
  if (!m || !box) return;
  const c = motoCenter();
  if (!c) { box.innerHTML = needLocMsg(); return; }
  const key = [m.marca || '', c.lat, c.lng].join('|');
  let data = MOTOS_STATE.donde.key === key ? MOTOS_STATE.donde.data : null;
  if (!data) {
    data = await apiMotos('donde', { marca: m.marca || '', lat: c.lat, lng: c.lng });
    if (!data.error) MOTOS_STATE.donde = { key, data };
  }
  if (phoneEl.dataset.currentScreen !== 'moto-nueva' || MOTOS_STATE.current !== m) return;
  if (data.error) { box.innerHTML = motosMsg(motoEsc(data.error)); return; }
  if (data.configured === false) { box.innerHTML = notConfiguredMsg(); return; }
  const list = (data.negocios || []).filter((n) => !m.negocio || n.name !== m.negocio.name).slice(0, 5);
  box.innerHTML = list.length
    ? `<div class="biz-list">${list.map((n) => negocioCard(n)).join('')}</div>`
    : '<p class="motos-msg">No encontramos más concesionarios cerca. Mira la sección <button class="link-btn" data-nav="negocios">Negocios</button>.</p>';
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
  loadNegocios(phoneEl);
}

async function loadNegocios(phoneEl) {
  const st = MOTOS_STATE.negocios;
  const box = phoneEl.querySelector('#negociosList');
  if (!box) return;
  const c = motoCenter();
  if (!c) { box.innerHTML = needLocMsg(); return; }
  const key = [st.tipo, c.lat + ',' + c.lng].join('|');
  if (st.key === key && st.data) return renderNegocios(box, st.data);
  box.innerHTML = '<p class="motos-msg">Buscando negocios…</p>';
  const data = await apiMotos('negocios', { tipo: st.tipo, lat: c.lat, lng: c.lng });
  if (phoneEl.dataset.currentScreen !== 'negocios') return;
  const c2 = motoCenter();
  if ([st.tipo, c2 ? c2.lat + ',' + c2.lng : ''].join('|') !== key) return;
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
    : '<p class="motos-msg">No encontramos negocios en esta zona. Prueba con otra.</p>';
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
