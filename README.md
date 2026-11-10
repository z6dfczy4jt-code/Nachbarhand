# Hand Drauf

Prototyp einer App für Nachbarschaftshilfe in Garbsen: Anfragen auf einer Karte, eine kleine Aufwandsentschädigung, Nachrichten zwischen den Beteiligten und der Ablauf von der Zusage bis zur Bewertung.

- **Live:** https://z6dfczy4jt-code.github.io/Nachbarhand/ (das Repository heißt noch Nachbarhand, die App „Hand Drauf“)
- **Live** läuft die App mit der Supabase-Datenbank: echte Konten, gemeinsame Anfragen, Nachrichten. Stand und offene Schritte: [SETUP.md](SETUP.md)
- **Ohne Datenbank** (oder wenn sie nicht erreichbar ist) zeigt die App eine Demo mit erfundenen Beispielen. Die Vorschau in Claude ist immer die Demo.
- **Gebühren:** In der Testphase aus. Für Weg 2 (Bezahlung über die App) in `src/app.js` `CONFIG.gebuehren` auf `true` setzen, sobald Stripe eingerichtet ist.
- **Beispiele:** https://z6dfczy4jt-code.github.io/Nachbarhand/?beispiele zeigt die erfundenen Beispiele auch dann, wenn die Datenbank läuft, mit einem Hinweisband. Gut zum Vorführen, solange noch wenige echte Anfragen da sind.
- **iPhone-App:** vorbereitet mit Capacitor, gebaut wird sie an einem Mac. Anleitung, Apple-Regeln und Texte für den App Store: [APP-STORE.md](APP-STORE.md)
- **Als Web-App:** Auf dem Handy lässt sich die Seite auf den Startbildschirm legen und startet dann ohne Browserleiste. Die App-Hülle (Seite, Bilder, Karte) lädt auch bei schlechtem Netz.
- **Für alle Altersgruppen:** Schriftgröße gleich bei der Begrüßung wählbar, „Vorlesen“ in jeder Anfrage, Anrufen statt Schreiben, für Eltern oder Großeltern anfragen, fertige Sätze im Chat, mehr Kontrast, wenn das Gerät darum bittet.
- **Sicherheit:** Sicherheits-Code für die Tür (wie die PIN bei Uber), „Bescheid sagen“ an eine Vertrauensperson, Warnung bei typischen Betrugsmaschen im Chat.
- **Benachrichtigungen aufs Handy:** Web Push über die eigene Edge Function `supabase/functions/push` (ohne fremde Dienste wie Firebase), mit Erinnerungen vor und nach dem Termin und „Ich helfe gern bei …“. Einrichtung und Test: [SETUP.md](SETUP.md)
- **Preisvorschläge** aus echten Anfragen in Garbsen, sobald es je Tätigkeit genug gibt
- **Einladen:** QR-Code in der App und ein Aushang fürs Schwarze Brett mit Zetteln zum Abreißen: [assets/aushang.pdf](assets/aushang.pdf)

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/body.html` | Bildschirme und Bedien-Symbole |
| `src/kategorien/` | Tätigkeits-Bilder (3D-Objekte aus Microsoft Fluent Emoji, MIT-Lizenz), werden beim Bauen eingebettet |
| `src/kopfzeichen.svg` | Logo für die Kopfzeile (folgt hellem und dunklem Design) |
| `src/styles.css` | Gestaltung „Garbsen in Miniatur“: Schiefer, Klinkerrot, Rapsgelb; helles und dunkles Design, drei Schriftgrößen |
| `src/garbsen3d.js` | Die Nachbarschaft als 3D-Modell auf der Startseite (Three.js), offene Anfragen als Preisschilder über den Dächern |
| `src/app.js` | App-Logik, Karte, Demo- und Live-Modus, Nachrichten, Melden |
| `src/fragen.js` | Häufige Fragen (`#fragen`) |
| `src/recht.js` | Impressum, Datenschutzerklärung, Nutzungsbedingungen, Regeln (Fassung für die Testphase, vor dem Start anwaltlich prüfen lassen) |
| `src/vendor/leaflet-1.9.4.css` | Stile der Kartenbibliothek Leaflet |
| `supabase/schema.sql` | Tabellen, Zugriffsregeln und Funktionen für Supabase |
| `supabase/updates/` | Einzelne Datenbank-Updates zum Einfügen im SQL Editor |
| `supabase/functions/push/` | Edge Function für Benachrichtigungen: Verschlüsselung (RFC 8291) und Absender-Nachweis (VAPID) mit Bordmitteln |
| `sw.js` | Offline-Hülle: Seite zuerst aus dem Netz, feste Dateien aus dem Speicher, Anfragen und Karte nie zwischengespeichert. Zeigt Benachrichtigungen an |
| `tools/build.py` | Baut aus `src/` die fertige `index.html` |
| `assets/` | App-Icons, Leaflet, Three.js, Schriften (Barlow) und das Standbild der Miniatur für Geräte ohne 3D |
| `manifest.webmanifest` | Angaben für „Zum Home-Bildschirm“ |
| `design/logo/` | Logo „Hand Drauf“ als SVG (gestapelt, quer, hell, dunkel, App-Icon) und die Vorlage |
| `design/` | Skripte: `trace.py` zeichnet den Handschlag aus der Vorlage nach, `marke.py` setzt Logo und Icons |
| `package.json`, `capacitor.config.json` | iPhone-App mit Capacitor (siehe APP-STORE.md) |
| `app/resources/` | App-Symbol und Startbildschirme für die iPhone-App, erzeugt mit `design/app-bilder.py` |
| `assets/vorschau.png` | Vorschaubild für geteilte Links, erzeugt mit `design/vorschau.py` |
| `assets/aushang.pdf`, `assets/qr.svg`, `assets/badge-96.png` | Aushang, QR-Code und Zeichen für Benachrichtigungen, erzeugt mit `design/aushang.py` (QR-Code aus `design/qr.py`, ohne fremde Bibliothek) |
| `index.html` | Fertige App, wird von GitHub Pages ausgeliefert. Nicht von Hand ändern, sondern mit `python3 tools/build.py` neu bauen |

## Daten und Quellen

- Kartenbibliothek: [Leaflet](https://leafletjs.com) 1.9.4 (BSD-2-Clause), liegt unter `assets/vendor/`
- Kartenkacheln: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, Ersatz: © [CARTO](https://carto.com/attributions)
- 3D: [Three.js](https://threejs.org) r170 (MIT), liegt unter `assets/vendor/`. Das Modell selbst (Häuser, Hecken, Kanal) ist im Code gebaut, ohne fremde Modelldateien
- Schrift: Barlow und Barlow Semi Condensed (SIL Open Font License), nach den deutschen Straßenschildern. Montserrat in der Wortmarke (SIL Open Font License)
- Tätigkeits-Bilder: Microsoft Fluent Emoji 3D (MIT-Lizenz), siehe `src/kategorien/LIZENZ-fluent-emoji.txt`
- Lage der Stadtteile: OpenStreetMap (Haltestellen) und GeoNames
- Im Demo-Modus sind alle Personen und Anfragen erfunden. Es fließt kein Geld.
