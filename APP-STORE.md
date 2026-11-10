# Hand Drauf im Apple App Store

**Stand:** 9. November 2026. Vorbereitet ist alles, was ohne Mac geht. Gebaut und hochgeladen wird die App später zusammen an einem Mac.

## So wird aus der Web-App eine iPhone-App

Die App bekommt mit [Capacitor](https://capacitorjs.com) eine native iPhone-Hülle. Die Dateien der App liegen dann **auf dem iPhone** (nicht nur eine Website im Rahmen). Die App nutzt dieselbe Datenbank und dieselben Konten wie die Website. Ein Update der Website ändert die iPhone-App nicht. Für die App braucht es jeweils einen neuen Build.

| Datei | Zweck |
| --- | --- |
| `package.json` | Capacitor 8.5 und die Erweiterungen „Teilen“ und „Dateien“ (für Kalender-Einträge) |
| `capacitor.config.json` | App-Name, Bundle-ID `de.handdrauf.app`, Ordner `app/www` |
| `tools/build.py --app` | Baut `app/www/` (App plus Schriften, Karte, Symbole) |
| `app/resources/` | App-Symbol 1024 × 1024 und Startbildschirme hell und dunkel, erzeugt mit `design/app-bilder.py` |

Was in der App anders läuft als auf der Website (in `src/app.js`, Stichwort `NATIV`):
- Teilen öffnet das iPhone-Teilen-Menü (Erweiterung `@capacitor/share`).
- „In den Kalender eintragen“ legt die Termin-Datei ab und öffnet sie über das Teilen-Menü.
- Geteilte Links und der Link in der Bestätigungs-E-Mail zeigen auf die Website.
- Rechtstexte aus dem Anmeldeformular öffnen sich in Safari.
- Kein Hinweis „Auf den Startbildschirm“, keine Offline-Hülle (die App liegt ohnehin auf dem Gerät).

## Was Apple verlangt, und wo wir stehen

Quelle: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), abgerufen am 9. November 2026.

| Regel | Was Apple verlangt | Stand |
| --- | --- | --- |
| 1.2 Inhalte von Nutzern | Filter für anstößige Inhalte | Erledigt: Wortfilter in App und Datenbank |
| | Melden und zeitnahe Reaktion | Erledigt: „Melden“ in jeder Anfrage. **Offen:** Meldungen wirklich zeitnah prüfen (Ziel: innerhalb von 24 Stunden) |
| | Nutzer blockieren | Erledigt: im Profil, aufheben unter „Konto“ |
| | Veröffentlichte Kontaktdaten | **Offen:** Betreiber-Daten in `einstellungen.json` (`betreiber`) eintragen (Impressum, E-Mail) |
| 5.1.1 (v) | Konto in der App löschen | Erledigt: „Konto löschen“ unter „Konto“ |
| 5.1.1 Datenschutz | Datenschutzerklärung in der App und in App Store Connect | Erledigt in der App. Link für App Store Connect: `https://z6dfczy4jt-code.github.io/Nachbarhand/#datenschutz` |
| 3.1.3 (e) | Dienstleistungen, die außerhalb der App erbracht werden, **nicht** über In-App-Kauf bezahlen | Passt: Testphase ohne Bezahlung, später Stripe. Apple bekommt dafür keine Provision |
| 4.8 | Anmeldung über Google/Facebook nur mit gleichwertiger Alternative | Passt: nur eigene Konten mit E-Mail, „Mit Apple anmelden“ ist nicht nötig |
| 4.2 Mindestfunktionen | Mehr als eine verpackte Website | **Teilweise:** Dateien auf dem Gerät, Teilen-Menü, Kalender. **Dringend empfohlen vor dem Einreichen:** Push-Mitteilungen (neue Nachricht, Zusage, Bitte bestätigen) |
| 2.1 Vollständigkeit | App muss fertig und prüfbar sein | **Offen:** Test-Konto für Apple anlegen, E-Mail-Versand (SMTP) einrichten, Betreiber-Daten |
| Händlerstatus (EU, DSA) | Angabe, ob man als Händler auftritt | **Entscheiden:** Mit Gebühren ist man Händler. Dann zeigt der App Store Adresse, Telefon und E-Mail öffentlich an |
| Alterseinstufung | Fragebogen in App Store Connect | 18+ wählen, passend zu den Nutzungsbedingungen (Konto erst ab 18) |
| Exportkontrolle | Frage zur Verschlüsselung | Nur HTTPS, also keine meldepflichtige Verschlüsselung: in `Info.plist` `ITSAppUsesNonExemptEncryption` = `NO` |

## Schritt 1: Apple-Entwicklerkonto (geht ohne Mac)

Das Apple Developer Program kostet 99 USD im Jahr (Apple zeigt beim Anmelden den Preis in Euro) ([Apple](https://developer.apple.com/de/support/enrollment/)).

| | Als Privatperson | Als Organisation |
| --- | --- | --- |
| Wer | Einzelperson, auch mit Einzelgewerbe | Nur juristische Personen, z. B. UG oder GmbH. Ein Einzelgewerbe zählt **nicht** |
| Im App Store steht | Dein voller Name | Der Firmenname |
| Braucht | Apple-Account mit Zwei-Faktor-Anmeldung, eigene Kreditkarte | D-U-N-S-Nummer (kostenlos), Website, E-Mail-Adresse mit eigener Domain, Zeichnungsbefugnis |
| Passt für | Testphase und den Start | Später, wenn eine UG gegründet ist |

Danach in [App Store Connect](https://appstoreconnect.apple.com) unter **Apps** → **+** eine neue App anlegen: Plattform iOS, Name „Hand Drauf“, Sprache Deutsch, Bundle-ID `de.handdrauf.app` (vorher unter **Certificates, Identifiers & Profiles** anlegen; der Name lässt sich bis zum ersten Upload noch ändern), SKU z. B. `handdrauf-ios`.

## Schritt 2: Am Mac bauen

Voraussetzungen: macOS mit **Xcode 26** (kostenlos im Mac App Store) und **Node.js 22** oder neuer ([nodejs.org](https://nodejs.org)). Capacitor 8 verlangt beides ([Capacitor](https://capacitorjs.com/docs/updating/8-0)).

```bash
git clone https://github.com/z6dfczy4jt-code/Nachbarhand.git
cd Nachbarhand
npm install
npx cap add ios          # legt den Ordner ios/ an (einmalig, danach mit einchecken)
npm run app:icons        # App-Symbol und Startbildschirme in allen Größen
npm run app:bauen        # baut app/www und kopiert es in das Xcode-Projekt
npm run app:oeffnen      # öffnet Xcode
```

In Xcode:
1. Links das Projekt **App** wählen → **Signing & Capabilities** → bei **Team** das Entwicklerkonto auswählen. Bundle Identifier `de.handdrauf.app`.
2. **Info** → Eintrag `ITSAppUsesNonExemptEncryption` vom Typ Boolean mit Wert `NO` hinzufügen. „Bundle display name“ = `Hand Drauf`, Entwicklungssprache Deutsch.
3. **General** → Minimum Deployments: iOS 15.0 (Vorgabe von Capacitor 8).
4. Oben ein iPhone-Simulator wählen und ▶︎ drücken. Testen: Anmelden, Anfrage erstellen, zusagen, Nachricht, Teilen, Kalender, Blockieren, Konto löschen.
5. Auf einem echten iPhone testen (per Kabel, „Entwicklermodus“ am iPhone einschalten).
6. **Product** → **Archive** → **Distribute App** → **App Store Connect**. Danach ist der Build in TestFlight. Dort zuerst mit ein paar Nachbarn testen.

Bei jeder Änderung an der App: `npm run app:bauen`, in Xcode die **Build**-Nummer erhöhen, neu archivieren.

## Schritt 3: Angaben in App Store Connect

**Name:** Hand Drauf
**Untertitel** (höchstens 30 Zeichen): Nachbarschaftshilfe in Garbsen
**Kategorie:** Lifestyle, zweite Kategorie: Soziale Netze
**Schlüsselwörter** (höchstens 100 Zeichen): `Nachbarschaftshilfe,Nachbarn,Garbsen,Alltagshilfe,Rasen,Einkauf,Senioren,Hannover,Garten,Hilfe`

**Werbetext:** Rasen mähen, Einkauf hochtragen, Drucker einrichten: Nachbarn in Garbsen helfen sich bei kleinen Dingen, gegen eine kleine Aufwandsentschädigung.

**Beschreibung:**
> Hand Drauf bringt Nachbarn in Garbsen zusammen. Wer Hilfe braucht, stellt eine Anfrage, und wer in der Nähe ist und Zeit hat, sagt zu.
>
> SO FUNKTIONIERT ES
> • Anfrage in vier kurzen Schritten: Was, wann, wo und wie viel du gibst
> • Auf der Karte sehen, wo in deiner Nähe Hilfe gebraucht wird
> • Zusagen, Nachrichten schreiben, Termin in den Kalender übernehmen
> • Nach der Hilfe bestätigen und gegenseitig bewerten
>
> SICHER UNTER NACHBARN
> • Die genaue Adresse sieht nur, wer zusagt. Auf der Karte erscheint nur ein ungefährer Punkt
> • Echte Profile mit Bewertungen, Konto ab 18 Jahren
> • Melden und Blockieren in jeder Anfrage
>
> FÜR ALLE GEMACHT
> • Große Schrift, helles und dunkles Design
> • Klare Sprache, keine Werbung
>
> In der Testphase ist Hand Drauf kostenlos. Die Aufwandsentschädigung zahlt ihr direkt untereinander.

**Support-URL:** `https://z6dfczy4jt-code.github.io/Nachbarhand/#fragen`
**Datenschutz-URL:** `https://z6dfczy4jt-code.github.io/Nachbarhand/#datenschutz`

**App-Datenschutz („Datenschutz-Etiketten“):** Kein Tracking. Alle Angaben „mit dem Nutzer verknüpft“, Zweck „App-Funktionalität“:
- Kontaktinformationen: E-Mail-Adresse, Name (Vorname und Anfangsbuchstabe), physische Adresse (nur die Adresse zu einer Anfrage)
- Benutzerinhalte: Andere Benutzerinhalte (Anfragen, Bewertungen, Meldungen), Nachrichten
- Kennungen: Benutzer-ID
- Nicht erhoben: Standort des Geräts, Nutzungsdaten, Diagnosedaten, Finanzdaten (solange es keine Bezahlung in der App gibt)

**Hinweise für die Prüfung** (auf Englisch, mit Test-Konto):
> Hand Drauf is a neighbourhood help app for Garbsen, Germany. Users post small requests (e.g. mowing a lawn) with a small allowance; neighbours commit, chat and confirm completion.
> Payment: during the test phase the allowance is paid directly between users outside the app (cash or bank transfer). Planned platform fees will be for services performed in the physical world and will use a payment method other than in-app purchase (guideline 3.1.3(e)).
> User-generated content (guideline 1.2): offensive words are filtered in requests and messages (client and database), every request and job has "Melden" (report), users can block others from the profile view, reports are reviewed within 24 hours, contact details are in "Impressum".
> Accounts can be deleted in "Konto" → "Konto löschen" (guideline 5.1.1(v)).
> Test account: [E-Mail] / [Passwort]. The account is 18+, located in Garbsen-Mitte, and already has one sample request.

## Vor dem Einreichen: Liste

- [ ] Entwicklerkonto (Privatperson oder Organisation) und App in App Store Connect anlegen
- [ ] Betreiber-Daten in `einstellungen.json` (`betreiber`) (Impressum, Kontakt-E-Mail) eintragen
- [ ] E-Mail-Versand (SMTP) in Supabase einrichten, siehe `SETUP.md`
- [ ] Test-Konto für Apple anlegen (E-Mail bestätigt, eine Beispiel-Anfrage)
- [ ] Push-Mitteilungen einbauen (empfohlen wegen Regel 4.2, braucht den Apple-Push-Schlüssel aus dem Entwicklerkonto)
- [ ] Händlerstatus entscheiden
- [ ] Bildschirmfotos für iPhone 6,9 Zoll (z. B. 1320 × 2868) aufnehmen: Start, Karte, Anfrage, Nachrichten, Profil
- [ ] Mit TestFlight bei ein paar Nachbarn testen
- [ ] Meldungen täglich prüfen (Supabase → Table Editor → `meldungen`)

## Später: Android

Mit demselben Capacitor-Projekt geht auch eine Android-App (`npx cap add android`). Google Play kostet einmalig 25 USD. Neue private Entwicklerkonten müssen vor der Veröffentlichung einen geschlossenen Test mit mehreren Testern über mehrere Tage durchführen.
