# Hand Drauf

Prototyp einer App für Nachbarschaftshilfe in Garbsen: Gesuche auf einer Karte, eine kleine Aufwandsentschädigung, Nachrichten zwischen den Beteiligten und der Ablauf von der Zusage bis zur Bewertung.

- **Live:** https://z6dfczy4jt-code.github.io/Nachbarhand/ (das Repository heißt noch Nachbarhand, die App „Hand Drauf“)
- **Live** läuft die App mit der Supabase-Datenbank: echte Konten, gemeinsame Gesuche, Nachrichten. Stand und offene Schritte: [SETUP.md](SETUP.md)
- **Ohne Datenbank** (oder wenn sie nicht erreichbar ist) zeigt die App eine Demo mit erfundenen Beispielen. Die Vorschau in Claude ist immer die Demo.
- **Beispiele:** https://z6dfczy4jt-code.github.io/Nachbarhand/?beispiele zeigt die erfundenen Beispiele auch dann, wenn die Datenbank läuft, mit einem Hinweisband. Gut zum Vorführen, solange noch wenige echte Gesuche da sind.
- **Als App:** Auf dem Handy lässt sich die Seite auf den Startbildschirm legen und startet dann ohne Browserleiste. Die App-Hülle (Seite, Schriften, Karte) lädt auch bei schlechtem Netz.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/body.html` | Bildschirme und Bedien-Symbole |
| `src/symbole.js` | Tätigkeits-Symbole (Tuschezeichnungen), erzeugt aus `design/symbole.py` |
| `src/kopfzeichen.svg` | Logo für die Kopfzeile (folgt hellem und dunklem Design) |
| `src/styles.css` | Gestaltung, helles und dunkles Design, drei Schriftgrößen |
| `src/app.js` | App-Logik, Karte, Demo- und Live-Modus, Nachrichten, Melden |
| `src/fragen.js` | Häufige Fragen (`#fragen`) |
| `src/recht.js` | Impressum, Datenschutzerklärung, Nutzungsbedingungen, Regeln (Fassung für die Testphase, vor dem Start anwaltlich prüfen lassen) |
| `src/vendor/leaflet-1.9.4.css` | Stile der Kartenbibliothek Leaflet |
| `supabase/schema.sql` | Tabellen, Zugriffsregeln und Funktionen für Supabase |
| `supabase/updates/` | Einzelne Datenbank-Updates zum Einfügen im SQL Editor |
| `sw.js` | Offline-Hülle: Seite zuerst aus dem Netz, feste Dateien aus dem Speicher, Gesuche und Karte nie zwischengespeichert |
| `tools/build.py` | Baut aus `src/` die fertige `index.html` |
| `assets/` | App-Icons, Schriften (selbst ausgeliefert, keine Verbindung zu Google) und Leaflet |
| `manifest.webmanifest` | Angaben für „Zum Home-Bildschirm“ |
| `design/logo/` | Logo „Hand Drauf“ als SVG (gestapelt, quer, hell, dunkel, App-Icon) und die Vorlage |
| `design/` | Skripte: `trace.py` zeichnet den Handschlag aus der Vorlage nach, `marke.py` setzt Logo und Icons, `symbole.py` zeichnet die Tätigkeits-Symbole |
| `index.html` | Fertige App, wird von GitHub Pages ausgeliefert. Nicht von Hand ändern, sondern mit `python3 tools/build.py` neu bauen |

## Daten und Quellen

- Kartenbibliothek: [Leaflet](https://leafletjs.com) 1.9.4 (BSD-2-Clause), liegt unter `assets/vendor/`
- Kartenkacheln: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, Ersatz: © [CARTO](https://carto.com/attributions)
- Schriften: Bricolage Grotesque und Atkinson Hyperlegible in der App, Montserrat in der Wortmarke (alle SIL Open Font License)
- Lage der Stadtteile: OpenStreetMap (Haltestellen) und GeoNames
- Im Demo-Modus sind alle Personen und Gesuche erfunden. Es fließt kein Geld.
