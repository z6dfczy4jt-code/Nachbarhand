"""Kleiner QR-Code-Erzeuger (ISO/IEC 18004), ohne fremde Bibliotheken.

Reicht für kurze Texte wie die Adresse der App: Byte-Modus, Fehlerkorrektur M (15 %), Versionen 1 bis 6.
    from qr import qr_matrix, qr_svg
"""

# Version: (Codewörter gesamt, Korrektur-Codewörter je Block, Blöcke) für Stufe M
VERSIONEN = {1: (26, 10, 1), 2: (44, 16, 1), 3: (70, 26, 1), 4: (100, 18, 2), 5: (134, 24, 2), 6: (172, 16, 4)}

# Rechnen im Körper GF(256) mit dem Polynom x^8 + x^4 + x^3 + x^2 + 1
EXP = [0] * 512
LOG = [0] * 256
_x = 1
for _i in range(255):
    EXP[_i] = _x
    LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def _mal(a, b):
    return 0 if a == 0 or b == 0 else EXP[LOG[a] + LOG[b]]


def _korrektur(daten, anzahl):
    """Reed-Solomon: Rest der Division durch das Erzeugerpolynom (x - a^0)(x - a^1)…"""
    erzeuger = [1]
    for i in range(anzahl):
        neu = [0] * (len(erzeuger) + 1)
        for j, k in enumerate(erzeuger):
            neu[j] ^= k
            neu[j + 1] ^= _mal(k, EXP[i])
        erzeuger = neu
    rest = [0] * anzahl
    for b in daten:
        faktor = b ^ rest[0]
        rest = rest[1:] + [0]
        for j in range(anzahl):
            rest[j] ^= _mal(erzeuger[j + 1], faktor)
    return rest


def _codewoerter(text):
    daten = text.encode('utf-8')
    for version, (gesamt, korr, bloecke) in VERSIONEN.items():
        platz = gesamt - korr * bloecke
        if 4 + 8 + 8 * len(daten) <= platz * 8:
            break
    else:
        raise ValueError('Text zu lang für diesen QR-Code')
    bits = [0, 1, 0, 0] + [(len(daten) >> i) & 1 for i in range(7, -1, -1)]
    for b in daten:
        bits += [(b >> i) & 1 for i in range(7, -1, -1)]
    bits += [0] * min(4, platz * 8 - len(bits))
    bits += [0] * (-len(bits) % 8)
    worte = [int(''.join(map(str, bits[i:i + 8])), 2) for i in range(0, len(bits), 8)]
    fuell = (0xEC, 0x11)
    worte += [fuell[i % 2] for i in range(platz - len(worte))]
    # In Blöcke teilen (bei diesen Versionen sind alle gleich lang), Korrektur anhängen, verschränken
    je = platz // bloecke
    teile = [worte[i * je:(i + 1) * je] for i in range(bloecke)]
    korrektur = [_korrektur(t, korr) for t in teile]
    aus = [t[i] for i in range(je) for t in teile] + [k[i] for i in range(korr) for k in korrektur]
    return version, aus


MASKEN = [
    lambda r, c: (r + c) % 2 == 0,
    lambda r, c: r % 2 == 0,
    lambda r, c: c % 3 == 0,
    lambda r, c: (r + c) % 3 == 0,
    lambda r, c: (r // 2 + c // 3) % 2 == 0,
    lambda r, c: (r * c) % 2 + (r * c) % 3 == 0,
    lambda r, c: ((r * c) % 2 + (r * c) % 3) % 2 == 0,
    lambda r, c: ((r + c) % 2 + (r * c) % 3) % 2 == 0,
]


def _strafe(m):
    n = len(m)
    punkte = 0
    zeilen = [list(z) for z in m] + [[m[r][c] for r in range(n)] for c in range(n)]
    for z in zeilen:
        lauf = 1
        for i in range(1, n):
            if z[i] == z[i - 1]:
                lauf += 1
            else:
                if lauf >= 5:
                    punkte += lauf - 2
                lauf = 1
        if lauf >= 5:
            punkte += lauf - 2
        s = ''.join('1' if x else '0' for x in z)
        punkte += 40 * (sum(1 for i in range(n - 10) if s[i:i + 11] == '10111010000') + sum(1 for i in range(n - 10) if s[i:i + 11] == '00001011101'))
    for r in range(n - 1):
        for c in range(n - 1):
            if m[r][c] == m[r][c + 1] == m[r + 1][c] == m[r + 1][c + 1]:
                punkte += 3
    dunkel = sum(sum(1 for x in z if x) for z in m)
    punkte += 10 * (abs(dunkel * 20 - n * n * 10) // (n * n))
    return punkte


def qr_matrix(text):
    """Liefert die Module als Liste von Zeilen (True = dunkel)."""
    version, worte = _codewoerter(text)
    n = 17 + 4 * version
    m = [[False] * n for _ in range(n)]
    fest = [[False] * n for _ in range(n)]

    def setze(r, c, wert):
        if 0 <= r < n and 0 <= c < n:
            m[r][c] = wert
            fest[r][c] = True

    # Suchmuster in drei Ecken, mit hellem Rand
    for r0, c0 in ((0, 0), (0, n - 7), (n - 7, 0)):
        for r in range(-1, 8):
            for c in range(-1, 8):
                innen = 0 <= r <= 6 and 0 <= c <= 6
                dunkel = innen and (r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4))
                setze(r0 + r, c0 + c, dunkel)
    # Taktlinien
    for i in range(8, n - 8):
        setze(6, i, i % 2 == 0)
        setze(i, 6, i % 2 == 0)
    # Ausrichtungsmuster (ab Version 2 eines unten rechts)
    if version >= 2:
        p = 10 + 4 * version
        for r in range(-2, 3):
            for c in range(-2, 3):
                setze(p + r, p + c, max(abs(r), abs(c)) != 1)
    # Platz für die Formatangabe freihalten, dazu das feste dunkle Modul
    for i in range(9):
        if not fest[8][i]:
            setze(8, i, False)
        if not fest[i][8]:
            setze(i, 8, False)
    for i in range(8):
        setze(8, n - 1 - i, False)
        setze(n - 1 - i, 8, False)
    setze(n - 8, 8, True)

    # Daten im Zickzack von unten rechts nach links
    bits = [(w >> i) & 1 for w in worte for i in range(7, -1, -1)]
    k = 0
    hoch = True
    spalte = n - 1
    while spalte > 0:
        if spalte == 6:
            spalte -= 1
        for r in (range(n - 1, -1, -1) if hoch else range(n)):
            for c in (spalte, spalte - 1):
                if not fest[r][c]:
                    m[r][c] = bool(bits[k]) if k < len(bits) else False
                    k += 1
        hoch = not hoch
        spalte -= 2
    assert k >= len(bits), 'nicht alle Daten untergebracht'

    def mit_maske(nr):
        aus = [z[:] for z in m]
        for r in range(n):
            for c in range(n):
                if not fest[r][c] and MASKEN[nr](r, c):
                    aus[r][c] = not aus[r][c]
        # Formatangabe: Stufe M (00) und Maske, gesichert mit BCH(15,5)
        daten = nr
        rest = daten
        for _ in range(10):
            rest = (rest << 1) ^ ((rest >> 9) * 0x537)
        fmt = ((daten << 10) | rest) ^ 0x5412
        bit = lambda i: bool((fmt >> i) & 1)
        for i in range(6):
            aus[i][8] = bit(i)
        aus[7][8] = bit(6)
        aus[8][8] = bit(7)
        aus[8][7] = bit(8)
        for i in range(9, 15):
            aus[8][14 - i] = bit(i)
        for i in range(8):
            aus[8][n - 1 - i] = bit(i)
        for i in range(8, 15):
            aus[n - 15 + i][8] = bit(i)
        aus[n - 8][8] = True
        return aus

    return min((mit_maske(nr) for nr in range(8)), key=_strafe)


def qr_svg(text, rand=2, farbe='#11161C'):
    """QR-Code als kleines SVG: ein Pfad auf weißem Grund, rand = heller Rand in Modulen."""
    m = qr_matrix(text)
    n = len(m)
    teile = []
    for y in range(n):
        x = 0
        while x < n:
            if m[y][x]:
                start = x
                while x < n and m[y][x]:
                    x += 1
                teile.append(f'M{start + rand} {y + rand}h{x - start}v1h-{x - start}z')
            else:
                x += 1
    g = n + 2 * rand
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {g} {g}" shape-rendering="crispEdges">'
            f'<path fill="#fff" d="M0 0h{g}v{g}H0z"/><path fill="{farbe}" d="{"".join(teile)}"/></svg>')
