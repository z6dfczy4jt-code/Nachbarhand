#!/usr/bin/env python3
"""Weiterleitung von der alten Adresse (GitHub Pages) zur neuen.

    python3 tools/weiterleitung.py https://handdrauf-garbsen.de/

Erzeugt den Ordner weiterleitung/ mit index.html, 404.html und sw.js. Diese drei Dateien kommen auf die
alte Adresse (z. B. GitHub Pages aus einem eigenen Zweig gh-pages, siehe SERVER.md, Schritt 4):
- Die Seite erklärt kurz den Umzug und leitet nach wenigen Sekunden weiter (Link und Abschnitt bleiben erhalten).
- sw.js ersetzt die alte Offline-Hülle, löscht deren Speicher und meldet sich ab. So bleibt niemand auf
  einer alten, gespeicherten Fassung hängen.
"""
import html
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

SEITE = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hand Drauf ist umgezogen</title>
<link rel="canonical" href="{ziel}">
<meta name="robots" content="noindex">
<style>
body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#EDF1F5;color:#1C2530;font:18px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:24px;box-sizing:border-box}}
main{{max-width:30em}} h1{{font-size:26px;margin:0 0 12px}} p{{margin:0 0 12px}} ul{{margin:0 0 16px;padding-left:1.2em}}
a.knopf{{display:inline-block;margin-top:8px;padding:14px 22px;border-radius:12px;background:#A3392B;color:#fff;text-decoration:none;font-weight:600}}
@media (prefers-color-scheme:dark){{body{{background:#0C131D;color:#E8EDF3}}}}
</style></head>
<body><main>
<h1>Hand Drauf hat eine neue Adresse</h1>
<p>Ab jetzt findest du uns unter <strong>{kurz}</strong>. Deine Anfragen und Nachrichten sind alle noch da.</p>
<ul>
<li>Bitte dort <strong>einmal neu anmelden</strong>.</li>
<li>Hattest du „Bescheid aufs Handy“ an: dort neu einschalten.</li>
<li>Liegt Hand Drauf auf deinem Startbildschirm: das alte Symbol löschen und von der neuen Adresse neu ablegen.</li>
</ul>
<a class="knopf" id="weiter" href="{ziel}">Zur neuen Adresse</a>
<p style="margin-top:16px;font-size:15px;opacity:.75">Du wirst in wenigen Sekunden weitergeleitet.</p>
</main>
<script>
(function () {{
  var ziel = {ziel_js};
  var pfad = location.pathname.replace(/^.*?\\/Nachbarhand\\/?/, '').replace(/^\\//, '');
  var url = ziel + (pfad && pfad !== 'index.html' ? pfad : '') + location.search + location.hash;
  document.getElementById('weiter').href = url;
  setTimeout(function () {{ location.replace(url); }}, 6000);
}})();
</script>
</body></html>
"""

ABSCHALTEN = """/* Hand Drauf ist umgezogen: alte Offline-Hülle aufräumen und abmelden. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (namen) { return Promise.all(namen.map(function (n) { return caches.delete(n); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (fenster) { fenster.forEach(function (f) { f.navigate(f.url); }); })
  );
});
"""


def main():
    if len(sys.argv) != 2 or not re.match(r'^https://[^/\s]+/$', sys.argv[1]):
        sys.exit('Aufruf: python3 tools/weiterleitung.py https://neue-adresse.de/   (mit https:// und / am Ende)')
    ziel = sys.argv[1]
    ordner = WURZEL / 'weiterleitung'
    ordner.mkdir(exist_ok=True)
    import json
    seite = SEITE.format(ziel=html.escape(ziel), kurz=html.escape(ziel.split('://', 1)[1].rstrip('/')), ziel_js=json.dumps(ziel))
    (ordner / 'index.html').write_text(seite)
    (ordner / '404.html').write_text(seite)
    (ordner / 'sw.js').write_text(ABSCHALTEN)
    print('Weiterleitung nach', ziel, 'in', ordner)


if __name__ == '__main__':
    main()
