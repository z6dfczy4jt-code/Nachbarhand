"""Tätigkeits-Bilder von Hand Drauf: gezeichnet wie das Logo (Tusche), gedruckt wie ein Aushang (Risodruck).

    cd design && python3 bilder.py            -> src/kategorien/*.webp (für die App)
    cd design && python3 bilder.py --blatt    -> zusätzlich design/bilder/uebersicht.png zum Ansehen

Jedes Bild ist ein Aufkleber: weißer Rand mit Schatten, darauf Farbflächen mit Druckkorn, leicht versetzt
zur Tuschelinie (wie beim Risodruck, wo jede Farbe einzeln gedruckt wird), Schraffur als Schatten, und eine
Tuschelinie, die ein wenig zittert wie von Hand gezogen. Alles als SVG beschrieben (design/bilder/*.svg)
und beim Bauen in Bilder umgewandelt, damit das Handy nichts rechnen muss.
"""
import asyncio
import io
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ZIEL = WURZEL / 'src/kategorien'
QUELLE = WURZEL / 'design/bilder'

TINTE = '#1E2A36'
F = {
    'raps': '#F2B11E', 'klinker': '#C24A30', 'klinker2': '#9E3A26', 'hecke': '#4F9A5C', 'hecke2': '#3B7A47',
    'himmel': '#8DBEE0', 'kraft': '#CFA066', 'kraft2': '#B4844B', 'sand': '#F1DFB8', 'papier': '#FCFBF7',
    'grau': '#B9C2CB', 'rosa': '#EE9C8C', 'holz': '#D39B5A', 'nacht': '#3D5A80',
}

DEFS = f'''
<filter id="zittern" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="SEED" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="korn" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="SEED" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 10.6" result="loch"/>
  <feComposite in="SourceGraphic" in2="loch" operator="in" result="gedruckt"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="SEED" result="w"/>
  <feColorMatrix in="w" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0.62" result="wolke"/>
  <feComposite in="gedruckt" in2="wolke" operator="in"/>
</filter>
<filter id="schatten" x="-20%" y="-20%" width="140%" height="150%">
  <feDropShadow dx="1.2" dy="3.2" stdDeviation="2.2" flood-color="{TINTE}" flood-opacity=".30"/>
</filter>
<pattern id="schraffur" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
  <line x1="0" y1="0" x2="0" y2="4.2" stroke="{TINTE}" stroke-width="1.25"/>
</pattern>
'''


def bild(form, flaechen, schatten, linien, seed=3, drehung=0):
    """form: Umriss für den Aufkleber; flaechen: [(d, farbe)]; schatten: Pfade für Schraffur; linien: Tusche."""
    # Einträge mit „<“ am Anfang sind fertige SVG-Elemente (z. B. gedrehte Gruppen)
    pfade = lambda ds, extra='': ''.join(d if d.startswith('<') else f'<path d="{d}"{extra}/>' for d in ds)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">'
            f'<defs>{DEFS.replace("SEED", str(seed))}</defs>'
            f'<g transform="rotate({drehung} 60 60)">'
            # Aufkleber: weißer Rand um alles, mit Schatten
            f'<g filter="url(#schatten)"><g fill="{F["papier"]}" stroke="{F["papier"]}" stroke-width="13" stroke-linejoin="round" stroke-linecap="round">{pfade(form)}</g></g>'
            # Farbflächen mit Druckkorn, etwas versetzt
            f'<g transform="translate(1.6 1.4)" filter="url(#korn)">' + ''.join(d if d.startswith('<') else f'<path d="{d}" fill="{F.get(c, c)}"/>' for d, c in flaechen) + '</g>'
            # Schatten als Schraffur
            f'<g fill="url(#schraffur)" opacity=".55" filter="url(#zittern)">{pfade(schatten)}</g>'
            # Tusche
            f'<g fill="none" stroke="{TINTE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#zittern)">{pfade(linien)}</g>'
            '</g></svg>')


BILDER = {}

# Alle: Haus mit Klinkerdach, Licht in den Fenstern
BILDER['alle'] = bild(
    form=['M14 64 L60 18 L106 64 L94 66 L94 100 L26 100 L26 66 Z', 'M74 24 h13 v24 h-13 Z'],
    flaechen=[('M30 62 L60 36 L90 62 L90 98 L30 98 Z', 'sand'),
              ('M16 64 L60 20 L104 64 L92 68 L60 38 L28 68 Z', 'klinker'),
              ('M75 26 h11 v20 l-11 -9 Z', 'klinker2'),
              ('M36 72 h12 v12 h-12 Z', 'raps'), ('M72 72 h12 v12 h-12 Z', 'raps'),
              ('M53 77 h14 v21 h-14 Z', 'hecke')],
    schatten=['M30 66 L60 40 L90 66 L90 73 L60 48 L30 73 Z', 'M80 76 h4 v8 h-4 Z', 'M86 28 h-4 v14 l4 3 Z'],
    linien=['M15 64 Q38 41 60 19 Q82 41 105 64', 'M28 67 L60 38 L92 67', 'M15 64 L28 67 M105 64 L92 67',
            'M29 66 L29 98 Q60 99.5 91 98 L91 66',
            'M74 40 L74 25 Q80 24 87 25 L87 47',
            'M36 72 h12 v12 h-12 Z', 'M42 72 v12 M36 78 h12', 'M72 72 h12 v12 h-12 Z', 'M78 72 v12 M72 78 h12',
            'M53 98 L53 77 Q60 76 67 77 L67 98', 'M63 88 l0 .1', 'M12 99 Q60 102 108 99',
            'M33 58 l7 -6 M46 46 l6 -5 M66 42 l6 5 M80 55 l6 5'],
    seed=4, drehung=-3)

# Tiere: freundlicher Hundekopf mit Schlappohren
BILDER['tiere'] = bild(
    form=['M60 22 C82 22 96 36 96 60 C96 84 80 100 60 100 C40 100 24 84 24 60 C24 36 38 22 60 22 Z',
          'M28 34 C14 40 12 66 22 76 C30 70 34 52 36 40 Z', 'M92 34 C106 40 108 66 98 76 C90 70 86 52 84 40 Z'],
    flaechen=[('M60 26 C80 26 92 39 92 60 C92 82 78 96 60 96 C42 96 28 82 28 60 C28 39 40 26 60 26 Z', 'raps'),
              ('M28 36 C17 42 15 64 23 72 C29 67 33 52 35 41 Z', 'kraft2'),
              ('M92 36 C103 42 105 64 97 72 C91 67 87 52 85 41 Z', 'kraft2'),
              ('M44 64 C44 54 76 54 76 64 C76 80 66 88 60 88 C54 88 44 80 44 64 Z', 'papier'),
              ('M56 80 q4 12 9 0 Z', 'rosa'),
              ('M66 34 c9 -2 15 5 12 13 c-7 2 -13 -4 -12 -13 Z', 'kraft')],
    schatten=['M78 40 C88 48 90 66 84 80 C80 70 80 54 74 44 Z'],
    linien=['M36 40 C40 30 50 25 60 25 C72 25 81 31 85 40', 'M30 52 C28 70 36 92 60 96 C84 92 92 70 90 52',
            'M35 39 C22 42 15 62 23 74 C31 70 34 54 36 41', 'M85 39 C98 42 105 62 97 74 C89 70 86 54 84 41',
            'M46 50 q1.5 -1 3 0', 'M71 50 q1.5 -1 3 0', 'M47.5 53 l0 .1', 'M72.5 53 l0 .1',
            'M54 66 q6 5 12 0 q-6 -3 -12 0 Z',
            'M60 70 v6 M60 76 q-5 5 -10 2 M60 76 q5 5 10 2', 'M56 80 q4 12 9 0'],
    seed=7, drehung=3)

# Garten: Gießkanne, es tröpfelt
BILDER['garten'] = bild(
    form=['M44 44 H84 Q90 44 90 50 L92 94 Q92 100 86 100 H44 Q38 100 38 94 L38 50 Q38 44 44 44 Z',
          'M86 48 Q108 48 108 68 Q108 90 88 90 Z', 'M46 46 Q64 22 86 46 Z', 'M42 88 L12 50 L4 42 L16 31 L24 42 L42 70 Z',
          'M0 58 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M2 70 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'],
    flaechen=[('M88 50 Q106 50 106 68 Q106 88 88 88 L88 79 Q97 79 97 68 Q97 59 88 59 Z', 'hecke2'),
              ('M47 46 Q64 26 84 46 L77 46 Q64 35 54 46 Z', 'hecke2'),
              ('M42 85 L14 50 L19 46 L42 74 Z', 'hecke'),
              ('M8 43 L17 34 L24 42 L15 51 Z', 'hecke2'),
              ('M44 47 H83 Q87 47 87 51 L89 93 Q89 97 85 97 H45 Q41 97 41 93 L41 51 Q41 47 45 47 Z', 'hecke'),
              ('M41 62 H88 L88.4 70 H41 Z', 'hecke2'),
              ('M8 58 q-3 5 0 7 q3 -2 0 -7 Z M14 66 q-3 5 0 7 q3 -2 0 -7 Z M5 70 q-3 5 0 7 q3 -2 0 -7 Z', 'himmel')],
    schatten=['M78 48 h6 q3 0 3 4 l2 41 q0 3 -3 3 h-5 Z'],
    linien=['M44 46 H84 Q89 46 89 51 L91 93 Q91 98 86 98 H44 Q39 98 39 93 L39 51 Q39 46 44 46',
            'M89 51 Q107 51 107 68 Q107 89 90 89', 'M90 58 Q98 58 98 68 Q98 80 90 80',
            'M47 46 Q64 25 85 46', 'M55 46 Q64 36 77 46',
            'M40 86 L14 51 M40 72 L20 45', 'M7 43 L17 33 L25 42 L14 52 Z',
            'M40 62 H89 M40 70 H90',
            'M8 58 q-3 5 0 7 q3 -2 0 -7', 'M14 66 q-3 5 0 7 q3 -2 0 -7', 'M5 70 q-3 5 0 7 q3 -2 0 -7'],
    seed=11, drehung=-3)

# Einkaufen: Stoffbeutel mit Baguette und Lauch
BILDER['einkaufen'] = bild(
    form=['M26 52 L94 52 L98 102 L22 102 Z', '<g transform="rotate(-22 46 40)"><path d="M38 6 h15 v64 h-15 Z"/></g>',
          'M66 54 L70 26 L64 10 L80 18 L84 6 L92 24 L84 54 Z'],
    flaechen=[('<g transform="rotate(-22 46 40)"><path d="M39 8 Q45.5 3 52 8 L52 60 H39 Z" fill="#D9A15C"/></g>', ''),
              ('M68 54 L71 30 L66 14 L78 21 L83 10 L89 25 L83 54 Z', 'hecke'),
              ('M70 50 h12 v6 h-12 Z', 'papier'),
              ('M28 52 L92 52 L96 100 L24 100 Z', 'sand'),
              ('M50 70 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'klinker')],
    schatten=['M78 54 L92 54 L96 100 L84 100 Z'],
    linien=['<g transform="rotate(-22 46 40)"><path d="M39 52 L39 9 Q45.5 3 52 9 L52 52"/><path d="M41 18 l9 -4 M41 28 l9 -4 M41 38 l9 -4"/></g>',
            'M69 52 L71 30 L66 14 L78 21 L83 10 L89 25 L83 52', 'M75 32 v20 M79 30 v22',
            'M27 52 L93 52 L97 101 Q60 103 23 101 Z',
            'M38 52 Q38 36 47 36 Q56 36 56 52', 'M64 52 Q64 36 73 36 Q82 36 82 52',
            'M50 70 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0'],
    seed=5, drehung=2)

# Haushalt: Hammer und Schraubendreher über Kreuz
BILDER['haushalt'] = bild(
    form=['<g transform="rotate(-38 60 60)"><path d="M54 30 h12 v74 h-12 Z M38 14 h44 v20 h-44 Z"/></g>',
          '<g transform="rotate(40 60 60)"><path d="M53 16 h14 v38 h-14 Z M58 54 h4 v46 h-4 Z"/></g>'],
    flaechen=[('<g transform="rotate(40 60 60)"><path d="M53 18 Q60 12 67 18 V52 H53 Z" fill="#C24A30"/><path d="M57 54 h6 v42 l-3 6 l-3 -6 Z" fill="#B9C2CB"/></g>', ''),
              ('<g transform="rotate(-38 60 60)"><path d="M55 34 h10 v68 q-5 3 -10 0 Z" fill="#D39B5A"/><path d="M38 16 h44 v16 h-44 Z" fill="#8E9AA6"/></g>', '')],
    schatten=['<g transform="rotate(-38 60 60)"><path d="M62 34 h3 v68 h-3 Z M38 27 h44 v5 h-44 Z"/></g>'],
    linien=['<g transform="rotate(40 60 60)"><path d="M53 52 V19 Q60 12 67 19 V52 Z M56 22 v26 M60 21 v28 M64 22 v26"/><path d="M57 53 v43 l3 6 l3 -6 v-43"/></g>',
            '<g transform="rotate(-38 60 60)"><path d="M55 33 V102 Q60 105 65 102 V33"/><path d="M38 16 H82 V32 H38 Z M46 16 v16"/></g>'],
    seed=9, drehung=0)

# Tragen: Umzugskarton mit Klebeband
BILDER['tragen'] = bild(
    form=['M20 46 L52 34 L100 44 L100 90 L70 102 L20 92 Z'],
    flaechen=[('M22 48 L70 58 L70 100 L22 90 Z', 'kraft'),
              ('M70 58 L98 47 L98 89 L70 100 Z', 'kraft2'),
              ('M22 48 L52 37 L98 47 L70 58 Z', '#E2B97F'),
              ('M36 43 L64 53 L74 49 L46 39 Z', 'raps'),
              ('M36 43 L64 53 L64 66 L36 56 Z', 'raps'),
              ('M30 66 h18 v12 h-18 Z', 'papier')],
    schatten=['M70 58 L98 47 L98 89 L70 100 Z'],
    linien=['M22 48 L70 58 L70 100 L22 90 Z', 'M70 58 L98 47 L98 89 L70 100', 'M22 48 L52 37 L98 47',
            'M36 43 L64 53 L64 66 L36 56 Z', 'M64 53 L74 49',
            'M31 66 l17 3 v11 l-17 -3 Z', 'M34 71 h9 M34 75 h6',
            'M56 72 v12 M53 75 l3 -3 l3 3 M62 74 v12 M59 77 l3 -3 l3 3'],
    seed=13, drehung=-2)

# Technik: Laptop mit WLAN
BILDER['technik'] = bild(
    form=['M24 26 H96 Q101 26 101 31 V78 H19 V31 Q19 26 24 26 Z', 'M8 78 H112 L104 94 H16 Z'],
    flaechen=[('M23 29 H97 V76 H23 Z', 'nacht'),
              ('M10 79 H110 L103 92 H17 Z', 'grau'),
              ('M50 79 h20 l-2 4 h-16 Z', '#8E9AA6')],
    schatten=['M17 86 H103 L103 92 H17 Z'],
    linien=['M24 27 H96 Q100 27 100 31 V78 H20 V31 Q20 27 24 27 Z', 'M28 33 H92 V72 H28 Z',
            'M9 79 H111 L104 93 Q60 95 16 93 Z', 'M50 79 l2 4 h16 l2 -4',
            '<g stroke="#F2B11E" stroke-width="4"><path d="M46 52 Q60 40 74 52"/><path d="M51 58 Q60 51 69 58"/><path d="M59.5 64 l0 .1" stroke-width="6"/></g>'],
    seed=6, drehung=3)

# Stecknadel: Pinnnadel wie am Schwarzen Brett, schräg eingesteckt
_PIN = '<g transform="rotate(24 60 62)">%s</g>'
BILDER['stecknadel'] = bild(
    form=[_PIN % '<path d="M42 30 Q42 12 60 12 Q78 12 78 30 L71 48 L84 56 Q84 66 60 66 Q36 66 36 56 L49 48 Z M57 64 h6 v40 h-6 Z"/>'],
    flaechen=[(_PIN % '<path d="M58.5 66 h3 v34 l-1.5 4 l-1.5 -4 Z" fill="#B9C2CB"/>', ''),
              (_PIN % '<path d="M44 30 Q44 14 60 14 Q76 14 76 30 L69 48 L82 56 Q82 64 60 64 Q38 64 38 56 L51 48 Z" fill="#C24A30"/>', ''),
              (_PIN % '<path d="M48 22 Q52 17 58 17 L56 26 Q51 27 48 30 Z" fill="#E9826C"/>', '')],
    schatten=[_PIN % '<path d="M68 18 Q76 22 76 30 L69 48 L82 56 Q82 62 72 63 L66 50 L70 30 Z"/>'],
    linien=[_PIN % '<path d="M44 30 Q44 13 60 13 Q76 13 76 30 L69 48 M44 30 L51 48 M51 48 Q60 51 69 48 M51 48 L38 56 Q38 65 60 65 Q82 65 82 56 L69 48 M38 56 Q60 61 82 56"/><path d="M60 66 V102"/>',
            ],
    seed=2, drehung=0)

# Winken: offene Hand mit Bewegung
BILDER['winken'] = bild(
    form=['M92 30 q8 8 6 20', 'M100 24 q10 12 6 28', 'M22 34 q-6 8 -4 18', '<g transform="rotate(-14 60 64)"><path d="M44 108 L40 84 L24 66 L32 58 L42 66 L42 26 L52 22 L52 18 L62 18 L62 24 L72 24 L72 34 L82 34 L82 84 L76 108 Z"/></g>'],
    flaechen=[('<g transform="rotate(-14 60 64)"><path d="M46 106 L42 84 L27 67 Q29 61 34 62 L44 70 L44 32 Q44 26 48.5 26 Q53 26 53 32 L53 24 Q53 20 57.5 20 Q62 20 62 24 L62 28 Q62 24 66.5 24 Q71 24 71 30 L71 38 Q71 34 75.5 34 Q80 34 80 40 L80 82 L74 106 Z" fill="#F2B11E"/></g>', '')],
    schatten=['<g transform="rotate(-14 60 64)"><path d="M72 46 L80 46 L80 82 L74 104 L70 104 Z"/></g>'],
    linien=['<g transform="rotate(-14 60 64)"><path d="M45 105 L42 84 L27 67 Q29 61 34 62 L44 70 L44 32 Q44 26 48.5 26 Q53 26 53 32 L53 62 M53 32 L53 24 Q53 20 57.5 20 Q62 20 62 24 L62 61 M62 30 Q62 24 66.5 24 Q71 24 71 30 L71 62 M71 40 Q71 34 75.5 34 Q80 34 80 40 L80 82 L74 105"/></g>',
            'M92 30 q8 8 6 20', 'M100 24 q10 12 6 28', 'M22 34 q-6 8 -4 18'],
    seed=8, drehung=0)


async def rendern(name, svg, groesse):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(viewport={'width': 120, 'height': 120}, device_scale_factor=groesse * 2 / 120)
        await pg.set_content('<!doctype html><style>*{margin:0}svg{display:block}</style>' + svg)
        png = await pg.screenshot(omit_background=True, type='png')
        await br.close()
    from PIL import Image
    im = Image.open(io.BytesIO(png)).convert('RGBA').resize((groesse, groesse), Image.LANCZOS)
    return im


async def main():
    from PIL import Image
    QUELLE.mkdir(exist_ok=True)
    groesse = 112
    bilder = {}
    for name, svg in BILDER.items():
        (QUELLE / f'{name}.svg').write_text(svg)
        im = await rendern(name, svg, groesse)
        bilder[name] = im
        if '--nur-blatt' not in sys.argv:
            im.save(ZIEL / f'{name}.webp', 'WEBP', quality=80, method=6)
            print(name, (ZIEL / f'{name}.webp').stat().st_size, 'Bytes')
    if '--blatt' in sys.argv or '--nur-blatt' in sys.argv:
        # Übersicht in drei Größen auf Papier- und dunklem Grund
        blatt = Image.new('RGBA', (len(bilder) * 160 + 20, 420), '#E9ECE6')
        dunkel = Image.new('RGBA', (len(bilder) * 160 + 20, 140), '#141B24')
        for i, (n, im) in enumerate(bilder.items()):
            blatt.alpha_composite(im, (20 + i * 160, 10))
            blatt.alpha_composite(im.resize((56, 56), Image.LANCZOS), (20 + i * 160, 180))
            blatt.alpha_composite(im.resize((40, 40), Image.LANCZOS), (90 + i * 160, 188))
            blatt.alpha_composite(im.resize((24, 24), Image.LANCZOS), (20 + i * 160, 260))
            dunkel.alpha_composite(im.resize((112, 112), Image.LANCZOS), (20 + i * 160, 14))
        gesamt = Image.new('RGBA', (blatt.width, blatt.height + dunkel.height), 'white')
        gesamt.alpha_composite(blatt, (0, 0)); gesamt.alpha_composite(dunkel, (0, blatt.height))
        gesamt.save(QUELLE / 'uebersicht.png')
        print('Übersicht', QUELLE / 'uebersicht.png')


if __name__ == '__main__':
    asyncio.run(main())
