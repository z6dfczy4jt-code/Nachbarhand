/* Rechtstexte von Hand Drauf: Impressum, Datenschutz, Nutzungsbedingungen, Regeln.
   Fassung für die Testphase (Weg 1: ohne Bezahlung über die App). Vor dem öffentlichen Start
   von einer Anwältin oder einem Anwalt für IT-Recht prüfen lassen.
   b = Betreiberdaten, h = Hosting (beides aus einstellungen.json), e = HTML-Escape-Funktion. */
const RECHT_STAND = 'November 2026';
function RECHT_TEXTE(b, h, e) {
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
        <p>Anfragen und Nachrichten schreiben die Nutzer selbst. Wir prüfen sie nicht vorab, entfernen aber rechtswidrige Inhalte, sobald wir davon erfahren. Hinweise nehmen wir über „Melden“ in der App oder per E-Mail entgegen.</p>
        ${stand}`
    },

    datenschutz: {
      titel: 'Datenschutzerklärung',
      html: `${offen}
        <p class="recht-kurz">Kurz gesagt: Wir speichern nur, was für die Vermittlung nötig ist. Keine Werbung, kein Tracking, keine Weitergabe zu Werbezwecken.</p>

        <h3>1. Wer ist verantwortlich?</h3>
        <p>${name}<br>${anschrift}<br>E-Mail: ${mail}</p>

        <h3>2. Wenn du die App aufrufst</h3>
        ${h && h.art === 'server' ? `<p>Die App liegt auf einem Server, den wir bei ${h.anbieter ? e(h.anbieter) : '<span class="platzhalter">[Anbieter mit Anschrift]</span>'} gemietet haben${h.standort ? ` (Standort: ${e(h.standort)})` : ''}. Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Beim Aufruf verarbeitet der Server technisch notwendige Daten wie deine IP-Adresse, Zeitpunkt, Browser und Betriebssystem, um die Seite auszuliefern. Zugriffe protokolliert der Server nicht. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren, erreichbaren App (Art. 6 Abs. 1 lit. f DSGVO).</p>`
          : '<p>Die App liegt bei GitHub Pages, einem Dienst von GitHub (GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Niederlande, und GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA). Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie deine IP-Adresse, Zeitpunkt, Browser und Betriebssystem, um die Seite auszuliefern und vor Angriffen zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren, erreichbaren App (Art. 6 Abs. 1 lit. f DSGVO). Für Übermittlungen in die USA stützt sich GitHub auf das EU-US Data Privacy Framework und auf EU-Standardvertragsklauseln.</p>'}
        <p>Schriften und Bilder liefern wir selbst aus. Dafür werden keine Daten an Google oder andere Anbieter übertragen.</p>
        <p>Tritt in der App ein technischer Fehler auf, schickt sie eine kurze Meldung an unsere Datenbank: den Fehlertext, die Stelle im Programm, Browser und Gerätetyp sowie die Fassung der App. Namen, Inhalte und deine IP-Adresse speichern wir dabei nicht. Gleiche Meldungen werden nur gezählt, nach 30 Tagen löschen wir sie. So finden wir Fehler, die nur auf bestimmten Geräten auftreten. Rechtsgrundlage ist unser berechtigtes Interesse an einer funktionierenden App (Art. 6 Abs. 1 lit. f DSGVO).</p>
        ${h && h.supabaseCdn ? '<p>Die Programmbibliothek für die Verbindung zur Datenbank (supabase-js) lädt dein Gerät beim ersten Anmelden vom Dienst jsDelivr (www.jsdelivr.com). Dabei wird deine IP-Adresse an dessen Server übertragen. Rechtsgrundlage ist unser berechtigtes Interesse an einer funktionierenden App (Art. 6 Abs. 1 lit. f DSGVO).</p>' : ''}

        <h3>3. Karte</h3>
        <p>Die Kartenbilder (Straßen, Namen, Parks) auf der Startseite und auf der Karte lädt dein Gerät von basemap.de, der amtlichen Webkarte von Bund und Ländern. Die Server betreibt das Bundesamt für Kartographie und Geodäsie (BKG), Richard-Strauss-Allee 11, 60598 Frankfurt am Main. Dabei werden deine IP-Adresse und der gezeigte Kartenausschnitt übertragen. Sind diese Server nicht erreichbar, lädt die App die Kartenbilder von OpenStreetMap (OpenStreetMap Foundation, Großbritannien; für Großbritannien gilt ein Angemessenheitsbeschluss der EU-Kommission) oder von openstreetmap.de (FOSSGIS e.V., Deutschland). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO: Ohne Karte kann die App nicht zeigen, wo Hilfe gesucht wird.</p>
        <p><strong>Luftbild:</strong> Ist im Menü „Luftbild“ gewählt (Standard), lädt dein Gerät in Niedersachsen zusätzlich Luftbilder vom Landesamt für Geoinformation und Landesvermessung Niedersachsen (LGLN) in Hannover. Auch dabei werden deine IP-Adresse und der gezeigte Kartenausschnitt übertragen.${h && h.esri ? ' Außerhalb Niedersachsens kommen die Luftbilder vom Dienst World Imagery der Esri Inc. (Redlands, USA). Dabei werden deine IP-Adresse und der Kartenausschnitt in die USA übertragen.' : ''} Mit „Straßenkarte“ im Menü oder auf der Karte schaltest du das ab; dann lädt nur noch der Knopf zum Umschalten ein kleines Vorschaubild. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO: Auf dem Luftbild erkennt man die eigene Straße leichter.</p>
        <p>Kartenbilder: © GeoBasis-DE / BKG, CC BY 4.0, bzw. © OpenStreetMap-Mitwirkende, ODbL. Luftbilder: © LGLN, CC BY 4.0${h && h.esri ? ', bzw. Esri, Maxar, Earthstar Geographics' : ''}. Sind keine Kartenbilder erreichbar, zeigt die App nur die Anfragen, in Garbsen dazu die Stadtteile vereinfacht (Lage nach Daten von OpenStreetMap und GeoNames, CC BY 4.0).</p>
        <p><strong>Ortssuche:</strong> Wenn du einen Ort oder eine Adresse eintippst, ${!h || !h.geocoder ? 'sucht die App in einer eingebauten Liste, ohne etwas zu übertragen.' : /komoot\.io/.test(h.geocoder) ? 'schickt dein Gerät den eingetippten Text an den Suchdienst Photon (komoot GmbH, Berlin), der Vorschläge aus den Daten von OpenStreetMap liefert. Dabei wird auch deine IP-Adresse übertragen.' : 'schickt dein Gerät den eingetippten Text an unseren eigenen Suchdienst (Photon, Daten von OpenStreetMap). Er speichert die Anfragen nicht.'} Hand Drauf speichert nur den gewählten Ortsnamen und die Mitte eines Rasterfelds von etwa einem Kilometer, nie die genaue Lage deiner Adresse. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Nutzung der App) und unser berechtigtes Interesse an einer einfachen Ortsauswahl (Art. 6 Abs. 1 lit. f DSGVO).</p>
        <p>Anfragen erscheinen auf der Karte nur ungefähr: als Punkt 100 bis 400 Meter um die Mitte eines Rasterfelds von etwa einem Kilometer, in dem die Adresse liegt, oder, weiter herausgezoomt, als Zahl.</p>
        <p>Deinen eigenen Standort fragt die App nicht ab. Sie rechnet Entfernungen von deinem gewählten Ort aus. Ist er im Konto gespeichert, nutzt die Datenbank ihn auch, um dir auf Wunsch neue Anfragen in deinem Umkreis zu melden; andere sehen davon nur den Namen des Orts.</p>

        <h3>4. Speicher auf deinem Gerät</h3>
        <p>Die App speichert im Browser deines Geräts (localStorage): deine Ansicht-Einstellungen, welche Nachrichten du gelesen hast, ob Benachrichtigungen auf diesem Gerät eingeschaltet sind, die Beispieldaten der Demo und, wenn du angemeldet bist, deine Anmeldung. Diese Daten bleiben auf deinem Gerät. Sie sind für die Funktionen nötig, die du nutzt (§ 25 Abs. 2 Nr. 2 TDDDG). Cookies für Werbung oder Statistik setzen wir nicht.</p>
        <p>„Vorlesen“ nutzt die Sprachausgabe deines Geräts. Die App wählt dafür eine Stimme, die auf dem Gerät selbst liegt, wenn es eine gibt.</p>

        <h3>5. Wenn du ein Konto hast</h3>
        <p>Für Konten, Anfragen und Nachrichten nutzen wir Supabase (Supabase Pte. Ltd., Singapur). Die Datenbank liegt in einem Rechenzentrum in Frankfurt am Main. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Soweit Supabase für Betrieb und Support aus Ländern außerhalb der EU zugreift, gelten EU-Standardvertragsklauseln.</p>
        <p>Gespeichert werden:</p>
        <ul>
          <li>E-Mail-Adresse und Passwort (nur verschlüsselt als Prüfwert)</li>
          <li>Vorname, Anfangsbuchstabe des Nachnamens, Ort (Name sowie Mitte eines Rasterfelds von etwa 1 km) und deine Bestätigung, dass du mindestens 18 bist</li>
          <li>deine Anfragen, die Adresse zu einer Anfrage, deine Zusagen und Bewertungen</li>
          <li>wenn du sie angibst: eine Telefonnummer zur Anfrage und für wen die Hilfe ist</li>
          <li>den Sicherheits-Code eines laufenden Auftrags</li>
          <li>Nachrichten zu einem Auftrag und Meldungen, die du abschickst</li>
          <li>wenn du Benachrichtigungen einschaltest: die Adresse, unter der dein Gerät dafür erreichbar ist (siehe 7.)</li>
          <li>wenn du dein Profil gestaltest: dein Profilbild, dein Text „Über mich“, wobei du gern hilfst, welche Sprachen du sprichst und wann du meist Zeit hast. Das alles ist freiwillig.</li>
        </ul>
        <p>Dein Profilbild verkleinert die App schon auf deinem Gerät auf 400 × 400 Bildpunkte. Dabei fallen Angaben weg, die in Fotos stecken können, etwa Aufnahmeort, Datum und Kameramodell. Das Bild liegt im Speicher von Supabase, ebenfalls in Frankfurt am Main. Ersetzt oder entfernst du es, löschen wir das alte Bild.</p>
        <p>Fragst du für jemand anderen an, zum Beispiel für deine Eltern, speichern wir auch deine Angaben zu dieser Person (Name oder Bezeichnung, Adresse, Telefonnummer). Bitte hol vorher ihr Einverständnis ein.</p>
        <p>Rechtsgrundlage ist der Nutzungsvertrag mit dir (Art. 6 Abs. 1 lit. b DSGVO). Meldungen verarbeiten wir außerdem, um rechtswidrige Inhalte zu entfernen und Nutzer zu schützen (Art. 6 Abs. 1 lit. c und f DSGVO). Die Bestätigungs-E-Mail bei der Registrierung verschickt Supabase für uns.</p>
        <p>Die Programmbibliothek für die Anmeldung lädt die App vom Dienst jsDelivr. Dabei wird deine IP-Adresse an dessen Server übertragen (Art. 6 Abs. 1 lit. f DSGVO).</p>

        <h3>6. Wer sieht was?</h3>
        <ul>
          <li><strong>Alle, auch ohne Konto:</strong> offene Anfragen mit Vorname, Anfangsbuchstabe, Ort, ungefährer Lage (100 bis 400 Meter um die Mitte eines Rasterfelds von etwa 1 km), Bewertungsschnitt und, wenn angegeben, für wen die Hilfe ist.</li>
          <li><strong>Alle, auch ohne Konto, im Profil:</strong> Vorname, Anfangsbuchstabe, Ort, seit wann du dabei bist, wie oft du geholfen und Hilfe bekommen hast, und die Bewertungen über dich: Sterne, Text, Monat, Tätigkeit des Auftrags und Vorname mit Anfangsbuchstabe der Person, die bewertet hat. Hast du ein Profilbild oder Angaben wie „Über mich“ eingetragen, sehen alle auch diese. Bewertungen erscheinen erst, wenn beide bewertet haben, spätestens 14 Tage nach der ersten. Bis dahin sieht sie niemand außer der Person, die sie geschrieben hat.</li>
          <li><strong>Nur die Person, die zusagt:</strong> die genaue Adresse und die Telefonnummer.</li>
          <li><strong>Nur ihr beide:</strong> eure Nachrichten und der Sicherheits-Code für die Tür.</li>
          <li><strong>Nur wir:</strong> Meldungen. Die gemeldete Person erfährt nicht, wer gemeldet hat.</li>
        </ul>

        <h3>7. Benachrichtigungen aufs Handy</h3>
        <p>Benachrichtigungen bekommst du nur, wenn du sie im Menü oder in einem Auftrag einschaltest. Dein Gerät meldet sich dann beim Benachrichtigungsdienst seines Browsers an: bei Google (Chrome, Android), Apple (Safari, iPhone), Mozilla (Firefox) oder Microsoft (Edge). Dieser Dienst vergibt eine Adresse für dein Gerät. Wir speichern diese Adresse und zwei Schlüssel bei Supabase.</p>
        <p>Sagt jemand zu, schreibt dir oder ist ein Auftrag fertig, schicken wir über diesen Dienst eine kurze Mitteilung an dein Gerät, zum Beispiel „Tim hilft dir“ mit Titel und Termin der Anfrage. Außerdem erinnern wir am Abend vor dem Termin und am Tag danach, falls der Auftrag noch nicht abgeschlossen ist. Hast du „Neue Anfragen“ eingeschaltet, speichern wir auch, bei welchen Tätigkeiten du gern hilfst. Sie ist so verschlüsselt, dass nur dein Gerät sie lesen kann. Was in euren Nachrichten steht, ist nicht Teil der Mitteilung. Die Dienste sitzen zum Teil in den USA.</p>
        <p>Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Du kannst sie jederzeit widerrufen: Schalte die Benachrichtigungen im Menü aus. Dann löschen wir die Adresse deines Geräts. Beim Abmelden lösen wir das Gerät von deinem Konto.</p>

        <h3>8. Wie lange?</h3>
        <p>Dein Konto und deine Daten speichern wir, bis du das Konto löschst. Das geht jederzeit in der App unter „Dein Konto“. Dann löschen wir dein Profil mit Profilbild, deine Anfragen, Adressen, Telefonnummern, Nachrichten, Bewertungen und die Adressen deiner Geräte für Benachrichtigungen. Meldungen bewahren wir höchstens zwölf Monate nach ihrer Bearbeitung auf, um wiederholte Verstöße erkennen zu können.</p>

        <h3>9. Deine Rechte</h3>
        <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit (Art. 15 bis 20 DSGVO). Verarbeitungen auf Grundlage unseres berechtigten Interesses kannst du widersprechen (Art. 21 DSGVO). Schreib uns dafür an ${mail}.</p>
        <p>Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren. In Niedersachsen ist das die Landesbeauftragte für den Datenschutz Niedersachsen, Prinzenstraße 5, 30159 Hannover.</p>

        <h3>10. Keine Werbung, kein Profiling</h3>
        <p>Wir verkaufen keine Daten, zeigen keine Werbung und treffen keine automatisierten Entscheidungen über dich.</p>
        ${stand}`
    },

    nutzung: {
      titel: 'Nutzungsbedingungen',
      html: `${offen}
        <p class="recht-kurz">Fassung für die Testphase. In dieser Phase ist Hand Drauf kostenlos und vermittelt nur.</p>

        <h3>1. Was Hand Drauf ist</h3>
        <p>Hand Drauf ist eine Plattform, auf der sich Nachbarn bei kleinen Dingen helfen: Wer Hilfe braucht, stellt eine Anfrage, wer helfen möchte, sagt zu. Betreiber ist ${name} (siehe ${verweis('impressum', 'Impressum')}).</p>
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
          <li>höchstens 50 € pro Anfrage,</li>
          <li>höchstens 5 laufende Anfragen pro Person,</li>
          <li>höchstens 8 Zusagen in 30 Tagen und höchstens 2 für dieselbe Person,</li>
          <li>keine Daueraufträge und keine Leistungen, für die man ein Gewerbe oder eine Ausbildung braucht.</li>
        </ul>
        <p>Nicht erlaubt sind insbesondere: Arbeiten an Strom-, Gas- oder Wasserleitungen, Arbeiten in gefährlicher Höhe, Fahrten gegen Bezahlung, Pflege und medizinische Hilfe, die Betreuung von Kindern ohne Anwesenheit der Eltern sowie alles, was gegen Gesetze verstößt.</p>

        <h3>5. Steuern und Sozialleistungen</h3>
        <p>Für Steuern und Meldepflichten ist jede Person selbst verantwortlich. Einkünfte aus gelegentlichen Leistungen bleiben bis unter 256 € Gewinn im Jahr steuerfrei (§ 22 Nr. 3 EStG). Wer Bürgergeld oder andere Leistungen bezieht, muss Einnahmen dem Jobcenter oder Amt melden.</p>

        <h3>6. Umgang miteinander</h3>
        <ul>
          <li>Bleib freundlich und ehrlich, in Anfragen wie in Nachrichten. Halte dich an die ${verweis('regeln', 'Regeln für Nachbarn')}.</li>
          <li>Adresse und Telefonnummer, die du nach einer Zusage siehst, darfst du nur für diesen Auftrag nutzen. Zu deiner Sicherheit darfst du einer Vertrauensperson sagen, wo und wann du hilfst.</li>
          <li>Fragst du für jemand anderen an, zum Beispiel für deine Eltern, muss diese Person einverstanden sein. Das gilt auch dafür, dass die helfende Person ihre Adresse und Telefonnummer sieht.</li>
          <li>Bezahlt wird nach der Hilfe. Niemand darf Geld im Voraus, Gutscheinkarten oder Codes verlangen. Der Sicherheits-Code aus der App ist nur für die Begrüßung an der Tür gedacht.</li>
          <li>Keine Werbung, keine Weitergabe von Daten anderer.</li>
          <li>Bewerte ehrlich und sachlich, was beim Auftrag passiert ist. Keine Beleidigungen, keine Adressen, Telefonnummern oder Angaben zur Gesundheit, keine Bewertungen gegen Geld oder unter Druck. Beide Bewertungen eines Auftrags erscheinen gleichzeitig: wenn beide bewertet haben, spätestens 14 Tage nach der ersten. Danach lassen sie sich nicht mehr ändern.</li>
          <li>Profilbild und „Über mich“ sind für alle sichtbar. Zeig auf dem Bild nur dich selbst: keine anderen Personen, keine Kinder, nichts Anstößiges. Gib dich nicht als jemand anderes aus. Schreib keine Adresse, Telefonnummer oder E-Mail ins Profil.</li>
        </ul>

        <h3>7. Melden und Sperren</h3>
        <p>Über „Melden“ kannst du Anfragen, beteiligte Personen, Profile und Bewertungen melden. Wir prüfen jede Meldung. Verstößt etwas gegen Gesetze oder diese Bedingungen, können wir Inhalte entfernen und Konten vorübergehend oder dauerhaft sperren. Wir sagen dir, was wir entschieden haben und warum. Bist du anderer Meinung, schreib uns an ${mail}.</p>

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
          <li><strong>Fair bezahlen.</strong> Die Aufwandsentschädigung steht vorher fest und wird nach der Hilfe gezahlt, nicht vorab. Keine Gutscheinkarten, keine Codes.</li>
          <li><strong>Zusagen halten.</strong> Wenn etwas dazwischenkommt, sag so früh wie möglich in den Nachrichten ab.</li>
          <li><strong>Fair bewerten.</strong> Schreib, was beim Auftrag passiert ist, sachlich und ohne private Angaben.</li>
          <li><strong>Freundlich bleiben.</strong> Keine Beleidigungen, kein Druck, keine Anmache.</li>
          <li><strong>Echtes Profil.</strong> Auf dein Profilbild gehörst nur du, keine anderen Personen und keine Kinder. Adresse und Telefonnummer gehören nicht ins Profil.</li>
          <li><strong>Sicherheit geht vor.</strong> Frag an der Tür nach dem Sicherheits-Code aus der App. Lass niemanden auf wackelige Leitern, an Strom oder Gas. Bei Unsicherheit: lieber eine Fachfirma.</li>
          <li><strong>Privat bleibt privat.</strong> Adresse, Telefonnummer und Nachrichten nur für den Auftrag nutzen. Keine Bank- oder Passwortdaten teilen.</li>
          <li><strong>Gelegentlich, nicht ständig.</strong> Hand Drauf ist Nachbarschaftshilfe, kein Nebenjob.</li>
          <li><strong>Etwas stimmt nicht?</strong> Nutze „Melden“. Bei Gefahr ruf die Polizei unter 110 an.</li>
        </ol>
        <p>Weitere Einzelheiten stehen in den ${verweis('nutzung', 'Nutzungsbedingungen')}.</p>`
    }
  };
}
