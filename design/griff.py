INK = '#172029'; GELB = '#F4B400'; WEISS = '#FFFFFF'
SW = 7

def finger(x, y, l, h, winkel, s, fein, weiss, details):
    """Finger, der um eine Kante greift: Knöchel rechts bei x, Kuppe mit Nagel links bei x-l."""
    x0 = x - l; k = h / 2 + 1; r = h / 2 - 1.5
    d = (f'M{x:.1f} {y-k:.1f} C{x-l*0.5:.1f} {y-k-0.5:.1f} {x0+h*0.45:.1f} {y-r:.1f} {x0+h*0.32:.1f} {y-r:.1f} '
         f'C{x0-1.5:.1f} {y-h*0.36:.1f} {x0-1.5:.1f} {y+h*0.36:.1f} {x0+h*0.32:.1f} {y+r:.1f} '
         f'C{x0+h*0.45:.1f} {y+r:.1f} {x-l*0.5:.1f} {y+k+0.5:.1f} {x:.1f} {y+k:.1f} '
         f'C{x+k*1.35:.1f} {y+k:.1f} {x+k*1.35:.1f} {y-k:.1f} {x:.1f} {y-k:.1f} Z')
    g = f'<g transform="rotate({winkel} {x} {y})"><path d="{d}" fill="{weiss}" {s}/>'
    if details:
        g += f'<path d="M{x0+4.5:.1f} {y-h*0.27:.1f} C{x0+12:.1f} {y-h*0.3:.1f} {x0+13:.1f} {y+h*0.3:.1f} {x0+4.5:.1f} {y+h*0.27:.1f}" {fein}/>'
        g += f'<path d="M{x0+l*0.5:.1f} {y-h*0.3:.1f} q2.5 {h*0.3:.1f} 0 {h*0.6:.1f}" {fein}/>'
    return g + '</g>'

def griff(ink=INK, gelb=GELB, weiss=WEISS, sw=SW, details=True, tusche=True, fid='tusche'):
    s = f'stroke="{ink}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"'
    fein = f'fill="none" stroke="{ink}" stroke-width="{sw*0.55:.2f}" stroke-linecap="round"'
    t = []
    t.append(f'<path d="M-8 248 C16 216 42 190 70 166 L124 200 C106 214 92 230 82 252 Z" fill="{weiss}" {s}/>')
    t.append(f'<path d="M248 246 C224 216 206 192 192 164 C188 132 180 104 164 84 C144 70 114 72 88 88 C72 100 64 116 68 132 C74 154 94 174 118 192 C136 210 152 230 164 250 Z" fill="{gelb}" {s}/>')
    for x, y in [(72, 100), (62, 121), (62, 144), (74, 166)]:
        t.append(f'<path d="M{x+15} {y-12} C{x-6} {y-15} {x-15} {y+1} {x-7} {y+12} C{x-1} {y+18} {x+12} {y+16} {x+19} {y+12}" fill="{gelb}" {s}/>')
    # Daumen der weißen Hand: leicht gebogen, Spitze links
    t.append(finger(184, 80, 84, 27, -8, s, fein, weiss, details))
    # Weiße Finger rechts
    for i, (x, y, l) in enumerate([(198, 106, 44), (202, 131, 46), (198, 156, 42), (188, 178, 34)]):
        t.append(finger(x, y, l, 25, -6 + i * 7, s, fein, weiss, details))
    if details:
        for d in ['M116 128 q10 -3 17 3', 'M124 146 q9 -2 15 3', 'M150 206 q9 -6 19 -6', 'M40 214 q10 0 17 6']:
            t.append(f'<path d="{d}" {fein}/>')
    inhalt = ''.join(t)
    if tusche:
        f = (f'<filter id="{fid}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="r"/>'
             f'<feDisplacementMap in="SourceGraphic" in2="r" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>')
        return f'<defs>{f}</defs><g filter="url(#{fid})">{inhalt}</g>'
    return inhalt

def svg(inner, vb='0 0 240 240', bg=None):
    r = f'<rect x="-10" y="-10" width="260" height="260" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{r}{inner}</svg>'
