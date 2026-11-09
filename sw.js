/* Hand Drauf: Offline-Hülle
 * - Die Seite selbst: immer zuerst aus dem Netz (damit Updates sofort ankommen), ohne Netz aus dem Speicher.
 * - Bilder, Leaflet und supabase-js: einmal laden, dann aus dem Speicher (die Dateien ändern sich nicht).
 * - Anfragen, Nachrichten und Kartenkacheln: nie zwischenspeichern, die kommen immer frisch aus dem Netz.
 * Nach Änderungen an Dateien in assets/ die Versionsnummer erhöhen.
 */
const VERSION = 'handdrauf-2026-11-4';
const HUELLE = [
  './',
  'manifest.webmanifest',
  'assets/favicon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
  'assets/vendor/leaflet-1.9.4.js'
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
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);

  // Seite: Netz zuerst, nach 6 Sekunden oder ohne Netz die gespeicherte Fassung
  if (r.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const netz = fetch(r).then((n) => {
        if (n.ok) cache.put('./', n.clone());
        return n;
      });
      netz.catch(() => null);
      try {
        return await Promise.race([netz, new Promise((_, nein) => setTimeout(() => nein(new Error('langsam')), 6000))]);
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
      const netz = await fetch(r);
      if (netz.ok || netz.type === 'opaque') cache.put(r, netz.clone());
      return netz;
    })());
  }
  // Alles andere (Datenbank, Kartenkacheln): normal übers Netz
});
