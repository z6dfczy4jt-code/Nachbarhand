"""Vorschaubild für geteilte Links (WhatsApp, Signal, Facebook …): assets/vorschau.png, 1200 × 630.

Gestaltet als HTML mit den Schriften und dem Logo der App und mit Chromium fotografiert:
    python3 design/vorschau.py
"""
import asyncio
import pathlib

from playwright.async_api import async_playwright

WURZEL = pathlib.Path(__file__).resolve().parent.parent
LOGO = (WURZEL / 'design/logo/hand-drauf-quer.svg').read_text()
SCHRIFTEN = (WURZEL / 'assets/fonts').as_uri()

# Ungefähre Lage einiger Stadtteile auf der Karte (Anteile der Kartenbreite/-höhe)
ORTE = [('Berenbostel', .60, .30), ('Garbsen-Mitte', .50, .52), ('Havelse', .66, .78), ('Altgarbsen', .30, .70),
        ('Meyenfeld', .22, .30), ('Stelingen', .82, .14)]
PINS = [('15 €', .58, .22, ''), ('8 €', .44, .46, ''), ('20 €', .27, .62, ''), ('12 €', .70, .70, ''), ('Du', .62, .51, 'du')]

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: 'Bricolage Grotesque'; src: url('{SCHRIFTEN}/bricolage-grotesque.woff') format('woff'); font-weight: 600 800; }}
@font-face {{ font-family: 'Atkinson Hyperlegible'; src: url('{SCHRIFTEN}/atkinson-hyperlegible-400.woff') format('woff'); font-weight: 400; }}
@font-face {{ font-family: 'Atkinson Hyperlegible'; src: url('{SCHRIFTEN}/atkinson-hyperlegible-700.woff') format('woff'); font-weight: 700; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; background: #F3F5F1; color: #172029; font-family: 'Atkinson Hyperlegible', sans-serif; overflow: hidden; }}
.rahmen {{ position: relative; width: 1200px; height: 630px; padding: 64px 0 0 72px; }}
.logo svg {{ width: 330px; height: auto; display: block; color: #172029; fill: currentColor; }}
h1 {{ margin-top: 70px; width: 620px; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 80px; line-height: .95; letter-spacing: -0.02em; font-variation-settings: 'opsz' 96; }}
p strong {{ color: #172029; }}
p {{ margin-top: 28px; width: 540px; font-size: 30px; line-height: 1.35; color: #3E4A55; }}
.ort {{ position: absolute; left: 72px; bottom: 50px; display: flex; gap: 12px; align-items: center; font-weight: 700; font-size: 22px; letter-spacing: .02em; }}
.ort span {{ display: inline-block; padding: 9px 18px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 2px #DCE2DA; color: #172029; }}
.ort em {{ font-style: normal; color: #5A6570; font-weight: 400; }}
.karte {{ position: absolute; right: -40px; top: 52px; width: 560px; height: 540px; border-radius: 36px; background: #E8ECE5; overflow: hidden; transform: rotate(-3deg); box-shadow: 0 2px 4px rgba(23,32,41,.06), 0 30px 60px rgba(23,32,41,.16); }}
.flaeche {{ position: absolute; border-radius: 50%; background: #D3DCCF; border: 2px solid #BCC7B8; transform: translate(-50%, -50%); }}
.name {{ position: absolute; transform: translate(-50%, -50%); font-weight: 700; font-size: 17px; color: #4F5B66; white-space: nowrap; }}
.strasse {{ position: absolute; height: 10px; background: #FFFFFF; border-radius: 5px; transform-origin: left center; opacity: .9; }}
.pin {{ position: absolute; transform: translate(-50%, -100%); padding: 9px 18px; border-radius: 999px; background: #F4B400; color: #1B1A10; border: 3px solid #fff;
       font-weight: 700; font-size: 27px; box-shadow: 0 4px 10px rgba(0,0,0,.2); }}
.pin::after {{ content: ''; position: absolute; left: 50%; top: 100%; width: 16px; height: 16px; background: inherit; border-right: 3px solid #fff; border-bottom: 3px solid #fff; transform: translate(-50%, -60%) rotate(45deg); }}
.pin.du {{ background: #2463C9; color: #fff; font-size: 22px; padding: 7px 14px; }}
</style></head><body><div class="rahmen">
<div class="logo">{LOGO}</div>
<h1>Nachbarn helfen<br>Nachbarn.</h1>
<p>Kleine Hilfen in <strong>Garbsen</strong>, gegen eine kleine Aufwandsentschädigung.</p>
<div class="ort"><span>Rasen mähen</span><span>Einkauf tragen</span><span>Technik</span></div>
<div class="karte">
  <div class="strasse" style="left:-20px; top:250px; width:640px; transform: rotate(-12deg)"></div>
  <div class="strasse" style="left:250px; top:-20px; width:620px; transform: rotate(72deg)"></div>
  <div class="strasse" style="left:40px; top:470px; width:520px; transform: rotate(-28deg); height:7px"></div>
  {''.join(f'<div class="flaeche" style="left:{x*100}%; top:{y*100}%; width:{150 + (i % 3) * 30}px; height:{150 + (i % 3) * 30}px"></div>' for i, (n, x, y) in enumerate(ORTE))}
  {''.join(f'<div class="name" style="left:{x*100}%; top:{y*100 + 9}%">{n}</div>' for n, x, y in ORTE)}
  {''.join(f'<div class="pin {k}" style="left:{x*100}%; top:{y*100}%">{t}</div>' for t, x, y, k in PINS)}
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
