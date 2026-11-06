import sys; sys.path.insert(0, '.')
from griff import griff, INK, GELB, WEISS
from schrift import schrift, kern_tabelle
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
BRIC = 'bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf'
PAPIER = '#F3F5F1'

def text(t, groesse, x=0, y=0):
    f = schrift(BRIC, opsz=96, wght=800, wdth=100)
    s = groesse / f['head'].unitsPerEm
    cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']; kern = kern_tabelle(f)
    namen = [cmap[ord(c)] for c in t]; pfade = []; cx = 0; xmin = 1e9; xmax = -1e9
    for i, n in enumerate(namen):
        pen = SVGPathPen(gs); gs[n].draw(TransformPen(pen, (s, 0, 0, -s, x + cx * s, y))); pfade.append(pen.getCommands())
        bp = BoundsPen(gs); gs[n].draw(bp)
        if bp.bounds: xmin = min(xmin, x + (cx + bp.bounds[0]) * s); xmax = max(xmax, x + (cx + bp.bounds[2]) * s)
        cx += hmtx[n][0] + (kern.get((n, namen[i + 1]), 0) if i + 1 < len(namen) else 0)
    return ' '.join(pfade), xmin, xmax

def siegel_inhalt(fid, ink=INK, grund=WEISS, details=True):
    """Rundes Siegel 240x240: Handschlag im Kreis, Tuschering außen."""
    return (f'<defs><clipPath id="{fid}-k"><circle cx="120" cy="120" r="112"/></clipPath></defs>'
            f'<circle cx="120" cy="120" r="112" fill="{grund}"/>'
            f'<g clip-path="url(#{fid}-k)"><g transform="translate(6 6) scale(0.82)">{griff(ink=ink, details=details, fid=fid + "-t", sw=8 if not details else 7)}</g></g>'
            f'<circle cx="120" cy="120" r="112" fill="none" stroke="{ink}" stroke-width="8"/>')

def svg(b, h, inhalt, titel='Hand drauf'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {b:.1f} {h:.1f}" role="img" aria-label="{titel}"><title>{titel}</title>{inhalt}</svg>'

def siegel(fid='hd', groesse=240, details=True):
    return svg(240, 240, siegel_inhalt(fid, details=details))

def quer(fid='hdq', farbe=INK, h=120):
    s = h / 240
    m = f'<g transform="scale({s})">{siegel_inhalt(fid)}</g>'
    groesse = h * 0.5
    d, xmin, xmax = text('Hand drauf', groesse, 0, 0)
    x = h + h * 0.13; grund = h * 0.5 + groesse * 0.36
    w = f'<path d="{d}" fill="{farbe}" transform="translate({x - xmin:.2f} {grund:.2f})"/>'
    return svg(x + xmax - xmin, h, m + w)

def gestapelt(fid='hds', farbe=INK, h=120):
    groesse = h * 0.42
    d, xmin, xmax = text('Hand drauf', groesse, 0, 0); wb = xmax - xmin
    b = max(wb, h); s = h / 240
    m = f'<g transform="translate({(b - h) / 2:.2f} 0) scale({s})">{siegel_inhalt(fid)}</g>'
    grund = h + groesse * 1.05
    w = f'<path d="{d}" fill="{farbe}" transform="translate({(b - wb) / 2 - xmin:.2f} {grund:.2f})"/>'
    return svg(b, grund + groesse * 0.1, m + w)

def app_icon(fid='hda', grund=PAPIER, details=False, groesse=512):
    s = groesse / 240 * 0.92
    tx = groesse / 2 - 140 * s; ty = groesse * 0.47 - 132 * s
    inhalt = (f'<defs><clipPath id="{fid}-r"><rect width="{groesse}" height="{groesse}" rx="{groesse*0.225}"/></clipPath></defs>'
              f'<rect width="{groesse}" height="{groesse}" rx="{groesse*0.225}" fill="{grund}"/>'
              f'<g clip-path="url(#{fid}-r)"><g transform="translate({tx:.1f} {ty:.1f}) scale({s:.4f})">{griff(details=details, sw=8, fid=fid + "-t")}</g></g>')
    return svg(groesse, groesse, inhalt)
