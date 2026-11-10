"""Aushang fürs Schwarze Brett, QR-Code und Symbol für Benachrichtigungen.

    python3 design/aushang.py

Erzeugt
    assets/qr.svg        QR-Code zur App (steckt auch im Blatt „Nachbarn einladen“)
    assets/aushang.pdf   A4-Aushang mit Zetteln zum Abreißen
    assets/badge-96.png  kleines weißes Zeichen für die Statusleiste bei Benachrichtigungen (Android)

Braucht Playwright mit Chromium. Den QR-Code baut design/qr.py selbst.
Ändert sich die Adresse der App (eigene Domain), ADRESSE in tools/build.py anpassen und neu ausführen.
"""
import asyncio
import base64
import pathlib
import re
import sys

from playwright.async_api import async_playwright

WURZEL = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL / 'tools'))
sys.path.insert(0, str(WURZEL / 'design'))
from build import ADRESSE  # noqa: E402
from qr import qr_svg  # noqa: E402

SCHRIFTEN = (WURZEL / 'assets/fonts').as_uri()
LOGO = (WURZEL / 'design/logo/hand-drauf-quer.svg').read_text()
ZEICHEN = (WURZEL / 'design/logo/hand-drauf-zeichen.svg').read_text()
TINTE = '#11161C'


def aushang_html(qr):
    bild = 'data:image/webp;base64,' + base64.b64encode((WURZEL / 'assets/garbsen-miniatur.webp').read_bytes()).decode()
    kurz = re.sub(r'^https?://', '', ADRESSE).rstrip('/')
    zettel = ''.join(f'<div class="zettel"><div class="dreh"><div class="mini-qr">{qr}</div><span><b>Hand Drauf</b>Nachbarn helfen Nachbarn in Garbsen</span></div></div>' for _ in range(8))
    return f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Hand Drauf: Aushang</title><style>
@font-face {{ font-family: 'Barlow'; src: url('{SCHRIFTEN}/barlow-regular.woff') format('woff'); font-weight: 400; }}
@font-face {{ font-family: 'Barlow'; src: url('{SCHRIFTEN}/barlow-semibold.woff') format('woff'); font-weight: 600; }}
@font-face {{ font-family: 'Barlow Semi Condensed'; src: url('{SCHRIFTEN}/barlowsemicondensed-bold.woff') format('woff'); font-weight: 700; }}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 210mm; height: 297mm; }}
body {{ position: relative; overflow: hidden; background: #fff; color: #1C2530; font-family: 'Barlow', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.blatt {{ position: absolute; inset: 0 0 56mm 0; padding: 13mm 16mm 0; display: flex; flex-direction: column; }}
.blatt > * {{ flex: none; }}
.kopf {{ display: flex; align-items: center; justify-content: space-between; }}
.logo svg {{ display: block; height: 13mm; width: auto; fill: #1C2530; }}
.schild {{ padding: 1.2mm 4.5mm 0.6mm; border-radius: 1.6mm; background: #F4B400; color: {TINTE}; box-shadow: inset 0 0 0 0.7mm {TINTE}; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 8mm; line-height: 1.15; }}
h1 {{ margin-top: 8mm; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 23mm; line-height: .92; letter-spacing: -0.01em; }}
.lead {{ margin-top: 4.5mm; font-size: 6.1mm; line-height: 1.3; color: #36404C; }}
.mitte {{ margin-top: 7mm; display: grid; grid-template-columns: 1fr 60mm; gap: 7mm; height: 84mm; }}
.szene {{ position: relative; border-radius: 8mm; overflow: hidden; background: linear-gradient(180deg, #B9D8EE 0%, #E7F0F6 72%); }}
.szene img {{ position: absolute; left: 50%; top: 56%; width: 96%; transform: translate(-50%, -50%); }}
.preis {{ position: absolute; padding: 1mm 3.6mm 1mm 6mm; border-radius: 1.8mm; background: #F4B400; color: {TINTE}; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 6.2mm; box-shadow: 0 1.2mm 3mm rgba(17, 22, 28, .28); }}
.preis::before {{ content: ''; position: absolute; left: 2mm; top: 50%; width: 1.9mm; height: 1.9mm; margin-top: -0.95mm; border-radius: 50%; background: #fff; }}
.scan {{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3mm; padding: 4mm; border-radius: 8mm; background: #fff; box-shadow: inset 0 0 0 1mm #A3392B; text-align: center; }}
.scan svg {{ display: block; width: 50mm; height: 50mm; }}
.scan b {{ font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 7mm; line-height: 1.05; color: #A3392B; }}
ol {{ margin-top: 7mm; list-style: none; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }}
li {{ display: grid; grid-template-columns: 9.5mm 1fr; gap: 3mm; align-items: start; font-size: 4.3mm; line-height: 1.3; color: #36404C; }}
li b {{ display: block; margin-bottom: 0.6mm; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 6mm; line-height: 1.1; color: #1C2530; }}
li i {{ display: grid; place-items: center; width: 9.5mm; height: 9.5mm; border-radius: 50%; background: #1C2530; color: #fff; font-style: normal; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 5.6mm; }}
.klein {{ margin-top: auto; padding: 0 0 4.5mm; display: flex; justify-content: space-between; gap: 8mm; font-size: 3.7mm; color: #586473; }}
.klein span:last-child {{ white-space: nowrap; }}
.abreissen {{ position: absolute; left: 0; right: 0; bottom: 0; height: 56mm; display: grid; grid-template-columns: repeat(8, 1fr); border-top: 0.35mm dashed #6B7684; }}
.abreissen::before {{ content: 'Zettel zum Mitnehmen'; position: absolute; left: 50%; top: -2.6mm; transform: translateX(-50%); padding: 0 3mm; background: #fff; font-size: 3.4mm; color: #586473; }}
.zettel {{ position: relative; border-left: 0.35mm dashed #6B7684; overflow: hidden; }}
.zettel:first-child {{ border-left: 0; }}
.dreh {{ position: absolute; left: 50%; top: 50%; width: 52mm; height: 23mm; margin: -11.5mm 0 0 -26mm; transform: rotate(-90deg); display: flex; align-items: center; gap: 2.5mm; }}
.mini-qr svg {{ display: block; width: 22mm; height: 22mm; }}
.dreh span {{ font-size: 3.1mm; line-height: 1.25; color: #36404C; }}
.dreh b {{ display: block; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 5.4mm; line-height: 1.15; color: #1C2530; }}
</style></head><body>
<div class="blatt">
  <div class="kopf"><div class="logo">{LOGO}</div><div class="schild">Garbsen</div></div>
  <h1>Nachbarn helfen<br>Nachbarn.</h1>
  <p class="lead">Rasen mähen, Einkauf hochtragen, Drucker einrichten: kleine Hilfen gleich nebenan, gegen eine kleine Aufwandsentschädigung.</p>
  <div class="mitte">
    <div class="szene"><img src="{bild}" alt="">
      <span class="preis" style="left: 9%; top: 12%">15 €</span><span class="preis" style="left: 44%; top: 7%">8 €</span><span class="preis" style="left: 73%; top: 17%">20 €</span></div>
    <div class="scan">{qr}<b>Scannen und<br>mitmachen</b></div>
  </div>
  <ol>
    <li><i>1</i><span><b>Code scannen</b>Mit der Handy-Kamera. Es öffnet sich eine Internetseite, ganz ohne App Store.</span></li>
    <li><i>2</i><span><b>Suchen oder helfen</b>Für dich selbst oder für jemanden aus der Familie.</span></li>
    <li><i>3</i><span><b>Hand drauf!</b>Ihr sprecht euch ab und bezahlt direkt, wenn alles erledigt ist.</span></li>
  </ol>
  <div class="klein"><span>Kostenlos in der Testphase. Ab 18 Jahren.</span><span>{kurz}</span></div>
</div>
<div class="abreissen">{zettel}</div>
</body></html>"""


async def main():
    qr = qr_svg(ADRESSE)
    (WURZEL / 'assets/qr.svg').write_text(qr)
    print('assets/qr.svg', len(qr), 'Bytes')
    seite = WURZEL / 'design/aushang.html'
    seite.write_text(aushang_html(qr_svg(ADRESSE, rand=4)))
    zeichen = WURZEL / 'design/badge.html'
    zeichen.write_text('<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:96px;height:96px;fill:#fff}'
                       'svg path{fill:#fff}</style></head><body>' + ZEICHEN + '</body></html>')
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page()
        await pg.goto(seite.as_uri())
        await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(400)
        await pg.pdf(path=str(WURZEL / 'assets/aushang.pdf'), format='A4', print_background=True, margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}, prefer_css_page_size=True)
        pg = await br.new_page(viewport={'width': 96, 'height': 96}, device_scale_factor=1)
        await pg.goto(zeichen.as_uri())
        await pg.screenshot(path=str(WURZEL / 'assets/badge-96.png'), omit_background=True)
        await br.close()
    if '--html' not in sys.argv:
        seite.unlink()
    zeichen.unlink()
    for n in ('aushang.pdf', 'badge-96.png'):
        print('assets/' + n, (WURZEL / 'assets' / n).stat().st_size, 'Bytes')


asyncio.run(main())
