#!/usr/bin/env python3
"""Baut Nachbarhand aus src/ zusammen.

    python3 tools/build.py                    -> index.html (für GitHub Pages)
    python3 tools/build.py --vorschau ZIEL    -> zusätzlich eine Fassung für die Claude-Vorschau

Die Vorschau-Fassung ist ein HTML-Fragment ohne <html>/<head> und startet immer im Demo-Modus.
"""
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SRC = WURZEL / 'src'
LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700'
         '&family=Bricolage+Grotesque:opsz,wght@12..96,600;800&display=swap">')


def teile(vorschau):
    leaflet_css = (SRC / 'vendor' / 'leaflet-1.9.4.css').read_text()
    styles = (SRC / 'styles.css').read_text()
    body = (SRC / 'body.html').read_text()
    app = (SRC / 'app.js').read_text()
    if vorschau:
        alt = 'const VORSCHAU = false;'
        assert alt in app
        app = app.replace(alt, 'const VORSCHAU = true;')
    kopf = f'{FONTS}\n<style>\n{leaflet_css}</style>\n<style>\n{styles}</style>'
    rumpf = f'{body}\n<script src="{LEAFLET_JS}"></script>\n<script>\n{app}</script>\n'
    return kopf, rumpf


def standalone():
    kopf, rumpf = teile(False)
    return ('<!doctype html>\n<html lang="de">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="theme-color" content="#F3F5F1">\n'
            '<meta name="description" content="Nachbarschaftshilfe in Garbsen: kleine Jobs in deiner Nähe finden oder Hilfe suchen.">\n'
            '<title>Nachbarhand</title>\n'
            f'{kopf}\n</head>\n<body>\n{rumpf}</body>\n</html>\n')


def vorschau_fragment():
    kopf, rumpf = teile(True)
    return ('<title>Nachbarhand</title>\n'
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
