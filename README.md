# Hand Drauf

Prototyp einer App für Nachbarschaftshilfe in Garbsen: Gesuche auf einer Karte, eine kleine Aufwandsentschädigung, Nachrichten zwischen den Beteiligten und der Ablauf von der Zusage bis zur Bewertung.

- **Live:** https://z6dfczy4jt-code.github.io/Nachbarhand/ (das Repository heißt noch Nachbarhand, die App „Hand Drauf“)
- **Ohne Datenbank** läuft die App im Demo-Modus mit erfundenen Beispielen.
- **Mit Datenbank** gibt es echte Konten und gemeinsame Gesuche. Einrichtung: [SETUP.md](SETUP.md)

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/body.html` | Bildschirme und Bedien-Symbole |
| `src/symbole.js` | Tätigkeits-Symbole (Tuschezeichnungen), erzeugt aus `design/symbole.py` |
| `src/kopfzeichen.svg` | Logo für die Kopfzeile (folgt hellem und dunklem Design) |
| `src/styles.css` | Gestaltung, helles und dunkles Design, drei Schriftgrößen |
| `src/app.js` | App-Logik, Karte, Demo- und Live-Modus |
| `src/vendor/leaflet-1.9.4.css` | Stile der Kartenbibliothek Leaflet |
| `supabase/schema.sql` | Tabellen, Zugriffsregeln und Funktionen für Supabase |
| `tools/build.py` | Baut aus `src/` die fertige `index.html` |
| `assets/`, `manifest.webmanifest` | App-Icons und Angaben für „Zum Home-Bildschirm“ |
| `design/logo/` | Logo „Hand Drauf“ als SVG (gestapelt, quer, hell, dunkel, App-Icon) und die Vorlage |
| `design/` | Skripte: `trace.py` zeichnet den Handschlag aus der Vorlage nach, `marke.py` setzt Logo und Icons, `symbole.py` zeichnet die Tätigkeits-Symbole |
| `index.html` | Fertige App, wird von GitHub Pages ausgeliefert. Nicht von Hand ändern, sondern mit `python3 tools/build.py` neu bauen |

## Daten und Quellen

- Kartenbibliothek: [Leaflet](https://leafletjs.com) (BSD-2-Clause)
- Kartenkacheln: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, Ersatz: © [CARTO](https://carto.com/attributions)
- Schriften: Bricolage Grotesque und Atkinson Hyperlegible in der App, Montserrat in der Wortmarke (alle SIL Open Font License)
- Lage der Stadtteile: OpenStreetMap (Haltestellen) und GeoNames
- Im Demo-Modus sind alle Personen und Gesuche erfunden. Es fließt kein Geld.
