/* pg.js — cliente mínimo de PostgreSQL, sin dependencias (V1.29).
 *
 * Por qué existe: HAY no usa paquetes npm (se instala y publica sin
 * "npm install"). Este archivo habla directamente el protocolo de
 * PostgreSQL (v3) con lo que la app necesita:
 *   - conexión por URL (postgres://usuario:clave@host:puerto/base?sslmode=require)
 *   - SSL/TLS opcional
 *   - autenticación SCRAM-SHA-256 (la de PostgreSQL moderno), MD5 y texto
 *   - consultas con parámetros ($1, $2...) — protegen contra inyección SQL
 *   - un pool de conexiones con cola, reconexión y transacciones
 *
 * Uso:
 *   const { createPool } = require('./pg');
 *   const pool = createPool(process.env.DATABASE_URL, { max: 10 });
 *   const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
 *   await pool.tx(async (c) => { await c.query(...); await c.query(...); });
 */
'use strict';

const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

// --- Tipos (OID → conversión desde texto) -------------------------------
const PARSERS = {
  16: (v) => v === 't', // bool
  20: (v) => Number(v), // int8 (los ids/contadores de HAY caben en Number)
  21: (v) => Number(v), // int2
  23: (v) => Number(v), // int4
  700: (v) => Number(v), // float4
  701: (v) => Number(v), // float8
  1700: (v) => Number(v), // numeric
  114: (v) => JSON.parse(v), // json
  3802: (v) => JSON.parse(v), // jsonb
  17: (v) => Buffer.from(v.slice(2), 'hex'), // bytea (formato hex "\x...")
  1184: (v) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString(), // timestamptz
};

function serializeParam(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (v instanceof Date) return v.toISOString();
  // Arreglos → literal de arreglo de PostgreSQL: {"a","b"} (para ANY($1::text[]))
  if (Array.isArray(v)) {
    return '{' + v.map((x) => (x === null || x === undefined ? 'NULL' : '"' + String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"')).join(',') + '}';
  }
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

// --- Construcción de mensajes -------------------------------------------
function msg(type, body) {
  const len = Buffer.alloc(4);
  len.writeInt32BE(body.length + 4);
  return type ? Buffer.concat([Buffer.from(type), len, body]) : Buffer.concat([len, body]);
}
const cstr = (s) => Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.from([0])]);
const i16 = (n) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };

class PgError extends Error {
  constructor(fields) {
    super(fields.M || 'Error de PostgreSQL');
    this.code = fields.C;
    this.detail = fields.D;
    this.fields = fields;
  }
}

function parseUrl(url) {
  const u = new URL(url);
  const sslmode = u.searchParams.get('sslmode') || process.env.PGSSLMODE || 'prefer';
  return {
    host: u.hostname || 'localhost',
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')) || decodeURIComponent(u.username),
    sslmode,
  };
}

// --- Una conexión ----------------------------------------------------------
class Connection {
  constructor(cfg) {
    this.cfg = cfg;
    this.buf = Buffer.alloc(0);
    this.queue = []; // consultas esperando su turno en esta conexión
    this.current = null;
    this.dead = false;
  }

  async connect() {
    const { host, port, sslmode } = this.cfg;
    let socket = await new Promise((resolve, reject) => {
      const s = net.connect({ host, port });
      s.once('connect', () => resolve(s));
      s.once('error', reject);
    });
    socket.setNoDelay(true);
    if (sslmode !== 'disable') {
      // SSLRequest
      socket.write(Buffer.concat([i32(8), i32(80877103)]));
      const answer = await new Promise((resolve, reject) => {
        socket.once('data', (d) => resolve(String.fromCharCode(d[0])));
        socket.once('error', reject);
      });
      if (answer === 'S') {
        socket = await new Promise((resolve, reject) => {
          const t = tls.connect({
            socket,
            servername: net.isIP(host) ? undefined : host,
            // "require" (como en libpq) cifra pero no valida el certificado;
            // "verify-full" sí lo valida.
            rejectUnauthorized: sslmode === 'verify-full' || sslmode === 'verify-ca',
          });
          t.once('secureConnect', () => resolve(t));
          t.once('error', reject);
        });
      } else if (sslmode === 'require' || sslmode.startsWith('verify')) {
        socket.destroy();
        throw new Error('El servidor PostgreSQL no acepta SSL y sslmode=' + sslmode);
      }
    }
    this.socket = socket;
    socket.on('data', (d) => this.onData(d));
    socket.on('error', (e) => this.fail(e));
    socket.on('close', () => this.fail(new Error('Conexión con PostgreSQL cerrada')));

    await new Promise((resolve, reject) => {
      this.startup = { resolve, reject };
      const params = Buffer.concat([
        i32(196608),
        cstr('user'), cstr(this.cfg.user),
        cstr('database'), cstr(this.cfg.database),
        cstr('client_encoding'), cstr('UTF8'),
        cstr('application_name'), cstr('hay-backend'),
        Buffer.from([0]),
      ]);
      socket.write(msg(null, params));
    });
  }

  fail(err) {
    if (this.dead) return;
    this.dead = true;
    if (this.startup) { this.startup.reject(err); this.startup = null; }
    if (this.current) { this.current.reject(err); this.current = null; }
    for (const q of this.queue) q.reject(err);
    this.queue = [];
    try { this.socket && this.socket.destroy(); } catch (e) {}
  }

  onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 5) {
      const type = String.fromCharCode(this.buf[0]);
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try {
        this.handle(type, body);
      } catch (e) {
        this.fail(e);
        return;
      }
    }
  }

  handle(type, body) {
    switch (type) {
      case 'R': return this.handleAuth(body);
      case 'S': case 'K': case 'N': return; // ParameterStatus, BackendKeyData, Notice
      case 'Z': // ReadyForQuery
        if (this.startup) { const s = this.startup; this.startup = null; s.resolve(); return; }
        if (this.current) {
          const c = this.current; this.current = null;
          if (c.error) c.reject(c.error); else c.resolve({ rows: c.rows, rowCount: c.rowCount });
        }
        return this.next();
      case 'E': {
        const fields = {};
        let i = 0;
        while (i < body.length && body[i] !== 0) {
          const code = String.fromCharCode(body[i]);
          const end = body.indexOf(0, i + 1);
          fields[code] = body.toString('utf8', i + 1, end);
          i = end + 1;
        }
        const err = new PgError(fields);
        if (this.startup) { this.startup.reject(err); this.startup = null; this.fail(err); return; }
        if (this.current) this.current.error = err;
        return;
      }
      case '1': case '2': case 'n': case 's': case 'I': return; // ParseComplete, BindComplete, NoData, PortalSuspended, EmptyQuery
      case 'T': { // RowDescription
        const n = body.readInt16BE(0);
        let off = 2;
        const cols = [];
        for (let k = 0; k < n; k++) {
          const end = body.indexOf(0, off);
          const name = body.toString('utf8', off, end);
          off = end + 1;
          const typeOid = body.readInt32BE(off + 6);
          off += 18;
          cols.push({ name, parse: PARSERS[typeOid] || ((v) => v) });
        }
        if (this.current) this.current.cols = cols;
        return;
      }
      case 'D': { // DataRow
        const c = this.current;
        if (!c) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const row = {};
        for (let k = 0; k < n; k++) {
          const len = body.readInt32BE(off);
          off += 4;
          const col = c.cols[k];
          if (len === -1) { row[col.name] = null; continue; }
          const raw = body.toString('utf8', off, off + len);
          off += len;
          row[col.name] = col.parse(raw);
        }
        c.rows.push(row);
        return;
      }
      case 'C': { // CommandComplete
        const tag = body.toString('utf8', 0, body.length - 1);
        const m = /(\d+)$/.exec(tag);
        if (this.current) this.current.rowCount = m ? Number(m[1]) : 0;
        return;
      }
      default:
        return;
    }
  }

  handleAuth(body) {
    const code = body.readInt32BE(0);
    const { user, password } = this.cfg;
    if (code === 0) return; // AuthenticationOk
    if (code === 3) return this.socket.write(msg('p', cstr(password)));
    if (code === 5) {
      const salt = body.subarray(4, 8);
      const inner = crypto.createHash('md5').update(password + user).digest('hex');
      const outer = crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
      return this.socket.write(msg('p', cstr('md5' + outer)));
    }
    if (code === 10) { // SASL: SCRAM-SHA-256
      const mechs = body.toString('utf8', 4).split('\0');
      if (!mechs.includes('SCRAM-SHA-256')) throw new Error('Mecanismo de autenticación no soportado: ' + mechs.join(','));
      this.scramNonce = crypto.randomBytes(18).toString('base64');
      this.scramFirstBare = `n=*,r=${this.scramNonce}`;
      const first = Buffer.from('n,,' + this.scramFirstBare);
      return this.socket.write(msg('p', Buffer.concat([cstr('SCRAM-SHA-256'), i32(first.length), first])));
    }
    if (code === 11) { // SASLContinue
      const serverFirst = body.toString('utf8', 4);
      const attrs = Object.fromEntries(serverFirst.split(',').map((kv) => [kv[0], kv.slice(2)]));
      if (!attrs.r.startsWith(this.scramNonce)) throw new Error('SCRAM: nonce inválido');
      const salted = crypto.pbkdf2Sync(password.normalize('NFKC'), Buffer.from(attrs.s, 'base64'), Number(attrs.i), 32, 'sha256');
      const clientKey = crypto.createHmac('sha256', salted).update('Client Key').digest();
      const storedKey = crypto.createHash('sha256').update(clientKey).digest();
      const withoutProof = `c=biws,r=${attrs.r}`;
      const authMessage = `${this.scramFirstBare},${serverFirst},${withoutProof}`;
      const signature = crypto.createHmac('sha256', storedKey).update(authMessage).digest();
      const proof = Buffer.from(clientKey.map((b, i) => b ^ signature[i])).toString('base64');
      const serverKey = crypto.createHmac('sha256', salted).update('Server Key').digest();
      this.scramServerSig = crypto.createHmac('sha256', serverKey).update(authMessage).digest('base64');
      return this.socket.write(msg('p', Buffer.from(`${withoutProof},p=${proof}`)));
    }
    if (code === 12) { // SASLFinal
      const v = body.toString('utf8', 4).replace(/^v=/, '');
      if (v !== this.scramServerSig) throw new Error('SCRAM: firma del servidor inválida');
      return;
    }
    throw new Error('Método de autenticación no soportado (código ' + code + ')');
  }

  query(text, params = []) {
    if (this.dead) return Promise.reject(new Error('Conexión cerrada'));
    return new Promise((resolve, reject) => {
      this.queue.push({ text, params, resolve, reject });
      if (!this.current) this.next();
    });
  }

  next() {
    if (this.current || !this.queue.length || this.dead) return;
    const q = this.queue.shift();
    this.current = { ...q, rows: [], cols: [], rowCount: 0, error: null };
    const values = q.params.map(serializeParam);
    const bindParts = [cstr(''), cstr(''), i16(0), i16(values.length)];
    for (const v of values) {
      if (v === null) bindParts.push(i32(-1));
      else { const b = Buffer.from(v, 'utf8'); bindParts.push(i32(b.length), b); }
    }
    bindParts.push(i16(0));
    this.socket.write(Buffer.concat([
      msg('P', Buffer.concat([cstr(''), cstr(q.text), i16(0)])),
      msg('B', Buffer.concat(bindParts)),
      msg('D', Buffer.concat([Buffer.from('P'), cstr('')])),
      msg('E', Buffer.concat([cstr(''), i32(0)])),
      msg('S', Buffer.alloc(0)),
    ]));
  }

  close() {
    try { this.socket.write(msg('X', Buffer.alloc(0))); } catch (e) {}
    this.fail(new Error('cerrada'));
  }
}

// --- Pool ---------------------------------------------------------------
function createPool(url, { max = 10 } = {}) {
  const cfg = parseUrl(url);
  const idle = [];
  const waiters = [];
  let total = 0;

  async function acquire() {
    while (idle.length) {
      const c = idle.pop();
      if (!c.dead) return c;
      total--;
    }
    if (total < max) {
      total++;
      const c = new Connection(cfg);
      try {
        await c.connect();
      } catch (e) {
        total--;
        throw e;
      }
      return c;
    }
    return new Promise((resolve) => waiters.push(resolve));
  }

  function release(c) {
    if (c.dead) {
      total--;
      if (waiters.length) acquire().then(waiters.shift(), () => {});
      return;
    }
    if (waiters.length) waiters.shift()(c);
    else idle.push(c);
  }

  async function query(text, params) {
    const c = await acquire();
    try {
      return await c.query(text, params);
    } finally {
      release(c);
    }
  }

  // Transacción: todo o nada
  async function tx(fn) {
    const c = await acquire();
    try {
      await c.query('BEGIN');
      const result = await fn({ query: (t, p) => c.query(t, p) });
      await c.query('COMMIT');
      return result;
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch (e2) {}
      throw e;
    } finally {
      release(c);
    }
  }

  async function end() {
    for (const c of idle.splice(0)) c.close();
  }

  return { query, tx, end, stats: () => ({ total, idle: idle.length, waiting: waiters.length }) };
}

module.exports = { createPool, PgError };
