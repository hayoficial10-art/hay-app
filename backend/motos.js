'use strict';
/* V2.0 — HAY Motos: búsqueda AUTOMÁTICA en la web de motos nuevas y de
   negocios de motos del país (concesionarios, repuestos, talleres).

   - Nuevas:   Google Shopping (vía SerpApi), solo artículos nuevos y que
               parezcan motos (se quitan cascos, aceites, repuestos…).
   - Negocios: Google Maps (vía SerpApi), cerca de quien busca o en la
               ciudad que escriba (para buscar en todo el país).
   - Dónde comprar una moto: concesionarios de esa marca cerca de ti.

   Más adelante los negocios se podrán suscribir para mostrar más cosas;
   por ahora todo sale solo de la web.

   Configuración en Render: SERPAPI_KEY (la misma de V1.67).
   Para probar SIN clave en una computadora: MOTOS_DEMO=1 (datos de
   ejemplo; nunca activarlo en el servidor real). */

const t = require('./tiendas');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const DEMO = process.env.MOTOS_DEMO === '1' && process.env.NODE_ENV !== 'production';
const CACHE_MS = 60 * 60 * 1000;

/* Marcas que se reconocen en el título para buscar concesionarios. */
const MARCAS = [
  'bera', 'empire', 'keeway', 'yamaha', 'suzuki', 'honda', 'kawasaki', 'haojue', 'skygo', 'md', 'lifan',
  'zontes', 'benelli', 'tvs', 'bajaj', 'ktm', 'vespa', 'italika', 'akt', 'hero', 'jialing', 'owen',
  'toro', 'um', 'vento', 'qjmotor', 'cfmoto', 'voge', 'royal enfield', 'ducati', 'bmw', 'harley',
  'piaggio', 'sym', 'kymco', 'loncin', 'zongshen', 'dayun', 'tauro', 'kavak', 'rkv', 'jaguar', 'speed',
];

/* Tipos de moto (chips de «Nuevas») → palabras que se agregan a la búsqueda. */
const TIPOS = {
  scooter: 'scooter',
  paseo: 'de paseo',
  deportiva: 'deportiva',
  'doble-proposito': 'doble propósito enduro',
  trabajo: 'de trabajo carga',
  electrica: 'eléctrica',
};

/* Tipos de negocio (chips de «Negocios») → lo que se busca en Google Maps. */
const NEGOCIOS = {
  venta: 'concesionario de motos',
  repuestos: 'repuestos de motos',
  talleres: 'taller de motos',
  accesorios: 'accesorios para motos cascos',
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lo que NO es una moto aunque salga buscando «moto»
const NO_MOTO = /\b(casco|cascos|guante|guantes|aceite|lubricante|repuesto|repuestos|caucho|cauchos|llanta|llantas|neumatico|bateria|pastilla|pastillas|cadena|kit|filtro|bujia|espejo|forro|funda|chaqueta|impermeable|juguete|juguetes|nino|ninos|infantil|montable|escala|coleccion|calcomania|sticker|soporte|alarma|candado|maleta|baul|faro|bombillo)\b/;

function marcaDe(title) {
  const n = ' ' + norm(title).replace(/[^a-z0-9 ]/g, ' ') + ' ';
  for (const m of MARCAS) if (n.includes(' ' + m + ' ')) return m;
  return null;
}
const titulo = (m) => (m ? m.replace(/\b\w/g, (c) => c.toUpperCase()) : null);

function cc(title) {
  const m = /(\d{2,4})\s*(cc|c\.c\.)/i.exec(title || '') || /\b(100|110|115|125|135|150|155|160|180|200|250|300|400|500|650|750|1000)\b/.exec(title || '');
  return m ? Number(m[1]) : null;
}

const CACHE = new Map();
function cached(key, fn, ttl = CACHE_MS) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  return fn().then((data) => {
    if (CACHE.size > 800) CACHE.clear();
    CACHE.set(key, { at: Date.now(), data });
    return data;
  });
}

async function shopping(q, cc2) {
  const p = t.PAISES[cc2] || {};
  const sp = new URLSearchParams({ engine: 'google_shopping', q, hl: 'es', api_key: SERPAPI_KEY, num: '40' });
  if (cc2) sp.set('gl', cc2);
  if (p.google) sp.set('google_domain', p.google);
  const j = await t.getJSON('https://serpapi.com/search.json?' + sp);
  return (j.shopping_results || []).filter((r) => !r.second_hand_condition);
}

/* Google Imágenes: sirve en Venezuela (Google Shopping no). Sin precio ni
   ubicación; se intenta unir con un negocio cercano por el nombre del sitio. */
async function imagenes(q, cc2) {
  const p = t.PAISES[cc2] || {};
  const sp = new URLSearchParams({ engine: 'google_images', q, hl: 'es', api_key: SERPAPI_KEY });
  if (cc2) sp.set('gl', cc2);
  if (p.google) sp.set('google_domain', p.google);
  const j = await t.getJSON('https://serpapi.com/search.json?' + sp);
  return j.images_results || [];
}

/* Fotos de Google Maps de un negocio (24 h en caché: cambian poco). */
function fotosDe(dataId) {
  if (!/^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(String(dataId || ''))) return Promise.resolve([]);
  return cached('f|' + dataId, async () => {
    const sp = new URLSearchParams({ engine: 'google_maps_photos', data_id: dataId, hl: 'es', api_key: SERPAPI_KEY });
    const j = await t.getJSON('https://serpapi.com/search.json?' + sp);
    return (j.photos || [])
      .map((ph) => ({ thumb: t.httpUrl(ph.thumbnail), image: t.httpUrl(ph.image) || t.httpUrl(ph.thumbnail) }))
      .filter((ph) => ph.image)
      .slice(0, 24);
  }, 24 * 60 * 60 * 1000);
}

async function maps(q, { lat, lng, zoom = 12 } = {}) {
  const sp = new URLSearchParams({ engine: 'google_maps', type: 'search', q, hl: 'es', api_key: SERPAPI_KEY });
  if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) sp.set('ll', `@${lat},${lng},${zoom}z`);
  const j = await t.getJSON('https://serpapi.com/search.json?' + sp);
  return (j.local_results || []).map((r) => {
    const g = r.gps_coordinates || {};
    const blat = t.num(g.latitude);
    const blng = t.num(g.longitude);
    const d = lat !== null && lat !== undefined && blat !== null && blng !== null ? t.km(lat, lng, blat, blng) : null;
    return {
      name: t.str(r.title, 100),
      type: t.str(r.type, 60),
      address: t.str(r.address, 160),
      phone: t.str(r.phone, 40),
      rating: t.num(r.rating),
      reviews: t.num(r.reviews),
      openState: t.str(r.open_state, 80),
      website: t.httpUrl(r.website),
      mapsLink: r.place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.place_id)}` : '',
      thumb: t.httpUrl(r.thumbnail),
      dataId: /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(r.data_id || '') ? r.data_id : null, // para pedir sus fotos
      lat: blat,
      lng: blng,
      distKm: d !== null ? Math.round(d * 10) / 10 : null,
      source: 'web',
    };
  }).filter((r) => r.name);
}

const sortByDist = (list) => list.sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9));

/* ------------------- Catálogo automático (Nuevas / Repuestos) -------------------
   1. Google Shopping: artículos NUEVOS de tiendas del país, solo con foto real.
   2. Google Maps: negocios de ese rubro cerca del punto elegido (tu GPS o la
      zona/estado que eligió la persona).
   3. Cada artículo se une a su negocio por el nombre de la tienda: así se sabe
      dónde está y a cuántos km. Se ordena por cercanía; los que no se pudo
      ubicar quedan al final como «ubicación sin confirmar».
   Sin preferencia por ningún negocio: solo cuenta la cercanía. */
const RUBROS = {
  motos: { shop: (q, tipo) => ['moto', TIPOS[tipo] || '', q, 'nueva'], maps: (q) => `concesionario de motos ${q}`.trim(), excluir: NO_MOTO },
  repuestos: { shop: (q) => ['repuestos accesorios moto', q], maps: () => 'repuestos y accesorios para motos', excluir: /\b(juguete|juguetes|montable|escala)\b/ },
};

const nombreClave = (s) => norm(s).replace(/\b(c\.?a\.?|s\.?a\.?|motos?|tienda|store|oficial|venezuela|de|la|el|los|las)\b/g, ' ').replace(/[^a-z0-9]/g, '');

function unirConNegocio(item, negocios) {
  const k = nombreClave(item.store);
  if (k.length < 3) return null;
  return negocios.find((n) => { const nk = nombreClave(n.name); return nk.length >= 3 && (nk.includes(k) || k.includes(nk)); }) || null;
}

async function catalogo({ rubro = 'motos', q = '', tipo = '', lat, lng, appVersion }) {
  if (DEMO) return demoCatalogo(rubro, q, lat, lng);
  if (!SERPAPI_KEY) return { configured: false, items: [] };
  const R = RUBROS[rubro] || RUBROS.motos;
  const pais = await t.paisDe(lat, lng, appVersion);
  const query = R.shop(q, tipo).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const key = ['c', rubro, norm(query), pais, lat.toFixed(1), lng.toFixed(1)].join('|');
  return cached(key, async () => {
    const settle = (p) => p.then((v) => v, () => []);
    // Google Shopping no funciona en Venezuela: ahí no se gasta esa búsqueda
    const [raw, negocios] = await Promise.all([pais === 've' ? Promise.resolve([]) : settle(shopping(query, pais)), settle(maps(R.maps(rubro === 'motos' ? (marcaDe(q) || '') : ''), { lat, lng, zoom: 9 }))]);
    const items = raw
      .filter((r) => r.title && t.httpUrl(r.thumbnail) && !R.excluir.test(norm(r.title))) // solo con foto real
      .map((r) => {
        const marca = marcaDe(r.title);
        const it = {
          id: 'w' + Buffer.from(String(r.product_id || r.title)).toString('base64url').slice(0, 24),
          title: t.str(r.title, 140),
          marca: titulo(marca),
          cc: rubro === 'motos' ? cc(r.title) : null,
          price: t.num(r.extracted_price),
          priceText: t.str(r.price, 40),
          store: t.str(r.source, 60),
          link: t.httpUrl(r.link) || t.httpUrl(r.product_link),
          thumb: t.httpUrl(r.thumbnail),
          photos: [t.httpUrl(r.thumbnail)].concat((r.thumbnails || []).map(t.httpUrl)).filter(Boolean).slice(0, 6),
          delivery: t.str(r.delivery, 60),
          source: 'web',
          negocio: null,
          distKm: null,
        };
        const n = unirConNegocio(it, negocios);
        if (n) { it.negocio = n; it.distKm = n.distKm; }
        return it;
      })
      .filter((m) => m.link);
    const fuentes = { shopping: items.length, imagenes: 0, negocios: 0 };

    // En Venezuela Google Shopping casi no tiene resultados: se completa con
    // (1) fotos reales de los negocios más cercanos (Google Maps) y
    // (2) Google Imágenes de motos nuevas del país.
    if (items.length < 8) {
      const cercanos = negocios.filter((n) => n.dataId).sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9)).slice(0, 3);
      const imgQ = (rubro === 'motos' ? ['moto', TIPOS[tipo] || '', q || '', 'nueva precio'] : ['repuestos moto', q || '']).concat((t.PAISES[pais] || {}).nombre || 'Venezuela').filter(Boolean).join(' ');
      const [imgs, fotosNeg] = await Promise.all([
        settle(imagenes(imgQ, pais)),
        Promise.all(cercanos.map((n) => fotosDe(n.dataId).then((f) => ({ n, f }), () => ({ n, f: [] })))),
      ]);
      for (const { n, f } of fotosNeg) {
        f.slice(0, 4).forEach((ph, i) => {
          items.push({
            id: 'g' + Buffer.from(n.dataId + i).toString('base64url').slice(0, 24), kind: 'foto-negocio',
            title: n.name, marca: titulo(marcaDe(q) || null), cc: null, price: null, priceText: '',
            store: n.type || 'Negocio', link: n.mapsLink, thumb: ph.thumb || ph.image, photos: f.slice(0, 8).map((x) => x.image),
            delivery: '', source: 'web', negocio: n, distKm: n.distKm,
          });
          fuentes.negocios++;
        });
      }
      const vistos = new Set();
      for (const r of imgs) {
        const title = t.str(r.title, 140);
        const thumb = t.httpUrl(r.thumbnail);
        const link = t.httpUrl(r.link);
        if (!title || !thumb || !link || R.excluir.test(norm(title)) || vistos.has(link)) continue;
        if (rubro === 'motos' && !/\b(moto|motos|motocicleta|scooter)\b/.test(norm(title)) && !marcaDe(title)) continue;
        vistos.add(link);
        const it = {
          id: 'i' + Buffer.from(link).toString('base64url').slice(-24), kind: 'imagen',
          title, marca: titulo(marcaDe(title)), cc: rubro === 'motos' ? cc(title) : null, price: null, priceText: '',
          store: t.str(r.source, 60), link, thumb, photos: [t.httpUrl(r.original) || thumb], delivery: '', source: 'web', negocio: null, distKm: null,
        };
        const n = unirConNegocio(it, negocios);
        if (n) { it.negocio = n; it.distKm = n.distKm; }
        items.push(it);
        fuentes.imagenes++;
        if (fuentes.imagenes >= 24) break;
      }
    }
    // más cerca primero; sin ubicación al final (y entre ellos, el más barato primero)
    items.sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9) || (a.price ?? Infinity) - (b.price ?? Infinity));
    return { configured: true, country: pais, countryName: (t.PAISES[pais] || {}).nombre || null, fuentes, items: items.slice(0, 48) };
  });
}

/* ------------------------------ Negocios ------------------------------ */
async function negocios({ tipo = 'venta', ciudad = '', lat, lng, appVersion }) {
  if (DEMO) return demoNegocios(tipo, ciudad, lat, lng);
  if (!SERPAPI_KEY) return { configured: false, negocios: [] };
  const base = NEGOCIOS[tipo] || NEGOCIOS.venta;
  const pais = lat !== null && lat !== undefined ? await t.paisDe(lat, lng, appVersion) : null;
  const paisNombre = (t.PAISES[pais] || {}).nombre || 'Venezuela'; // sin ubicación: Venezuela
  const c = String(ciudad || '').trim().slice(0, 60);
  // Con ciudad: se busca en esa ciudad (todo el país). Sin ciudad: cerca de ti.
  const q = c ? `${base} en ${c}${paisNombre ? ', ' + paisNombre : ''}` : base;
  return cached(['g', norm(q), c || lat === null || lat === undefined ? '' : `${lat.toFixed(2)},${lng.toFixed(2)}`].join('|'), async () => {
    const list = await maps(q, c ? { lat: null, lng: null } : { lat, lng, zoom: 12 });
    // la distancia igual se calcula si tenemos tu ubicación
    if (c && lat !== null && lat !== undefined) {
      for (const n of list) if (n.lat !== null && n.lng !== null) n.distKm = Math.round(t.km(lat, lng, n.lat, n.lng) * 10) / 10;
    }
    return { configured: true, country: pais, ciudad: c || null, negocios: c ? list.slice(0, 20) : sortByDist(list).slice(0, 20) };
  });
}

/* ---------------- Dónde comprar una moto nueva (por marca) ---------------- */
async function donde({ marca = '', lat, lng, appVersion }) {
  if (DEMO) return demoNegocios('venta', '', lat, lng, marca);
  if (!SERPAPI_KEY) return { configured: false, negocios: [] };
  const m = String(marca || '').trim().slice(0, 40);
  const q = m ? `concesionario motos ${m}` : NEGOCIOS.venta;
  return cached(['d', norm(q), lat.toFixed(2), lng.toFixed(2)].join('|'), async () => {
    const list = await maps(q, { lat, lng, zoom: 11 });
    return { configured: true, marca: m || null, negocios: sortByDist(list).slice(0, 10) };
  });
}

/* ------------------- Motos USADAS en venta en la web -------------------
   Google Imágenes (sirve en Venezuela) con «moto usada en venta» + la zona.
   De cada anuncio se toma la foto real, el título, el sitio y el enlace al
   anuncio original. Si el título nombra una ciudad, se calcula la distancia;
   si trae precio ($ / USD), se muestra. No se copian como publicaciones de
   HAY: siempre llevan al anuncio original. */
const CIUDADES_VE = [
  ['caracas', 10.48, -66.9], ['petare', 10.48, -66.81], ['catia', 10.51, -66.94], ['maracaibo', 10.64, -71.61], ['valencia', 10.16, -68.0],
  ['barquisimeto', 10.07, -69.35], ['maracay', 10.25, -67.6], ['puerto ordaz', 8.29, -62.73], ['ciudad guayana', 8.29, -62.73], ['san félix', 8.37, -62.65],
  ['ciudad bolívar', 8.12, -63.55], ['maturín', 9.75, -63.18], ['barcelona', 10.13, -64.69], ['puerto la cruz', 10.21, -64.63], ['lechería', 10.19, -64.69],
  ['el tigre', 8.89, -64.25], ['anaco', 9.44, -64.47], ['cumaná', 10.46, -64.17], ['carúpano', 10.67, -63.25], ['cumanacoa', 10.25, -63.92],
  ['porlamar', 10.96, -63.85], ['margarita', 11.0, -63.9], ['mérida', 8.59, -71.16], ['san cristóbal', 7.77, -72.23], ['barinas', 8.62, -70.21],
  ['valera', 9.32, -70.6], ['coro', 11.4, -69.67], ['punto fijo', 11.7, -70.2], ['acarigua', 9.56, -69.2], ['guanare', 9.04, -69.74],
  ['san juan de los morros', 9.91, -67.35], ['calabozo', 8.92, -67.43], ['los teques', 10.34, -67.04], ['guarenas', 10.47, -66.61], ['guatire', 10.47, -66.54],
  ['charallave', 10.24, -66.86], ['cabimas', 10.4, -71.45], ['ciudad ojeda', 10.2, -71.31], ['san fernando de apure', 7.89, -67.47], ['tucupita', 9.06, -62.05],
  ['puerto ayacucho', 5.66, -67.62], ['san felipe', 10.34, -68.74], ['san carlos', 9.66, -68.58], ['la guaira', 10.6, -66.93], ['puerto cabello', 10.47, -68.01],
  ['anzoátegui', 10.21, -64.63], ['monagas', 9.75, -63.18], ['sucre', 10.46, -64.17], ['carabobo', 10.16, -68.0], ['aragua', 10.25, -67.6], ['lara', 10.07, -69.35],
  ['zulia', 10.64, -71.61], ['táchira', 7.77, -72.23], ['bolívar', 8.29, -62.73], ['falcón', 11.4, -69.67], ['portuguesa', 9.56, -69.2], ['miranda', 10.34, -67.04],
  ['guárico', 9.91, -67.35], ['nueva esparta', 10.96, -63.85], ['trujillo', 9.32, -70.6], ['yaracuy', 10.34, -68.74], ['cojedes', 9.66, -68.58],
].sort((a, b) => b[0].length - a[0].length);
const titleCase = (x) => x.replace(/\b\w/g, (c) => c.toUpperCase());
function ciudadDe(texto) {
  const n = ' ' + norm(texto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (const c of CIUDADES_VE) if (n.includes(' ' + norm(c[0]) + ' ')) return { nombre: titleCase(c[0]), lat: c[1], lng: c[2] };
  return null;
}
function precioDe(texto) {
  const m = /(?:\$|usd|us\$)\s?(\d{1,3}(?:[.,]\d{3})+|\d{3,5})|(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s?(?:\$|usd|dolares|dólares)/i.exec(texto || '');
  if (!m) return null;
  const n = Number(String(m[1] || m[2]).replace(/[.,]/g, ''));
  return n >= 100 && n <= 30000 ? n : null;
}

async function usadas({ q = '', zona = '', lat, lng, appVersion }) {
  if (DEMO) return demoCatalogo('motos', q, lat, lng).then((d) => ({ ...d, items: d.items.map((x) => ({ ...x, kind: 'usada' })) }));
  if (!SERPAPI_KEY) return { configured: false, items: [] };
  const pais = await t.paisDe(lat, lng, appVersion);
  const z = String(zona || '').replace(/\(.*?\)/g, '').trim().slice(0, 60);
  const query = ['moto', q, 'usada en venta', z, (t.PAISES[pais] || {}).nombre || 'Venezuela'].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  return cached(['u', norm(query), lat.toFixed(1), lng.toFixed(1)].join('|'), async () => {
    const imgs = await imagenes(query, pais);
    const vistos = new Set();
    const items = [];
    for (const r of imgs) {
      const title = t.str(r.title, 140);
      const thumb = t.httpUrl(r.thumbnail);
      const link = t.httpUrl(r.link);
      if (!title || !thumb || !link || vistos.has(link) || NO_MOTO.test(norm(title))) continue;
      if (!/\b(moto|motos|motocicleta|scooter)\b/.test(norm(title)) && !marcaDe(title)) continue;
      vistos.add(link);
      const c = ciudadDe(title + ' ' + (r.source || ''));
      const price = precioDe(title);
      items.push({
        id: 'u' + Buffer.from(link).toString('base64url').slice(-24), kind: 'usada',
        title, marca: titulo(marcaDe(title)), cc: cc(title), price, priceText: price ? '$' + price.toLocaleString('en-US') : '',
        store: t.str(r.source, 60), link, thumb, photos: [t.httpUrl(r.original) || thumb], delivery: '', source: 'web',
        negocio: null, place: c ? c.nombre : '', distKm: c ? Math.round(t.km(lat, lng, c.lat, c.lng) * 10) / 10 : null,
      });
      if (items.length >= 36) break;
    }
    items.sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9));
    return { configured: true, country: pais, items };
  });
}

/* ------------- Fotos de un negocio (las de Google Maps) ------------- */
async function fotos({ dataId }) {
  if (DEMO) return { configured: true, demo: true, fotos: [] };
  if (!SERPAPI_KEY) return { configured: false, fotos: [] };
  return { configured: true, fotos: await fotosDe(dataId) };
}

/* ------------- Datos de ejemplo (solo para probar, MOTOS_DEMO=1) ------------- */
function demoCatalogo(rubro, q, lat, lng) {
  const base = rubro === 'repuestos'
    ? [['Casco integral LS2 certificado', 85, 'Cascos y Más', 2.1], ['Kit de arrastre Bera 150', 32, 'Repuestos La Moto', 4.5], ['Batería 12V 7Ah para moto', 28, 'Todo Moto Repuestos', null], ['Caucho 90/90-18 trasero', 45, 'MotoPartes Petare', 9.8]]
    : [['Bera SBR 150cc 2026', 1450, 'Bera Motos Oficial', 1.2], ['Empire Keeway Horse II 150', 1390, 'Empire Keeway Los Ruices', 5.8], ['Yamaha YBR 125 Z 2026', 2350, 'Yamaha Venezuela', null], ['Bera León 200 2026', 1890, 'MotoCentro Caracas', 3.5], ['Haojue DK 150', 1650, 'Motos El Llanito', 8.1], ['Skygo Wind 150 scooter', 1290, 'Skygo Puerto La Cruz', 245], ['Suzuki GN 125 F', 2100, 'Suzuki Motos Cumaná', 330]];
  const n = norm(q).split(' ').filter(Boolean);
  const pic = (i) => `/assets/demo/moto-${(i % 4) + 1}.svg`;
  const items = base
    .filter(([title]) => n.every((w) => norm(title).includes(w)))
    .map(([title, price, store, d], i) => ({
      id: 'demo' + rubro + i, title, marca: titulo(marcaDe(title)), cc: cc(title), price, priceText: '$' + price.toLocaleString('en-US'), store,
      link: 'https://example.com/item-' + i, thumb: pic(i), photos: [pic(i)], delivery: '', source: 'web', distKm: d,
      negocio: d === null ? null : { name: store, type: rubro === 'repuestos' ? 'Tienda de repuestos' : 'Concesionario de motos', address: 'Av. Principal ' + (i + 1) + ', ' + (['Caracas', 'Petare', 'Los Teques', 'Puerto La Cruz', 'Cumaná'][i % 5]) + ', Venezuela', phone: '0412-555' + (1000 + i), rating: 4.3, reviews: 25, openState: 'Abierto', website: '', mapsLink: 'https://www.google.com/maps', thumb: '', dataId: null, lat: (lat ?? 10.49) + 0.01 * i, lng: (lng ?? -66.88) + 0.01 * i, distKm: d },
    }))
    .sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9));
  return Promise.resolve({ configured: true, demo: true, country: 've', countryName: 'Venezuela', items });
}

function demoNegocios(tipo, ciudad, lat, lng, marca) {
  const base = lat ?? 10.49;
  const baseLng = lng ?? -66.88;
  const nombres = {
    venta: ['MotoCentro Caracas', 'Bera Motos Oficial', 'Empire Keeway Los Ruices', 'Motos El Llanito'],
    repuestos: ['Repuestos La Moto', 'Todo Moto Repuestos', 'MotoPartes Petare'],
    talleres: ['Taller El Pistón', 'Moto Servicio Express', 'Taller Hermanos Pérez'],
    accesorios: ['Cascos y Más', 'Moto Accesorios VZLA'],
  }[tipo] || [];
  const negocios = nombres.map((name, i) => ({
    name: marca ? `${name} (${marca})` : name,
    type: { venta: 'Concesionario de motos', repuestos: 'Tienda de repuestos', talleres: 'Taller de motos', accesorios: 'Tienda de accesorios' }[tipo],
    address: `Av. Principal ${i + 1}, ${ciudad || 'Caracas'}`,
    phone: '+58 412-555-01' + (10 + i),
    rating: 4 + (i % 10) / 10, reviews: 20 + i * 13, openState: i % 2 ? 'Cerrado · Abre a las 8:00' : 'Abierto · Cierra a las 6:00 p. m.',
    website: i === 0 ? 'https://example.com' : '', mapsLink: 'https://www.google.com/maps', thumb: '', dataId: '0x8c2a58:0x' + (100 + i),
    lat: base + 0.01 * (i + 1), lng: baseLng + 0.012 * (i + 1), distKm: Math.round((1.2 + i * 2.3) * 10) / 10, source: 'web',
  }));
  return Promise.resolve({ configured: true, demo: true, ciudad: ciudad || null, marca: marca || null, negocios });
}

module.exports = { catalogo, usadas, negocios, donde, fotos, marcaDe, configured: () => DEMO || Boolean(SERPAPI_KEY), TIPOS, NEGOCIOS };
