#!/usr/bin/env python3
"""Baut Hand Drauf aus src/ zusammen.

    python3 tools/build.py                    -> index.html (für GitHub Pages)
    python3 tools/build.py --vorschau ZIEL    -> zusätzlich eine Fassung für die Claude-Vorschau

Die Vorschau-Fassung ist ein HTML-Fragment ohne <html>/<head> und startet immer im Demo-Modus.
"""
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SRC = WURZEL / 'src'
LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'   # nur Vorschau
LEAFLET_LOKAL = 'assets/vendor/leaflet-1.9.4.js'                                # GitHub Pages
# GitHub Pages: Schriften liegen in assets/fonts, damit keine Daten an Google gehen
SCHRIFTEN_LOKAL = ('<link rel="preload" href="assets/fonts/atkinson-hyperlegible-400.woff" as="font" type="font/woff" crossorigin>\n'
    '<style>\n'
    "@font-face { font-family: 'Bricolage Grotesque'; src: url('assets/fonts/bricolage-grotesque.woff') format('woff'); font-weight: 600 800; font-display: swap; }\n"
    "@font-face { font-family: 'Atkinson Hyperlegible'; src: url('assets/fonts/atkinson-hyperlegible-400.woff') format('woff'); font-weight: 400; font-display: swap; }\n"
    "@font-face { font-family: 'Atkinson Hyperlegible'; src: url('assets/fonts/atkinson-hyperlegible-700.woff') format('woff'); font-weight: 700; font-display: swap; }\n"
    '</style>')
# Vorschau in Claude: Google Fonts (dort sind keine eigenen Dateien möglich)
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700'
         '&family=Bricolage+Grotesque:opsz,wght@12..96,600;800&display=swap">')
# Setzt Design und Schriftgröße vor dem ersten Zeichnen, damit nichts aufblitzt
FRUEH = ('<script>try{var a=JSON.parse(localStorage.getItem("handdrauf-ansicht")||"{}"),r=document.documentElement;'
         'if(a.thema==="dunkel"||a.thema==="hell")r.setAttribute("data-theme",a.thema==="dunkel"?"dark":"light");'
         'if(a.schrift==="gross"||a.schrift==="sehr-gross")r.setAttribute("data-schrift",a.schrift)}catch(e){}</script>')


def teile(vorschau):
    leaflet_css = (SRC / 'vendor' / 'leaflet-1.9.4.css').read_text()
    styles = (SRC / 'styles.css').read_text()
    body = (SRC / 'body.html').read_text().replace('<!--KOPFZEICHEN-->', (SRC / 'kopfzeichen.svg').read_text().strip())
    app = '\n'.join((SRC / n).read_text() for n in ('symbole.js', 'recht.js', 'fragen.js', 'app.js'))
    if vorschau:
        alt = 'const VORSCHAU = false;'
        assert alt in app
        app = app.replace(alt, 'const VORSCHAU = true;')
    schriften = FONTS if vorschau else SCHRIFTEN_LOKAL
    leaflet = LEAFLET_JS if vorschau else LEAFLET_LOKAL
    kopf = f'{FRUEH}\n{schriften}\n<style>\n{leaflet_css}</style>\n<style>\n{styles}</style>'
    rumpf = f'{body}\n<script src="{leaflet}"></script>\n<script>\n{app}</script>\n'
    return kopf, rumpf


# Öffentliche Adresse der App (für die Link-Vorschau, dort sind nur volle Adressen erlaubt)
ADRESSE = 'https://z6dfczy4jt-code.github.io/Nachbarhand/'


def standalone():
    kopf, rumpf = teile(False)
    return ('<!doctype html>\n<html lang="de">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="theme-color" content="#F3F5F1">\n'
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
    if '--vorschau' in sys.argv:
        pfad = pathlib.Path(sys.argv[sys.argv.index('--vorschau') + 1])
        pfad.write_text(vorschau_fragment())
        print('Vorschau', pfad, pfad.stat().st_size, 'Bytes')
