"""Oberflächen von Hand Drauf: Raufaser an der Wand, Papier für die Zettel, Druckkorn für Überschriften.

    cd design && python3 texturen.py   -> assets/textur/*.png

Kleine Kacheln, die sich nahtlos wiederholen. Sie liegen als Hintergrundbild über der Farbe (die Farbe kommt
weiter aus styles.css), deshalb gibt es je eine helle und eine dunkle Fassung. Danach in sw.js die
Versionsnummer erhöhen.
"""
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ZIEL = WURZEL / 'assets/textur'
TINTE = (30, 42, 54)


def nahtlos_punkte(d, groesse, x, y, r, farbe):
    """Punkt zeichnen, am Rand auch auf der gegenüberliegenden Seite (damit die Kachel nahtlos ist)."""
    for dx in (-groesse, 0, groesse):
        for dy in (-groesse, 0, groesse):
            d.ellipse([x + dx - r, y + dy - r, x + dx + r, y + dy + r], fill=farbe)


def raufaser(groesse, hell, seed):
    """Raufaser: kleine Holzspäne unter der Farbe. Jeder Span hat eine Lichtkante oben links und Schatten unten rechts."""
    rnd = random.Random(seed)
    licht = Image.new('RGBA', (groesse, groesse), (0, 0, 0, 0))
    schatten = Image.new('RGBA', (groesse, groesse), (0, 0, 0, 0))
    dl, ds = ImageDraw.Draw(licht), ImageDraw.Draw(schatten)
    for _ in range(int(groesse * groesse / 95)):
        x, y = rnd.uniform(0, groesse), rnd.uniform(0, groesse)
        r = rnd.choice([0.8, 1.0, 1.2, 1.5, 1.8, 2.2])
        if hell:
            nahtlos_punkte(ds, groesse, x + 0.9, y + 1.0, r, TINTE + (int(rnd.uniform(11, 22)),))
            nahtlos_punkte(dl, groesse, x - 0.5, y - 0.6, r * 0.8, (255, 255, 255, int(rnd.uniform(50, 90))))
        else:
            nahtlos_punkte(ds, groesse, x + 0.9, y + 1.0, r, (0, 0, 0, int(rnd.uniform(40, 70))))
            nahtlos_punkte(dl, groesse, x - 0.5, y - 0.6, r * 0.8, (255, 255, 255, int(rnd.uniform(10, 20))))
    schatten = schatten.filter(ImageFilter.GaussianBlur(0.7))
    licht = licht.filter(ImageFilter.GaussianBlur(0.5))
    bild = Image.new('RGBA', (groesse, groesse), (0, 0, 0, 0))
    bild.alpha_composite(schatten)
    bild.alpha_composite(licht)
    return bild


def papier(groesse, hell, seed):
    """Papier: feine Fasern und Körner, kaum sichtbar, aber man spürt sie."""
    rnd = random.Random(seed)
    bild = Image.new('RGBA', (groesse, groesse), (0, 0, 0, 0))
    d = ImageDraw.Draw(bild)
    farbe = TINTE if hell else (255, 255, 255)
    for _ in range(int(groesse * groesse / 22)):
        x, y = rnd.uniform(0, groesse), rnd.uniform(0, groesse)
        nahtlos_punkte(d, groesse, x, y, rnd.choice([0.4, 0.5, 0.7]), farbe + (int(rnd.uniform(8, 20) if hell else rnd.uniform(6, 14)),))
    for _ in range(int(groesse * groesse / 900)):
        x, y = rnd.uniform(0, groesse), rnd.uniform(0, groesse)
        l, w = rnd.uniform(3, 8), rnd.uniform(-1.2, 1.2)
        for dx in (-groesse, 0, groesse):
            for dy in (-groesse, 0, groesse):
                d.line([(x + dx, y + dy), (x + dx + l, y + dy + w)], fill=farbe + (int(rnd.uniform(10, 22)),), width=1)
    return bild.filter(ImageFilter.GaussianBlur(0.35))


def druck(groesse, seed):
    """Maske für gedruckte Überschriften: fast überall Farbe, nur winzige Fehlstellen wie bei Stempel oder Risodruck."""
    rnd = random.Random(seed)
    bild = Image.new('L', (groesse, groesse), 255)
    d = ImageDraw.Draw(bild)
    for _ in range(int(groesse * groesse / 160)):
        x, y = rnd.uniform(0, groesse), rnd.uniform(0, groesse)
        nahtlos_punkte(d, groesse, x, y, rnd.choice([0.4, 0.5, 0.7]), int(rnd.uniform(90, 190)))
    bild = bild.filter(ImageFilter.GaussianBlur(0.3))
    maske = Image.new('RGBA', (groesse, groesse), (0, 0, 0, 0))
    maske.putalpha(bild)
    return maske


def speichern(bild, name):
    ZIEL.mkdir(parents=True, exist_ok=True)
    pfad = ZIEL / name
    # Wenige Farben genügen: kleine Dateien
    bild.quantize(colors=48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(pfad, optimize=True)
    print(name, pfad.stat().st_size, 'Bytes')


if __name__ == '__main__':
    speichern(raufaser(180, True, 1), 'wand-hell.png')
    speichern(raufaser(180, False, 1), 'wand-dunkel.png')
    speichern(papier(140, True, 2), 'papier-hell.png')
    speichern(papier(140, False, 2), 'papier-dunkel.png')
    speichern(druck(120, 3), 'druck.png')
