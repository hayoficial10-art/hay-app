/**
 * HAY — envío de correos (V1.35), solo con módulos nativos de Node.
 *
 * Se elige el servicio con variables de entorno (la primera que esté puesta):
 *   RESEND_API_KEY            Resend (resend.com) por HTTPS
 *   BREVO_API_KEY             Brevo (brevo.com) por HTTPS
 *   SMTP_HOST + SMTP_USER + SMTP_PASS   cualquier SMTP (ej. Gmail con
 *                             "contraseña de aplicación": smtp.gmail.com)
 *       SMTP_PORT            465 (TLS directo, por defecto) o 587 (STARTTLS)
 *       SMTP_SECURE=true     TLS directo en otro puerto
 *   MAIL_FROM                 remitente, ej.  HAY <no-responder@tudominio.com>
 *                             (con Gmail: tu propia dirección de Gmail)
 *
 * Sin ninguna configurada, los correos no se envían: se anota en el registro
 * del servidor y la app sigue funcionando igual.
 * Un correo que falla nunca detiene el registro ni la verificación.
 */
'use strict';

const https = require('https');
const net = require('net');
const tls = require('tls');
const os = require('os');

function config() {
  const env = process.env;
  const from = String(env.MAIL_FROM || env.SMTP_USER || '').trim();
  if (env.RESEND_API_KEY) return { kind: 'resend', key: env.RESEND_API_KEY, from };
  if (env.BREVO_API_KEY) return { kind: 'brevo', key: env.BREVO_API_KEY, from };
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return { kind: 'smtp', host: env.SMTP_HOST, port: Number(env.SMTP_PORT) || 465, user: env.SMTP_USER, pass: env.SMTP_PASS, from };
  }
  return { kind: 'none', from };
}

function mailerKind() {
  return config().kind;
}

// "HAY <a@b.com>" -> { name: 'HAY', email: 'a@b.com' }
function parseAddress(s) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(String(s || ''));
  return m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2].trim() } : { name: '', email: String(s || '').trim() };
}

function postJSON(hostname, pathName, headers, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      { hostname, path: pathName, method: 'POST', timeout: 15000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve(out) : reject(new Error(`HTTP ${res.statusCode}: ${out.slice(0, 300)}`))));
      }
    );
    req.on('timeout', () => req.destroy(new Error('tiempo de espera agotado')));
    req.on('error', reject);
    req.end(body);
  });
}

// ---------------------------------------------------------------------
// SMTP mínimo: EHLO, STARTTLS (587), AUTH LOGIN, MAIL/RCPT/DATA
// ---------------------------------------------------------------------
function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}
function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}
function wrap76(s) {
  return s.replace(/.{1,76}/g, '$&\r\n');
}

function buildMime({ from, to, subject, html, text }) {
  const boundary = 'hay' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const f = parseAddress(from);
  const fromHeader = f.name ? `${encodeHeader(f.name)} <${f.email}>` : f.email;
  return [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${f.email.split('@')[1] || 'hay'}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function smtpSend(cfg, { to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    let socket;
    let buffer = '';
    let waiter = null;
    let finished = false;
    const done = (err) => {
      if (finished) return;
      finished = true;
      try { socket && socket.end(); } catch (e) {}
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(() => done(new Error('SMTP: tiempo de espera agotado')), 25000);

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      // respuesta completa: última línea "123 texto" (sin guion)
      const lines = buffer.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const reply = lines.slice(0, i + 1).join('\n');
          buffer = lines.slice(i + 1).join('\r\n');
          const w = waiter;
          waiter = null;
          if (w) w(reply);
          return;
        }
      }
    }
    function attach(s) {
      socket = s;
      s.on('data', onData);
      s.on('error', (e) => done(new Error('SMTP: ' + e.message)));
      s.setTimeout(20000, () => done(new Error('SMTP: sin respuesta del servidor')));
    }
    const read = () => new Promise((res) => (waiter = res));
    async function cmd(line, okCodes) {
      if (line !== null) socket.write(line + '\r\n');
      const reply = await read();
      const code = Number(reply.slice(0, 3));
      if (!okCodes.includes(code)) throw new Error(`SMTP respondió "${reply.split('\n').pop()}" a ${line ? line.split(' ')[0] : 'la conexión'}`);
      return reply;
    }

    const implicitTls = cfg.port === 465 || process.env.SMTP_SECURE === 'true';
    const first = implicitTls
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });
    attach(first);
    first.once(implicitTls ? 'secureConnect' : 'connect', async () => {
      try {
        const me = os.hostname() || 'hay-app';
        await cmd(null, [220]);
        let ehlo = await cmd('EHLO ' + me, [250]);
        if (!implicitTls) {
          if (!/STARTTLS/i.test(ehlo)) throw new Error('el servidor SMTP no ofrece STARTTLS');
          await cmd('STARTTLS', [220]);
          await new Promise((res, rej) => {
            first.removeListener('data', onData);
            const secured = tls.connect({ socket: first, servername: cfg.host }, res);
            secured.on('error', rej);
            attach(secured);
          });
          ehlo = await cmd('EHLO ' + me, [250]);
        }
        await cmd('AUTH LOGIN', [334]);
        await cmd(b64(cfg.user), [334]);
        await cmd(b64(cfg.pass), [235]);
        const fromEmail = parseAddress(cfg.from).email;
        await cmd(`MAIL FROM:<${fromEmail}>`, [250]);
        await cmd(`RCPT TO:<${to}>`, [250, 251]);
        await cmd('DATA', [354]);
        const mime = buildMime({ from: cfg.from, to, subject, html, text }).replace(/\r\n\./g, '\r\n..');
        await cmd(mime + '\r\n.', [250]);
        try { await cmd('QUIT', [221]); } catch (e) {}
        clearTimeout(timer);
        done();
      } catch (e) {
        clearTimeout(timer);
        done(e);
      }
    });
  });
}

async function sendMail({ to, subject, html, text }) {
  const cfg = config();
  if (cfg.kind === 'none') {
    console.log(`[HAY correo] (sin servicio de correo configurado) no se envió "${subject}" a ${to}`);
    return { ok: false, skipped: true };
  }
  if (!cfg.from) {
    console.warn('[HAY correo] falta MAIL_FROM: no se envió', subject);
    return { ok: false, skipped: true };
  }
  try {
    if (cfg.kind === 'resend') {
      await postJSON('api.resend.com', '/emails', { Authorization: 'Bearer ' + cfg.key }, { from: cfg.from, to: [to], subject, html, text });
    } else if (cfg.kind === 'brevo') {
      const f = parseAddress(cfg.from);
      await postJSON('api.brevo.com', '/v3/smtp/email', { 'api-key': cfg.key, accept: 'application/json' }, {
        sender: { email: f.email, name: f.name || 'HAY' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      });
    } else {
      await smtpSend(cfg, { to, subject, html, text });
    }
    console.log(`[HAY correo] enviado "${subject}" a ${to} (${cfg.kind})`);
    return { ok: true };
  } catch (e) {
    console.error(`[HAY correo] no se pudo enviar "${subject}" a ${to}: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layout(title, paragraphs, button) {
  const ps = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1B2A4E;">${p}</p>`).join('');
  const btn = button
    ? `<p style="margin:22px 0 6px;"><a href="${button.url}" style="display:inline-block;background:#178DBA;color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:999px;">${button.label}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;">
<tr><td style="background:#E8336F;padding:22px 26px;"><span style="font-size:30px;font-weight:900;letter-spacing:1px;"><span style="color:#178DBA;">H</span><span style="color:#FFC627;">A</span><span style="color:#4FB82E;">Y</span></span></td></tr>
<tr><td style="padding:26px;"><h1 style="margin:0 0 16px;font-size:22px;color:#1B2A4E;">${title}</h1>${ps}${btn}</td></tr>
<tr><td style="padding:14px 26px 22px;font-size:12px;color:#8a93a6;">HAY — Lo tienes, publícalo, véndelo. Este correo se envió automáticamente; no hace falta responderlo.</td></tr>
</table></td></tr></table></body></html>`;
}

function plain(title, paragraphs, button) {
  const strip = (s) => String(s).replace(/<[^>]+>/g, '');
  return [title, '', ...paragraphs.map(strip), button ? `\n${button.label}: ${button.url}` : '', '', '— HAY'].join('\n');
}

function message(title, paragraphs, button) {
  return { subject: title, html: layout(title, paragraphs, button), text: plain(title, paragraphs, button) };
}

function welcomeEmail({ name, appUrl, identityPending }) {
  return message(
    '¡Bienvenido a HAY!',
    [
      `Hola${name ? ' ' + escapeHtml(name) : ''}, tu registro en HAY se completó correctamente.`,
      'Ya puedes buscar productos cerca de ti y escribirle a los vendedores.',
      identityPending
        ? '<strong>Siguiente paso:</strong> completa la verificación de seguridad (foto de tu cédula y una selfie). Es necesaria para publicar y protege a todos en HAY.'
        : 'Tu cuenta está lista para publicar.',
    ],
    appUrl ? { label: 'Abrir HAY', url: appUrl } : null
  );
}

function identityDoneEmail({ name, appUrl }) {
  return message(
    'Verificación de seguridad completada',
    [
      `Hola${name ? ' ' + escapeHtml(name) : ''}, recibimos tu verificación de seguridad (foto de la cédula y selfie).`,
      'Esta fase quedó completada: ya puedes publicar en HAY.',
      'Si tú no hiciste esta verificación, escríbenos desde la app en Configuración → Reportar un problema.',
    ],
    appUrl ? { label: 'Publicar ahora', url: appUrl } : null
  );
}

function adminNewUserEmail({ email, accountType, businessName, method }) {
  return message(
    'Nuevo usuario registrado en HAY',
    [
      `Se completó un registro nuevo: <strong>${escapeHtml(email)}</strong>.`,
      `Tipo de cuenta: ${accountType === 'negocio' ? 'Negocio' + (businessName ? ' (' + escapeHtml(businessName) + ')' : '') : 'Persona'} · Registro con ${method === 'google' ? 'Google' : 'correo y contraseña'}.`,
      `Fecha: ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })} (hora de Venezuela).`,
    ]
  );
}

module.exports = { sendMail, mailerKind, welcomeEmail, identityDoneEmail, adminNewUserEmail };
