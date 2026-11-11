'use strict';
/* V1.66 — Buscador inteligente.

   Entiende frases como «teléfono Samsung Talca nuevo» o «pizza Cumaná»:
   - «nuevo» / «usado» (y variantes) se vuelven el filtro de condición,
     no una palabra que tenga que aparecer en el título;
   - palabras de relleno («de», «barato», «oferta», «busco»…) se ignoran;
   - cada palabra que queda tiene que aparecer (título, categoría o zona),
     pero acepta sinónimos: «teléfono» encuentra «celular», «iPhone»…;
   - la ciudad («Talca», «Cumaná») funciona sola porque la zona de cada
     publicación entra en la búsqueda.
   Con la ubicación de quien busca, los resultados se ordenan por
   cercanía (tu zona → cerca → resto del país) y, dentro de cada grupo,
   del precio más bajo al más alto: las mejores ofertas primero. */

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const NUEVO = ['nuevo', 'nueva', 'nuevos', 'nuevas', 'sellado', 'sellada', 'sellados', 'selladas'];
const USADO = ['usado', 'usada', 'usados', 'usadas', 'seminuevo', 'seminueva', 'segunda'];

const STOP = new Set([
  'de', 'del', 'en', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'con', 'y', 'o', 'para', 'por',
  'que', 'me', 'mi', 'al', 'a', 'se', 'su', 'barato', 'barata', 'baratos', 'baratas', 'economico', 'economica',
  'oferta', 'ofertas', 'mejor', 'mejores', 'precio', 'precios', 'busco', 'buscar', 'quiero', 'necesito',
  'cerca', 'venta', 'vendo', 'mano', 'hay', 'tienda', 'tiendas',
]);

/* Grupos de sinónimos: si la palabra buscada está en un grupo, basta con
   que la publicación contenga cualquiera de las palabras del grupo. */
const SINONIMOS = [
  ['telefono', 'telefonos', 'celular', 'celulares', 'movil', 'moviles', 'smartphone', 'iphone', 'galaxy', 'redmi'],
  ['comida', 'comidas', 'alimentos', 'alimento', 'pizza', 'hamburguesa', 'arepa', 'empanada', 'pollo', 'almuerzo', 'perro caliente', 'cachapa', 'sushi'],
  ['laptop', 'laptops', 'portatil', 'notebook', 'computadora', 'computador', 'pc'],
  ['nevera', 'neveras', 'refrigerador', 'refrigeradora', 'heladera'],
  ['tv', 'televisor', 'televisores', 'television', 'tele', 'smart tv'],
  ['carro', 'carros', 'auto', 'autos', 'vehiculo', 'vehiculos', 'coche'],
  ['moto', 'motos', 'motocicleta'],
  ['zapatos', 'zapato', 'zapatillas', 'tenis', 'calzado'],
  ['bici', 'bicicleta', 'bicicletas'],
];

function grupoDe(w) {
  // plural simple: «celulares» → «celular», «pizzas» → «pizza»
  const cands = [w, w.replace(/es$/, ''), w.replace(/s$/, '')];
  for (const g of SINONIMOS) if (cands.some((c) => g.includes(c))) return g;
  return null;
}

/* Devuelve { terms: [[...alternativas], ...], condition: 'nuevo'|'usado'|null } */
function entender(q) {
  const t = norm(q).replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const out = { terms: [], condition: null };
  if (!t) return out;
  for (const w of t.split(' ')) {
    if (NUEVO.includes(w)) { out.condition = 'nuevo'; continue; }
    if (USADO.includes(w)) { out.condition = 'usado'; continue; }
    if (STOP.has(w) || w.length < 2) continue;
    const g = grupoDe(w);
    out.terms.push(g ? Array.from(new Set([w, ...g])) : [w]);
  }
  return out;
}

/* Valores de «condition» que entran en cada filtro (los de Publicar). */
function condiciones(c) {
  if (c === 'nuevo') return ['Nuevo'];
  if (c === 'usado') return ['Usado', 'Como nuevo'];
  return null;
}

function km(aLat, aLng, bLat, bLng) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const RADIO_ZONA = 15; // km: «tu zona»
const RADIO_CERCA = 150; // km: ciudades cercanas
const RADIO_PAIS = 1500; // km: más lejos ya es otro país (aprox.)

/* Ordena por cercanía y precio. Lo que está a más de RADIO_PAIS se deja
   fuera; lo que no tiene ubicación va al final del último grupo. */
function ordenarPorCercania(items, lat, lng) {
  const conDist = [];
  for (const l of items) {
    const tiene = typeof l.lat === 'number' && typeof l.lng === 'number';
    const d = tiene ? km(lat, lng, l.lat, l.lng) : null;
    if (d !== null && d > RADIO_PAIS) continue;
    const anillo = d === null ? 3 : d <= RADIO_ZONA ? 0 : d <= RADIO_CERCA ? 1 : 2;
    conDist.push({ l, d, anillo });
  }
  conDist.sort((a, b) => a.anillo - b.anillo || (Number(a.l.price) || 0) - (Number(b.l.price) || 0) || (a.d ?? 1e9) - (b.d ?? 1e9));
  return conDist.map((x) => ({ ...x.l, nearby: x.anillo === 3 ? 'pais' : ['zona', 'cerca', 'pais'][x.anillo] }));
}

module.exports = { entender, condiciones, ordenarPorCercania, norm };
