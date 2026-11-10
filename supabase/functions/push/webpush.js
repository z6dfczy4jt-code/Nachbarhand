// Web Push ohne fremde Bibliotheken: VAPID (RFC 8292) und Verschlüsselung (RFC 8291, aes128gcm).
// Läuft überall, wo es WebCrypto und fetch gibt (Supabase Edge Functions, Node ab 20).

const enc = new TextEncoder();

export function b64u(bytes) {
  let s = '';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function vonB64u(text) {
  const s = atob(String(text).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, ''));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

function zusammen(...teile) {
  const laenge = teile.reduce((n, t) => n + t.length, 0);
  const aus = new Uint8Array(laenge);
  let i = 0;
  for (const t of teile) { aus.set(t, i); i += t.length; }
  return aus;
}

// Nur die Dienste der großen Browser: Sonst ließe sich die Funktion als Sprungbrett für Anfragen ins Netz missbrauchen.
const DIENSTE = /^https:\/\/(([a-z0-9-]+\.)*google\.com|([a-z0-9-]+\.)*googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)\//;
export function dienstErlaubt(endpoint) {
  return typeof endpoint === 'string' && endpoint.length <= 1000 && DIENSTE.test(endpoint);
}

// Öffentlicher Schlüssel (65 Bytes, unkomprimiert) aus einem JWK
export function oeffentlichAusJwk(jwk) {
  const x = vonB64u(jwk.x), y = vonB64u(jwk.y);
  if (x.length !== 32 || y.length !== 32) throw new Error('Schlüssel hat die falsche Länge');
  return zusammen(new Uint8Array([4]), x, y);
}

// Neues Schlüsselpaar für VAPID (einmalig bei der Einrichtung)
export async function neuesPaar() {
  const paar = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', paar.privateKey);
  const schluessel = { kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y };
  return { schluessel, oeffentlich: b64u(oeffentlichAusJwk(schluessel)) };
}

// Privaten Schlüssel laden und beweisen lassen, dass er zum erlaubten öffentlichen Schlüssel gehört:
// eine Probe-Unterschrift muss sich mit dem öffentlichen Schlüssel prüfen lassen.
export async function schluesselLaden(jwk, erlaubt) {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.d !== 'string' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('Kein gültiger Schlüssel');
  }
  const oeffentlich = oeffentlichAusJwk(jwk);
  if (b64u(oeffentlich) !== erlaubt) throw new Error('Schlüssel passt nicht');
  const privat = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const pruef = await crypto.subtle.importKey('raw', vonB64u(erlaubt), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const probe = crypto.getRandomValues(new Uint8Array(32));
  const unterschrift = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privat, probe);
  const stimmt = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pruef, unterschrift, probe);
  if (!stimmt) throw new Error('Schlüssel passt nicht');
  return { privat, oeffentlich: b64u(oeffentlich) };
}

// VAPID: unterschriebene Erklärung, wer sendet. Gilt je Dienst (Herkunft der Geräte-Adresse).
export async function vapid(geladen, herkunft, kontakt, jetzt = Math.floor(Date.now() / 1000)) {
  const kopf = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const inhalt = b64u(enc.encode(JSON.stringify({ aud: herkunft, exp: jetzt + 12 * 3600, sub: kontakt })));
  const unterschrift = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, geladen.privat, enc.encode(kopf + '.' + inhalt));
  return 'vapid t=' + kopf + '.' + inhalt + '.' + b64u(unterschrift) + ', k=' + geladen.oeffentlich;
}

async function hkdf(salz, geheim, info, laenge) {
  const k = await crypto.subtle.importKey('raw', geheim, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salz, info }, k, laenge * 8));
}

// Nachricht für genau ein Gerät verschlüsseln (RFC 8291). probe = feste Werte nur für Tests.
export async function verschluesseln(text, p256dh, auth, probe) {
  const geraet = vonB64u(p256dh);
  const geheimnis = vonB64u(auth);
  if (geraet.length !== 65 || geraet[0] !== 4 || geheimnis.length !== 16) throw new Error('Geräte-Schlüssel ungültig');
  const geraetSchluessel = await crypto.subtle.importKey('raw', geraet, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const paar = probe ? probe.paar : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const salz = probe ? probe.salz : crypto.getRandomValues(new Uint8Array(16));
  const absender = new Uint8Array(await crypto.subtle.exportKey('raw', paar.publicKey));
  const gemeinsam = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: geraetSchluessel }, paar.privateKey, 256));
  const ikm = await hkdf(geheimnis, gemeinsam, zusammen(enc.encode('WebPush: info\0'), geraet, absender), 32);
  const cek = await hkdf(salz, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salz, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const klar = zusammen(enc.encode(text), new Uint8Array([2]));   // 2 = letzter (einziger) Abschnitt
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const geheimtext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aes, klar));
  const kopf = zusammen(salz, new Uint8Array([0, 0, 16, 0]), new Uint8Array([absender.length]), absender);   // Abschnittsgröße 4096
  return zusammen(kopf, geheimtext);
}

// Eine Benachrichtigung an ein Gerät schicken. Ergebnis: 'ok', 'weg' (Gerät gibt es nicht mehr) oder 'fehler'.
export async function senden(geladen, abo, text, opt = {}) {
  if (!abo || !dienstErlaubt(abo.endpoint)) return { ergebnis: 'fehler', status: 0 };
  let koerper;
  try {
    koerper = await verschluesseln(text, abo.p256dh, abo.auth);
  } catch (e) {
    return { ergebnis: 'weg', status: 0 };   // kaputte Schlüssel werden nie funktionieren
  }
  const ziel = new URL(abo.endpoint);
  const kopf = {
    'Authorization': await vapid(geladen, ziel.origin, opt.kontakt),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'TTL': String(opt.ttl || 86400),
    'Urgency': opt.dringend ? 'high' : 'normal',
  };
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), opt.wartezeit || 6000);
  try {
    const antwort = await (opt.fetch || fetch)(abo.endpoint, { method: 'POST', headers: kopf, body: koerper, signal: abbruch.signal, redirect: 'error' });
    try { await antwort.arrayBuffer(); } catch (e) { /* Inhalt egal */ }
    if (antwort.status >= 200 && antwort.status < 300) return { ergebnis: 'ok', status: antwort.status };
    if (antwort.status === 404 || antwort.status === 410) return { ergebnis: 'weg', status: antwort.status };
    return { ergebnis: 'fehler', status: antwort.status };
  } catch (e) {
    return { ergebnis: 'fehler', status: 0 };
  } finally {
    clearTimeout(uhr);
  }
}
