# Datenbank (Supabase)

**Stand (11. November 2026):** Eingespielt bis Teil 4 (`supabase/updates/2026-11-fuer-wen-code-benachrichtigungen.sql`). Die Edge Function `push` ist eingerichtet. **Noch offen:** Teil 5 (`2026-11-erinnerungen-richtwerte.sql`: Erinnerungen, Preisvorschläge aus echten Anfragen, „Ich helfe gern bei …“) Teil 6 (`2026-11-fehlerberichte-indizes.sql`: Fehlerberichte der App, schnellere Indizes) Teil 7 (`2026-11-deutschlandweit.sql`: Orte in ganz Deutschland statt fester Stadtteile von Garbsen, Umkreis für „Neue Anfragen in der Nähe“) und Teil 8 (`2026-11-bewertungen-mit-text.sql`: geschriebene Bewertungen, die für beide gleichzeitig erscheinen, Bewertungen im Profil, Bewertungen melden). Reihenfolge: 5, 6, 7, 8. Die App läuft auch ohne sie; ohne Teil 7 gehen aber nur die Stadtteile von Garbsen, ohne Teil 8 nur Sterne ohne Text. Das Supabase-Projekt **hand-drauf** läuft in Frankfurt (Projekt-ID `hgfwbjesolgneyapehta`, kostenloser Plan). Tabellen, Zugriffsregeln und Funktionen aus [`supabase/schema.sql`](supabase/schema.sql) sind eingespielt und getestet. Die App ist verbunden (`supabase` in `einstellungen.json`) und läuft auf GitHub Pages mit echten Konten. Für den Umzug auf einen eigenen Server: [SERVER.md](SERVER.md).

In `einstellungen.json` stehen nur die **Project URL** und der **Publishable key**. Beide sind öffentlich. Den **Secret key** bzw. **service_role** Key niemals weitergeben oder in die App schreiben. Der Build bricht ab, wenn dort ein solcher Schlüssel steht.

## Noch zu tun im Supabase-Dashboard

### 1. Abgleich mit geleakten Passwörtern einschalten (empfohlen)

**Authentication** → **Sign In / Providers** → **Email** → **Leaked password protection** einschalten. Dann lehnt Supabase Passwörter ab, die schon einmal bei einem Datenleck aufgetaucht sind. (Falls die Option im kostenlosen Plan fehlt: erst mit dem Pro-Plan.)

### 2. Adresse der App eintragen (wichtig)

Sonst führt der Link in der Bestätigungs-E-Mail ins Leere.

1. Auf [supabase.com/dashboard](https://supabase.com/dashboard) das Projekt **hand-drauf** öffnen.
2. Links **Authentication** → **URL Configuration**.
3. **Site URL**: `https://z6dfczy4jt-code.github.io/Nachbarhand/`
4. Unter **Redirect URLs** dieselbe Adresse hinzufügen und speichern.

### 3. E-Mail-Versand für alle Nachbarn

Der eingebaute E-Mail-Versand von Supabase schickt Bestätigungs-E-Mails **nur an Mitglieder deines Supabase-Teams** und nur wenige pro Stunde. Zum Ausprobieren mit dem eigenen Konto reicht das. Damit sich Nachbarn registrieren können, gibt es zwei Wege:

- **Empfohlen: eigener E-Mail-Versand.** Ein kostenloses Konto bei einem Versanddienst wie [Brevo](https://www.brevo.com) oder [Resend](https://resend.com) anlegen und dessen SMTP-Daten unter **Authentication** → **Emails** → **SMTP Settings** eintragen. Danach unter **Rate Limits** die Zahl der E-Mails pro Stunde anpassen.
- **Nur für einen kleinen, geschlossenen Test:** unter **Authentication** → **Sign In / Providers** → **Email** die Option **Confirm email** ausschalten. Dann kann sich aber jeder mit einer fremden E-Mail-Adresse registrieren. Vor dem öffentlichen Start wieder einschalten.

### 4. Anmelden mit Code (ohne Passwort) freischalten

In der App ist alles fertig, aber noch ausgeschaltet (`"codeLogin": false` in `einstellungen.json`), weil es den eigenen E-Mail-Versand aus Schritt 3 braucht. Danach:

1. **Authentication** → **Emails** → **Templates** → **Magic Link**: Betreff z. B. „Dein Code für Hand Drauf“, im Text statt des Links den Code einsetzen: `Dein Code: {{ .Token }}` (gilt eine Stunde).
2. In `einstellungen.json` `"codeLogin": true` setzen und neu bauen (`python3 tools/build.py`).

Dann können sich alle ohne Passwort anmelden: E-Mail eingeben, Code mit 6 Ziffern aus der E-Mail abtippen. Das ersetzt auch „Passwort vergessen“.

### 5. Betreiber eintragen

Für Impressum und Datenschutzerklärung in `einstellungen.json` unter `betreiber` Name, ladungsfähige Anschrift und E-Mail eintragen. Solange die Felder leer sind, zeigen die Rechtstexte einen gelben Hinweis.

## Benachrichtigungen aufs Handy

Eingerichtet am 10. November 2026, nichts mehr zu tun. So funktioniert es:

- Wer im Menü „Bescheid aufs Handy“ einschaltet, meldet sein Gerät an (Tabelle `push_abos`, über die App nicht lesbar).
- Auslöser in der Datenbank (`privat.push_gesuch`, `privat.push_nachricht`) rufen bei Zusage, Nachricht, „erledigt“ und Bestätigung die Edge Function **push** auf. Die verschlüsselt die Mitteilung und schickt sie an Google, Apple, Mozilla oder Microsoft. Nachrichtentexte stehen nie in der Mitteilung.
- Der private Schlüssel liegt nur in der Datenbank (`privat.einstellungen`, Name `push_schluessel`). Der öffentliche Schlüssel steht in `src/app.js` (`CONFIG.push`) und in `supabase/functions/push/index.ts` (`ERLAUBT`). Ohne den privaten Schlüssel nimmt die Funktion nichts an.
- Geräte, die es nicht mehr gibt, löscht die Datenbank beim nächsten Senden von selbst.
- Auf dem iPhone gehen Benachrichtigungen nur, wenn Hand Drauf auf dem Home-Bildschirm liegt (ab iOS 16.4).

**Erinnerungen:** Stündlich (Minute 7) prüft `privat.erinnern()` über pg_cron, wer erinnert werden sollte: am Abend vor dem Termin (ab 17 Uhr), am Tag danach „erledigt melden?“ (ab 10 Uhr) und einen Tag nach „erledigt“ „bitte bestätigen“. Jede Erinnerung nur einmal, nie zwischen 21 und 9 Uhr. Die Läufe stehen im Dashboard unter **Integrations** → **Cron**.

**Testen:** Im Menü „Test-Benachrichtigung schicken“ tippen.

**Neuer Schlüssel** (nur nötig, wenn der private Schlüssel jemals nach außen gelangt): In `index.ts` `ERLAUBT = ''` setzen und die Funktion neu veröffentlichen, dann im SQL Editor `select net.http_post(url := (select wert from privat.einstellungen where name = 'push_url'), body := '{"neu": true}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select wert from privat.einstellungen where name = 'push_jwt')));` ausführen, die Antwort aus `net._http_response` wie in `supabase/updates/2026-11-fuer-wen-code-benachrichtigungen.sql` beschrieben in `privat.einstellungen` speichern und den neuen öffentlichen Schlüssel in `index.ts` und `src/app.js` eintragen. Alle müssen Benachrichtigungen danach einmal neu einschalten.

## Karte

Die Straßenkarte kommt ohne Einrichtung von [basemap.de](https://basemap.de), der amtlichen Webkarte von Bund und Ländern (kostenlos, ohne Schlüssel, Server in Deutschland, Lizenz CC BY 4.0). Ist basemap.de nicht erreichbar, nimmt die App OpenStreetMap, ohne Netz zeichnet sie Garbsen vereinfacht selbst.

Optional: Mit einem kostenlosen Schlüssel von [carto.com](https://carto.com/basemaps) zeigt die Karte zuerst den Stil „Voyager“ (nachts „Dark Matter“). Den Schlüssel in `einstellungen.json` bei `karte` → `carto` eintragen und neu bauen. Gewerblich ist das bis 1 Million Kartenbilder im Monat kostenlos. CARTO sitzt in den USA, dann muss die Datenschutzerklärung (Abschnitt 3) ergänzt werden.

## Fehlerberichte ansehen (nach Teil 6)

Stürzt die App auf einem Gerät ab, schickt sie eine kurze technische Meldung (ohne Namen und Inhalte). In Supabase links **Table Editor** → oben das Schema **privat** wählen → Tabelle **fehlerberichte**. Spalte `anzahl` zeigt, wie oft derselbe Fehler an diesem Tag kam, `geraet` den Browser. Nach 30 Tagen werden die Meldungen gelöscht. Am einfachsten: die Zeilen kopieren und Claude geben.

## Meldungen prüfen

Nutzer können eine Anfrage oder eine beteiligte Person melden. Die Meldungen sieht nur der Betreiber:

1. In Supabase links **Table Editor** öffnen und die Tabelle **meldungen** wählen.
2. Neue Meldungen haben den Status `neu`. Nach dem Prüfen den Status auf `geprueft` oder `erledigt` setzen.
3. Ist eine Anfrage nicht in Ordnung: in der Tabelle **gesuche** (so heißen die Anfragen in der Datenbank) den Status auf `zurueckgezogen` setzen. Dann sieht sie niemand mehr.

## Nach einem Update

Wenn sich `supabase/schema.sql` geändert hat, das Skript im **SQL Editor** noch einmal ausführen (oder Claude bitten, es über die Supabase-Verbindung einzuspielen). Vorhandene Daten bleiben erhalten. Kleinere Updates liegen zusätzlich einzeln in `supabase/updates/`.

Ändern sich Dateien in `assets/` (Schriften, Symbole), in `sw.js` die Versionsnummer `VERSION` erhöhen, damit installierte Apps die neuen Dateien laden. Die Seite selbst lädt die App immer zuerst frisch aus dem Netz.

## Gut zu wissen

- **Pause:** Kostenlose Projekte pausieren nach 7 Tagen ohne Nutzung. Im Dashboard lassen sie sich mit einem Tippen wieder starten. Solange das Projekt pausiert, zeigt die App die Demo.
- **Datenschutz:** Gespeichert werden E-Mail, Vorname, Anfangsbuchstabe des Nachnamens, Stadtteil, Anfragen, die Adresse und freiwillig eine Telefonnummer zu einer Anfrage, Nachrichten, Meldungen und, wenn eingeschaltet, die Geräte-Adressen für Benachrichtigungen. Vor dem öffentlichen Start eine Datenschutzerklärung ergänzen und mit Supabase den Auftragsverarbeitungsvertrag (DPA) abschließen.

## Was die Datenbank absichert

| Regel | Umsetzung |
| --- | --- |
| Adresse und Telefon nur für Beteiligte | Eigene Tabelle `gesuch_adressen`, lesbar nur für die Person, die die Anfrage gestellt hat, und die Person, die zugesagt hat. Telefon ist freiwillig und wird geprüft (6 bis 20 Ziffern) |
| Sicherheits-Code | Bei jeder Zusage würfelt die Datenbank einen vierstelligen Code (`privat.neuer_code`). Nur die beiden Beteiligten sehen ihn. Bei Absage, Blockieren oder Konto löschen wird er gelöscht |
| Für jemand anderen | Spalte `fuer` (höchstens 40 Zeichen, mit Wortfilter), öffentlich sichtbar, damit Helfer wissen, wen sie an der Tür treffen |
| Benachrichtigungen | Nur Adressen von Google, Apple, Mozilla und Microsoft, höchstens 5 Geräte pro Person, neue Anfragen höchstens alle 20 Minuten, Test höchstens alle 20 Sekunden. Fehler beim Senden halten nie einen Auftrag auf |
| Zähler | `statistik()` gibt nur zwei Summen heraus (diese Woche, insgesamt), keine Namen |
| Preisvorschläge | `richtwerte()` gibt je Tätigkeit nur die übliche Spanne heraus, und erst ab 5 Anfragen |
| Alte Anfragen verschwinden | Offene Anfragen sieht man nur bis Mitternacht nach dem letzten gewünschten Tag (Termine höchstens 60 Tage im Voraus, ohne Termin 21 Tage). Danach kann niemand mehr zusagen. Wer die Anfrage erstellt hat, sieht es weiter und kann einen neuen Termin wählen |
| Bearbeiten nur vor der Zusage | Eigene Anfragen lassen sich ändern, solange niemand zugesagt hat. Neuer Stadtteil = neue ungefähre Lage |
| Blockieren | Wer jemanden blockiert, sieht dessen Anfragen nicht mehr und umgekehrt. Zusagen und Nachrichten zwischen beiden sind gesperrt, laufende Zusagen enden. Die Hilfsfunktionen liegen im Schema `privat`, das Supabase nicht über die API anbietet |
| Wortfilter | Anfragen und Nachrichten mit beleidigenden Wörtern lehnt die Datenbank ab (`privat.anstoessig`, dieselbe Liste prüft die App vorab) |
| Pin zeigt keine Hausnummer | Die Datenbank setzt die Lage zufällig 100 bis 400 m um die Stadtteilmitte |
| Helfen erst ab 18 | Wird bei der Registrierung bestätigt und bei jeder Zusage geprüft |
| Nachbarschaftshilfe bleibt klein | Höchstens 50 € pro Anfrage, 5 laufende Anfragen pro Person, 8 Zusagen in 30 Tagen, höchstens 2 für dieselbe Person in 30 Tagen |
| Nachrichten privat | Nur die beiden Beteiligten eines Auftrags lesen und schreiben Nachrichten, erst nach der Zusage. Zieht jemand seine Zusage zurück, wird der Verlauf gelöscht. Höchstens 30 Nachrichten in 10 Minuten |
| Melden | Anfrage oder beteiligte Person melden, mit Grund. Meldungen kann über die App niemand lesen, auch nicht die gemeldete Person. Höchstens 10 Meldungen am Tag |
| Keine Manipulation | Niemand ändert Tabellen direkt, alle Schritte laufen über geprüfte Funktionen, Bewertungen kann man nicht selbst ändern |
| Testphase ohne Bezahlung (Weg 1) | Die App vermittelt nur, die Aufwandsentschädigung zahlen die Beteiligten direkt untereinander |
