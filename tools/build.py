#!/usr/bin/env python3
"""Baut Hand Drauf aus src/ zusammen.

    python3 tools/build.py                    -> index.html (für GitHub Pages)
    python3 tools/build.py --vorschau ZIEL    -> zusätzlich eine Fassung für die Claude-Vorschau
    python3 tools/build.py --app              -> zusätzlich app/www/ für die iPhone-App (Capacitor, siehe APP-STORE.md)

Die Vorschau-Fassung ist ein HTML-Fragment ohne <html>/<head> und startet immer im Demo-Modus.
"""
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SRC = WURZEL / 'src'
LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'   # nur Vorschau
LEAFLET_LOKAL = 'assets/vendor/leaflet-1.9.4.js'                                # GitHub Pages
DREI_LOKAL = './assets/vendor/three-0.170.0.module.min.js'                      # Three.js für die Miniatur
DREI_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js'  # nur Vorschau
# Schrift: Barlow, gebaut nach den deutschen Straßenschildern (DIN 1451). Auf GitHub Pages aus assets/fonts,
# in der Vorschau von Google Fonts.
SCHRIFTEN = [('Barlow', 400, 'barlow-regular'), ('Barlow', 500, 'barlow-medium'), ('Barlow', 600, 'barlow-semibold'),
             ('Barlow Semi Condensed', 600, 'barlowsemicondensed-semibold'), ('Barlow Semi Condensed', 700, 'barlowsemicondensed-bold')]
GOOGLE_FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&display=swap">')
# Setzt Design und Schriftgröße vor dem ersten Zeichnen, damit nichts aufblitzt
FRUEH = ('<script>try{var a=JSON.parse(localStorage.getItem("handdrauf-ansicht")||"{}"),r=document.documentElement;'
         'if(a.thema==="dunkel"||a.thema==="hell")r.setAttribute("data-theme",a.thema==="dunkel"?"dark":"light");'
         'if(a.schrift==="gross"||a.schrift==="sehr-gross")r.setAttribute("data-schrift",a.schrift)}catch(e){}</script>')


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


def teile(vorschau):
    leaflet_css = (SRC / 'vendor' / 'leaflet-1.9.4.css').read_text()
    styles = (SRC / 'styles.css').read_text()
    schriften = '' if vorschau else '\n'.join(
        f'@font-face {{ font-family: "{f}"; font-style: normal; font-weight: {w}; font-display: swap; src: url("assets/fonts/{d}.woff") format("woff"); }}'
        for f, w, d in SCHRIFTEN)
    assert '/*SCHRIFTEN*/' in styles
    styles = styles.replace('/*SCHRIFTEN*/', schriften)
    if vorschau:
        # Die Vorschau ist eine einzelne Datei: Standbild der Miniatur (für Geräte ohne 3D) einbetten
        import base64
        for datei in ('garbsen-miniatur.webp', 'garbsen-miniatur-nacht.webp'):
            bild = 'data:image/webp;base64,' + base64.b64encode((WURZEL / 'assets' / datei).read_bytes()).decode()
            assert styles.count(f'url("assets/{datei}")') == 1, datei
            styles = styles.replace(f'url("assets/{datei}")', f'url("{bild}")')
    body = (SRC / 'body.html').read_text().replace('<!--KOPFZEICHEN-->', (SRC / 'kopfzeichen.svg').read_text().strip())
    defs, intro, feier = handschlag()
    body = body.replace('<!--HANDSCHLAG-DEFS-->', defs).replace('<!--INTRO-SVG-->', intro).replace('<!--FEIER-SVG-->', feier)
    app = '\n'.join([bilder()] + [(SRC / n).read_text() for n in ('recht.js', 'fragen.js', 'garbsen3d.js', 'app.js')])
    if vorschau:
        alt = 'const VORSCHAU = false;'
        assert alt in app
        app = app.replace(alt, 'const VORSCHAU = true;')
        alt = f"const DREI_URL = '{DREI_LOKAL}';"
        assert alt in app
        app = app.replace(alt, f"const DREI_URL = '{DREI_CDN}';")
    leaflet = LEAFLET_JS if vorschau else LEAFLET_LOKAL
    schrift_kopf = GOOGLE_FONTS if vorschau else ''.join(
        f'<link rel="preload" href="assets/fonts/{d}.woff" as="font" type="font/woff" crossorigin>' for _, _, d in SCHRIFTEN if d in ('barlow-regular', 'barlowsemicondensed-bold'))
    kopf = f'{FRUEH}\n{schrift_kopf}\n<style>\n{leaflet_css}</style>\n<style>\n{styles}</style>'
    rumpf = f'{body}\n<script src="{leaflet}"></script>\n<script>\n{app}</script>\n'
    return kopf, rumpf


# Öffentliche Adresse der App (für die Link-Vorschau, dort sind nur volle Adressen erlaubt)
ADRESSE = 'https://z6dfczy4jt-code.github.io/Nachbarhand/'


def standalone():
    kopf, rumpf = teile(False)
    return ('<!doctype html>\n<html lang="de">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="theme-color" content="#EDF1F5" media="(prefers-color-scheme: light)">\n'
            '<meta name="theme-color" content="#0C131D" media="(prefers-color-scheme: dark)">\n'
            '<meta name="description" content="Nachbarschaftshilfe in Garbsen: kleine Hilfen in deiner Nähe finden oder selbst anfragen.">\n'
            # Link-Vorschau in WhatsApp, Signal, Facebook, Mail (Bild aus design/vorschau.py)
            '<meta property="og:type" content="website">\n'
            '<meta property="og:site_name" content="Hand Drauf">\n'
            '<meta property="og:locale" content="de_DE">\n'
            '<meta property="og:title" content="Hand Drauf: Nachbarn helfen Nachbarn in Garbsen">\n'
            '<meta property="og:description" content="Rasen mähen, Einkauf hochtragen, Drucker einrichten: kleine Hilfen in deiner Nähe, gegen eine kleine Aufwandsentschädigung.">\n'
            f'<meta property="og:url" content="{ADRESSE}">\n'
            f'<meta property="og:image" content="{ADRESSE}assets/vorschau.png">\n'
            '<meta property="og:image:width" content="1200">\n'
            '<meta property="og:image:height" content="630">\n'
            '<meta property="og:image:alt" content="Hand Drauf: Karte von Garbsen mit Anfragen und Beträgen">\n'
            '<meta name="twitter:card" content="summary_large_image">\n'
            '<title>Hand Drauf</title>\n'
            '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">\n'
            '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">\n'
            '<link rel="manifest" href="manifest.webmanifest">\n'
            f'{kopf}\n</head>\n<body>\n{rumpf}</body>\n</html>\n')


def vorschau_fragment():
    kopf, rumpf = teile(True)
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
    if '--vorschau' in sys.argv:
        pfad = pathlib.Path(sys.argv[sys.argv.index('--vorschau') + 1])
        pfad.write_text(vorschau_fragment())
        print('Vorschau', pfad, pfad.stat().st_size, 'Bytes')
