"""Zeichnet den Handschlag aus der Vorlage als Vektorpfad nach (Konturen, geglättet)."""
import cv2, numpy as np
im = cv2.imread('vorlage.jpg', cv2.IMREAD_GRAYSCALE)
X0, Y0, X1, Y1 = 474, 218, 902, 472          # Ausschnitt Handschlag
S = 8                                         # Hochskalierung für glatte Kanten
crop = im[Y0:Y1, X0:X1].astype(np.float32)
big = cv2.resize(crop, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
big = cv2.GaussianBlur(big, (0, 0), S * 0.9)
maske = (big < 128).astype(np.uint8) * 255
konturen, hier = cv2.findContours(maske, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

def glatt(pts, fenster=9):
    p = pts[:, 0, :].astype(np.float64); n = len(p)
    if n < fenster * 2: return p
    k = np.ones(fenster) / fenster
    ext = np.vstack([p[-fenster:], p, p[:fenster]])
    gx = np.convolve(ext[:, 0], k, 'same')[fenster:-fenster]; gy = np.convolve(ext[:, 1], k, 'same')[fenster:-fenster]
    return np.stack([gx, gy], 1)

def pfad(p, eps):
    a = cv2.approxPolyDP(p.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :] / S
    if len(a) < 3: return ''
    # Quadratische Kurven durch die Mittelpunkte: weiche Linie ohne Ecken
    m = (a + np.roll(a, -1, 0)) / 2
    d = f'M{m[-1][0]:.2f} {m[-1][1]:.2f}'
    for i in range(len(a)):
        d += f'Q{a[i][0]:.2f} {a[i][1]:.2f} {m[i][0]:.2f} {m[i][1]:.2f}'
    return d + 'Z'

teile = []
for c in konturen:
    if cv2.contourArea(c) < (S * S) * 6: continue   # Staub
    teile.append(pfad(glatt(c), eps=S * 0.18))
d = ''.join(teile)
ys, xs = np.where(maske > 0)
bb = (xs.min() / S, ys.min() / S, xs.max() / S, ys.max() / S)
open('handschlag.d', 'w').write(d)
open('handschlag.bbox', 'w').write(' '.join(f'{v:.2f}' for v in bb))
print(len(teile), 'Teile,', len(d), 'Zeichen, bbox', bb)
