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
          `<p>Beim Erstellen siehst du, wie viel Nachbarn auf Hand Drauf für dieselbe Tätigkeit geben. Solange es dafür noch zu wenige Anfragen gibt, steht dort unser Vorschlag. Du entscheidest selbst, zwischen ${c.minBetrag} und ${c.maxBetrag}&nbsp;€. Mehr geht nicht, weil Hand Drauf für kleine Hilfen da ist.</p>`),
        frage('Muss ich das versteuern?',
          `<p>Einnahmen aus gelegentlichen Hilfen bleiben steuerfrei, solange dein Gewinn im Jahr unter 256&nbsp;€ liegt (§&nbsp;22 Nr.&nbsp;3 EStG). Ab 256&nbsp;€ ist der ganze Betrag steuerpflichtig. Unter „Aufträge“ siehst du, wie viel du schon bekommen hast.</p>
           <p>Wer Bürgergeld oder andere Leistungen bekommt, muss Einnahmen dem Amt melden. Das ist keine Steuerberatung.</p>`)
      ]],
      ['Sicherheit', [
        frage('Wer sieht meine Adresse?',
          `<p>Nur die Person, die bei deiner Anfrage zusagt. Auf der Karte erscheint nur ein ungefährer Punkt, auf etwa einen Kilometer genau. Andere sehen nur den Namen deines Orts. Deine E-Mail-Adresse sieht niemand.</p>`),
        frage('Wozu ist der Sicherheits-Code?',
          `<p>Sobald jemand zusagt, zeigt die App euch beiden denselben Code aus vier Ziffern. Wer hilft, nennt ihn an der Tür. So weißt du, dass die richtige Person vor dir steht. Stimmt der Code nicht, lass niemanden herein.</p>`),
        frage('Woran erkenne ich Betrug?',
          `<p>Bezahlt wird erst nach der Hilfe. Wer Geld im Voraus will, Gutscheinkarten verlangt, nach einer TAN oder einem Code fragt oder dir Links schickt, meint es nicht ehrlich. Antworte nicht darauf und nutze „Melden“.</p>`),
        frage('Kann ich jemandem Bescheid sagen, wo ich bin?',
          `<p>Ja. In einem zugesagten Auftrag steht „Bescheid sagen“. Damit schickst du einer Person, der du vertraust, in einer Nachricht, wann und wo du hilfst oder wer zu dir kommt.</p>`),
        frage('Was ist, wenn etwas kaputtgeht?',
          `<p>Dann klärt ihr das untereinander, wie unter Nachbarn sonst auch. Hand Drauf hat keine eigene Versicherung. Ob deine private Haftpflichtversicherung zahlt, hängt vom Vertrag. Viele Tarife decken auch Schäden bei Gefälligkeiten ab. Frag am besten vorher kurz nach.</p>`),
        frage('Was darf man nicht anbieten?',
          `<p>Keine Arbeiten an Strom, Gas oder Wasser, nichts in gefährlicher Höhe, keine Fahrten gegen Geld, keine Pflege und keine Kinderbetreuung ohne die Eltern. Auch keine regelmäßigen Jobs: Hand Drauf ist Nachbarschaftshilfe, kein Nebenjob.</p>`),
        frage('Etwas stimmt nicht. Was kann ich tun?',
          `<p>Unten in jeder Anfrage und jedem Auftrag steht „Melden“. Wir prüfen jede Meldung, und die andere Person erfährt nicht, wer gemeldet hat. Bei Gefahr ruf die Polizei unter 110 an.</p>`),
        frage('Wie funktionieren Bewertungen?',
          `<p>Nach jedem Auftrag bewertet ihr euch gegenseitig mit Sternen und, wenn ihr wollt, ein paar Sätzen. Beide Bewertungen erscheinen gleichzeitig: sobald ihr beide bewertet habt, spätestens 14 Tage nach der ersten. Bis dahin kannst du deine noch ändern. So kann niemand aus Ärger „zurückbewerten“.</p><p>Tippe in einer Anfrage auf den Namen, dann siehst du das Profil mit allen Bewertungen. Dein eigenes Profil findest du im Menü. Stimmt mit einer Bewertung etwas nicht, tippe darunter auf „Melden“.</p>`),
        frage('Wie blockiere ich jemanden?',
          `<p>Tippe in der Anfrage auf den Namen und dann unten auf „blockieren“. Ihr seht eure Anfragen danach gegenseitig nicht mehr, und laufende Zusagen zwischen euch enden. Die Person erfährt davon nichts. Aufheben kannst du das unter „Konto“.</p>`),
        frage('Was passiert mit beleidigenden Wörtern?',
          `<p>Anfragen, Nachrichten und Bewertungen mit beleidigenden oder anstößigen Wörtern werden nicht veröffentlicht. Rutscht trotzdem etwas durch, melde es bitte.</p>`),
        frage('Ab welchem Alter geht das?',
          `<p>Ab 18 Jahren. Das bestätigst du bei der Anmeldung.</p>`)
      ]],
      ['Anfragen', [
        frage('Gibt es Hand Drauf auch in meinem Ort?',
          `<p>Ja, in ganz Deutschland. Tippe oben auf den Ort und such deinen Stadtteil, deine Stadt oder deine Postleitzahl. Mit „bis … km“ stellst du ein, wie weit die Anfragen entfernt sein dürfen.</p>
           <p>An vielen Orten sind noch wenige Nachbarn dabei. Am schnellsten ändert sich das, wenn du welche einlädst.</p>`),
        frage('Wie lange ist meine Anfrage sichtbar?',
          `<p>Bis der letzte gewählte Tag vorbei ist. Termine kannst du bis zu zwei Monate im Voraus wählen. Hat bis dahin niemand zugesagt, verschwindet es von der Karte. Unter „Aufträge“ kannst du dann einen neuen Termin wählen.</p>`),
        frage('Kann ich für meine Eltern oder Großeltern anfragen?',
          `<p>Ja. Wähle beim Erstellen „Für jemand anderen“ und schreib dazu, für wen die Hilfe ist. Gib die Adresse an, an der geholfen wird, und am besten eine Telefonnummer. Den Sicherheits-Code gibst du an die Person weiter. Sie sollte mit allem einverstanden sein.</p>`),
        frage('Muss ich schreiben, oder kann ich auch anrufen?',
          `<p>Wer eine Telefonnummer angibt, kann nach der Zusage angerufen werden. Die Nummer sieht nur, wer zugesagt hat. Ohne Nummer sprecht ihr euch in den Nachrichten ab, dort gibt es auch fertige Sätze zum Antippen.</p>`),
        frage('Kann ich eine Anfrage wiederholen?',
          `<p>Ja. Öffne eine abgeschlossene Anfrage unter „Aufträge“ und tippe auf „Noch mal anfragen“. Du wählst nur noch den Termin. Wer dir schon geholfen hat, erfährt als Erstes davon.</p>`),
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
        frage('Wie bekomme ich Bescheid, wenn jemand zusagt?',
          `<p>Schalte im Menü „Bescheid aufs Handy“ ein. Dann meldet sich dein Handy, wenn jemand zusagt, dir schreibt oder ein Auftrag fertig ist, und am Abend vor dem Termin. Auf dem iPhone geht das, sobald Hand Drauf auf dem Home-Bildschirm liegt.</p>
           <p>Wenn du helfen möchtest: Schalte „Neue Anfragen“ ein und wähle, wobei du gern hilfst, zum Beispiel nur Garten und Tragen.</p>`),
        frage('Kann ich mir Anfragen vorlesen lassen?',
          `<p>Ja. In jeder Anfrage steht „Vorlesen“. Dein Gerät liest dann Titel, Termin, Ort, Betrag und Beschreibung vor.</p>`),
        frage('Wie lade ich Nachbarn ein?',
          `<p>Im Menü unter „Nachbarn einladen“ findest du einen QR-Code, einen Link zum Verschicken und einen Aushang zum Ausdrucken, mit Zetteln zum Abreißen.</p>`),
        frage('Wie lösche ich mein Konto?',
          `<p>Oben rechts auf dein Kürzel tippen, dann ganz unten „Konto löschen“. Profil, Anfragen, Adressen, Nachrichten und Bewertungen werden sofort gelöscht.</p>`),
        frage('Wie erreiche ich euch?',
          `<p>${c.betreiber.email ? `Per E-Mail an <a href="mailto:${c.betreiber.email}">${c.betreiber.email}</a>.` : 'Die Kontaktdaten stehen im <a href="#impressum">Impressum</a>.'} Geht es um eine bestimmte Person oder Anfrage, nutze am besten „Melden“ direkt dort.</p>`),
        frage('Wie wird die Schrift größer?',
          `<p>Oben auf „Menü“ tippen. Dort stellst du Schriftgröße, hell oder dunkel und die Startseite ein. Stellt dein Gerät mehr Kontrast ein, übernimmt die App das von selbst.</p>`)
      ]]
    ]
  };
}
