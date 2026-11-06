"""Tätigkeits-Symbole im Stil des Logos: Tuschelinie, Rapsgelb, Weiß. viewBox 0 0 48 48."""
INK = 'var(--ink, #172029)'; GELB = '#F4B400'; WEISS = 'var(--surface, #FFFFFF)'
SW = 3

def stile(ink=INK, sw=SW):
    s = f'stroke="{ink}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"'
    fein = f'fill="none" stroke="{ink}" stroke-width="{sw*0.75:.2f}" stroke-linecap="round" stroke-linejoin="round"'
    return s, fein

def garten(ink=INK, gelb=GELB, weiss=WEISS):
    s, fein = stile(ink)
    # Gießkanne: Körper, Bügel, langer Ausguss mit Brause, Wasser
    return (f'<path d="M30 33.5 L40.5 17.5 L43.6 19.6 L33.2 36.6 Z" fill="{gelb}" {s}/>'
            f'<rect x="37.8" y="12.3" width="9.2" height="5.4" rx="2.2" fill="{weiss}" {s} transform="rotate(34 42.4 15)"/>'
            f'<path d="M12 17 C12 9.5 27 9.5 27 17" {fein} stroke-width="3"/>'
            f'<path d="M6.5 21 C6.5 18.5 8 17 10.5 17 H28.5 C31 17 32.5 18.5 32.5 21 V38 C32.5 40.5 31 42 28.5 42 H10.5 C8 42 6.5 40.5 6.5 38 Z" fill="{gelb}" {s}/>'
            f'<path d="M11.5 23 V35" {fein} stroke-width="2" opacity=".55"/>'
            f'<path d="M45.5 24 v2.4 M42.5 25.5 v3 M46 30 v2.2" {fein} stroke-width="2"/>')

def einkaufen(ink=INK, gelb=GELB, weiss=WEISS):
    s, fein = stile(ink)
    # Einkaufstasche mit Lauch und Brot
    return (f'<path d="M26 17 L31 4.5 C32 3 34.5 3.5 34 5.5 L30 18" fill="{weiss}" {s}/>'
            f'<path d="M17 18 C16 11 19 6 22 6.5 C24.5 7 24 12 22.5 18" fill="{weiss}" {s}/>'
            f'<path d="M8.5 17 H39.5 L37 40 C36.8 41.5 35.8 42 34.5 42 H13.5 C12.2 42 11.2 41.5 11 40 Z" fill="{gelb}" {s}/>'
            f'<path d="M13.5 25 H34.5" {fein} stroke-width="2" opacity=".55"/>')

def tiere(ink=INK, gelb=GELB, weiss=WEISS):
    s, fein = stile(ink)
    # Hundekopf mit Schlappohren
    return (f'<path d="M14 15 C14 9.5 18.5 7 24 7 C29.5 7 34 9.5 34 15 V27 C34 35 29.5 41 24 41 C18.5 41 14 35 14 27 Z" fill="{weiss}" {s}/>'
            f'<path d="M14.5 12 C9 11 4.5 16 5.5 23 C6 27 9.5 28 11.5 25 C13 23 14 19 14.5 15" fill="{gelb}" {s}/>'
            f'<path d="M33.5 12 C39 11 43.5 16 42.5 23 C42 27 38.5 28 36.5 25 C35 23 34 19 33.5 15" fill="{gelb}" {s}/>'
            f'<circle cx="19.5" cy="22" r="1.9" fill="{ink}"/><circle cx="28.5" cy="22" r="1.9" fill="{ink}"/>'
            f'<path d="M20.8 30 C20.8 27.8 27.2 27.8 27.2 30 C27.2 32 25.3 33 24 33 C22.7 33 20.8 32 20.8 30 Z" fill="{ink}"/>'
            f'<path d="M24 33 V36 M20.5 36.5 C22 38 26 38 27.5 36.5" {fein} stroke-width="1.9"/>')

def haushalt(ink=INK, gelb=GELB, weiss=WEISS):
    s, fein = stile(ink)
    # Hammer, schräg
    return (f'<g transform="rotate(-38 24 24)"><rect x="21" y="16" width="6.5" height="29" rx="3" fill="{gelb}" {s}/>'
            f'<path d="M11 8.5 C11 6.5 12.5 5.5 14.5 5.5 H33 C36 5.5 38.5 7 39.5 9.5 L40 11 C40.5 12.5 39.5 13.5 38 13.5 H14.5 C12.5 13.5 11 12.5 11 10.5 Z" fill="{weiss}" {s}/>'
            f'<path d="M21 13.5 V17 M27.5 13.5 V17" {fein} stroke-width="2.2"/></g>'
            f'<path d="M35 38 l6 -2 M34 42.5 l6.5 1.2" {fein} stroke-width="2"/>')

def tragen(ink=INK, gelb=GELB, weiss=WEISS):
    s, fein = stile(ink)
    # Umzugskarton mit Klebeband und Griffloch
    return (f'<path d="M7 17 L24 11 L41 17 V37 L24 43 L7 37 Z" fill="{gelb}" {s}/>'
            f'<path d="M7 17 L24 23 L41 17 M24 23 V43" {fein}/>'
            f'<path d="M15.5 14 L32.5 20 V26" fill="none" stroke="{weiss}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="M15.5 14 L32.5 20 V26" {fein} stroke-width="1.2" opacity=".5"/>'
            f'<path d="M11.5 28.5 C13.5 29.5 16.5 30.5 18.5 31" {fein} stroke-width="2.4"/>')

def technik(ink=INK, gelb=GELB, weiss=WEISS):
    s, fein = stile(ink)
    # Smartphone mit Sprechblase
    return (f'<rect x="13" y="5" width="20" height="38" rx="4.5" fill="{weiss}" {s} transform="rotate(-6 23 24)"/>'
            f'<rect x="16.5" y="10" width="13" height="25" rx="1.5" fill="{gelb}" stroke="none" transform="rotate(-6 23 24)"/>'
            f'<path d="M21.5 39.2 h3.5" {fein} stroke-width="2.2" transform="rotate(-6 23 24)"/>'
            f'<path d="M30 8.5 C30 5.5 32 4 35 4 H40.5 C43.5 4 45 5.5 45 8.5 V11 C45 14 43.5 15.5 40.5 15.5 H36 L32 19 L32.8 15.2 C31 14.6 30 13 30 11 Z" fill="{weiss}" {s}/>'
            f'<circle cx="34.5" cy="9.8" r="1.3" fill="{ink}"/><circle cx="37.8" cy="9.8" r="1.3" fill="{ink}"/><circle cx="41.1" cy="9.8" r="1.3" fill="{ink}"/>')

SYMBOLE = {'garten': garten, 'einkaufen': einkaufen, 'tiere': tiere, 'haushalt': haushalt, 'tragen': tragen, 'technik': technik}

FILTER = ('<filter id="tusche-s" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="5" result="r"/>'
          '<feDisplacementMap in="SourceGraphic" in2="r" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter>')
