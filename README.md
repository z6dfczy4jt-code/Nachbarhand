# Nachbarhand

Prototyp einer App für Nachbarschaftshilfe in Garbsen: Gesuche auf einer Karte, eine kleine Aufwandsentschädigung und der Ablauf von der Zusage bis zur Bewertung.

- **Live:** https://z6dfczy4jt-code.github.io/Nachbarhand/
- **Ohne Datenbank** läuft die App im Demo-Modus mit erfundenen Beispielen.
- **Mit Datenbank** gibt es echte Konten und gemeinsame Gesuche. Einrichtung: [SETUP.md](SETUP.md)

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/body.html` | Bildschirme und Symbole |
| `src/styles.css` | Gestaltung, helles und dunkles Design |
| `src/app.js` | App-Logik, Karte, Demo- und Live-Modus |
| `src/vendor/leaflet-1.9.4.css` | Stile der Kartenbibliothek Leaflet |
| `supabase/schema.sql` | Tabellen, Zugriffsregeln und Funktionen für Supabase |
| `tools/build.py` | Baut aus `src/` die fertige `index.html` |
| `index.html` | Fertige App, wird von GitHub Pages ausgeliefert. Nicht von Hand ändern, sondern mit `python3 tools/build.py` neu bauen |

## Daten und Quellen

- Kartenbibliothek: [Leaflet](https://leafletjs.com) (BSD-2-Clause)
- Kartenkacheln: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende © [CARTO](https://carto.com/attributions)
- Lage der Stadtteile: OpenStreetMap (Haltestellen) und GeoNames
- Im Demo-Modus sind alle Personen und Gesuche erfunden. Es fließt kein Geld.
