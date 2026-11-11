'use strict';
/* V1.67 — Tiendas y comercios de la web, del país de quien busca.

   Tres fuentes, siempre separadas de lo que publican las personas en HAY:
   1. Google Shopping (vía SerpApi): productos NUEVOS de tiendas en línea
      del país, ordenados del precio más bajo al más alto.
   2. Google Maps (vía SerpApi): comercios cercanos de cualquier tipo
      (comida, teléfonos, zapatos, farmacias…) con dirección, teléfono,
      si está abierto, sitio web y, cuando Google lo tiene, menú o pedidos.
   3. Mercado Libre (opcional): artículos nuevos del país. Solo si se
      configura MELI_ACCESS_TOKEN.

   Configuración en Render: SERPAPI_KEY (obligatoria para 1 y 2) y,
   si se quiere, MELI_ACCESS_TOKEN. Sin claves el buscador sigue
   funcionando solo con lo que hay en HAY. */

const https = require('https');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const MELI_TOKEN = process.env.MELI_ACCESS_TOKEN || '';
const CACHE_MS = 30 * 60 * 1000;

// País → sitio de Mercado Libre y dominio de Google
const PAISES = {
  ve: { meli: 'MLV', google: 'google.co.ve', nombre: 'Venezuela' },
  cl: { meli: 'MLC', google: 'google.cl', nombre: 'Chile' },
  co: { meli: 'MCO', google: 'google.com.co', nombre: 'Colombia' },
  ar: { meli: 'MLA', google: 'google.com.ar', nombre: 'Argentina' },
  mx: { meli: 'MLM', google: 'google.com.mx', nombre: 'México' },
  pe: { meli: 'MPE', google: 'google.com.pe', nombre: 'Perú' },
  ec: { meli: 'MEC', google: 'google.com.ec', nombre: 'Ecuador' },
  uy: { meli: 'MLU', google: 'google.com.uy', nombre: 'Uruguay' },
  pa: { meli: 'MPA', google: 'google.com.pa', nombre: 'Panamá' },
  do: { meli: 'MRD', google: 'google.com.do', nombre: 'República Dominicana' },
  es: { meli: null, google: 'google.es', nombre: 'España' },
  us: { meli: null, google: 'google.com', nombre: 'Estados Unidos' },
};

function getJSON(url, { headers = {}, timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout, headers: { Accept: 'application/json', ...headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; if (body.length > 3e6) req.destroy(new Error('respuesta demasiado grande')); });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('respuesta inválida')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('tiempo de espera agotado')));
    req.on('error', reject);
  });
}

/* País a partir de las coordenadas (OpenStreetMap), con caché por zona. */
const PAIS_CACHE = new Map();
let PAIS_NEXT = 0;
async function paisDe(lat, lng, appVersion) {
  const key = lat.toFixed(1) + ',' + lng.toFixed(1);
  if (PAIS_CACHE.has(key)) return PAIS_CACHE.get(key);
  const wait = Math.max(0, PAIS_NEXT - Date.now());
  PAIS_NEXT = Date.now() + wait + 1100; // máximo 1 consulta por segundo (regla de Nominatim)
  await new Promise((r) => setTimeout(r, wait));
  try {
    const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': `HAY-app/${appVersion} (marketplace; ${process.env.PUBLIC_URL || 'hay-app.onrender.com'})` },
      timeout: 8000,
    });
    const cc = String(((j || {}).address || {}).country_code || '').toLowerCase() || null;
    if (PAIS_CACHE.size > 3000) PAIS_CACHE.clear();
    PAIS_CACHE.set(key, cc);
    return cc;
  } catch (e) {
    return null;
  }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v, n = 200) => (typeof v === 'string' ? v.slice(0, n) : '');
const httpUrl = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v.slice(0, 1000) : '');

async function googleShopping(q, cc) {
  if (!SERPAPI_KEY) return [];
  const p = PAISES[cc] || {};
  const sp = new URLSearchParams({ engine: 'google_shopping', q, hl: 'es', api_key: SERPAPI_KEY, num: '20' });
  if (cc) sp.set('gl', cc);
  if (p.google) sp.set('google_domain', p.google);
  const j = await getJSON('https://serpapi.com/search.json?' + sp);
  return (j.shopping_results || [])
    .filter((r) => !r.second_hand_condition) // solo nuevos: lo usado es de personas
    .map((r) => ({
      source: 'google',
      title: str(r.title, 140),
      price: num(r.extracted_price),
      priceText: str(r.price, 40),
      store: str(r.source, 60),
      link: httpUrl(r.link) || httpUrl(r.product_link),
      thumb: httpUrl(r.thumbnail),
      delivery: str(r.delivery, 60),
    }))
    .filter((r) => r.title && r.link);
}

async function mercadoLibre(q, cc) {
  const site = (PAISES[cc] || {}).meli;
  if (!MELI_TOKEN || !site) return [];
  const sp = new URLSearchParams({ q, condition: 'new', limit: '15' });
  const j = await getJSON(`https://api.mercadolibre.com/sites/${site}/search?${sp}`, { headers: { Authorization: 'Bearer ' + MELI_TOKEN } });
  return (j.results || []).map((r) => ({
    source: 'mercadolibre',
    title: str(r.title, 140),
    price: num(r.price),
    priceText: num(r.price) !== null ? `${r.currency_id || ''} ${Number(r.price).toLocaleString('es')}`.trim() : '',
    store: str((r.seller && r.seller.nickname) || 'Mercado Libre', 60),
    link: httpUrl(r.permalink),
    thumb: httpUrl(r.thumbnail),
    delivery: r.shipping && r.shipping.free_shipping ? 'Envío gratis' : '',
  })).filter((r) => r.title && r.link);
}

function km(aLat, aLng, bLat, bLng) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function googleMaps(q, lat, lng) {
  if (!SERPAPI_KEY) return [];
  const sp = new URLSearchParams({ engine: 'google_maps', type: 'search', q, hl: 'es', ll: `@${lat},${lng},14z`, api_key: SERPAPI_KEY });
  const j = await getJSON('https://serpapi.com/search.json?' + sp);
  return (j.local_results || []).map((r) => {
    const g = r.gps_coordinates || {};
    const d = num(g.latitude) !== null && num(g.longitude) !== null ? km(lat, lng, g.latitude, g.longitude) : null;
    const menu = httpUrl(r.menu && (r.menu.link || r.menu)) || httpUrl(r.order_online) || httpUrl(r.order_online_link);
    return {
      name: str(r.title, 100),
      type: str(r.type, 60),
      address: str(r.address, 160),
      phone: str(r.phone, 40),
      rating: num(r.rating),
      reviews: num(r.reviews),
      priceLevel: str(r.price, 10),
      openState: str(r.open_state, 80),
      website: httpUrl(r.website),
      menu,
      mapsLink: r.place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.place_id)}` : '',
      thumb: httpUrl(r.thumbnail),
      distKm: d !== null ? Math.round(d * 10) / 10 : null,
    };
  }).filter((r) => r.name).sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9)).slice(0, 15);
}

const CACHE = new Map();
async function buscarEnLaWeb({ q, lat, lng, appVersion }) {
  const cc = await paisDe(lat, lng, appVersion);
  const key = [q.toLowerCase(), cc, lat.toFixed(2), lng.toFixed(2)].join('|');
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const settle = (p) => p.then((v) => ({ ok: true, v }), () => ({ ok: false, v: [] }));
  const [gs, ml, gm] = await Promise.all([settle(googleShopping(q, cc)), settle(mercadoLibre(q, cc)), settle(googleMaps(q, lat, lng))]);
  const productos = gs.v.concat(ml.v)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    .slice(0, 24);
  const data = {
    country: cc,
    countryName: (PAISES[cc] || {}).nombre || null,
    productos,
    comercios: gm.v,
    configured: Boolean(SERPAPI_KEY),
    partial: !gs.ok || !gm.ok,
  };
  if (CACHE.size > 500) CACHE.clear();
  CACHE.set(key, { at: Date.now(), data });
  return data;
}

module.exports = { buscarEnLaWeb, configured: () => Boolean(SERPAPI_KEY) };
