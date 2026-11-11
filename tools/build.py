#!/usr/bin/env python3
"""Baut Hand Drauf aus src/ zusammen.

    python3 tools/build.py                    -> index.html (für GitHub Pages)
    python3 tools/build.py --vorschau ZIEL    -> zusätzlich eine Fassung für die Claude-Vorschau
    python3 tools/build.py --app              -> zusätzlich app/www/ für die iPhone-App (Capacitor, siehe APP-STORE.md)
    python3 tools/build.py --dist             -> zusätzlich dist/ für den eigenen Server (siehe SERVER.md)

Alle Angaben für den Betrieb (Adresse, Datenbank, Betreiber, Hosting) stehen in einstellungen.json.

Die Vorschau-Fassung ist ein HTML-Fragment ohne <html>/<head> und startet immer im Demo-Modus.
"""
import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SRC = WURZEL / 'src'
SUPABASE_VERSION = '2.110.1'
SUPABASE_CDN = f'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@{SUPABASE_VERSION}/dist/umd/supabase.js'


def fehler(text):
    sys.exit(f'\nFEHLER in einstellungen.json: {text}\n')


def einstellungen_laden():
    """einstellungen.json lesen und prüfen. Felder, die mit _ beginnen, sind Erklärungen."""
    import base64
    try:
        roh = json.loads((WURZEL / 'einstellungen.json').read_text())
    except json.JSONDecodeError as e:
        fehler(f'Die Datei ist kein gültiges JSON (Zeile {e.lineno}): {e.msg}. Oft fehlt ein Komma oder ein Anführungszeichen.')
    ohne = lambda d: {k: ohne(v) for k, v in d.items() if not k.startswith('_')} if isinstance(d, dict) else d
    e = ohne(roh)
    adresse = e.get('adresse', '')
    if not re.match(r'^https://[^/\s]+(/[^\s]*)?$', adresse) or not adresse.endswith('/'):
        fehler(f'"adresse" muss mit https:// beginnen und mit / enden, zum Beispiel https://handdrauf-garbsen.de/ (jetzt: {adresse!r})')
    sb = e.get('supabase') or {}
    key = sb.get('key', '')
    if key.startswith('sb_secret_'):
        fehler('Bei "supabase" → "key" steht ein Secret Key. Der darf niemals in die App! Den Publishable Key (sb_publishable_...) eintragen.')
    if key.count('.') == 2:
        try:
            teil = key.split('.')[1]
            inhalt = json.loads(base64.urlsafe_b64decode(teil + '=' * (-len(teil) % 4)))
            if inhalt.get('role') == 'service_role':
                fehler('Bei "supabase" → "key" steht der service_role-Key. Der darf niemals in die App! Den anon- oder Publishable Key eintragen.')
        except (ValueError, json.JSONDecodeError):
            pass
    if sb.get('url') and not re.match(r'^https://[^/\s]+$', sb['url']):
        fehler(f'"supabase" → "url" muss so aussehen: https://xxxx.supabase.co (ohne / am Ende)')
    h = e.get('hosting') or {}
    if h.get('art') not in ('github', 'server'):
        fehler('"hosting" → "art" muss "github" oder "server" sein.')
    e.setdefault('betreiber', {})
    for feld in ('name', 'anschrift', 'email', 'telefon'):
        e['betreiber'].setdefault(feld, '')
    e.setdefault('karte', {}).setdefault('carto', '')
    e.setdefault('geocoder', '')
    if e['geocoder'] and not re.match(r'^https://[^/\s]+(/[^\s]*)?$', e['geocoder']):
        fehler('"geocoder" muss mit https:// beginnen, zum Beispiel https://photon.komoot.io (leer = nur eingebaute Ortsliste)')
    # supabase-js: liegt die Datei in assets/vendor, kommt sie vom eigenen Server
    lokal = WURZEL / f'assets/vendor/supabase-js-{SUPABASE_VERSION}.js'
    e['supabaseJs'] = f'./assets/vendor/{lokal.name}' if lokal.exists() else SUPABASE_CDN
    return e


EINSTELLUNGEN = einstellungen_laden()
# Schrift: Barlow, gebaut nach den deutschen Straßenschildern (DIN 1451). Auf GitHub Pages aus assets/fonts,
# in der Vorschau von Google Fonts.
SCHRIFTEN = [('Barlow', 400, 'barlow-regular'), ('Barlow', 500, 'barlow-medium'), ('Barlow', 600, 'barlow-semibold'),
             ('Barlow Semi Condensed', 600, 'barlowsemicondensed-semibold'), ('Barlow Semi Condensed', 700, 'barlowsemicondensed-bold')]
GOOGLE_FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&display=swap">')
# Erstes Skript der Seite (bewusst altes JavaScript, läuft auch auf sehr alten Geräten):
# 1. setzt Design und Schriftgröße vor dem ersten Zeichnen, damit nichts aufblitzt
# 2. meldet technische Fehler der App an die Datenbank (public.fehler_melden), auch wenn die App auf einem
#    alten Gerät gar nicht erst startet. Ohne Namen und Inhalte, höchstens 5 je Besuch.
FRUEH = ('<script>try{var a=JSON.parse(localStorage.getItem("handdrauf-ansicht")||"{}"),r=document.documentElement;'
         'if(a.thema==="dunkel"||a.thema==="hell")r.setAttribute("data-theme",a.thema==="dunkel"?"dark":"light");'
         'if(a.schrift==="gross"||a.schrift==="sehr-gross")r.setAttribute("data-schrift",a.schrift)}catch(e){}'
         '(function(){var U=%(url)s,K=%(key)s,F=%(fassung)s,n=0,g={};if(!U||!window.addEventListener)return;'
         'function m(t,s){try{t=String(t||"");s=String(s||"");if(!t||n>=5||/ResizeObserver loop|^Script error/i.test(t)||g[t])return;g[t]=1;n++;'
         'var x=new XMLHttpRequest();x.open("POST",U+"/rest/v1/rpc/fehler_melden");x.setRequestHeader("Content-Type","application/json");'
         'x.setRequestHeader("apikey",K);x.onload=function(){if(x.status===404)n=99};'
         'x.send(JSON.stringify({p_nachricht:t.slice(0,300),p_stelle:s.slice(0,200),p_geraet:String(navigator.userAgent).slice(0,200),p_fassung:F}))}catch(e){}}'
         'window.addEventListener("error",function(e){if(!e||!e.message)return;var f=String(e.filename||"");'
         'if(f&&f.indexOf(location.protocol+"//"+location.host)!==0)return;'
         'm(e.message,f.replace(/[?#].*$/,"").split("/").pop()+":"+(e.lineno||0)+":"+(e.colno||0))});'
         'window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason,t=r&&(r.message||String(r))||"";'
         'if(/fetch|load failed|network|abort|timeout|JWT|auth/i.test(t))return;m("Promise: "+t,"")});'
         'window.hdFehler=m})();</script>')


def handschlag():
    """Das Logo als zwei Hände für die Animationen (Start und bestätigter Job).

    Die Trennlinie läuft so durch den Händedruck, dass die Faust mit den Knöcheln links
    und die offene Hand mit Daumen rechts landet. Zusammen ergeben beide Teile genau das Logo.
    """
    import re
    d = (WURZEL / 'design/handschlag.d').read_text().strip()
    linie = [(214, -40), (206, 42), (160, 86), (150, 104), (166, 118), (208, 124), (214, 176), (206, 205), (210, 290)]
    pts = lambda p: ' '.join(f'{x},{y}' for x, y in p)
    defs = (f'<path id="hs-form" fill-rule="evenodd" d="{d}"/>'
            f'<clipPath id="hs-clip-l"><polygon points="{pts([(-60, -40)] + linie + [(-60, 290)])}"/></clipPath>'
            f'<clipPath id="hs-clip-r"><polygon points="{pts(linie + [(480, 290), (480, -40)])}"/></clipPath>')
    haende = ('<g class="hs-ganz"><g class="hs-l"><use href="#hs-form" clip-path="url(#hs-clip-l)"/></g>'
              '<g class="hs-r"><use href="#hs-form" clip-path="url(#hs-clip-r)"/></g></g>'
              '<g class="hs-funken"><path d="M176 -2 158 -34"/><path d="M212 -10V-48"/><path d="M248 -2 266 -34"/>'
              '<path d="M146 22 116 6"/><path d="M280 22 310 6"/></g>')
    # Wortmarke aus dem gestapelten Logo (Hand + Drauf), Farbe folgt dem Design
    logo = (WURZEL / 'design/logo/hand-drauf.svg').read_text()
    g = re.search(r'<g fill="[^"]*" transform="([^"]+)">(.*?)</g>', logo, re.S)
    intro = (f'<svg class="hs hs-intro" viewBox="40 -90 520 460" aria-hidden="true" focusable="false">'
             f'<g transform="translate(84.8 -10.3)">{haende}</g>'
             f'<g transform="{g.group(1)}"><g class="hs-wort" fill="currentColor">{g.group(2)}</g></g></svg>')
    feier = f'<svg class="hs hs-feier" viewBox="-30 -70 480 340" aria-hidden="true" focusable="false">{haende}</svg>'
    return defs, intro, feier


def bilder():
    """Tätigkeits-Bilder (3D-Objekte aus Microsoft Fluent Emoji, MIT-Lizenz) als eingebettete Daten."""
    import base64
    eintraege = []
    for f in sorted((SRC / 'kategorien').glob('*.webp')):
        eintraege.append(f"  {f.stem}: 'data:image/webp;base64,{base64.b64encode(f.read_bytes()).decode()}'")
    return '/* Tätigkeits-Bilder: Microsoft Fluent Emoji 3D (MIT), siehe src/kategorien/LIZENZ-fluent-emoji.txt */\nconst KAT_BILDER = {\n' + ',\n'.join(eintraege) + '\n};'


def qr():
    """QR-Code zur App für „Nachbarn einladen“, immer passend zur Adresse in einstellungen.json."""
    sys.path.insert(0, str(WURZEL / 'design'))
    from qr import qr_svg
    svg = qr_svg(ADRESSE).strip()
    datei = WURZEL / 'assets/qr.svg'
    if not datei.exists() or datei.read_text().strip() != svg:
        datei.write_text(svg + '\n')
        print('Neue Adresse: assets/qr.svg erneuert. Den Aushang bitte neu erzeugen: python3 design/aushang.py')
    return 'const QR_SVG = ' + json.dumps(svg) + ';'


def inset_ausschreiben(css):
    """`inset` können Safari und iPhones erst ab Version 14.1: als top/right/bottom/left ausschreiben."""
    import re
    def ersetzen(m):
        werte = m.group(2).split()
        if len(werte) == 1:
            werte = werte * 4
        elif len(werte) == 2:
            werte = [werte[0], werte[1], werte[0], werte[1]]
        elif len(werte) == 3:
            werte = [werte[0], werte[1], werte[2], werte[1]]
        t, r_, b, l = werte
        return f'{m.group(1)}top: {t}; right: {r_}; bottom: {b}; left: {l}'
    return re.sub(r'(^|[;{\s])inset:\s*([^;}]+?)\s*(?=[;}])', ersetzen, css)


def teile(vorschau):
    styles = (SRC / 'styles.css').read_text()
    schriften = '' if vorschau else '\n'.join(
        f'@font-face {{ font-family: "{f}"; font-style: normal; font-weight: {w}; font-display: swap; src: url("assets/fonts/{d}.woff") format("woff"); }}'
        for f, w, d in SCHRIFTEN)
    styles = inset_ausschreiben(styles)
    assert '/*SCHRIFTEN*/' in styles
    styles = styles.replace('/*SCHRIFTEN*/', schriften)
    body = (SRC / 'body.html').read_text().replace('<!--KOPFZEICHEN-->', (SRC / 'kopfzeichen.svg').read_text().strip())
    defs, intro, feier = handschlag()
    body = body.replace('<!--HANDSCHLAG-DEFS-->', defs).replace('<!--INTRO-SVG-->', intro).replace('<!--FEIER-SVG-->', feier)
    import hashlib
    oeffentlich = {k: EINSTELLUNGEN[k] for k in ('adresse', 'supabase', 'push', 'betreiber', 'hosting', 'karte', 'geocoder', 'codeLogin', 'gebuehren', 'supabaseJs') if k in EINSTELLUNGEN}
    programm = '\n'.join([bilder(), qr()] + [(SRC / n).read_text() for n in ('recht.js', 'fragen.js', 'app.js')])
    # Fassung: Fingerabdruck von Programm, Aussehen und Einstellungen. Ändert sich bei jeder neuen Version.
    fassung = hashlib.sha256((programm + styles + body + json.dumps(oeffentlich, sort_keys=True)).encode()).hexdigest()[:10]
    oeffentlich['fassung'] = 'vorschau' if vorschau else fassung
    app = 'const EINSTELLUNGEN = ' + json.dumps(oeffentlich, ensure_ascii=False) + ';\n' + programm
    if vorschau:
        alt = 'const VORSCHAU = false;'
        assert alt in app
        app = app.replace(alt, 'const VORSCHAU = true;')
    schrift_kopf = GOOGLE_FONTS if vorschau else ''.join(
        f'<link rel="preload" href="assets/fonts/{d}.woff" as="font" type="font/woff" crossorigin>' for _, _, d in SCHRIFTEN if d in ('barlow-regular', 'barlowsemicondensed-bold'))
    db = {} if vorschau else EINSTELLUNGEN['supabase']
    frueh = FRUEH % {'url': json.dumps(db.get('url', '')), 'key': json.dumps(db.get('key', '')), 'fassung': json.dumps(oeffentlich['fassung'])}
    kopf = f'{frueh}\n{schrift_kopf}\n<style>\n{styles}</style>'
    rumpf = f'{body}\n<script>\n{app}</script>\n'
    return kopf, rumpf, oeffentlich['fassung']


# Öffentliche Adresse der App (für die Link-Vorschau, dort sind nur volle Adressen erlaubt)
ADRESSE = EINSTELLUNGEN['adresse']


def standalone():
    kopf, rumpf, fassung = teile(False)
    # Die App fragt diese Datei ab und sagt Bescheid, wenn es eine neue Fassung gibt
    (WURZEL / 'version.json').write_text(json.dumps({'fassung': fassung}) + '\n')
    return ('<!doctype html>\n<html lang="de">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="theme-color" content="#EDF1F5" media="(prefers-color-scheme: light)">\n'
            '<meta name="theme-color" content="#0C131D" media="(prefers-color-scheme: dark)">\n'
            '<meta name="description" content="Nachbarschaftshilfe in ganz Deutschland: kleine Hilfen in deiner Nähe finden oder selbst anfragen.">\n'
            # Link-Vorschau in WhatsApp, Signal, Facebook, Mail (Bild aus design/vorschau.py)
            '<meta property="og:type" content="website">\n'
            '<meta property="og:site_name" content="Hand Drauf">\n'
            '<meta property="og:locale" content="de_DE">\n'
            '<meta property="og:title" content="Hand Drauf: Nachbarn helfen Nachbarn">\n'
            '<meta property="og:description" content="Rasen mähen, Einkauf hochtragen, Drucker einrichten: kleine Hilfen in deiner Nähe, gegen eine kleine Aufwandsentschädigung.">\n'
            f'<meta property="og:url" content="{ADRESSE}">\n'
            f'<meta property="og:image" content="{ADRESSE}assets/vorschau.png">\n'
            '<meta property="og:image:width" content="1200">\n'
            '<meta property="og:image:height" content="630">\n'
            '<meta property="og:image:alt" content="Hand Drauf: eine kleine Nachbarschaft als Modell, darüber Preisschilder mit Beträgen">\n'
            '<meta name="twitter:card" content="summary_large_image">\n'
            '<title>Hand Drauf</title>\n'
            f'<link rel="icon" href="assets/favicon-32.png?v={kennung("favicon-32.png")}" sizes="32x32" type="image/png">\n'
            f'<link rel="icon" href="assets/favicon.svg?v={kennung("favicon.svg")}" type="image/svg+xml">\n'
            f'<link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v={kennung("apple-touch-icon.png")}">\n'
            '<link rel="manifest" href="manifest.webmanifest">\n'
            f'{kopf}\n</head>\n<body>\n{rumpf}</body>\n</html>\n')


def inhaltsrichtlinie(html, einst=None, genau_zwei=True):
    """Content-Security-Policy für den eigenen Server: erlaubt genau das, was die App braucht.

    Die beiden eingebetteten Skripte (Design vor dem ersten Zeichnen, die App selbst) werden über
    ihren Fingerabdruck (SHA-256) zugelassen, fremde Skripte nicht.
    """
    import base64
    import hashlib
    from urllib.parse import urlparse
    einst = einst or EINSTELLUNGEN
    skripte = re.findall(r'<script>(.*?)</script>', html, re.S)
    assert not genau_zwei or len(skripte) == 2, f'erwartet 2 eingebettete Skripte, gefunden {len(skripte)}'
    hashes = ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(t.encode()).digest()).decode() + "'" for t in skripte)
    cdn = einst['supabaseJs'].startswith('http')
    db = urlparse(einst['supabase']['url']).netloc if einst['supabase'].get('url') else ''
    karten = ['https://sgx.geodatenzentrum.de', 'https://tile.openstreetmap.org', 'https://tile.openstreetmap.de']
    if einst['karte'].get('carto'):
        karten.append('https://basemaps.cartocdn.com')
    teile = [
        "default-src 'self'",
        f"script-src 'self' {hashes}" + (' https://cdn.jsdelivr.net' if cdn else ''),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: " + ' '.join(karten),
        "font-src 'self'",
        "connect-src 'self'" + (f' https://{db} wss://{db}' if db else '') + (' https://cdn.jsdelivr.net' if cdn else '')
        + (' ' + einst['geocoder'].rstrip('/') if einst.get('geocoder', '').startswith('https://') else ''),
        "worker-src 'self'",
        "manifest-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
    ]
    return '; '.join(teile)


# Kopfzeilen für alle Antworten des eigenen Servers
def kopfzeilen(csp):
    return [
        ('Strict-Transport-Security', 'max-age=31536000'),
        ('X-Content-Type-Options', 'nosniff'),
        ('Referrer-Policy', 'strict-origin-when-cross-origin'),
        ('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'),
        ('X-Frame-Options', 'DENY'),
        ('Cross-Origin-Opener-Policy', 'same-origin'),
        ('Content-Security-Policy', csp),
    ]


def kennung(datei):
    """Kurzer Fingerabdruck einer Datei in assets/: Ändert sich das Symbol, holen Browser es neu (statt aus dem Zwischenspeicher)."""
    import hashlib
    return hashlib.sha256((WURZEL / 'assets' / datei).read_bytes()).hexdigest()[:8]


SEITE_404 = """<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nicht gefunden · Hand Drauf</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#EDF1F5;color:#1C2530;font:18px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:12px;background:#A3392B;color:#fff;text-decoration:none;font-weight:600}
@media (prefers-color-scheme:dark){body{background:#0C131D;color:#E8EDF3}}</style></head>
<body><main><h1 style="font-size:24px;margin:0 0 8px">Diese Seite gibt es nicht.</h1><p style="margin:0">Vielleicht ist der Link alt oder unvollständig.</p><a href="/">Zu Hand Drauf</a></main></body></html>
"""


def dist_bauen(html):
    """dist/ enthält genau die Dateien für den eigenen Server. Dazu die Kopfzeilen in server/erzeugt/."""
    import shutil
    from urllib.parse import urlparse
    dist = WURZEL / 'dist'
    # Den Ordner selbst behalten (der Server hat ihn eingebunden), nur den Inhalt erneuern
    dist.mkdir(exist_ok=True)
    for alt in dist.iterdir():
        shutil.rmtree(alt) if alt.is_dir() and not alt.is_symlink() else alt.unlink()
    (dist / 'index.html').write_text(html)
    for datei in ('sw.js', 'manifest.webmanifest', 'version.json'):
        shutil.copy(WURZEL / datei, dist / datei)
    shutil.copytree(WURZEL / 'assets', dist / 'assets')
    (dist / '404.html').write_text(SEITE_404)
    (dist / 'robots.txt').write_text('User-agent: *\nAllow: /\n')
    mail = EINSTELLUNGEN['betreiber'].get('email')
    if mail:
        from datetime import date, timedelta
        (dist / '.well-known').mkdir()
        (dist / '.well-known/security.txt').write_text(
            f'Contact: mailto:{mail}\nExpires: {(date.today() + timedelta(days=365)).isoformat()}T00:00:00.000Z\n'
            f'Preferred-Languages: de, en\nCanonical: {ADRESSE}.well-known/security.txt\n')
    csp = inhaltsrichtlinie(html)
    kz = kopfzeilen(csp)
    # Webspace mit Apache (z. B. Strato, IONOS, all-inkl): .htaccess wird mit hochgeladen
    (dist / '.htaccess').write_text(HTACCESS.replace('#KOPFZEILEN', '\n'.join(f'  Header always set {k} "{v}"' for k, v in kz)))
    # Eigener Server mit Caddy (server/Caddyfile bindet diese Datei ein)
    erzeugt = WURZEL / 'server/erzeugt'
    erzeugt.mkdir(parents=True, exist_ok=True)
    (erzeugt / 'kopfzeilen.caddy').write_text('# Erzeugt von tools/build.py --dist. Nicht von Hand ändern.\nheader {\n'
                                             + ''.join(f'\t{k} "{v}"\n' for k, v in kz) + '\t-Server\n}\n')
    (erzeugt / 'adresse.txt').write_text(urlparse(ADRESSE).netloc + '\n')
    groesse = sum(f.stat().st_size for f in dist.rglob('*') if f.is_file())
    print('Server-Dateien', dist, groesse, 'Bytes')
    if urlparse(ADRESSE).path not in ('', '/'):
        print('Hinweis: Die Adresse hat einen Unterordner. Für den eigenen Server am besten eine eigene Domain ohne Unterordner eintragen.')


HTACCESS = r"""# Hand Drauf auf einem Webspace mit Apache. Erzeugt von tools/build.py --dist.
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !=https
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
#KOPFZEILEN
  <FilesMatch "^(index\.html|sw\.js|manifest\.webmanifest)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\.(png|webp|svg|woff|js|pdf)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
  <FilesMatch "^sw\.js$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript application/json application/manifest+json image/svg+xml text/plain
</IfModule>

AddType application/manifest+json .webmanifest
AddType font/woff .woff
AddType image/webp .webp
"""


def vorschau_fragment():
    kopf, rumpf, _ = teile(True)
    return ('<title>Hand Drauf</title>\n'
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            f'{kopf}\n{rumpf}')


if __name__ == '__main__':
    ziel = WURZEL / 'index.html'
    ziel.write_text(standalone())
    print('index.html', ziel.stat().st_size, 'Bytes')
    if '--app' in sys.argv:
        import shutil
        www = WURZEL / 'app/www'
        if www.exists():
            shutil.rmtree(www)
        (www / 'assets').mkdir(parents=True)
        (www / 'index.html').write_text(ziel.read_text())
        # Alles aus assets/ außer dem Vorschaubild für geteilte Links
        shutil.copytree(WURZEL / 'assets', www / 'assets', dirs_exist_ok=True, ignore=shutil.ignore_patterns('vorschau.png'))
        print('App-Dateien', www, sum(f.stat().st_size for f in www.rglob('*') if f.is_file()), 'Bytes')
    if '--dist' in sys.argv:
        dist_bauen(ziel.read_text())
    if '--vorschau' in sys.argv:
        pfad = pathlib.Path(sys.argv[sys.argv.index('--vorschau') + 1])
        pfad.write_text(vorschau_fragment())
        print('Vorschau', pfad, pfad.stat().st_size, 'Bytes')
