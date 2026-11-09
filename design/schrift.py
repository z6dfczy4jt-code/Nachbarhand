"""Setzt Text aus Bricolage Grotesque als SVG-Pfade (mit Kerning aus der Schrift)."""
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import functools

FONTS = '/tmp/claude-0/-home-claude/78f397be-ba23-569e-a338-ff688ea7efca/scratchpad/gfonts/ofl/'

@functools.lru_cache(None)
def schrift(datei, **achsen):
    f = TTFont(FONTS + datei)
    if 'fvar' in f:
        f = instantiateVariableFont(f, achsen, inplace=False)
    return f

def kern_tabelle(f):
    paare = {}
    if 'GPOS' not in f: return paare
    gpos = f['GPOS'].table
    kern_lookups = set()
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == 'kern': kern_lookups.update(fr.Feature.LookupListIndex)
    def verarbeite(st):
        if st.LookupType == 9: st = st.ExtSubTable
        if st.Format == 1:
            for i, g1 in enumerate(st.Coverage.glyphs):
                for pvr in st.PairSet[i].PairValueRecord:
                    v = pvr.Value1.XAdvance if pvr.Value1 and hasattr(pvr.Value1, 'XAdvance') else 0
                    paare.setdefault((g1, pvr.SecondGlyph), v or 0)
        elif st.Format == 2:
            k1 = st.ClassDef1.classDefs if st.ClassDef1 else {}
            k2 = st.ClassDef2.classDefs if st.ClassDef2 else {}
            for g1 in st.Coverage.glyphs:
                c1 = k1.get(g1, 0)
                rec = st.Class1Record[c1]
                for g2, c2 in list(k2.items()):
                    v = rec.Class2Record[c2].Value1
                    x = getattr(v, 'XAdvance', 0) if v else 0
                    if x: paare.setdefault((g1, g2), x)
    for li in kern_lookups:
        lk = gpos.LookupList.Lookup[li]
        for st in lk.SubTable:
            if lk.LookupType in (2, 9): verarbeite(st)
    return paare

def text_pfad(text, datei, groesse, x=0, y=0, sperrung=0, **achsen):
    """Liefert (svg-d, breite) für Text mit Grundlinie bei y."""
    f = schrift(datei, **tuple(sorted(achsen.items())) and achsen)
    upm = f['head'].unitsPerEm; skala = groesse / upm
    cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']
    kern = kern_tabelle(f)
    namen = [cmap[ord(c)] for c in text]
    pfade = []; cx = 0
    for i, n in enumerate(namen):
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (skala, 0, 0, -skala, x + cx * skala, y))
        gs[n].draw(tp)
        pfade.append(pen.getCommands())
        cx += hmtx[n][0]
        if i + 1 < len(namen):
            cx += kern.get((n, namen[i + 1]), 0) + sperrung / skala if False else kern.get((n, namen[i + 1]), 0)
            cx += sperrung / skala
    return ' '.join(pfade), cx * skala
