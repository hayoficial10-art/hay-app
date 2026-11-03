/* store.js — capa de datos de HAY (V1.29)
 *
 * Toda la app lee y escribe datos SOLO a través de este archivo. Hay
 * dos motores con exactamente las mismas funciones:
 *
 *   - PostgreSQL (si existe la variable DATABASE_URL): el de producción.
 *     Cada operación toca solo las filas necesarias, con índices, así
 *     que funciona igual con 100 o con millones de publicaciones, y
 *     permite correr varios servidores a la vez.
 *   - Archivos JSON (si NO hay DATABASE_URL): para correr HAY en una PC
 *     sin instalar nada. Los datos viven en memoria y se guardan en
 *     disco de forma segura (archivo temporal + renombrar), así un corte
 *     de luz no deja un archivo a medio escribir. Pensado para pruebas y
 *     arranques chicos, no para millones.
 *
 * Todas las funciones son async.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createPool } = require('./pg');

// ---------------------------------------------------------------------
// Utilidades comunes
// ---------------------------------------------------------------------
const PREFIX = { listings: 'p', users: 'u', messages: 'm', ratings: 'r', reports: 'rep', emergency_numbers: 'e' };

function encodeCursor(item) {
  return Buffer.from(`${item.createdAt}|${item.id}`).toString('base64url');
}
function decodeCursor(c) {
  try {
    const [createdAt, id] = Buffer.from(String(c), 'base64url').toString().split('|');
    if (!createdAt || !id || isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id };
  } catch (e) {
    return null;
  }
}
// Orden del feed: más nuevo primero; a igual fecha, id descendente
function feedCompare(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isActive = (l) => !l.status || l.status === 'active';

// ---------------------------------------------------------------------
// Motor 1: archivos JSON (desarrollo / PC)
// ---------------------------------------------------------------------
function createJsonStore({ dataDir, seedListings, seedEmergency }) {
  const FILES = {
    listings: 'listings.json',
    users: 'users.json',
    messages: 'messages.json',
    ratings: 'ratings.json',
    reports: 'reports.json',
    emergency_numbers: 'emergency-numbers.json',
    sessions: 'sessions.json',
    reset_tokens: 'reset-tokens.json',
    counters: 'counters.json',
  };
  const IDENTITY_DIR = path.join(dataDir, 'identity');
  const data = {};
  const pending = new Set();
  let flushTimer = null;

  function load(name, fallback) {
    const file = path.join(dataDir, FILES[name]);
    if (!fs.existsSync(file)) return fallback();
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      console.error(`[HAY store] ${FILES[name]} dañado (${e.message}). Se guarda una copia y se sigue sin perder el archivo.`);
      try { fs.copyFileSync(file, file + '.danado-' + Date.now()); } catch (e2) {}
      return fallback();
    }
  }
  function writeNow(name) {
    const file = path.join(dataDir, FILES[name]);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data[name], null, name === 'sessions' ? 0 : 2), 'utf-8');
    fs.renameSync(tmp, file); // atómico: nunca queda un archivo a medias
  }
  function markDirty(name) {
    pending.add(name);
    if (!flushTimer) flushTimer = setTimeout(flush, 30);
  }
  function flush() {
    flushTimer = null;
    for (const name of pending) {
      try { writeNow(name); } catch (e) { console.error('[HAY store] No se pudo guardar', name, e.message); }
    }
    pending.clear();
  }

  // Contador persistente por colección: nunca reutiliza un número, aunque
  // se borre la última publicación (evita que chats o calificaciones
  // viejas queden pegadas a una publicación nueva con el mismo id).
  function nextId(coll) {
    let max = data.counters[coll] || 0;
    for (const x of data[coll]) {
      const n = Number(String(x.id).replace(/[^0-9]/g, ''));
      if (!Number.isNaN(n) && n > max) max = n;
    }
    data.counters[coll] = max + 1;
    markDirty('counters');
    return PREFIX[coll] + (max + 1);
  }
  const byId = (coll, id) => data[coll].find((x) => x.id === id) || null;
  const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);

  function insert(coll, obj) {
    const item = { ...obj, id: obj.id || nextId(coll) };
    data[coll].push(item);
    markDirty(coll);
    return clone(item);
  }
  function update(coll, id, obj) {
    const i = data[coll].findIndex((x) => x.id === id);
    if (i === -1) return null;
    data[coll][i] = { ...obj, id };
    markDirty(coll);
    return clone(data[coll][i]);
  }
  function remove(coll, id) {
    const before = data[coll].length;
    data[coll] = data[coll].filter((x) => x.id !== id);
    if (data[coll].length !== before) markDirty(coll);
    return data[coll].length !== before;
  }

  const store = {
    kind: 'json',
    async init() {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      data.listings = load('listings', () => clone(seedListings));
      data.users = load('users', () => []);
      data.messages = load('messages', () => []);
      data.ratings = load('ratings', () => []);
      data.reports = load('reports', () => []);
      data.emergency_numbers = load('emergency_numbers', () => clone(seedEmergency));
      // sesiones: en v1.27/1.28 era un objeto { token: {userId, createdAt} }
      data.sessions = load('sessions', () => ({}));
      data.reset_tokens = load('reset_tokens', () => ({}));
      data.counters = load('counters', () => ({}));
      for (const name of ['listings', 'emergency_numbers']) {
        if (!fs.existsSync(path.join(dataDir, FILES[name]))) writeNow(name);
      }
      process.on('exit', flush);
    },
    async close() {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
    },
    flush,

    listings: {
      async get(id) { return clone(byId('listings', id)); },
      async insert(l) { return insert('listings', l); },
      async update(id, l) { return update('listings', id, l); },
      async remove(id) { return remove('listings', id); },
      async count() { return data.listings.length; },
      async bySeller(sellerId) {
        return clone(data.listings.filter((l) => l.sellerId === sellerId).sort(feedCompare));
      },
      async activeBySeller(sellerId, limit = 20) {
        return clone(data.listings.filter((l) => l.sellerId === sellerId && isActive(l)).sort(feedCompare).slice(0, limit));
      },
      async removeBySeller(sellerId) {
        const gone = data.listings.filter((l) => l.sellerId === sellerId);
        data.listings = data.listings.filter((l) => l.sellerId !== sellerId);
        markDirty('listings');
        return clone(gone);
      },
      async titles(ids) {
        const set = new Set(ids);
        const out = {};
        for (const l of data.listings) if (set.has(l.id)) out[l.id] = l.title;
        return out;
      },
      async feed({ category, sellerType, q, sellerId, limit = 20, cursor } = {}) {
        let list = data.listings.filter(isActive);
        if (category) list = list.filter((l) => l.category === category);
        if (sellerType) list = list.filter((l) => (l.sellerType || 'persona') === sellerType);
        if (sellerId) list = list.filter((l) => l.sellerId === sellerId);
        if (q) {
          const nq = norm(q);
          list = list.filter((l) => norm(l.title).includes(nq) || norm(l.category).includes(nq) || norm(l.zone).includes(nq));
        }
        list.sort(feedCompare);
        const c = cursor ? decodeCursor(cursor) : null;
        if (c) list = list.filter((l) => feedCompare(l, c) > 0);
        const page = list.slice(0, limit);
        return { items: clone(page), nextCursor: list.length > limit ? encodeCursor(page[page.length - 1]) : null };
      },
    },

    users: {
      async get(id) { return clone(byId('users', id)); },
      async byEmail(email) { return clone(data.users.find((u) => u.email === email) || null); },
      async count() { return data.users.length; },
      async insert(u) { return insert('users', u); },
      async update(id, u) { return update('users', id, u); },
      async emails(ids) {
        const set = new Set(ids);
        const out = {};
        for (const u of data.users) if (set.has(u.id)) out[u.id] = u.email;
        return out;
      },
      async withIdentity() {
        return clone(data.users.filter((u) => u.identity && u.identity.status));
      },
      async remove(id) { return remove('users', id); },
    },

    sessions: {
      async create(token, userId, createdAt) { data.sessions[token] = { userId, createdAt }; markDirty('sessions'); },
      async get(token) { return data.sessions[token] || null; },
      async remove(token) { if (data.sessions[token]) { delete data.sessions[token]; markDirty('sessions'); } },
      async removeByUser(userId) {
        for (const [t, s] of Object.entries(data.sessions)) if (s.userId === userId) delete data.sessions[t];
        markDirty('sessions');
      },
      async purgeOlderThan(isoDate) {
        for (const [t, s] of Object.entries(data.sessions)) if (s.createdAt < isoDate) delete data.sessions[t];
        markDirty('sessions');
      },
    },

    resetTokens: {
      async create(token, userId, expiresAt) { data.reset_tokens[token] = { userId, expiresAt }; markDirty('reset_tokens'); },
      async get(token) { return data.reset_tokens[token] || null; },
      async remove(token) { delete data.reset_tokens[token]; markDirty('reset_tokens'); },
    },

    messages: {
      async get(id) { return clone(byId('messages', id)); },
      async insert(m) { return insert('messages', m); },
      async update(id, m) { return update('messages', id, m); },
      async byThread(threadId, afterIso) {
        return clone(
          data.messages
            .filter((m) => m.threadId === threadId && (!afterIso || m.createdAt > afterIso))
            .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
        );
      },
      // Último mensaje de cada conversación en la que participa el usuario
      async lastPerThread(userId) {
        const last = new Map();
        for (const m of data.messages) {
          if (m.fromUserId !== userId && m.toUserId !== userId) continue;
          const prev = last.get(m.threadId);
          if (!prev || m.createdAt > prev.createdAt) last.set(m.threadId, m);
        }
        return clone(Array.from(last.values()));
      },
    },

    ratings: {
      async insert(r) {
        if (data.ratings.some((x) => x.listingId === r.listingId && x.fromUserId === r.fromUserId)) {
          const e = new Error('duplicada');
          e.code = 'DUPLICATE';
          throw e;
        }
        return insert('ratings', r);
      },
      async exists(listingId, fromUserId) {
        return data.ratings.some((x) => x.listingId === listingId && x.fromUserId === fromUserId);
      },
      async forUser(toUserId) {
        return clone(data.ratings.filter((r) => r.toUserId === toUserId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
      },
    },

    reports: {
      async get(id) { return clone(byId('reports', id)); },
      async insert(r) { return insert('reports', r); },
      async update(id, r) { return update('reports', id, r); },
      async all() { return clone(data.reports.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))); },
    },

    emergency: {
      async all() { return clone(data.emergency_numbers); },
      async get(id) { return clone(byId('emergency_numbers', id)); },
      async insert(n) { return insert('emergency_numbers', n); },
      async update(id, n) { return update('emergency_numbers', id, n); },
      async remove(id) { return remove('emergency_numbers', id); },
    },

    // Fotos de cédula/selfie (ya cifradas por server.js): en archivos privados
    identity: {
      async put(name, buf) {
        if (!fs.existsSync(IDENTITY_DIR)) fs.mkdirSync(IDENTITY_DIR, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(IDENTITY_DIR, path.basename(name)), buf, { mode: 0o600 });
      },
      async get(name) {
        const f = path.join(IDENTITY_DIR, path.basename(name));
        return fs.existsSync(f) ? fs.readFileSync(f) : null;
      },
      async remove(name) {
        try { fs.unlinkSync(path.join(IDENTITY_DIR, path.basename(name))); } catch (e) {}
      },
    },
  };
  return store;
}

// ---------------------------------------------------------------------
// Motor 2: PostgreSQL (producción)
// ---------------------------------------------------------------------
// Cada colección es una tabla con: id, algunas columnas indexadas para
// buscar rápido, y "data" (jsonb) con el objeto completo. Así los datos
// conservan exactamente la misma forma que la app ya usaba.
const TABLES = {
  // "search": título + categoría + zona en minúsculas y sin tildes, con
  // índice trigram → búsquedas rápidas aunque haya millones de filas.
  listings: { cols: { seller_id: 'sellerId', status: (o) => o.status || 'active', category: 'category', seller_type: (o) => o.sellerType || 'persona', created_at: 'createdAt', title: 'title', search: (o) => norm(`${o.title || ''} ${o.category || ''} ${o.zone || ''}`) } },
  users: { cols: { email: 'email' } },
  messages: { cols: { thread_id: 'threadId', from_user_id: 'fromUserId', to_user_id: 'toUserId', created_at: 'createdAt' } },
  ratings: { cols: { listing_id: 'listingId', from_user_id: 'fromUserId', to_user_id: 'toUserId', created_at: 'createdAt' } },
  reports: { cols: { created_at: 'createdAt' } },
  emergency_numbers: { cols: {} },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS hay_meta (key text PRIMARY KEY, value text);
CREATE TABLE IF NOT EXISTS counters (name text PRIMARY KEY, value bigint NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, user_id text NOT NULL, created_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE TABLE IF NOT EXISTS reset_tokens (token text PRIMARY KEY, user_id text NOT NULL, expires_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS listings (
  id text PRIMARY KEY, seller_id text, status text NOT NULL DEFAULT 'active', category text,
  seller_type text NOT NULL DEFAULT 'persona', created_at timestamptz NOT NULL, title text NOT NULL DEFAULT '', data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS listings_feed ON listings (created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS listings_cat_feed ON listings (category, created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS listings_seller ON listings (seller_id, created_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY, thread_id text NOT NULL, from_user_id text NOT NULL, to_user_id text NOT NULL, created_at timestamptz NOT NULL, data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS messages_from ON messages (from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_to ON messages (to_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ratings (
  id text PRIMARY KEY, listing_id text NOT NULL, from_user_id text NOT NULL, to_user_id text NOT NULL, created_at timestamptz NOT NULL, data jsonb NOT NULL,
  UNIQUE (listing_id, from_user_id)
);
CREATE INDEX IF NOT EXISTS ratings_to ON ratings (to_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reports (id text PRIMARY KEY, created_at timestamptz NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS emergency_numbers (id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS identity_files (name text PRIMARY KEY, content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
`;

function createPgStore({ databaseUrl, seedListings, seedEmergency, dataDir, poolSize }) {
  const pool = createPool(databaseUrl, { max: poolSize || 10 });
  const q = (text, params) => pool.query(text, params);
  const rowsData = (r) => r.rows.map((x) => x.data);
  const one = (r) => (r.rows[0] ? r.rows[0].data : null);

  async function nextId(coll, db = { query: q }) {
    const r = await db.query(
      'INSERT INTO counters (name, value) VALUES ($1, 1) ON CONFLICT (name) DO UPDATE SET value = counters.value + 1 RETURNING value',
      [coll]
    );
    return PREFIX[coll] + r.rows[0].value;
  }
  function colValues(coll, obj) {
    const spec = TABLES[coll].cols;
    return Object.entries(spec).map(([col, src]) => (typeof src === 'function' ? src(obj) : obj[src] === undefined ? null : obj[src]));
  }
  async function upsert(coll, obj, db = { query: q }) {
    const cols = Object.keys(TABLES[coll].cols);
    const names = ['id', ...cols, 'data'];
    const ph = names.map((_, i) => '$' + (i + 1));
    const sets = [...cols, 'data'].map((c) => `${c} = EXCLUDED.${c}`).join(', ');
    await db.query(
      `INSERT INTO ${coll} (${names.join(', ')}) VALUES (${ph.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${sets}`,
      [obj.id, ...colValues(coll, obj), obj]
    );
    return obj;
  }
  async function insert(coll, obj) {
    const item = { ...obj, id: obj.id || (await nextId(coll)) };
    const cols = Object.keys(TABLES[coll].cols);
    const names = ['id', ...cols, 'data'];
    await q(`INSERT INTO ${coll} (${names.join(', ')}) VALUES (${names.map((_, i) => '$' + (i + 1)).join(', ')})`, [item.id, ...colValues(coll, item), item]);
    return item;
  }
  async function update(coll, id, obj) {
    const item = { ...obj, id };
    const cols = Object.keys(TABLES[coll].cols);
    const sets = [...cols, 'data'].map((c, i) => `${c} = $${i + 2}`).join(', ');
    const r = await q(`UPDATE ${coll} SET ${sets} WHERE id = $1`, [id, ...colValues(coll, item), item]);
    return r.rowCount ? item : null;
  }
  const get = async (coll, id) => one(await q(`SELECT data FROM ${coll} WHERE id = $1`, [id]));
  const remove = async (coll, id) => (await q(`DELETE FROM ${coll} WHERE id = $1`, [id])).rowCount > 0;

  // Migración única desde los archivos JSON de v1.27/v1.28 (si existen)
  async function importFromJson() {
    const f = (name) => path.join(dataDir, name);
    const read = (name, fb) => {
      try { return fs.existsSync(f(name)) ? JSON.parse(fs.readFileSync(f(name), 'utf-8')) : fb; } catch (e) { return fb; }
    };
    const users = read('users.json', []);
    if (!users.length) return false;
    console.log(`[HAY store] Importando datos existentes desde ${dataDir} a PostgreSQL...`);
    await pool.tx(async (db) => {
      const sets = {
        users,
        listings: read('listings.json', []),
        messages: read('messages.json', []),
        ratings: read('ratings.json', []),
        reports: read('reports.json', []),
        emergency_numbers: read('emergency-numbers.json', seedEmergency),
      };
      for (const [coll, list] of Object.entries(sets)) {
        let max = 0;
        for (const item of list) {
          if (coll === 'listings' && !item.createdAt) item.createdAt = new Date(0).toISOString();
          if ((coll === 'messages' || coll === 'ratings' || coll === 'reports') && !item.createdAt) item.createdAt = new Date().toISOString();
          await upsert(coll, item, db);
          const n = Number(String(item.id).replace(/[^0-9]/g, ''));
          if (!Number.isNaN(n) && n > max) max = n;
        }
        await db.query('INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, $2)', [coll, max]);
      }
      const sessions = read('sessions.json', {});
      for (const [token, s] of Object.entries(sessions)) {
        await db.query('INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [token, s.userId, s.createdAt]);
      }
      const idDir = path.join(dataDir, 'identity');
      if (fs.existsSync(idDir)) {
        for (const name of fs.readdirSync(idDir)) {
          await db.query('INSERT INTO identity_files (name, content) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, fs.readFileSync(path.join(idDir, name))]);
        }
      }
    });
    console.log(`[HAY store] Importación completa (${users.length} usuarios).`);
    return true;
  }

  const store = {
    kind: 'postgres',
    pool,
    async init() {
      for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await q(stmt);
      // Búsqueda por texto rápida (si el servidor lo permite)
      // V1.29: columna de búsqueda (y relleno para filas viejas)
      await q('ALTER TABLE listings ADD COLUMN IF NOT EXISTS search text');
      await q(`UPDATE listings SET search = translate(lower(coalesce(title,'') || ' ' || coalesce(category,'') || ' ' || coalesce(data->>'zone','')), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio') WHERE search IS NULL`);
      try {
        await q('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        await q("CREATE INDEX IF NOT EXISTS listings_search_trgm ON listings USING gin (search gin_trgm_ops) WHERE status = 'active'");
      } catch (e) {
        console.warn('[HAY store] pg_trgm no disponible; la búsqueda funciona igual, sin índice especial.');
      }
      const seeded = await q("SELECT value FROM hay_meta WHERE key = 'initialized'");
      if (!seeded.rows.length) {
        const imported = dataDir ? await importFromJson() : false;
        if (!imported) {
          for (const l of seedListings) await upsert('listings', l);
          for (const n of seedEmergency) await upsert('emergency_numbers', n);
          const maxOf = (list) => list.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/[^0-9]/g, '')) || 0), 0);
          await q('INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, $2)', ['listings', maxOf(seedListings)]);
          await q('INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = GREATEST(counters.value, $2)', ['emergency_numbers', maxOf(seedEmergency)]);
        }
        await q("INSERT INTO hay_meta (key, value) VALUES ('initialized', $1) ON CONFLICT (key) DO NOTHING", [new Date().toISOString()]);
      }
    },
    async close() { await pool.end(); },
    flush() {},

    listings: {
      get: (id) => get('listings', id),
      insert: (l) => insert('listings', l),
      update: (id, l) => update('listings', id, l),
      remove: (id) => remove('listings', id),
      async count() { return (await q('SELECT count(*)::int AS n FROM listings')).rows[0].n; },
      async bySeller(sellerId) {
        return rowsData(await q('SELECT data FROM listings WHERE seller_id = $1 ORDER BY created_at DESC, id DESC LIMIT 500', [sellerId]));
      },
      async activeBySeller(sellerId, limit = 20) {
        return rowsData(await q("SELECT data FROM listings WHERE seller_id = $1 AND status = 'active' ORDER BY created_at DESC, id DESC LIMIT $2", [sellerId, limit]));
      },
      async removeBySeller(sellerId) {
        return rowsData(await q('DELETE FROM listings WHERE seller_id = $1 RETURNING data', [sellerId]));
      },
      async titles(ids) {
        if (!ids.length) return {};
        const r = await q('SELECT id, title FROM listings WHERE id = ANY($1::text[])', [ids]);
        return Object.fromEntries(r.rows.map((x) => [x.id, x.title]));
      },
      async feed({ category, sellerType, q: text, sellerId, limit = 20, cursor } = {}) {
        const where = ["status = 'active'"];
        const params = [];
        const add = (sql, v) => { params.push(v); where.push(sql.replace('?', '$' + params.length)); };
        if (category) add('category = ?', category);
        if (sellerType) add('seller_type = ?', sellerType);
        if (sellerId) add('seller_id = ?', sellerId);
        if (text) {
          params.push('%' + norm(text).replace(/[%_\\]/g, '\\$&') + '%');
          where.push(`search LIKE $${params.length}`);
        }
        const c = cursor ? decodeCursor(cursor) : null;
        if (c) {
          params.push(c.createdAt, c.id);
          where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length})`);
        }
        params.push(limit + 1);
        const r = await q(`SELECT data FROM listings WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`, params);
        const list = rowsData(r);
        const page = list.slice(0, limit);
        return { items: page, nextCursor: list.length > limit ? encodeCursor(page[page.length - 1]) : null };
      },
    },

    users: {
      get: (id) => get('users', id),
      async byEmail(email) { return one(await q('SELECT data FROM users WHERE email = $1', [email])); },
      async count() { return (await q('SELECT count(*)::int AS n FROM users')).rows[0].n; },
      insert: (u) => insert('users', u),
      update: (id, u) => update('users', id, u),
      async emails(ids) {
        if (!ids.length) return {};
        const r = await q('SELECT id, email FROM users WHERE id = ANY($1::text[])', [ids]);
        return Object.fromEntries(r.rows.map((x) => [x.id, x.email]));
      },
      async withIdentity() {
        return rowsData(await q("SELECT data FROM users WHERE data->'identity'->>'status' IS NOT NULL ORDER BY data->'identity'->>'submittedAt' DESC LIMIT 500"));
      },
      remove: (id) => remove('users', id),
    },

    sessions: {
      async create(token, userId, createdAt) { await q('INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3)', [token, userId, createdAt]); },
      async get(token) {
        const r = await q('SELECT user_id, created_at FROM sessions WHERE token = $1', [token]);
        return r.rows[0] ? { userId: r.rows[0].user_id, createdAt: r.rows[0].created_at } : null;
      },
      async remove(token) { await q('DELETE FROM sessions WHERE token = $1', [token]); },
      async removeByUser(userId) { await q('DELETE FROM sessions WHERE user_id = $1', [userId]); },
      async purgeOlderThan(isoDate) { await q('DELETE FROM sessions WHERE created_at < $1', [isoDate]); },
    },

    resetTokens: {
      async create(token, userId, expiresAt) { await q('INSERT INTO reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]); },
      async get(token) {
        const r = await q('SELECT user_id, expires_at FROM reset_tokens WHERE token = $1', [token]);
        return r.rows[0] ? { userId: r.rows[0].user_id, expiresAt: r.rows[0].expires_at } : null;
      },
      async remove(token) { await q('DELETE FROM reset_tokens WHERE token = $1', [token]); },
    },

    messages: {
      get: (id) => get('messages', id),
      insert: (m) => insert('messages', m),
      update: (id, m) => update('messages', id, m),
      async byThread(threadId, afterIso) {
        return afterIso
          ? rowsData(await q('SELECT data FROM messages WHERE thread_id = $1 AND created_at > $2 ORDER BY created_at, id LIMIT 1000', [threadId, afterIso]))
          : rowsData(await q('SELECT data FROM messages WHERE thread_id = $1 ORDER BY created_at, id LIMIT 1000', [threadId]));
      },
      async lastPerThread(userId) {
        return rowsData(await q(
          `SELECT DISTINCT ON (thread_id) data FROM messages
           WHERE from_user_id = $1 OR to_user_id = $1
           ORDER BY thread_id, created_at DESC, id DESC LIMIT 500`,
          [userId]
        ));
      },
    },

    ratings: {
      async insert(r) {
        try {
          return await insert('ratings', r);
        } catch (e) {
          if (e.code === '23505') { const d = new Error('duplicada'); d.code = 'DUPLICATE'; throw d; }
          throw e;
        }
      },
      async exists(listingId, fromUserId) {
        return (await q('SELECT 1 FROM ratings WHERE listing_id = $1 AND from_user_id = $2', [listingId, fromUserId])).rows.length > 0;
      },
      async forUser(toUserId) {
        return rowsData(await q('SELECT data FROM ratings WHERE to_user_id = $1 ORDER BY created_at DESC LIMIT 200', [toUserId]));
      },
    },

    reports: {
      get: (id) => get('reports', id),
      insert: (r) => insert('reports', r),
      update: (id, r) => update('reports', id, r),
      async all() { return rowsData(await q('SELECT data FROM reports ORDER BY created_at DESC LIMIT 500')); },
    },

    emergency: {
      async all() { return rowsData(await q("SELECT data FROM emergency_numbers ORDER BY (regexp_replace(id, '[^0-9]', '', 'g'))::int NULLS LAST")); },
      get: (id) => get('emergency_numbers', id),
      insert: (n) => insert('emergency_numbers', n),
      update: (id, n) => update('emergency_numbers', id, n),
      remove: (id) => remove('emergency_numbers', id),
    },

    identity: {
      async put(name, buf) { await q('INSERT INTO identity_files (name, content) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content', [name, buf]); },
      async get(name) { const r = await q('SELECT content FROM identity_files WHERE name = $1', [name]); return r.rows[0] ? r.rows[0].content : null; },
      async remove(name) { await q('DELETE FROM identity_files WHERE name = $1', [name]); },
    },
  };
  return store;
}

function createStore(opts) {
  return opts.databaseUrl ? createPgStore(opts) : createJsonStore(opts);
}

module.exports = { createStore, encodeCursor, decodeCursor };
