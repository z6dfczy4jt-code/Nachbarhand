# Hand Drauf

App für Nachbarschaftshilfe in ganz Deutschland (gestartet in Garbsen): Anfragen auf einer Karte, eine kleine Aufwandsentschädigung, Nachrichten zwischen den Beteiligten und der Ablauf von der Zusage bis zur Bewertung.

- **Live:** https://z6dfczy4jt-code.github.io/Nachbarhand/ (das Repository heißt noch Nachbarhand, die App „Hand Drauf“)
- **Live** läuft die App mit der Supabase-Datenbank: echte Konten, gemeinsame Anfragen, Nachrichten. Stand und offene Schritte: [SETUP.md](SETUP.md)
- **Ohne Datenbank** (oder wenn sie nicht erreichbar ist) zeigt die App eine Demo mit erfundenen Beispielen. Die Vorschau in Claude ist immer die Demo.
- **Einstellungen:** Adresse, Datenbank, Betreiber, Hosting und Schalter stehen in [`einstellungen.json`](einstellungen.json). Danach neu bauen.
- **Eigener Server:** [SERVER.md](SERVER.md) (Docker mit Caddy oder Webspace mit Apache)
- **Gebühren:** In der Testphase aus. Für Weg 2 (Bezahlung über die App) in `einstellungen.json` `gebuehren` auf `true` setzen, sobald Stripe eingerichtet ist.
- **Beispiele:** https://z6dfczy4jt-code.github.io/Nachbarhand/?beispiele zeigt die erfundenen Beispiele auch dann, wenn die Datenbank läuft, mit einem Hinweisband. Gut zum Vorführen, solange noch wenige echte Anfragen da sind.
- **iPhone-App:** vorbereitet mit Capacitor, gebaut wird sie an einem Mac. Anleitung, Apple-Regeln und Texte für den App Store: [APP-STORE.md](APP-STORE.md)
- **Als Web-App:** Auf dem Handy lässt sich die Seite auf den Startbildschirm legen und startet dann ohne Browserleiste. Die App-Hülle (Seite, Bilder, Karte) lädt auch bei schlechtem Netz.
- **Für alle Altersgruppen:** Schriftgröße gleich bei der Begrüßung wählbar, „Vorlesen“ in jeder Anfrage, Anrufen statt Schreiben, für Eltern oder Großeltern anfragen, fertige Sätze im Chat, mehr Kontrast, wenn das Gerät darum bittet.
- **Sicherheit:** Sicherheits-Code für die Tür (wie die PIN bei Uber), „Bescheid sagen“ an eine Vertrauensperson, Warnung bei typischen Betrugsmaschen im Chat.
- **Benachrichtigungen aufs Handy:** Web Push über die eigene Edge Function `supabase/functions/push` (ohne fremde Dienste wie Firebase), mit Erinnerungen vor und nach dem Termin und „Ich helfe gern bei …“. Einrichtung und Test: [SETUP.md](SETUP.md)
- **Preisvorschläge** aus echten Anfragen, sobald es je Tätigkeit genug gibt
- **Ganz Deutschland:** Ort per Suche (Photon/OpenStreetMap), Umkreis 2 bis 50 km, Karte am eigenen Ort; gespeichert wird nur die Mitte eines Rasterfelds von etwa 1 km (Datenbank-Update Teil 7)
- **Profile und Bewertungen:** Nach jedem Auftrag bewerten sich beide mit Sternen und ein paar Sätzen. Beide Bewertungen erscheinen gleichzeitig (wenn beide bewertet haben, spätestens nach 14 Tagen), danach lassen sie sich nicht mehr ändern. Im Profil: Durchschnitt, Verteilung der Sterne und die Bewertungen mit Tätigkeit und Datum; jede Bewertung lässt sich melden (Datenbank-Update Teil 8)
- **Eigenes Profil:** Profilbild (wird auf dem Gerät zugeschnitten und verkleinert, ohne Aufnahmeort), „Über mich“, „Ich helfe gern bei …“, Sprachen und wann man meist Zeit hat; alles freiwillig. Im eigenen Profil steht darunter, wie man bewertet wurde. Profile lassen sich melden
- **Einladen:** QR-Code in der App und ein Aushang fürs Schwarze Brett mit Zetteln zum Abreißen: [assets/aushang.pdf](assets/aushang.pdf)

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/body.html` | Bildschirme und Bedien-Symbole |
| `src/kategorien/` | Tätigkeits-Bilder (gezeichnete Aufkleber, erzeugt mit `design/bilder.py`), werden beim Bauen eingebettet |
| `src/kopfzeichen.svg` | Logo für die Kopfzeile (folgt hellem und dunklem Design) |
| `src/styles.css` | Gestaltung: Schiefer, Klinkerrot, Rapsgelb; helles und dunkles Design, drei Schriftgrößen |
| `src/app.js` | App-Logik, eigene Karte (Straßenkarte basemap.de, ohne Kartenbibliothek) und die kleine Karte der Umgebung auf der Startseite, Demo- und Live-Modus, Nachrichten, Melden |
| `src/fragen.js` | Häufige Fragen (`#fragen`) |
| `src/recht.js` | Impressum, Datenschutzerklärung, Nutzungsbedingungen, Regeln (Fassung für die Testphase, vor dem Start anwaltlich prüfen lassen) |
| `supabase/schema.sql` | Tabellen, Zugriffsregeln und Funktionen für Supabase |
| `supabase/updates/` | Einzelne Datenbank-Updates zum Einfügen im SQL Editor |
| `supabase/functions/push/` | Edge Function für Benachrichtigungen: Verschlüsselung (RFC 8291) und Absender-Nachweis (VAPID) mit Bordmitteln |
| `sw.js` | Offline-Hülle: Seite zuerst aus dem Netz, feste Dateien aus dem Speicher, Anfragen nie zwischengespeichert. Zeigt Benachrichtigungen an |
| `einstellungen.json` | Alle Angaben für den Betrieb an einer Stelle: Adresse, Datenbank, Push, Betreiber, Hosting, Schalter. Der Build prüft sie |
| `tools/build.py` | Baut aus `src/` die fertige `index.html` und `version.json`; mit `--dist` den Ordner `dist/` für den eigenen Server. Ist [esbuild](https://esbuild.github.io/) installiert, werden Programm und Gestaltung dabei verkleinert (ohne Kommentare und Leerraum, Namen bleiben lesbar; Ziel: iPhones ab iOS 11). Ohne esbuild funktioniert alles genauso, die Seite ist nur etwas größer |
| `server/` | Eigener Server: `Caddyfile`, `docker-compose.yml`, `aktualisieren.sh`, Datensicherung `sicherung.sh` (siehe SERVER.md) |
| `version.json` | Fassung der App. Die App fragt sie ab und bietet bei einer neuen Fassung „Neu laden“ an |
| `assets/` | App-Symbole, Schriften (Barlow), Oberflächen (`assets/textur/`: Raufaser, Papier, Druckkorn; erzeugt mit `design/texturen.py`), Vorschaubild, Aushang |
| `manifest.webmanifest` | Angaben für „Zum Home-Bildschirm“ |
| `design/logo/` | Logo „Hand Drauf“ als SVG (gestapelt, quer, hell, dunkel, App-Icon) und die Vorlage |
| `design/` | Skripte: `trace.py` zeichnet den Handschlag aus der Vorlage nach, `marke.py` setzt das Logo, `icons.py` die App-Symbole (Browser-Tab, Startbildschirm, iPhone-App), `bilder.py` die Tätigkeits-Bilder (Tusche und Risodruck als SVG in `design/bilder/`), `texturen.py` die Oberflächen |
| `package.json`, `capacitor.config.json` | iPhone-App mit Capacitor (siehe APP-STORE.md) |
| `app/resources/` | App-Symbol und Startbildschirme für die iPhone-App, erzeugt mit `design/icons.py` (Symbol) und `design/app-bilder.py` (Startbildschirme) |
| `assets/vorschau.png` | Vorschaubild für geteilte Links, erzeugt mit `design/vorschau.py` |
| `assets/aushang.pdf`, `assets/qr.svg`, `assets/badge-96.png` | Aushang, QR-Code und Zeichen für Benachrichtigungen, erzeugt mit `design/aushang.py [Ort]` (QR-Code aus `design/qr.py`, ohne fremde Bibliothek; die Zettel aus `design/zettel.py`) |
| `index.html` | Fertige App, wird von GitHub Pages ausgeliefert. Nicht von Hand ändern, sondern mit `python3 tools/build.py` neu bauen |

## Daten und Quellen

- Karte: eigene, schlanke Karte im Code (`src/app.js`, Abschnitte „Karte“, „Kartenwerkstatt“, „Eigene Straßenkarte“), ohne Kartenbibliothek. Die Straßenkarte zeichnet die App selbst aus Vektordaten (OpenMapTiles-Schema von [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://openmaptiles.org), © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, ODbL), im Web Worker mit OffscreenCanvas, sonst in Ruhe im Hauptfaden. Ersatz-Kartenbilder: [basemap.de](https://basemap.de) Web Raster, © GeoBasis-DE / [BKG](https://www.bkg.bund.de) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)); danach © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende. Optional CARTO „Voyager“ mit eigenem Schlüssel (`CONFIG.karte.carto`). Luftbild (in Niedersachsen immer, abschaltbar mit `CONFIG.karte.luftbild`): Digitale Orthophotos DOP20, © [LGLN](https://www.lgln.niedersachsen.de) (CC BY 4.0), als WMS; optional ganz Deutschland mit Esri World Imagery (`CONFIG.karte.esri`). Namen und Straßen auf dem Luftbild zeichnet die App selbst aus Vektordaten (OpenMapTiles-Schema, © [OpenMapTiles](https://openmaptiles.org), © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende) von [OpenFreeMap](https://openfreemap.org) (`CONFIG.karte.beschriftung`). Ohne Netz zeichnet die App die Stadtteile vereinfacht selbst; Lage der Mittelpunkte: OpenStreetMap und [GeoNames](https://www.geonames.org) (CC BY 4.0)
- Schrift: Barlow und Barlow Semi Condensed (SIL Open Font License), nach den deutschen Straßenschildern. Montserrat in der Wortmarke (SIL Open Font License)
- Tätigkeits-Bilder und Oberflächen: eigens für Hand Drauf gezeichnet (`design/bilder.py`, `design/texturen.py`)
- Lage der Stadtteile: OpenStreetMap (Haltestellen) und GeoNames
- Im Demo-Modus sind alle Personen und Anfragen erfunden. Es fließt kein Geld.
