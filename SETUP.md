# Datenbank (Supabase)

**Stand (9. November 2026):** Alle Updates bis einschließlich Blockieren und Wortfilter sind eingespielt. Das Supabase-Projekt **hand-drauf** läuft in Frankfurt (Projekt-ID `hgfwbjesolgneyapehta`, kostenloser Plan). Tabellen, Zugriffsregeln und Funktionen aus [`supabase/schema.sql`](supabase/schema.sql) sind eingespielt und getestet. Die App ist verbunden (`LIVE` in `src/app.js`) und läuft auf GitHub Pages mit echten Konten.

In `src/app.js` stehen nur die **Project URL** und der **Publishable key**. Beide sind öffentlich. Den **Secret key** bzw. **service_role** Key niemals weitergeben oder in die App schreiben.

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

### 4. Betreiber eintragen

Für Impressum und Datenschutzerklärung in `src/app.js` unter `CONFIG.betreiber` Name, ladungsfähige Anschrift und E-Mail eintragen. Solange die Felder leer sind, zeigen die Rechtstexte einen gelben Hinweis.

## Meldungen prüfen

Nutzer können eine Anfrage oder eine beteiligte Person melden. Die Meldungen sieht nur der Betreiber:

1. In Supabase links **Table Editor** öffnen und die Tabelle **meldungen** wählen.
2. Neue Meldungen haben den Status `neu`. Nach dem Prüfen den Status auf `geprueft` oder `erledigt` setzen.
3. Ist eine Anfrage nicht in Ordnung: in der Tabelle **gesuche** (so heißen die Anfragen in der Datenbank) den Status auf `zurueckgezogen` setzen. Dann sieht sie niemand mehr.

## Nach einem Update

Wenn sich `supabase/schema.sql` geändert hat, das Skript im **SQL Editor** noch einmal ausführen (oder Claude bitten, es über die Supabase-Verbindung einzuspielen). Vorhandene Daten bleiben erhalten. Kleinere Updates liegen zusätzlich einzeln in `supabase/updates/`.

Ändern sich Dateien in `assets/` (Schriften, Icons, Leaflet), in `sw.js` die Versionsnummer `VERSION` erhöhen, damit installierte Apps die neuen Dateien laden. Die Seite selbst lädt die App immer zuerst frisch aus dem Netz.

## Gut zu wissen

- **Pause:** Kostenlose Projekte pausieren nach 7 Tagen ohne Nutzung. Im Dashboard lassen sie sich mit einem Tippen wieder starten. Solange das Projekt pausiert, zeigt die App die Demo.
- **Datenschutz:** Gespeichert werden E-Mail, Vorname, Anfangsbuchstabe des Nachnamens, Stadtteil, Anfragen, die Adresse zu einer Anfrage, Nachrichten und Meldungen. Vor dem öffentlichen Start eine Datenschutzerklärung ergänzen und mit Supabase den Auftragsverarbeitungsvertrag (DPA) abschließen.

## Was die Datenbank absichert

| Regel | Umsetzung |
| --- | --- |
| Adresse nur für Beteiligte | Eigene Tabelle `gesuch_adressen`, lesbar nur für die Person, die die Anfrage gestellt hat, und die Person, die zugesagt hat |
| Alte Anfragen verschwinden | Offene Anfragen sieht man nur bis Mitternacht nach dem gewünschten Termin, höchstens 21 Tage. Danach kann niemand mehr zusagen. Wer die Anfrage erstellt hat, sieht es weiter und kann einen neuen Termin wählen |
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
