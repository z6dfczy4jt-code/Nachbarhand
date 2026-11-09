"""Logo „Hand Drauf“: nachgezeichneter Handschlag + Wortmarke in Montserrat (Hand 700, Drauf 400)."""
import sys; sys.path.insert(0, '.')
from schrift import schrift, kern_tabelle
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
MONT = 'montserrat/Montserrat[wght].ttf'
TINTE = '#172029'      # Handschlag
SCHRIFT = '#1E3138'    # Wortmarke (wie in der Vorlage)
PAPIER = '#F3F5F1'; GELB = '#F4B400'

HAND_D = open('handschlag.d').read()
HX0, HY0, HX1, HY1 = map(float, open('handschlag.bbox').read().split())
HB, HH = HX1 - HX0, HY1 - HY0          # ca. 408 x 233

def wort(t, wght, groesse, x, y):
    f = schrift(MONT, wght=wght); s = groesse / f['head'].unitsPerEm
    cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']; kern = kern_tabelle(f)
    namen = [cmap[ord(c)] for c in t]; teile = []; cx = 0; xmin = 1e9; xmax = -1e9
    for i, n in enumerate(namen):
        pen = SVGPathPen(gs); gs[n].draw(TransformPen(pen, (s, 0, 0, -s, x + cx * s, y))); teile.append(pen.getCommands())
        bp = BoundsPen(gs); gs[n].draw(bp)
        if bp.bounds: xmin = min(xmin, x + (cx + bp.bounds[0]) * s); xmax = max(xmax, x + (cx + bp.bounds[2]) * s)
        cx += hmtx[n][0] + (kern.get((n, namen[i + 1]), 0) if i + 1 < len(namen) else 0)
    return ''.join(teile), xmin, xmax

def wortmarke(cap):
    """Pfade für „Hand Drauf“ mit Grundlinie y=0, links bündig bei x=0. cap = Versalhöhe in px."""
    g = cap / 0.70                       # Montserrat: Versalhöhe 700/1000
    d1, a1, b1 = wort('Hand', 700, g, 0, 0)
    d2, a2, b2 = wort('Drauf', 400, g, 0, 0)
    luecke = cap * 39 / 73               # Abstand wie in der Vorlage
    dx2 = (b1 - a1) + luecke - a2
    return d1, d2, -a1, dx2, (b1 - a1) + luecke + (b2 - a2)

def hand(x, y, breite, farbe, dicker=0):
    s = breite / HB
    st = f' stroke="{farbe}" stroke-width="{dicker / s:.2f}" stroke-linejoin="round"' if dicker else ''
    return f'<path transform="translate({x:.2f} {y:.2f}) scale({s:.4f}) translate({-HX0:.2f} {-HY0:.2f})" d="{HAND_D}" fill="{farbe}" fill-rule="evenodd"{st}/>'

def svg(b, h, inhalt, titel='Hand Drauf', extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {b:.1f} {h:.1f}" role="img" aria-label="{titel}"{extra}><title>{titel}</title>{inhalt}</svg>'

def gestapelt(hand_farbe=TINTE, text_farbe=SCHRIFT, rand=0):
    """Wie die Vorlage: Handschlag über der Wortmarke."""
    cap = 73; d1, d2, ox, dx2, wb = wortmarke(cap)
    hb = wb * HB / 597                    # Verhältnis aus der Vorlage
    b = max(wb, hb) + 2 * rand
    hy = rand; base = hy + hb * HH / HB + 41 + 78
    hx = (b - hb) / 2; tx = (b - wb) / 2 + ox
    inhalt = (hand(hx, hy, hb, hand_farbe) +
              f'<g fill="{text_farbe}" transform="translate({tx:.2f} {base:.2f})"><path d="{d1}"/><path transform="translate({dx2:.2f} 0)" d="{d2}"/></g>')
    return svg(b, base + 2 + rand, inhalt)

def quer(hand_farbe=TINTE, text_farbe=SCHRIFT, cap=73, hand_hoehe_faktor=2.6, extra=""):
    d1, d2, ox, dx2, wb = wortmarke(cap)
    hh = cap * hand_hoehe_faktor; hb = hh * HB / HH
    h = hh; base = h / 2 + cap / 2
    tx = hb + cap * 0.55
    inhalt = (hand(0, 0, hb, hand_farbe) +
              f'<g fill="{text_farbe}" transform="translate({tx + ox:.2f} {base:.2f})"><path d="{d1}"/><path transform="translate({dx2:.2f} 0)" d="{d2}"/></g>')
    return svg(tx + wb, h, inhalt, extra=extra)

def zeichen(farbe=TINTE, dicker=0):
    return svg(HB + dicker, HH + dicker, hand(dicker / 2, dicker / 2, HB, farbe, dicker))

def app_icon(groesse=512, grund=PAPIER, farbe=TINTE, rund=True, dicker=0):
    hb = groesse * 0.74; hh = hb * HH / HB
    inhalt = (f'<rect width="{groesse}" height="{groesse}" rx="{groesse * 0.225 if rund else 0}" fill="{grund}"/>' +
              hand((groesse - hb) / 2, (groesse - hh) / 2 + groesse * 0.01, hb, farbe, dicker))
    return svg(groesse, groesse, inhalt)
