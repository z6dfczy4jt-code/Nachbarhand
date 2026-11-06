# Datenbank einrichten (Supabase)

Ohne Datenbank läuft Hand drauf im **Demo-Modus** mit erfundenen Beispielen, die nur auf deinem Gerät gespeichert werden.
Mit Supabase bekommt die App **echte Konten** und eine **gemeinsame Datenbank**: Was Karin einstellt, sieht Tim auf seinem Handy.

Supabase ist für ein Projekt dieser Größe kostenlos. Die Einrichtung dauert etwa 10 Minuten.

## 1. Projekt anlegen

1. Auf [supabase.com](https://supabase.com) auf **Start your project** tippen und **mit GitHub anmelden**.
2. **New project** wählen:
   - Name: `hand-drauf`
   - Database Password: auf **Generate a password** tippen und das Passwort sicher aufbewahren (wird für die App nicht gebraucht)
   - Region: **Central EU (Frankfurt)**, damit die Daten in der EU liegen
   - Plan: **Free**
3. **Create new project** tippen und ein bis zwei Minuten warten.

## 2. Tabellen und Regeln anlegen

1. Die Datei [`supabase/schema.sql`](supabase/schema.sql) öffnen, auf **Raw** tippen und den gesamten Text kopieren.
2. In Supabase links **SQL Editor** öffnen, **New query** wählen, den Text einfügen und **Run** tippen.
3. Es sollte „Success. No rows returned“ erscheinen. Das Skript darf auch mehrfach ausgeführt werden.

## 3. Adresse der App eintragen

Damit der Link in der Bestätigungs-E-Mail zur App führt:

1. Links **Authentication** → **URL Configuration** öffnen.
2. **Site URL**: `https://z6dfczy4jt-code.github.io/Nachbarhand/`
3. Unter **Redirect URLs** dieselbe Adresse hinzufügen und speichern.

## 4. Zugangsdaten an Claude geben

1. Links **Project Settings** → **API Keys** (bei älteren Projekten: **API**) öffnen.
2. Diese zwei Werte kopieren:
   - **Project URL**, z. B. `https://abcdefgh.supabase.co` (steht unter **Data API** bzw. **API**)
   - **Publishable key** (beginnt mit `sb_publishable_`) oder bei älteren Projekten den **anon public** Key
3. Beide Werte an Claude schicken. Claude trägt sie in `src/app.js` ein und lädt die App neu hoch.

Diese beiden Werte sind **öffentlich** und dürfen im Code stehen. Die Regeln in der Datenbank schützen die Daten.
Den **Secret key** bzw. **service_role** Key dagegen **niemals** weitergeben oder in die App schreiben.

## Gut zu wissen

- **Bestätigungs-E-Mails:** Supabase verschickt im kostenlosen Plan nur wenige E-Mails pro Stunde. Für Tests reicht das. Für viele Nutzer später einen eigenen E-Mail-Versand einrichten (Authentication → Emails → SMTP).
- **Pause:** Kostenlose Projekte pausieren nach 7 Tagen ohne Nutzung. Im Dashboard lassen sie sich mit einem Tippen wieder starten.
- **Datenschutz:** Gespeichert werden E-Mail, Vorname, Anfangsbuchstabe des Nachnamens, Stadtteil, Gesuche und die Adresse zu einem Gesuch. Vor dem öffentlichen Start eine Datenschutzerklärung ergänzen und mit Supabase den Auftragsverarbeitungsvertrag (DPA) abschließen.

## Was die Datenbank absichert

| Regel | Umsetzung |
| --- | --- |
| Adresse nur für Beteiligte | Eigene Tabelle `gesuch_adressen`, lesbar nur für die Person, die das Gesuch erstellt hat, und die Person, die zugesagt hat |
| Pin zeigt keine Hausnummer | Die Datenbank setzt die Lage zufällig 100 bis 400 m um die Stadtteilmitte |
| Helfen erst ab 18 | Wird bei der Registrierung bestätigt und bei jeder Zusage geprüft |
| Nachbarschaftshilfe bleibt klein | Höchstens 50 € pro Gesuch, 5 laufende Gesuche pro Person, 8 Zusagen in 30 Tagen, höchstens 2 für dieselbe Person in 30 Tagen |
| Keine Manipulation | Niemand ändert Tabellen direkt, alle Schritte laufen über geprüfte Funktionen, Bewertungen kann man nicht selbst ändern |
| Testphase ohne Bezahlung (Weg 1) | Die App vermittelt nur, die Aufwandsentschädigung zahlen die Beteiligten direkt untereinander |
