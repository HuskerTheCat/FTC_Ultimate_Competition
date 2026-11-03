// The push relay: a Cloudflare Worker that sends "<name> asked where you are" to a teammate's phone (the Find tab).
// The website can't send a push itself, because sending needs the private VAPID key. The relay keeps nothing: the app
// posts { subscription, from } and the relay encrypts the fixed message (RFC 8291) and signs the request (RFC 8292).
// Set up once, see relay/README.md. Secret VAPID_PRIVATE_KEY holds the private key as a JWK.

// Only the app's website may call the relay, and only the browsers' push services are ever contacted.
const ALLOWED_ORIGIN = 'https://huskerthecat.github.io';
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/];
const CONTACT = 'https://github.com/HuskerTheCat/FTC_Ultimate_Competition';

const encoder = new TextEncoder();
const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const toBase64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// The message encrypted for one subscription (RFC 8291, aes128gcm): only that browser can read it.
export async function encrypt(message, { p256dh, auth }) {
  const userPublic = fromBase64Url(p256dh);
  const userKey = await crypto.subtle.importKey('raw', userPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, local.privateKey, 256));
  const ikm = await hkdf(fromBase64Url(auth), shared, concat(encoder.encode('WebPush: info\0'), userPublic, localPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the message and the last-record delimiter.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(encoder.encode(message), new Uint8Array([2]))));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, recordSize, new Uint8Array([localPublic.length]), localPublic, sealed);
}

// The Authorization header that proves the push comes from the app (RFC 8292).
export async function vapidHeader(endpoint, privateJwk) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const json = (value) => toBase64Url(encoder.encode(JSON.stringify(value)));
  const unsigned = `${json({ typ: 'JWT', alg: 'ES256' })}.${json({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACT })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned));
  const publicKey = toBase64Url(concat(new Uint8Array([4]), fromBase64Url(privateJwk.x), fromBase64Url(privateJwk.y)));
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${publicKey}`;
}

const CORS = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' };
const reply = (status, text) => new Response(text, { status, headers: CORS });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST' || request.headers.get('Origin') !== ALLOWED_ORIGIN) return reply(403, 'Not allowed');
    const { subscription, from } = await request.json();
    const endpoint = new URL(subscription?.endpoint);
    if (endpoint.protocol !== 'https:' || !PUSH_HOSTS.some((host) => host.test(endpoint.hostname))) return reply(400, 'Not a push service');
    if (typeof from !== 'string' || !from || from.length > 40) return reply(400, 'Bad name');

    const message = JSON.stringify({ title: 'Where are you?', body: `${from} asked where you are. Tap to answer.` });
    const sent = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(endpoint.href, JSON.parse(env.VAPID_PRIVATE_KEY)),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '3600',
        Urgency: 'high',
      },
      body: await encrypt(message, subscription.keys),
    });
    // 404 and 410 mean the teammate turned alerts off on that device.
    return reply(sent.status, await sent.text());
  },
};
