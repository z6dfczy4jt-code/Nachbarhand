"""Vorschaubild für geteilte Links (WhatsApp, Signal, Facebook …): assets/vorschau.png, 1200 × 630.

Gestaltet als HTML mit den Schriften, dem Logo und der Miniatur der App und mit Chromium fotografiert:
    python3 design/vorschau.py
"""
import asyncio
import pathlib

from playwright.async_api import async_playwright

WURZEL = pathlib.Path(__file__).resolve().parent.parent
LOGO = (WURZEL / 'design/logo/hand-drauf-quer.svg').read_text()
SCHRIFTEN = (WURZEL / 'assets/fonts').as_uri()
BILD = (WURZEL / 'assets/garbsen-miniatur.webp').as_uri()

# Preisschilder über der Miniatur (Anteile der Bildbreite/-höhe)
SCHILDER = [('15 €', .08, .19), ('8 €', .44, .10), ('20 €', .70, .25)]

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: 'Barlow'; src: url('{SCHRIFTEN}/barlow-regular.woff') format('woff'); font-weight: 400; }}
@font-face {{ font-family: 'Barlow'; src: url('{SCHRIFTEN}/barlow-semibold.woff') format('woff'); font-weight: 600; }}
@font-face {{ font-family: 'Barlow Semi Condensed'; src: url('{SCHRIFTEN}/barlowsemicondensed-bold.woff') format('woff'); font-weight: 700; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; background: #EDF1F5; color: #1C2530; font-family: 'Barlow', sans-serif; overflow: hidden; }}
.rahmen {{ position: relative; width: 1200px; height: 630px; padding: 60px 0 0 68px; }}
.logo svg {{ width: 300px; height: auto; display: block; fill: #1C2530; }}
h1 {{ margin-top: 78px; width: 640px; white-space: nowrap; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 88px; line-height: .94; letter-spacing: -0.012em; }}
p {{ margin-top: 30px; width: 560px; font-size: 32px; line-height: 1.3; color: #36404C; }}
.schild {{ position: absolute; left: 68px; bottom: 58px; padding: 5px 18px 2px; border-radius: 7px; background: #F4B400; color: #11161C; box-shadow: inset 0 0 0 3px #11161C; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 34px; line-height: 1.15; }}
.szene {{ position: absolute; right: 44px; top: 52px; width: 470px; height: 526px; border-radius: 44px; overflow: hidden; background: linear-gradient(180deg, #B9D8EE 0%, #E7F0F6 72%); box-shadow: 0 2px 6px rgba(28, 37, 48, .06), 0 22px 50px rgba(28, 37, 48, .16); }}
.szene img {{ position: absolute; left: 50%; top: 58%; width: 112%; transform: translate(-50%, -50%); }}
.preis {{ position: absolute; padding: 5px 16px 5px 28px; border-radius: 9px; background: #F4B400; color: #11161C; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 34px; box-shadow: 0 6px 14px rgba(17, 22, 28, .28); }}
.preis::before {{ content: ''; position: absolute; left: 10px; top: 50%; width: 9px; height: 9px; margin-top: -4.5px; border-radius: 50%; background: #fff; }}
</style></head><body><div class="rahmen">
<div class="logo">{LOGO}</div>
<h1>Nachbarn helfen<br>Nachbarn.</h1>
<p>Kleine Hilfen gleich nebenan, gegen eine kleine Aufwandsentschädigung.</p>
<div class="schild">Garbsen</div>
<div class="szene"><img src="{BILD}" alt="">
  {''.join(f'<span class="preis" style="left:{x*100}%; top:{y*100}%">{t}</span>' for t, x, y in SCHILDER)}
</div>
</div></body></html>"""


async def main():
    seite = WURZEL / 'design/vorschau.html'
    seite.write_text(HTML)
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        await pg.goto(seite.as_uri())
        await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(WURZEL / 'assets/vorschau.png'))
        await br.close()
    seite.unlink()
    print('assets/vorschau.png', (WURZEL / 'assets/vorschau.png').stat().st_size, 'Bytes')


asyncio.run(main())
