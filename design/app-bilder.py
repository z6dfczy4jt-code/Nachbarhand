"""Bilder für die iPhone-App (Capacitor): app/resources/icon-only.png (1024 × 1024, ohne Transparenz und ohne
runde Ecken, die setzt iOS selbst) und Startbildschirme splash.png / splash-dark.png (2732 × 2732).
Daraus erzeugt `npm run app:icons` auf dem Mac alle Größen.
    python3 design/app-bilder.py
"""
import asyncio
import pathlib
import re

from playwright.async_api import async_playwright

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ZIEL = WURZEL / 'app/resources'
ICON = re.sub(r'rx="[\d.]+"', 'rx="0"', (WURZEL / 'design/logo/app-icon.svg').read_text())
LOGO = (WURZEL / 'design/logo/hand-drauf.svg').read_text()
LOGO_DUNKEL = (WURZEL / 'design/logo/hand-drauf-dunkel.svg').read_text()


def seite(inhalt, groesse, hintergrund, farbe='#172029'):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>*{{margin:0}}body{{width:{groesse}px;height:{groesse}px;'
            f'background:{hintergrund};color:{farbe};display:grid;place-items:center;overflow:hidden}}'
            f'svg{{display:block;fill:currentColor}}</style></head><body>{inhalt}</body></html>')


async def main():
    ZIEL.mkdir(parents=True, exist_ok=True)
    bilder = [
        ('icon-only.png', 1024, seite(ICON.replace('<svg ', '<svg width="1024" height="1024" ', 1), 1024, '#F3F5F1')),
        ('splash.png', 2732, seite(LOGO.replace('<svg ', '<svg width="900" ', 1), 2732, '#F3F5F1')),
        ('splash-dark.png', 2732, seite(LOGO_DUNKEL.replace('<svg ', '<svg width="900" ', 1), 2732, '#10151A', '#E8EDF1')),
    ]
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        for name, groesse, html in bilder:
            pg = await br.new_page(viewport={'width': groesse, 'height': groesse})
            await pg.set_content(html)
            await pg.screenshot(path=str(ZIEL / name), omit_background=False, type='png')
            await pg.close()
            print(name, (ZIEL / name).stat().st_size, 'Bytes')
        await br.close()
    # Das App-Store-Symbol darf keinen Alphakanal haben
    from PIL import Image
    Image.open(ZIEL / 'icon-only.png').convert('RGB').save(ZIEL / 'icon-only.png')


asyncio.run(main())
