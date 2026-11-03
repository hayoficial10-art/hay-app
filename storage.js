/* storage.js — dónde se guardan las fotos de las publicaciones (V1.29)
 *
 *   - "local" (por defecto): en el disco del servidor (DATA_DIR/uploads)
 *     y las entrega el propio servidor en /uploads/... Ideal para empezar.
 *   - "s3": en un servicio de almacenamiento de fotos compatible con S3
 *     (Cloudflare R2, Amazon S3, Backblaze B2, DigitalOcean Spaces...).
 *     Las fotos se sirven desde su CDN, rápido y cerca de cada usuario,
 *     y el servidor de HAY queda libre. Necesario para correr varios
 *     servidores a la vez. Se activa con estas variables:
 *        S3_ENDPOINT          ej. https://<cuenta>.r2.cloudflarestorage.com
 *        S3_BUCKET            ej. hay-fotos
 *        S3_ACCESS_KEY_ID
 *        S3_SECRET_ACCESS_KEY
 *        S3_REGION            (R2: "auto"; S3: ej. "us-east-1")
 *        PHOTOS_PUBLIC_URL    URL pública del bucket/CDN, ej. https://fotos.tudominio.com
 *
 * Sin dependencias: la firma de AWS (SigV4) está hecha con "crypto".
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const sha256hex = (d) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

// Codificación de URI exigida por AWS (todo salvo A-Z a-z 0-9 - . _ ~)
const awsEncode = (str) => encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Firma AWS Signature V4 (encabezado Authorization). Separada para poder
// verificarla contra el ejemplo oficial publicado por AWS.
function signV4({ method, path: canonicalUri, query, headers, payloadHash, amzDate, region, service, accessKeyId, secretAccessKey }) {
  const date = amzDate.slice(0, 8);
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const signedHeaders = names.join(';');
  const canonicalHeaders = names.map((h) => `${h}:${lower[h]}\n`).join('');
  const canonicalRequest = [method, canonicalUri, query || '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + secretAccessKey, date);
  const kSigning = hmac(hmac(hmac(kDate, region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function createLocalStorage({ uploadsDir }) {
  return {
    kind: 'local',
    async put(name, buf) {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, name), buf);
      return '/uploads/' + name;
    },
  };
}

function createS3Storage(cfg) {
  const endpoint = new URL(cfg.endpoint);
  const region = cfg.region || 'auto';
  const publicBase = String(cfg.publicUrl || '').replace(/\/+$/, '');

  function signedPut(key, body, contentType, now = new Date()) {
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20260925T120000Z
    const canonicalUri = '/' + [cfg.bucket, ...key.split('/')].map(awsEncode).join('/');
    const payloadHash = sha256hex(body);
    const headers = {
      'content-type': contentType,
      host: endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    headers.authorization = signV4({
      method: 'PUT', path: canonicalUri, query: '', headers, payloadHash, amzDate,
      region, service: 's3', accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey,
    });
    headers['content-length'] = body.length;
    headers['cache-control'] = 'public, max-age=31536000, immutable';
    return { path: canonicalUri, headers };
  }

  return {
    kind: 's3',
    async put(name, buf, contentType = 'image/jpeg') {
      const key = 'photos/' + name;
      const { path: p, headers } = signedPut(key, buf, contentType);
      const lib = endpoint.protocol === 'http:' ? http : https;
      await new Promise((resolve, reject) => {
        const req = lib.request(
          { method: 'PUT', hostname: endpoint.hostname, port: endpoint.port || undefined, path: p, headers, timeout: 20000 },
          (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`Almacenamiento de fotos respondió ${res.statusCode}: ${body.slice(0, 200)}`))));
          }
        );
        req.on('timeout', () => req.destroy(new Error('Tiempo de espera agotado subiendo la foto')));
        req.on('error', reject);
        req.end(buf);
      });
      return `${publicBase}/${key}`;
    },
    _signedPut: signedPut, // para pruebas
  };
}

function createStorage({ uploadsDir, env = process.env }) {
  if (env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    if (!env.PHOTOS_PUBLIC_URL) throw new Error('Falta PHOTOS_PUBLIC_URL (la dirección pública de las fotos) para usar almacenamiento S3/R2.');
    return createS3Storage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION,
      publicUrl: env.PHOTOS_PUBLIC_URL,
    });
  }
  return createLocalStorage({ uploadsDir });
}

module.exports = { createStorage, createS3Storage, signV4, awsEncode };
