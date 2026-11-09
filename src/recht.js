/* Rechtstexte von Hand Drauf: Impressum, Datenschutz, Nutzungsbedingungen, Regeln.
   Fassung für die Testphase (Weg 1: ohne Bezahlung über die App). Vor dem öffentlichen Start
   von einer Anwältin oder einem Anwalt für IT-Recht prüfen lassen.
   b = Betreiberdaten aus CONFIG.betreiber, e = HTML-Escape-Funktion. */
const RECHT_STAND = 'November 2026';
function RECHT_TEXTE(b, e) {
  const fehlt = !b.name || !b.anschrift || !b.email;
  const name = b.name ? e(b.name) : '<span class="platzhalter">[Name des Betreibers]</span>';
  const anschrift = b.anschrift ? e(b.anschrift).replace(/\n/g, '<br>') : '<span class="platzhalter">[Straße, Hausnummer, PLZ, Ort]</span>';
  const mail = b.email ? `<a href="mailto:${e(b.email)}">${e(b.email)}</a>` : '<span class="platzhalter">[E-Mail-Adresse]</span>';
  const offen = fehlt ? '<div class="recht-hinweis">Die Angaben zum Betreiber werden vor dem öffentlichen Start ergänzt.</div>' : '';
  const stand = `<p class="recht-stand">Stand: ${RECHT_STAND}</p>`;
  const verweis = (id, text) => `<a href="#${id}">${text}</a>`;

  return {
    impressum: {
      titel: 'Impressum',
      html: `${offen}
        <h3>Angaben nach § 5 Digitale-Dienste-Gesetz</h3>
        <p>${name}<br>${anschrift}</p>
        <h3>Kontakt</h3>
        <p>E-Mail: ${mail}${b.telefon ? `<br>Telefon: ${e(b.telefon)}` : ''}</p>
        <h3>Zentrale Kontaktstelle nach dem Digital Services Act</h3>
        <p>Für Behörden und Nutzer (Art. 11 und 12 DSA): ${mail}. Du kannst uns auf Deutsch oder Englisch schreiben.</p>
        <h3>Verbraucherstreitbeilegung</h3>
        <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
        <h3>Haftung für Inhalte</h3>
        <p>Gesuche und Nachrichten schreiben die Nutzer selbst. Wir prüfen sie nicht vorab, entfernen aber rechtswidrige Inhalte, sobald wir davon erfahren. Hinweise nehmen wir über „Melden“ in der App oder per E-Mail entgegen.</p>
        ${stand}`
    },

    datenschutz: {
      titel: 'Datenschutzerklärung',
      html: `${offen}
        <p class="recht-kurz">Kurz gesagt: Wir speichern nur, was für die Vermittlung nötig ist. Keine Werbung, kein Tracking, keine Weitergabe zu Werbezwecken.</p>

        <h3>1. Wer ist verantwortlich?</h3>
        <p>${name}<br>${anschrift}<br>E-Mail: ${mail}</p>

        <h3>2. Wenn du die App aufrufst</h3>
        <p>Die App liegt bei GitHub Pages, einem Dienst von GitHub (GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Niederlande, und GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA). Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie deine IP-Adresse, Zeitpunkt, Browser und Betriebssystem, um die Seite auszuliefern und vor Angriffen zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren, erreichbaren App (Art. 6 Abs. 1 lit. f DSGVO). Für Übermittlungen in die USA stützt sich GitHub auf das EU-US Data Privacy Framework und auf EU-Standardvertragsklauseln.</p>
        <p>Schriften und die Kartenbibliothek liefern wir selbst aus. Dafür werden keine Daten an Google oder andere Anbieter übertragen.</p>

        <h3>3. Karte</h3>
        <p>Die Kartenbilder lädt dein Gerät von den Servern der OpenStreetMap Foundation (St John’s Innovation Centre, Cowley Road, Cambridge, CB4 0WS, Großbritannien). Dabei wird deine IP-Adresse übertragen. Für Großbritannien gilt ein Angemessenheitsbeschluss der EU-Kommission. Sind diese Server nicht erreichbar, lädt die App die Kartenbilder von openstreetmap.de (FOSSGIS e.V., Deutschland) oder von CARTO. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO: Ohne Karte kann die App nicht zeigen, wo Hilfe gesucht wird.</p>
        <p>Deinen eigenen Standort fragt die App nicht ab. Sie rechnet Entfernungen von der Mitte deines Stadtteils aus.</p>

        <h3>4. Speicher auf deinem Gerät</h3>
        <p>Die App speichert im Browser deines Geräts (localStorage): deine Ansicht-Einstellungen, welche Nachrichten du gelesen hast, die Beispieldaten der Demo und, wenn du angemeldet bist, deine Anmeldung. Diese Daten bleiben auf deinem Gerät. Sie sind für die Funktionen nötig, die du nutzt (§ 25 Abs. 2 Nr. 2 TDDDG). Cookies für Werbung oder Statistik setzen wir nicht.</p>

        <h3>5. Wenn du ein Konto hast</h3>
        <p>Für Konten, Gesuche und Nachrichten nutzen wir Supabase (Supabase Pte. Ltd., Singapur). Die Datenbank liegt in einem Rechenzentrum in Frankfurt am Main. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Soweit Supabase für Betrieb und Support aus Ländern außerhalb der EU zugreift, gelten EU-Standardvertragsklauseln.</p>
        <p>Gespeichert werden:</p>
        <ul>
          <li>E-Mail-Adresse und Passwort (nur verschlüsselt als Prüfwert)</li>
          <li>Vorname, Anfangsbuchstabe des Nachnamens, Stadtteil und deine Bestätigung, dass du mindestens 18 bist</li>
          <li>deine Gesuche, die Adresse zu einem Gesuch, deine Zusagen und Bewertungen</li>
          <li>Nachrichten zu einem Auftrag und Meldungen, die du abschickst</li>
        </ul>
        <p>Rechtsgrundlage ist der Nutzungsvertrag mit dir (Art. 6 Abs. 1 lit. b DSGVO). Meldungen verarbeiten wir außerdem, um rechtswidrige Inhalte zu entfernen und Nutzer zu schützen (Art. 6 Abs. 1 lit. c und f DSGVO). Die Bestätigungs-E-Mail bei der Registrierung verschickt Supabase für uns.</p>
        <p>Die Programmbibliothek für die Anmeldung lädt die App vom Dienst jsDelivr. Dabei wird deine IP-Adresse an dessen Server übertragen (Art. 6 Abs. 1 lit. f DSGVO).</p>

        <h3>6. Wer sieht was?</h3>
        <ul>
          <li><strong>Alle, auch ohne Konto:</strong> offene Gesuche mit Vorname, Anfangsbuchstabe, Stadtteil, ungefährer Lage (100 bis 400 Meter um die Stadtteilmitte) und Bewertungsschnitt.</li>
          <li><strong>Nur die Person, die zusagt:</strong> die genaue Adresse.</li>
          <li><strong>Nur ihr beide:</strong> eure Nachrichten.</li>
          <li><strong>Nur wir:</strong> Meldungen. Die gemeldete Person erfährt nicht, wer gemeldet hat.</li>
        </ul>

        <h3>7. Wie lange?</h3>
        <p>Dein Konto und deine Daten speichern wir, bis du das Konto löschst. Das geht jederzeit in der App unter „Dein Konto“. Dann löschen wir dein Profil, deine Gesuche, Adressen, Nachrichten und Bewertungen. Meldungen bewahren wir höchstens zwölf Monate nach ihrer Bearbeitung auf, um wiederholte Verstöße erkennen zu können.</p>

        <h3>8. Deine Rechte</h3>
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit (Art. 15 bis 20 DSGVO). Verarbeitungen auf Grundlage unseres berechtigten Interesses kannst du widersprechen (Art. 21 DSGVO). Schreib uns dafür an ${mail}.</p>
        <p>Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren. In Niedersachsen ist das die Landesbeauftragte für den Datenschutz Niedersachsen, Prinzenstraße 5, 30159 Hannover.</p>

        <h3>9. Keine Werbung, kein Profiling</h3>
        <p>Wir verkaufen keine Daten, zeigen keine Werbung und treffen keine automatisierten Entscheidungen über dich.</p>
        ${stand}`
    },

    nutzung: {
      titel: 'Nutzungsbedingungen',
      html: `${offen}
        <p class="recht-kurz">Fassung für die Testphase in Garbsen. In dieser Phase ist Hand Drauf kostenlos und vermittelt nur.</p>

        <h3>1. Was Hand Drauf ist</h3>
        <p>Hand Drauf ist eine Plattform, auf der sich Nachbarn in Garbsen bei kleinen Dingen helfen: Wer Hilfe braucht, stellt ein Gesuch ein, wer helfen möchte, sagt zu. Betreiber ist ${name} (siehe ${verweis('impressum', 'Impressum')}).</p>
        <p>Die Absprache über eine Hilfe kommt nur zwischen euch Nutzern zustande. Hand Drauf ist nicht Vertragspartner, nicht Arbeitgeber und nicht Auftraggeber.</p>

        <h3>2. Kosten</h3>
        <p>In der Testphase ist die Nutzung kostenlos. Die Aufwandsentschädigung zahlt ihr direkt untereinander. Sollte Hand Drauf später Gebühren einführen, kündigen wir das vorher an. Gebühren fallen erst an, wenn du ihnen zustimmst.</p>

        <h3>3. Dein Konto</h3>
        <ul>
          <li>Ein Konto darf nur anlegen, wer mindestens 18 Jahre alt ist.</li>
          <li>Deine Angaben müssen stimmen. Jede Person hat nur ein Konto.</li>
          <li>Halte dein Passwort geheim. Du bist für alles verantwortlich, was über dein Konto passiert.</li>
        </ul>

        <h3>4. Nachbarschaftshilfe, kein Job</h3>
        <p>Hand Drauf ist für gelegentliche Hilfe gegen eine kleine Aufwandsentschädigung gedacht, nicht für regelmäßige oder gewerbliche Arbeit. Deshalb gilt:</p>
        <ul>
          <li>höchstens 50 € pro Gesuch,</li>
          <li>höchstens 5 laufende Gesuche pro Person,</li>
          <li>höchstens 8 Zusagen in 30 Tagen und höchstens 2 für dieselbe Person,</li>
          <li>keine Daueraufträge und keine Leistungen, für die man ein Gewerbe oder eine Ausbildung braucht.</li>
        </ul>
        <p>Nicht erlaubt sind insbesondere: Arbeiten an Strom-, Gas- oder Wasserleitungen, Arbeiten in gefährlicher Höhe, Fahrten gegen Bezahlung, Pflege und medizinische Hilfe, die Betreuung von Kindern ohne Anwesenheit der Eltern sowie alles, was gegen Gesetze verstößt.</p>

        <h3>5. Steuern und Sozialleistungen</h3>
        <p>Für Steuern und Meldepflichten ist jede Person selbst verantwortlich. Einkünfte aus gelegentlichen Leistungen bleiben bis unter 256 € Gewinn im Jahr steuerfrei (§ 22 Nr. 3 EStG). Wer Bürgergeld oder andere Leistungen bezieht, muss Einnahmen dem Jobcenter oder Amt melden.</p>

        <h3>6. Umgang miteinander</h3>
        <ul>
          <li>Bleib freundlich und ehrlich, in Gesuchen wie in Nachrichten. Halte dich an die ${verweis('regeln', 'Regeln für Nachbarn')}.</li>
          <li>Die Adresse, die du nach einer Zusage siehst, darfst du nur für diesen Auftrag nutzen.</li>
          <li>Keine Werbung, keine Weitergabe von Daten anderer.</li>
        </ul>

        <h3>7. Melden und Sperren</h3>
        <p>Über „Melden“ kannst du Gesuche und beteiligte Personen melden. Wir prüfen jede Meldung. Verstößt etwas gegen Gesetze oder diese Bedingungen, können wir Inhalte entfernen und Konten vorübergehend oder dauerhaft sperren. Wir sagen dir, was wir entschieden haben und warum. Bist du anderer Meinung, schreib uns an ${mail}.</p>

        <h3>8. Haftung</h3>
        <p>Für Schäden bei einer Hilfe haftet ihr untereinander nach den gesetzlichen Regeln. Prüf vorher, ob deine private Haftpflichtversicherung Schäden bei Gefälligkeiten abdeckt.</p>
        <p>Hand Drauf haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Bei leichter Fahrlässigkeit haften wir nur, wenn wir eine wesentliche Pflicht verletzen, auf die du vertrauen darfst, und nur für den typischerweise vorhersehbaren Schaden. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.</p>

        <h3>9. Verfügbarkeit</h3>
        <p>Hand Drauf ist in der Testphase. Funktionen können sich ändern oder zeitweise nicht verfügbar sein.</p>

        <h3>10. Ende der Nutzung</h3>
        <p>Du kannst dein Konto jederzeit in der App löschen. Wir können die Nutzung mit einer Frist von zwei Wochen beenden, bei schweren Verstößen auch sofort.</p>

        <h3>11. Änderungen</h3>
        <p>Ändern sich diese Bedingungen, informieren wir dich vorher per E-Mail. Änderungen, die dich schlechter stellen, gelten erst, wenn du zustimmst.</p>

        <h3>12. Recht</h3>
        <p>Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Landes, in dem du wohnst, bleiben unberührt.</p>
        ${stand}`
    },

    regeln: {
      titel: 'Regeln für Nachbarn',
      html: `<p class="recht-kurz">Damit Hand Drauf für alle angenehm bleibt, ob 18 oder 80.</p>
        <ol class="regel-liste">
          <li><strong>Ehrlich beschreiben.</strong> Was ist zu tun, wie lange dauert es, was ist schon da?</li>
          <li><strong>Fair bezahlen.</strong> Die Aufwandsentschädigung steht vorher fest und wird nach der Hilfe gezahlt, nicht vorab.</li>
          <li><strong>Zusagen halten.</strong> Wenn etwas dazwischenkommt, sag so früh wie möglich in den Nachrichten ab.</li>
          <li><strong>Freundlich bleiben.</strong> Keine Beleidigungen, kein Druck, keine Anmache.</li>
          <li><strong>Sicherheit geht vor.</strong> Lass niemanden auf wackelige Leitern, an Strom oder Gas. Bei Unsicherheit: lieber eine Fachfirma.</li>
          <li><strong>Privat bleibt privat.</strong> Adresse und Nachrichten nur für den Auftrag nutzen. Keine Bank- oder Passwortdaten teilen.</li>
          <li><strong>Gelegentlich, nicht ständig.</strong> Hand Drauf ist Nachbarschaftshilfe, kein Nebenjob.</li>
          <li><strong>Etwas stimmt nicht?</strong> Nutze „Melden“. Bei Gefahr ruf die Polizei unter 110 an.</li>
        </ol>
        <p>Weitere Einzelheiten stehen in den ${verweis('nutzung', 'Nutzungsbedingungen')}.</p>`
    }
  };
}
