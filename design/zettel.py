"""Drei Anfragen als angepinnte Zettel, wie am Schwarzen Brett. Für das Vorschaubild (vorschau.py) und den Aushang
(aushang.py). Alle Maße in em: Die Größe kommt von der Schriftgröße des Rahmens (.wand)."""

ZETTEL = [
    # Titel, Wann und wie weit, Betrag, Drehung, Abstand von links (em)
    ('Rasen mähen', 'Samstag, vormittags · 400 m', '15 €', -2.2, 0.2),
    ('Einkauf hochtragen', 'Heute ab 17 Uhr · 250 m', '8 €', 1.6, 1.6),
    ('Drucker einrichten', 'Morgen · 1,2 km', '20 €', -1.0, 0.6),
]

CSS = """
.wand { position: relative; overflow: hidden; background: #DDE5EE; display: flex; flex-direction: column; justify-content: center; gap: 0.9em; padding: 1.2em 1.1em; }
.notiz { position: relative; width: fit-content; min-width: 74%; box-sizing: border-box; padding: 0.75em 0.9em 0.7em; border-radius: 0.35em; background: #FFFFFF; color: #1C2530;
  box-shadow: 0 0.05em 0.1em rgba(28, 37, 48, .12), 0 0.5em 1.1em rgba(28, 37, 48, .14); display: grid; grid-template-columns: 1fr auto; column-gap: 0.7em; align-items: center; }
.notiz::before { content: ''; position: absolute; left: 50%; top: -0.32em; width: 0.62em; height: 0.62em; margin-left: -0.31em; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #D86A59, #A3392B 60%); box-shadow: 0 0.12em 0.2em rgba(28, 37, 48, .35); }
.notiz b { font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 1.3em; line-height: 1.1; white-space: nowrap; }
.notiz span { grid-column: 1; margin-top: 0.2em; font-family: 'Barlow', sans-serif; font-size: 0.82em; line-height: 1.3; color: #586473; white-space: nowrap; }
.notiz em { grid-column: 2; grid-row: 1 / span 2; position: relative; padding: 0.12em 0.45em 0.12em 0.85em; border-radius: 0.28em; background: #F4B400; color: #11161C;
  font-style: normal; font-family: 'Barlow Semi Condensed', sans-serif; font-weight: 700; font-size: 1.25em; line-height: 1.2; white-space: nowrap; box-shadow: 0 0.04em 0 #D99E00; }
.notiz em::before { content: ''; position: absolute; left: 0.3em; top: 50%; width: 0.26em; height: 0.26em; margin-top: -0.13em; border-radius: 50%; background: #fff; }
"""


def html():
    return '<div class="wand">' + ''.join(
        f'<div class="notiz" style="transform: rotate({drehung}deg); margin-left: {links}em"><b>{titel}</b><span>{wann}</span><em>{betrag}</em></div>'
        for titel, wann, betrag, drehung, links in ZETTEL) + '</div>'
