/* Häufige Fragen. Kurz und in Alltagssprache, ohne Fachbegriffe. */
function FRAGEN_TEXTE(c) {
  const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const frage = (titel, antwort) => `<details class="frage"><summary>${titel}</summary><div class="antwort">${antwort}</div></details>`;
  return {
    titel: 'Häufige Fragen',
    gruppen: [
      ['Kosten und Geld', [
        frage('Was kostet Hand Drauf?',
          `<p>In der Testphase nichts. Ihr zahlt nur die Aufwandsentschädigung, die in der Anfrage steht.</p>
           <p>Später ist eine kleine Servicegebühr geplant: ${euro(c.gebuehrAuftraggeber)} für die Person, die Hilfe sucht, und ${Math.round(c.provisionHelfer * 100)} % für die Person, die hilft. Bevor sie kommt, sagen wir dir Bescheid.</p>`),
        frage('Wie wird bezahlt?',
          `<p>Direkt untereinander, nach der Hilfe: bar, per Überweisung oder wie ihr es abmacht. Zahl nie im Voraus, und teile keine Bank- oder Passwortdaten in den Nachrichten.</p>`),
        frage('Wie viel sollte ich geben?',
          `<p>Beim Erstellen schlagen wir dir einen Betrag je Tätigkeit vor. Du entscheidest selbst, zwischen ${c.minBetrag} und ${c.maxBetrag}&nbsp;€. Mehr geht nicht, weil Hand Drauf für kleine Hilfen da ist.</p>`),
        frage('Muss ich das versteuern?',
          `<p>Einnahmen aus gelegentlichen Hilfen bleiben steuerfrei, solange dein Gewinn im Jahr unter 256&nbsp;€ liegt (§&nbsp;22 Nr.&nbsp;3 EStG). Ab 256&nbsp;€ ist der ganze Betrag steuerpflichtig. Unter „Aufträge“ siehst du, wie viel du schon bekommen hast.</p>
           <p>Wer Bürgergeld oder andere Leistungen bekommt, muss Einnahmen dem Amt melden. Das ist keine Steuerberatung.</p>`)
      ]],
      ['Sicherheit', [
        frage('Wer sieht meine Adresse?',
          `<p>Nur die Person, die bei deiner Anfrage zusagt. Auf der Karte erscheint nur ein Punkt ungefähr in deinem Stadtteil, 100 bis 400 Meter neben der echten Lage. Deine E-Mail-Adresse sieht niemand.</p>`),
        frage('Was ist, wenn etwas kaputtgeht?',
          `<p>Dann klärt ihr das untereinander, wie unter Nachbarn sonst auch. Hand Drauf hat keine eigene Versicherung. Ob deine private Haftpflichtversicherung zahlt, hängt vom Vertrag. Viele Tarife decken auch Schäden bei Gefälligkeiten ab. Frag am besten vorher kurz nach.</p>`),
        frage('Was darf man nicht anbieten?',
          `<p>Keine Arbeiten an Strom, Gas oder Wasser, nichts in gefährlicher Höhe, keine Fahrten gegen Geld, keine Pflege und keine Kinderbetreuung ohne die Eltern. Auch keine regelmäßigen Jobs: Hand Drauf ist Nachbarschaftshilfe, kein Nebenjob.</p>`),
        frage('Etwas stimmt nicht. Was kann ich tun?',
          `<p>Unten in jeder Anfrage und jedem Auftrag steht „Melden“. Wir prüfen jede Meldung, und die andere Person erfährt nicht, wer gemeldet hat. Bei Gefahr ruf die Polizei unter 110 an.</p>`),
        frage('Wie blockiere ich jemanden?',
          `<p>Tippe in der Anfrage auf den Namen und dann unten auf „blockieren“. Ihr seht eure Anfragen danach gegenseitig nicht mehr, und laufende Zusagen zwischen euch enden. Die Person erfährt davon nichts. Aufheben kannst du das unter „Konto“.</p>`),
        frage('Was passiert mit beleidigenden Wörtern?',
          `<p>Anfragen und Nachrichten mit beleidigenden oder anstößigen Wörtern werden nicht veröffentlicht. Rutscht trotzdem etwas durch, melde es bitte.</p>`),
        frage('Ab welchem Alter geht das?',
          `<p>Ab 18 Jahren. Das bestätigst du bei der Anmeldung.</p>`)
      ]],
      ['Anfragen', [
        frage('Wie lange ist meine Anfrage sichtbar?',
          `<p>Bis der gewählte Termin vorbei ist, höchstens drei Wochen. Hat bis dahin niemand zugesagt, verschwindet es von der Karte. Unter „Aufträge“ kannst du dann einen neuen Termin wählen.</p>`),
        frage('Kann ich meine Anfrage ändern?',
          `<p>Ja, solange noch niemand zugesagt hat: Anfrage öffnen und „Anfrage bearbeiten“ tippen. Danach sprecht ihr Änderungen in den Nachrichten ab.</p>`),
        frage('Was passiert, wenn jemand absagt?',
          `<p>Dann ist deine Anfrage wieder offen und andere können zusagen. Der alte Nachrichtenverlauf wird gelöscht.</p>`)
      ]],
      ['App und Konto', [
        frage('Gibt es Hand Drauf im App Store?',
          `<p>Noch nicht. Du kannst die Seite aber wie eine App auf den Startbildschirm legen:</p>
           <ul><li><strong>iPhone:</strong> In Safari unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“.</li>
           <li><strong>Android:</strong> In Chrome oben rechts das Menü öffnen, dann „App installieren“ oder „Zum Startbildschirm hinzufügen“.</li></ul>`),
        frage('Wie lösche ich mein Konto?',
          `<p>Oben rechts auf dein Kürzel tippen, dann ganz unten „Konto löschen“. Profil, Anfragen, Adressen, Nachrichten und Bewertungen werden sofort gelöscht.</p>`),
        frage('Wie erreiche ich euch?',
          `<p>${c.betreiber.email ? `Per E-Mail an <a href="mailto:${c.betreiber.email}">${c.betreiber.email}</a>.` : 'Die Kontaktdaten stehen im <a href="#impressum">Impressum</a>.'} Geht es um eine bestimmte Person oder Anfrage, nutze am besten „Melden“ direkt dort.</p>`),
        frage('Wie wird die Schrift größer?',
          `<p>Oben auf „Menü“ tippen. Dort stellst du Schriftgröße, hell oder dunkel und die Startseite ein.</p>`)
      ]]
    ]
  };
}
