"""Symbole der App aus dem Logo (schwarzer Handschlag auf hellem Papier, wie die Vorlage).

    cd design && python3 icons.py

Erzeugt:
    assets/favicon.svg            Browser-Tab (Linien etwas kräftiger, damit sie bei 16 px nicht verschwimmen)
    assets/favicon-32.png         dasselbe als Bild für Browser ohne SVG-Symbole
    assets/apple-touch-icon.png   Startbildschirm iPhone/iPad (180 px, ohne runde Ecken, die setzt iOS selbst)
    assets/icon-192.png, -512.png Startbildschirm Android und installierte Web-App (Handschlag im sicheren Bereich)
    design/logo/app-icon.svg      Vorlage für die iPhone-App (design/app-bilder.py)
    app/resources/icon-only.png   1024 px für die iPhone-App
Danach in sw.js die Versionsnummer erhöhen.
"""
import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import marke  # noqa: E402

from playwright.async_api import async_playwright  # noqa: E402

WURZEL = pathlib.Path(__file__).resolve().parent.parent


def symbol(groesse, anteil, dicker, rund):
    """anteil: Breite des Handschlags im Verhältnis zur Kante; dicker: Linien so viele Bildpunkte kräftiger."""
    hb = groesse * anteil
    hh = hb * marke.HH / marke.HB
    rx = f' rx="{groesse * 0.225:.1f}"' if rund else ''
    inhalt = (f'<rect width="{groesse}" height="{groesse}"{rx} fill="{marke.PAPIER}"/>' +
              marke.hand((groesse - hb) / 2, (groesse - hh) / 2 + groesse * 0.01, hb, marke.TINTE, dicker))
    return marke.svg(groesse, groesse, inhalt)


# Tab: Handschlag groß, Linien 1/64 kräftiger. Startbildschirm: 74 % breit, damit Android beim Zuschneiden
# (Kreis mit 80 % Durchmesser) nichts abschneidet.
TAB = symbol(64, 0.9, 1.0, rund=True)
APP = symbol(512, 0.74, 8, rund=True)
GROSS = symbol(512, 0.74, 8, rund=False)


async def bild(br, svg, groesse, ziel, durchsichtig=False):
    pg = await br.new_page(viewport={'width': groesse, 'height': groesse})
    await pg.set_content('<!doctype html><style>*{margin:0}svg{display:block;width:%dpx;height:%dpx}</style>%s' % (groesse, groesse, svg))
    await pg.screenshot(path=str(ziel), omit_background=durchsichtig, type='png')
    await pg.close()
    print(ziel.relative_to(WURZEL), ziel.stat().st_size, 'Bytes')


async def main():
    (WURZEL / 'assets/favicon.svg').write_text(TAB)
    (WURZEL / 'design/logo/app-icon.svg').write_text(APP)
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        await bild(br, TAB, 32, WURZEL / 'assets/favicon-32.png', durchsichtig=True)
        await bild(br, GROSS, 180, WURZEL / 'assets/apple-touch-icon.png')
        await bild(br, GROSS, 192, WURZEL / 'assets/icon-192.png')
        await bild(br, GROSS, 512, WURZEL / 'assets/icon-512.png')
        (WURZEL / 'app/resources').mkdir(parents=True, exist_ok=True)
        await bild(br, GROSS, 1024, WURZEL / 'app/resources/icon-only.png')
        await br.close()


if __name__ == '__main__':
    asyncio.run(main())
