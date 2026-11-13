/* Hand Drauf: Offline-Hülle
 * - Die Seite selbst: immer zuerst aus dem Netz (damit Updates sofort ankommen), ohne Netz aus dem Speicher.
 *   Der Browser fragt die Seite schon an, während der Service Worker noch startet (Navigation Preload).
 * - Bilder, Schriften und supabase-js: einmal laden, dann aus dem Speicher (die Dateien ändern sich nicht).
 * - Anfragen und Nachrichten: nie zwischenspeichern, die kommen immer frisch aus dem Netz.
 *   Die Karte zeichnet die App selbst, dafür wird nichts nachgeladen.
 * - Benachrichtigungen: zeigt an, was die Datenbank schickt, und öffnet beim Antippen die passende Anfrage.
 * Nach Änderungen an Dateien in assets/ die Versionsnummer erhöhen.
 */
const VERSION = 'handdrauf-2026-11-13a';
const HUELLE = [
  './',
  'manifest.webmanifest',
  'assets/favicon.svg',
  'assets/favicon-32.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
  'assets/badge-96.png',
  'assets/fonts/barlow-regular.woff',
  'assets/fonts/barlow-medium.woff',
  'assets/fonts/barlow-semibold.woff',
  'assets/fonts/barlowsemicondensed-semibold.woff',
  'assets/fonts/barlowsemicondensed-bold.woff',
  'assets/textur/wand-hell.png',
  'assets/textur/wand-dunkel.png',
  'assets/textur/papier-hell.png',
  'assets/textur/papier-dunkel.png',
  'assets/textur/druck.png'
];
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(HUELLE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.registration.navigationPreload && self.registration.navigationPreload.enable().catch(() => null))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  // Bei Seitenaufrufen hat der Browser schon angefragt (Navigation Preload): diese Antwort nehmen statt ein zweites Mal
  const vorab = () => (r.mode === 'navigate' && e.preloadResponse ? Promise.resolve(e.preloadResponse).catch(() => null) : Promise.resolve(null));

  // Seite: Netz zuerst, nach 4 Sekunden oder ohne Netz die gespeicherte Fassung
  // (nicht für Dateien wie den Aushang, die in einem eigenen Tab geöffnet werden)
  if (r.mode === 'navigate' && url.origin === self.location.origin && !/\/assets\//.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const netz = vorab().then((v) => v || fetch(r)).then((n) => {
        if (n.ok) cache.put('./', n.clone());
        return n;
      });
      netz.catch(() => null);
      try {
        return await Promise.race([netz, new Promise((_, nein) => setTimeout(() => nein(new Error('langsam')), 4000))]);
      } catch (err) {
        // Kein Netz oder sehr langsam: gespeicherte Seite, sonst doch auf das Netz warten
        return (await cache.match('./')) || netz;
      }
    })());
    return;
  }

  // Feste Dateien der App und die feste Version von supabase-js: Speicher zuerst
  const eigeneDatei = url.origin === self.location.origin && /\/(assets\/|manifest\.webmanifest$)/.test(url.pathname);
  if (eigeneDatei || r.url.startsWith(SUPABASE_JS)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const gespeichert = await cache.match(r);
      if (gespeichert) return gespeichert;
      const netz = (await vorab()) || await fetch(r);
      if (netz.ok || netz.type === 'opaque') cache.put(r, netz.clone());
      return netz;
    })());
  }
  // Alles andere (Datenbank): normal übers Netz
});

// Benachrichtigung anzeigen. Die Datenbank schickt: t = Titel, b = Text, l = Ziel in der App, g = Marke
// (eine neue Benachrichtigung mit derselben Marke ersetzt die ältere, statt sich zu stapeln).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  const optionen = {
    body: String(d.b || ''),
    icon: 'assets/icon-192.png',
    badge: 'assets/badge-96.png',
    lang: 'de',
    data: { link: String(d.l || '') }
  };
  if (d.g) { optionen.tag = String(d.g); optionen.renotify = true; }
  e.waitUntil(self.registration.showNotification(String(d.t || 'Hand Drauf'), optionen));
});

// Antippen: offene App nach vorn holen und die Anfrage zeigen, sonst die App mit der Anfrage öffnen
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '';
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const offen = fenster.find((f) => f.url.startsWith(self.registration.scope));
    if (offen) {
      try { await offen.focus(); } catch (err) { /* nicht jeder Browser erlaubt das */ }
      offen.postMessage({ typ: 'push-link', link });
      return;
    }
    await self.clients.openWindow(self.registration.scope + (link ? '#' + link : ''));
  })());
});
