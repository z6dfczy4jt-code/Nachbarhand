(() => {
  'use strict';

  /* ===== Betriebsart ===== */
  // Wird beim Bauen für die Claude-Vorschau auf true gesetzt: Dort ist keine Datenbank erreichbar, also immer Demo.
  const VORSCHAU = false;
  // Läuft die App als iPhone-App (Capacitor)? Dann liegt sie lokal auf dem Gerät, Links zeigen auf die Website.
  const NATIV = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  // Alle Angaben für den Betrieb stehen in einstellungen.json; der Build setzt sie hier als EINSTELLUNGEN ein.
  const OEFFENTLICH = EINSTELLUNGEN.adresse;
  const PLUGINS = {};
  function plugin(name) { // native Erweiterungen (@capacitor/share, @capacitor/filesystem), nur in der iPhone-App
    if (!NATIV) return null;
    if (!PLUGINS[name]) {
      const C = window.Capacitor;
      PLUGINS[name] = (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null);
    }
    return PLUGINS[name];
  }
  // ?beispiele in der Adresse: erfundene Beispiele zeigen, auch wenn die Datenbank erreichbar ist
  const BEISPIEL_MODUS = (() => { try { return new URLSearchParams(location.search).has('beispiele'); } catch (e) { return false; } })();

  // Zugang zur Datenbank (Supabase). Beide Werte sind öffentlich und dürfen im Code stehen.
  // Leer = Demo-Modus mit erfundenen Beispieldaten.
  // Supabase-Projekt „hand-drauf“ (Frankfurt). Beide Werte sind öffentlich; die Zugriffsregeln in der Datenbank schützen die Daten.
  // Niemals den Secret- oder service_role-Key hier eintragen.
  const LIVE = { url: EINSTELLUNGEN.supabase.url, key: EINSTELLUNGEN.supabase.key };
  // supabase-js: vom eigenen Server, wenn die Datei in assets/vendor liegt (siehe SERVER.md), sonst vom CDN
  const SUPABASE_JS = EINSTELLUNGEN.supabaseJs;

  /* ===== Einstellungen: Gebühren, Regeln und Karte hier anpassen ===== */
  const CONFIG = {
    gebuehren: !!EINSTELLUNGEN.gebuehren, // Weg 2 (Bezahlung über die App mit Gebühren). Erst einschalten, wenn Stripe eingerichtet ist
    gebuehrAuftraggeber: 0.99, // Weg 2: fester Betrag, den die suchende Person zusätzlich zahlt
    provisionHelfer: 0.05,     // Weg 2: Anteil, der vom Betrag des Helfers abgeht
    minBetrag: 5,
    maxBetrag: 50,             // Obergrenze für Nachbarschaftshilfe
    freigrenze: 255,           // § 22 Nr. 3 EStG: unter 256 € Gewinn im Jahr steuerfrei
    bereichMeter: 250,         // Radius des ungefähren Bereichs um eine Anfrage
    // Karte: die App zeichnet sie selbst (Daten über „beschriftung“, siehe unten); Ersatz: basemap.de (Bund und Länder).
    // Optional mit kostenlosem Schlüssel von carto.com (siehe SETUP.md) der Stil „Voyager“. Der Schlüssel ist öffentlich.
    // Luftbild: in Niedersachsen ohne Schlüssel vom LGLN. Mit esri (kostenloser Schlüssel der ArcGIS Location Platform,
    // siehe SETUP.md) Luftbilder für ganz Deutschland. Auch dieser Schlüssel ist öffentlich.
    // Kartendaten für die eigene Karte und die Namen auf dem Luftbild: Vektordaten von OpenStreetMap (OpenFreeMap,
    // ohne Schlüssel). Leer = fertige Kartenbilder von basemap.de, ohne Namen auf dem Luftbild.
    karte: { carto: EINSTELLUNGEN.karte.carto || '', esri: EINSTELLUNGEN.karte.esri || '', beschriftung: EINSTELLUNGEN.karte.beschriftung || '' },
    // Anmelden mit einem Code per E-Mail statt mit Passwort. Erst einschalten, wenn der E-Mail-Versand
    // eingerichtet ist und die E-Mail-Vorlage den Code enthält (siehe SETUP.md).
    codeLogin: !!EINSTELLUNGEN.codeLogin,
    // Öffentlicher Schlüssel für Benachrichtigungen aufs Handy (Web Push). Der private Schlüssel liegt
    // nur in der Datenbank. Leer = Benachrichtigungen aus.
    push: EINSTELLUNGEN.push || '',
    ich: { name: 'Tim', initialen: 'TS', stadtteil: 'Garbsen-Mitte', lat: 52.4248, lng: 9.5962 }, // Demo-Person
    // Betreiber für Impressum und Datenschutz. Vor dem öffentlichen Start ausfüllen.
    betreiber: EINSTELLUNGEN.betreiber,
    hosting: EINSTELLUNGEN.hosting
  };



  // Stadtteile von Garbsen. Mittelpunkte aus OpenStreetMap-Haltestellen und GeoNames, auf ca. 100 m genau.
  // Dieselbe Liste steht in supabase/schema.sql.
  const STADTTEILE = [
    { name: 'Garbsen-Mitte', lat: 52.4262, lng: 9.6015, r: 480 },
    { name: 'Berenbostel', lat: 52.4352, lng: 9.6098, r: 480 },
    { name: 'Havelse', lat: 52.4108, lng: 9.6125, r: 450 },
    { name: 'Stelingen', lat: 52.4510, lng: 9.6240, r: 550 },
    { name: 'Horst', lat: 52.4418, lng: 9.5370, r: 550 },
    { name: 'Frielingen', lat: 52.4612, lng: 9.5357, r: 500 },
    { name: 'Meyenfeld', lat: 52.4420, lng: 9.5703, r: 500 },
    { name: 'Osterwald O.E.', lat: 52.4620, lng: 9.5930, r: 500 },
    { name: 'Heitlingen', lat: 52.4679, lng: 9.6170, r: 400 },
    { name: 'Osterwald U.E.', lat: 52.4615, lng: 9.5532, r: 450 },
    { name: 'Schloß Ricklingen', lat: 52.4298, lng: 9.5088, r: 450 },
    { name: 'Altgarbsen', lat: 52.4188, lng: 9.5815, r: 420 },
    { name: 'Auf der Horst', lat: 52.4166, lng: 9.5975, r: 420 }
  ];

  const KATEGORIEN = [
    { id: 'garten', name: 'Garten' },
    { id: 'einkaufen', name: 'Einkaufen' },
    { id: 'tiere', name: 'Tiere' },
    { id: 'haushalt', name: 'Haushalt' },
    { id: 'tragen', name: 'Tragen' },
    { id: 'technik', name: 'Technik' }
  ];

  /* ===== Beispieldaten für den Demo-Modus: erfundene Personen, echte Stadtteile ===== */
  const BEISPIELE = [
    { id: 'g1', kat: 'garten', titel: 'Rasen ein letztes Mal mähen', wer: 'Karin M.', initialen: 'KM', sterne: 4.9, bewertungen: 14, betrag: 15,
      stadtteil: 'Berenbostel', lat: 52.4344, lng: 9.6106, wann: 'Samstag, vormittags', dauer: 'ca. 1 Std.',
      text: 'Rasen hinterm Haus, etwa 80 m². Mäher und Fangkorb stehen im Schuppen. Den Schnitt bitte auf den Kompost.',
      adresse: 'Weberstraße, Berenbostel', antwort: 'Wie schön, danke! Der Schlüssel für den Schuppen hängt neben der Haustür.', status: 'offen', erstellt: 13 },
    { id: 'g2', kat: 'garten', titel: 'Laub rechen im Vorgarten', wer: 'Herbert K.', initialen: 'HK', sterne: 4.7, bewertungen: 9, betrag: 20,
      stadtteil: 'Altgarbsen', lat: 52.4192, lng: 9.5820, wann: 'Morgen, nachmittags', dauer: 'ca. 2 Std.',
      text: 'Zwei große Ahornbäume. Das Laub liegt im Vorgarten und auf dem Gehweg. Laubsäcke und Rechen sind da.',
      adresse: 'Ortskern Altgarbsen', antwort: 'Prima, ich stelle Ihnen Kaffee hin.', status: 'offen', erstellt: 12 },
    { id: 'g3', kat: 'einkaufen', titel: 'Getränkekisten hochtragen', wer: 'Aylin Ö.', initialen: 'AÖ', sterne: 5.0, bewertungen: 6, betrag: 8,
      stadtteil: 'Garbsen-Mitte', lat: 52.4266, lng: 9.6036, wann: 'Freitag, ab 17 Uhr', dauer: 'ca. 30 Min.',
      text: 'Zwei Kisten Wasser vom Supermarkt in den 3. Stock. Es gibt keinen Aufzug.',
      adresse: 'Märchenstraße, Garbsen-Mitte', antwort: 'Danke dir! Klingel bei Öztürk, 3. Stock links.', status: 'offen', erstellt: 11 },
    { id: 'g4', kat: 'tiere', titel: 'Hund ausführen (einmalig)', wer: 'Jens W.', initialen: 'JW', sterne: 4.8, bewertungen: 21, betrag: 10,
      stadtteil: 'Havelse', lat: 52.4114, lng: 9.6114, wann: 'Mittwoch, 12–13 Uhr', dauer: '1 Std.',
      text: 'Bruno ist ein ruhiger Dackel. Einmal die große Runde bis zum Mittellandkanal. Ich bin an dem Tag beruflich unterwegs.',
      adresse: 'Am Hasenberge, Havelse', antwort: 'Super. Bruno mag Leckerlis, die liegen auf der Kommode.', status: 'offen', erstellt: 10 },
    { id: 'g5', kat: 'haushalt', titel: 'Kleiderschrank aufbauen', wer: 'Lea S.', initialen: 'LS', sterne: 4.6, bewertungen: 3, betrag: 25,
      stadtteil: 'Auf der Horst', lat: 52.4170, lng: 9.5970, wann: 'Sonntag, nachmittags', dauer: 'ca. 2 Std.',
      text: 'Schrank aus Einzelteilen, 2 m hoch, soll an der Wand befestigt werden. Werkzeug und Dübel sind da.',
      adresse: 'Nähe Stadtbahn-Endhaltestelle, Auf der Horst', antwort: 'Danke! Zu zweit geht es bestimmt schneller, ich helfe mit.', status: 'offen', erstellt: 9 },
    { id: 'g6', kat: 'technik', titel: 'Drucker einrichten', wer: 'Gisela R.', initialen: 'GR', sterne: 4.9, bewertungen: 11, betrag: 12, telefon: '0176 04069012',
      stadtteil: 'Meyenfeld', lat: 52.4423, lng: 9.5698, wann: 'Diese Woche, flexibel', dauer: 'ca. 45 Min.',
      text: 'Der neue Drucker soll mit dem WLAN und meinem Laptop verbunden werden. Mit der Anleitung komme ich nicht klar.',
      adresse: 'Ortsmitte Meyenfeld', antwort: 'Vielen Dank! Das WLAN-Passwort klebt hinten am Router.', status: 'offen', erstellt: 8 },
    { id: 'g7', kat: 'tragen', titel: 'Kartons in den Keller tragen', wer: 'Marco B.', initialen: 'MB', sterne: 4.5, bewertungen: 4, betrag: 18,
      stadtteil: 'Stelingen', lat: 52.4506, lng: 9.6236, wann: 'Samstag, nachmittags', dauer: 'ca. 1 Std.',
      text: 'Etwa 15 Umzugskartons aus dem Flur in den Keller. Einige sind schwer, da sind Bücher drin.',
      adresse: 'Leinestraße, Stelingen', antwort: 'Klasse, danke! Der Keller ist offen.', status: 'offen', erstellt: 7 },
    { id: 'g8', kat: 'garten', titel: 'Hecke schneiden', wer: 'Sandra P.', initialen: 'SP', sterne: 4.8, bewertungen: 17, betrag: 22, fuer: 'meine Mutter Ingrid', telefon: '0171 3920018',
      stadtteil: 'Horst', lat: 52.4420, lng: 9.5374, wann: 'Nächste Woche, vormittags', dauer: 'ca. 2 Std.',
      text: 'Ligusterhecke, etwa 15 m lang und 1,60 m hoch. Die elektrische Heckenschere ist da, der Schnitt kommt in die Biotonne.',
      adresse: 'Nähe Kirche, Horst', antwort: 'Wunderbar, danke! Die Heckenschere liegt in der Garage.', status: 'offen', erstellt: 6 },
    { id: 'g9', kat: 'einkaufen', titel: 'Einkauf aus Garbsen mitbringen', wer: 'Werner T.', initialen: 'WT', sterne: 5.0, bewertungen: 8, betrag: 7,
      stadtteil: 'Frielingen', lat: 52.4610, lng: 9.5361, wann: 'Donnerstag, vormittags', dauer: 'ca. 45 Min.',
      text: 'Ich komme gerade schlecht ins Zentrum. Eine kurze Liste vom Supermarkt, den Einkauf bezahle ich bei der Übergabe.',
      adresse: 'Schafbrink, Frielingen', antwort: 'Danke! Die Liste schicke ich dir gleich im Chat.', status: 'offen', erstellt: 5, telefon: '0171 3920047' },
    { id: 'g10', kat: 'tiere', titel: 'Katze füttern am Wochenende', wer: 'Sabine L.', initialen: 'SL', sterne: 4.9, bewertungen: 12, betrag: 12,
      stadtteil: 'Osterwald O.E.', lat: 52.4623, lng: 9.5926, wann: 'Samstag und Sonntag, abends', dauer: '2 × 15 Min.',
      text: 'Minka braucht abends Futter und frisches Wasser. Ich bin übers Wochenende bei meiner Schwester.',
      adresse: 'Neue Straße, Osterwald O.E.', antwort: 'Danke! Den Schlüssel bekommst du am Freitag von mir.', status: 'offen', erstellt: 4 },
    { id: 'g11', kat: 'haushalt', titel: 'Fahrradschlauch wechseln', wer: 'Paul D.', initialen: 'PD', sterne: 4.7, bewertungen: 5, betrag: 10,
      stadtteil: 'Heitlingen', lat: 52.4676, lng: 9.6166, wann: 'Morgen, ab 16 Uhr', dauer: 'ca. 30 Min.',
      text: 'Platten am Hinterrad vom Kinderrad. Einen Ersatzschlauch habe ich schon gekauft.',
      adresse: 'In den Bornwiesen, Heitlingen', antwort: 'Danke! Das Rad steht im Carport.', status: 'offen', erstellt: 3 },
    { id: 'g12', kat: 'tragen', titel: 'Gartenmöbel in die Garage räumen', wer: 'Renate H.', initialen: 'RH', sterne: 4.8, bewertungen: 10, betrag: 15,
      stadtteil: 'Schloß Ricklingen', lat: 52.4301, lng: 9.5093, wann: 'Samstag, vormittags', dauer: 'ca. 1 Std.',
      text: 'Tisch, sechs Stühle und zwei Liegen sollen vor dem Winter in die Garage. Zu zweit geht das schnell.',
      adresse: 'Ortsmitte Schloß Ricklingen', antwort: 'Prima! Ich packe mit an.', status: 'offen', erstellt: 2 },
    { id: 'g13', kat: 'tragen', titel: 'Kaminholz stapeln', wer: 'Frank G.', initialen: 'FG', sterne: 4.6, bewertungen: 7, betrag: 20,
      stadtteil: 'Osterwald U.E.', lat: 52.4613, lng: 9.5537, wann: 'Freitag, nachmittags', dauer: 'ca. 1,5 Std.',
      text: 'Ein Raummeter Buchenholz liegt in der Einfahrt und soll unter das Vordach. Arbeitshandschuhe sind da.',
      adresse: 'Großer Weg, Osterwald U.E.', antwort: 'Danke! Fang einfach an, ich bin im Garten.', status: 'offen', erstellt: 1 }
  ];

  /* ===== Beispiel-Personen (Demo): Profile mit Bewertungen =====
     Bewertung: [Sterne, von, Rolle, Kategorie, Tätigkeit, vor wie vielen Tagen, Text]
     Rolle aus Sicht der Person im Profil: 'gesucht' = sie hat Hilfe gesucht (von hat geholfen), 'geholfen' = sie hat geholfen.
     Wo zwei Beispiel-Personen sich gegenseitig bewertet haben, passen beide Seiten zusammen.
     Weitere Bewertungen ohne Text ergänzt demoProfil() bis zur Anzahl (hilfen + gesuche) und zum Schnitt. */
  const DEMO_PERSONEN = {
    'Karin M.': { stadtteil: 'Berenbostel', dabei: 'März 2025', hilfen: 5, gesuche: 9, schnitt: 4.9, bewertungen: [
      [5, 'Jonas K.', 'gesucht', 'garten', 'Rasen mähen', 16, 'Alles lag bereit, der Mäher war sogar vollgetankt. Hinterher gab es noch Apfelkuchen. Gerne wieder!'],
      [5, 'Werner T.', 'geholfen', 'einkaufen', 'Einkauf aus Garbsen mitbringen', 34, 'Frau M. hat mir den Einkauf vorbeigebracht und an alles gedacht, sogar an die richtige Brotsorte. Vielen Dank.'],
      [4, 'Paul D.', 'gesucht', 'garten', 'Hecke schneiden', 61, 'Nette Absprache. Die Hecke war ein ganzes Stück länger als beschrieben, deshalb hat es länger gedauert. Sie hat dann auch mehr gezahlt, das fand ich fair.'],
      [5, 'Aylin Ö.', 'geholfen', 'tiere', 'Katze füttern', 102, 'Hat eine Woche lang meinen Kater versorgt und mir jeden Abend ein Foto geschickt. Ich war total beruhigt.']] },
    'Herbert K.': { stadtteil: 'Altgarbsen', dabei: 'Januar 2025', hilfen: 1, gesuche: 8, schnitt: 4.7, bewertungen: [
      [5, 'Lea S.', 'gesucht', 'garten', 'Laub rechen', 21, 'Herr K. hatte Rechen und Säcke schon rausgestellt und zwischendurch Kaffee gebracht. Sehr angenehm.'],
      [4, 'Marco B.', 'gesucht', 'tragen', 'Blumenkübel in den Keller', 47, 'Freundlich und dankbar. Wir mussten den Termin einmal verschieben, das ging aber ohne Probleme.'],
      [5, 'Renate H.', 'geholfen', 'haushalt', 'Gardinen aufhängen', 80, 'Herbert hat mir mit der Leiter geholfen, als ich allein nicht weiterkam. Pünktlich und sehr umsichtig.']] },
    'Aylin Ö.': { stadtteil: 'Garbsen-Mitte', dabei: 'Mai 2025', hilfen: 4, gesuche: 2, schnitt: 5, bewertungen: [
      [5, 'Jens W.', 'geholfen', 'tiere', 'Hund ausführen', 25, 'Bruno ist sonst eher schüchtern, aber mit Aylin ist er sofort mitgegangen. Danke!'],
      [5, 'Gisela R.', 'geholfen', 'technik', 'Handy einrichten', 55, 'Sie hat mir in Ruhe gezeigt, wie ich Fotos an meine Enkel schicke. Ganz viel Geduld!'],
      [5, 'Karin M.', 'gesucht', 'tiere', 'Katze füttern', 102, 'Aylin hatte alles aufgeschrieben: Futter, Uhrzeiten, Nummer vom Tierarzt. So macht das Spaß.']] },
    'Jens W.': { stadtteil: 'Havelse', dabei: 'August 2025', hilfen: 15, gesuche: 6, schnitt: 4.8, bewertungen: [
      [5, 'Sabine L.', 'geholfen', 'tragen', 'Waschmaschine in den Keller', 9, 'Kam mit Sackkarre und Spanngurt, in zehn Minuten war alles erledigt.'],
      [4, 'Aylin Ö.', 'gesucht', 'tiere', 'Hund ausführen', 25, 'Bruno ist ein Schatz. Die Leine war ein bisschen kaputt, sonst alles bestens.'],
      [5, 'Frank G.', 'geholfen', 'haushalt', 'Regal an die Wand', 27, 'Hat sauber gebohrt und hinterher sogar gesaugt. Klare Empfehlung.'],
      [5, 'Herbert K.', 'geholfen', 'garten', 'Rasen vertikutieren', 70, 'Ein ruhiger, zuverlässiger junger Mann. Er hat mir auch gleich erklärt, wie oft man das machen sollte.'],
      [3, 'Marco B.', 'geholfen', 'tragen', 'Sofa in den 2. Stock', 131, 'Kam eine halbe Stunde später als ausgemacht, ohne Bescheid zu sagen. Beim Tragen dann aber top.']] },
    'Lea S.': { stadtteil: 'Auf der Horst', dabei: 'Februar 2026', hilfen: 2, gesuche: 1, schnitt: 4.6, bewertungen: [
      [5, 'Herbert K.', 'geholfen', 'garten', 'Laub rechen', 21, 'Die junge Frau hat zügig und gründlich gearbeitet. Danke!'],
      [4, 'Renate H.', 'geholfen', 'einkaufen', 'Getränke holen', 48, 'Hat alles mitgebracht, nur eine Sorte Saft war die falsche. Nicht schlimm, trotzdem danke.']] },
    'Gisela R.': { stadtteil: 'Meyenfeld', dabei: 'Oktober 2025', hilfen: 2, gesuche: 9, schnitt: 4.9, bewertungen: [
      [5, 'Aylin Ö.', 'gesucht', 'technik', 'Handy einrichten', 55, 'Frau R. ist eine ganz Liebe. Wir haben nebenbei Tee getrunken und viel gelacht.'],
      [5, 'Paul D.', 'gesucht', 'technik', 'Fernseher: Sender suchen', 90, 'Frau R. hatte genau aufgeschrieben, was nicht ging. Nach 20 Minuten liefen alle Sender wieder.'],
      [5, 'Sandra P.', 'geholfen', 'garten', 'Blumen gießen', 140, 'Gisela hat zwei Wochen lang die Blumen meiner Mutter gegossen, während wir im Urlaub waren. Unbezahlbar.']] },
    'Marco B.': { stadtteil: 'Stelingen', dabei: 'Juni 2025', hilfen: 3, gesuche: 1, schnitt: 4.5, bewertungen: [
      [5, 'Herbert K.', 'geholfen', 'tragen', 'Blumenkübel in den Keller', 47, 'Hat die schweren Kübel allein getragen, ich durfte nur die Tür aufhalten.'],
      [4, 'Jens W.', 'gesucht', 'tragen', 'Sofa in den 2. Stock', 131, 'Das Treppenhaus war eng, aber Marco hatte vorher ausgemessen und die Füße schon abgeschraubt. Gut vorbereitet.']] },
    'Sandra P.': { stadtteil: 'Horst', dabei: 'Januar 2025', hilfen: 9, gesuche: 8, schnitt: 4.8, bewertungen: [
      [5, 'Frank G.', 'gesucht', 'garten', 'Hecke schneiden', 30, 'Für Sandras Mutter die Hecke geschnitten. Sandra hat am Telefon alles gut abgesprochen, und ihre Mutter hat Kaffee gekocht.'],
      [5, 'Werner T.', 'geholfen', 'einkaufen', 'Apotheke und Bäcker', 66, 'Sandra hat mir zweimal ausgeholfen, als ich nicht aus dem Haus kam. Sehr hilfsbereit und herzlich.'],
      [4, 'Thomas R.', 'geholfen', 'tragen', 'Umzugskartons tragen', 112, 'Hat gut mit angepackt. Wir mussten etwas warten, weil sie im Stau stand, sie hat aber vorher angerufen.'],
      [5, 'Gisela R.', 'gesucht', 'garten', 'Blumen gießen', 140, 'Frau P. hat mir einen Zettel geschrieben, welche Pflanze wie viel Wasser braucht. Hat alles geklappt.']] },
    'Werner T.': { stadtteil: 'Frielingen', dabei: 'Februar 2025', hilfen: 0, gesuche: 8, schnitt: 5, bewertungen: [
      [5, 'Karin M.', 'gesucht', 'einkaufen', 'Einkauf aus Garbsen mitbringen', 34, 'Immer gern. Danach haben wir noch eine Weile auf der Bank vor dem Haus geklönt.'],
      [5, 'Sandra P.', 'gesucht', 'einkaufen', 'Apotheke und Bäcker', 66, 'Herr T. hatte die Liste schon fertig und das Geld passend abgezählt. Ein sehr freundlicher Herr.']] },
    'Sabine L.': { stadtteil: 'Osterwald O.E.', dabei: 'Juli 2025', hilfen: 7, gesuche: 5, schnitt: 4.9, bewertungen: [
      [5, 'Jens W.', 'gesucht', 'tragen', 'Waschmaschine in den Keller', 9, 'Alles war freigeräumt und der Weg zum Keller frei. So geht das schnell.'],
      [5, 'Paul D.', 'geholfen', 'tiere', 'Kaninchen versorgen', 52, 'Sabine hat sich um unsere Kaninchen gekümmert, als wir verreist waren. Die Kinder waren begeistert von den Fotos.'],
      [5, 'Renate H.', 'geholfen', 'haushalt', 'Rollo reparieren', 98, 'Hat das klemmende Rollo wieder hinbekommen. Wollte erst gar kein Geld nehmen.']] },
    'Paul D.': { stadtteil: 'Heitlingen', dabei: 'April 2025', hilfen: 3, gesuche: 2, schnitt: 4.7, bewertungen: [
      [5, 'Karin M.', 'geholfen', 'garten', 'Hecke schneiden', 61, 'Paul war fleißig und hat die Hecke schön gerade geschnitten. Er hat auch gleich alles zusammengefegt.'],
      [4, 'Sabine L.', 'gesucht', 'tiere', 'Kaninchen versorgen', 52, 'Futter und Heu standen bereit. Der Stall ließ sich schwer öffnen, das hätte ich gern vorher gewusst.'],
      [5, 'Gisela R.', 'geholfen', 'technik', 'Fernseher: Sender suchen', 90, 'Paul hat mir alles aufgeschrieben, damit ich es beim nächsten Mal selbst schaffe. Sehr nett.']] },
    'Renate H.': { stadtteil: 'Schloß Ricklingen', dabei: 'Dezember 2025', hilfen: 4, gesuche: 6, schnitt: 4.8, bewertungen: [
      [5, 'Lea S.', 'gesucht', 'einkaufen', 'Getränke holen', 48, 'Sehr nette Dame. Sie hat sich trotz des falschen Safts herzlich bedankt.'],
      [5, 'Herbert K.', 'gesucht', 'haushalt', 'Gardinen aufhängen', 80, 'Frau H. hatte die Gardinen schon gewaschen und gebügelt bereitgelegt. Hat gut zusammen geklappt.'],
      [5, 'Sabine L.', 'gesucht', 'haushalt', 'Rollo reparieren', 98, 'Frau H. hat genau gezeigt, wo es hakt. Und es gab selbstgebackene Kekse.']] },
    'Frank G.': { stadtteil: 'Osterwald U.E.', dabei: 'September 2025', hilfen: 4, gesuche: 3, schnitt: 4.6, bewertungen: [
      [4, 'Jens W.', 'gesucht', 'haushalt', 'Regal an die Wand', 27, 'Das Regal war schon ausgepackt, nur die passenden Dübel fehlten. Ich hatte zum Glück welche dabei.'],
      [5, 'Sandra P.', 'geholfen', 'garten', 'Hecke schneiden', 30, 'Herr G. hat die Hecke meiner Mutter sehr ordentlich geschnitten und sich danach noch Zeit für ein Gespräch genommen.'],
      [5, 'Marco B.', 'geholfen', 'tragen', 'Umzugskartons tragen', 150, 'Frank hat einen ganzen Samstag mit angepackt. Ohne ihn hätten wir das nicht geschafft.']] }
  };
  // Steckbriefe der Beispiel-Personen: Über mich, hilft gern bei, Sprachen, meist Zeit
  const DEMO_STECKBRIEFE = {
    'Karin M.': ['Rentnerin, seit 30 Jahren in Berenbostel. Ich backe gern und kümmere mich um Katzen, wenn Nachbarn verreist sind. Für den Rasen fehlt mir inzwischen die Puste.', ['tiere', 'einkaufen'], ['Deutsch'], ['vormittags', 'nachmittags']],
    'Herbert K.': ['Ich wohne allein in Altgarbsen. Den Garten schaffe ich nicht mehr ganz, aber Fahrräder repariere ich noch gern.', ['haushalt'], ['Deutsch'], ['vormittags']],
    'Aylin Ö.': ['Ich studiere Soziale Arbeit in Hannover und wohne in Garbsen-Mitte. Ich mag Tiere und erkläre gern Handys und Tablets.', ['tiere', 'technik', 'einkaufen'], ['Deutsch', 'Englisch', 'Türkisch'], ['nachmittags', 'abends', 'wochenende']],
    'Jens W.': ['Ich arbeite im Schichtdienst und habe deshalb oft vormittags Zeit. Sackkarre, Bohrmaschine und einen Kombi habe ich.', ['tragen', 'haushalt', 'garten'], ['Deutsch', 'Englisch'], ['vormittags', 'wochenende']],
    'Lea S.': ['Azubi im ersten Jahr, wohne Auf der Horst. Einkaufen und Gartenarbeit mache ich gern nach Feierabend.', ['einkaufen', 'garten'], ['Deutsch', 'Englisch'], ['abends', 'wochenende']],
    'Gisela R.': ['Seit meinem Umzug nach Meyenfeld kenne ich noch nicht so viele Leute. Ich gieße gern Blumen und freue mich über Besuch auf einen Kaffee.', ['garten'], ['Deutsch', 'Polnisch'], ['vormittags', 'nachmittags']],
    'Marco B.': ['Vater von zwei Kindern in Stelingen. Für Tragen und Umzüge bin ich zu haben, wenn es zeitlich passt.', ['tragen'], ['Deutsch', 'Italienisch'], ['abends', 'wochenende']],
    'Sandra P.': ['Ich kümmere mich viel um meine Mutter in Horst. Wenn ich selbst Luft habe, helfe ich gern anderen.', ['einkaufen', 'tiere', 'haushalt'], ['Deutsch', 'Russisch'], ['abends']],
    'Werner T.': ['Mit dem Rollator komme ich nicht mehr gut zum Bäcker. Ich freue mich über Hilfe und erzähle gern von früher.', [], ['Deutsch'], ['vormittags']],
    'Sabine L.': ['Lehrerin an der Grundschule, großer Garten, zwei Kaninchen. Werkzeug kann man sich bei mir auch leihen.', ['garten', 'tiere', 'haushalt'], ['Deutsch', 'Englisch', 'Französisch'], ['nachmittags', 'wochenende']],
    'Paul D.': ['Ich arbeite in der IT, meistens von zu Hause. Router, Fernseher, Drucker: Ich schau mir das gern an.', ['technik'], ['Deutsch', 'Englisch'], ['abends']],
    'Renate H.': ['Ich nähe gern und kürze auch mal eine Hose. Dafür brauche ich manchmal jemanden mit Leiter.', ['haushalt'], ['Deutsch'], ['vormittags', 'nachmittags']],
    'Frank G.': ['Im Vorruhestand, handwerklich fit und mit Anhänger. Sagt einfach Bescheid.', ['tragen', 'haushalt', 'garten'], ['Deutsch'], ['morgens', 'vormittags']]
  };
  const SPRACHEN = ['Deutsch', 'Englisch', 'Türkisch', 'Arabisch', 'Russisch', 'Polnisch', 'Ukrainisch', 'Italienisch', 'Französisch', 'Spanisch'];
  const ZEITEN = [['morgens', 'Morgens'], ['vormittags', 'Vormittags'], ['nachmittags', 'Nachmittags'], ['abends', 'Abends'], ['wochenende', 'Am Wochenende']];
  // Dein Profil in der Demo (Über mich, Bild usw.): nur auf diesem Gerät
  const DEMO_PROFIL_SPEICHER = 'handdrauf-demo-profil';
  const demoSteckbrief = (() => {
    try { const x = JSON.parse(localStorage.getItem(DEMO_PROFIL_SPEICHER) || '{}'); return x && typeof x === 'object' ? x : {}; } catch (e) { return {}; }
  })();
  const demoSteckbriefSpeichern = () => { try { localStorage.setItem(DEMO_PROFIL_SPEICHER, JSON.stringify(demoSteckbrief)); } catch (e) { /* nur für diese Sitzung */ } };
  // Du in der Demo (Tim)
  const DEMO_ICH = { name: 'Tim S.', stadtteil: 'Garbsen-Mitte', dabei: 'Juni 2025', hilfen: 6, gesuche: 1, schnitt: 4.9, bewertungen: [
    [5, 'Renate H.', 'geholfen', 'tragen', 'Gartenstühle in den Schuppen', 12, 'Tim war pünktlich und hat noch gefragt, ob er die Kissen auch reinbringen soll. Sehr aufmerksam.'],
    [5, 'Werner T.', 'geholfen', 'einkaufen', 'Einkauf mitbringen', 40, 'Hat alles bekommen, was auf der Liste stand. Danke, junger Mann!'],
    [4, 'Frank G.', 'geholfen', 'tragen', 'Kaminholz stapeln', 75, 'Ordentlich gestapelt. Hätte etwas schneller gehen können, aber es war ja auch kalt.'],
    [5, 'Paul D.', 'gesucht', 'technik', 'WLAN-Router einrichten', 120, 'Tim hatte alle Zugangsdaten bereitgelegt, das hat viel Zeit gespart.']] };
  // Demo: So bewertet die andere Person dich, nachdem du geholfen hast
  const DEMO_GEGENBEWERTUNGEN = ['Pünktlich, freundlich und hat sauber gearbeitet. Gerne wieder!',
    'Hat mitgedacht und gefragt, bevor etwas weggeräumt wurde. Sehr angenehm.',
    'Schnell erledigt und hinterher noch kurz geplaudert. Danke!'];

  const SPEICHER = 'nachbarhand-prototyp-v3';
  const VIEWS = ['entdecken', 'karte', 'neu', 'auftraege'];
  const RECHT = RECHT_TEXTE(CONFIG.betreiber, Object.assign({ supabaseCdn: /^https?:/.test(SUPABASE_JS), geocoder: String(EINSTELLUNGEN.geocoder || ''), esri: !!CONFIG.karte.esri, beschriftung: !!CONFIG.karte.beschriftung }, CONFIG.hosting), (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const FRAGEN = FRAGEN_TEXTE(CONFIG);
  const istSeite = (n) => !!RECHT[n] || n === 'fragen'; // Seiten mit eigener Adresse (#impressum, #fragen …)
  const EIGEN_VERSATZ = [[180, -150], [-160, 170], [220, 160], [-210, -190]]; // Demo: Meter Nord/Ost ab deinem Standort

  const $ = (s, r = document) => r.querySelector(s);
  const kopie = (x) => JSON.parse(JSON.stringify(x));

  /* ===== Datenhaltung: Demo (dieses Gerät) oder Live (Supabase) ===== */
  const db = {
    modus: 'demo',
    client: null,
    user: null,
    profil: null,
    geladen: false,
    geladenUm: 0,
    laedt: false,
    fehler: null,
    bewertungen: new Map(), // gesuch_id -> meine Sterne
    adressen: new Map(),    // gesuch_id -> Adresse (nur für Beteiligte)
    telefone: new Map(),    // gesuch_id -> Telefon (freiwillig, nur für Beteiligte)
    statistik: null,        // { woche, gesamt }: wie oft geholfen wurde
    richtwerte: {},         // kategorie -> { von, bis, anzahl }: übliche Beträge aus echten Anfragen
    nachrichten: new Map(), // gesuch_id -> Verlauf (null = wird geladen)
    letzte: new Map(),      // gesuch_id -> Zeit der letzten Nachricht der anderen Person
    gemeldet: new Set(),    // in dieser Sitzung gemeldete Anfragen
    profile: new Map(),     // profil_id -> öffentliches Profil (für die Profil-Ansicht)
    bilder: new Map(),      // profil_id -> Pfad des Profilbilds ('' = keins)
    teil9: null,            // Datenbank kann Profilbild, Über mich usw. (Update Teil 9)? null = noch nicht bekannt
    rezensionen: new Map(), // profil_id -> erschienene Bewertungen (null = wird geladen, false = Datenbank ohne Update Teil 8)
    rezGemeldet: new Set(), // in dieser Sitzung gemeldete Bewertungen
    teil8: null,            // Datenbank kann geschriebene Bewertungen (Update Teil 8)? null = noch nicht bekannt
    altesSchema: false,     // Datenbank ohne das Update vom November 2026 (kein Termin, kein Bearbeiten)
    blockiert: new Map()    // profil_id -> Name (von mir blockiert)
  };
  const istLive = () => db.modus === 'live';
  // Echte Seite mit Datenbank: Bis die Verbindung steht, nichts aus der Demo zeigen (keine erfundenen Anfragen, kein „Tim“)
  const LIVE_GEPLANT = !VORSCHAU && !BEISPIEL_MODUS && !!(LIVE.url && LIVE.key);
  const wartetAufLive = () => LIVE_GEPLANT && !istLive() && !db.liveAus;
  const seiteZeigen = () => document.documentElement.classList.remove('startet');

  function demoLaden() {
    try {
      const raw = localStorage.getItem(SPEICHER);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.every((g) => typeof g.lat === 'number' && typeof g.lng === 'number')) return arr;
      }
    } catch (e) { /* ohne Speicher weiter */ }
    return kopie(BEISPIELE);
  }
  function demoSpeichern() {
    if (istLive()) return;
    try { localStorage.setItem(SPEICHER, JSON.stringify(gesuche)); } catch (e) { /* ohne Speicher weiter */ }
  }

  let gesuche = [];
  const ui = { view: 'entdecken', kat: 'alle', umkreis: 10, suche: '', sort: 'termin', offen: null, panel: null, authModus: 'anmelden', authGrund: '', authFertig: '', authWeg: 'passwort', authCode: '', vorlesen: false, markiert: null, zentrieren: null, rueckzug: false, melden: false, loeschen: false, profil: null, profilStapel: [], profilAlle: false, rezMelden: null, bewertung: null, zuletzt: null, busy: false, bearbeiten: null, blockieren: false };

  /* ===== Ansicht: Design, Schriftgröße, Startseite, Luftbild (nur auf diesem Gerät gespeichert) ===== */
  const ANSICHT_SPEICHER = 'handdrauf-ansicht';
  const ANSICHT_OPTIONEN = {
    thema: [['auto', 'Automatisch'], ['hell', 'Hell'], ['dunkel', 'Dunkel']],
    schrift: [['normal', 'Normal'], ['gross', 'Groß'], ['sehr-gross', 'Sehr groß']],
    start: [['entdecken', 'Liste'], ['karte', 'Karte']],
    kartenart: [['luftbild', 'Luftbild'], ['karte', 'Straßenkarte']]
  };
  const ansicht = { thema: 'auto', schrift: 'normal', start: 'entdecken', kartenart: 'luftbild' };
  try {
    const gespeichert = JSON.parse(localStorage.getItem(ANSICHT_SPEICHER) || '{}');
    Object.keys(ansicht).forEach((k) => {
      if (ANSICHT_OPTIONEN[k].some(([w]) => w === gespeichert[k])) ansicht[k] = gespeichert[k];
    });
  } catch (e) { /* ohne Speicher: Standardwerte */ }
  function ansichtAnwenden() {
    const r = document.documentElement;
    if (ansicht.thema === 'auto') r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', ansicht.thema === 'dunkel' ? 'dark' : 'light');
    if (ansicht.schrift === 'normal') r.removeAttribute('data-schrift'); else r.setAttribute('data-schrift', ansicht.schrift);
    // Farbe der Statusleiste: bei „Automatisch“ je nach Gerät hell oder dunkel, sonst passend zum gewählten Design
    const papier = getComputedStyle(r).getPropertyValue('--paper').trim() || '#EDF1F5';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (!m.dataset.standard) m.dataset.standard = m.content;
      m.content = ansicht.thema === 'auto' ? m.dataset.standard : papier;
    });
  }
  function ansichtSetzen(k, w) {
    if (!ANSICHT_OPTIONEN[k] || !ANSICHT_OPTIONEN[k].some(([x]) => x === w)) return;
    ansicht[k] = w;
    try { localStorage.setItem(ANSICHT_SPEICHER, JSON.stringify(ansicht)); } catch (e) { /* nur für diese Sitzung */ }
    ansichtAnwenden();
  }
  ansichtAnwenden();

  // Ort aus der Begrüßung oder dem Menü: { name, lat, lng }, nur auf diesem Gerät. Angemeldet zählt der Ort im Konto.
  const START_SPEICHER = 'handdrauf-start-gesehen';
  const START_FASSUNG = '2'; // erhöhen, wenn alle die Begrüßung noch einmal sehen sollen
  const ORT_SPEICHER = 'handdrauf-ort';
  const UMKREIS_SPEICHER = 'handdrauf-umkreis';
  const UMKREISE = [2, 5, 10, 25, 50];
  let gewaehlterOrt = null;
  function inDeutschland(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' && lat >= 47.2 && lat <= 55.1 && lng >= 5.8 && lng <= 15.1;
  }
  // Ein Ort aus Speicher, Liste oder Suche. Ein bloßer Name ist ein Stadtteil von Garbsen (ältere Fassungen).
  function ortPruefen(o) {
    if (typeof o === 'string') {
      const s = STADTTEILE.find((x) => x.name === o);
      return s ? { name: s.name, lat: s.lat, lng: s.lng } : null;
    }
    return o && typeof o.name === 'string' && o.name.trim().length >= 2 && inDeutschland(o.lat, o.lng)
      ? { name: o.name.trim().slice(0, 60), lat: o.lat, lng: o.lng } : null;
  }
  try {
    const roh = localStorage.getItem(ORT_SPEICHER);
    gewaehlterOrt = roh ? ortPruefen(JSON.parse(roh)) : ortPruefen(localStorage.getItem('handdrauf-stadtteil') || '');
  } catch (e) { /* ohne Speicher */ }
  function ortWaehlen(o) {
    const ort = ortPruefen(o);
    if (!ort) return false;
    gewaehlterOrt = ort;
    try { localStorage.setItem(ORT_SPEICHER, JSON.stringify(ort)); } catch (e) { /* nur für diese Sitzung */ }
    return true;
  }
  // Mitte eines Rasterfelds von etwa 1 × 1 km (wie in der Datenbank). Genauer verlässt keine Lage das Gerät.
  const rasterpunkt = (o) => ({ lat: (Math.floor(o.lat * 100) + 0.5) / 100, lng: (Math.floor(o.lng * 66) + 0.5) / 66 });

  /* ===== Hilfsfunktionen ===== */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const euroKurz = (n) => Number.isInteger(n) ? `${n} €` : euro(n);
  const katName = (id) => (KATEGORIEN.find((k) => k.id === id) || {}).name || '';
  // Tätigkeiten als echte Objekte (Bild), alles andere als feine Linien-Symbole
  const icon = (id, cls = '') => KAT_BILDER[id]
    ? `<img class="bild ${cls}" src="${KAT_BILDER[id]}" alt="" width="56" height="56" decoding="async" draggable="false">`
    : `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const vorname = (name) => String(name || '').split(' ')[0];
  const anzeigename = (p) => p ? `${p.vorname}${p.nachname_initial ? ' ' + p.nachname_initial + '.' : ''}` : 'Unbekannt';
  const kuerzel = (p) => p ? ((p.vorname || '?')[0] + (p.nachname_initial || '')).toUpperCase() : '?';
  const auszahlung = (g) => CONFIG.gebuehren ? Math.round(g.betrag * (1 - CONFIG.provisionHelfer) * 100) / 100 : g.betrag;

  function abstand(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function versetze(p, nordM, ostM) {
    return { lat: p.lat + nordM / 111320, lng: p.lng + ostM / (111320 * Math.cos(p.lat * Math.PI / 180)) };
  }
  // Wo bin ich? Demo: der gewählte Ort oder Tim in Garbsen-Mitte. Live: der Ort aus dem Konto (Rasterpunkt),
  // sonst der auf diesem Gerät gewählte Ort. Die App fragt nie den Standort des Geräts ab.
  function ortVon(name) {
    const s = STADTTEILE.find((x) => x.name === name) || STADTTEILE[0];
    return { lat: s.lat, lng: s.lng, stadtteil: s.name };
  }
  function meinOrt() {
    if (!istLive()) {
      return gewaehlterOrt && gewaehlterOrt.name !== CONFIG.ich.stadtteil ? { lat: gewaehlterOrt.lat, lng: gewaehlterOrt.lng, stadtteil: gewaehlterOrt.name } : CONFIG.ich;
    }
    if (db.profil) {
      if (db.wohnort) return { lat: db.wohnort.lat, lng: db.wohnort.lng, stadtteil: db.profil.stadtteil };
      if (STADTTEILE.some((x) => x.name === db.profil.stadtteil)) return ortVon(db.profil.stadtteil);
      if (gewaehlterOrt) return { lat: gewaehlterOrt.lat, lng: gewaehlterOrt.lng, stadtteil: db.profil.stadtteil };
    }
    return gewaehlterOrt ? { lat: gewaehlterOrt.lat, lng: gewaehlterOrt.lng, stadtteil: gewaehlterOrt.name } : ortVon('Garbsen-Mitte');
  }
  const zeigeIch = () => !istLive() || !!db.profil || !!gewaehlterOrt;

  /* ===== Orte in ganz Deutschland =====
     Suche über Photon (OpenStreetMap-Daten, betrieben von komoot in Berlin, Adresse in einstellungen.json).
     Ohne Netz oder in der Vorschau: die Stadtteile von Garbsen und die größeren Städte aus der Liste unten. */
  const GEOCODER = VORSCHAU ? '' : String(EINSTELLUNGEN.geocoder || '').replace(/\/$/, '');
  const STAEDTE = [
    ['Berlin', 52.5200, 13.4050], ['Hamburg', 53.5511, 9.9937], ['München', 48.1372, 11.5755], ['Köln', 50.9375, 6.9603],
    ['Frankfurt am Main', 50.1109, 8.6821], ['Stuttgart', 48.7758, 9.1829], ['Düsseldorf', 51.2277, 6.7735], ['Leipzig', 51.3397, 12.3731],
    ['Dortmund', 51.5136, 7.4653], ['Essen', 51.4556, 7.0116], ['Bremen', 53.0793, 8.8017], ['Dresden', 51.0504, 13.7373],
    ['Hannover', 52.3759, 9.7320], ['Nürnberg', 49.4521, 11.0767], ['Duisburg', 51.4344, 6.7623], ['Bochum', 51.4818, 7.2162],
    ['Wuppertal', 51.2562, 7.1508], ['Bielefeld', 52.0302, 8.5325], ['Bonn', 50.7374, 7.0982], ['Münster', 51.9607, 7.6261],
    ['Mannheim', 49.4875, 8.4660], ['Karlsruhe', 49.0069, 8.4037], ['Augsburg', 48.3705, 10.8978], ['Wiesbaden', 50.0782, 8.2398],
    ['Aachen', 50.7753, 6.0839], ['Braunschweig', 52.2689, 10.5268], ['Kiel', 54.3233, 10.1228], ['Chemnitz', 50.8278, 12.9214],
    ['Halle (Saale)', 51.4969, 11.9688], ['Magdeburg', 52.1205, 11.6276], ['Freiburg im Breisgau', 47.9990, 7.8421], ['Mainz', 49.9929, 8.2473],
    ['Lübeck', 53.8655, 10.6866], ['Erfurt', 50.9848, 11.0299], ['Oldenburg', 53.1435, 8.2146], ['Rostock', 54.0924, 12.0991],
    ['Kassel', 51.3127, 9.4797], ['Osnabrück', 52.2799, 8.0472], ['Potsdam', 52.3906, 13.0645], ['Saarbrücken', 49.2402, 6.9969],
    ['Regensburg', 49.0134, 12.1016], ['Würzburg', 49.7913, 9.9534], ['Göttingen', 51.5413, 9.9158], ['Hildesheim', 52.1508, 9.9511],
    ['Wolfsburg', 52.4227, 10.7865], ['Langenhagen', 52.4394, 9.7397], ['Wunstorf', 52.4239, 9.4364], ['Seelze', 52.3961, 9.5981],
    ['Laatzen', 52.3094, 9.7966], ['Neustadt am Rübenberge', 52.5052, 9.4636]
  ];
  const vergleich = (t) => String(t).toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  function lokaleOrte(q) {
    const v = vergleich(q);
    if (!v) return [];
    const alle = STADTTEILE.map((x) => ({ name: x.name, lat: x.lat, lng: x.lng, titel: x.name, unter: 'Garbsen' }))
      .concat(STAEDTE.map(([name, lat, lng]) => ({ name, lat, lng, titel: name, unter: '' })));
    const treffer = alle.filter((o) => (' ' + vergleich(o.name + ' ' + o.unter)).indexOf(' ' + v) >= 0);
    return treffer.slice(0, 7);
  }
  // Ergebnis von Photon in einen Ort umwandeln. Öffentlich sichtbar ist nur der Ortsname (Stadtteil, Stadt).
  function photonZuOrt(f) {
    const p = f.properties || {}, c = (f.geometry || {}).coordinates || [];
    const lat = c[1], lng = c[0];
    if ((p.countrycode && p.countrycode !== 'DE') || !inDeutschland(lat, lng)) return null;
    const istStadt = ['city', 'town', 'village', 'municipality', 'hamlet'].indexOf(p.osm_value) >= 0 || p.type === 'city';
    const istTeil = ['suburb', 'quarter', 'neighbourhood', 'borough', 'city_district', 'district'].indexOf(p.osm_value) >= 0 || p.type === 'district' || p.type === 'locality';
    const stadt = p.city || (istStadt ? p.name : '') || p.county || '';
    const teil = p.district || p.locality || (istTeil ? p.name : '');
    const garbsen = stadt === 'Garbsen' && STADTTEILE.some((x) => x.name === teil);
    const ort = garbsen ? teil : teil && stadt && teil.indexOf(stadt) < 0 && stadt.indexOf(teil) < 0 ? `${teil}, ${stadt}` : (teil || stadt || p.name || '');
    if (ort.length < 2) return null;
    const strasse = p.street ? `${p.street}${p.housenumber ? ' ' + p.housenumber : ''}` : (p.osm_key === 'highway' ? p.name : '');
    const titel = strasse || p.name || ort;
    return { name: ort.slice(0, 60), lat, lng, titel, unter: [p.postcode, ort !== titel ? ort : ''].filter(Boolean).join(' '), strasse };
  }
  const ortCache = new Map();
  // art: 'ort' (Wohnort, Stadtteil, Postleitzahl) oder 'adresse' (Straße und Hausnummer)
  async function ortSuchen(q, art, nahe) {
    q = String(q || '').trim();
    if (q.length < 2) return [];
    if (!GEOCODER || !window.fetch) return lokaleOrte(q);
    const bei = nahe || meinOrt();
    const schluessel = art + '|' + q + '|' + Math.round(bei.lat * 10) + ',' + Math.round(bei.lng * 10);
    if (ortCache.has(schluessel)) return ortCache.get(schluessel);
    try {
      const url = `${GEOCODER}/api/?q=${encodeURIComponent(q)}&lang=de&limit=8&bbox=5.8,47.2,15.1,55.1&lat=${bei.lat.toFixed(3)}&lon=${bei.lng.toFixed(3)}`;
      const antwort = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!antwort.ok) throw new Error('Ortssuche ' + antwort.status);
      const daten = await antwort.json();
      const gesehen = {};
      const liste = (daten.features || []).map(photonZuOrt).filter((o) => {
        if (!o) return false;
        const k = (art === 'adresse' ? o.titel + '|' : '') + o.name;
        if (gesehen[k]) return false;
        gesehen[k] = 1;
        return true;
      }).slice(0, 7);
      ortCache.set(schluessel, liste);
      return liste;
    } catch (e) {
      return lokaleOrte(q);
    }
  }

  // Ort-Feld: Eingabe mit Vorschlägen (Combobox). Der gewählte Ort steht in data-name/-lat/-lng.
  function ortFeldHTML(id, ort, platzhalter, art) {
    const o = ort && ortPruefen(ort);
    return `<div class="ort-feld"><input id="${id}" class="ort-eingabe" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-liste"
      autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="80" data-art="${art || 'ort'}" placeholder="${esc(platzhalter || 'Ort, Stadtteil oder Postleitzahl')}"
      value="${o ? esc(o.name) : ''}" ${o ? `data-name="${esc(o.name)}" data-lat="${o.lat}" data-lng="${o.lng}"` : ''}>
      <ul class="ort-liste" id="${id}-liste" role="listbox" aria-label="Vorschläge" hidden></ul></div>`;
  }
  function ortSetzenIn(input, o) {
    if (!input) return;
    const ort = o && ortPruefen(o);
    input.value = ort ? ort.name : '';
    if (ort) { input.dataset.name = ort.name; input.dataset.lat = ort.lat; input.dataset.lng = ort.lng; }
    else { delete input.dataset.name; delete input.dataset.lat; delete input.dataset.lng; }
  }
  // Gewählter Ort, solange der Text nicht verändert wurde
  function ortAusFeld(input) {
    if (!input || !input.dataset.lat || input.value.trim() !== input.dataset.name) return null;
    return ortPruefen({ name: input.dataset.name, lat: Number(input.dataset.lat), lng: Number(input.dataset.lng) });
  }
  // Wie ortAusFeld, aber wer nur getippt hat, bekommt den ersten Vorschlag
  async function ortAufloesen(input) {
    const o = ortAusFeld(input);
    if (o || !input || input.value.trim().length < 2) return o;
    const liste = await ortSuchen(input.value, input.dataset.art || 'ort');
    if (!liste.length) return null;
    ortSetzenIn(input, liste[0]);
    return ortAusFeld(input);
  }
  const ortFelder = new WeakMap();
  function ortListeZu(input) {
    const liste = document.getElementById(input.getAttribute('aria-controls'));
    if (liste) { liste.hidden = true; liste.innerHTML = ''; }
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function ortListeZeigen(input, treffer) {
    const liste = document.getElementById(input.getAttribute('aria-controls'));
    if (!liste) return;
    ortFelder.set(input, treffer);
    if (!treffer.length) {
      liste.innerHTML = `<li class="ort-leer" role="option" aria-disabled="true">${GEOCODER ? 'Nichts gefunden. Probier die Postleitzahl.' : 'Nichts gefunden.'}</li>`;
    } else {
      liste.innerHTML = treffer.map((o, i) => `<li role="option" id="${input.id}-v${i}" data-ort-i="${i}" aria-selected="false">
        <span class="ort-titel">${esc(o.titel || o.name)}</span>${o.unter ? `<span class="ort-unter">${esc(o.unter)}</span>` : ''}</li>`).join('');
    }
    liste.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function ortNehmen(input, i) {
    const o = (ortFelder.get(input) || [])[i];
    if (!o) return;
    ortSetzenIn(input, o);
    if (input.dataset.art === 'adresse' && o.titel) input.value = o.titel, input.dataset.name = o.titel, input.dataset.ort = o.name;
    ortListeZu(input);
    input.dispatchEvent(new CustomEvent('ortgewaehlt', { bubbles: true, detail: o }));
  }
  let ortSuchTimer = 0;
  document.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList || !input.classList.contains('ort-eingabe')) return;
    clearTimeout(ortSuchTimer);
    const text = input.value;
    if (text.trim().length < 2) { ortListeZu(input); return; }
    ortSuchTimer = setTimeout(async () => {
      const treffer = await ortSuchen(text, input.dataset.art || 'ort');
      if (input.value === text && document.activeElement === input) ortListeZeigen(input, treffer);
    }, GEOCODER ? 280 : 60);
  });
  document.addEventListener('keydown', (e) => {
    const input = e.target;
    if (!input.classList || !input.classList.contains('ort-eingabe')) return;
    const liste = document.getElementById(input.getAttribute('aria-controls'));
    const optionen = liste && !liste.hidden ? [...liste.querySelectorAll('[data-ort-i]')] : [];
    const aktiv = optionen.findIndex((o) => o.getAttribute('aria-selected') === 'true');
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && optionen.length) {
      e.preventDefault();
      const neu = e.key === 'ArrowDown' ? Math.min(optionen.length - 1, aktiv + 1) : Math.max(0, aktiv - 1);
      optionen.forEach((o, i) => o.setAttribute('aria-selected', String(i === neu)));
      input.setAttribute('aria-activedescendant', optionen[neu].id);
    } else if (e.key === 'Enter' && optionen.length) {
      e.preventDefault();
      ortNehmen(input, Number(optionen[Math.max(0, aktiv)].dataset.ortI));
    } else if (e.key === 'Escape' && optionen.length) {
      e.preventDefault();
      e.stopPropagation();
      ortListeZu(input);
    }
  }, true);
  // mousedown statt click: sonst schließt das Verlassen des Feldes die Liste vor der Auswahl
  document.addEventListener('mousedown', (e) => {
    const li = e.target.closest && e.target.closest('.ort-liste [data-ort-i]');
    if (!li) return;
    e.preventDefault();
    const input = document.querySelector(`[aria-controls="${li.parentNode.id}"]`);
    if (input) ortNehmen(input, Number(li.dataset.ortI));
  });
  document.addEventListener('click', (e) => {
    const li = e.target.closest && e.target.closest('.ort-liste [data-ort-i]');
    if (!li) return;
    const input = document.querySelector(`[aria-controls="${li.parentNode.id}"]`);
    if (input && input.getAttribute('aria-expanded') === 'true') ortNehmen(input, Number(li.dataset.ortI));
  });
  document.addEventListener('focusout', (e) => {
    const input = e.target;
    if (input.classList && input.classList.contains('ort-eingabe')) setTimeout(() => { if (document.activeElement !== input) ortListeZu(input); }, 150);
  });
  const meterVonMir = (g) => abstand(meinOrt(), g);
  function distanz(g) {
    if (g.eigen) return 'bei dir';
    const m = meterVonMir(g);
    if (m < 1000) return Math.max(100, Math.round(m / 50) * 50) + '\u00a0m';
    return (m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0km';
  }
  // Geschätzter Weg: Luftlinie mal 1,3; zu Fuß 80 m pro Minute, mit dem Rad 250 m
  function wegText(g) {
    if (g.eigen) return '';
    const m = meterVonMir(g) * 1.3;
    const fuss = Math.max(1, Math.round(m / 80));
    return fuss <= 20 ? `etwa ${fuss} Min. zu Fuß` : `etwa ${Math.max(1, Math.round(m / 250))} Min. mit dem Rad`;
  }
  /* ===== Termine: „Morgen“ wird beim Speichern zum echten Datum ===== */
  const WOCHENTAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  const TAG_MS = 86400000;
  const MAX_TAGE = 21; // ohne festen Termin läuft eine offene Anfrage nach drei Wochen ab
  const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MAX_VORAUS = 60; // so weit im Voraus lässt sich ein Termin wählen (wie in der Datenbank)
  const ZEIT_TEXT = { vormittags: 'vormittags', nachmittags: 'nachmittags', abends: 'abends', flexibel: 'Uhrzeit flexibel' };
  function heute() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function plusTage(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  const isoTag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ausIso = (s) => { const [j, m, t] = String(s).split('-').map(Number); return new Date(j, m - 1, t); };
  const tagText = (d) => `${WOCHENTAGE[d.getDay()]} ${d.getDate()}. ${MONATE[d.getMonth()]}`;
  // Welche Tage meint „Heute“, „Morgen“, „Am Wochenende“, „Nächste Woche“, von heute aus gesehen?
  function zeitraum(wahl, basis = heute()) {
    const wt = basis.getDay();
    let von, bis;
    if (wahl === 'Heute') von = bis = basis;
    else if (wahl === 'Morgen') von = bis = plusTage(basis, 1);
    else if (wahl === 'Dieses Wochenende') { von = wt === 0 ? basis : plusTage(basis, 6 - wt); bis = wt === 0 ? basis : plusTage(von, 1); }
    else if (wahl === 'Nächste Woche') { von = plusTage(basis, ((8 - wt) % 7) || 7); bis = plusTage(von, 6); }
    else return null;
    let text, kurz;
    if (+von === +bis) text = kurz = tagText(von);
    else if (wahl === 'Dieses Wochenende') {
      text = kurz = von.getMonth() === bis.getMonth() ? `Sa./So. ${von.getDate()}./${bis.getDate()}. ${MONATE[bis.getMonth()]}` : `${tagText(von)}/${tagText(bis)}`;
    } else {
      kurz = `${von.getDate()}.${von.getMonth() === bis.getMonth() ? '' : ' ' + MONATE[von.getMonth()]}–${bis.getDate()}. ${MONATE[bis.getMonth()]}`;
      text = `Woche ${kurz}`;
    }
    return { von, bis, text, kurz };
  }
  // Bausteine für den Termin-Text: „Mo. 16., Mi. 18. oder Fr. 20. Nov.“, „Werktage 16.–20. Nov.“
  const montagVon = (d) => plusTage(d, -((d.getDay() + 6) % 7));
  const spanneText = (von, bis) => von.getMonth() === bis.getMonth()
    ? `${von.getDate()}.–${bis.getDate()}. ${MONATE[bis.getMonth()]}`
    : `${von.getDate()}. ${MONATE[von.getMonth()]}–${bis.getDate()}. ${MONATE[bis.getMonth()]}`;
  function tageText(daten) {
    const teile = daten.map((d, i) => {
      const n = daten[i + 1];
      return `${WOCHENTAGE[d.getDay()]} ${d.getDate()}.${!n || n.getMonth() !== d.getMonth() ? ' ' + MONATE[d.getMonth()] : ''}`;
    });
    return teile.length === 1 ? teile[0] : `${teile.slice(0, -1).join(', ')} oder ${teile[teile.length - 1]}`;
  }
  const uhrzeitText = (hhmm) => { const [h, m] = String(hhmm || '16:00').split(':').map(Number); return `gegen ${h}${m ? ':' + String(m).padStart(2, '0') : ''} Uhr`; };
  // Liest den Termin aus dem Wann-Text: „Di. 10. Nov., nachmittags“, „Sa./So. 14./15. Nov.“, „Woche 16.–22. Nov.“,
  // ältere Texte wie „Samstag, vormittags“ oder „Morgen, ab 16 Uhr“. Ergebnis: erster und letzter Tag, Uhrzeit-Fenster.
  const MONAT_INDEX = { 'Jan.': 0, 'Feb.': 1, 'März': 2, 'Apr.': 3, 'Mai': 4, 'Juni': 5, 'Juli': 6, 'Aug.': 7, 'Sept.': 8, 'Okt.': 9, 'Nov.': 10, 'Dez.': 11 };
  const TAGNAMEN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function datumIm(monat, tag) {
    const h = heute();
    const d = new Date(h.getFullYear(), monat, tag);
    return d < plusTage(h, -180) ? new Date(h.getFullYear() + 1, monat, tag) : d; // Jahreswechsel
  }
  // Alle Tage mit Datum aus einem Text wie „Mo. 16., Mi. 18. oder Fr. 20. Nov.“ (Monat gilt rückwärts)
  function datenAusText(datum) {
    const tage = [];
    const muster = /(\d{1,2})\.(?:\s(Jan\.|Feb\.|März|Apr\.|Mai|Juni|Juli|Aug\.|Sept\.|Okt\.|Nov\.|Dez\.))?/g;
    for (let m = muster.exec(datum); m; m = muster.exec(datum)) tage.push([Number(m[1]), m[2] ? MONAT_INDEX[m[2]] : null]);
    if (!tage.some((t) => t[1] !== null)) return [];
    for (let k = tage.length - 2; k >= 0; k--) if (tage[k][1] === null) tage[k][1] = tage[k + 1][1];
    for (let k = 1; k < tage.length; k++) if (tage[k][1] === null) tage[k][1] = tage[k - 1][1];
    const daten = tage.map(([t, m]) => datumIm(m, t));
    for (let k = 1; k < daten.length; k++) if (daten[k] < daten[k - 1]) daten[k] = new Date(daten[k].getFullYear() + 1, daten[k].getMonth(), daten[k].getDate());
    return daten;
  }
  function terminAusText(wann) {
    if (!wann) return null;
    const i = wann.lastIndexOf(', ');
    const datum = (i > 0 ? wann.slice(0, i) : wann).trim();
    const zeit = i > 0 ? wann.slice(i + 2) : '';
    let von = null, bis = null, genau = false;
    const daten = datenAusText(datum);
    if (daten.length) {
      von = daten[0];
      bis = daten[daten.length - 1];
      genau = true;
    } else if (/^Heute/.test(datum)) von = bis = heute();
    else if (/^Morgen/.test(datum)) von = bis = plusTage(heute(), 1);
    else if (/Wochenende|^Samstag und Sonntag/.test(datum)) ({ von, bis } = zeitraum('Dieses Wochenende'));
    else if (/^Nächste Woche/.test(datum)) ({ von, bis } = zeitraum('Nächste Woche'));
    else if (/^Diese Woche/.test(datum)) { von = heute(); bis = plusTage(von, (7 - von.getDay()) % 7); }
    else {
      const t = TAGNAMEN.findIndex((n) => datum.startsWith(n));
      if (t >= 0) von = bis = plusTage(heute(), (t - heute().getDay() + 7) % 7);
    }
    if (!von) return null;
    let start = null, ende = null;
    const spanne = zeit.match(/(\d{1,2})(?::(\d\d))?\s*[–-]\s*(\d{1,2})(?::(\d\d))?\s*Uhr/);
    const ab = zeit.match(/ab\s(\d{1,2})(?::(\d\d))?\s*Uhr/);
    const gegen = zeit.match(/gegen\s(\d{1,2})(?::(\d\d))?\s*Uhr/);
    if (gegen) { start = [+gegen[1], +(gegen[2] || 0)]; ende = [Math.min(23, +gegen[1] + 1), +(gegen[2] || 0)]; }
    else if (spanne) { start = [+spanne[1], +(spanne[2] || 0)]; ende = [+spanne[3], +(spanne[4] || 0)]; }
    else if (ab) { start = [+ab[1], +(ab[2] || 0)]; ende = [Math.min(23, +ab[1] + 2), +(ab[2] || 0)]; }
    else if (/vormittag/.test(zeit)) { start = [9, 0]; ende = [12, 0]; }
    else if (/nachmittag/.test(zeit)) { start = [14, 0]; ende = [17, 0]; }
    else if (/abend/.test(zeit)) { start = [18, 0]; ende = [20, 0]; }
    return { von, bis, zeit, start, ende, genau };
  }
  // Heute oder morgen: in Karten kurz „Morgen, nachmittags“ statt des Datums (nur bei Texten mit echtem Datum)
  function relativerTag(g) {
    const t = terminAusText(g.wann);
    if (!t || !t.genau || +t.von !== +t.bis) return '';
    const tage = Math.round((t.von - heute()) / TAG_MS);
    return tage === 0 ? 'Heute' : tage === 1 ? 'Morgen' : '';
  }
  function wannText(g) {
    const rel = relativerTag(g);
    if (!rel) return g.wann || '';
    const i = g.wann.lastIndexOf(', ');
    return i > 0 ? `${rel}, ${g.wann.slice(i + 2)}` : rel;
  }
  const wannLang = (g) => { const rel = relativerTag(g); return rel ? `${rel}, ${g.wann}` : (g.wann || ''); };
  const abgelaufen = (g) => g.status === 'offen' && !!g.laeuftAb && g.laeuftAb <= Date.now();
  const sichtbarBis = (g) => g.bis ? tagText(ausIso(g.bis)) : (g.laeuftAb ? tagText(new Date(g.laeuftAb - 1)) : '');
  // Sichtbar bis Mitternacht nach dem letzten gewählten Tag (höchstens 60 Tage voraus), ohne Termin drei Wochen
  const demoAblauf = (bis) => bis ? +plusTage(ausIso(bis), 1) : Date.now() + MAX_TAGE * TAG_MS;

  /* ===== Anstößige Wörter (App Store 1.2). Dieselbe Liste prüft die Datenbank in privat.anstoessig. ===== */
  // Ohne „Lookbehind“ (?<!…): Das können iPhones erst ab iOS 16.4, ältere würden beim Start abstürzen
  const ANSTOESSIG = new RegExp('(?:^|[^a-zäöüß])(hure|fotze|wichser|arschloch|spast(i|en)?(?![a-zäöüß])|mongo(?![a-zäöüß])|nutte|(ge)?fick(en|t|st|e|er|te|ten)?(?![a-zäöüß])|bitch|kanake|neger|nigger|schwuchtel|vergewaltig)' +
    '|hurensohn|schlampe|missgeburt|heil hitler|sieg heil');
  const anstoessig = (t) => ANSTOESSIG.test(String(t || '').toLowerCase().replace(/[013457@$]/g, (z) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }[z])));

  // Demo: blockierte Personen nur auf diesem Gerät (nach Namen)
  const BLOCK_SPEICHER = 'handdrauf-blockiert';
  let demoBlockiert = [];
  try { demoBlockiert = JSON.parse(localStorage.getItem(BLOCK_SPEICHER) || '[]') || []; } catch (e) { demoBlockiert = []; }
  const demoBlockSpeichern = () => { try { localStorage.setItem(BLOCK_SPEICHER, JSON.stringify(demoBlockiert)); } catch (e) { /* nur für diese Sitzung */ } };
  // Live blendet die Datenbank Blockierte aus, in der Demo macht das die App
  const versteckt = (g) => !istLive() && !g.eigen && g.helfer !== 'ich' && demoBlockiert.includes(g.wer);

  function passt(g) {
    if (ui.kat !== 'alle' && g.kat !== ui.kat) return false;
    const q = ui.suche.trim().toLowerCase();
    if (!q) return true;
    return (g.titel + ' ' + g.text + ' ' + katName(g.kat) + ' ' + g.stadtteil).toLowerCase().includes(q);
  }
  function sortiere(liste) {
    const l = liste.slice();
    if (ui.sort === 'betrag') l.sort((a, b) => b.betrag - a.betrag);
    else if (ui.sort === 'neu') l.sort((a, b) => b.erstellt - a.erstellt);
    else if (ui.sort === 'termin') {
      const wann = (g) => { const t = terminAusText(g.wann); return t ? +t.von : Infinity; };
      l.sort((a, b) => (wann(a) - wann(b)) || (meterVonMir(a) - meterVonMir(b)));
    }
    else l.sort((a, b) => meterVonMir(a) - meterVonMir(b));
    return l;
  }
  function statusPill(g) {
    if (g.eigen) {
      if (abgelaufen(g)) return `<span class="pill pill-warn">Abgelaufen</span>`;
      if (g.status === 'offen') return `<span class="pill pill-muted">Sichtbar für Nachbarn</span>`;
      if (g.status === 'zugesagt') return `<span class="pill pill-info">${esc(vorname(g.helferName)) || 'Jemand'} hilft</span>`;
      if (g.status === 'erledigt') return `<span class="pill pill-warn">Bitte bestätigen</span>`;
      if (g.status === 'bezahlt') return `<span class="pill pill-good">${icon('check', 'i-xs')} Abgeschlossen</span>`;
    }
    if (g.status === 'zugesagt') return `<span class="pill pill-info">Zugesagt</span>`;
    if (g.status === 'erledigt') return `<span class="pill pill-warn">Wartet auf Bestätigung</span>`;
    if (g.status === 'bezahlt') return `<span class="pill pill-good">${icon('check', 'i-xs')} ${CONFIG.gebuehren && !istLive() ? 'Ausgezahlt' : 'Bestätigt'}</span>`;
    return '';
  }
  function fehlerText(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || '';
    if (/failed to fetch|network|load failed/i.test(m)) return 'Keine Verbindung. Prüfe dein Internet und versuch es noch einmal.';
    if (/invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der E-Mail.';
    if (/already registered|already been registered/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.';
    if (/password should be at least|weak password/i.test(m)) return 'Das Passwort ist zu kurz oder zu einfach. Nimm mindestens 8 Zeichen.';
    if (/email address not authorized|email_address_not_authorized/i.test(m)) return 'Die Registrierung ist gerade nur für das Test-Team freigeschaltet. Bitte versuch es bald noch einmal.';
    if (/email rate limit/i.test(m)) return 'Gerade wurden zu viele Bestätigungs-E-Mails verschickt. Bitte versuch es in einer Stunde noch einmal.';
    if (/signups not allowed for otp|otp_disabled/i.test(m)) return 'Zu dieser E-Mail gibt es noch kein Konto. Tippe oben auf „Neu registrieren“.';
    if (/token has expired or is invalid|otp_expired|invalid otp/i.test(m)) return 'Der Code stimmt nicht oder ist abgelaufen. Lass dir einen neuen schicken.';
    if (/for security purposes|only request this after/i.test(m)) return 'Bitte warte eine Minute, bevor du einen neuen Code anforderst.';
    if (/signups? not allowed|signup is disabled/i.test(m)) return 'Neue Registrierungen sind gerade geschlossen.';
    if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche. Warte ein paar Minuten.';
    if (/jwt|permission denied/i.test(m)) return 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.';
    return m || 'Etwas ist schiefgelaufen. Versuch es noch einmal.';
  }

  let toastTimer;
  function meldung(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('zeigen');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('zeigen'), 3200);
  }

  /* ===== Live: Verbindung, Anmeldung, Laden ===== */
  function ladeSkript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Skript nicht geladen'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('Zeitüberschreitung')), 15000);
    });
  }

  async function starteLive() {
    if (VORSCHAU || BEISPIEL_MODUS || !LIVE.url || !LIVE.key) return false;
    try {
      if (!(window.supabase && window.supabase.createClient)) await ladeSkript(SUPABASE_JS);
      db.client = window.supabase.createClient(LIVE.url, LIVE.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    } catch (e) {
      db.liveAus = true;
      gesuche = demoLaden();
      renderAlles();
      seiteZeigen();
      meldung('Die Datenbank ist gerade nicht erreichbar. Du siehst die Demo.');
      return false;
    }
    db.modus = 'live';
    gesuche = [];
    renderAlles();
    seiteZeigen();
    const { data } = await db.client.auth.getSession();
    await setzeSitzung(data && data.session, true);
    db.client.auth.onAuthStateChange((event, session) => {
      // Supabase empfiehlt, hier nicht direkt weitere Anfragen abzuwarten
      setTimeout(() => setzeSitzung(session, false), 0);
    });
    db.client.channel('gesuche-aenderungen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gesuche' }, () => bald(neuLaden))
      .subscribe();
    db.client.channel('nachrichten-neu')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nachrichten' }, (p) => neueNachricht(p.new))
      .subscribe();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) bald(neuLaden); });
    return true;
  }

  let baldTimer;
  function bald(fn) { clearTimeout(baldTimer); baldTimer = setTimeout(fn, 400); }

  async function setzeSitzung(session, erzwingen) {
    const uid = session && session.user ? session.user.id : null;
    const bisher = db.user ? db.user.id : null;
    if (!erzwingen && uid === bisher) return;
    db.user = session ? session.user : null;
    db.profil = null;
    db.bewertungen.clear();
    db.adressen.clear();
    db.telefone.clear();
    db.nachrichten.clear();
    db.letzte.clear();
    db.gemeldet.clear();
    db.blockiert.clear();
    if (uid) {
      const { data } = await db.client.from('profile').select('*').eq('id', uid).maybeSingle();
      db.profil = data || null;
      // Mit Update Teil 9 hat das Profil „Über mich“, Bild usw.
      if (data) { db.teil9 = 'bio' in data; db.bilder.set(uid, data.bild || ''); }
      // Rasterpunkt des eigenen Orts (erst mit Update Teil 7; davor zählt der Stadtteil von Garbsen)
      db.wohnort = null;
      if (db.profil) {
        const w = await db.client.rpc('mein_ort');
        const z = !w.error && w.data && (Array.isArray(w.data) ? w.data[0] : w.data);
        if (z && typeof z.lat === 'number' && typeof z.lng === 'number') db.wohnort = { lat: z.lat, lng: z.lng, umkreis: z.umkreis_km || 5 };
      }
    }
    if (ui.panel === 'anmelden' && db.profil) {
      schliessen();
      meldung(`Willkommen, ${db.profil.vorname}!`);
    }
    renderStadtteilAuswahl();
    renderKosten();
    await neuLaden();
    pushAuffrischen();
  }

  // * statt einzelner Spalten: funktioniert mit und ohne die Spalten bis/laeuft_ab (Datenbank-Update vom November 2026)
  const GESUCH_FELDER = '*, ' +
    'ersteller_profil:profile!gesuche_ersteller_fkey(vorname, nachname_initial, sterne_summe, sterne_anzahl), ' +
    'helfer_profil:profile!gesuche_helfer_fkey(vorname, nachname_initial)';

  function ausDb(r) {
    const ich = db.user ? db.user.id : null;
    const p = r.ersteller_profil || null;
    return {
      id: r.id, kat: r.kategorie, titel: r.titel, text: r.beschreibung || '', betrag: r.betrag, wann: r.wann, dauer: r.dauer,
      stadtteil: r.stadtteil, lat: r.lat, lng: r.lng,
      status: r.status === 'bestaetigt' ? 'bezahlt' : r.status,
      erstellt: Date.parse(r.erstellt) || 0,
      bis: r.bis || null,
      fuer: r.fuer || '', tuercode: r.tuercode || '',
      laeuftAb: r.laeuft_ab ? Date.parse(r.laeuft_ab) || 0 : 0,
      eigen: !!ich && r.ersteller === ich,
      helfer: ich && r.helfer === ich ? 'ich' : (r.helfer ? 'andere' : null),
      erstellerId: r.ersteller, helferId: r.helfer || null,
      wer: anzeigename(p), initialen: kuerzel(p),
      sterne: p && p.sterne_anzahl ? p.sterne_summe / p.sterne_anzahl : null,
      bewertungen: p ? p.sterne_anzahl : 0,
      helferName: r.helfer_profil ? anzeigename(r.helfer_profil) : '',
      meineBewertung: (db.bewertungen.get(r.id) || {}).sterne || 0,
      meinText: (db.bewertungen.get(r.id) || {}).text || '',
      bewertungSichtbar: !!(db.bewertungen.get(r.id) || {}).sichtbar,
      bewertetAm: (db.bewertungen.get(r.id) || {}).erstellt || null
    };
  }

  // Anfragen im sichtbaren Ausschnitt der Karte nachladen (wer herauszoomt oder woandershin schiebt).
  // Schon geladene Bereiche werden nicht noch einmal abgefragt.
  let ausschnittLaeuft = false;
  async function ausschnittLaden() {
    const k = kartenStatus, b = k.blick;
    if (!istLive() || !db.client || !b || !k.w || ausschnittLaeuft || ui.view !== 'karte') return;
    const lngVon = (x) => (x + NULLPUNKT.x) / ERDE * 180 / Math.PI;
    const rand = 0.2;
    const x0 = -b.x / b.s, x1 = (k.w - b.x) / b.s, y0 = -b.y / b.s, y1 = (k.h - b.y) / b.s;
    const box = {
      latMin: Math.max(47, breiteVon(y1 + (y1 - y0) * rand)), latMax: Math.min(55.2, breiteVon(y0 - (y1 - y0) * rand)),
      lngMin: Math.max(5.5, lngVon(x0 - (x1 - x0) * rand)), lngMax: Math.min(15.5, lngVon(x1 + (x1 - x0) * rand))
    };
    if (box.latMin >= box.latMax || box.lngMin >= box.lngMax) return;
    const drin = (a) => a.latMin <= box.latMin && a.latMax >= box.latMax && a.lngMin <= box.lngMin && a.lngMax >= box.lngMax;
    if ((db.geladeneBereiche || []).some(drin)) return;
    ausschnittLaeuft = true;
    try {
      const { data, error } = await db.client.from('gesuche').select(GESUCH_FELDER).eq('status', 'offen')
        .gte('lat', box.latMin).lte('lat', box.latMax).gte('lng', box.lngMin).lte('lng', box.lngMax)
        .order('erstellt', { ascending: false }).limit(500);
      if (error || !data) return;
      (db.geladeneBereiche = db.geladeneBereiche || []).push(box);
      const da = new Set(gesuche.map((g) => g.id));
      const neu = data.filter((r) => !da.has(r.id)).map(ausDb);
      if (neu.length) { gesuche = gesuche.concat(neu); renderKarte(); }
    } catch (e) { /* ohne Netz: beim nächsten Verschieben noch einmal */ } finally { ausschnittLaeuft = false; }
  }

  async function neuLaden() {
    if (!istLive()) return;
    db.laedt = true;
    try {
      // Anfragen bis etwa 50 km um den eigenen Ort, dazu alle eigenen und zugesagten
      const o = meinOrt();
      const nah = await db.client.from('gesuche').select(GESUCH_FELDER).neq('status', 'zurueckgezogen')
        .gte('lat', o.lat - 0.45).lte('lat', o.lat + 0.45).gte('lng', o.lng - 0.75).lte('lng', o.lng + 0.75)
        .order('erstellt', { ascending: false }).limit(400);
      if (nah.error) throw nah.error;
      let data = nah.data || [];
      db.geladeneBereiche = [{ latMin: o.lat - 0.45, latMax: o.lat + 0.45, lngMin: o.lng - 0.75, lngMax: o.lng + 0.75 }];
      if (db.user) {
        const eigene = await db.client.from('gesuche').select(GESUCH_FELDER).neq('status', 'zurueckgezogen')
          .or(`ersteller.eq.${db.user.id},helfer.eq.${db.user.id}`).order('erstellt', { ascending: false }).limit(100);
        if (!eigene.error && eigene.data) {
          const da = new Set(data.map((r) => r.id));
          data = data.concat(eigene.data.filter((r) => !da.has(r.id)));
        }
      }
      if (db.user) {
        if (db.profil) {
          const pr = await db.client.from('profile').select('hilfen_anzahl, gesuche_anzahl, sterne_summe, sterne_anzahl').eq('id', db.user.id).maybeSingle();
          if (!pr.error && pr.data) Object.assign(db.profil, pr.data);
        }
        const bl = await db.client.from('blockiert').select('wen, profil:profile!blockiert_wen_fkey(vorname, nachname_initial)').eq('von', db.user.id);
        if (!bl.error && bl.data) { db.blockiert.clear(); bl.data.forEach((x) => db.blockiert.set(x.wen, anzeigename(x.profil))); }
        // Eigene Bewertungen: Sterne, Text und ob sie schon erschienen sind (ohne Update Teil 8 nur Sterne)
        let b = await db.client.from('bewertungen').select('gesuch_id, sterne, text, sichtbar, erstellt').eq('von', db.user.id);
        if (b.error) { b = await db.client.from('bewertungen').select('gesuch_id, sterne').eq('von', db.user.id); if (!b.error) db.teil8 = false; }
        if (!b.error && b.data) b.data.forEach((x) => db.bewertungen.set(x.gesuch_id, { sterne: x.sterne, text: x.text || '', sichtbar: x.sichtbar !== false, erstellt: x.erstellt || null }));
        const n = await db.client.from('nachrichten').select('gesuch_id, erstellt')
          .neq('von', db.user.id).order('erstellt', { ascending: false }).limit(300);
        if (!n.error && n.data) {
          db.letzte.clear();
          n.data.forEach((x) => { const t = Date.parse(x.erstellt) || 0; if (t > (db.letzte.get(x.gesuch_id) || 0)) db.letzte.set(x.gesuch_id, t); });
        }
      }
      const vorher = new Map(gesuche.map((g) => [g.id, g.status]));
      gesuche = (data || []).map(ausDb);
      // Wer geholfen hat, sieht den Handschlag, sobald die Bestätigung eintrifft
      if (db.geladen) {
        const bestaetigt = gesuche.find((g) => g.helfer === 'ich' && g.status === 'bezahlt' && vorher.get(g.id) === 'erledigt');
        if (bestaetigt) setTimeout(() => feiern('Hand drauf!', feierText(bestaetigt)), 0);
      }
      // Nach einer zurückgezogenen Zusage ist der alte Verlauf gelöscht
      gesuche.forEach((g) => { if (g.status === 'offen') db.nachrichten.delete(g.id); });
      db.fehler = null;
      db.geladen = true;
      db.geladenUm = Date.now();
      bilderLaden(gesuche.map((g) => g.erstellerId).concat(gesuche.map((g) => g.helferId)));
    } catch (e) {
      db.fehler = fehlerText(e);
    } finally {
      db.laedt = false;
    }
    if (ui.offen && !gesuche.some((g) => g.id === ui.offen)) {
      schliessen();
      meldung('Diese Anfrage ist nicht mehr verfügbar.');
    }
    renderAlles();
    const wartet = linkId(location.hash.slice(1));
    if (wartet && db.geladen && ui.offen !== wartet && !ui.panel) gesuchAusLink(wartet);
  }

  async function ladeAdresse(id) {
    if (db.adressen.has(id)) return;
    db.adressen.set(id, null); // wird geladen
    // * statt einzelner Spalten: funktioniert auch mit einer Datenbank ohne die Spalte telefon
    const { data } = await db.client.from('gesuch_adressen').select('*').eq('gesuch_id', id).maybeSingle();
    db.adressen.set(id, data ? data.adresse : '');
    db.telefone.set(id, (data && data.telefon) || '');
    if (ui.offen === id) renderSheet();
  }
  const adresseVon = (g) => istLive() ? db.adressen.get(g.id) : g.adresse;
  const telefonVon = (g) => (istLive() ? db.telefone.get(g.id) : g.telefon) || '';
  const telLink = (nr) => 'tel:' + String(nr).replace(/[^0-9+]/g, '');

  /* ===== Nachrichten zwischen den Beteiligten ===== */
  const GELESEN_SPEICHER = 'handdrauf-gelesen';
  let gelesen = {};
  try { gelesen = JSON.parse(localStorage.getItem(GELESEN_SPEICHER) || '{}') || {}; } catch (e) { gelesen = {}; }
  const imChat = (g) => g.status !== 'offen' && (g.helfer === 'ich' || (g.eigen && !!g.helfer));
  const nachrichtenVon = (g) => istLive() ? (db.nachrichten.has(g.id) ? db.nachrichten.get(g.id) : null) : (g.nachrichten || []);
  function letzteFremde(g) {
    if (istLive()) return db.letzte.get(g.id) || 0;
    return (g.nachrichten || []).reduce((m, n) => (n.von === 'ich' ? m : Math.max(m, n.zeit)), 0);
  }
  const ungelesen = (g) => imChat(g) && letzteFremde(g) > (gelesen[g.id] || 0);
  function alsGelesen(g) {
    const t = letzteFremde(g);
    if (!t || t <= (gelesen[g.id] || 0)) return;
    gelesen[g.id] = t;
    try { localStorage.setItem(GELESEN_SPEICHER, JSON.stringify(gelesen)); } catch (e) { /* nur für diese Sitzung */ }
    renderAuftraege();
  }
  function zeitText(ms) {
    const d = new Date(ms);
    const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const tage = Math.round((new Date(new Date().toDateString()) - new Date(d.toDateString())) / 86400000);
    if (tage === 0) return uhr;
    if (tage === 1) return `gestern, ${uhr}`;
    return `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}, ${uhr}`;
  }
  const nachrichtAusDb = (r) => ({ id: r.id, von: db.user && r.von === db.user.id ? 'ich' : 'sie', text: r.text, zeit: Date.parse(r.erstellt) || Date.now() });
  async function ladeNachrichten(id) {
    if (!istLive() || !db.user || db.nachrichten.has(id)) return;
    db.nachrichten.set(id, null);
    const { data, error } = await db.client.from('nachrichten').select('id, gesuch_id, von, text, erstellt')
      .eq('gesuch_id', id).order('erstellt', { ascending: true }).limit(300);
    if (error) meldung(fehlerText(error));
    db.nachrichten.set(id, (data || []).map(nachrichtAusDb));
    if (ui.offen === id) aktualisiereChat();
  }
  function neueNachricht(r) { // aus der Live-Aktualisierung
    if (!r || !db.user) return;
    const liste = db.nachrichten.get(r.gesuch_id);
    if (Array.isArray(liste) && !liste.some((n) => n.id === r.id)) liste.push(nachrichtAusDb(r));
    if (r.von !== db.user.id) {
      db.letzte.set(r.gesuch_id, Math.max(db.letzte.get(r.gesuch_id) || 0, Date.parse(r.erstellt) || Date.now()));
      const g = gesuche.find((x) => x.id === r.gesuch_id);
      if (g && ui.offen !== g.id) meldung(`Neue Nachricht zu „${g.titel}“`);
    }
    if (ui.offen === r.gesuch_id) aktualisiereChat(); else renderAuftraege();
  }
  const DEMO_ANTWORTEN = ['Alles klar, danke dir!', 'Passt gut. Bis dann!', 'Super, dann machen wir das so.', 'Danke! Klingel einfach, wenn du da bist.'];
  function demoNachricht(id, text, verzoegerung) {
    setTimeout(() => {
      const g = gesuche.find((x) => x.id === id);
      if (istLive() || !g || g.helfer !== 'ich' || g.status === 'offen') return;
      g.nachrichten = g.nachrichten || [];
      g.nachrichten.push({ von: 'sie', text, zeit: Date.now() });
      demoSpeichern();
      if (ui.offen === id) aktualisiereChat();
      else { renderAuftraege(); meldung(`Neue Nachricht von ${vorname(g.wer)}`); }
    }, verzoegerung);
  }
  async function sendeNachricht(g, text) {
    if (istLive()) {
      const { data, error } = await db.client.rpc('nachricht_senden', { p_id: g.id, p_text: text });
      if (error) throw error;
      const liste = db.nachrichten.get(g.id);
      if (Array.isArray(liste) && !liste.some((n) => n.id === data)) liste.push({ id: data, von: 'ich', text, zeit: Date.now() });
      return;
    }
    g.nachrichten = g.nachrichten || [];
    g.nachrichten.push({ von: 'ich', text, zeit: Date.now() });
    demoSpeichern();
    const nr = g.nachrichten.filter((n) => n.von === 'ich').length;
    demoNachricht(g.id, DEMO_ANTWORTEN[(nr - 1) % DEMO_ANTWORTEN.length], 1800);
  }

  /* ===== Blockieren (App Store 1.2): Ihr seht euch gegenseitig nicht mehr, laufende Zusagen enden ===== */
  async function blockiere(id, name) {
    if (istLive()) {
      const { error } = await db.client.rpc('blockieren', { p_person: id });
      if (error) throw error;
      db.blockiert.set(id, name);
      await neuLaden();
      return;
    }
    if (!demoBlockiert.includes(name)) demoBlockiert.push(name);
    demoBlockSpeichern();
    gesuche.forEach((g) => { if (g.wer === name && g.helfer === 'ich' && g.status === 'zugesagt') { g.status = 'offen'; g.helfer = null; g.nachrichten = []; g.tuercode = ''; } });
    demoSpeichern();
  }
  async function entsperre(id) {
    if (istLive()) {
      const { error } = await db.client.rpc('entblocken', { p_person: id });
      if (error) throw error;
      db.blockiert.delete(id);
      await neuLaden();
      return;
    }
    demoBlockiert = demoBlockiert.filter((n) => n !== id);
    demoBlockSpeichern();
  }
  function blockListeHTML() {
    const liste = istLive() ? [...db.blockiert.entries()] : demoBlockiert.map((n) => [n, n]);
    if (!liste.length) return '';
    return `<section class="blockliste" aria-labelledby="h-blockliste"><h3 class="h-klein" id="h-blockliste">Blockiert</h3>
      ${liste.map(([id, name]) => `<div class="block-zeile"><span>${esc(name)}</span><button type="button" class="link-btn" data-entsperren="${esc(id)}">Entsperren</button></div>`).join('')}
      <p class="klein">Blockierte sehen deine Anfragen nicht, und du siehst ihre nicht.</p></section>`;
  }

  /* ===== Melden ===== */
  const MELDEGRUENDE = [['betrug', 'Betrug oder Abzocke'], ['unangemessen', 'Beleidigend oder unangemessen'], ['gefaehrlich', 'Gefährlich oder verboten'],
    ['schwarzarbeit', 'Eher ein regelmäßiger Job als Nachbarschaftshilfe'], ['anderes', 'Etwas anderes']];
  async function melde(g, grund, text) {
    if (istLive()) {
      const { error } = await db.client.rpc('melden', { p_id: g.id, p_grund: grund, p_text: text });
      if (error) throw error;
      db.gemeldet.add(g.id);
      return;
    }
    g.gemeldet = true;
    demoSpeichern();
  }

  // Statuswechsel: Live über Datenbankfunktionen, Demo direkt hier
  async function aendereStatus(g, aktion) {
    if (istLive()) {
      const rpc = { zusagen: 'gesuch_zusagen', absagen: 'gesuch_absagen', erledigt: 'gesuch_erledigt', bestaetigen: 'gesuch_bestaetigen', rueckzug: 'gesuch_zurueckziehen' }[aktion];
      const { error } = await db.client.rpc(rpc, { p_id: g.id });
      if (error) throw error;
      await neuLaden();
      return;
    }
    if (aktion === 'zusagen') { g.status = 'zugesagt'; g.helfer = 'ich'; g.nachrichten = []; g.tuercode = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); if (g.antwort) demoNachricht(g.id, g.antwort, 1500); }
    else if (aktion === 'absagen') { g.status = 'offen'; g.helfer = null; g.nachrichten = []; g.tuercode = ''; }
    else if (aktion === 'erledigt') g.status = 'erledigt';
    else if (aktion === 'bestaetigen') g.status = 'bezahlt';
    else if (aktion === 'rueckzug') gesuche = gesuche.filter((x) => x.id !== g.id);
    demoSpeichern();
  }

  // Bewerten mit Sternen und Text. Beide Bewertungen eines Auftrags erscheinen gleichzeitig (siehe Datenbank, Teil 8).
  async function bewerte(g, sterne, text) {
    if (istLive()) {
      let { data, error } = await db.client.rpc('bewerten', { p_id: g.id, p_sterne: sterne, p_text: text });
      let ohneText = false;
      if (error && (error.code === 'PGRST202' || error.code === '42883')) {
        // Datenbank ohne Update Teil 8: nur Sterne, die gleich zählen
        db.teil8 = false; ohneText = true;
        ({ data, error } = await db.client.rpc('bewerten', { p_id: g.id, p_sterne: sterne }));
      }
      if (error) throw error;
      if (!ohneText) db.teil8 = true;
      const alt = db.bewertungen.get(g.id);
      const neu = { sterne, text: ohneText ? '' : text, sichtbar: ohneText || data === true, erstellt: (alt && alt.erstellt) || new Date().toISOString() };
      db.bewertungen.set(g.id, neu);
      Object.assign(g, { meineBewertung: sterne, meinText: neu.text, bewertungSichtbar: neu.sichtbar, bewertetAm: neu.erstellt });
      // Profile neu laden: Schnitt und Bewertungen können sich geändert haben
      const person = anderePerson(g);
      [person && person.id, db.user && db.user.id].forEach((id) => { if (id) { db.profile.delete(id); db.rezensionen.delete(id); } });
      return { ohneText: ohneText && !!text };
    }
    if (!g.bewertetAm) g.bewertetAm = Date.now();
    g.meineBewertung = sterne;
    g.meinText = text;
    demoSpeichern();
    // Demo: Kurz darauf bewertet die andere Person dich auch, dann erscheinen beide Bewertungen
    if (!g.bewertungSichtbar && g.helfer === 'ich') {
      setTimeout(() => {
        if (!gesuche.includes(g) || g.bewertungSichtbar) return;
        const n = Number(String(g.id).replace(/\D/g, '')) || 0;
        g.ihreBewertung = { sterne: 5, text: DEMO_GEGENBEWERTUNGEN[n % DEMO_GEGENBEWERTUNGEN.length] };
        g.bewertungSichtbar = true;
        demoSpeichern();
        meldung(`${vorname(g.wer)} hat dich auch bewertet. Eure Bewertungen sind jetzt zu sehen.`);
        renderAlles();
        if (ui.offen === g.id || ui.panel === 'profil') renderSheet();
      }, 2500);
    }
    return {};
  }
  async function bewertungAbsenden() {
    const g = gesuche.find((x) => x.id === ui.offen);
    if (!g || !ui.bewertung || ui.bewertung.id !== g.id || !ui.bewertung.sterne) return;
    const feld = $('#bewertung-text');
    const text = feld ? feld.value.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    const fehler = $('#bewertung-fehler');
    const zeige = (t) => { fehler.textContent = t; fehler.hidden = false; if (feld) feld.focus(); };
    if (text && anstoessig(text)) { zeige('Bitte schreib sachlich. Beleidigende oder anstößige Wörter werden nicht veröffentlicht.'); return; }
    if (text && (/\d[\d\s/-]{6,}\d/.test(text) || /\S+@\S+\.\S+/.test(text))) { zeige('Bitte keine Telefonnummern oder E-Mail-Adressen in die Bewertung schreiben. Alle können sie lesen.'); return; }
    ui.bewertung.text = feld ? feld.value : '';
    ui.busy = true;
    renderSheet();
    try {
      const r = await bewerte(g, ui.bewertung.sterne, text);
      ui.bewertung = null;
      meldung(r.ohneText ? 'Deine Sterne sind gespeichert. Den Text kann die Datenbank erst nach dem nächsten Update speichern.'
        : g.bewertungSichtbar && db.teil8 !== false ? 'Danke! Eure Bewertungen sind jetzt zu sehen.' : 'Danke für deine Bewertung!');
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderAlles();
    if (ui.offen) renderSheet();
    const f = $('#sheet .bewerten-titel');
    if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  }
  async function rezMeldenAbsenden(form) {
    const b = (ui.profilListe || [])[Number(form.dataset.rez)];
    if (!b) return;
    const wahl = form.querySelector('input[name="rez-grund"]:checked');
    if (!wahl) {
      const f = $('#rez-melden-fehler');
      f.textContent = 'Bitte wähle einen Grund.';
      f.hidden = false;
      $('#rez-grund-unangemessen').focus();
      return;
    }
    const grund = REZ_GRUENDE.find((x) => x[0] === wahl.value);
    const zusatz = $('#rez-melden-text').value.trim().slice(0, 400);
    const text = (grund[2] === 'anderes' ? `[${grund[1]}] ` : '') + zusatz;
    ui.busy = true;
    renderSheet();
    try {
      if (istLive()) {
        const { error } = await db.client.rpc('bewertung_melden', { p_gesuch: b.gesuchId, p_von: b.vonKey, p_grund: grund[2], p_text: text });
        if (error) throw error;
      }
      db.rezGemeldet.add(rezSchluessel(b));
      ui.rezMelden = null;
      meldung('Danke für deine Meldung. Wir prüfen die Bewertung.');
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderSheet();
  }

  /* ===== Darstellung ===== */
  function chipsHTML() {
    return [{ id: 'alle', name: 'Alle' }, ...KATEGORIEN].map((k) =>
      `<button type="button" class="chip" data-kat="${k.id}" aria-pressed="${ui.kat === k.id}">${icon(k.id)}<span>${k.name}</span></button>`
    ).join('');
  }
  const zeilen = (liste) => `<div class="zeilen">${liste.join('')}</div>`;
  function karteHTML(g, extra = '') {
    return `<button type="button" class="card" data-id="${g.id}">
      <span class="ico">${icon(g.kat)}</span>
      <span class="card-main">
        <span class="card-title">${esc(g.titel)}</span>
        <span class="card-meta"><span class="card-wann">${esc(wannText(g))}</span> <span class="card-wer">${esc(g.eigen ? 'Deine Anfrage' : g.wer)}</span></span>
        <span class="card-ort"><span class="ortsschild">${esc(g.stadtteil)}</span><span>${distanz(g)}</span></span>
        ${extra}
      </span>
      <span class="abriss"><span class="price">${euroKurz(g.betrag)}</span></span>
    </button>`;
  }

  function renderKopf() {
    const el = $('#kopf-rechts');
    if (wartetAufLive()) el.innerHTML = '';
    else if (!istLive()) el.innerHTML = `<span class="pill pill-muted">${BEISPIEL_MODUS ? 'Beispiele' : 'Demo'}</span>`;
    else if (!db.profil) el.innerHTML = '<button type="button" class="btn btn-secondary btn-klein" data-panel="anmelden">Anmelden</button>';
    else el.innerHTML = `<button type="button" class="avatar-btn${meinBild() ? ' mit-bild' : ''}" data-panel="konto" aria-label="Dein Konto">${esc(kuerzel(db.profil))}${meinBild() ? `<img src="${esc(bildUrl(meinBild()))}" alt="" decoding="async">` : ''}</button>`;
    $('#reset-knopf').hidden = istLive();
    $('#adresse-optional').hidden = istLive();
  }

  function renderChips() {
    $('#chips-liste').innerHTML = chipsHTML();
    $('#chips-karte').innerHTML = chipsHTML();
  }

  try { const u = Number(localStorage.getItem(UMKREIS_SPEICHER)); if (UMKREISE.indexOf(u) >= 0) ui.umkreis = u; } catch (e) { /* Standard: 10 km */ }
  // Ort und Umkreis oben in der Liste, dazu der Ort im Formular „Hilfe suchen“ (solange dort niemand etwas geändert hat)
  function renderOrtAuswahl() {
    $('#umkreis').innerHTML = UMKREISE.map((km) => `<option value="${km}" ${ui.umkreis === km ? 'selected' : ''}>bis ${km} km</option>`).join('');
    const ort = meinOrt();
    $('#ort-knopf-name').textContent = zeigeIch() ? ort.stadtteil : 'Ort wählen';
    const feld = $('#neu-stadtteil');
    if (feld && !ui.bearbeiten && document.activeElement !== feld && (!feld.value || feld.dataset.auto === '1')) {
      ortSetzenIn(feld, { name: ort.stadtteil, lat: ort.lat, lng: ort.lng });
      feld.dataset.auto = '1';
    }
  }
  const renderStadtteilAuswahl = renderOrtAuswahl;
  // Neuer Ort: speichern (im Konto oder auf dem Gerät), Anfragen in der Nähe laden, Karte darauf ausrichten
  async function ortUebernehmen(o) {
    const ort = ortPruefen(o);
    if (!ort) return false;
    if (istLive() && db.profil) {
      const punkt = rasterpunkt(ort);
      const r = await db.client.rpc('ort_setzen', { p_name: ort.name, p_lat: punkt.lat, p_lng: punkt.lng });
      if (r.error) {
        const fehlt = r.error.code === 'PGRST202' || /could not find the function/i.test(r.error.message || '');
        if (!fehlt) { meldung(fehlerText(r.error)); return false; }
        // Datenbank ohne Update Teil 7: nur die Stadtteile von Garbsen
        if (!STADTTEILE.some((x) => x.name === ort.name)) { meldung('Orte außerhalb von Garbsen gehen erst nach dem nächsten Datenbank-Update.'); return false; }
        const { error } = await db.client.from('profile').update({ stadtteil: ort.name }).eq('id', db.profil.id);
        if (error) { meldung(fehlerText(error)); return false; }
      } else {
        db.wohnort = { lat: punkt.lat, lng: punkt.lng, umkreis: db.wohnort ? db.wohnort.umkreis : 5 };
      }
      db.profil.stadtteil = ort.name;
    }
    ortWaehlen(ort);
    const feld = $('#neu-stadtteil');
    if (feld) feld.dataset.auto = '1', feld.value = '';
    renderOrtAuswahl();
    if (istLive()) await neuLaden();
    kartenStatus.bewegt = false;
    if (kartenStatus.blick) blickSetzen(blickAufAlles(), false);
    renderAlles();
    return true;
  }

  function renderListe() {
    const offene = gesuche.filter((g) => !g.eigen && g.status === 'offen' && !abgelaufen(g) && !versteckt(g));
    const ort = meinOrt();
    $('#h-entdecken').textContent = istLive() || wartetAufLive() ? (db.profil ? `Hallo ${db.profil.vorname}` : 'Hilfe in deiner Nähe') : 'Hallo Tim';
    $('#datum').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const nah = offene.filter((g) => meterVonMir(g) <= ui.umkreis * 1000);
    const laedt = (istLive() && !db.geladen) || wartetAufLive();
    $('#anzahl-text').textContent = laedt
      ? (db.fehler ? `Hilfe bis ${ui.umkreis} km um ${ort.stadtteil}` : `Anfragen bis ${ui.umkreis} km um ${ort.stadtteil} werden geladen …`)
      : `${nah.length} ${nah.length === 1 ? 'Nachbar sucht' : 'Nachbarn suchen'} gerade Hilfe, bis ${ui.umkreis} km um ${ort.stadtteil}`;

    if (laedt) {
      ui.umgebungListe = [];
      umgebungZeichnen();
      $('#liste').innerHTML = db.fehler
        ? `<div class="leer"><p><strong>Die Anfragen konnten nicht geladen werden.</strong></p><p>${esc(db.fehler)}</p><button type="button" class="btn btn-secondary btn-auto" data-neu-laden>Erneut versuchen</button></div>`
        : '<p class="sr-only" role="status">Anfragen werden geladen …</p>' + '<div class="card skelett" aria-hidden="true"><span class="ico"></span><span class="card-main"><i></i><i></i><i></i></span><span class="abriss"><span class="skelett-preis"></span></span></div>'.repeat(3);
      return;
    }
    const treffer = sortiere(offene.filter((g) => passt(g) && meterVonMir(g) <= ui.umkreis * 1000));
    ui.umgebungListe = treffer;
    umgebungZeichnen();
    if (!treffer.length) {
      const q = ui.suche.trim();
      const wo = ` im Umkreis von ${ui.umkreis} km`;
      if (istLive() && !offene.length) {
        // Neue Plattform, noch leer: erklären, Anfang machen lassen, Beispiele zeigen (statt einer leeren Seite)
        const eigenesOffen = gesuche.some((g) => g.eigen && g.status === 'offen' && !abgelaufen(g));
        $('#liste').innerHTML = `<div class="leer leer-start">
          <p><strong>${eigenesOffen ? 'Deine Anfrage ist online.' : 'Hand Drauf startet gerade in deiner Gegend.'}</strong></p>
          <p>${eigenesOffen ? 'Außer dir sucht gerade niemand Hilfe. Je mehr Nachbarn mitmachen, desto schneller sagt jemand zu.' : 'Noch sucht niemand Hilfe. Mach den Anfang mit einer eigenen Anfrage oder schau dir an, wie es aussieht, wenn Nachbarn mitmachen.'}</p>
          <div class="leer-knoepfe">
            ${eigenesOffen ? '<button type="button" class="btn btn-primary btn-auto" data-einladen>Nachbarn einladen</button>' : '<button type="button" class="btn btn-primary btn-auto" data-go="neu">Anfrage erstellen</button>'}
            <a class="btn btn-secondary btn-auto" href="?beispiele#entdecken">Beispiele ansehen</a>
          </div>
        </div>`;
        return;
      }
      $('#liste').innerHTML = `<div class="leer">
        <p><strong>Nichts gefunden${q ? ` für „${esc(q)}“` : ''}${wo}.</strong></p>
        <p>Probier eine andere Tätigkeit, einen größeren Umkreis oder einen anderen Ort. Oder such selbst Hilfe.</p>
        <button type="button" class="btn btn-secondary btn-auto" data-go="neu">Anfrage erstellen</button>
      </div>`;
      return;
    }
    if (ui.sort !== 'termin') { $('#liste').innerHTML = zeilen(treffer.map((g) => karteHTML(g))); return; }
    // Nach Termin: Abschnitte Heute, Morgen, Diese Woche, Später, darin die nächsten zuerst
    const gruppen = new Map(TERMIN_GRUPPEN.map((n) => [n, []]));
    treffer.forEach((g) => gruppen.get(terminGruppe(g)).push(g));
    $('#liste').innerHTML = [...gruppen].filter(([, l]) => l.length).map(([name, l]) =>
      `<h2 class="liste-gruppe">${name}</h2>${zeilen(l.sort((a, b) => (terminWert(a) - terminWert(b)) || (meterVonMir(a) - meterVonMir(b))).map((g) => karteHTML(g)))}`).join('');
  }
  const TERMIN_GRUPPEN = ['Heute', 'Morgen', 'Diese Woche', 'Später', 'Ohne festen Termin'];
  const terminWert = (g) => { const t = terminAusText(g.wann); return t ? +t.von : Infinity; };
  function terminGruppe(g) {
    const t = terminAusText(g.wann);
    if (!t) return 'Ohne festen Termin';
    const h = heute();
    const wochenende = plusTage(h, (7 - h.getDay()) % 7); // Sonntag dieser Woche
    if (+t.von === +t.bis) {
      const tage = Math.round((t.von - h) / TAG_MS);
      if (tage <= 0) return 'Heute';
      if (tage === 1) return 'Morgen';
    }
    return t.bis <= wochenende ? 'Diese Woche' : 'Später';
  }

  function naechsteSchritte() {
    const liste = [];
    gesuche.forEach((g) => {
      const wer = g.eigen ? (vorname(g.helferName) || 'Die helfende Person') : vorname(g.wer);
      let a = null;
      if (g.eigen && g.status === 'erledigt') a = { prio: 1, titel: 'Bitte bestätigen', text: `${wer} hat „${g.titel}“ als erledigt gemeldet.` };
      else if (ungelesen(g)) a = { prio: 2, titel: 'Neue Nachricht', text: `${wer} hat dir zu „${g.titel}“ geschrieben.` };
      else if (g.helfer === 'ich' && g.status === 'zugesagt') {
        const tag = relativerTag(g);
        a = { prio: 3, titel: tag ? `${tag} hilfst du` : 'Du hilfst', text: `„${g.titel}“ bei ${wer}, ${wannText(g)}. Danach als erledigt melden.` };
      }
      // Wer Hilfe bekommt, sieht am Tag vorher und am Tag selbst, wer kommt
      else if (g.eigen && g.status === 'zugesagt' && relativerTag(g)) a = { prio: 3, titel: `${relativerTag(g)} kommt ${wer}`, text: `„${g.titel}“, ${wannText(g)}. Frag an der Tür nach dem Sicherheits-Code.` };
      else if (g.status === 'bezahlt' && !g.meineBewertung && (g.helfer === 'ich' || (g.eigen && g.helferName))) a = { prio: 4, titel: 'Bewerten', text: `Wie war es mit ${wer}?` };
      else if (g.eigen && abgelaufen(g)) a = { prio: 5, titel: 'Abgelaufen', text: `„${g.titel}“ sieht gerade niemand. Wähle einen neuen Termin.` };
      if (a) liste.push({ ...a, g });
    });
    return liste.sort((x, y) => x.prio - y.prio);
  }
  // Zahl im Tab-Titel und am App-Symbol (installierte App): nur Dinge, bei denen du etwas tun solltest
  const SEITENTITEL = document.title || 'Hand Drauf';
  let letzteZahl = -1;
  function renderZaehler(liste) {
    const n = liste.filter((a) => a.prio !== 3).length;
    if (n === letzteZahl) return;
    letzteZahl = n;
    if (!VORSCHAU) document.title = n ? `(${n}) ${SEITENTITEL}` : SEITENTITEL;
    try {
      const p = n ? (navigator.setAppBadge && navigator.setAppBadge(n)) : (navigator.clearAppBadge && navigator.clearAppBadge());
      if (p && p.catch) p.catch(() => { /* ohne Zahl am Symbol */ });
    } catch (e) { /* ohne Zahl am Symbol */ }
  }
  function renderNaechstes() {
    const liste = istLive() && !db.profil ? [] : naechsteSchritte();
    renderZaehler(liste);
    $('#naechstes').innerHTML = liste.length ? `<section class="naechstes" aria-labelledby="h-naechstes">
        <h2 class="h-klein" id="h-naechstes">Als Nächstes</h2>
        ${liste.map((a) => `<button type="button" class="aufgabe ${a.prio === 1 ? 'aufgabe-wichtig' : ''}" data-oeffne="${a.g.id}">
          <span class="ico">${icon(a.g.kat)}</span>
          <span class="aufgabe-text"><strong>${esc(a.titel)}</strong><span>${esc(a.text)}</span></span>
          <span class="aufgabe-pfeil" aria-hidden="true">›</span>
        </button>`).join('')}
      </section>` : '';
    const erstes = liste[0];
    $('#banner-naechstes').innerHTML = erstes ? `<button type="button" class="banner" data-oeffne="${erstes.g.id}">
        <span class="banner-punkt" aria-hidden="true"></span>
        <span><strong>${esc(erstes.titel)}:</strong> ${esc(erstes.text)}${liste.length > 1 ? ` <span class="banner-mehr">und ${liste.length - 1} weitere${liste.length === 2 ? 's' : ''}</span>` : ''}</span>
      </button>` : '';
  }

  function renderAuftraege() {
    renderNaechstes();
    const neu = gesuche.filter(ungelesen).length;
    $('#tab-punkt').hidden = !neu;
    $('#tab-punkt-text').textContent = neu ? `, ${neu} ${neu === 1 ? 'neue Nachricht' : 'neue Nachrichten'}` : '';
    const pills = (g) => `<span class="card-pills">${statusPill(g)}${ungelesen(g) ? '<span class="pill pill-neu">Neue Nachricht</span>' : ''}</span>`;
    const abschnitte = document.querySelectorAll('#view-auftraege .abschnitt');
    if (istLive() && !db.profil) {
      $('#bilanz').hidden = true;
      $('#summe').hidden = false;
      $('#summe').innerHTML = `<span class="h-klein">Deine Aufträge</span>
        <p>Melde dich an, um deine Anfragen und Zusagen zu sehen.</p>
        <button type="button" class="btn btn-primary" data-panel="anmelden">Anmelden oder registrieren</button>`;
      abschnitte.forEach((a) => { a.hidden = true; });
      return;
    }
    abschnitte.forEach((a) => { a.hidden = false; });
    const zusagen = gesuche.filter((g) => g.helfer === 'ich');
    const eigene = gesuche.filter((g) => g.eigen);
    // Eigene Bilanz: wie oft geholfen und Hilfe bekommen (bestätigte Aufträge)
    const geholfen = istLive() ? ((db.profil && db.profil.hilfen_anzahl) || 0) : zusagen.filter((g) => g.status === 'bezahlt').length;
    const bekommen = istLive() ? ((db.profil && db.profil.gesuche_anzahl) || 0) : eigene.filter((g) => g.status === 'bezahlt').length;
    const bilanz = $('#bilanz');
    bilanz.hidden = !geholfen && !bekommen;
    bilanz.innerHTML = bilanz.hidden ? '' : `${icon('herz', 'i-sm')}<span>${[geholfen ? `Du hast ${geholfen}× geholfen` : '', bekommen ? `${geholfen ? '' : 'Du hast '}${bekommen}× Hilfe bekommen` : ''].filter(Boolean).join(' und ')}. Danke!</span>`;
    const verdient = zusagen.filter((g) => g.status === 'bezahlt').reduce((s, g) => s + auszahlung(g), 0);
    const anteil = Math.min(100, verdient / CONFIG.freigrenze * 100);
    const rest = Math.max(0, CONFIG.freigrenze - verdient);
    // Geldübersicht erst zeigen, wenn es Zusagen gibt
    $('#summe').hidden = !zusagen.length;
    $('#summe').innerHTML = `
      <span class="h-klein">Bekommen (bestätigt)</span>
      <span class="summe-zahl">${euro(verdient)}</span>
      <div class="meter" role="img" aria-label="${euro(verdient)} von ${euro(CONFIG.freigrenze)} steuerfreiem Betrag"><span style="width:${anteil.toFixed(1)}%"></span></div>
      <span class="summe-hint">Steuerfrei bis ${CONFIG.freigrenze} € im Jahr, noch ${euro(rest)} frei.</span>`;
    $('#zusagen').innerHTML = zusagen.length
      ? zeilen(zusagen.map((g) => karteHTML(g, pills(g))))
      : `<div class="leer-klein"><p>Noch keine Zusagen. Schau, wer in deiner Nähe Hilfe sucht.</p><button type="button" class="btn btn-secondary btn-auto" data-go="entdecken">Anfragen ansehen</button></div>`;
    $('#eigene').innerHTML = eigene.length
      ? zeilen(eigene.map((g) => karteHTML(g, pills(g))))
      : `<div class="leer-klein"><p>Noch keine Anfragen. Brauchst du selbst Hilfe?</p><button type="button" class="btn btn-secondary btn-auto" data-go="neu">Hilfe suchen</button></div>`;
  }

  /* ===== Karte: eigene, schlanke Karte (ohne Kartenbibliothek) =====
     Unten liegt die Straßenkarte (von der App selbst gezeichnet) oder das Luftbild, darüber Namen und Preisschilder.
     Liegen Schilder dicht beieinander, steht dort eine Zahl; Antippen zoomt hinein.
     Sind keine Kartenbilder erreichbar (offline, Vorschau), zeichnet die App die Stadtteile vereinfacht selbst.
     Nur 2D-Verschiebungen und einfache Bilder, damit es auch auf älteren Handys flüssig läuft. */
  const KARTE = {
    mitte: { lat: 52.44, lng: 9.575 },
    zoomMin: 5,        // so weit lässt sich herauszoomen (ganz Deutschland)
    zoomMax: 18,       // so nah lässt sich mit Kartenbildern heranzoomen (einzelne Häuser)
    zoomMaxOhne: 15.4, // so nah ohne Kartenbilder (dann gibt es nichts weiter zu sehen)
    flaeche: 1.7,      // vereinfachte Zeichnung: Fläche eines Stadtteils, so viel größer als der Radius in STADTTEILE
    stadt: 1.9,        // vereinfachte Zeichnung: so weit reicht die helle Fläche um jeden Stadtteil
    luecke: 34,        // vereinfachte Zeichnung: Meter Abstand zwischen benachbarten Stadtteilen
    sockel: 5          // vereinfachte Zeichnung: Bildpunkte „Dicke“ der Stadtteil-Platten
  };
  // Web-Mercator wie bei allen Online-Karten. Einheit: Mercator-Meter, Nullpunkt in der Mitte von Garbsen.
  const ERDE = 6378137, WELT = 2 * Math.PI * ERDE;
  const mercator = (lat, lng) => ({ x: ERDE * lng * Math.PI / 180, y: -ERDE * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) });
  const NULLPUNKT = mercator(KARTE.mitte.lat, KARTE.mitte.lng);
  const DEHNUNG = 1 / Math.cos(KARTE.mitte.lat * Math.PI / 180); // Mercator-Meter je echtem Meter in Garbsen (vereinfachte Zeichnung)
  const dehnung = (lat) => 1 / Math.cos(lat * Math.PI / 180);        // Mercator-Meter je echtem Meter an diesem Breitengrad
  // Breitengrad zu einem Punkt der Karte (Mercator-Meter)
  const breiteVon = (y) => (2 * Math.atan(Math.exp(-(y + NULLPUNKT.y) / ERDE)) - Math.PI / 2) * 180 / Math.PI;
  const inMeter = (lat, lng) => { const p = mercator(lat, lng); return { x: p.x - NULLPUNKT.x, y: p.y - NULLPUNKT.y }; };
  // So weit lässt sich die Karte verschieben: Deutschland (47,27–55,06° N, 5,87–15,04° O) mit gut 30 km Rand,
  // damit man ein Stück der Nachbarländer sieht, aber nicht halb Europa
  const DE_A = inMeter(55.06 + 0.3, 5.87 - 0.45), DE_B = inMeter(47.27 - 0.3, 15.04 + 0.45);
  const massstabFuerZoom = (z) => 256 * Math.pow(2, z) / WELT;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const kartenStatus = { svg: null, welt: null, schicht: null, huelle: null, w: 0, h: 0, blick: null, ruhig: null,
    formen: [], grenzen: null, bewegt: false, gezogen: 0, marker: new Map(), elemente: [], gruppen: [], stufe: null, animation: 0 };
  const groesster = () => massstabFuerZoom(kacheln.aus ? KARTE.zoomMaxOhne : KARTE.zoomMax);
  // So weit lässt sich herauszoomen: ganz Deutschland mit dem Rand passt gerade ins Bild, weiter nicht
  const kleinster = () => {
    const k = kartenStatus, fest = massstabFuerZoom(KARTE.zoomMin);
    if (!k.w || !k.h) return fest;
    return Math.max(fest, Math.min(k.w / (DE_B.x - DE_A.x), k.h / (DE_B.y - DE_A.y)));
  };

  function dunklesThema() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Polygon an einer Geraden abschneiden: behält die Punkte mit n·p <= g (Sutherland-Hodgman)
  function abschneiden(pkt, nx, ny, g) {
    const aus = [];
    for (let i = 0; i < pkt.length; i++) {
      const p = pkt[i], q = pkt[(i + 1) % pkt.length];
      const dp = p.x * nx + p.y * ny - g, dq = q.x * nx + q.y * ny - g;
      if (dp <= 0) aus.push(p);
      if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); aus.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
    }
    return aus;
  }
  // Ecken weich machen (Chaikin)
  function glaetten(pkt) {
    const aus = [];
    for (let i = 0; i < pkt.length; i++) {
      const p = pkt[i], q = pkt[(i + 1) % pkt.length];
      aus.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 }, { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
    }
    return aus;
  }
  // Leicht unregelmäßiger Kreis als Punktliste
  function welle(c, R, phase, n) {
    const pkt = [];
    for (let i = 0; i < n; i++) {
      const w = i / n * Math.PI * 2;
      const f = 1 + 0.07 * Math.sin(3 * w + phase) + 0.04 * Math.sin(5 * w + phase * 2);
      pkt.push({ x: c.x + Math.cos(w) * R * f, y: c.y + Math.sin(w) * R * f });
    }
    return pkt;
  }
  const alsPfad = (pkt) => 'M' + pkt.map((p) => `${Math.round(p.x)} ${Math.round(p.y)}`).join('L') + 'Z';
  // Stadtteil-Flächen: leicht unregelmäßige Kreise, Überschneidungen nach dem Potenzdiagramm geteilt
  function stadtteilFormen() {
    const teile = STADTTEILE.map((s) => ({ s, c: inMeter(s.lat, s.lng), R: s.r * KARTE.flaeche * DEHNUNG }));
    return teile.map((a) => {
      const phase = a.s.name.length * 0.9 + a.s.name.charCodeAt(0) * 0.13;
      let pkt = welle(a.c, a.R, phase, 40);
      teile.forEach((b) => {
        if (b === a) return;
        const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y, d = Math.hypot(dx, dy);
        if (d >= (a.R + b.R) * 1.12) return;
        const g = ((b.c.x * b.c.x + b.c.y * b.c.y) - (a.c.x * a.c.x + a.c.y * a.c.y) - b.R * b.R + a.R * a.R) / (2 * d) - KARTE.luecke * DEHNUNG / 2;
        pkt = abschneiden(pkt, dx / d, dy / d, g);
      });
      pkt = glaetten(glaetten(pkt));
      const d = alsPfad(pkt);
      return { name: a.s.name, c: a.c, R: a.R, d, pkt, phase };
    });
  }

  function svgEl(name, attr) {
    const el = document.createElementNS(SVG_NS, name);
    Object.keys(attr || {}).forEach((k) => el.setAttribute(k, attr[k]));
    return el;
  }

  /* ----- Kartenbilder (Kacheln) -----
     Standard: die eigene, selbst gezeichnete Karte (Abschnitt „Eigene Straßenkarte“, Daten von OpenStreetMap).
     Ersatz, wenn deren Daten nicht kommen: basemap.de, die amtliche Straßenkarte von Bund und Ländern (BKG, Frankfurt,
     CC BY 4.0), danach OpenStreetMap.
     Mit CONFIG.karte.carto (kostenloser Schlüssel von carto.com) zuerst der Stil „Voyager“, nachts „Dark Matter“.
     Lädt ein Anbieter nicht, nimmt die App den nächsten, zuletzt die vereinfachte Zeichnung. */
  const OSM_QUELLE = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende';
  const CC_BY = '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
  const BKG = '<a href="https://www.bkg.bund.de" target="_blank" rel="noopener">GeoBasis-DE / BKG</a>';
  const kacheln = { el: null, quellen: [], nr: 0, z: null, vorZ: null, ref: null, bilder: new Map(), ok: 0, fehler: 0, aus: false, ruhe: 0 };
  // Luftbild für ganz Deutschland (mit Schlüssel): deckt alles, eine Straßenkarte darunter braucht es dann nicht
  function esriQuelle() {
    const esri = CONFIG.karte && CONFIG.karte.esri;
    return esri ? { url: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=' + encodeURIComponent(esri), max: 18, foto: true,
      quelle: 'Luftbild: Esri, Maxar, Earthstar Geographics · Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>' } : null;
  }
  function kachelQuellen() {
    const q = [];
    const carto = CONFIG.karte && CONFIG.karte.carto;
    if (esriQuelle() && ansicht.kartenart === 'luftbild') q.push(esriQuelle());
    // Die eigene, selbst gezeichnete Karte (Daten von OpenStreetMap); fertige Kartenbilder nur als Ersatz
    if (CONFIG.karte.beschriftung && !VORSCHAU && window.fetch && window.TextDecoder) q.push({ vektor: true, min: 0, max: 18,
      quelle: '© <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende' });
    if (carto) q.push({ url: 'https://basemaps.cartocdn.com/rastertiles/{stil}/{z}/{x}/{y}{r}.png?key=' + encodeURIComponent(carto), max: 20, retina: true, carto: true,
      quelle: OSM_QUELLE + ' © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' });
    q.push({ url: 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', min: 5, max: 18, bkg: true,
      quelle: `© ${BKG} (${new Date().getFullYear()}) ${CC_BY}<span class="k-veraendert">, Farben angepasst</span>` });
    q.push({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, quelle: OSM_QUELLE + '<span class="k-veraendert">, Farben angepasst</span>' });
    q.push({ url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', max: 18, quelle: OSM_QUELLE + ', openstreetmap.de<span class="k-veraendert">, Farben angepasst</span>' });
    return q;
  }
  function kachelUrl(q, z, x, y) {
    return q.url.replace('{stil}', dunklesThema() ? 'dark_all' : 'voyager').replace('{z}', z).replace('{x}', x).replace('{y}', y)
      .replace('{r}', q.retina && (window.devicePixelRatio || 1) > 1.4 ? '@2x' : '');
  }

  /* ----- Quellenangabe der Karten: kurz ausgeklappt, dann nur noch ein (i) in der Ecke -----
     Die Lizenzen (CC BY 4.0, ODbL) verlangen die Quellen „auf angemessene Weise“. Die Richtlinie von OpenStreetMap
     erlaubt, sie nach fünf Sekunden oder beim ersten Bewegen der Karte einzuklappen, solange ein (i) sie wieder zeigt.
     So machen es auch MapLibre und Mapbox. Vollständig stehen die Quellen außerdem in der Datenschutzerklärung. */
  function quelleOffen(box, offen) {
    box.classList.toggle('offen', offen);
    const knopf = box.querySelector('.quelle-knopf');
    knopf.setAttribute('aria-expanded', String(offen));
    knopf.setAttribute('aria-label', offen ? 'Kartenquellen ausblenden' : 'Kartenquellen anzeigen');
  }
  // Beim ersten Zeigen der Karte: fünf Sekunden ausgeklappt
  function quelleKurzZeigen(box) {
    if (!box || box.dataset.gezeigt) return;
    box.dataset.gezeigt = '1';
    quelleOffen(box, true);
    box.zu = setTimeout(() => quelleEinklappen(box), 5000);
  }
  function quelleEinklappen(box) {
    if (!box || !box.classList.contains('offen') || box.classList.contains('fest')) return;
    clearTimeout(box.zu);
    quelleOffen(box, false);
  }
  // Manche Anbieter (Esri) verlangen, dass ihr Name immer zu sehen ist
  function quelleFest(box, fest) {
    if (!box || fest === box.classList.contains('fest')) return;
    box.classList.toggle('fest', fest);
    box.querySelector('.quelle-knopf').hidden = fest;
    quelleOffen(box, fest);
  }
  document.addEventListener('click', (e) => {
    const knopf = e.target.closest('.quelle-knopf');
    if (!knopf) return;
    const box = knopf.parentNode;
    clearTimeout(box.zu);
    box.dataset.gezeigt = '1';
    quelleOffen(box, !box.classList.contains('offen'));
  });

  /* ----- Luftbild über der Straßenkarte -----
     In Niedersachsen die Digitalen Orthophotos des LGLN (20 cm je Bildpunkt), frei nutzbar (CC BY 4.0), ohne Schlüssel.
     Der Dienst (WMS) zeichnet jedes Bild genau für ein Kartenquadrat. Wo er keine Luftbilder hat, ist das Bild
     durchsichtig, dort sieht man die Straßenkarte darunter. Antwortet er nicht, bleibt einfach die Straßenkarte. */
  const LGLN = {
    wms: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ni_dop20&STYLES=&CRS=EPSG:3857&FORMAT=image%2Fvnd.jpeg-png&TRANSPARENT=TRUE',
    min: 10,                            // erst ab Zoomstufe 10 (Region), darunter nur die Straßenkarte
    gebiet: [6.6, 51.28, 11.62, 53.9],  // Niedersachsen (Länge, Breite): außerhalb gar nicht erst fragen
    quelle: '<a href="https://www.lgln.niedersachsen.de" target="_blank" rel="noopener">LGLN</a>'
  };
  const luft = { el: null, aus: false, ok: 0, fehler: 0 };
  // Luftbild über diese Straßenkarte legen? Nicht, wenn sie selbst schon ein Luftbild ist (Esri).
  function luftQuelle(quellen, nr) {
    const q = quellen && quellen[nr];
    return !VORSCHAU && !luft.aus && ansicht.kartenart === 'luftbild' && q && !q.foto ? LGLN : null;
  }
  // Berühren die Kartenquadrate x0…x1, y0…y1 der Zoomstufe z das Gebiet mit Luftbildern?
  function luftDeckt(q, z, x0, y0, x1, y1) {
    const n = Math.pow(2, z), g = q.gebiet;
    const breite = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    return x0 / n * 360 - 180 < g[2] && (x1 + 1) / n * 360 - 180 > g[0] && breite(y1 + 1) < g[3] && breite(y0) > g[1];
  }
  function luftUrl(q, z, x, y) {
    // Ausschnitt in Mercator-Metern (EPSG:3857). Auf scharfen Bildschirmen doppelt so viele Bildpunkte.
    const H = Math.PI * ERDE, g = 2 * H / Math.pow(2, z), px = (window.devicePixelRatio || 1) > 1.4 ? 512 : 256;
    const x0 = -H + x * g, y1 = H - y * g;
    return q.wms + '&WIDTH=' + px + '&HEIGHT=' + px + '&BBOX=' + [x0, y1 - g, x0 + g, y1].map((v) => v.toFixed(2)).join(',');
  }
  function luftFehler() {
    luft.fehler++;
    if (luft.ok || luft.fehler < 4) return;
    // Der Dienst antwortet nicht: ohne Luftbild weiter (die Straßenkarte liegt ja darunter)
    luft.aus = true;
    kacheln.bilder.forEach((t, key) => { if (t.luft) kachelWeg(t, key); });
    kacheln.bilder.forEach(basisAuffrischen);
    if (umgebung.el) { umgebung.schluessel = ''; umgebungZeichnen(); }
    kartenArtZeigen();
  }
  // Quellenangabe: Straßenkarte, dazu das Luftbild, wenn es zu sehen ist
  const NAMEN_QUELLE = ' · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  function quellenText(q, mitLuft, mitNamen) {
    const jahr = new Date().getFullYear();
    if (q.vektor) return (mitLuft ? `Luftbild © GeoBasis-DE / ${LGLN.quelle} (${jahr}) ${CC_BY} · ` : '') + q.quelle;
    const text = !mitLuft ? q.quelle : q.bkg ? `© ${BKG}<span class="k-veraendert"> (Farben angepasst)</span>, ${LGLN.quelle} (${jahr}) ${CC_BY}` : `Luftbild © ${LGLN.quelle} (${jahr}) ${CC_BY} · ${q.quelle}`;
    return text + (mitNamen ? NAMEN_QUELLE : '');
  }
  // Knopf unten links auf der großen Karte: wechselt zwischen Luftbild und Straßenkarte. Er zeigt als kleines Bild
  // die Stelle in der Mitte so, wie man sie nach dem Tippen sieht (wie bei Google Maps). Nur da, wo es Luftbilder gibt.
  function kartenArtZeigen() {
    const k = kartenStatus, kc = kacheln, knopf = $('#karte-art'), quelle = $('.k-quelle');
    if (!k.huelle || !knopf) return;
    const q = kc.quellen[kc.nr];
    let hier = false, r = null;
    if (q && !kc.aus && !VORSCHAU && k.blick && k.w) {
      r = kachelBereich(k.blick, kachelZoom(k.blick.s));
      hier = CONFIG.karte.esri ? true : !luft.aus && r.z >= LGLN.min && luftDeckt(LGLN, r.z, r.x0, r.y0, r.x1, r.y1);
    }
    // Auf Luftbildern stehen Beträge und Maßstab hell mit dunklem Rand (wie bei Google Maps), sonst dunkel mit hellem Rand.
    // Dazu kommen die Namen von Orten und Straßen.
    const foto = !!q && !kc.aus && (!!q.foto || (hier && !!luftQuelle(kc.quellen, kc.nr)));
    if (foto !== k.huelle.parentNode.classList.contains('k-foto')) { k.huelle.parentNode.classList.toggle('k-foto', foto); namenBald(); }
    if (q && !kc.aus) {
      const text = quellenText(q, hier && !!luftQuelle(kc.quellen, kc.nr), foto && namenMoeglich());
      if (quelle.dataset.text !== text) { quelle.innerHTML = text; quelle.dataset.text = text; }
      // „Powered by Esri“ muss immer zu sehen sein
      quelleFest(quelle.parentNode, !!q.foto);
    }
    knopf.hidden = !hier;
    if (!hier) return;
    const zuLuft = ansicht.kartenart !== 'luftbild';
    // Bild: das Kartenquadrat eine Stufe näher, in dem die Mitte liegt
    const z = Math.min(18, r.z + 1), n = Math.pow(2, z), T = WELT / n;
    const x = Math.floor((r.ox + (k.w / 2 - k.blick.x) / k.blick.s) / T), y = Math.floor((r.oy + (k.h / 2 - k.blick.y) / k.blick.s) / T);
    const strasse = kc.quellen.find((e) => !e.foto) || q;
    const bild = knopf.querySelector('img');
    if (!zuLuft && strasse.vektor) {
      // Die eigene Karte: das Quadrat klein zeichnen (sobald die Daten da sind)
      const schl = ['v', z, x, y, dunklesThema()].join('/');
      if (bild.dataset.fertig !== schl) {
        const t = k.vorschauBild || (k.vorschauBild = { img: bild, vorschau: true });
        Object.assign(t, { z, x, y, schl });
        vektorPlanen(t);
      }
      bild.dataset.src = schl;
      bild.classList.remove('k-strasse');
    } else {
      const src = zuLuft ? (CONFIG.karte.esri ? kachelUrl(esriQuelle(), z, x, y) : luftUrl(LGLN, z, x, y)) : kachelUrl(strasse, z, x, y);
      if (bild.dataset.src !== src) { bild.dataset.src = src; bild.src = src; }
      bild.classList.toggle('k-strasse', !zuLuft && !strasse.carto);
    }
    knopf.querySelector('.karte-art-name').textContent = zuLuft ? 'Luftbild' : 'Karte';
    knopf.setAttribute('aria-label', zuLuft ? 'Luftbild zeigen' : 'Straßenkarte zeigen');
  }
  // Luftbild an oder aus (Knopf auf der Karte oder Menü)
  function kartenArtNeu() {
    const k = kartenStatus, kc = kacheln, u = umgebung;
    Object.assign(luft, { aus: false, ok: 0, fehler: 0 }); // ausdrücklich gewählt: noch einmal versuchen
    if (k.huelle && !VORSCHAU && !kc.aus) {
      // Mit Esri sind Luftbild und Straßenkarte verschiedene Quellen, sonst liegt das Luftbild nur darüber
      if (CONFIG.karte.esri) { kc.quellen = kachelQuellen(); kachelQuelleSetzen(0); }
      else kc.bilder.forEach((t, key) => { if (t.luft) kachelWeg(t, key); });
      if (k.blick) kachelnLegen(k.blick);
      kartenArtZeigen();
    }
    if (u.el && !VORSCHAU && !u.aus) {
      if (CONFIG.karte.esri) { u.quellen = kachelQuellen(); u.nr = 0; u.ok = 0; u.fehler = 0; }
      u.schluessel = '';
      umgebungZeichnen();
    }
    namenBald();
  }

  /* ===== Kartenwerkstatt: Kartendaten lesen und daraus die Karte zeichnen =====
     Alles hier kommt ohne den Rest der App aus. So kann es im Hintergrund laufen (Web Worker mit eigener Zeichenfläche):
     Lesen und Zeichnen kosten dann auf dem Handy keine Zeit, in der die Karte beim Zoomen stocken würde.
     Kann der Browser das nicht, läuft dieselbe Werkstatt hier, aber nur, wenn die Karte ruht. */
  function kartenWerkstatt() {
  // Straßennamen: ab welcher Zoomstufe, Rang (kleiner = wichtiger)
  const NAMEN_STRASSENNAMEN = { trunk: [13, 1], primary: [13, 1], secondary: [14, 2], tertiary: [14, 3], minor: [15, 4], service: [17, 6], path: [17, 7] };
  // Orte: ab Zoomstufe, Rang, Schriftgröße, Stärke
  const NAMEN_ORTE = { city: [5, 0, 18, 700], town: [9, 1, 16, 700], village: [12, 2, 15, 600], borough: [12, 3, 14, 600], suburb: [12, 3, 14, 600],
    quarter: [14, 4, 13, 600], hamlet: [14, 4, 13, 600], neighbourhood: [15, 5, 12.5, 600], isolated_dwelling: [16, 6, 12, 600] };
  /* Vektordaten lesen (Mapbox Vector Tile, Protocol Buffers). Eine Ebene wird erst gelesen, wenn sie gebraucht wird
     (Häuser z. B. erst ganz nah), und davon nur die Merkmale, die gezeichnet werden. Jedes Merkmal bekommt sein
     umgebendes Rechteck mit, damit beim Vergrößern nur gezeichnet wird, was im Bild liegt.
     Ergebnis: d.ebene(name) → { extent, liste: [{ typ, eig, teile: [[x, y, x, y, …]], bb: [x0, y0, x1, y1] }] } */
  const KEINE_FLAECHE = { suburb: 1, quarter: 1, neighbourhood: 1 };
  const MVT_WAHL = {
    place: (e) => !!NAMEN_ORTE[e.class] || e.class === 'country' || e.class === 'state',
    transportation: (e) => !!STRASSEN_ART[e.class],
    transportation_name: (e) => !!(NAMEN_STRASSENNAMEN[e.class] || e.class === 'motorway' || e.ref) && e.brunnel !== 'tunnel',
    landuse: (e) => !KEINE_FLAECHE[e.class],
    boundary: (e) => (e.admin_level === 2 || e.admin_level === 4) && !e.maritime,
    waterway: (e) => e.brunnel !== 'tunnel',
    aeroway: (e) => e.class === 'runway' || e.class === 'taxiway',
    water: () => true, landcover: () => true, building: () => true, water_name: () => true
  };
  function mvtLesen(buf) {
    const b = new Uint8Array(buf), dec = new TextDecoder('utf-8');
    let p = 0;
    const zahl = () => { let r = 0, f = 1, x; do { x = b[p++]; r += (x & 127) * f; f *= 128; } while (x >= 128 && p < b.length); return r; };
    const zz = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
    const ueber = (t) => { if (t === 0) zahl(); else if (t === 1) p += 8; else if (t === 2) { const l = zahl(); p += l; } else if (t === 5) p += 4; else p = b.length; };
    const text = () => { const l = zahl(), s = dec.decode(b.subarray(p, p + l)); p += l; return s; };
    const wert = () => {
      const l = zahl(), ende = p + l;
      let v = null;
      while (p < ende) {
        const k = zahl(), f = k >> 3, t = k & 7;
        if (f === 1 && t === 2) v = text();
        else if (f === 2 && t === 5) { v = new DataView(b.buffer, b.byteOffset + p, 4).getFloat32(0, true); p += 4; }
        else if (f === 3 && t === 1) { v = new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true); p += 8; }
        else if ((f === 4 || f === 5) && t === 0) v = zahl();
        else if (f === 6 && t === 0) v = zz(zahl());
        else if (f === 7 && t === 0) v = !!zahl();
        else ueber(t);
      }
      p = ende;
      return v;
    };
    const merkmal = (ende, keys, werte, wahl) => {
      const m = { typ: 0, eig: {}, teile: [], bb: null };
      let hatEig = false;
      while (p < ende) {
        const k = zahl(), f = k >> 3, t = k & 7;
        if (f === 2 && t === 2) {
          const l = zahl(), e = p + l;
          while (p < e) { const ki = zahl(), wi = zahl(); m.eig[keys[ki]] = werte[wi]; }
          hatEig = true;
        } else if (f === 3 && t === 0) m.typ = zahl();
        else if (f === 4 && t === 2) {
          const l = zahl(), e = p + l;
          if (hatEig && !wahl(m.eig)) { p = e; return null; }
          let x = 0, y = 0, teil = null, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          while (p < e) {
            const c = zahl(), id = c & 7, n = c >> 3;
            if (id === 7) { if (teil && teil.length > 2) teil.push(teil[0], teil[1]); continue; }
            for (let j = 0; j < n && p < e; j++) {
              x += zz(zahl()); y += zz(zahl());
              if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
              if (id === 1) { teil = [x, y]; m.teile.push(teil); } else if (teil) teil.push(x, y);
            }
          }
          m.bb = [x0, y0, x1, y1];
        } else ueber(t);
      }
      return m.teile.length && wahl(m.eig) ? m : null;
    };
    // Erst nur merken, wo welche Ebene steht
    const roh = {}, fertig = {};
    while (p < b.length) {
      const k = zahl();
      if (k >> 3 !== 3 || (k & 7) !== 2) { ueber(k & 7); continue; }
      const l = zahl(), anfang = p, ende = p + l;
      let name = '';
      while (p < ende) {
        const kk = zahl();
        if (kk >> 3 === 1 && (kk & 7) === 2) { name = text(); break; }
        ueber(kk & 7);
      }
      if (name && MVT_WAHL[name]) roh[name] = [anfang, ende];
      p = ende;
    }
    const ebene = (name) => {
      if (name in fertig) return fertig[name];
      const r = roh[name];
      if (!r) return (fertig[name] = null);
      p = r[0];
      let extent = 4096;
      const keys = [], werte = [], merkmale = [];
      while (p < r[1]) {
        const kk = zahl(), f = kk >> 3, t = kk & 7;
        if (f === 2 && t === 2) { const ml = zahl(); merkmale.push(p, p + ml); p += ml; }
        else if (f === 3 && t === 2) keys.push(text());
        else if (f === 4 && t === 2) werte.push(wert());
        else if (f === 5 && t === 0) extent = zahl();
        else ueber(t);
      }
      const liste = [], wahl = MVT_WAHL[name];
      for (let i = 0; i < merkmale.length; i += 2) {
        p = merkmale[i];
        const m = merkmal(merkmale[i + 1], keys, werte, wahl);
        if (m) liste.push(m);
      }
      return (fertig[name] = { extent, liste });
    };
    return { ebene };
  }

  const KARTENSTIL = {
    hell: {
      land: '#EEF0E9', wald: '#CDDFC1', gras: '#DAE8CD', sumpf: '#D6E6DB', sand: '#EFE8D2', fels: '#E3E2DC', eis: '#F6F9FA',
      wohnen: '#E6E6DF', gewerbe: '#EDE4E0', industrie: '#E5E3E9', friedhof: '#D3E1CA', schule: '#F1EAD7', klinik: '#F3E3E2',
      sport: '#D2E6C4', bahngelaende: '#E5E3DF', militaer: '#ECE0DF', steinbruch: '#E2DFD9',
      wasser: '#A9CBE0', haus: '#DDD6CC', hausRand: '#C9BFB2', hausSchatten: 'rgba(112, 96, 76, .2)', piste: '#D6D8DE', platz: '#F6F4EF',
      rand: '#BEC4CC', weiss: '#FFFFFF', sekundaer: '#FFF0C0', sekundaerRand: '#D7BF79', primaer: '#F8D77E', primaerRand: '#CDA347',
      fern: '#F4B863', fernRand: '#C2853A', autobahn: '#E98F58', autobahnRand: '#B05E2E',
      weg: '#A99377', bahn: '#9198A2', bahnHell: '#FFFFFF', grenze: '#8C78AC', grenzeHalo: 'rgba(140, 120, 172, .2)', land2: '#ABA0BF'
    },
    dunkel: {
      land: '#18202A', wald: '#1C2A24', gras: '#1E2C26', sumpf: '#1B2A2B', sand: '#2A2A24', fels: '#24272B', eis: '#26303A',
      wohnen: '#1D2530', gewerbe: '#272430', industrie: '#222433', friedhof: '#1D2B25', schule: '#28292A', klinik: '#2B2329',
      sport: '#1E2E25', bahngelaende: '#23252B', militaer: '#2A2328', steinbruch: '#25262A',
      wasser: '#0E2638', haus: '#283342', hausRand: '#33404F', hausSchatten: 'rgba(0, 0, 0, .35)', piste: '#2C333C', platz: '#232B36',
      rand: '#0E141B', weiss: '#323E4D', sekundaer: '#4A4636', sekundaerRand: '#16140E', primaer: '#6E5D33', primaerRand: '#1E1A10',
      fern: '#7C5A33', fernRand: '#22180D', autobahn: '#8A5333', autobahnRand: '#26150B',
      weg: '#5B6575', bahn: '#56606D', bahnHell: '#18202A', grenze: '#9B8AC2', grenzeHalo: 'rgba(155, 138, 194, .18)', land2: '#6B6385'
    }
  };
  // Straßen: Art in OpenMapTiles, ab Zoomstufe, Breite in Bildpunkten bei Zoomstufe 10/12/14/16/18, Farbe, Rand, gestrichelt
  const STRASSEN_STIL = [
    ['path', 15, [0, 0, 0.7, 1.1, 1.8], 'weg', null, true],
    ['track', 14, [0, 0, 0.8, 1.2, 2], 'weg', null, true],
    ['service', 14, [0, 0, 1, 2.6, 6], 'weiss', 'rand'],
    ['minor', 12, [0, 0.7, 1.7, 5, 11], 'weiss', 'rand'],
    ['tertiary', 11, [0.5, 1.1, 2.4, 6, 12], 'weiss', 'rand'],
    ['secondary', 9, [0.8, 1.5, 3, 7, 14], 'sekundaer', 'sekundaerRand'],
    ['primary', 8, [1, 1.9, 3.6, 8, 16], 'primaer', 'primaerRand'],
    ['trunk', 6, [1.2, 2.2, 4, 8.5, 17], 'fern', 'fernRand'],
    ['motorway', 5, [1.4, 2.5, 4.4, 9, 18], 'autobahn', 'autobahnRand']
  ];
  const STRASSEN_ART = { rail: 1, bridge: 1, pier: 1 };
  STRASSEN_STIL.forEach((s) => { STRASSEN_ART[s[0]] = 1; });
  // Flächen: Art (landuse/landcover) → Farbe; gross: unter Wald und Wiesen, sonst darüber
  const FLAECHEN_FARBE = { wood: 'wald', grass: 'gras', wetland: 'sumpf', sand: 'sand', rock: 'fels', ice: 'eis',
    residential: 'wohnen', commercial: 'gewerbe', retail: 'gewerbe', industrial: 'industrie', garages: 'industrie', bus_station: 'industrie',
    railway: 'bahngelaende', military: 'militaer', quarry: 'steinbruch', cemetery: 'friedhof', hospital: 'klinik',
    school: 'schule', university: 'schule', college: 'schule', kindergarten: 'schule', library: 'schule',
    stadium: 'sport', pitch: 'sport', track: 'sport', playground: 'gras', zoo: 'gras', theme_park: 'gras' };
  const FLAECHE_GROSS = { residential: 1, commercial: 1, retail: 1, industrial: 1, garages: 1, bus_station: 1, railway: 1, military: 1, quarry: 1 };
  // Breite für Zoomstufe z aus [z10, z12, z14, z16, z18], darunter kleiner werdend
  function linienBreite(tab, z) {
    if (z <= 10) return tab[0] * Math.pow(0.72, 10 - z);
    const zi = Math.min(18, z), i = Math.min(3, Math.floor((zi - 10) / 2)), t = (zi - 10 - i * 2) / 2;
    return tab[i] + (tab[i + 1] - tab[i]) * t;
  }

  /* Ein Kartenquadrat (z, x, y) in die Zeichenfläche cv zeichnen. Daten gibt es bis Zoomstufe 14; näher wird ein
     Ausschnitt davon vergrößert gezeichnet (scharf, weil es Linien sind). d: gelesene Daten des Quadrats dz. */
  function vektorMalen(cv, d, z, x, y, dz, stilName, dpr) {
    const f = Math.pow(2, z - dz), px = Math.floor(x / f), py = Math.floor(y / f);
    const st = KARTENSTIL[stilName], g = Math.round(256 * dpr);
    if (cv.width !== g) { cv.width = g; cv.height = g; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = st.land;
    ctx.fillRect(0, 0, g, g);
    if (!d.ebene) return 'leer'; // Daten kamen nicht: erst einmal leeres Land, später neu versuchen
    // Ausschnitt in Datenkoordinaten (mit etwas Rand, damit breite Linien am Rand nicht abreißen)
    const ext = 4096, m = g * f / ext, ox = -(x - px * f) * g, oy = -(y - py * f) * g;
    const rand = 24 / m, a0 = -ox / m - rand, b0 = -oy / m - rand, a1 = (g - ox) / m + rand, b1 = (g - oy) / m + rand;
    const imBild = (e) => !e.bb || (e.bb[2] >= a0 && e.bb[0] <= a1 && e.bb[3] >= b0 && e.bb[1] <= b1);
    const px2 = dpr / m; // ein Bildpunkt in Datenkoordinaten
    const pfad = (liste, nur) => {
      let etwas = false;
      ctx.beginPath();
      liste.forEach((e) => {
        if ((nur && !nur(e)) || !imBild(e)) return;
        e.teile.forEach((t) => {
          ctx.moveTo(t[0], t[1]);
          for (let i = 2; i < t.length; i += 2) ctx.lineTo(t[i], t[i + 1]);
        });
        etwas = true;
      });
      return etwas;
    };
    const flaechen = (name, farbeVon) => {
      const e = d.ebene(name);
      if (!e) return;
      const gruppen = {};
      e.liste.forEach((m2) => { if (m2.typ !== 3) return; const fa = farbeVon(m2.eig); if (fa) (gruppen[fa] = gruppen[fa] || []).push(m2); });
      Object.keys(gruppen).forEach((fa) => { if (pfad(gruppen[fa])) { ctx.fillStyle = st[fa]; ctx.fill('nonzero'); } });
    };
    ctx.setTransform(m, 0, 0, m, ox, oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // 1. Flächen: Siedlungen, Wald und Wiesen, kleinere Flächen (Sportplätze, Schulen, Friedhöfe)
    flaechen('landuse', (e) => FLAECHE_GROSS[e.class] && FLAECHEN_FARBE[e.class]);
    flaechen('landcover', (e) => FLAECHEN_FARBE[e.class]);
    flaechen('landuse', (e) => !FLAECHE_GROSS[e.class] && FLAECHEN_FARBE[e.class]);
    // 2. Wasser: Seen, Flüsse als Fläche, dazu Bäche und Flüsse als Linien
    const wasser = d.ebene('water');
    if (wasser && pfad(wasser.liste, (e) => e.typ === 3)) { ctx.fillStyle = st.wasser; ctx.fill('nonzero'); }
    const ww = d.ebene('waterway');
    if (ww) [['river', 8, [0.8, 1.4, 2.4, 5, 10]], ['canal', 10, [0.6, 1.2, 2, 4, 8]], ['stream', 13, [0, 0, 0.8, 1.4, 2.2]], ['ditch', 15, [0, 0, 0, 0.8, 1.4]], ['drain', 15, [0, 0, 0, 0.8, 1.4]]].forEach(([art, ab, tab]) => {
      if (z < ab || !pfad(ww.liste, (e) => e.typ === 2 && e.eig.class === art)) return;
      ctx.lineWidth = linienBreite(tab, z) * px2; ctx.strokeStyle = st.wasser; ctx.stroke();
    });
    // 3. Start- und Landebahnen
    const flug = d.ebene('aeroway');
    if (flug && z >= 10 && pfad(flug.liste, (e) => e.typ === 2)) { ctx.lineWidth = linienBreite([1, 2, 5, 14, 40], z) * px2; ctx.strokeStyle = st.piste; ctx.stroke(); }
    // 4. Häuser (ganz nah mit kleinem Schatten, wie gedruckt)
    const haeuser = z >= 14 && d.ebene('building');
    if (haeuser && pfad(haeuser.liste)) {
      if (z >= 16) {
        ctx.setTransform(m, 0, 0, m, ox + 1.3 * dpr, oy + 1.7 * dpr);
        ctx.fillStyle = st.hausSchatten; ctx.fill('nonzero');
        ctx.setTransform(m, 0, 0, m, ox, oy);
      }
      ctx.fillStyle = st.haus; ctx.fill('nonzero');
      if (z >= 15) { ctx.lineWidth = 0.7 * px2; ctx.strokeStyle = st.hausRand; ctx.stroke(); }
    }
    // 5. Plätze, Fußgängerzonen, Brücken als Fläche
    const verkehr = d.ebene('transportation');
    if (verkehr && z >= 15 && pfad(verkehr.liste, (e) => e.typ === 3)) { ctx.fillStyle = st.platz; ctx.fill('nonzero'); }
    if (verkehr) {
      const linien = (art, tunnel) => (e) => e.typ === 2 && e.eig.class === art && (e.eig.brunnel === 'tunnel') === tunnel;
      // Tunnel: blass, ohne Rand
      ctx.globalAlpha = 0.45;
      STRASSEN_STIL.forEach(([art, ab, tab, farbe]) => {
        if (z < ab || !pfad(verkehr.liste, linien(art, true))) return;
        ctx.lineWidth = linienBreite(tab, z) * px2; ctx.strokeStyle = st[farbe]; ctx.stroke();
      });
      ctx.globalAlpha = 1;
      // Bahn: graue Linie, nah mit hellen Strichen darin
      if (z >= 9 && pfad(verkehr.liste, (e) => e.typ === 2 && e.eig.class === 'rail' && e.eig.brunnel !== 'tunnel' && (z >= 13 || e.eig.subclass === 'rail'))) {
        ctx.lineWidth = linienBreite([0.6, 0.8, 1.3, 2.2, 3], z) * px2; ctx.strokeStyle = st.bahn; ctx.stroke();
        if (z >= 14) {
          ctx.lineWidth = linienBreite([0, 0, 0.5, 1, 1.4], z) * px2; ctx.strokeStyle = st.bahnHell;
          ctx.setLineDash([4 * px2, 4 * px2]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // Straßen: erst alle Ränder, dann alle Füllungen (so gehen Kreuzungen sauber ineinander über)
      const sichtbar = STRASSEN_STIL.filter((s2) => z >= s2[1]);
      sichtbar.forEach(([art, , tab, , rand, gestrichelt]) => {
        if (!rand || gestrichelt || !pfad(verkehr.liste, linien(art, false))) return;
        if (z < 10) return; // weit heraus ohne Rand, sonst wirken die Straßen zu dick
        ctx.lineWidth = (linienBreite(tab, z) + (z >= 16 ? 2 : z >= 13 ? 1.4 : 1)) * px2; ctx.strokeStyle = st[rand]; ctx.stroke();
      });
      sichtbar.forEach(([art, , tab, farbe, , gestrichelt]) => {
        if (!pfad(verkehr.liste, linien(art, false))) return;
        ctx.lineWidth = linienBreite(tab, z) * px2; ctx.strokeStyle = st[farbe];
        if (gestrichelt) ctx.setLineDash([3 * px2, 2.5 * px2]);
        ctx.stroke();
        if (gestrichelt) ctx.setLineDash([]);
      });
    }
    // 6. Grenzen: Staaten kräftig gestrichelt mit zartem Band, Bundesländer fein
    const grenzen = d.ebene('boundary');
    if (grenzen) {
      if (z >= 5 && z <= 12 && pfad(grenzen.liste, (e) => e.eig.admin_level === 4)) {
        ctx.lineWidth = (z < 8 ? 0.6 : 0.9) * px2; ctx.strokeStyle = st.land2; ctx.setLineDash([4 * px2, 3 * px2]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (pfad(grenzen.liste, (e) => e.eig.admin_level === 2)) {
        ctx.lineWidth = (z >= 10 ? 7 : 5) * px2; ctx.strokeStyle = st.grenzeHalo; ctx.stroke();
        ctx.lineWidth = (z >= 10 ? 1.8 : 1.4) * px2; ctx.strokeStyle = st.grenze; ctx.setLineDash([7 * px2, 3 * px2, 1.5 * px2, 3 * px2]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return true;
  }

    return { NAMEN_ORTE, NAMEN_STRASSENNAMEN, mvtLesen, vektorMalen, KARTENSTIL };
  }
  const WERKSTATT = kartenWerkstatt();
  const { NAMEN_ORTE, NAMEN_STRASSENNAMEN, mvtLesen } = WERKSTATT;

  /* ----- Namen und Straßen über dem Luftbild (wie „Hybrid“ bei Google Maps) -----
     Auf dem Luftbild allein sieht man nicht, welcher Ort und welche Straße das ist. Dafür holt die App Kartendaten von
     OpenStreetMap als Vektordaten (OpenFreeMap: kostenlos, ohne Schlüssel, auch gewerblich; Aufbau „OpenMapTiles“) und
     zeichnet selbst: Straßen als helle Linien, Orte, Stadtteile und Straßennamen hell mit dunklem Rand, dazu Schilder
     für Autobahnen (blau) und Bundesstraßen (gelb). Nichts überdeckt sich, auch keine Anfrage und kein Knopf.
     Gezeichnet wird in eine Fläche über dem Luftbild, wenn die Karte ruht. Beim Zoomen und Verschieben wird die fertige
     Zeichnung nur mitbewegt, das kostet nichts. Kommen keine Daten, bleibt es beim Luftbild ohne Namen. */
  const namen = { url: '', max: 14, start: null, daten: new Map(), laden: new Set(), ok: 0, fehler: 0, aus: false, bald: 0, stand: 0, el: null, ref: null };
  const NAMEN_RAND = 48; // so viele Bildpunkte rundherum mehr zeichnen: kurzes Verschieben zeigt sie schon
  const NAMEN_SCHRIFT = '"Barlow Semi Condensed", "Barlow", "Helvetica Neue", Arial, sans-serif';
  // Straßen: Art in OpenMapTiles, ab Zoomstufe, Breite, Farbe (von unten nach oben gezeichnet)
  const NAMEN_STRASSEN = [
    ['service', 16, 1, 'rgba(255,255,255,.26)'], ['minor', 14, 1.4, 'rgba(255,255,255,.4)'], ['tertiary', 12, 1.9, 'rgba(255,255,255,.52)'],
    ['secondary', 11, 2.3, 'rgba(255,246,222,.6)'], ['primary', 10, 2.7, 'rgba(255,238,186,.68)'], ['trunk', 8, 3, 'rgba(255,214,110,.76)'],
    ['motorway', 7, 3.2, 'rgba(255,198,80,.84)']
  ];
  const NAMEN_STRASSE_ART = {};
  NAMEN_STRASSEN.forEach((s) => { NAMEN_STRASSE_ART[s[0]] = 1; });
  const namenMoeglich = () => !!CONFIG.karte.beschriftung && !VORSCHAU && !namen.aus && !!window.fetch && !!window.TextDecoder;

  function namenStart() {
    const q = CONFIG.karte.beschriftung;
    if (namen.start || !namenMoeglich()) return;
    const fertig = (url, max) => { namen.url = url; namen.max = Math.max(0, Math.min(14, Number(max) || 14)); namenBald(); vektorWartende(); };
    if (/\{z\}/.test(q)) { namen.start = true; fertig(q, 14); return; }
    // Beschreibung des Dienstes (TileJSON) mit der Adresse der aktuellen Daten; sonst die Adresse für „neueste“
    namen.start = fetch(q).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Namen ' + r.status))))
      .then((j) => {
        const t = j && j.tiles && j.tiles[0];
        if (!/^https?:\/\/[^ ]+\{z\}/.test(t || '')) throw new Error('Namen: keine Adresse');
        fertig(t, j.maxzoom);
      })
      .catch(() => fertig(q.replace(/\/$/, '') + '/latest/{z}/{x}/{y}.pbf', 14));
  }

  // Daten eines Kartenquadrats: sofort, wenn schon geladen, sonst wird geladen und danach neu gezeichnet
  // Daten eines Quadrats gelesen (für Namen und das Zeichnen hier); null: kommt noch
  function namenDaten(z, x, y) {
    const e = namenEintrag(z, x, y);
    if (!e) return null;
    // Erst hier lesen (die Karte ruht gerade), nicht schon beim Ankommen mitten in einer Bewegung
    if (e.roh && !e.d) { try { e.d = mvtLesen(e.roh); } catch (err) { e.d = {}; } }
    return e.fehler ? {} : e.d;
  }
  // Manche Server schicken die Daten noch gepackt (gzip) ohne passende Kopfzeile: dann hier auspacken
  function entpacken(buf) {
    const b = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
    if (!window.DecompressionStream) throw new Error('gzip');
    return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  // Rohe Daten eines Quadrats (für die Werkstatt im Hintergrund); null: kommt noch, false: kam nicht
  function namenRoh(z, x, y) {
    const e = namenEintrag(z, x, y);
    return !e ? null : e.fehler ? false : e.roh;
  }
  function namenEintrag(z, x, y) {
    const key = z + '/' + x + '/' + y;
    let d = namen.daten.get(key);
    if (d && d.fehler && Date.now() - d.fehler > 20000) { namen.daten.delete(key); d = null; }
    if (d) {
      namen.daten.delete(key); namen.daten.set(key, d); // zuletzt benutzt: nach hinten
      return d;
    }
    if (namen.aus || !namen.url || namen.laden.has(key) || namen.laden.size >= 8) return null;
    namen.laden.add(key);
    fetch(namen.url.replace('{z}', z).replace('{x}', x).replace('{y}', y))
      .then((r) => { if (!r.ok) throw new Error('Namen ' + r.status); return r.arrayBuffer(); })
      .then(entpacken)
      .then((buf) => { namen.daten.set(key, { roh: buf }); namen.ok++; },
        () => {
          namen.daten.set(key, { fehler: Date.now() }); // nicht sofort wieder versuchen
          namen.fehler++;
          if (!namen.ok && namen.fehler >= 4) namenAus();
        })
      .then(() => {
        namen.laden.delete(key);
        while (namen.daten.size > 80) namen.daten.delete(namen.daten.keys().next().value);
        namen.stand++;
        namenBald();
        vektorWartende();
      });
    return null;
  }
  function namenAus() {
    namen.aus = true;
    if (namen.el) namen.el.style.display = 'none';
    const c = umgebung.el && umgebung.el.querySelector('.u-namen');
    if (c) c.style.display = 'none';
    // Die eigene Karte braucht diese Daten: dann fertige Kartenbilder nehmen
    const kc = kacheln, u = umgebung;
    if (kc.quellen[kc.nr] && kc.quellen[kc.nr].vektor && kartenStatus.huelle) {
      if (kc.nr + 1 < kc.quellen.length) { kachelQuelleSetzen(kc.nr + 1); if (kartenStatus.blick) kachelnLegen(kartenStatus.blick); } else kachelnAus();
    }
    if (u.quellen && u.quellen[u.nr] && u.quellen[u.nr].vektor) { if (u.nr + 1 < u.quellen.length) u.nr++; else u.aus = true; u.el.querySelector('.u-kacheln').textContent = ''; }
    kartenArtZeigen();
    if (u.el) { u.schluessel = ''; umgebungZeichnen(); }
  }

  // Teile einer Linie (Bildschirmpunkte), die im Rechteck 0…w × 0…h liegen (an den Rändern abgeschnitten)
  function linieImBild(pt, w, h) {
    const teile = [];
    let teil = null;
    for (let i = 0; i + 3 < pt.length; i += 2) {
      let ax = pt[i], ay = pt[i + 1], bx = pt[i + 2], by = pt[i + 3], t0 = 0, t1 = 1;
      const dx = bx - ax, dy = by - ay;
      // Liang-Barsky: Strecke auf das Rechteck kürzen
      const kanten = [[-dx, ax], [dx, w - ax], [-dy, ay], [dy, h - ay]];
      let raus = false;
      for (let k = 0; k < 4 && !raus; k++) {
        const pp = kanten[k][0], q = kanten[k][1];
        if (pp === 0) { if (q < 0) raus = true; continue; }
        const r = q / pp;
        if (pp < 0) { if (r > t1) raus = true; else if (r > t0) t0 = r; } else if (r < t0) raus = true; else if (r < t1) t1 = r;
      }
      if (raus) { teil = null; continue; }
      const sx = ax + dx * t0, sy = ay + dy * t0, ex = ax + dx * t1, ey = ay + dy * t1;
      if (!teil || t0 > 0) { teil = [sx, sy]; teile.push(teil); }
      teil.push(ex, ey);
      if (t1 < 1) teil = null;
    }
    return teile;
  }
  // Längstes fast gerades, sichtbares Stück einer Linie, mindestens noetig lang: Mitte und Winkel für den Namen
  function linienPlatz(linie, noetig, w, h) {
    let best = null;
    linieImBild(linie, w, h).forEach((pt) => {
      for (let i = 0; i + 3 < pt.length;) {
        const w0 = Math.atan2(pt[i + 3] - pt[i + 1], pt[i + 2] - pt[i]);
        let j = i + 2, len = Math.sqrt((pt[j] - pt[i]) * (pt[j] - pt[i]) + (pt[j + 1] - pt[i + 1]) * (pt[j + 1] - pt[i + 1]));
        while (j + 3 < pt.length) {
          let d = Math.abs(Math.atan2(pt[j + 3] - pt[j + 1], pt[j + 2] - pt[j]) - w0);
          if (d > Math.PI) d = 2 * Math.PI - d;
          if (d > 0.3) break;
          len += Math.sqrt((pt[j + 2] - pt[j]) * (pt[j + 2] - pt[j]) + (pt[j + 3] - pt[j + 1]) * (pt[j + 3] - pt[j + 1]));
          j += 2;
        }
        if (len >= noetig && (!best || len > best.len)) {
          // Mitte des Stücks (entlang der Linie)
          let rest = len / 2, x = pt[i], y = pt[i + 1];
          for (let q = i; q < j; q += 2) {
            const sl = Math.sqrt((pt[q + 2] - pt[q]) * (pt[q + 2] - pt[q]) + (pt[q + 3] - pt[q + 1]) * (pt[q + 3] - pt[q + 1]));
            if (sl >= rest) { x = pt[q] + (pt[q + 2] - pt[q]) * rest / sl; y = pt[q + 1] + (pt[q + 3] - pt[q + 1]) * rest / sl; break; }
            rest -= sl;
          }
          best = { len, x, y, wi: Math.atan2(pt[j + 1] - pt[i + 1], pt[j] - pt[i]) };
        }
        i = j;
      }
    });
    // Lesbar von links nach rechts, senkrechte Namen von unten nach oben (wie auf gedruckten Karten)
    if (best) { if (best.wi > Math.PI / 2 - 0.01) best.wi -= Math.PI; else if (best.wi < -Math.PI / 2 - 0.01) best.wi += Math.PI; }
    return best;
  }
  // Punkt bei Anteil a (0…1) der Länge des längsten sichtbaren Teils einer Linie (für Schilder)
  function linienPunkt(linie, w, h, a) {
    let pt = null, lang = 0;
    linieImBild(linie, w, h).forEach((t) => {
      let l = 0;
      for (let i = 0; i + 3 < t.length; i += 2) l += Math.abs(t[i + 2] - t[i]) + Math.abs(t[i + 3] - t[i + 1]);
      if (l > lang) { lang = l; pt = t; }
    });
    if (!pt) return null;
    let len = 0;
    for (let i = 0; i + 3 < pt.length; i += 2) len += Math.sqrt((pt[i + 2] - pt[i]) * (pt[i + 2] - pt[i]) + (pt[i + 3] - pt[i + 1]) * (pt[i + 3] - pt[i + 1]));
    let rest = len * a;
    for (let i = 0; i + 3 < pt.length; i += 2) {
      const sl = Math.sqrt((pt[i + 2] - pt[i]) * (pt[i + 2] - pt[i]) + (pt[i + 3] - pt[i + 1]) * (pt[i + 3] - pt[i + 1]));
      if (sl >= rest && sl > 0) return { x: pt[i] + (pt[i + 2] - pt[i]) * rest / sl, y: pt[i + 1] + (pt[i + 3] - pt[i + 1]) * rest / sl };
      rest -= sl;
    }
    return { x: pt[0], y: pt[1] };
  }
  function abgerundet(ctx, l, o, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(l + r, o); ctx.lineTo(l + w - r, o); ctx.arcTo(l + w, o, l + w, o + r, r); ctx.lineTo(l + w, o + h - r); ctx.arcTo(l + w, o + h, l + w - r, o + h, r);
    ctx.lineTo(l + r, o + h); ctx.arcTo(l, o + h, l, o + h - r, r); ctx.lineTo(l, o + r); ctx.arcTo(l, o, l + r, o, r); ctx.closePath();
  }

  /* Straßen und Namen für den Ausschnitt b (Bildschirm = Meter · s + x) in die Zeichenfläche cv malen.
     w, h: Größe des Ausschnitts, rand: so viel mehr rundherum, z: Zoomstufe der Kartenbilder, belegt: freizuhaltende
     Rechtecke { l, o, r, u }. Gibt zurück, ob alle Daten da waren. */
  // Farben der Namen: auf dem Luftbild hell mit dunklem Rand, auf der eigenen Karte dunkel mit hellem Rand
  const NAMEN_FARBEN = {
    foto: { ort: '#FFFFFF', teil: '#F4F1EA', strasse: '#F4F1EA', wasser: '#DDF0FB', land: '#F1E9FF', rand: 'rgba(10, 14, 20, .82)' },
    hell: { ort: '#26303B', teil: '#55606C', strasse: '#3A444F', wasser: '#33688C', land: '#6D5C8D', rand: 'rgba(250, 251, 247, .94)' },
    dunkel: { ort: '#E6EBF0', teil: '#AAB5C1', strasse: '#B8C2CD', wasser: '#80B3D5', land: '#BBACD8', rand: 'rgba(14, 20, 28, .92)' }
  };
  function namenMalen(cv, b, w, h, rand, z, belegt, art) {
    const foto = art !== 'karte', fb = NAMEN_FARBEN[foto ? 'foto' : dunklesThema() ? 'dunkel' : 'hell'];
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = w + 2 * rand, H = h + 2 * rand;
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(dpr, 0, 0, dpr, rand * dpr, rand * dpr);
    if (!namen.url) return false;
    // Welche Kartenquadrate der Daten liegen im Bild? (Daten gibt es bis Zoomstufe 14, näher wird vergrößert)
    const dz = Math.min(namen.max, z), n = Math.pow(2, dz), T = WELT / n, ox = NULLPUNKT.x + WELT / 2, oy = NULLPUNKT.y + WELT / 2;
    const fest = (v) => Math.max(0, Math.min(n - 1, Math.floor(v / T)));
    const x0 = fest(ox + (-rand - b.x) / b.s), x1 = fest(ox + (w + rand - b.x) / b.s), y0 = fest(oy + (-rand - b.y) / b.s), y1 = fest(oy + (h + rand - b.y) / b.s);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 48) return true; // zu weit heraus
    const stuecke = [];
    let alle = true;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const d = namenDaten(dz, x, y);
      if (!d) { alle = false; continue; }
      if (d.ebene) stuecke.push({ d, sx: (x * T - ox) * b.s + b.x, sy: (y * T - oy) * b.s + b.y, T });
    }
    const punkte = (st, ext, teil) => {
      const f = st.T / ext * b.s, out = new Array(teil.length);
      for (let i = 0; i < teil.length; i += 2) { out[i] = st.sx + teil[i] * f; out[i + 1] = st.sy + teil[i + 1] * f; }
      return out;
    };
    // 1. Auf dem Luftbild: Straßen als helle Linien, wichtige oben (die eigene Karte hat sie schon)
    const fak = z < 11 ? 0.7 : z < 14 ? 0.9 : z < 16 ? 1.15 : z < 17 ? 1.5 : 1.9;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (foto) NAMEN_STRASSEN.forEach(([art, ab, breite, farbe]) => {
      if (z < ab) return;
      let etwas = false;
      ctx.beginPath();
      stuecke.forEach((st) => {
        const e = st.d.ebene && st.d.ebene('transportation');
        if (!e) return;
        e.liste.forEach((m) => {
          if (m.typ !== 2 || m.eig.class !== art) return;
          m.teile.forEach((t) => {
            const p = punkte(st, e.extent, t);
            ctx.moveTo(p[0], p[1]);
            for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
            etwas = true;
          });
        });
      });
      if (etwas) { ctx.lineWidth = breite * fak; ctx.strokeStyle = farbe; ctx.stroke(); }
    });
    // 2. Namen sammeln: Orte, Schilder, Straßennamen
    const kand = [];
    stuecke.forEach((st) => {
      const orte = st.d.ebene('place'), str = st.d.ebene('transportation_name');
      if (orte) orte.liste.forEach((m) => {
        const name = m.eig['name:de'] || m.eig.name_de || m.eig.name;
        // Länder und Bundesländer nur weit heraus (dann sieht man, wo Deutschland aufhört)
        if (name && m.typ === 1 && ((m.eig.class === 'country' && z <= 8) || (m.eig.class === 'state' && z >= 6 && z <= 8))) {
          const p = punkte(st, orte.extent, m.teile[0]), land = m.eig.class === 'country';
          kand.push({ art: 'ort', prio: land ? 50 : 60, text: name, x: p[0], y: p[1], g: land ? 15 : 12.5, s: land ? 700 : 600, farbe: land ? fb.land : fb.teil });
          return;
        }
        const a = NAMEN_ORTE[m.eig.class];
        if (!a || !name || z < a[0] || m.typ !== 1) return;
        if (m.eig.class === 'city' && z < 8 && (m.eig.rank || 99) > 4) return;
        const p = punkte(st, orte.extent, m.teile[0]);
        kand.push({ art: 'ort', prio: a[1] * 100 + Math.min(99, m.eig.rank || 50), text: name, x: p[0], y: p[1], g: a[2], s: a[3], farbe: a[1] >= 3 ? fb.teil : fb.ort });
      });
      // Seen und Meere (Punkt oder Linie), Flüsse entlang ihres Laufs
      const gew = st.d.ebene('water_name'), fluss = z >= 12 && st.d.ebene('waterway');
      if (gew && z >= 9) gew.liste.forEach((m) => {
        const name = m.eig['name:de'] || m.eig.name_de || m.eig.name;
        if (!name) return;
        if (m.typ === 1) { const p = punkte(st, gew.extent, m.teile[0]); kand.push({ art: 'ort', prio: 250, text: name, x: p[0], y: p[1], g: 13, s: 600, farbe: fb.wasser, kursiv: true }); }
        else if (m.typ === 2) m.teile.forEach((t) => kand.push({ art: 'strasse', prio: 260, text: name, linie: punkte(st, gew.extent, t), farbe: fb.wasser, kursiv: true }));
      });
      if (fluss) fluss.liste.forEach((m) => {
        const name = m.eig['name:de'] || m.eig.name_de || m.eig.name;
        if (!name || m.typ !== 2 || (m.eig.class !== 'river' && m.eig.class !== 'canal' && z < 15)) return;
        m.teile.forEach((t) => kand.push({ art: 'strasse', prio: 270, text: name, linie: punkte(st, fluss.extent, t), farbe: fb.wasser, kursiv: true }));
      });
      if (str) str.liste.forEach((m) => {
        const c = m.eig.class, ref = String(m.eig.ref || '').split(';')[0].trim(), name = m.eig['name:de'] || m.eig.name_de || m.eig.name;
        const linien = m.teile.map((t) => punkte(st, str.extent, t));
        const autobahn = c === 'motorway' && /^A ?\d/.test(ref), bund = (c === 'trunk' || c === 'primary') && /^B ?\d/.test(ref);
        if ((autobahn && z >= 7) || (bund && z >= 10)) {
          linien.forEach((p) => kand.push({ art: 'schild', prio: autobahn ? 150 : 160, text: ref.replace(/^([AB]) ?/, '$1 '), linie: p, autobahn }));
        }
        if (m.typ !== 2) return;
        const a = NAMEN_STRASSENNAMEN[c];
        if (a && name && z >= a[0] && (c !== 'path' || m.eig.subclass === 'pedestrian')) linien.forEach((p) => kand.push({ art: 'strasse', prio: 300 + a[1] * 10, text: name, linie: p }));
      });
    });
    kand.sort((a, b2) => a.prio - b2.prio);
    // 3. Platz suchen: nichts darf sich überdecken, auch keine Anfrage, kein Knopf
    const besetzt = belegt.slice(), gesetzt = [], schonDa = {};
    const L = 4; // so viel Luft bleibt um jeden Namen
    const frei = (l, o, r, u) => l >= -rand && o >= -rand && r <= w + rand && u <= h + rand && !besetzt.some((q) => l - L < q.r && r + L > q.l && o - L < q.u && u + L > q.o);
    const nah = (text, x, y, abstand) => (schonDa[text] || []).some((q) => Math.abs(q.x - x) < abstand && Math.abs(q.y - y) < abstand);
    const merken = (k, box) => { besetzt.push(box); gesetzt.push(k); (schonDa[k.text] = schonDa[k.text] || []).push({ x: k.x, y: k.y }); };
    const strGroesse = z >= 17 ? 13.5 : 12.5;
    kand.forEach((k) => {
      if (k.art === 'ort') {
        if (nah(k.text, k.x, k.y, 120)) return;
        ctx.font = `${k.s} ${k.g}px ${NAMEN_SCHRIFT}`;
        const tw = ctx.measureText(k.text).width, x = k.x;
        // Liegt dort eine Anfrage, steht der Name etwas darüber oder darunter
        [0, -k.g * 1.5, k.g * 1.5, -k.g * 2.6, k.g * 2.6].some((dy) => {
          const y = k.y + dy, box = { l: x - tw / 2 - 3, o: y - k.g * 0.62, r: x + tw / 2 + 3, u: y + k.g * 0.62 };
          if (box.l < 2 || box.r > w - 2 || box.o < 2 || box.u > h - 2 || !frei(box.l, box.o, box.r, box.u)) return false;
          k.y = y; merken(k, box);
          return true;
        });
      } else if (k.art === 'schild') {
        ctx.font = `700 12px ${NAMEN_SCHRIFT}`;
        k.tw = ctx.measureText(k.text).width;
        // In der Mitte der Strecke, sonst etwas daneben (dort steht vielleicht eine Anfrage)
        const stellen = k.linie.length === 2 ? [{ x: k.linie[0], y: k.linie[1] }] : [0.5, 0.3, 0.7, 0.15, 0.85].map((a) => linienPunkt(k.linie, w, h, a));
        stellen.some((mi) => {
          if (!mi || nah(k.text, mi.x, mi.y, 260)) return false;
          const box = { l: mi.x - k.tw / 2 - 6, o: mi.y - 10, r: mi.x + k.tw / 2 + 6, u: mi.y + 10 };
          if (box.l < 2 || box.r > w - 2 || box.o < 2 || box.u > h - 2 || !frei(box.l, box.o, box.r, box.u)) return false;
          k.x = mi.x; k.y = mi.y; merken(k, box);
          return true;
        });
      } else {
        ctx.font = `${k.kursiv ? 'italic ' : ''}600 ${strGroesse}px ${NAMEN_SCHRIFT}`;
        const tw = ctx.measureText(k.text).width;
        const pl = linienPlatz(k.linie, tw + 16, w, h);
        if (!pl || nah(k.text, pl.x, pl.y, 220)) return;
        Object.assign(k, { x: pl.x, y: pl.y, wi: pl.wi, tw });
        const c = Math.abs(Math.cos(pl.wi)), s = Math.abs(Math.sin(pl.wi)), hw = tw / 2 + 2, hh = strGroesse * 0.6;
        const box = { l: pl.x - c * hw - s * hh, o: pl.y - s * hw - c * hh, r: pl.x + c * hw + s * hh, u: pl.y + s * hw + c * hh };
        if (frei(box.l, box.o, box.r, box.u)) merken(k, box);
      }
    });
    // 4. Zeichnen: hell mit dunklem Rand, Schilder in den Farben der echten Schilder
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    gesetzt.forEach((k) => {
      if (k.art === 'schild') {
        ctx.font = `700 12px ${NAMEN_SCHRIFT}`;
        abgerundet(ctx, k.x - k.tw / 2 - 5, k.y - 9, k.tw + 10, 18, 3.5);
        ctx.fillStyle = k.autobahn ? '#1F4E9B' : '#F5C400'; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = k.autobahn ? '#FFFFFF' : '#1B1F24'; ctx.stroke();
        ctx.fillStyle = k.autobahn ? '#FFFFFF' : '#1B1F24';
        ctx.fillText(k.text, k.x, k.y + 0.5);
        return;
      }
      const ort = k.art === 'ort';
      ctx.font = (k.kursiv ? 'italic ' : '') + (ort ? `${k.s} ${k.g}px ${NAMEN_SCHRIFT}` : `600 ${strGroesse}px ${NAMEN_SCHRIFT}`);
      ctx.save();
      ctx.translate(k.x, k.y);
      if (!ort) ctx.rotate(k.wi);
      ctx.lineWidth = ort ? 3.6 : 3;
      ctx.strokeStyle = fb.rand;
      ctx.strokeText(k.text, 0, 0);
      ctx.fillStyle = k.farbe || fb.strasse;
      ctx.fillText(k.text, 0, 0);
      ctx.restore();
    });
    return alle;
  }

  // Später zeichnen (gebündelt), z. B. wenn Daten angekommen sind
  function namenBald() {
    clearTimeout(namen.bald);
    namen.bald = setTimeout(() => { namenGross(); umgebungNamen(); }, 60);
  }
  // Große Karte: nur wenn das Luftbild zu sehen ist, und erst, wenn die Karte ruht
  function namenGross() {
    const k = kartenStatus, el = namen.el;
    if (!el) return;
    const foto = k.huelle.parentNode.classList.contains('k-foto'), q = kacheln.quellen[kacheln.nr];
    const art = foto ? 'foto' : q && q.vektor && !kacheln.aus ? 'karte' : null;
    const an = namenMoeglich() && ui.view === 'karte' && !!k.blick && !!k.w && !!art;
    el.style.display = an ? '' : 'none';
    if (!an) return;
    // Erst zeichnen, wenn die Karte eine Viertelsekunde ruht (sonst stockt die nächste Bewegung)
    const ruhe = performance.now() - (k.bewegtUm || 0);
    if (k.finger || k.ziel || k.rad || ruhe < 250) { clearTimeout(namen.bald); namen.bald = setTimeout(namenBald, Math.max(60, 260 - ruhe)); return; }
    namenStart();
    if (!namen.url) return; // kommt nach dem Start von selbst
    const b = k.blick, rahmen = k.huelle.getBoundingClientRect();
    // Freihalten: Knöpfe, Quellenangabe, Maßstab und alle Anfragen auf der Karte
    const belegt = [...document.querySelectorAll('.karte-knoepfe, .k-quelle-box .quelle-knopf, #map .k-massstab, .karte-art:not([hidden]), #map .k-schicht .pin, #map .k-schicht .k-sammel, #map .k-schicht .k-ich i, #map .k-schicht .k-ich b')]
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width)
      .map((r) => ({ l: r.left - rahmen.left - 3, o: r.top - rahmen.top - 3, r: r.right - rahmen.left + 3, u: r.bottom - rahmen.top + 3 }));
    // Nichts verändert (gleicher Ausschnitt, gleiche Daten, Anfragen an denselben Stellen): nicht neu zeichnen
    const schluessel = [b.s, b.x, b.y, k.w, k.h, namen.stand, namen.url, art, dunklesThema(), JSON.stringify(belegt.map((q2) => [Math.round(q2.l), Math.round(q2.o)]))].join('|');
    if (schluessel === namen.schluessel && namen.ref) { namenBewegen(b); return; }
    namen.schluessel = schluessel;
    namenMalen(el.firstChild, b, k.w, k.h, NAMEN_RAND, kachelZoom(b.s), belegt, art);
    namen.ref = { s: b.s, x: b.x, y: b.y };
    el.style.transform = '';
    if (namen.weg) { namen.weg = false; el.style.opacity = ''; }
  }
  // Beim Bewegen: die fertige Zeichnung nur verschieben und skalieren
  function namenBewegen(b) {
    const el = namen.el, r = namen.ref;
    if (!el || !r || el.style.display === 'none') return;
    const f = b.s / r.s;
    el.style.transform = `translate3d(${b.x - r.x * f}px, ${b.y - r.y * f}px, 0) scale(${f})`;
    // Stark vergrößert oder verkleinert wäre die Schrift riesig oder winzig: bis zum neuen Zeichnen ausblenden
    const weg = f > 1.6 || f < 0.65;
    if (weg !== !!namen.weg) { namen.weg = weg; el.style.opacity = weg ? '0' : ''; }
  }
  // Kleine Karte auf der Startseite (steht still)
  function umgebungNamen() {
    const u = umgebung, a = u.namenFuer;
    const cv = u.el && u.el.querySelector('.u-namen');
    if (!cv) return;
    const q = !u.aus && u.quellen && u.quellen[u.nr], foto = u.el && u.el.classList.contains('k-foto');
    const art = foto ? 'foto' : q && q.vektor ? 'karte' : null;
    const an = !!a && namenMoeglich() && !!art && !!u.w;
    cv.style.display = an ? '' : 'none';
    if (!an) return;
    namenStart();
    const schluessel = [a.b.z, a.b.x, a.b.y, u.w, u.h, JSON.stringify(a.belegt), namen.stand, namen.url, art, dunklesThema()].join('|');
    if (schluessel === u.namenSchluessel) return;
    u.namenSchluessel = schluessel;
    namenMalen(cv, a.b, u.w, u.h, 0, a.b.z, a.belegt, art);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { umgebung.namenSchluessel = ''; namenBald(); });

  /* ===== Eigene Straßenkarte: von der App selbst gezeichnet =====
     Statt fertiger Kartenbilder zeichnet die App die Karte selbst aus den Daten von OpenStreetMap (dieselben Daten
     wie die Namen über dem Luftbild): Siedlungen, Wald, Wiesen, Wasser, Häuser, Straßen, Bahnlinien und Grenzen.
     Vorteile: überall gleich genau (auch in den Nachbarländern), ein Stil, der zur App passt, hell und dunkel ohne
     Farbfilter, und beim Zoomen gibt es keine fremde Karte, die durchscheint. Gezeichnet wird je Kartenquadrat in eine
     Zeichenfläche, in kleinen Portionen pro Bild, damit Bewegungen flüssig bleiben. Erst wenn die Daten gar nicht
     kommen, nimmt die App fertige Kartenbilder (basemap.de, OpenStreetMap). */
  /* Zeichnen: am liebsten im Hintergrund (Web Worker mit eigener Zeichenfläche). Die Werkstatt bekommt die Daten,
     zeichnet ein Quadrat und schickt ein fertiges Bild zurück; hier wird es wie ein normales Kartenbild gezeigt. Das
     Handy zeichnet so nebenher, die Karte bleibt beim Zoomen flüssig. Ohne Hintergrund zeichnet die App hier, aber
     nur, wenn die Karte ruht. Die Mitte zuerst. */
  const malen = { liste: [], bild: 0, cv: null };
  const werk = { w: null, aus: false, bereit: false, hat: [], offen: new Map(), id: 0 };
  const zeichenDpr = () => Math.min(2, window.devicePixelRatio || 1);
  function werkStarten() {
    if (werk.w || werk.aus) return;
    try {
      if (!window.Worker || !window.OffscreenCanvas || !window.Blob || !window.URL || !URL.createObjectURL) throw new Error('kein Hintergrund');
      const quelle = 'const W = (' + kartenWerkstatt.toString() + ')();\n' + `
        const daten = new Map(); let cv = null;
        const lesen = (key) => { const e = daten.get(key); if (!e) return null; daten.delete(key); daten.set(key, e); if (e.roh) { try { e.d = W.mvtLesen(e.roh); } catch (x) { e.d = {}; } e.roh = null; } return e.d; };
        onmessage = (ev) => {
          const m = ev.data;
          if (m.typ === 'daten') { daten.set(m.key, m.buf ? { roh: m.buf } : { d: {} }); while (daten.size > 48) daten.delete(daten.keys().next().value); return; }
          if (m.typ !== 'malen') return;
          const d = lesen(m.key);
          if (!d) { postMessage({ id: m.id, fehlt: true, key: m.key }); return; }
          try {
            cv = cv || new OffscreenCanvas(512, 512);
            const r = W.vektorMalen(cv, d, m.z, m.x, m.y, m.dz, m.stil, m.dpr);
            cv.convertToBlob({ type: 'image/png' }).then((blob) => postMessage({ id: m.id, blob, leer: r === 'leer' }), () => postMessage({ id: m.id, kaputt: true }));
          } catch (x) { postMessage({ id: m.id, kaputt: true }); }
        };
        let ok = false;
        try { ok = !!new OffscreenCanvas(4, 4).getContext('2d') && typeof OffscreenCanvas.prototype.convertToBlob === 'function'; } catch (x) { ok = false; }
        postMessage({ typ: 'bereit', ok });`;
      const url = URL.createObjectURL(new Blob([quelle], { type: 'text/javascript' }));
      werk.w = new Worker(url);
      werk.w.onmessage = werkAntwort;
      werk.w.onerror = () => werkAus();
      setTimeout(() => { if (!werk.bereit) werkAus(); }, 4000); // meldet sich nicht: hier zeichnen
    } catch (e) { werkAus(); }
  }
  // Hintergrund geht nicht: alles, was dort lag, hier zeichnen
  function werkAus() {
    if (werk.w) { try { werk.w.terminate(); } catch (e) { /* egal */ } }
    werk.w = null; werk.aus = true; werk.bereit = false;
    werk.offen.forEach((t) => vektorPlanen(t));
    werk.offen.clear();
    vektorWeiter();
  }
  function werkAntwort(ev) {
    const m = ev.data;
    if (m.typ === 'bereit') { if (m.ok) { werk.bereit = true; vektorWeiter(); } else werkAus(); return; }
    const t = werk.offen.get(m.id);
    werk.offen.delete(m.id);
    if (m.fehlt) { werk.hat = werk.hat.filter((k2) => k2 !== m.key); if (t) vektorPlanen(t); }
    else if (m.kaputt) { if (t) { werkAus(); } }
    else if (t) { t.wartet = !!m.leer; bildSetzen(t, URL.createObjectURL(m.blob)); }
    vektorWeiter();
  }
  // Fertiges Bild zeigen; das alte erst freigeben, wenn das neue da ist (kein Flackern)
  function bildSetzen(t, url, geladen) {
    if (!t.img.parentNode) { if (/^blob:/.test(url)) URL.revokeObjectURL(url); return; }
    const alt = t.img.src;
    // Neu gezeichnet (z. B. dunkel): erst laden, dann tauschen, damit das Quadrat nie kurz leer ist
    if (alt && !geladen) {
      const vor = new Image();
      vor.onload = vor.onerror = () => bildSetzen(t, url, true);
      vor.src = url;
      return;
    }
    t.img.onload = () => {
      t.img.onload = null;
      if (/^blob:/.test(alt) && alt !== url) URL.revokeObjectURL(alt);
      if (t.vorschau) { t.img.dataset.fertig = t.schl; return; }
      if (t.klein) { t.img.className = 'k-kachel da'; t.img.dataset.geladen = '1'; umgebungBasis(); return; }
      if (!t.fertig) { t.fertig = true; kacheln.ok++; }
      basisAuffrischen(t); altesWeg();
    };
    t.img.src = url;
  }
  function vektorPlanen(t) {
    namenStart();
    if (t.inListe) return;
    t.inListe = true;
    malen.liste.push(t);
    vektorWeiter();
  }
  function vektorWeiter() {
    if (!malen.bild && malen.liste.length) malen.bild = requestAnimationFrame(vektorSchritt);
  }
  function vektorSchritt() {
    malen.bild = 0;
    werkStarten();
    const k = kartenStatus, ruhig = !(k.finger || k.ziel || k.rad) && performance.now() - (k.bewegtUm || 0) > 150;
    // Wichtigstes zuerst: aktuelle Stufe, nahe der Mitte
    if (malen.liste.length > 1 && k.blick) {
      const mx = (k.w / 2 - k.blick.x) / k.blick.s + NULLPUNKT.x + WELT / 2, my = (k.h / 2 - k.blick.y) / k.blick.s + NULLPUNKT.y + WELT / 2;
      const rang = (t) => (t.klein || t.vorschau || t.z === kacheln.z ? 0 : 1e9) + Math.abs((t.x + 0.5) * WELT / Math.pow(2, t.z) - mx) + Math.abs((t.y + 0.5) * WELT / Math.pow(2, t.z) - my);
      malen.liste.sort((a, b) => rang(a) - rang(b));
    }
    const stil = dunklesThema() ? 'dunkel' : 'hell', dpr = zeichenDpr();
    if (werk.w && !werk.bereit) { setTimeout(vektorWeiter, 50); return; } // Hintergrund startet noch
    if (werk.w) {
      // Im Hintergrund: einige Aufträge gleichzeitig unterwegs, der Rest wartet hier
      while (malen.liste.length && werk.offen.size < 4) {
        const t = malen.liste.shift();
        t.inListe = false;
        if (!t.img.parentNode) continue;
        const dz = Math.min(namen.max, t.z), f = Math.pow(2, t.z - dz), px = Math.floor(t.x / f), py = Math.floor(t.y / f), key = dz + '/' + px + '/' + py;
        const roh = namenRoh(dz, px, py);
        if (roh === null) { t.wartet = true; continue; } // Daten kommen noch
        if (werk.hat.indexOf(key) < 0) {
          werk.w.postMessage({ typ: 'daten', key, buf: roh || null });
          werk.hat.push(key);
          if (werk.hat.length > 40) werk.hat.shift();
        }
        const id = ++werk.id;
        werk.offen.set(id, t);
        werk.w.postMessage({ typ: 'malen', id, key, z: t.z, x: t.x, y: t.y, dz, stil, dpr });
      }
      return;
    }
    // Hier zeichnen: nur in Ruhe, ein paar Millisekunden pro Bild
    if (!ruhig) { setTimeout(vektorWeiter, 120); return; }
    const start = performance.now();
    let gemalt = 0;
    while (malen.liste.length && (gemalt === 0 || performance.now() - start < 10)) {
      const t = malen.liste.shift();
      t.inListe = false;
      if (!t.img.parentNode) continue;
      const dz = Math.min(namen.max, t.z), f = Math.pow(2, t.z - dz);
      const d = namenDaten(dz, Math.floor(t.x / f), Math.floor(t.y / f));
      if (!d) { t.wartet = true; continue; }
      const cv = malen.cv || (malen.cv = document.createElement('canvas'));
      const r = WERKSTATT.vektorMalen(cv, d, t.z, t.x, t.y, dz, stil, dpr);
      gemalt++;
      t.wartet = r === 'leer';
      bildAusZeichnung(cv, t);
    }
    vektorWeiter();
  }
  function bildAusZeichnung(cv, t) {
    if (cv.toBlob && window.URL && URL.createObjectURL) cv.toBlob((blob) => bildSetzen(t, blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png')), 'image/png');
    else bildSetzen(t, cv.toDataURL('image/png'));
  }
  // Daten angekommen: wartende Quadrate noch einmal versuchen
  function vektorWartende() {
    kacheln.bilder.forEach((t) => { if (t.vektor && t.wartet) { t.wartet = false; vektorPlanen(t); } });
    const v = kartenStatus.vorschauBild;
    if (v && v.wartet) { v.wartet = false; vektorPlanen(v); }
    (umgebung.vektor || []).forEach((t) => { if (t.wartet && t.img.parentNode) { t.wartet = false; vektorPlanen(t); } });
  }
  // Hell/dunkel gewechselt: alles in den neuen Farben neu zeichnen (die alte Zeichnung bleibt bis dahin stehen)
  function vektorNeuFaerben() {
    kacheln.bilder.forEach((t) => { if (t.vektor && t.fertig) vektorPlanen(t); });
    (umgebung.vektor || []).forEach((t) => { if (t.img.parentNode) vektorPlanen(t); });
  }
  function kachelWeg(t, key) {
    t.img.onload = t.img.onerror = null;
    if (t.img.parentNode) t.img.parentNode.removeChild(t.img);
    if (/^blob:/.test(t.img.src)) URL.revokeObjectURL(t.img.src); // selbst gezeichnete Bilder sofort freigeben
    kacheln.bilder.delete(key);
  }
  function kachelnLeeren() {
    kacheln.bilder.forEach((t, key) => kachelWeg(t, key));
    kacheln.z = null; kacheln.vorZ = null; kacheln.ref = null;
    schichtenVerschieben('');
  }
  // Straßenkarte und Luftbild liegen in zwei Ebenen, die sich immer gemeinsam bewegen
  function schichtenVerschieben(t) {
    if (kacheln.el) kacheln.el.style.transform = t;
    if (luft.el) luft.el.style.transform = t;
  }
  function kachelnStarten() {
    kacheln.quellen = VORSCHAU ? [] : kachelQuellen();
    if (!kacheln.quellen.length || navigator.onLine === false) kachelnAus();
    else kachelQuelleSetzen(0);
  }
  function kachelQuelleSetzen(nr) {
    const kc = kacheln, q = kc.quellen[nr];
    const warAus = kc.aus;
    kachelnLeeren();
    Object.assign(kc, { nr, ok: 0, fehler: 0, aus: false });
    const h = kartenStatus.huelle;
    h.classList.remove('ohne-kacheln');
    h.classList.toggle('k-filter', !q.carto && !q.foto && !q.vektor);
    h.classList.toggle('k-vektor', !!q.vektor);
    kartenArtZeigen();
    $('#karte-hinweis').hidden = true;
    if (warAus) renderKarte();
  }
  function kachelnAus() {
    const kc = kacheln;
    kachelnLeeren();
    kc.aus = true;
    kartenStatus.huelle.classList.add('ohne-kacheln');
    kartenStatus.huelle.classList.remove('k-filter', 'k-vektor');
    const quelle = $('.k-quelle');
    quelle.textContent = 'Vereinfacht · Lage: © OpenStreetMap-Mitwirkende, GeoNames';
    quelle.dataset.text = '';
    kartenArtZeigen();
    // Hinweis direkt auf der Karte, damit niemand die vereinfachte Zeichnung für die echte Karte hält
    const hinweis = $('#karte-hinweis');
    hinweis.innerHTML = VORSCHAU
      ? `<p><strong>Die echte Straßenkarte gibt es nur in der App.</strong> Hier im Chat darf die Vorschau keine Kartenbilder laden, deshalb siehst du nur die Anfragen und (in Garbsen) die Stadtteile vereinfacht.</p><a class="btn btn-primary btn-auto" href="${OEFFENTLICH}#karte" target="_blank" rel="noopener">Karte in der App öffnen</a>`
      : '<p><strong>Straßenkarte gerade nicht erreichbar.</strong> Du siehst nur die Anfragen. Sobald das Internet wieder da ist, kommt sie zurück.</p>';
    hinweis.hidden = false;
    // Ohne Kartenbilder lässt sich nicht so nah heranzoomen
    if (kartenStatus.blick && kartenStatus.w) kartenStatus.blick = blickBegrenzen(kartenStatus.blick);
    renderKarte();
  }
  function kachelFehler() {
    const kc = kacheln;
    kc.fehler++;
    if (kc.ok || kc.fehler < 4) return;
    if (kc.nr + 1 < kc.quellen.length) { kachelQuelleSetzen(kc.nr + 1); if (kartenStatus.blick) kachelnLegen(kartenStatus.blick); }
    else kachelnAus();
  }
  // Welche Zoomstufe der Kartenbilder passt zum Maßstab? Bilder werden zwischen 0,8- und 1,6-fach gezeigt,
  // damit Straßennamen gut lesbar bleiben.
  function kachelZoom(s) {
    const q = kacheln.quellen[kacheln.nr];
    return Math.max(q.min || 0, Math.min(q.max, Math.floor(Math.log(s * WELT / 256) / Math.LN2 + 0.3)));
  }
  function kachelBereich(b, z) {
    const k = kartenStatus, n = Math.pow(2, z), T = WELT / n;
    const ox = NULLPUNKT.x + WELT / 2, oy = NULLPUNKT.y + WELT / 2;
    const fest = (v) => Math.max(0, Math.min(n - 1, Math.floor(v / T)));
    return { z, T, ox, oy, x0: fest(ox - b.x / b.s), x1: fest(ox + (k.w - b.x) / b.s), y0: fest(oy - b.y / b.s), y1: fest(oy + (k.h - b.y) / b.s) };
  }
  // lq: Luftbild-Quelle (dann in der Ebene darüber), sonst ein Bild der Straßenkarte
  function neueKachel(z, x, y, key, lq) {
    const kc = kacheln;
    if (!lq && kc.quellen[kc.nr].vektor) {
      const img = document.createElement('img');
      img.className = 'k-kachel'; img.alt = ''; img.draggable = false; img.dataset.k = key;
      img.setAttribute('decoding', 'async');
      const t = { img, z, x, y, fertig: false, fehler: false, vektor: true };
      kc.bilder.set(key, t);
      kc.el.appendChild(img);
      vektorPlanen(t);
      return;
    }
    const img = document.createElement('img');
    img.className = 'k-kachel';
    img.alt = '';
    img.draggable = false;
    img.setAttribute('decoding', 'async');
    const t = { img, z, x, y, fertig: false, fehler: false, luft: !!lq };
    img.onload = () => {
      t.fertig = true;
      if (lq) { img.className = 'k-kachel da'; luft.ok++; basisAuffrischen(kc.bilder.get(key.slice(1))); } else { basisAuffrischen(t); kc.ok++; }
      altesWeg();
    };
    img.onerror = () => {
      t.fehler = true;
      if (lq) { luftFehler(); basisAuffrischen(kc.bilder.get(key.slice(1))); } else kachelFehler();
      if (!kc.aus) altesWeg();
    };
    kc.bilder.set(key, t);
    (lq ? luft.el : kc.el).appendChild(img);
    img.src = lq ? luftUrl(lq, z, x, y) : kachelUrl(kc.quellen[kc.nr], z, x, y);
  }
  // Entweder Luftbild oder Straßenkarte, nicht beides durcheinander: Im Luftbild-Gebiet wird ein Bild der Straßenkarte
  // erst sichtbar, wenn das Luftbild darüber da ist. Dann scheint es nur dort durch, wo es kein Luftbild gibt
  // (außerhalb Niedersachsens). Bis dahin sieht man das alte Luftbild vergrößert oder eine ruhige dunkle Fläche.
  function basisZeigen(t) {
    const kc = kacheln, lq = luftQuelle(kc.quellen, kc.nr);
    if (!lq || kc.z == null) return true;
    if (kc.z < lq.min && t.z < lq.min) return true;          // weit heraus: nur Straßenkarte
    if (!luftDeckt(lq, t.z, t.x, t.y, t.x, t.y)) return true; // außerhalb des Luftbild-Gebiets
    if (t.z < lq.min) return false;                            // Straßenkarte von vorhin beim Hineinzoomen
    const l = kc.bilder.get('L' + t.z + '/' + t.x + '/' + t.y);
    return !!l && (l.fertig || l.fehler);
  }
  function basisAuffrischen(t) {
    if (!t || t.luft || !t.fertig) return;
    const c = basisZeigen(t) ? 'k-kachel da' : 'k-kachel';
    if (t.img.className !== c) t.img.className = c;
  }
  // Luftbilder für den Bereich r (nur Quadrate, die Niedersachsen berühren)
  function luftBereich(r, je) {
    const lq = luftQuelle(kacheln.quellen, kacheln.nr);
    if (!lq || r.z < lq.min || !luft.el || !luftDeckt(lq, r.z, r.x0, r.y0, r.x1, r.y1)) return;
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) {
      if (luftDeckt(lq, r.z, x, y, x, y)) je('L' + r.z + '/' + x + '/' + y, x, y, lq);
    }
  }
  // Sind alle Bilder der neuen Zoomstufe da, verschwinden die der alten (bis dahin füllen sie die Lücken)
  function altesWeg() {
    const kc = kacheln;
    let alle = true;
    kc.bilder.forEach((t) => { if (t.z === kc.z && !t.fertig && !t.fehler) alle = false; });
    if (alle) kc.bilder.forEach((t, key) => { if (t.z !== kc.z) kachelWeg(t, key); });
  }
  // Bilder für den Ausschnitt b holen und pixelgenau legen
  function kachelnLegen(b) {
    const kc = kacheln, k = kartenStatus;
    if (kc.aus || !kc.el || !kc.quellen.length) return;
    const r = kachelBereich(b, kachelZoom(b.s));
    if (r.z !== kc.z) { kc.vorZ = kc.z; kc.z = r.z; }
    kc.ref = { s: b.s, x: b.x, y: b.y };
    schichtenVerschieben('');
    const brauche = {};
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) {
      const key = r.z + '/' + x + '/' + y;
      brauche[key] = true;
      if (!kc.bilder.has(key)) neueKachel(r.z, x, y, key);
    }
    if (kc.aus) return; // alle Anbieter sind gescheitert
    luftBereich(r, (key, x, y, lq) => { brauche[key] = true; if (!kc.bilder.has(key)) neueKachel(r.z, x, y, key, lq); });
    kc.bilder.forEach((t, key) => {
      if (brauche[key]) return;
      // Ältere Luftbilder bleiben über mehrere Stufen liegen, bis die neuen da sind (keine Lücken beim schnellen Zoomen)
      if (t.z === kc.z || !t.fertig || (t.luft || t.vektor ? Math.abs(t.z - kc.z) > 3 : t.z !== kc.vorZ)) { kachelWeg(t, key); return; }
      // Ältere Stufe: nur behalten, solange sie im Bild liegt
      const T = WELT / Math.pow(2, t.z);
      const l = (t.x * T - r.ox) * b.s + b.x, o = (t.y * T - r.oy) * b.s + b.y;
      if (l > k.w || o > k.h || l + T * b.s < 0 || o + T * b.s < 0) kachelWeg(t, key);
    });
    kc.bilder.forEach((t) => {
      const T = WELT / Math.pow(2, t.z);
      const l = Math.round((t.x * T - r.ox) * b.s + b.x), rr = Math.round(((t.x + 1) * T - r.ox) * b.s + b.x);
      const o = Math.round((t.y * T - r.oy) * b.s + b.y), u = Math.round(((t.y + 1) * T - r.oy) * b.s + b.y);
      // Die aktuelle Stufe oben, ältere Luftbilder darunter: die nähere Stufe über der ferneren
      const zi = t.z === kc.z ? (t.luft ? 30 : 25) : t.luft || t.vektor ? 20 - Math.abs(t.z - kc.z) : 1;
      t.img.style.cssText = `left:${l}px;top:${o}px;width:${rr - l}px;height:${u - o}px;z-index:${zi}`;
      basisAuffrischen(t);
    });
    altesWeg();
  }
  // Pro Bild der Bewegung nur die ganze Schicht verschieben und skalieren. Neu gelegt wird erst,
  // wenn Bilder fehlen oder die Bewegung kurz ruht (dann wieder gestochen scharf).
  function zeichneKacheln(b) {
    const kc = kacheln, k = kartenStatus;
    if (kc.aus || !kc.el || !kc.quellen.length || ui.view !== 'karte') return;
    clearTimeout(kc.ruhe);
    if (!kc.ref) { kachelnLegen(b); return; }
    const r = kachelBereich(b, kachelZoom(b.s));
    const andereStufe = r.z !== kc.z;
    // Andere Zoomstufe: mitten in der Bewegung höchstens alle 0,3 Sekunden neue Bilder holen. So entstehen beim
    // Herauszoomen keine leeren Ränder, und es werden trotzdem nicht bei jedem Bild neue Bilder angefordert.
    if (andereStufe && performance.now() - (kc.zuletzt || 0) > 300) { kc.zuletzt = performance.now(); kachelnLegen(b); return; }
    // Gleiche Stufe, aber am Rand fehlt etwas (Verschieben): nur die fehlenden Bilder dazulegen. Die Schicht bleibt,
    // wie sie ist, die übrigen Bilder werden nicht angefasst.
    if (!andereStufe) kachelnErgaenzen(r);
    const f = b.s / kc.ref.s;
    schichtenVerschieben(f === 1 ? `translate3d(${b.x - kc.ref.x}px, ${b.y - kc.ref.y}px, 0)` : `translate3d(${b.x - kc.ref.x * f}px, ${b.y - kc.ref.y * f}px, 0) scale(${f})`);
    if (f !== 1 || andereStufe) kc.ruhe = setTimeout(() => { if (k.blick) kachelnLegen(k.blick); }, andereStufe ? 160 : 220);
  }
  function kachelnErgaenzen(r) {
    const kc = kacheln, ref = kc.ref, T = WELT / Math.pow(2, r.z);
    const legen = (key, x, y, lq) => {
      if (kc.bilder.has(key)) return true;
      neueKachel(r.z, x, y, key, lq);
      const t = kc.bilder.get(key);
      if (!t) return false; // alle Anbieter gescheitert
      const l = Math.round((x * T - r.ox) * ref.s + ref.x), rr = Math.round(((x + 1) * T - r.ox) * ref.s + ref.x);
      const o = Math.round((y * T - r.oy) * ref.s + ref.y), u = Math.round(((y + 1) * T - r.oy) * ref.s + ref.y);
      t.img.style.cssText = `left:${l}px;top:${o}px;width:${rr - l}px;height:${u - o}px;z-index:${lq ? 30 : t.vektor ? 25 : 2}`;
      return true;
    };
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) if (!legen(r.z + '/' + x + '/' + y, x, y)) return;
    luftBereich(r, legen);
  }
  // Nachts andere Bilder (CARTO) bzw. umgefärbte Bilder (basemap.de, OpenStreetMap, per CSS)
  function kachelnThema() {
    const kc = kacheln;
    vektorNeuFaerben();
    namen.schluessel = ''; umgebung.namenSchluessel = ''; namenBald();
    if (kc.aus || !kc.quellen.length || !kc.quellen[kc.nr].carto) return;
    kachelnLeeren();
    if (kartenStatus.blick) kachelnLegen(kartenStatus.blick);
  }
  new MutationObserver(kachelnThema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) {
    const mqK = window.matchMedia('(prefers-color-scheme: dark)');
    if (mqK.addEventListener) mqK.addEventListener('change', kachelnThema);
  }
  window.addEventListener('online', () => {
    luft.aus = false; luft.ok = 0; luft.fehler = 0;
    if (!kacheln.aus || !kartenStatus.huelle || VORSCHAU) return;
    kacheln.quellen = kachelQuellen();
    kachelQuelleSetzen(0);
    if (kartenStatus.blick) kachelnLegen(kartenStatus.blick);
  });

  /* ----- Markierungen wie bei Google Maps: Tropfen mit Spitze am Ort, Betrag als Beschriftung daneben -----
     Mehrere Anfragen dicht beieinander: derselbe Tropfen mit der Zahl im Kopf, daneben „ab … €“. */
  const PIN_FORM = 'M13 1C6.4 1 1 6.3 1 12.8 1 22 13 33 13 33s12-11 12-20.2C25 6.3 19.6 1 13 1z';
  function pinHTML(g, cls, label, links) {
    const kopf = g.helfer === 'ich'
      ? '<path class="pin-haken" d="m8.6 12.8 3 3 5.8-6.2"/>'
      : '<circle class="pin-kern" cx="13" cy="12.8" r="4.4"/>';
    return `<button type="button" class="k-pin${links ? ' text-links' : ''}" data-oeffne="${esc(g.id)}" aria-label="${label}"><span class="pin${cls ? ' ' + cls : ''}">`
      + `<svg class="pin-form" viewBox="0 0 26 34" aria-hidden="true" focusable="false"><path class="pin-schatten" transform="translate(1.2 1.8)" d="${PIN_FORM}"/><path d="${PIN_FORM}"/>${kopf}</svg>`
      + `<b class="pin-text">${euroKurz(g.betrag)}</b></span></button>`;
  }
  function sammelHTML(attr, anzahl, ab, label, cls, links) {
    return `<button type="button" class="k-sammel${cls ? ' ' + cls : ''}${links ? ' text-links' : ''}" ${attr} aria-label="${esc(label)}">`
      + `<svg class="pin-form" viewBox="0 0 26 34" aria-hidden="true" focusable="false"><path class="pin-schatten" transform="translate(1.2 1.8)" d="${PIN_FORM}"/><path d="${PIN_FORM}"/></svg>`
      + `<b class="sammel-zahl">${anzahl}</b><span class="pin-text" data-ab="ab ${euroKurz(ab)}" aria-hidden="true"></span></button>`;
  }
  // Auf welcher Seite steht der Betrag? Normal rechts; würde er dort ein anderes Schild, eine andere Beschriftung oder
  // „Du“ verdecken und ist links Platz, dann links. liste: [{x, y, text}] in Bildpunkten (Spitze des Tropfens),
  // besetzt: weitere Flächen {l, o, r, u}. Rückgabe je Schild: true = links.
  const beschriftungBreite = (text) => 16 + text.length * 8;
  function beschriftungsSeiten(liste, besetzt, breite, hoehe) {
    // Flächen in einem Raster von 80 Bildpunkten ablegen: jede Prüfung sieht nur die Nachbarschaft. Schilder außerhalb des
    // Bildes bleiben rechts beschriftet (spart auf alten Handys Zeit beim Zoomen mit vielen Anfragen).
    const Z = 80, raster = new Map();
    const rein = (a) => {
      for (let x = Math.floor(a.l / Z), x1 = Math.floor(a.r / Z); x <= x1; x++) {
        for (let y = Math.floor(a.o / Z), y1 = Math.floor(a.u / Z); y <= y1; y++) {
          const k = x * 100003 + y, b = raster.get(k);
          if (b) b.push(a); else raster.set(k, [a]);
        }
      }
    };
    const trifft = (a) => {
      for (let x = Math.floor(a.l / Z), x1 = Math.floor(a.r / Z); x <= x1; x++) {
        for (let y = Math.floor(a.o / Z), y1 = Math.floor(a.u / Z); y <= y1; y++) {
          const b = raster.get(x * 100003 + y);
          if (b) for (let i = 0; i < b.length; i++) { const q = b[i]; if (a.l < q.r && a.r > q.l && a.o < q.u && a.u > q.o) return true; }
        }
      }
      return false;
    };
    const drin = (p) => !breite || (p.x > -90 && p.x < breite + 90 && p.y > -60 && p.y < hoehe + 60);
    besetzt.forEach(rein);
    liste.forEach((p) => { if (drin(p)) rein({ l: p.x - 13, o: p.y - 36, r: p.x + 13, u: p.y + 2 }); });
    return liste.map((p) => {
      if (p.links) return true;
      if (!drin(p)) return false;
      const breiteText = beschriftungBreite(p.text);
      const rechts = { l: p.x + 13, o: p.y - 34, r: p.x + 13 + breiteText, u: p.y - 8 };
      const links = { l: p.x - 13 - breiteText, o: rechts.o, r: p.x - 13, u: rechts.u };
      const nachLinks = trifft(rechts) && !trifft(links);
      rein(nachLinks ? links : rechts);
      return nachLinks;
    });
  }
  const DU_FLAECHE = (x, y) => ({ l: x - 17, o: y - 17, r: x + 52, u: y + 17 });

  /* ===== Umgebung: kleine Karte auf der Startseite =====
     Die echte Straßenkarte um den eigenen Ort, darauf dieselben offenen Anfragen wie in der Liste darunter
     (mit Betrag, genau dort, wo sie sind). Feste Zoomstufe, nichts zum Ziehen: Ein Schild öffnet die Anfrage,
     alles andere die große Karte an derselben Stelle. Ohne Kartenbilder (offline, Vorschau) bleiben „Du“,
     die Schilder und ein Kreis mit 1 km zur Orientierung. */
  const umgebung = { el: null, w: 0, h: 0, quellen: null, nr: 0, ok: 0, fehler: 0, aus: false, schluessel: '', blick: null, gruppen: [], warten: 0 };
  function umgebungStarten() {
    const u = umgebung;
    u.el = $('#umgebung');
    if (!u.el) return;
    u.quellen = VORSCHAU ? [] : kachelQuellen();
    u.aus = !u.quellen.length || navigator.onLine === false;
    if (window.ResizeObserver) new ResizeObserver(() => umgebungZeichnen()).observe(u.el);
    else window.addEventListener('resize', () => umgebungZeichnen());
    const neuFarben = () => { u.schluessel = ''; umgebungZeichnen(); };
    new MutationObserver(neuFarben).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', neuFarben);
    }
    window.addEventListener('online', () => {
      if (!u.aus || VORSCHAU) return;
      u.quellen = kachelQuellen(); Object.assign(u, { nr: 0, ok: 0, fehler: 0, aus: false, schluessel: '' });
      umgebungZeichnen();
    });
    // Tippen auf die Karte (nicht auf ein Schild): große Karte an derselben Stelle
    u.el.addEventListener('click', (e) => {
      const sammel = e.target.closest('[data-u-sammel]');
      if (e.target.closest('[data-oeffne]')) return; // öffnet die Anfrage (wie überall in der App)
      if (e.target.closest('.quelle-box')) return; // Quellenangabe und ihr (i)
      const b = u.blick;
      if (!b) return;
      if (sammel) {
        // Mehrere Anfragen an einem Fleck: große Karte so nah, dass sie auseinanderrücken
        const gr = u.gruppen[Number(sammel.dataset.uSammel)];
        if (gr) { ui.kartenZiel = { m: gr.m, s: massstabFuerZoom(Math.min(KARTE.zoomMax, b.z + 2)) }; gehe('karte'); }
        return;
      }
      ui.kartenZiel = { m: b.c, s: b.s };
      gehe('karte');
    });
    umgebungZeichnen();
  }
  // Ausschnitt: „Du“ in der Mitte, so nah wie möglich, aber die nächsten Anfragen noch im Bild
  function umgebungBlick(liste) {
    const u = umgebung, o = meinOrt(), c = inMeter(o.lat, o.lng);
    const naechste = liste.slice().sort((a, b) => meterVonMir(a) - meterVonMir(b)).slice(0, 4).map((g) => inMeter(g.lat, g.lng));
    let z = 16;
    for (; z > 11; z--) {
      const s = massstabFuerZoom(z);
      // Schilder stehen über ihrem Punkt: oben mehr Platz lassen, unten für die Quellenangabe
      if (naechste.every((m) => Math.abs(m.x - c.x) * s < u.w / 2 - 30 && (c.y - m.y) * s < u.h / 2 - 40 && (m.y - c.y) * s < u.h / 2 - 34)) break;
    }
    const s = massstabFuerZoom(z);
    return { z, s, c, x: Math.round(u.w / 2 - c.x * s), y: Math.round(u.h / 2 - c.y * s) };
  }
  function umgebungKacheln(b) {
    const u = umgebung, box = u.el.querySelector('.u-kacheln'), luftBox = u.el.querySelector('.u-luft'), q = u.aus ? null : u.quellen[u.nr];
    u.el.classList.toggle('u-ohne', !q);
    u.el.classList.toggle('k-filter', !!q && !q.carto && !q.foto && !q.vektor);
    u.el.classList.toggle('k-vektor', !!q && !!q.vektor);
    const quelle = u.el.querySelector('.u-quelle');
    if (!q) {
      box.textContent = ''; luftBox.textContent = ''; u.el.classList.remove('k-foto');
      quelle.textContent = VORSCHAU ? 'Straßenkarte in der App' : 'Straßenkarte gerade nicht erreichbar';
      return;
    }
    const n = Math.pow(2, b.z), T = WELT / n, ox = NULLPUNKT.x + WELT / 2, oy = NULLPUNKT.y + WELT / 2;
    const fest = (v) => Math.max(0, Math.min(n - 1, Math.floor(v / T)));
    const x0 = fest(ox - b.x / b.s), x1 = fest(ox + (u.w - b.x) / b.s), y0 = fest(oy - b.y / b.s), y1 = fest(oy + (u.h - b.y) / b.s);
    const lq = luftQuelle(u.quellen, u.nr);
    const mitLuft = !!lq && b.z >= lq.min && luftDeckt(lq, b.z, x0, y0, x1, y1);
    quelle.innerHTML = quellenText(q, mitLuft, (mitLuft || !!q.foto) && namenMoeglich());
    quelleFest(quelle.parentNode, !!q.foto);
    u.el.classList.toggle('k-foto', mitLuft || !!q.foto);
    // Bilder, die schon da sind, bleiben liegen (kein Flackern beim Tippen in der Suche)
    const legen = (ziel, url, luftbild) => {
      const da = {};
      [].slice.call(ziel.children).forEach((img) => { da[img.dataset.k] = img; });
      const brauche = {};
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        if (luftbild && !luftDeckt(lq, b.z, x, y, x, y)) continue;
        const key = b.z + '/' + x + '/' + y;
        brauche[key] = true;
        let img = da[key];
        if (!img && !luftbild && q.vektor) {
          // Eigene Karte: Bild wird selbst gezeichnet
          img = document.createElement('img');
          img.className = 'k-kachel'; img.alt = ''; img.draggable = false; img.dataset.k = key;
          const t = { img, z: b.z, x, y, klein: true };
          u.vektor = (u.vektor || []).filter((v) => v.img.parentNode);
          u.vektor.push(t);
          ziel.appendChild(img);
          vektorPlanen(t);
        }
        if (!img) {
          img = document.createElement('img');
          img.className = 'k-kachel'; img.alt = ''; img.draggable = false; img.dataset.k = key;
          img.setAttribute('decoding', 'async');
          img.onload = () => {
            img.dataset.geladen = '1';
            if (luftbild) { img.className = 'k-kachel da'; luft.ok++; } else u.ok++;
            umgebungBasis();
          };
          img.onerror = luftbild ? () => { img.dataset.fehler = '1'; luftFehler(); umgebungBasis(); } : () => {
            u.fehler++;
            if (u.ok || u.fehler < 3) return;
            // Dieser Anbieter lädt nicht: nächster, zuletzt ohne Kartenbilder
            if (u.nr + 1 < u.quellen.length) u.nr++; else u.aus = true;
            u.fehler = 0; u.schluessel = ''; box.textContent = '';
            umgebungZeichnen();
          };
          img.src = url(x, y);
          ziel.appendChild(img);
        }
        img.style.cssText = `left:${Math.round((x * T - ox) * b.s + b.x)}px;top:${Math.round((y * T - oy) * b.s + b.y)}px;width:256px;height:256px`;
      }
      Object.keys(da).forEach((key) => { if (!brauche[key]) { ziel.removeChild(da[key]); if (/^blob:/.test(da[key].src)) URL.revokeObjectURL(da[key].src); } });
    };
    legen(box, (x, y) => kachelUrl(q, b.z, x, y), false);
    if (mitLuft) legen(luftBox, (x, y) => luftUrl(lq, b.z, x, y), true); else luftBox.textContent = '';
    u.basis = { box, luftBox, lq, mitLuft };
    umgebungBasis();
  }
  // Kleine Karte: Straßenkarte im Luftbild-Gebiet erst zeigen, wenn das Luftbild darüber da ist (wie auf der großen)
  function umgebungBasis() {
    const a = umgebung.basis;
    if (!a) return;
    const { box, luftBox, lq, mitLuft } = a, luftDa = {};
    [].slice.call(luftBox.children).forEach((img) => { if (img.dataset.geladen || img.dataset.fehler) luftDa[img.dataset.k] = true; });
    [].slice.call(box.children).forEach((img) => {
      if (!img.dataset.geladen) return;
      const xy = img.dataset.k.split('/').map(Number);
      const zeigen = !mitLuft || !luftDeckt(lq, xy[0], xy[1], xy[2], xy[1], xy[2]) || luftDa[img.dataset.k];
      const c = zeigen ? 'k-kachel da' : 'k-kachel';
      if (img.className !== c) img.className = c;
    });
  }
  function umgebungZeichnen() {
    const u = umgebung;
    if (!u.el) return;
    const w = u.el.clientWidth, h = u.el.clientHeight;
    if (!w || !h) return; // Startseite gerade nicht zu sehen: beim nächsten Zeigen
    u.w = w; u.h = h;
    const liste = ui.umgebungListe || [];
    const b = umgebungBlick(liste);
    u.blick = b;
    const schluessel = [b.z, b.x, b.y, w, h, u.nr, u.aus, dunklesThema(), ansicht.kartenart, luft.aus, namen.aus].join('|');
    if (schluessel !== u.schluessel) { u.schluessel = schluessel; umgebungKacheln(b); }
    // Schilder wie auf der großen Karte; wo sie sich berühren würden, steht eine Zahl
    const gruppen = [];
    liste.forEach((g) => {
      const m = inMeter(g.lat, g.lng), x = m.x * b.s + b.x, y = m.y * b.s + b.y;
      if (x < 22 || x > w - 22 || y < 44 || y > h - 30) return;
      const ziel = gruppen.find((gr) => Math.abs(gr.x - x) < 64 && Math.abs(gr.y - y) < 36);
      if (!ziel) { gruppen.push({ liste: [g], x, y, punkte: [m], m }); return; }
      ziel.liste.push(g); ziel.punkte.push(m);
      const k = ziel.punkte.length;
      ziel.m = { x: ziel.punkte.reduce((t, p) => t + p.x, 0) / k, y: ziel.punkte.reduce((t, p) => t + p.y, 0) / k };
      ziel.x = ziel.m.x * b.s + b.x; ziel.y = ziel.m.y * b.s + b.y;
    });
    u.gruppen = gruppen;
    const an = (x, y, html, cls) => `<div class="k-anker${cls ? ' ' + cls : ''}" style="transform:translate(${Math.round(x)}px,${Math.round(y)}px)">${html}</div>`;
    let html = '';
    // Ohne Kartenbilder: Ringe um „Du“ zeigen, wie weit es ist
    if (u.aus || !u.quellen[u.nr]) {
      const jeMeter = dehnung(meinOrt().lat) * b.s;
      [500, 1000, 2000, 5000, 10000, 20000].forEach((m) => {
        const r = Math.round(m * jeMeter);
        if (r < 34 || r > Math.max(w, h) * 0.8) return;
        html += `<div class="u-kreis" style="left:${Math.round(w / 2 - r)}px;top:${Math.round(h / 2 - r)}px;width:${2 * r}px;height:${2 * r}px"><span>${m < 1000 ? m + ' m' : m / 1000 + ' km'}</span></div>`;
      });
    }
    if (zeigeIch()) html += an(w / 2, h / 2, '<span class="k-ich" aria-hidden="true"><i></i><b>Du</b></span>');
    // Knopf und Quellenangabe dürfen nichts verdecken: Beschriftung auf die andere Seite, sonst weglassen
    // (die Anfrage steht ja in der Liste, und „Karte öffnen“ zeigt alle). Ihre Lage wird nur bei neuer Größe gemessen.
    const masse = [w, h, document.documentElement.getAttribute('data-schrift') || '', u.el.querySelector('.u-quelle').textContent, document.fonts ? document.fonts.status : ''].join('|');
    if (u.belegtFuer !== masse) {
      u.belegtFuer = masse;
      u.belegt = ['.u-oeffnen', '.u-quelle-box .quelle-knopf'].map((sel) => {
        const el = u.el.querySelector(sel);
        return el && el.offsetWidth ? { l: el.offsetLeft - 4, o: el.offsetTop - 4, r: el.offsetLeft + el.offsetWidth + 4, u: el.offsetTop + el.offsetHeight + 4 } : null;
      }).filter(Boolean);
    }
    const belegt = u.belegt;
    const frei = (l, o, r, un) => l >= 2 && r <= w - 2 && o >= 2 && !belegt.some((q) => l < q.r && r > q.l && o < q.u && un > q.o);
    const plaetze = [];
    gruppen.forEach((gr) => {
      const text = gr.liste.length > 1 ? 'ab ' + euroKurz(Math.min(...gr.liste.map((g) => g.betrag))) : euroKurz(gr.liste[0].betrag);
      const breite = beschriftungBreite(text);
      if (frei(gr.x - 13, gr.y - 36, gr.x + 13 + breite, gr.y + 2)) plaetze.push({ gr, x: gr.x, y: gr.y, text });
      else if (frei(gr.x - 13 - breite, gr.y - 36, gr.x + 13, gr.y + 2)) plaetze.push({ gr, x: gr.x, y: gr.y, text, links: true, fest: true });
    });
    // Rechts ginge auch, wenn links nicht frei ist: dann bleibt es rechts (nur Knöpfe und Rand zwingen nach links)
    const seiten = beschriftungsSeiten(plaetze.map((p) => p.fest ? p : { x: p.x, y: p.y, text: p.text }), zeigeIch() ? [DU_FLAECHE(w / 2, h / 2)] : []);
    plaetze.forEach((p, n) => {
      const gr = p.gr, i = gruppen.indexOf(gr);
      let links = seiten[n];
      if (links && !p.fest && !frei(gr.x - 13 - beschriftungBreite(p.text), gr.y - 36, gr.x + 13, gr.y + 2)) links = false;
      p.links = !!links;
      if (gr.liste.length > 1) {
        const ab = Math.min(...gr.liste.map((g) => g.betrag));
        html += an(gr.x, gr.y, sammelHTML(`data-u-sammel="${i}"`, gr.liste.length, ab, `${gr.liste.length} Anfragen hier, ab ${euroKurz(ab)}. Auf der großen Karte ansehen`, '', links));
        return;
      }
      const g = gr.liste[0];
      const label = esc(`${g.titel}, ${euro(g.betrag)}, ${wannText(g)}, ${g.stadtteil}, ${distanz(g)}`);
      html += an(gr.x, gr.y, pinHTML(g, g.helfer === 'ich' ? 'pin-zugesagt' : '', label, links));
    });
    u.el.querySelector('.u-schicht').innerHTML = html;
    // Namen von Orten und Straßen über dem Luftbild: nicht unter Anfragen, „Du“ und Knöpfen
    const pinFlaechen = plaetze.map((p) => {
      const br = beschriftungBreite(p.text);
      return p.links ? { l: p.x - 17 - br, o: p.y - 38, r: p.x + 15, u: p.y + 4 } : { l: p.x - 15, o: p.y - 38, r: p.x + 17 + br, u: p.y + 4 };
    });
    gruppen.forEach((gr) => pinFlaechen.push({ l: gr.x - 15, o: gr.y - 38, r: gr.x + 15, u: gr.y + 4 }));
    if (zeigeIch()) pinFlaechen.push(DU_FLAECHE(w / 2, h / 2));
    quelleKurzZeigen(u.el.querySelector('.u-quelle-box'));
    u.namenFuer = { b, belegt: belegt.concat(pinFlaechen.map((q) => ({ l: Math.round(q.l), o: Math.round(q.o), r: Math.round(q.r), u: Math.round(q.u) }))) };
    umgebungNamen();
  }

  function initKarte() {
    const k = kartenStatus;
    if (k.svg) return true;
    const huelle = $('#map');
    if (!huelle || !document.createElementNS) { $('#karte-fehler').hidden = false; return false; }
    k.huelle = huelle;
    k.formen = stadtteilFormen();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    k.formen.forEach((f) => f.pkt.forEach((p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }));
    k.grenzen = { x0, y0, x1, y1 };

    const svg = svgEl('svg', { class: 'k-svg', 'aria-hidden': 'true', focusable: 'false' });
    const welt = svgEl('g', { class: 'k-welt' });
    const sockel = svgEl('g', { class: 'k-sockel' });
    const flaechen = svgEl('g', { class: 'k-flaechen' });
    // Stadtgebiet: weiche Fläche um alle Stadtteile, damit Garbsen als eine Stadt erkennbar ist
    const stadtRand = svgEl('g', { class: 'k-stadt-rand' }), stadt = svgEl('g', { class: 'k-stadt' });
    k.formen.forEach((f) => {
      stadtRand.appendChild(svgEl('path', { d: alsPfad(welle(f.c, f.R * KARTE.stadt + 70 * DEHNUNG, f.phase + 1, 32)) }));
      stadt.appendChild(svgEl('path', { d: alsPfad(welle(f.c, f.R * KARTE.stadt, f.phase + 1, 32)) }));
    });
    welt.appendChild(stadtRand); welt.appendChild(stadt);
    k.formen.forEach((f) => {
      sockel.appendChild(svgEl('path', { d: f.d }));
      const p = svgEl('path', { d: f.d, class: 'k-flaeche', 'data-stadtteil': f.name });
      flaechen.appendChild(p);
      f.el = p;
    });
    k.bereich = svgEl('circle', { class: 'k-bereich', r: Math.round(CONFIG.bereichMeter * DEHNUNG), cx: 0, cy: 0 });
    k.bereich.style.display = 'none';
    welt.appendChild(sockel); welt.appendChild(flaechen); welt.appendChild(k.bereich);
    svg.appendChild(welt);
    const schicht = document.createElement('div');
    schicht.className = 'k-schicht';
    const massstab = document.createElement('div');
    massstab.className = 'k-massstab';
    massstab.setAttribute('aria-hidden', 'true');
    const bilder = document.createElement('div');
    bilder.className = 'k-kacheln';
    bilder.setAttribute('aria-hidden', 'true');
    const luftbilder = document.createElement('div');
    luftbilder.className = 'k-luftbilder';
    luftbilder.setAttribute('aria-hidden', 'true');
    huelle.textContent = '';
    const namenEbene = document.createElement('div');
    namenEbene.className = 'k-namen';
    namenEbene.setAttribute('aria-hidden', 'true');
    namenEbene.style.display = 'none';
    namenEbene.appendChild(document.createElement('canvas'));
    huelle.appendChild(bilder); huelle.appendChild(luftbilder); huelle.appendChild(namenEbene); huelle.appendChild(svg); huelle.appendChild(schicht); huelle.appendChild(massstab);
    Object.assign(k, { svg, welt, schicht, massstab, sockel });
    kacheln.el = bilder;
    luft.el = luftbilder;
    namen.el = namenEbene;
    // Wer die Karte bewegt, braucht die Quellenangabe nicht mehr ausgeklappt
    const einklappen = () => quelleEinklappen($('.k-quelle-box'));
    ['pointerdown', 'touchstart', 'wheel'].forEach((art) => huelle.addEventListener(art, einklappen, { passive: true }));
    kachelnStarten();
    kartenBedienung();
    kartenGroesse(true);
    if (window.ResizeObserver) new ResizeObserver(() => kartenGroesse(false)).observe(huelle);
    else window.addEventListener('resize', () => kartenGroesse(false));
    return true;
  }

  // Ausschnitt, der den Umkreis um den eigenen Ort zeigt (Liste „bis … km“). Ist die Karte hoch genug,
  // liegt er unterhalb der Knöpfe, sonst links daneben.
  function blickAufAlles() {
    const k = kartenStatus, o = meinOrt();
    const c = inMeter(o.lat, o.lng), rad = ui.umkreis * 1000 * dehnung(o.lat);
    const g = { x0: c.x - rad, x1: c.x + rad, y0: c.y - rad, y1: c.y + rad };
    const knoepfe = document.querySelector('.karte-knoepfe');
    const unter = knoepfe ? knoepfe.offsetTop + knoepfe.offsetHeight + 10 : 70;
    const neben = knoepfe ? k.w - knoepfe.offsetLeft + 10 : 70;
    const bw = g.x1 - g.x0, bh = g.y1 - g.y0;
    // Die Stadt liegt unter den Knöpfen oder links daneben, je nachdem, wo sie größer wird
    const plaene = [{ l: 12, r: 12, o: unter, u: 30 }, { l: 12, r: neben, o: 14, u: 30 }].map((rand) => ({ rand, s: Math.min((k.w - rand.l - rand.r) / bw, (k.h - rand.o - rand.u) / bh) }));
    const { rand, s } = plaene[0].s >= plaene[1].s ? plaene[0] : plaene[1];
    return { s, x: rand.l + (k.w - rand.l - rand.r - bw * s) / 2 - g.x0 * s, y: rand.o + (k.h - rand.o - rand.u - bh * s) / 2 - g.y0 * s };
  }
  // Ausschnitt um einen Punkt (Meter) mit Maßstab s
  function blickAuf(m, s) {
    const k = kartenStatus;
    return { s, x: k.w / 2 - m.x * s, y: k.h / 2 - m.y * s };
  }
  function blickBegrenzen(b) {
    const k = kartenStatus, g = { x0: DE_A.x, y0: DE_A.y, x1: DE_B.x, y1: DE_B.y };
    const s = Math.max(kleinster(), Math.min(groesster(), b.s));
    // Das Bild bleibt innerhalb von Deutschland mit Rand. Ist der Rand schmaler als das Bild, steht er in der Mitte.
    const achse = (v, a0, a1, groesse) => {
      const min = groesse - a1 * s, max = -a0 * s;
      return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, v));
    };
    return { s, x: achse(b.x, g.x0, g.x1, k.w), y: achse(b.y, g.y0, g.y1, k.h) };
  }

  function kartenGroesse(neu) {
    const k = kartenStatus;
    if (!k.huelle) return;
    const w = k.huelle.clientWidth, h = k.huelle.clientHeight;
    if (!w || !h || (w === k.w && h === k.h && !neu)) return;
    const mitte = k.blick && k.w ? { x: (k.w / 2 - k.blick.x) / k.blick.s, y: (k.h / 2 - k.blick.y) / k.blick.s } : null;
    k.w = w; k.h = h;
    k.svg.setAttribute('width', w); k.svg.setAttribute('height', h);
    // Ohne eigene Bewegung bleibt der Umkreis im Bild, sonst bleibt die Mitte stehen
    if (!k.blick || !k.bewegt || !mitte) k.blick = blickAufAlles();
    else k.blick = blickBegrenzen(blickAuf(mitte, k.blick.s));
    zeichneBlick();
  }

  // Höchstens einmal pro Bild neu zeichnen (Finger melden auf manchen Handys 120-mal pro Sekunde)
  function blickBald() {
    const k = kartenStatus;
    if (!k.bild) k.bild = requestAnimationFrame(() => { k.bild = 0; zeichneBlick(); });
  }
  function zeichneBlick() {
    const k = kartenStatus, b = k.blick;
    if (!k.svg || !b) return;
    if (k.bild) { cancelAnimationFrame(k.bild); k.bild = 0; }
    k.welt.setAttribute('transform', `matrix(${b.s} 0 0 ${b.s} ${b.x} ${b.y})`);
    // Die Platten sind immer gleich dick, egal wie nah man herangeht
    k.sockel.setAttribute('transform', `translate(0 ${(KARTE.sockel / b.s).toFixed(1)})`);
    // Bei jeder halben Zoomstufe neu sortieren, welche Schilder zusammengefasst werden. Aber erst, wenn die Bewegung
    // kurz ruht: Mitten im Zoomen alle Schilder neu zu bauen, ließe die Karte stocken.
    clearTimeout(k.umsortieren);
    if (zoomStufe(b.s) !== k.stufe && !k.finger) {
      if (!k.ziel && !k.rad) { renderKarte(true); return; }
      k.umsortieren = setTimeout(() => { if (!k.finger && !k.ziel && k.blick && zoomStufe(k.blick.s) !== k.stufe) renderKarte(true); }, 200);
    }
    zeichneKacheln(b);
    namenBewegen(b);
    k.bewegtUm = performance.now();
    k.elemente.forEach((e) => {
      const x = Math.round(e.m.x * b.s + b.x), y = Math.round(e.m.y * b.s + b.y);
      // Was weit außerhalb liegt, wird nicht gezeichnet und ist auch mit der Tastatur nicht erreichbar
      const drin = x > -80 && x < k.w + 80 && y > -60 && y < k.h + 80;
      if (drin !== e.drin) { e.drin = drin; e.el.style.visibility = drin ? '' : 'hidden'; }
      // translate3d: jedes Schild liegt auf eigener Ebene, Bewegen braucht dann kein neues Malen
      if (drin) e.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
    clearTimeout(k.ruhig);
    k.ruhig = setTimeout(() => { massstabZeichnen(); namenAufraeumen(); kartenArtZeigen(); namenBald(); quelleKurzZeigen($('.k-quelle-box')); }, 120);
    if (!k.massstab.textContent) { massstabZeichnen(); kartenArtZeigen(); }
    clearTimeout(k.nachladen);
    if (istLive() && db.client) k.nachladen = setTimeout(ausschnittLaden, 700);
  }

  // Maßstab: eine runde Strecke zwischen 50 und 125 Bildpunkten (in echten Metern). Erst in Ruhe, spart Layout beim Zoomen.
  function massstabZeichnen() {
    const k = kartenStatus, b = k.blick;
    if (!b || !k.massstab) return;
    const strecken = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
    const pxJeMeter = b.s * dehnung(breiteVon((k.h / 2 - b.y) / b.s));
    const m = strecken.find((x) => x * pxJeMeter >= 50) || 200000;
    k.massstab.style.width = Math.round(m * pxJeMeter) + 'px';
    k.massstab.textContent = m >= 1000 ? `${m / 1000} km` : `${m} m`;
  }

  const zoomStufe = (s) => Math.round(Math.log(s) / Math.LN2 * 2);

  // fix: Bildschirmpunkt, der beim sanften Zoomen an seinem Platz bleibt (Mausrad, Doppeltippen)
  function blickSetzen(ziel, sanft, fix) {
    const k = kartenStatus;
    ziel = blickBegrenzen(ziel);
    cancelAnimationFrame(k.animation);
    const weniger = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    k.ziel = null;
    if (!sanft || weniger || !k.blick) { k.blick = ziel; zeichneBlick(); return; }
    k.ziel = ziel;
    const von = k.blick, start = performance.now(), dauer = 320;
    const schritt = (t) => {
      const f = Math.min(1, (t - start) / dauer), e = 1 - Math.pow(1 - f, 3);
      // Maßstab logarithmisch, damit das Zoomen gleichmäßig wirkt
      const s = von.s * Math.pow(ziel.s / von.s, e);
      const p = fix || { x: k.w / 2, y: k.h / 2 };
      // Der Ort unter p wandert gleichmäßig vom Anfang zum Ziel (bleibt also stehen, wenn beide gleich sind)
      const mv = { x: (p.x - von.x) / von.s, y: (p.y - von.y) / von.s }, mz = { x: (p.x - ziel.x) / ziel.s, y: (p.y - ziel.y) / ziel.s };
      k.blick = { s, x: p.x - (mv.x + (mz.x - mv.x) * e) * s, y: p.y - (mv.y + (mz.y - mv.y) * e) * s };
      zeichneBlick();
      if (f < 1) k.animation = requestAnimationFrame(schritt);
      else { k.ziel = null; if (zoomStufe(k.blick.s) !== k.stufe && !k.finger) renderKarte(true); }
    };
    k.animation = requestAnimationFrame(schritt);
  }
  function zoomen(faktor, px, py, sanft) {
    // Mehrmals schnell hintereinander: vom Ziel der laufenden Bewegung aus weiterzoomen
    const k = kartenStatus, b = (sanft && k.ziel) || k.blick;
    if (!b) return;
    if (px === undefined) { px = k.w / 2; py = k.h / 2; }
    const s = Math.max(kleinster(), Math.min(groesster(), b.s * faktor));
    k.bewegt = true;
    blickSetzen({ s, x: px - (px - b.x) * s / b.s, y: py - (py - b.y) * s / b.s }, sanft, { x: px, y: py });
  }
  function zeigeStadtteil(name) {
    const f = kartenStatus.formen.find((x) => x.name === name);
    if (!f) return;
    const k = kartenStatus;
    kartenStatus.bewegt = true;
    blickSetzen(blickAuf({ x: f.c.x, y: f.c.y + 60 }, Math.min(k.w, k.h) * 0.8 / (2 * f.R)), true);
  }
  function zeigeGanzGarbsen() { kartenStatus.bewegt = false; blickSetzen(blickAufAlles(), true); }
  // Eigener Ort, etwa 3 km im Bild
  function zeigeOrt() {
    const k = kartenStatus, o = meinOrt();
    k.bewegt = true;
    blickSetzen(blickAuf(inMeter(o.lat, o.lng), Math.min(k.w, k.h) / (3000 * dehnung(o.lat))), true);
  }

  // Ziehen, Zwei-Finger-Zoom, Doppeltippen, Mausrad und Tasten
  function kartenBedienung() {
    const k = kartenStatus, h = k.huelle;
    const finger = new Map();
    let start = null, letzterTipp = 0, letzterOrt = null;
    // Lage der Karte einmal je Geste messen (sonst erzwingt jede Fingerbewegung ein neues Layout)
    let rahmen = null, rahmenZeit = 0;
    const ort = (e) => {
      const jetzt = Date.now();
      if (!rahmen || (!finger.size && jetzt - rahmenZeit > 300)) rahmen = h.getBoundingClientRect();
      rahmenZeit = jetzt;
      return { x: e.clientX - rahmen.left, y: e.clientY - rahmen.top };
    };
    // Solange ein Finger liegt, werden die Schilder nicht neu zusammengefasst: Sonst verschwände das Schild unter
    // dem Finger, und dessen Touch-Ereignisse kämen nicht mehr an (Zwei-Finger-Zoom bliebe hängen)
    const fingerWeg = () => { k.finger = 0; if (k.blick && zoomStufe(k.blick.s) !== k.stufe) renderKarte(true); };
    const runter = (id, p, ziel) => {
      cancelAnimationFrame(k.animation); k.ziel = null;
      if (!finger.size) rahmen = h.getBoundingClientRect();
      finger.set(id, p);
      k.finger = finger.size;
      if (finger.size === 1) start = { p, blick: k.blick, ziel, weg: 0 };
      else if (finger.size === 2) {
        const [a, b] = [...finger.values()];
        start = { pinch: true, abstand: Math.hypot(a.x - b.x, a.y - b.y) || 1, mitte: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, blick: k.blick, weg: 99 };
      }
    };
    const bewegen = (id, p) => {
      if (!finger.has(id) || !start) return false;
      finger.set(id, p);
      if (start.pinch && finger.size >= 2) {
        const [a, b] = [...finger.values()];
        const abstand = Math.hypot(a.x - b.x, a.y - b.y) || 1, mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const s = Math.max(kleinster(), Math.min(groesster(), start.blick.s * abstand / start.abstand));
        const f = s / start.blick.s;
        k.bewegt = true;
        k.blick = blickBegrenzen({ s, x: mitte.x - (start.mitte.x - start.blick.x) * f, y: mitte.y - (start.mitte.y - start.blick.y) * f });
        blickBald();
        return true;
      }
      const dx = p.x - start.p.x, dy = p.y - start.p.y;
      start.weg = Math.max(start.weg, Math.hypot(dx, dy));
      if (start.weg < 7) return false;
      k.bewegt = true;
      k.huelle.classList.add('ist-gezogen');
      k.blick = blickBegrenzen({ s: start.blick.s, x: start.blick.x + dx, y: start.blick.y + dy });
      blickBald();
      return true;
    };
    const hoch = (id, p, ziel) => {
      if (!finger.has(id)) return;
      finger.delete(id);
      k.huelle.classList.remove('ist-gezogen');
      if (!finger.size) fingerWeg();
      if (!start) return;
      const war = start;
      if (finger.size === 1) { const [rest] = [...finger.values()]; start = { p: rest, blick: k.blick, weg: 99 }; return; }
      start = null;
      if (war.weg >= 7 || war.pinch) { k.gezogen = Date.now(); return; }
      // Tippen: zweimal kurz hintereinander zoomt hinein, einmal auf einen Stadtteil zeigt ihn
      const jetzt = Date.now();
      if (jetzt - letzterTipp < 320 && letzterOrt && Math.hypot(p.x - letzterOrt.x, p.y - letzterOrt.y) < 30) {
        letzterTipp = 0; zoomen(2, p.x, p.y, true); return;
      }
      letzterTipp = jetzt; letzterOrt = p;
      if (ziel && ziel.closest && ziel.closest('button, a')) return;
      const flaeche = ziel && ziel.getAttribute && ziel.getAttribute('data-stadtteil');
      setTimeout(() => {
        if (letzterTipp !== jetzt) return;
        if (ui.markiert) { ui.markiert = null; renderKarte(); }
        if (flaeche) zeigeStadtteil(flaeche);
      }, 330);
    };
    if (window.PointerEvent) {
      h.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') runter(e.pointerId, ort(e), e.target); });
      h.addEventListener('pointermove', (e) => {
        if (bewegen(e.pointerId, ort(e)) && !h.hasPointerCapture(e.pointerId)) { try { h.setPointerCapture(e.pointerId); } catch (err) { /* egal */ } }
      });
      const ende = (e) => hoch(e.pointerId, ort(e), e.target);
      h.addEventListener('pointerup', ende);
      h.addEventListener('pointercancel', (e) => { finger.delete(e.pointerId); start = null; h.classList.remove('ist-gezogen'); if (!finger.size) fingerWeg(); });
    } else {
      // Ältere iPhones (vor iOS 13) kennen keine Pointer-Events
      const jedes = (e, fn) => { for (let i = 0; i < e.changedTouches.length; i++) { const t = e.changedTouches[i]; fn(t.identifier, ort(t), e.target); } };
      h.addEventListener('touchstart', (e) => jedes(e, runter), { passive: true });
      h.addEventListener('touchmove', (e) => { let b = false; jedes(e, (id, p) => { b = bewegen(id, p) || b; }); if (b && e.cancelable) e.preventDefault(); }, { passive: false });
      h.addEventListener('touchend', (e) => jedes(e, hoch));
      h.addEventListener('touchcancel', () => { finger.clear(); start = null; fingerWeg(); });
      h.addEventListener('mousedown', (e) => runter('maus', ort(e), e.target));
      window.addEventListener('mousemove', (e) => bewegen('maus', ort(e)));
      window.addEventListener('mouseup', (e) => hoch('maus', ort(e), e.target));
    }
    // Alte iPhones würden bei zwei Fingern sonst die ganze Seite vergrößern
    h.addEventListener('gesturestart', (e) => e.preventDefault());
    // Ein Klick direkt nach dem Ziehen öffnet nichts
    h.addEventListener('click', (e) => { if (Date.now() - k.gezogen < 350) { e.preventDefault(); e.stopPropagation(); } }, true);
    h.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = ort(e);
      const zeilen = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const stufe = Math.abs(zeilen) >= 50 && !e.ctrlKey;   // Maus mit Raste (Touchpad liefert kleine Schritte)
      const faktor = Math.exp(-Math.max(-140, Math.min(140, zeilen)) * (stufe ? 0.0042 : 0.006));
      clearTimeout(k.radRuhe);
      k.rad = true;
      k.radRuhe = setTimeout(() => { k.rad = false; if (k.blick && zoomStufe(k.blick.s) !== k.stufe && !k.ziel && !k.finger) renderKarte(true); }, 220);
      if (stufe) { zoomen(faktor, p.x, p.y, true); return; }
      const b = k.blick, s = Math.max(kleinster(), Math.min(groesster(), b.s * faktor));
      k.bewegt = true;
      cancelAnimationFrame(k.animation); k.ziel = null;
      k.blick = blickBegrenzen({ s, x: p.x - (p.x - b.x) * s / b.s, y: p.y - (p.y - b.y) * s / b.s });
      blickBald();
    }, { passive: false });
    h.addEventListener('keydown', (e) => {
      if (e.target !== h) return;
      const schieb = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[e.key];
      if (schieb) { e.preventDefault(); k.bewegt = true; blickSetzen({ s: k.blick.s, x: k.blick.x + schieb[0], y: k.blick.y + schieb[1] }, true); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomen(1.6, undefined, undefined, true); }
      else if (e.key === '-') { e.preventDefault(); zoomen(1 / 1.6, undefined, undefined, true); }
      else if (e.key === '0') { e.preventDefault(); zeigeGanzGarbsen(); }
    });
  }

  // Namen der Stadtteile ausblenden, wenn sie Schilder, Knöpfe oder andere Namen verdecken würden
  function namenAufraeumen() {
    const k = kartenStatus;
    if (!k.schicht) return;
    const rahmen = k.huelle.getBoundingClientRect();
    const fest = [...document.querySelectorAll('.karte-knoepfe, .k-quelle-box .quelle-knopf, #map .k-massstab, .karte-art')].map((el) => el.getBoundingClientRect());
    const schilder = [...k.schicht.querySelectorAll('.k-pin .pin, .k-sammel')].map((el) => el.getBoundingClientRect());
    const belegt = fest.slice();
    const namen = [...k.schicht.querySelectorAll('.k-name')];
    // Erst alles messen, dann umschalten. Ausgeblendete Namen behalten ihre Größe, das Messen bleibt also richtig.
    const gemessen = namen.map((n) => ({ n, r: n.getBoundingClientRect(), rang: Number(n.dataset.rang) }));
    gemessen.sort((a, b) => b.rang - a.rang);
    gemessen.forEach((x) => {
      const r = x.r;
      const draussen = r.left < rahmen.left + 4 || r.right > rahmen.right - 4 || r.top < rahmen.top + 4 || r.bottom > rahmen.bottom - 26;
      const trifft = (b) => r.left < b.right + 2 && r.right > b.left - 2 && r.top < b.bottom + 2 && r.bottom > b.top - 2;
      x.weg = draussen || belegt.some(trifft) || schilder.some(trifft);
      if (!x.weg) belegt.push(r);
    });
    gemessen.forEach((x) => { if (x.n.classList.contains('versteckt') !== x.weg) x.n.classList.toggle('versteckt', x.weg); });
  }

  // nurZoom: beim Zoomen bleiben Auswahl und Beschriftungen gleich, nur die Schilder werden neu zusammengefasst
  function renderKarte(nurZoom) {
    const k = kartenStatus;
    let sichtbar = k.sichtbar;
    if (nurZoom !== true || !sichtbar) {
      sichtbar = gesuche.filter((g) => passt(g) && !versteckt(g) && (g.eigen || (g.status === 'offen' && !abgelaufen(g)) || g.helfer === 'ich'));
      k.sichtbar = sichtbar;
      k.texte = new Map();
      $('#karte-anzahl').textContent = `${sichtbar.length} ${sichtbar.length === 1 ? 'Anfrage' : 'Anfragen'}${ui.kat !== 'alle' ? ' · ' + katName(ui.kat) : ''}`;
      $('#karte-leer').hidden = !(istLive() && db.geladen && !sichtbar.length && ui.kat === 'alle' && !ui.suche.trim());
    }
    if (!k.svg || !k.blick) return;
    k.stufe = zoomStufe(k.blick.s);
    k.marker.clear();
    const hervor = ui.offen || ui.markiert;
    const aktiv = gesuche.find((g) => g.id === hervor);
    // Ungefährer Bereich der gewählten Anfrage
    if (aktiv && !aktiv.eigen && sichtbar.includes(aktiv)) {
      const m = inMeter(aktiv.lat, aktiv.lng);
      k.bereich.setAttribute('cx', Math.round(m.x)); k.bereich.setAttribute('cy', Math.round(m.y));
      k.bereich.setAttribute('r', Math.round(CONFIG.bereichMeter * dehnung(aktiv.lat)));
      k.bereich.style.display = '';
    } else k.bereich.style.display = 'none';
    // Eigener Stadtteil hervorgehoben
    const mein = zeigeIch() ? meinOrt().stadtteil : '';
    k.formen.forEach((f) => f.el.classList.toggle('k-mein', f.name === mein));

    // Schilder, die sich auf dem Bildschirm berühren würden, werden zu einem Sammel-Schild mit der Zahl.
    // Die gewählte Anfrage bleibt immer einzeln sichtbar.
    const s = k.blick.s, zusammen = s < groesster() * 0.98;
    const gruppen = [];
    const reihenfolge = sichtbar.slice().sort((a, b) => (b.id === hervor) - (a.id === hervor) || (b.eigen || b.helfer === 'ich') - (a.eigen || a.helfer === 'ich'));
    reihenfolge.forEach((g) => {
      const m = inMeter(g.lat, g.lng);
      // Tropfen mit Betrag daneben: berühren sich, wenn sie weniger als 64 × 36 Bildpunkte auseinander liegen
      const ziel = g.id === hervor || !zusammen ? null : gruppen.find((gr) => !gr.fest && Math.abs(gr.m.x - m.x) * s < 64 && Math.abs(gr.m.y - m.y) * s < 36);
      if (!ziel) { gruppen.push({ liste: [g], punkte: [m], m, fest: g.id === hervor }); return; }
      ziel.liste.push(g); ziel.punkte.push(m);
      const n = ziel.punkte.length;
      ziel.m = { x: ziel.punkte.reduce((t, p) => t + p.x, 0) / n, y: ziel.punkte.reduce((t, p) => t + p.y, 0) / n };
    });
    k.gruppen = gruppen;
    // Die ganze Schicht als ein Stück HTML: auf alten Geräten deutlich schneller als jedes Schild einzeln
    const teile = [];
    const anker = (m, html, cls, id) => teile.push({ m, html, cls: cls || '', id });
    const text = (g) => {
      let t = k.texte.get(g.id);
      if (!t) {
        t = esc(`${g.titel}, ${euro(g.betrag)}, ${g.stadtteil}, ${distanz(g)}${g.eigen ? (abgelaufen(g) ? ', deine Anfrage, abgelaufen' : ', deine Anfrage') : ''}${g.helfer === 'ich' ? ', deine Zusage' : ''}`);
        k.texte.set(g.id, t);
      }
      return t;
    };
    if (kacheln.aus) {
      // Vereinfachte Zeichnung: Namen der Stadtteile zuerst, damit Schilder darüber liegen
      const anzahl = new Map();
      sichtbar.forEach((g) => anzahl.set(g.stadtteil, (anzahl.get(g.stadtteil) || 0) + 1));
      k.formen.forEach((f) => {
        const istMein = f.name === mein;
        const rang = (istMein ? 1000 : 0) + (anzahl.get(f.name) || 0) * 10 + f.R / 100;
        anker(f.c, `<span class="k-name${istMein ? ' k-name-mein' : ''}" data-rang="${rang}" aria-hidden="true">${istMein ? '<b>Du</b>' : ''}${esc(f.name)}</span>`, istMein ? 'k-mein-anker' : '');
      });
    } else if (mein) {
      // Auf der Straßenkarte: blauer Punkt am eigenen Ort (ungefähr; die App fragt keinen Standort ab)
      const o = meinOrt();
      anker(inMeter(o.lat, o.lng), '<span class="k-ich" aria-hidden="true"><i></i><b>Du</b></span>');
    }
    const b = k.blick;
    // Betrag links statt rechts, wo er sonst ein Nachbarschild oder „Du“ verdecken würde
    const o = mein && !kacheln.aus ? inMeter(meinOrt().lat, meinOrt().lng) : null;
    const seiten = beschriftungsSeiten(gruppen.map((gr) => ({ x: gr.m.x * b.s + b.x, y: gr.m.y * b.s + b.y,
      text: gr.liste.length > 1 ? 'ab ' + euroKurz(Math.min(...gr.liste.map((g) => g.betrag))) : euroKurz(gr.liste[0].betrag) })),
      o ? [DU_FLAECHE(o.x * b.s + b.x, o.y * b.s + b.y)] : [], k.w, k.h);
    gruppen.forEach((gr, i) => {
      if (gr.liste.length > 1) {
        const ab = Math.min(...gr.liste.map((g) => g.betrag));
        const orte = [...new Set(gr.liste.map((g) => g.stadtteil))];
        const eigene = gr.liste.some((g) => g.eigen || g.helfer === 'ich');
        const label = `${gr.liste.length} Anfragen in ${orte.length > 2 ? orte.slice(0, 2).join(', ') + ' und Umgebung' : orte.join(' und ')}, ab ${euroKurz(ab)}. Hineinzoomen`;
        anker(gr.m, sammelHTML(`data-sammel="${i}"`, gr.liste.length, ab, label, eigene ? 'k-sammel-eigen' : '', seiten[i]));
        return;
      }
      const g = gr.liste[0];
      const cls = [g.eigen ? 'pin-eigen' : '', abgelaufen(g) ? 'pin-abgelaufen' : '', g.helfer === 'ich' ? 'pin-zugesagt' : '', g.id === hervor ? 'is-aktiv' : ''].filter(Boolean).join(' ');
      anker(gr.m, pinHTML(g, cls, text(g), seiten[i]), g.id === hervor ? 'k-oben' : '', g.id);
    });
    k.schicht.innerHTML = teile.map((t) => `<div class="k-anker ${t.cls}" style="transform:translate(${Math.round(t.m.x * b.s + b.x)}px,${Math.round(t.m.y * b.s + b.y)}px)">${t.html}</div>`).join('');
    const kinder = k.schicht.children;
    k.elemente = teile.map((t, i) => {
      if (t.id) k.marker.set(t.id, kinder[i].firstElementChild);
      return { el: kinder[i], m: t.m, drin: true };
    });
    zeichneBlick();
  }

  function zentriereAuf(id) {
    const g = gesuche.find((x) => x.id === id);
    const k = kartenStatus;
    if (!g || !k.blick) return;
    k.bewegt = true;
    blickSetzen(blickAuf(inMeter(g.lat, g.lng), Math.max(k.blick.s, massstabFuerZoom(14.6))), false);
  }

  $('#karte-art').addEventListener('click', () => {
    ansichtSetzen('kartenart', ansicht.kartenart === 'luftbild' ? 'karte' : 'luftbild');
    kartenArtNeu();
  });
  document.querySelector('.karte-knoepfe').addEventListener('click', (e) => {
    const b = e.target.closest('[data-karte]');
    if (!b || !kartenStatus.blick) return;
    const was = b.dataset.karte;
    if (was === 'rein') zoomen(1.8, undefined, undefined, true);
    else if (was === 'raus') zoomen(1 / 1.8, undefined, undefined, true);
    else if (was === 'ich') zeigeOrt();
    else if (was === 'alles') zeigeGanzGarbsen();
  });
  // Sammel-Schild antippen: so weit hineinzoomen, dass die Anfragen auseinanderrücken
  document.querySelector('#map').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sammel]');
    const k = kartenStatus, gr = b && k.gruppen[Number(b.dataset.sammel)];
    if (!gr) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    gr.punkte.forEach((p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    const passend = Math.min((k.w - 140) / Math.max(1, x1 - x0), (k.h - 160) / Math.max(1, y1 - y0));
    k.bewegt = true;
    blickSetzen(blickAuf({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, Math.min(groesster(), Math.max(k.blick.s * 1.6, Math.min(passend, k.blick.s * 3)))), true);
  });

  /* ===== Detail-Ansicht und Konto (Bottom Sheet) ===== */
  /* ----- Bewerten nach dem Auftrag: Sterne, ein paar Sätze, erscheint für beide gleichzeitig ----- */
  function bewertenFrist(g) {
    const ab = g.bewertetAm ? new Date(g.bewertetAm) : new Date();
    return new Date(ab.getTime() + 14 * TAG_MS).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  }
  function bewertenHTML(g, wen, dis) {
    const meine = g.meineBewertung || 0;
    const entwurf = ui.bewertung && ui.bewertung.id === g.id ? ui.bewertung : null;
    const mitText = db.teil8 !== false;
    if (meine && !entwurf) {
      const da = g.bewertungSichtbar;
      return `<div class="bewerten bewerten-fertig">
          <p class="bewerten-titel"><strong>${da && mitText ? 'Eure Bewertungen sind erschienen.' : 'Danke für deine Bewertung.'}</strong></p>
          <div class="bewerten-meine">${sterneAnzeige(meine)}<span>${STERNE_WORTE[meine]}</span></div>
          ${g.meinText ? `<p class="rez-text">${esc(g.meinText)}</p>` : ''}
          <p class="klein">${da
            ? `Du findest sie im Profil von ${esc(wen)}.${g.ihreBewertung ? ` ${esc(wen)} hat dir ${g.ihreBewertung.sterne} ${g.ihreBewertung.sterne === 1 ? 'Stern' : 'Sterne'} gegeben.` : ''}`
            : mitText ? `Sie erscheint, sobald ${esc(wen)} dich auch bewertet hat, spätestens am ${bewertenFrist(g)}. Bis dahin kannst du sie ändern.` : ''}</p>
          <div class="link-zeile">${da || !mitText
            ? `${anderePerson(g) ? `<button type="button" class="link-inline" data-profil>${icon('stern', 'i-sm')}Profil von ${esc(wen)} ansehen</button>` : ''}${da ? `<button type="button" class="link-inline" data-mein-profil>Dein Profil</button>` : ''}`
            : `<button type="button" class="link-inline" data-aktion="bewertung-aendern">Bewertung ändern</button>`}</div>
        </div>`;
    }
    const st = entwurf ? entwurf.sterne : 0;
    return `<form class="bewerten" id="bewerten-form" novalidate>
        <p class="bewerten-titel"><strong>Wie war es mit ${esc(wen)}?</strong></p>
        <div class="sterne" role="group" aria-label="Sterne vergeben">${[1, 2, 3, 4, 5].map((n) =>
          `<button type="button" class="stern ${n <= st ? 'is-an' : ''}" id="stern-${n}" data-stern="${n}" aria-label="${n} ${n === 1 ? 'Stern' : 'Sterne'}: ${STERNE_WORTE[n]}" aria-pressed="${n === st}" ${dis}>${icon('stern')}</button>`).join('')}</div>
        <p class="sterne-wort" aria-live="polite">${st ? STERNE_WORTE[st] : 'Tippe auf die Sterne.'}</p>
        ${st ? `${mitText ? `<div class="feld"><label for="bewertung-text">${st >= 4 ? 'Was war gut?' : 'Was hätte besser laufen können?'} <span class="klein">(freiwillig)</span></label>
            <textarea id="bewertung-text" maxlength="600" rows="3" placeholder="${st >= 4 ? 'z. B. pünktlich, freundlich, alles war vorbereitet' : 'Bleib sachlich und schreib, was passiert ist.'}">${esc(entwurf.text || '')}</textarea>
            <p class="feld-hinweis">Erscheint mit deinem Vornamen im Profil von ${esc(wen)}. Bitte keine Adressen, Telefonnummern oder Angaben zur Gesundheit.</p></div>` : ''}
          <p class="fehler" id="bewertung-fehler" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary" ${dis}>${meine ? 'Änderung speichern' : 'Bewertung abschicken'}</button>
          ${mitText ? '<p class="klein">Ihr seht eure Bewertungen gleichzeitig: sobald ihr beide bewertet habt, spätestens nach 14 Tagen.</p>' : ''}` : ''}
      </form>`;
  }

  function sheetGesuchHTML(g) {
    const live = istLive();
    const vn = vorname(g.wer);
    const hn = vorname(g.helferName) || 'Die helfende Person';
    const gebuehr = CONFIG.gebuehrAuftraggeber;
    const dis = ui.busy ? 'disabled aria-busy="true"' : '';
    let html = `
      <div class="sheet-top">
        <span class="eyebrow">${icon(g.kat, 'i-sm')}${katName(g.kat)}</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <h2 id="sheet-titel">${esc(g.titel)}</h2>`;

    if (g.eigen) {
      const bis = sichtbarBis(g);
      const stand = g.status !== 'offen' ? '' : abgelaufen(g) ? 'Abgelaufen' : bis ? `Sichtbar bis ${bis}` : 'Sichtbar für Nachbarn';
      if (stand) html += `<p class="stand ${abgelaufen(g) ? 'stand-warn' : ''}">${esc(stand)}</p>`;
    } else {
      const z = personZahlen(g);
      const bewertung = z.anzahl && z.sterne
        ? `${icon('stern', 'i-xs i-fill')}${komma(z.sterne)} · ${z.anzahl} ${z.anzahl === 1 ? 'Bewertung' : 'Bewertungen'}`
        : 'Neu bei Hand Drauf';
      html += `<button type="button" class="person person-knopf" data-profil aria-label="Profil von ${esc(g.wer)} ansehen">
        ${avatarHTML(g.initialen, istLive() ? db.bilder.get(g.erstellerId) : '')}
        <span class="person-text">
          <span class="person-name">${esc(g.wer)}${live ? '' : ` <span class="pill pill-good">${icon('check', 'i-xs')}Verifiziert</span>`}</span>
          <span class="person-meta">${bewertung}</span>
        </span>
        <span class="person-mehr" aria-hidden="true">Profil</span>
      </button>`;
    }

    let detail;
    if (!CONFIG.gebuehren) detail = g.eigen
      ? `Zahlst du direkt<span>an die Person, die dir hilft</span>`
      : `Bekommst du direkt<span>von ${esc(vn)}</span>`;
    else detail = g.eigen
      ? `Du zahlst ${euro(g.betrag + gebuehr)}<span>inkl. ${euro(gebuehr)} Servicegebühr</span>`
      : `Du erhältst ${euro(auszahlung(g))}<span>nach ${Math.round(CONFIG.provisionHelfer * 100)} % Servicegebühr</span>`;

    // Adresse als Teil der Fakten: Andere sehen sie erst nach der Zusage
    const beteiligt = g.eigen || g.helfer === 'ich';
    const adresse = beteiligt ? adresseVon(g) : '';
    if (beteiligt && live) ladeAdresse(g.id);
    const echteAdresse = adresse && !(g.eigen && !live && adresse === g.stadtteil) ? adresse : '';
    let adressZeile;
    if (!beteiligt) adressZeile = `<span class="fakt-leise">${icon('schloss', 'i-xs')}nach der Zusage</span>`;
    else if (echteAdresse) adressZeile = `${esc(echteAdresse)}<span class="fakt-zusatz">${g.eigen ? 'sieht nur, wer zusagt' : 'nur für dich sichtbar'}</span>`;
    else adressZeile = `<span class="fakt-leise">${adresse === null ? 'wird geladen …' : g.eigen ? 'nur der Ort' : 'nicht verfügbar'}</span>`;
    // Telefon (freiwillig): wie die Adresse erst nach der Zusage, zum Antippen
    const telefon = beteiligt ? telefonVon(g) : '';
    const telefonZeile = !telefon ? '' : `<div class="breit"><dt>Telefon</dt><dd>${g.eigen
      ? `${esc(telefon)}<span class="fakt-zusatz">sieht nur, wer zusagt</span>`
      : `<a class="tel-link" href="${esc(telLink(telefon))}">${icon('telefon', 'i-sm')}${esc(telefon)}</a>`}</dd></div>`;
    const fuerZeile = !g.fuer ? '' : `<div class="breit"><dt>Für wen</dt><dd>${esc(g.fuer)}<span class="fakt-zusatz">${g.eigen ? 'Du fragst für jemand anderen.' : `${esc(vn)} fragt für jemand anderen.`}</span></dd></div>`;
    const weg = wegText(g);

    html += `<div class="betrag">
      <div><div class="betrag-zahl">${euroKurz(g.betrag)}</div><div class="betrag-label">Aufwandsentschädigung</div></div>
      <div class="betrag-detail">${detail}</div>
    </div>
    <dl class="fakten">
      ${fuerZeile}
      <div><dt>Wann</dt><dd>${esc(wannLang(g))}</dd></div>
      <div><dt>Dauer</dt><dd>${esc(g.dauer)}</dd></div>
      <div><dt>Ort</dt><dd>${esc(g.stadtteil)}</dd></div>
      <div><dt>Entfernung</dt><dd>${distanz(g)}${weg ? `<span class="fakt-zusatz">${weg}</span>` : ''}</dd></div>
      <div class="breit"><dt>Adresse</dt><dd>${adressZeile}</dd></div>
      ${telefonZeile}
    </dl>`;
    if (g.text) html += `<p class="beschreibung">${esc(g.text)}</p>`;

    // Fortschritt für laufende Aufträge
    if (g.status !== 'offen' && (g.helfer === 'ich' || g.eigen)) {
      const stufen = ['zugesagt', 'erledigt', 'bezahlt'];
      const namen = ['Zugesagt', 'Erledigt gemeldet', CONFIG.gebuehren ? 'Bestätigt und ausgezahlt' : 'Bestätigt'];
      const idx = stufen.indexOf(g.status);
      html += `<ol class="schritte" aria-label="Fortschritt">${namen.map((n, i) =>
        `<li class="${i <= idx ? 'is-done' : ''} ${i === idx ? 'is-current' : ''}"><span class="punkt">${i <= idx ? icon('check', 'i-xs') : ''}</span>${n}</li>`
      ).join('')}</ol>`;
    }

    // Sicherheits-Code für die Tür (Vorbild: PIN bei Uber): kennen nur die beiden Beteiligten.
    // Wer hilft, sieht ihn vor den Knöpfen; wer Hilfe bekommt, gleich unter „… hilft dir“.
    let codeHTML = '';
    if (g.tuercode && beteiligt && (g.status === 'zugesagt' || g.status === 'erledigt')) {
      const ziffern = String(g.tuercode).split('');
      codeHTML = `<div class="tuercode">
        <div class="tuercode-kopf"><span>${icon('schild', 'i-sm')}Sicherheits-Code</span>
          <span class="tuercode-zahl" role="img" aria-label="${ziffern.join(' ')}">${ziffern.map((z) => `<span aria-hidden="true">${esc(z)}</span>`).join('')}</span></div>
        <p>${g.eigen
          ? (g.fuer ? `${esc(hn)} nennt den Code an der Tür. Gib ihn an die Person weiter, bei der geholfen wird.` : `${esc(hn)} nennt dir den Code an der Tür. Stimmt er nicht, lass niemanden herein.`)
          : `Nenne den Code, wenn du klingelst. So weiß ${esc(g.fuer ? 'die Person an der Tür' : vn)}, dass du es bist.`}</p>
      </div>`;
    }
    if (!g.eigen) html += codeHTML;

    const sterneHTML = (b, wen) => bewertenHTML(g, wen, dis);
    // In der eigenen Anfrage: Wer hilft? Mit Weg zum Profil
    const helferZeile = g.eigen && g.helferName && anderePerson(g) && g.status !== 'offen'
      ? `<button type="button" class="person person-knopf" data-profil aria-label="Profil von ${esc(g.helferName)} ansehen">
          ${avatarHTML(initialenVon(g.helferName), istLive() ? db.bilder.get(g.helferId) : '')}
          <span class="person-text"><span class="person-name">${esc(g.helferName)}</span><span class="person-meta">Hilft dir</span></span>
          <span class="person-mehr" aria-hidden="true">Profil</span></button>` : '';

    // Was jetzt zu tun ist: ein Hauptknopf, Nebensachen als Link
    if (g.eigen) {
      if (g.status === 'offen') {
        html += abgelaufen(g)
          ? `<button type="button" class="btn btn-primary" data-aktion="bearbeiten-termin">Neuen Termin wählen</button>`
          : `<button type="button" class="btn btn-secondary" data-aktion="bearbeiten">Anfrage bearbeiten</button>`;
        html += ui.rueckzug
          ? `<div class="bestaetigen-box"><p>Anfrage wirklich zurückziehen? Nachbarn sehen sie dann nicht mehr.</p>
              <div class="btn-row"><button type="button" class="btn btn-danger-solid" data-aktion="rueckzug" ${dis}>Zurückziehen</button>
              <button type="button" class="btn btn-secondary" data-aktion="rueckzug-nein">Abbrechen</button></div></div>`
          : `<button type="button" class="link-btn" data-aktion="rueckzug-frage">Anfrage zurückziehen</button>`;
      } else if (g.status === 'zugesagt') {
        html += `<div class="status-box good">${icon('check')}${esc(g.helferName || 'Jemand')} hilft dir</div>${helferZeile}${codeHTML}`;
      } else if (g.status === 'erledigt') {
        html += `<div class="status-box warn">${esc(hn)} hat den Job als erledigt gemeldet.</div>${helferZeile}
          <button type="button" class="btn btn-primary" data-aktion="bestaetigen" ${dis}>Erledigt bestätigen</button>`;
      } else if (g.status === 'bezahlt') {
        html += `<div class="status-box good">${icon('check')}Abgeschlossen</div>${helferZeile}` + (g.helferName ? sterneHTML(g.meineBewertung || 0, hn) : '');
        html += `<button type="button" class="btn btn-secondary" data-aktion="nochmal">${icon('wieder')}Noch mal anfragen</button>`;
      }
    } else if (g.status === 'offen') {
      html += `<button type="button" class="btn btn-primary" data-aktion="zusagen" ${dis}>Ich helfe</button>`;
    } else if (g.status === 'zugesagt') {
      html += `<button type="button" class="btn btn-primary" data-aktion="erledigt" ${dis}>Job erledigt melden</button>
        ${telefon ? `<a class="btn btn-secondary" href="${esc(telLink(telefon))}">${icon('telefon')}${esc(g.fuer ? 'Anrufen' : `${vn} anrufen`)}</a>` : ''}
        <button type="button" class="link-btn" data-aktion="absagen" ${dis}>Zusage zurückziehen</button>`;
    } else if (g.status === 'erledigt') {
      html += `<div class="status-box warn">Warte auf Bestätigung von ${esc(vn)}.</div>` +
        (live ? '' : `<button type="button" class="btn btn-secondary" data-aktion="bestaetigen">Demo: ${esc(vn)} bestätigt</button>`);
    } else if (g.status === 'bezahlt') {
      html += `<div class="status-box good">${icon('check')}${CONFIG.gebuehren ? `${euro(auszahlung(g))} ausgezahlt` : `${esc(vn)} hat bestätigt`}</div>` + sterneHTML(g.meineBewertung || 0, vn);
    }

    // Kleine Links: Karte, Teilen, Kalender
    const teilbar = g.status === 'offen' && !abgelaufen(g);
    const kalenderSinnvoll = ((g.helfer === 'ich' && g.status === 'zugesagt') || (g.eigen && (g.status === 'zugesagt' || teilbar))) && terminAusText(g.wann);
    html += `<div class="link-zeile">
        <button type="button" class="link-inline" data-aktion="karte" aria-label="Auf der Karte zeigen">${icon('karte', 'i-sm')}Karte</button>
        ${teilbar ? `<button type="button" class="link-inline" data-aktion="teilen" aria-label="${g.eigen ? 'Anfrage teilen' : 'Anfrage weitersagen'}">${icon('teilen', 'i-sm')}${g.eigen ? 'Teilen' : 'Weitersagen'}</button>` : ''}
        ${kalenderSinnvoll ? `<button type="button" class="link-inline" data-aktion="kalender" aria-label="In den Kalender eintragen">${icon('kalender', 'i-sm')}Kalender</button>` : ''}
        ${beteiligt && g.status === 'zugesagt' && (g.helfer === 'ich' || g.helferName) ? `<button type="button" class="link-inline" data-aktion="bescheid" aria-label="Einer Vertrauensperson Bescheid sagen">${icon('herz', 'i-sm')}Bescheid sagen</button>` : ''}
        ${vorlesenMoeglich() ? `<button type="button" class="link-inline" data-aktion="vorlesen" aria-pressed="${ui.vorlesen}">${icon('laut', 'i-sm')}${ui.vorlesen ? 'Stopp' : 'Vorlesen'}</button>` : ''}
      </div>`;
    html += pushKarteHTML(g);
    if (imChat(g)) {
      html += chatHTML(g);
      if (live) ladeNachrichten(g.id);
    }
    return html + meldenHTML(g);
  }

  function chatListeHTML(g) {
    const liste = nachrichtenVon(g);
    if (liste === null) return '<p class="chat-leer">Nachrichten werden geladen …</p>';
    if (!liste.length) return '<p class="chat-leer">Noch keine Nachrichten. Sprecht hier ab, wann es passt.</p>';
    return liste.map((n) => `<div class="blase ${n.von === 'ich' ? 'blase-ich' : ''}">
        <span class="sr-only">${n.von === 'ich' ? 'Du' : esc(g.eigen ? vorname(g.helferName) : vorname(g.wer))}:</span>
        <p>${esc(n.text)}</p><time datetime="${new Date(n.zeit).toISOString()}">${zeitText(n.zeit)}</time>
      </div>`).join('');
  }
  // Typische Betrugsmaschen aus Kleinanzeigen-Portalen: Vorkasse, Gutscheinkarten, Codes, fremde Links
  const BETRUG = /vorkasse|im voraus (zahlen|bezahlen|überweisen)|vorab (zahlen|bezahlen|überweisen)|anzahlung|gutschein(karte|code)|geschenkkarte|paysafe|western union|moneygram|freunde und familie|friends (and|&|und) family|bitcoin|krypto|\btan\b|\bpin\b|kreditkarte|(verifizierungs|bestätigungs|whatsapp)-?code|https?:\/\/|www\./i;
  const betrugsVerdacht = (g) => (nachrichtenVon(g) || []).some((n) => n.von !== 'ich' && BETRUG.test(n.text));
  function chatWarnungHTML(g) {
    return betrugsVerdacht(g) ? `<div class="chat-warnung" role="note">${icon('warnung')}<p><strong>Kurz aufpassen.</strong> Bezahlt wird erst nach der Hilfe, direkt und in bar oder per Überweisung. Schick kein Geld im Voraus, keine Gutscheinkarten und keine Codes, und öffne keine Links von Unbekannten.</p></div>` : '';
  }
  // Fertige Sätze zum Antippen (landen im Feld, gesendet wird erst mit dem Pfeil)
  function schnellAntworten(g) {
    if (g.status === 'zugesagt') return g.eigen ? ['Danke fürs Zusagen!', 'Wann kannst du kommen?', 'Bitte einfach klingeln.'] : ['Wann passt es dir genau?', 'Ich bin unterwegs.', 'Ich bin da.'];
    if (g.status === 'erledigt') return g.eigen ? ['Vielen Dank!'] : ['Ich bin fertig. Bitte bestätige kurz.'];
    return ['Danke, gerne wieder!'];
  }
  function chatHTML(g) {
    const partner = esc((g.eigen ? vorname(g.helferName) : vorname(g.wer)) || 'deinem Nachbarn');
    return `<section class="chat" aria-labelledby="chat-titel">
        <h3 class="chat-titel" id="chat-titel">${icon('sprechblase', 'i-sm')}Nachrichten mit ${partner}</h3>
        <div class="chat-liste" id="chat-liste" role="log" aria-live="polite" tabindex="0">${chatListeHTML(g)}</div>
        <div id="chat-warnung">${chatWarnungHTML(g)}</div>
        <div class="chat-schnell" role="group" aria-label="Fertige Antworten">${schnellAntworten(g).map((t) => `<button type="button" class="chip chip-vorschlag" data-schnellantwort="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <form class="chat-form" id="chat-form" autocomplete="off">
          <label class="sr-only" for="chat-text">Nachricht an ${partner}</label>
          <textarea id="chat-text" rows="1" maxlength="1000" placeholder="Nachricht an ${partner}" enterkeyhint="send"></textarea>
          <button type="submit" class="chat-senden" aria-label="Nachricht senden">${icon('senden')}</button>
        </form>
      </section>`;
  }
  function meldenHTML(g) {
    const live = istLive();
    const meldbar = !g.eigen || (live && !!g.helfer && g.status !== 'offen');
    if (!meldbar) return '';
    if (live ? db.gemeldet.has(g.id) : g.gemeldet) return `<p class="gemeldet">${icon('flagge', 'i-xs')}Gemeldet. Danke, wir prüfen das.</p>`;
    const wer = g.eigen ? (vorname(g.helferName) || 'Helfer') : vorname(g.wer);
    if (!ui.melden) return `<button type="button" class="link-btn link-melden" data-aktion="melden-frage">${icon('flagge', 'i-sm')}${g.eigen ? `${esc(wer)} melden` : 'Anfrage melden'}</button>`;
    const dis = ui.busy ? 'disabled aria-busy="true"' : '';
    return `<form class="melden-box" id="melden-form" novalidate>
        <fieldset class="feld"><legend>Was stimmt nicht?</legend>
          ${MELDEGRUENDE.map(([w, n]) => `<label class="check"><input type="radio" name="grund" id="melden-${w}" value="${w}"><span>${n}</span></label>`).join('')}
        </fieldset>
        <div class="feld"><label for="melden-text">Was ist passiert? (freiwillig)</label>
          <textarea id="melden-text" maxlength="500" rows="3"></textarea></div>
        ${anderePerson(g) ? `<label class="check"><input type="checkbox" id="melden-blockieren"><span>${esc(wer)} außerdem blockieren</span></label>` : ''}
        <p class="fehler" id="melden-fehler" role="alert" hidden></p>
        <div class="btn-row"><button type="submit" class="btn btn-danger-solid" ${dis}>Meldung senden</button>
          <button type="button" class="btn btn-secondary" data-aktion="melden-nein">Abbrechen</button></div>
        <p class="klein">Wir prüfen jede Meldung. ${esc(wer)} erfährt nicht, wer gemeldet hat. Bei Gefahr ruf die Polizei unter 110 an.</p>
      </form>`;
  }

  function sheetAnmeldenHTML() {
    const reg = ui.authModus === 'registrieren';
    // Anmelden ohne Passwort: Code per E-Mail (nur, wenn in CONFIG eingeschaltet)
    const codeWeg = !reg && CONFIG.codeLogin && ui.authWeg === 'code';
    const busy = ui.busy ? 'disabled aria-busy="true"' : '';
    const kopf = `<div class="sheet-top">
        <span class="eyebrow">Konto</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>`;
    if (ui.authFertig) {
      return kopf + `<h2 id="sheet-titel">Fast geschafft</h2>
        <div class="erfolg"><strong>Schau in dein Postfach.</strong><p>Wir haben dir eine E-Mail an ${esc(ui.authFertig)} geschickt. Tippe auf den Link darin, dann bist du angemeldet.</p></div>
        <button type="button" class="btn btn-secondary" data-close>Alles klar</button>`;
    }
    if (codeWeg && ui.authCode) {
      return kopf + `<h2 id="sheet-titel">Code eingeben</h2>
        <p class="klein">Wir haben dir einen Code mit 6 Ziffern an ${esc(ui.authCode)} geschickt. Schau auch im Spam-Ordner nach.</p>
        <form class="form" id="code-form" novalidate>
          <div class="feld"><label for="auth-code">Code aus der E-Mail</label>
            <input id="auth-code" class="code-eingabe" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></div>
          <p class="fehler" id="auth-fehler" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary" ${busy}>Anmelden</button>
        </form>
        <button type="button" class="link-btn" data-code-zurueck>Andere E-Mail oder neuer Code</button>`;
    }
    return kopf + `<h2 id="sheet-titel">${reg ? 'Konto erstellen' : 'Anmelden'}</h2>
      ${ui.authGrund ? `<p class="klein">${esc(ui.authGrund)}</p>` : ''}
      <div class="umschalter">
        <button type="button" data-auth-modus="anmelden" aria-pressed="${!reg}">Anmelden</button>
        <button type="button" data-auth-modus="registrieren" aria-pressed="${reg}">Neu registrieren</button>
      </div>
      <form class="form" id="auth-form" novalidate>
        ${reg ? `<div class="feld-row">
          <div class="feld"><label for="auth-vorname">Vorname</label><input id="auth-vorname" autocomplete="given-name" maxlength="40" required></div>
          <div class="feld"><label for="auth-initial">Nachname <span class="optional">(nur 1. Buchstabe)</span></label><input id="auth-initial" autocomplete="off" maxlength="1"></div>
        </div>
        <div class="feld"><label for="auth-stadtteil">Dein Ort <span class="optional">(Stadtteil, Stadt)</span></label>${ortFeldHTML('auth-stadtteil', gewaehlterOrt, 'Ort, Stadtteil oder Postleitzahl')}<p class="feld-hinweis">Andere sehen nur diesen Ort.</p></div>` : ''}
        <div class="feld"><label for="auth-email">E-Mail</label><input id="auth-email" type="email" autocomplete="email" required>${codeWeg ? '<p class="feld-hinweis" style="margin-top:0">Wir schicken dir einen Code. Ein Passwort brauchst du nicht.</p>' : ''}</div>
        ${codeWeg ? '' : `<div class="feld"><label for="auth-passwort">Passwort</label>
          <div class="passwort-feld"><input id="auth-passwort" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required>
            <button type="button" class="passwort-auge" data-passwort-zeigen aria-pressed="false" aria-label="Passwort anzeigen">${icon('auge')}</button></div>
          ${reg ? '<p class="feld-hinweis" style="margin-top:0">Mindestens 8 Zeichen.</p>' : ''}</div>`}
        ${reg ? `<label class="check"><input type="checkbox" id="auth-18"><span>Ich bin mindestens 18 Jahre alt.</span></label>
        <label class="check"><input type="checkbox" id="auth-regeln"><span>Ich akzeptiere die Nutzungsbedingungen. Hand Drauf vermittelt nur, die Absprache und Bezahlung läuft direkt zwischen uns Nachbarn, gelegentlich und in kleinem Umfang.</span></label>
        <p class="klein recht-links-form">Lies vorher die <a href="${NATIV ? OEFFENTLICH : ''}#nutzung" target="_blank" rel="noopener">Nutzungsbedingungen</a> und die <a href="${NATIV ? OEFFENTLICH : ''}#datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a> (öffnen ${NATIV ? 'im Browser' : 'in neuem Tab'}).</p>` : ''}
        <p class="fehler" id="auth-fehler" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary" ${busy}>${reg ? 'Konto erstellen' : codeWeg ? 'Code per E-Mail schicken' : 'Anmelden'}</button>
      </form>
      ${!reg && CONFIG.codeLogin ? `<button type="button" class="link-btn" data-auth-weg="${codeWeg ? 'passwort' : 'code'}">${codeWeg ? 'Lieber mit Passwort anmelden' : 'Ohne Passwort anmelden (Code per E-Mail)'}</button>` : ''}`;
  }

  function sheetKontoHTML() {
    const p = db.profil;
    if (!p) return '';
    const bewertung = p.sterne_anzahl
      ? `${icon('stern', 'i-xs i-fill')}${(p.sterne_summe / p.sterne_anzahl).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${p.sterne_anzahl} ${p.sterne_anzahl === 1 ? 'Bewertung' : 'Bewertungen'}`
      : 'Noch keine Bewertungen';
    return `<div class="sheet-top">
        <span class="eyebrow">Dein Konto</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <div class="konto-kopf">
        ${avatarHTML(kuerzel(p), p.bild)}
        <div>
          <h2 id="sheet-titel">${esc(anzeigename(p))}</h2>
          <div class="person-meta">${bewertung}</div>
        </div>
      </div>
      <p class="klein">Angemeldet als ${esc(db.user && db.user.email)}. Andere sehen nur deinen Vornamen, den Anfangsbuchstaben und deinen Ort.</p>
      <button type="button" class="btn btn-secondary" data-mein-profil>${icon('stern')}Dein Profil und deine Bewertungen</button>
      <div class="konto-ort"><span><span class="klein">Dein Ort</span><strong id="konto-ort">${esc(p.stadtteil)}</strong></span><button type="button" class="btn btn-secondary btn-auto" data-ort-aendern>Ändern</button></div>
      <button type="button" class="btn btn-secondary" data-einladen>${icon('teilen')}Nachbarn einladen</button>
      <button type="button" class="btn btn-secondary" data-abmelden ${ui.busy ? 'disabled' : ''}>Abmelden</button>
      ${blockListeHTML()}
      ${ui.loeschen
        ? `<div class="bestaetigen-box loeschen-box"><p><strong>Konto wirklich löschen?</strong> Dein Profil, deine Anfragen, Adressen, Nachrichten und Bewertungen werden gelöscht. Laufende Zusagen werden freigegeben. Das lässt sich nicht rückgängig machen.</p>
            <div class="btn-row"><button type="button" class="btn btn-danger-solid" data-konto-loeschen ${ui.busy ? 'disabled aria-busy="true"' : ''}>Endgültig löschen</button>
            <button type="button" class="btn btn-secondary" data-loeschen-nein>Abbrechen</button></div></div>`
        : `<button type="button" class="link-btn link-melden" data-loeschen-frage>Konto löschen</button>`}`;
  }

  /* ===== Profile mit Bewertungen (Vorbild: Airbnb, BlaBlaCar) =====
     Eine Person: live über die Profil-ID, in der Demo über den Namen (DEMO_PERSONEN) bzw. 'ich'.
     Einheitliche Form: { key, name, kuerzel, stadtteil, dabei, hilfen, gesuche, volljaehrig, ich,
       sterne, anzahl, verteilung [1..5], liste: [Bewertungen mit Text] | null (lädt) | false (gibt es noch nicht), ohneText } */
  const STERNE_WORTE = ['', 'Schlecht', 'Nicht so gut', 'In Ordnung', 'Gut', 'Sehr gut'];
  const komma = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const initialenVon = (name) => String(name || '?').split(' ').map((t) => t[0] || '').join('').slice(0, 2).toUpperCase();
  function sterneAnzeige(wert, cls) {
    const voll = Math.round(wert || 0);
    return `<span class="sterne-anzeige${cls ? ' ' + cls : ''}" role="img" aria-label="${komma(wert || 0).replace(',0', '')} von 5 Sternen">${[1, 2, 3, 4, 5].map((n) => icon('stern', n <= voll ? 'i-xs i-fill' : 'i-xs i-leer')).join('')}</span>`;
  }
  function wannBewertet(datum) {
    const tage = Math.floor((Date.now() - new Date(datum).getTime()) / TAG_MS);
    if (tage < 1) return 'Heute';
    if (tage < 2) return 'Gestern';
    if (tage < 7) return `Vor ${tage} Tagen`;
    if (tage < 28) { const w = Math.round(tage / 7); return w === 1 ? 'Vor einer Woche' : `Vor ${w} Wochen`; }
    return new Date(datum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }
  function verteilungVon(alle) {
    const v = [0, 0, 0, 0, 0, 0];
    alle.forEach((x) => { v[x] += 1; });
    return v;
  }

  // Demo: Profil einer Beispiel-Person mit allen Bewertungen (geschriebene, ergänzte nur mit Sternen, deine eigenen)
  function demoProfil(key) {
    const ich = key === 'ich';
    const p = ich ? DEMO_ICH : DEMO_PERSONEN[key];
    if (!p) return null;
    const name = ich ? DEMO_ICH.name : key;
    const geschrieben = p.bewertungen.map(([sterne, von, rolle, kat, titel, tage, text]) =>
      ({ sterne, von, vonKey: DEMO_PERSONEN[von] ? von : null, rolle, kat, titel, datum: new Date(Date.now() - tage * TAG_MS), text }));
    // Nur Sterne: bis zur Anzahl auffüllen, so dass der Schnitt stimmt
    const n = p.hilfen + p.gesuche, rest = Math.max(0, n - geschrieben.length);
    const summe = geschrieben.reduce((t, b) => t + b.sterne, 0);
    let fehlt = Math.max(0, rest * 5 - (Math.round(p.schnitt * n) - summe));
    const nurSterne = Array.from({ length: rest }, () => 5).map((x) => { const weg = Math.min(2, fehlt); fehlt -= weg; return x - weg; });
    // Was du in der Demo selbst bewertet hast (erscheint, sobald beide bewertet haben)
    const dazu = [];
    gesuche.forEach((g) => {
      if (g.helfer !== 'ich' || !g.bewertungSichtbar) return;
      if (ich && g.ihreBewertung) dazu.push({ sterne: g.ihreBewertung.sterne, von: g.wer, vonKey: DEMO_PERSONEN[g.wer] ? g.wer : null, rolle: 'geholfen', kat: g.kat, titel: g.titel, datum: new Date(g.bewertetAm || Date.now()), text: g.ihreBewertung.text });
      if (!ich && g.wer === key && g.meineBewertung) dazu.push({ sterne: g.meineBewertung, von: DEMO_ICH.name, vonKey: 'ich', rolle: 'gesucht', kat: g.kat, titel: g.titel, datum: new Date(g.bewertetAm || Date.now()), text: g.meinText || '' });
    });
    const mitText = dazu.concat(geschrieben).filter((b) => b.text);
    const alle = geschrieben.concat(dazu).map((b) => b.sterne).concat(nurSterne);
    const anzeige = gesuche.find((g) => g.wer === key);
    return { key, name, kuerzel: initialenVon(name), stadtteil: ich ? meinOrt().stadtteil : (anzeige ? anzeige.stadtteil : p.stadtteil), dabei: p.dabei,
      hilfen: p.hilfen + dazu.filter((b) => b.rolle === 'geholfen').length, gesuche: p.gesuche + dazu.filter((b) => b.rolle === 'gesucht').length,
      volljaehrig: true, ich, sterne: alle.length ? alle.reduce((t, x) => t + x, 0) / alle.length : null, anzahl: alle.length,
      verteilung: verteilungVon(alle), liste: mitText.sort((x, y) => y.datum - x.datum), ohneText: alle.length - mitText.length,
      ...steckbriefVon(ich ? demoSteckbrief : DEMO_STECKBRIEFE[key]) };
  }
  // Über mich, Bild, hilft gern, Sprachen, Zeiten: aus der Demo (Liste oder dein Speicher) oder aus der Datenbank
  function steckbriefVon(x) {
    if (!x) return { bio: '', bild: '', hilftGern: [], sprachen: [], zeiten: [] };
    if (Array.isArray(x)) return { bio: x[0], bild: '', hilftGern: x[1], sprachen: x[2], zeiten: x[3] };
    return { bio: x.bio || '', bild: x.bild || '', hilftGern: x.hilftGern || x.hilft_gern || [], sprachen: x.sprachen || [], zeiten: x.zeiten || [] };
  }
  const bildUrl = (pfad) => !pfad ? '' : /^(data:|blob:)/.test(pfad) ? pfad : `${LIVE.url}/storage/v1/object/public/profilbilder/${pfad}`;
  // Profilbild oder Anfangsbuchstaben. Lädt das Bild nicht, bleiben die Buchstaben (siehe Fehler-Lauscher unten).
  function avatarHTML(kuerzelText, bild, cls) {
    const url = bildUrl(bild);
    return `<span class="avatar${cls ? ' ' + cls : ''}${url ? ' mit-bild' : ''}" aria-hidden="true">${esc(kuerzelText || '?')}${url ? `<img src="${esc(url)}" alt="" decoding="async" loading="lazy">` : ''}</span>`;
  }
  // Mein Profilbild (live: aus dem Profil, Demo: aus dem Speicher)
  const meinBild = () => istLive() ? ((db.profil && db.profil.bild) || '') : (demoSteckbrief.bild || '');
  // Live: Profilbilder anderer nachladen (einmal je Person; ohne Update Teil 9 gibt es keine)
  function bilderLaden(ids) {
    if (!istLive() || !db.client || db.teil9 === false) return;
    const neu = Array.from(new Set(ids.filter((id) => id && !db.bilder.has(id))));
    if (!neu.length) return;
    neu.forEach((id) => db.bilder.set(id, ''));
    db.client.from('profile').select('id, bild').in('id', neu).then(({ data, error }) => {
      if (error) { if (error.code === '42703') db.teil9 = false; return; }
      db.teil9 = true;
      let geaendert = false;
      (data || []).forEach((r) => { if (r.bild) { db.bilder.set(r.id, r.bild); geaendert = true; } });
      if (!geaendert) return;
      if (ui.offen || ui.panel) renderSheet();
    });
  }
  // Sterne und Anzahl für die Zeile „Person“ in einer Anfrage
  function personZahlen(g) {
    if (istLive()) return { sterne: g.sterne, anzahl: g.bewertungen || 0 };
    const p = demoProfil(g.wer);
    return p ? { sterne: p.sterne, anzahl: p.anzahl } : { sterne: g.sterne, anzahl: g.bewertungen || 0 };
  }

  // Live: Profil und erschienene Bewertungen laden (einmal je Sitzung und Person, nach dem Bewerten neu)
  function profilLaden(id) {
    if (!db.profile.has(id)) {
      db.profile.set(id, null);
      const spalten = 'vorname, nachname_initial, stadtteil, volljaehrig, sterne_summe, sterne_anzahl, hilfen_anzahl, gesuche_anzahl, erstellt';
      db.client.from('profile').select(spalten + (db.teil9 === false ? '' : ', bio, bild, hilft_gern, sprachen, zeiten')).eq('id', id).maybeSingle()
        .then((r) => r.error && r.error.code === '42703' ? (db.teil9 = false, db.client.from('profile').select(spalten).eq('id', id).maybeSingle()) : r)
        .then(({ data }) => { db.profile.set(id, data || false); if (data && data.bild !== undefined) db.bilder.set(id, data.bild); if (ui.panel === 'profil') renderSheet(); });
    }
    if (!db.rezensionen.has(id)) {
      db.rezensionen.set(id, null);
      db.client.rpc('bewertungen_von', { p_person: id }).then(({ data, error }) => {
        if (error) { if (error.code === 'PGRST202' || error.code === '42883') db.teil8 = false; db.rezensionen.set(id, false); }
        else {
          db.teil8 = true;
          db.rezensionen.set(id, (data || []).map((r) => ({ gesuchId: r.gesuch_id, sterne: r.sterne, text: r.text || '', von: r.von_name, vonKey: r.von,
            rolle: r.rolle, kat: r.kategorie, titel: r.titel, datum: r.erstellt })));
          bilderLaden((data || []).map((r) => r.von));
        }
        if (ui.panel === 'profil') renderSheet();
      });
    }
  }
  function profilDaten(key) {
    if (!istLive()) return demoProfil(key);
    const id = key === 'ich' ? db.user && db.user.id : key;
    if (!id) return false;
    profilLaden(id);
    const p = db.profile.get(id);
    if (!p) return p;
    const rez = db.rezensionen.get(id);
    const liste = rez ? rez.filter((b) => b.text) : rez;
    const verteilung = rez ? verteilungVon(rez.map((b) => b.sterne)) : null;
    return { key: id, name: anzeigename(p), kuerzel: kuerzel(p), stadtteil: p.stadtteil, dabei: new Date(p.erstellt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      hilfen: p.hilfen_anzahl || 0, gesuche: p.gesuche_anzahl || 0, volljaehrig: p.volljaehrig, ich: !!(db.user && id === db.user.id),
      sterne: p.sterne_anzahl ? p.sterne_summe / p.sterne_anzahl : null, anzahl: p.sterne_anzahl || 0, verteilung, liste,
      ohneText: rez ? rez.length - liste.length : 0, ...steckbriefVon(p) };
  }

  // Profil öffnen. zurueck: wohin „Zurück“ führt ({ art: 'gesuch', id } | { art: 'profil', key, name } | { art: 'panel', name })
  function profilOeffnen(key, name, zurueck) {
    const ausloeser = ui.panel === 'profil' ? ui.zuletzt : (ui.zuletzt || document.activeElement);
    if (ui.panel !== 'profil') oeffnePanel('profil');
    ui.zuletzt = ausloeser;
    ui.profilStapel = zurueck ? (ui.profilStapel || []).concat([zurueck]) : [];
    ui.profil = { key, name };
    ui.profilAlle = false;
    ui.rezMelden = null;
    ui.profilMelden = false;
    ui.profilBearbeiten = false;
    ui.fotoEntwurf = null;
    ui.blockieren = false;
    renderSheet();
    $('#sheet').scrollTop = 0;
    const t = $('#sheet-titel');
    if (t) t.focus({ preventScroll: true });
  }
  function profilZurueck() {
    const stapel = ui.profilStapel || [];
    const ziel = stapel[stapel.length - 1];
    ui.profilStapel = stapel.slice(0, -1);
    if (!ziel) { schliessen(); return; }
    if (ziel.art === 'gesuch') { const zuletzt = ui.zuletzt; oeffnen(ziel.id, zuletzt); return; }
    if (ziel.art === 'panel') { oeffnePanel(ziel.name); return; }
    ui.profil = { key: ziel.key, name: ziel.name };
    ui.profilAlle = false; ui.rezMelden = null; ui.profilMelden = false; ui.profilBearbeiten = false; ui.fotoEntwurf = null; ui.blockieren = false;
    renderSheet();
    $('#sheet').scrollTop = 0;
    const t = $('#sheet-titel');
    if (t) t.focus({ preventScroll: true });
  }
  function zurueckText() {
    const stapel = ui.profilStapel || [];
    const ziel = stapel[stapel.length - 1];
    if (!ziel) return '';
    if (ziel.art === 'gesuch') return 'Zurück zur Anfrage';
    if (ziel.art === 'panel') return ziel.name === 'konto' ? 'Zurück zum Konto' : 'Zurück zum Menü';
    return `Zurück zu ${vorname(ziel.name)}`;
  }

  // Bewertungen melden: Gründe passend zu Bewertungen, gespeichert als einer der Gründe der Datenbank
  const REZ_GRUENDE = [['unangemessen', 'Beleidigend oder unangemessen', 'unangemessen'], ['privat', 'Enthält private Angaben (Adresse, Telefon, Gesundheit)', 'anderes'],
    ['falsch', 'Gehört nicht zu diesem Auftrag oder ist erfunden', 'anderes'], ['geld', 'Gegen Geld oder unter Druck geschrieben', 'betrug']];
  const rezSchluessel = (b) => (b.gesuchId || b.titel) + '|' + (b.vonKey || b.von);

  function rezensionHTML(b, i, p) {
    const vn = vorname(b.von);
    const vonIch = b.vonKey === 'ich' || (istLive() && db.user && b.vonKey === db.user.id);
    const name = b.vonKey && !vonIch
      ? `<button type="button" class="rez-name" data-profil-key="${esc(b.vonKey)}" data-profil-name="${esc(b.von)}">${esc(b.von)}</button>`
      : `<strong class="rez-name">${vonIch ? 'Du' : esc(b.von)}</strong>`;
    const wer = b.rolle === 'geholfen' ? (p.ich ? 'Du' : vorname(p.name)) : (vonIch ? 'Du' : vn);
    const gemeldet = db.rezGemeldet.has(rezSchluessel(b));
    let melden = '';
    if (!vonIch) {
      if (gemeldet) melden = `<p class="gemeldet">${icon('flagge', 'i-xs')}Gemeldet. Danke, wir prüfen das.</p>`;
      else if (ui.rezMelden !== i) melden = `<button type="button" class="link-btn rez-melden" data-rez-melden="${i}" aria-label="Bewertung von ${esc(b.von)} melden">${icon('flagge', 'i-xs')}Melden</button>`;
      else melden = `<form class="melden-box" id="rez-melden-form" data-rez="${i}" novalidate>
          <fieldset class="feld"><legend>Was stimmt mit dieser Bewertung nicht?</legend>
            ${REZ_GRUENDE.map(([w, n]) => `<label class="check"><input type="radio" name="rez-grund" id="rez-grund-${w}" value="${w}"><span>${n}</span></label>`).join('')}
          </fieldset>
          <div class="feld"><label for="rez-melden-text">Was sollen wir wissen? (freiwillig)</label><textarea id="rez-melden-text" maxlength="400" rows="2"></textarea></div>
          <p class="fehler" id="rez-melden-fehler" role="alert" hidden></p>
          <div class="btn-row"><button type="submit" class="btn btn-danger-solid" ${ui.busy ? 'disabled aria-busy="true"' : ''}>Meldung senden</button>
            <button type="button" class="btn btn-secondary" data-rez-melden-nein>Abbrechen</button></div>
        </form>`;
    }
    return `<li class="rezension">
        <div class="rez-kopf">
          ${avatarHTML(vonIch ? kuerzelIch() : initialenVon(b.von), vonIch ? meinBild() : istLive() ? db.bilder.get(b.vonKey) : '', 'avatar-klein')}
          <div class="rez-wer">${name}<span class="rez-wann">${esc(wannBewertet(b.datum))}</span></div>
          ${sterneAnzeige(b.sterne)}
        </div>
        <p class="rez-auftrag">${icon(b.kat, 'i-xs')}<span>${esc(wer)} ${wer === 'Du' ? 'hast' : 'hat'} geholfen: ${esc(b.titel || '')}</span></p>
        <p class="rez-text">${esc(b.text)}</p>
        ${melden}
      </li>`;
  }
  function kuerzelIch() { return istLive() ? kuerzel(db.profil) : CONFIG.ich.initialen; }

  function sheetProfilHTML() {
    const pr = ui.profil || {};
    const zurueck = zurueckText();
    const kopf = `<div class="sheet-top">
        ${zurueck ? `<button type="button" class="link-btn zurueck" data-profil-zurueck><span class="zurueck-pfeil" aria-hidden="true">‹</span>${esc(zurueck)}</button>` : '<span class="eyebrow">Profil</span>'}
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>`;
    const p = profilDaten(pr.key);
    if (!p) return kopf + `<h2 id="sheet-titel" tabindex="-1">${p === null ? 'Profil wird geladen …' : 'Profil nicht verfügbar'}</h2>`;
    if (p.ich && ui.profilBearbeiten) return `<div class="sheet-top">
        <button type="button" class="link-btn zurueck" data-profil-abbrechen><span class="zurueck-pfeil" aria-hidden="true">‹</span>Zurück zu deinem Profil</button>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>` + profilFormHTML(p);
    const vn = vorname(p.name);
    let bewertungen;
    if (!p.anzahl) bewertungen = `<p class="rez-leer">${p.ich ? 'Du hast noch keine Bewertungen.' : `${esc(vn)} hat noch keine Bewertungen.`} Nach jedem Auftrag bewertet ihr euch gegenseitig.</p>`;
    else {
      const v = p.verteilung;
      const verteilung = v ? `<ul class="rez-verteilung" aria-label="So verteilen sich die Sterne">${[5, 4, 3, 2, 1].map((n) =>
        `<li><span class="rez-stufe">${n}${icon('stern', 'i-xs i-fill')}</span><span class="rez-balken" aria-hidden="true"><i style="width:${Math.round(v[n] / p.anzahl * 100)}%"></i></span><span class="rez-zahl">${v[n]}</span><span class="sr">${n} ${n === 1 ? 'Stern' : 'Sterne'}: ${v[n]}</span></li>`).join('')}</ul>` : '';
      const schnitt = `<div class="rez-schnitt"><strong>${komma(p.sterne)}</strong>${sterneAnzeige(p.sterne)}<span>${p.anzahl} ${p.anzahl === 1 ? 'Bewertung' : 'Bewertungen'}</span></div>`;
      let liste = '';
      if (p.liste === null) liste = '<p class="lade">Bewertungen werden geladen …</p>';
      else if (p.liste === false) liste = `<p class="klein">Geschriebene Bewertungen gibt es nach dem nächsten Update der Datenbank.</p>`;
      else if (p.liste.length) {
        const zeige = ui.profilAlle ? p.liste : p.liste.slice(0, 4);
        ui.profilListe = zeige;
        liste = `<ul class="rez-liste">${zeige.map((b, i) => rezensionHTML(b, i, p)).join('')}</ul>`
          + (p.liste.length > zeige.length ? `<button type="button" class="btn btn-secondary" data-profil-alle>Alle ${p.liste.length} geschriebenen Bewertungen zeigen</button>` : '');
      }
      if (p.liste && p.ohneText) liste += `<p class="klein rez-ohne">${p.liste.length ? 'Dazu' : 'Bisher'} ${p.ohneText} ${p.ohneText === 1 ? 'Bewertung' : 'Bewertungen'} nur mit Sternen.</p>`;
      bewertungen = `<div class="rez-uebersicht">${schnitt}${verteilung}</div>${liste}<p class="klein rez-echt">Bewerten können nur die beiden Personen eines Auftrags, der über Hand Drauf vereinbart und bestätigt wurde. Wir prüfen Bewertungen nicht vorab, gehen aber jeder Meldung nach.</p>`;
    }
    const person = p.ich ? null : { id: p.key, name: p.name };
    const chips = (liste) => liste.map((x) => `<span class="steck-chip">${x}</span>`).join('');
    const zeilen = [];
    if (p.hilftGern.length) zeilen.push(['Hilft gern bei', chips(p.hilftGern.filter((k) => KATEGORIEN.some((x) => x.id === k)).map((k) => icon(k, 'i-xs') + esc(katName(k))))]);
    if (p.sprachen.length) zeilen.push(['Spricht', chips(p.sprachen.map(esc))]);
    if (p.zeiten.length) zeilen.push(['Hat meist Zeit', chips(ZEITEN.filter(([w]) => p.zeiten.includes(w)).map(([, n]) => esc(n)))]);
    const leer = !p.bio && !p.bild && !zeilen.length;
    const steckbrief = (p.bio ? `<p class="profil-bio">${esc(p.bio).replace(/\n/g, '<br>')}</p>` : '')
      + (zeilen.length ? `<dl class="steckbrief">${zeilen.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>` : '');
    const eigenes = p.ich ? (leer
      ? `<div class="profil-anstoss"><p><strong>Mach dein Profil persönlich.</strong> Mit Foto und ein paar Sätzen über dich wissen Nachbarn, wer klingelt.</p>
          <button type="button" class="btn btn-primary" data-profil-bearbeiten>${icon('kamera')}Foto und Angaben hinzufügen</button></div>`
      : `<button type="button" class="btn btn-secondary profil-bearbeiten-knopf" data-profil-bearbeiten>${icon('stift')}Profil bearbeiten</button>`) : '';
    return kopf + `<div class="profil-kopf">
        ${avatarHTML(p.kuerzel, p.bild, 'avatar-gross')}
        <div><h2 id="sheet-titel" tabindex="-1">${p.ich ? 'Dein Profil' : esc(p.name)}</h2><p class="person-meta">${p.ich ? esc(p.name) + ' · ' : ''}${esc(p.stadtteil || '')} · dabei seit ${esc(p.dabei)}</p></div>
      </div>
      ${p.ich ? '<p class="klein">So sehen dich andere. Adresse und E-Mail sieht niemand.</p>' : ''}
      ${eigenes}
      ${steckbrief}
      <dl class="profil-zahlen">
        <div><dt>Bewertung</dt><dd>${p.anzahl ? icon('stern', 'i-sm i-fill') + komma(p.sterne) : '–'}</dd><dd class="klein">${p.anzahl} ${p.anzahl === 1 ? 'Bewertung' : 'Bewertungen'}</dd></div>
        <div><dt>Geholfen</dt><dd>${p.hilfen}</dd><dd class="klein">${p.hilfen === 1 ? 'Auftrag' : 'Aufträge'}</dd></div>
        <div><dt>Hilfe bekommen</dt><dd>${p.gesuche}</dd><dd class="klein">${p.gesuche === 1 ? 'Auftrag' : 'Aufträge'}</dd></div>
      </dl>
      <section class="rez" aria-labelledby="rez-titel"><h3 class="h-klein" id="rez-titel">${p.ich ? 'So wurdest du bewertet' : 'Bewertungen'}</h3>${bewertungen}</section>
      <ul class="profil-belege">
        ${p.volljaehrig ? `<li>${icon('check', 'i-sm')}Mindestens 18 Jahre, bei der Anmeldung bestätigt</li>` : ''}
        <li>${icon('check', 'i-sm')}Konto mit E-Mail-Adresse</li>
        <li>${icon('check', 'i-sm')}Hat den Regeln für Nachbarn zugestimmt</li>
      </ul>
      <p class="klein">${p.ich ? 'Andere sehen nur deinen Vornamen, den Anfangsbuchstaben und deinen Ort.' : 'Andere sehen nur Vorname, Anfangsbuchstabe und Ort. Adresse und E-Mail sieht niemand.'} Bewertungen erscheinen für beide gleichzeitig, wenn beide bewertet haben, spätestens nach 14 Tagen.</p>
      ${person ? profilMeldenHTML(person) + blockierenHTML(person) : ''}`;
  }

  // Profil melden (zum Beispiel ein unpassendes Bild): eigene Gründe, gespeichert als einer der Gründe der Datenbank
  const PROFIL_GRUENDE = [['bild', 'Unpassendes Foto', 'unangemessen'], ['text', 'Beleidigender oder anstößiger Text', 'unangemessen'],
    ['falsch', 'Gibt sich als jemand anderes aus', 'betrug'], ['anderes', 'Etwas anderes', 'anderes']];
  function profilMeldenHTML(person) {
    if (db.rezGemeldet.has('profil|' + person.id)) return `<p class="gemeldet">${icon('flagge', 'i-xs')}Profil gemeldet. Danke, wir prüfen das.</p>`;
    if (!ui.profilMelden) return `<button type="button" class="link-btn rez-melden" data-profil-melden>${icon('flagge', 'i-xs')}Profil melden</button>`;
    return `<form class="melden-box" id="profil-melden-form" novalidate>
        <fieldset class="feld"><legend>Was stimmt mit diesem Profil nicht?</legend>
          ${PROFIL_GRUENDE.map(([w, n]) => `<label class="check"><input type="radio" name="profil-grund" id="profil-grund-${w}" value="${w}"><span>${n}</span></label>`).join('')}
        </fieldset>
        <div class="feld"><label for="profil-melden-text">Was sollen wir wissen? (freiwillig)</label><textarea id="profil-melden-text" maxlength="400" rows="2"></textarea></div>
        <p class="fehler" id="profil-melden-fehler" role="alert" hidden></p>
        <div class="btn-row"><button type="submit" class="btn btn-danger-solid" ${ui.busy ? 'disabled aria-busy="true"' : ''}>Meldung senden</button>
          <button type="button" class="btn btn-secondary" data-profil-melden-nein>Abbrechen</button></div>
      </form>`;
  }

  /* ----- Eigenes Profil bearbeiten: Foto, Über mich, hilft gern bei, Sprachen, Zeiten ----- */
  function profilFormHTML(p) {
    const e = ui.fotoEntwurf;
    const bildJetzt = e ? (e.entfernen ? '' : e.url) : p.bild;
    const busy = ui.busy ? 'disabled aria-busy="true"' : '';
    const gruppe = (id, titel, liste, gewaehlt) => `<div class="feld" role="group" aria-labelledby="wahl-${id}-titel">
        <span class="wahl-titel" id="wahl-${id}-titel">${titel}</span>
        <div class="vorschlaege">${liste.map(([w, n, ic]) => `<button type="button" class="chip chip-vorschlag" data-wahl="${id}" data-wert="${esc(w)}" aria-pressed="${gewaehlt.includes(w)}">${ic ? icon(ic) : ''}<span>${esc(n)}</span></button>`).join('')}</div>
      </div>`;
    const weitere = p.sprachen.filter((x) => !SPRACHEN.includes(x));
    const ohne = istLive() && db.teil9 === false;
    return `<h2 id="sheet-titel" tabindex="-1">Profil bearbeiten</h2>
      ${ohne ? '<p class="status-box warn">Foto und Angaben gehen erst nach dem nächsten Update der Datenbank.</p>' : ''}
      <form id="profil-form" class="profil-form" novalidate>
        <div class="foto-feld">
          ${avatarHTML(p.kuerzel, bildJetzt, 'avatar-riesig')}
          <div class="foto-knoepfe">
            <input type="file" id="foto-datei" class="datei-versteckt" accept="image/*" aria-describedby="foto-hinweis" ${ohne ? 'disabled' : ''}>
            <label for="foto-datei" class="btn btn-secondary">${icon('kamera')}${bildJetzt ? 'Anderes Foto' : 'Foto wählen'}</label>
            ${e && e.url ? `<button type="button" class="btn btn-secondary" data-foto-drehen>${icon('wieder')}Drehen</button>` : ''}
            ${bildJetzt ? '<button type="button" class="link-btn" data-foto-weg>Foto entfernen</button>' : ''}
          </div>
        </div>
        <p class="feld-hinweis" id="foto-hinweis">Am besten ein freundliches Foto von dir allein: keine anderen Personen, keine Kinder. Alle können es sehen. Die App verkleinert es und entfernt dabei Angaben wie den Aufnahmeort.</p>
        <p class="fehler" id="foto-fehler" role="alert" hidden></p>
        <div class="feld"><label for="profil-bio">Über mich <span class="klein">(freiwillig)</span></label>
          <textarea id="profil-bio" maxlength="300" rows="4" aria-describedby="profil-bio-hinweis" placeholder="z. B. seit wann du hier wohnst, was du gern machst, ob du ein Auto oder Werkzeug hast">${esc(p.bio)}</textarea>
          <p class="feld-hinweis" id="profil-bio-hinweis"><span id="bio-zahl">${p.bio.length}</span> von 300 Zeichen. Bitte keine Adresse, Telefonnummer oder E-Mail.</p></div>
        ${gruppe('hilft', 'Ich helfe gern bei', KATEGORIEN.map((k) => [k.id, k.name, k.id]), p.hilftGern)}
        ${gruppe('sprache', 'Ich spreche', SPRACHEN.map((x) => [x, x]), p.sprachen)}
        <div class="feld"><label for="profil-sprachen">Weitere Sprachen <span class="klein">(mit Komma trennen)</span></label>
          <input id="profil-sprachen" type="text" maxlength="120" autocomplete="off" value="${esc(weitere.join(', '))}"></div>
        ${gruppe('zeit', 'Ich habe meist Zeit', ZEITEN, p.zeiten)}
        <p class="fehler" id="profil-fehler" role="alert" hidden></p>
        <div class="btn-row"><button type="submit" class="btn btn-primary" ${busy} ${ohne ? 'disabled' : ''}>Profil speichern</button>
          <button type="button" class="btn btn-secondary" data-profil-abbrechen>Abbrechen</button></div>
      </form>`;
  }
  // Foto auf dem Gerät quadratisch zuschneiden und verkleinern (JPEG, ohne Metadaten wie den Aufnahmeort)
  function fotoZeichnen(bild, drehung, groesse) {
    const c = document.createElement('canvas');
    c.width = c.height = groesse;
    const x = c.getContext('2d');
    const seite = Math.min(bild.naturalWidth || bild.width, bild.naturalHeight || bild.height);
    x.fillStyle = '#fff';
    x.fillRect(0, 0, groesse, groesse);
    x.translate(groesse / 2, groesse / 2);
    x.rotate(drehung * Math.PI / 180);
    const w = bild.naturalWidth || bild.width, h = bild.naturalHeight || bild.height;
    x.drawImage(bild, (w - seite) / 2, (h - seite) / 2, seite, seite, -groesse / 2, -groesse / 2, groesse, groesse);
    return c;
  }
  function fotoGewaehlt(datei) {
    const fehler = $('#foto-fehler');
    const zeige = (t) => { if (fehler) { fehler.textContent = t; fehler.hidden = false; } };
    if (!datei) return;
    if (!/^image\//.test(datei.type || 'image/')) { zeige('Bitte ein Foto wählen (JPG oder PNG).'); return; }
    if (datei.size > 20 * 1024 * 1024) { zeige('Das Foto ist zu groß. Bitte eines unter 20 MB wählen.'); return; }
    const url = URL.createObjectURL(datei);
    const bild = new Image();
    bild.onload = () => {
      ui.fotoEntwurf = { bild, drehung: 0, url: fotoZeichnen(bild, 0, 240).toDataURL('image/jpeg', 0.85) };
      URL.revokeObjectURL(url);
      renderSheet();
      const k = $('#sheet [data-foto-drehen]');
      if (k) k.focus({ preventScroll: true });
    };
    bild.onerror = () => { URL.revokeObjectURL(url); zeige('Dieses Foto kann der Browser nicht öffnen. Bitte ein JPG oder PNG wählen.'); };
    bild.src = url;
  }
  async function profilSpeichern() {
    const p = profilDaten('ich');
    if (!p) return;
    const fehler = $('#profil-fehler');
    const zeige = (t, feld) => { fehler.textContent = t; fehler.hidden = false; if (feld) feld.focus(); };
    const bioFeld = $('#profil-bio');
    const bio = bioFeld.value.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
    if (bio.length > 300) { zeige('„Über mich“ darf höchstens 300 Zeichen lang sein.', bioFeld); return; }
    if (bio && anstoessig(bio)) { zeige('Bitte schreib sachlich. Beleidigende oder anstößige Wörter werden nicht veröffentlicht.', bioFeld); return; }
    if (/\S+@\S+\.\S+/.test(bio) || /\d[\d /-]{6,}\d/.test(bio)) { zeige('Bitte keine Telefonnummern oder E-Mail-Adressen ins Profil schreiben. Alle können es lesen.', bioFeld); return; }
    const gewaehlt = (id) => Array.from(document.querySelectorAll(`#profil-form [data-wahl="${id}"][aria-pressed="true"]`)).map((b) => b.dataset.wert);
    const sprFeld = $('#profil-sprachen');
    const weitere = sprFeld.value.split(',').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
    if (weitere.some((x) => x.length > 30 || !/^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ž -]*$/.test(x) || anstoessig(x))) { zeige('Bitte bei den Sprachen nur Namen von Sprachen eintragen, mit Komma getrennt.', sprFeld); return; }
    const sprachen = Array.from(new Set(gewaehlt('sprache').concat(weitere)));
    if (sprachen.length > 8) { zeige('Bitte höchstens 8 Sprachen.', sprFeld); return; }
    const neu = { bio, hilftGern: gewaehlt('hilft'), sprachen, zeiten: gewaehlt('zeit') };
    const e = ui.fotoEntwurf;
    ui.busy = true;
    renderSheet();
    try {
      if (istLive()) {
        const uid = db.user.id;
        if (e && (e.entfernen || e.bild)) {
          let pfad = '';
          if (e.bild) {
            const blob = await new Promise((ok) => fotoZeichnen(e.bild, e.drehung, 400).toBlob(ok, 'image/jpeg', 0.85));
            if (!blob) throw new Error('Das Foto ließ sich nicht umwandeln.');
            pfad = `${uid}/${Date.now().toString(36)}.jpg`;
            const hoch = await db.client.storage.from('profilbilder').upload(pfad, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
            if (hoch.error) throw hoch.error;
          }
          const { data: alt, error } = await db.client.rpc('profilbild_setzen', { p_pfad: pfad });
          if (error) throw error;
          if (alt) db.client.storage.from('profilbilder').remove([alt]);
          db.profil.bild = pfad;
          db.bilder.set(uid, pfad);
        }
        const { error } = await db.client.rpc('profil_bearbeiten', { p_bio: neu.bio, p_hilft_gern: neu.hilftGern, p_sprachen: neu.sprachen, p_zeiten: neu.zeiten });
        if (error) throw error;
        Object.assign(db.profil, { bio: neu.bio, hilft_gern: neu.hilftGern, sprachen: neu.sprachen, zeiten: neu.zeiten });
        db.profile.delete(uid);
      } else {
        if (e && e.entfernen) demoSteckbrief.bild = '';
        else if (e && e.bild) demoSteckbrief.bild = fotoZeichnen(e.bild, e.drehung, 240).toDataURL('image/jpeg', 0.82);
        Object.assign(demoSteckbrief, neu);
        demoSteckbriefSpeichern();
      }
      ui.fotoEntwurf = null;
      ui.profilBearbeiten = false;
      meldung('Profil gespeichert');
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderSheet();
    renderKopf();
    if (!ui.profilBearbeiten) $('#sheet').scrollTop = 0;
    const t = $('#sheet-titel');
    if (t) t.focus({ preventScroll: true });
  }
  async function profilMeldenAbsenden() {
    const wahl = document.querySelector('#profil-melden-form input[name="profil-grund"]:checked');
    if (!wahl) {
      const f = $('#profil-melden-fehler');
      f.textContent = 'Bitte wähle einen Grund.';
      f.hidden = false;
      $('#profil-grund-bild').focus();
      return;
    }
    const grund = PROFIL_GRUENDE.find((x) => x[0] === wahl.value);
    const zusatz = $('#profil-melden-text').value.trim().slice(0, 400);
    const text = `[${grund[1]}] ${zusatz}`.trim();
    const pr = ui.profil;
    ui.busy = true;
    renderSheet();
    try {
      if (istLive()) {
        const { error } = await db.client.rpc('profil_melden', { p_person: pr.key, p_grund: grund[2], p_text: text });
        if (error) throw error;
      }
      db.rezGemeldet.add('profil|' + pr.key);
      ui.profilMelden = false;
      meldung('Danke für deine Meldung. Wir prüfen das Profil.');
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderSheet();
  }

  // Die andere Person einer Anfrage: live über die Profil-ID, in der Demo über den Namen
  function anderePerson(g) {
    if (!g) return null;
    const name = g.eigen ? g.helferName : g.wer;
    const id = istLive() ? (g.eigen ? g.helferId : g.erstellerId) : name;
    return id && name ? { id, name } : null;
  }
  function blockierenHTML(person) {
    if (!person) return '';
    const vn = esc(vorname(person.name));
    if (!ui.blockieren) return `<button type="button" class="link-btn link-melden" data-blockieren-frage>${icon('x', 'i-sm')}${vn} blockieren</button>`;
    return `<div class="bestaetigen-box"><p><strong>${vn} blockieren?</strong> Ihr seht eure Anfragen gegenseitig nicht mehr, und laufende Zusagen zwischen euch enden. ${vn} erfährt davon nichts. Unter „${istLive() ? 'Konto' : 'Menü'}“ kannst du das jederzeit aufheben.</p>
        <div class="btn-row"><button type="button" class="btn btn-danger-solid" data-blockieren ${ui.busy ? 'disabled aria-busy="true"' : ''}>Blockieren</button>
        <button type="button" class="btn btn-secondary" data-blockieren-nein>Abbrechen</button></div></div>`;
  }
  function sheetRechtHTML(name) {
    const r = RECHT[name];
    return `<div class="sheet-top">
        <span class="eyebrow">Rechtliches</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <h2 id="sheet-titel">${r.titel}</h2>
      <div class="recht">${r.html}</div>
      <nav class="recht-nav" aria-label="Weitere Rechtstexte">${Object.keys(RECHT).filter((k) => k !== name).map((k) => `<a href="#${k}">${RECHT[k].titel}</a>`).join('')}</nav>`;
  }

  // Einladen: QR-Code zum Scannen, Link zum Verschicken, Aushang fürs Schwarze Brett
  function sheetOrtHTML() {
    const ort = meinOrt();
    const live = istLive() && db.profil;
    return `<div class="sheet-top">
        <span class="eyebrow">Dein Ort</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <h2 id="sheet-titel">Wo wohnst du?</h2>
      <p class="klein">Dann zeigt die App zuerst, was in deiner Nähe los ist. ${live ? 'Andere sehen nur den Namen des Orts.' : 'Der Ort bleibt auf diesem Gerät.'} Deine Adresse brauchen wir dafür nicht.</p>
      <div class="feld"><label for="ort-wahl">Ort, Stadtteil oder Postleitzahl</label>${ortFeldHTML('ort-wahl', zeigeIch() ? { name: ort.stadtteil, lat: ort.lat, lng: ort.lng } : null, 'z. B. Berenbostel, 30827 oder Linden')}</div>
      <p class="fehler" id="ort-fehler" hidden>Bitte wähle einen Ort aus der Liste.</p>
      <button type="button" class="btn btn-primary" data-ort-speichern>Ort übernehmen</button>`;
  }
  function sheetEinladenHTML() {
    const aushang = (NATIV ? OEFFENTLICH : '') + 'assets/aushang.pdf';
    return `<div class="sheet-top">
        <span class="eyebrow">Weitersagen</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <h2 id="sheet-titel">Nachbarn einladen</h2>
      <p class="klein">Je mehr Nachbarn mitmachen, desto schneller findet sich Hilfe.</p>
      <div class="qr-karte">
        <div class="qr" role="img" aria-label="QR-Code, der zu Hand Drauf führt">${QR_SVG}</div>
        <p><strong>Scannen und mitmachen</strong>Einfach die Handy-Kamera darauf halten.</p>
      </div>
      <button type="button" class="btn btn-primary" data-teilen-app>${icon('teilen')}Link verschicken</button>
      ${VORSCHAU ? '' : `<a class="btn btn-secondary" href="${aushang}" target="_blank" rel="noopener">${icon('drucken')}Aushang zum Ausdrucken</a>
      <p class="klein">Der Aushang hat Zettel zum Abreißen. Er passt ans Schwarze Brett im Supermarkt, in den Hausflur oder ins Vereinsheim. Frag vorher, ob du ihn aufhängen darfst.</p>`}`;
  }

  // Kontakt (App Store 1.2: veröffentlichte Kontaktmöglichkeit). Ohne E-Mail im CONFIG verweist er aufs Impressum.
  const kontaktLink = () => CONFIG.betreiber.email
    ? `<a href="mailto:${esc(CONFIG.betreiber.email)}?subject=${encodeURIComponent('Hand Drauf')}">Kontakt</a>`
    : '<a href="#impressum">Kontakt</a>';
  function sheetFragenHTML() {
    return `<div class="sheet-top">
        <span class="eyebrow">Hilfe</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <h2 id="sheet-titel">${FRAGEN.titel}</h2>
      ${FRAGEN.gruppen.map(([titel, fragen]) => `<section class="fragen-gruppe"><h3 class="h-klein">${titel}</h3>${fragen.join('')}</section>`).join('')}
      <p class="klein">Deine Frage ist nicht dabei? ${CONFIG.betreiber.email ? `Schreib uns: ${kontaktLink()}.` : 'Die Kontaktdaten stehen im <a href="#impressum">Impressum</a>.'}</p>`;
  }

  // Menü: Ansicht, Hilfe und Rechtliches an einem Ort (statt Links unter jeder Seite)
  function sheetAnsichtHTML() {
    const gruppe = (k, titel) => `<div class="menue-zeile"><span class="menue-label">${titel}</span>
        <div class="segment" role="group" aria-label="${titel}">${ANSICHT_OPTIONEN[k].map(([w, n]) =>
          `<button type="button" data-ansicht="${k}" data-wert="${w}" aria-pressed="${ansicht[k] === w}">${n}</button>`).join('')}</div></div>`;
    const eintrag = (href, text, extra = '') => `<a class="menue-link" href="${href}" ${extra}>${text}<span aria-hidden="true">›</span></a>`;
    const knopf = (attr, text) => `<button type="button" class="menue-link" ${attr}>${text}<span aria-hidden="true">›</span></button>`;
    const ohneKonto = !(istLive() && db.profil);
    return `<div class="sheet-top">
        <h2 id="sheet-titel" class="menue-titel">Menü</h2>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>
      <section class="menue-gruppe" aria-labelledby="m-ansicht"><h3 class="h-klein" id="m-ansicht">Ansicht</h3>
        ${gruppe('thema', 'Design')}
        ${gruppe('schrift', 'Schrift')}
        ${gruppe('start', 'Start mit')}
        ${VORSCHAU ? '' : gruppe('kartenart', 'Karte') + (CONFIG.karte.esri ? '' : '<p class="klein menue-hinweis">Luftbilder gibt es bisher in Niedersachsen. Anderswo zeigt die Karte Straßen.</p>')}
        ${ohneKonto ? `<div class="menue-zeile"><span class="menue-label">Ort</span><button type="button" class="btn btn-secondary btn-auto" data-ort-aendern>${zeigeIch() ? esc(meinOrt().stadtteil) : 'Ort wählen'}</button></div>` : ''}
      </section>
      <section class="menue-gruppe" aria-labelledby="m-push"><h3 class="h-klein" id="m-push">Benachrichtigungen</h3>
        ${pushMenueHTML()}
      </section>
      ${istLive() ? '' : blockListeHTML()}
      <section class="menue-gruppe" aria-labelledby="m-hilfe"><h3 class="h-klein" id="m-hilfe">Hilfe</h3>
        <div class="menue-liste">
          ${eintrag('#fragen', 'Häufige Fragen')}
          ${knopf('data-start-zeigen', 'So funktioniert Hand Drauf')}
          ${knopf('data-einladen', 'Nachbarn einladen')}
          ${!istLive() || db.profil ? knopf('data-mein-profil', 'Dein Profil und deine Bewertungen') : ''}
          ${installEreignis ? knopf('data-installieren', 'Auf den Startbildschirm') : ''}
          ${CONFIG.betreiber.email ? eintrag(`mailto:${esc(CONFIG.betreiber.email)}`, 'Kontakt') : ''}
        </div>
      </section>
      <section class="menue-gruppe" aria-labelledby="m-recht"><h3 class="h-klein" id="m-recht">Rechtliches</h3>
        <div class="menue-liste">
          ${eintrag('#impressum', 'Impressum')}
          ${eintrag('#datenschutz', 'Datenschutz')}
          ${eintrag('#nutzung', 'Nutzungsbedingungen')}
          ${eintrag('#regeln', 'Regeln für Nachbarn')}
        </div>
      </section>`;
  }

  // Beim Neuzeichnen bleiben Eingaben, Auswahl und Fokus erhalten (z. B. wenn eine Nachricht eintrifft)
  let sheetSchluessel = null;
  function sheetZustand() {
    const r = $('#sheet-inhalt');
    const felder = {};
    r.querySelectorAll('textarea[id], input[id]:not([type="radio"]):not([type="checkbox"]):not([type="password"])').forEach((e) => { felder[e.id] = e.value; });
    const gewaehlt = [...r.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked')].map((e) => e.id).filter(Boolean);
    const a = document.activeElement;
    return { felder, gewaehlt, fokus: a && r.contains(a) && a.id ? a.id : null };
  }
  function zustandSetzen(z) {
    Object.entries(z.felder).forEach(([id, v]) => { const e = document.getElementById(id); if (e && 'value' in e) e.value = v; });
    z.gewaehlt.forEach((id) => { const e = document.getElementById(id); if (e) e.checked = true; });
    if (z.fokus) { const e = document.getElementById(z.fokus); if (e && !e.disabled) e.focus({ preventScroll: true }); }
  }
  function aktualisiereChat() {
    const g = gesuche.find((x) => x.id === ui.offen);
    const liste = $('#chat-liste');
    if (!g || !liste) return;
    const unten = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 60;
    liste.innerHTML = chatListeHTML(g);
    const warnung = $('#chat-warnung');
    if (warnung) warnung.innerHTML = chatWarnungHTML(g);
    if (unten) liste.scrollTop = liste.scrollHeight;
    alsGelesen(g);
  }

  function renderSheet() {
    const schluessel = ui.panel || ui.offen;
    const zustand = schluessel && schluessel === sheetSchluessel ? sheetZustand() : null;
    let html = '';
    if (RECHT[ui.panel]) html = sheetRechtHTML(ui.panel);
    else if (ui.panel === 'fragen') html = sheetFragenHTML();
    else if (ui.panel === 'profil') html = sheetProfilHTML();
    else if (ui.panel === 'ansicht') html = sheetAnsichtHTML();
    else if (ui.panel === 'einladen') html = sheetEinladenHTML();
    else if (ui.panel === 'ort') html = sheetOrtHTML();
    else if (ui.panel === 'anmelden') html = sheetAnmeldenHTML();
    else if (ui.panel === 'konto') html = sheetKontoHTML();
    else {
      const g = gesuche.find((x) => x.id === ui.offen);
      if (!g) { schliessen(); return; }
      html = sheetGesuchHTML(g);
    }
    $('#sheet-inhalt').innerHTML = html;
    sheetSchluessel = schluessel;
    if (zustand) zustandSetzen(zustand);
    const liste = $('#chat-liste');
    if (liste) {
      liste.scrollTop = liste.scrollHeight;
      const g = gesuche.find((x) => x.id === ui.offen);
      if (g) alsGelesen(g);
    }
  }

  // Demo: Die Beispiel-Anfragen liegen in Garbsen. Wer einen Ort weiter weg wählt, sieht sie um diesen Ort herum.
  function demoAnOrt() {
    if (istLive()) return;
    const ort = meinOrt(), heimat = CONFIG.ich;
    const weit = abstand(ort, heimat) > 30000;
    gesuche.forEach((g) => {
      const b = BEISPIELE.find((x) => x.id === g.id);
      if (!b) return;
      g.lat = weit ? b.lat + (ort.lat - heimat.lat) : b.lat;
      g.lng = weit ? b.lng + (ort.lng - heimat.lng) : b.lng;
      g.stadtteil = weit ? ort.stadtteil : b.stadtteil;
    });
  }
  function renderAlles() {
    demoAnOrt();
    renderKopf();
    renderGeholfen();
    renderInstallieren();
    renderChips();
    renderListe();
    renderKarte();
    renderAuftraege();
    if (ui.offen) renderSheet();
  }

  /* ===== Navigation ===== */
  function zeige(view) {
    if (view !== 'neu' && ui.bearbeiten) bearbeitenBeenden();
    ui.view = view;
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== view; });
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === view) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (view !== 'karte') ui.markiert = null;
    if (view === 'karte' && initKarte()) {
      kartenGroesse(false);
      if (ui.kartenZiel && kartenStatus.w) {
        // Von der kleinen Karte auf der Startseite: dieselbe Stelle, gleich nah
        kartenStatus.bewegt = true;
        kartenStatus.blick = blickBegrenzen(blickAuf(ui.kartenZiel.m, ui.kartenZiel.s));
        zeichneBlick();
      }
      ui.kartenZiel = null;
      if (ui.zentrieren) { zentriereAuf(ui.zentrieren); ui.zentrieren = null; }
      renderKarte();
    }
    if (view === 'auftraege') renderAuftraege();
    if (view === 'entdecken') umgebungZeichnen(); // ältere Geräte ohne ResizeObserver
    window.scrollTo(0, 0);
  }
  function gehe(view) {
    if (location.hash === '#' + view) zeige(view); else location.hash = view;
  }
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (VIEWS.includes(v)) { if (istSeite(ui.panel)) schliessen(); zeige(v); }
    else if (istSeite(v)) oeffnePanel(v);
    else if (linkId(v)) gesuchAusLink(linkId(v));
  });

  function sheetZeigen() {
    $('#backdrop').hidden = false;
    $('#sheet').hidden = false;
    $('#sheet').scrollTop = 0;
    document.body.classList.add('sheet-offen');
    const c = $('#sheet [data-close]');
    if (c) c.focus({ preventScroll: true });
  }
  function oeffnen(id, ausloeser) {
    vorlesenStopp();
    ui.offen = id;
    ui.panel = null;
    ui.rueckzug = false;
    ui.melden = false;
    ui.zuletzt = ausloeser || null;
    renderSheet();
    sheetZeigen();
    renderKarte();
  }
  function oeffnePanel(name, grund) {
    vorlesenStopp();
    if (name === 'konto' && !db.profil) name = 'anmelden';
    ui.zuletzt = document.activeElement;
    ui.offen = null;
    ui.panel = name;
    ui.authModus = 'anmelden';
    ui.loeschen = false;
    ui.authGrund = grund || '';
    ui.authFertig = '';
    ui.authCode = '';
    ui.authWeg = CONFIG.codeLogin ? 'code' : 'passwort';
    ui.blockieren = false;
    renderSheet();
    sheetZeigen();
    renderKarte();
  }
  function schliessen() {
    vorlesenStopp();
    const id = ui.offen;
    ui.offen = null;
    ui.panel = null;
    sheetSchluessel = null;
    if (istSeite(location.hash.slice(1)) || linkId(location.hash.slice(1))) history.replaceState(null, '', '#' + ui.view);
    $('#backdrop').hidden = true;
    $('#sheet').hidden = true;
    document.body.classList.remove('sheet-offen');
    renderKarte();
    let ziel = (ui.zuletzt && ui.zuletzt.isConnected) ? ui.zuletzt : (id ? $(`#view-${ui.view} .card[data-id="${id}"]`) : null);
    if (!ziel && id && ui.view === 'karte' && kartenStatus.marker.has(id)) ziel = kartenStatus.marker.get(id);
    // Steckt die Anfrage nach dem Schließen in einem Sammel-Schild, bekommt dieses den Fokus
    if (!ziel && id && ui.view === 'karte') {
      const i = kartenStatus.gruppen.findIndex((gr) => gr.liste.some((g) => g.id === id));
      if (i >= 0) ziel = document.querySelector(`#map [data-sammel="${i}"]`);
    }
    if (ziel && ziel.focus) ziel.focus({ preventScroll: true });
  }

  /* ===== Handschlag, wenn ein Job bestätigt ist (Logo als Animation) ===== */
  let feierTimer;
  function feiern(titel, text) {
    const el = $('#feier');
    clearTimeout(feierTimer);
    el.classList.remove('spielt', 'geht');
    el.hidden = false;
    void el.offsetWidth; // Animation neu starten
    el.classList.add('spielt');
    $('#toast').classList.remove('zeigen');
    $('#feier-titel').textContent = titel;
    $('#feier-text').textContent = text;
    try {
      if (navigator.vibrate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(() => navigator.vibrate([16, 40, 26]), 540);
    } catch (e) { /* ohne Vibration */ }
    $('#feier-weiter').focus({ preventScroll: true });
    feierTimer = setTimeout(feierEnde, 4200);
  }
  function feierEnde() {
    const el = $('#feier');
    clearTimeout(feierTimer);
    if (el.hidden || el.classList.contains('geht')) return;
    el.classList.add('geht');
    setTimeout(() => {
      el.hidden = true;
      el.classList.remove('spielt', 'geht');
      const f = !$('#sheet').hidden && ($('#sheet [data-stern="1"]') || $('#sheet .btn'));
      if (f) f.focus({ preventScroll: true });
    }, 200);
  }
  $('#feier').addEventListener('click', feierEnde);
  const feierText = (g) => {
    const hn = vorname(g.helferName) || 'die helfende Person';
    if (g.eigen) return CONFIG.gebuehren ? `${euro(auszahlung(g))} an ${hn} ausgezahlt.` : `Danke, dass ihr euch geholfen habt. Gib ${hn} noch Sterne.`;
    return CONFIG.gebuehren ? `${euro(auszahlung(g))} ausgezahlt. Danke fürs Helfen!` : `${vorname(g.wer)} hat bestätigt. Die ${euroKurz(g.betrag)} bekommst du direkt.`;
  };


  const ERFOLG = {
    zusagen: (g) => `Zugesagt. ${vorname(g.wer)} sieht jetzt deinen Namen.`,
    absagen: () => 'Zusage zurückgezogen. Die Anfrage ist wieder offen.',
    erledigt: (g) => `Gemeldet. ${vorname(g.wer)} muss noch bestätigen.`,
    bestaetigen: (g) => CONFIG.gebuehren ? `${euro(auszahlung(g))} ausgezahlt` : 'Bestätigt. Danke, dass ihr euch geholfen habt!',
    rueckzug: () => 'Anfrage zurückgezogen'
  };

  $('#sheet').addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-close')) { schliessen(); return; }
    if (t.dataset.authModus) {
      ui.authModus = t.dataset.authModus;
      renderSheet();
      const erstes = $('#auth-form input');
      if (erstes) erstes.focus();
      return;
    }
    if (t.hasAttribute('data-profil-zurueck')) { profilZurueck(); return; }
    // Eigenes Profil bearbeiten
    if (t.hasAttribute('data-profil-bearbeiten') || t.hasAttribute('data-profil-abbrechen')) {
      ui.profilBearbeiten = t.hasAttribute('data-profil-bearbeiten');
      ui.fotoEntwurf = null;
      renderSheet();
      $('#sheet').scrollTop = 0;
      const f = ui.profilBearbeiten ? $('#sheet-titel') : $('#sheet [data-profil-bearbeiten]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.wahl) { t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true')); return; }
    if (t.hasAttribute('data-foto-drehen') && ui.fotoEntwurf && ui.fotoEntwurf.bild) {
      const e2 = ui.fotoEntwurf;
      e2.drehung = (e2.drehung + 90) % 360;
      e2.url = fotoZeichnen(e2.bild, e2.drehung, 240).toDataURL('image/jpeg', 0.85);
      renderSheet();
      const f = $('#sheet [data-foto-drehen]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-foto-weg')) {
      ui.fotoEntwurf = { entfernen: true };
      renderSheet();
      const f = $('#foto-datei');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-profil-melden') || t.hasAttribute('data-profil-melden-nein')) {
      if (t.hasAttribute('data-profil-melden') && istLive() && !db.profil) { oeffnePanel('anmelden', 'Bitte melde dich an, um ein Profil zu melden.'); return; }
      ui.profilMelden = t.hasAttribute('data-profil-melden');
      renderSheet();
      const f = ui.profilMelden ? $('#profil-grund-bild') : $('#sheet [data-profil-melden]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-mein-profil')) {
      const vorher = ui.offen ? { art: 'gesuch', id: ui.offen } : ui.panel === 'profil' && ui.profil ? { art: 'profil', key: ui.profil.key, name: ui.profil.name }
        : ui.panel ? { art: 'panel', name: ui.panel } : null;
      profilOeffnen('ich', istLive() ? anzeigename(db.profil) : DEMO_ICH.name, vorher);
      return;
    }
    if (t.hasAttribute('data-profil')) {
      // Die andere Person der offenen Anfrage
      const g = gesuche.find((x) => x.id === ui.offen);
      const person = anderePerson(g);
      if (person) profilOeffnen(person.id, person.name, { art: 'gesuch', id: g.id });
      return;
    }
    if (t.dataset.profilKey) {
      const vorher = ui.panel === 'profil' && ui.profil ? { art: 'profil', key: ui.profil.key, name: ui.profil.name }
        : ui.offen ? { art: 'gesuch', id: ui.offen } : ui.panel ? { art: 'panel', name: ui.panel } : null;
      profilOeffnen(t.dataset.profilKey, t.dataset.profilName || '', vorher);
      return;
    }
    if (t.hasAttribute('data-profil-alle')) {
      ui.profilAlle = true;
      const vorher = (ui.profilListe || []).length;
      renderSheet();
      const naechste = document.querySelectorAll('#sheet .rezension')[vorher];
      if (naechste) { naechste.setAttribute('tabindex', '-1'); naechste.focus({ preventScroll: false }); }
      return;
    }
    if (t.dataset.rezMelden !== undefined || t.hasAttribute('data-rez-melden-nein')) {
      if (t.dataset.rezMelden !== undefined && istLive() && !db.profil) { oeffnePanel('anmelden', 'Bitte melde dich an, um eine Bewertung zu melden.'); return; }
      const i = t.dataset.rezMelden !== undefined ? Number(t.dataset.rezMelden) : ui.rezMelden;
      ui.rezMelden = t.dataset.rezMelden !== undefined ? i : null;
      renderSheet();
      const f = ui.rezMelden !== null ? $('#rez-grund-unangemessen') : $(`#sheet [data-rez-melden="${i}"]`);
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-blockieren-frage') || t.hasAttribute('data-blockieren-nein')) {
      if (istLive() && !db.profil) { oeffnePanel('anmelden', 'Bitte melde dich an, um jemanden zu blockieren.'); return; }
      ui.blockieren = t.hasAttribute('data-blockieren-frage');
      renderSheet();
      const f = $(ui.blockieren ? '#sheet [data-blockieren-nein]' : '#sheet [data-blockieren-frage]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-blockieren')) {
      const person = ui.profil && ui.profil.key !== 'ich' ? { id: ui.profil.key, name: ui.profil.name || (profilDaten(ui.profil.key) || {}).name } : null;
      if (!person || !person.name) return;
      ui.busy = true; renderSheet();
      try {
        await blockiere(person.id, person.name);
        ui.blockieren = false;
        ui.busy = false;
        ui.zuletzt = null;
        schliessen();
        renderAlles();
        meldung(`${vorname(person.name)} ist blockiert. Ihr seht eure Anfragen gegenseitig nicht mehr.`);
      } catch (err) {
        ui.busy = false;
        renderSheet();
        meldung(fehlerText(err));
      }
      return;
    }
    if (t.dataset.entsperren) {
      const id = t.dataset.entsperren;
      try { await entsperre(id); meldung('Blockierung aufgehoben.'); } catch (err) { meldung(fehlerText(err)); }
      renderAlles();
      renderSheet();
      return;
    }
    if (t.hasAttribute('data-loeschen-frage') || t.hasAttribute('data-loeschen-nein')) {
      ui.loeschen = t.hasAttribute('data-loeschen-frage');
      renderSheet();
      const f = $(ui.loeschen ? '#sheet [data-loeschen-nein]' : '#sheet [data-loeschen-frage]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-konto-loeschen')) {
      ui.busy = true; renderSheet();
      try {
        // Profilbilder zuerst löschen (die Datenbank selbst kann Dateien im Speicher nicht löschen)
        if (db.teil9 && db.user) {
          const liste = await db.client.storage.from('profilbilder').list(db.user.id);
          const namen = (liste.data || []).map((f) => `${db.user.id}/${f.name}`);
          if (namen.length) await db.client.storage.from('profilbilder').remove(namen);
        }
        const { error } = await db.client.rpc('konto_loeschen');
        if (error) throw error;
        await pushTrennen(true);
        await db.client.auth.signOut();
        ui.loeschen = false;
        schliessen();
        meldung('Dein Konto und deine Daten sind gelöscht.');
      } catch (err) {
        meldung(fehlerText(err));
      } finally {
        ui.busy = false;
        if (ui.panel) renderSheet();
      }
      return;
    }
    if (t.hasAttribute('data-abmelden')) {
      ui.busy = true; renderSheet();
      await pushTrennen(false); // dieses Gerät bekommt keine Benachrichtigungen mehr für das Konto
      await db.client.auth.signOut();
      ui.busy = false;
      schliessen();
      meldung('Du bist abgemeldet.');
      return;
    }
    if (t.hasAttribute('data-passwort-zeigen')) {
      // Ohne Neuzeichnen, damit das getippte Passwort stehen bleibt
      const feld = $('#auth-passwort');
      const zeigen = feld.type === 'password';
      feld.type = zeigen ? 'text' : 'password';
      t.setAttribute('aria-pressed', String(zeigen));
      t.setAttribute('aria-label', zeigen ? 'Passwort verbergen' : 'Passwort anzeigen');
      return;
    }
    if (t.dataset.authWeg || t.hasAttribute('data-code-zurueck')) {
      if (t.dataset.authWeg) ui.authWeg = t.dataset.authWeg;
      ui.authCode = '';
      renderSheet();
      const f = $('#auth-email');
      if (f) f.focus();
      return;
    }
    if (t.hasAttribute('data-push-spaeter')) { push.spaeter = Date.now(); pushSpeichern(); renderSheet(); return; }
    if (t.dataset.pushKat) {
      if (push.busy) return;
      const k = t.dataset.pushKat;
      const vorher = push.kategorien.slice();
      push.kategorien = vorher.includes(k) ? vorher.filter((x) => x !== k) : KATEGORIEN.map((x) => x.id).filter((x) => x === k || vorher.includes(x));
      push.busy = true;
      try { await pushMelden(await pushAbo(true)); pushSpeichern(); }
      catch (err) { push.kategorien = vorher; meldung(fehlerText(err)); }
      push.busy = false;
      renderSheet();
      const f = $(`#sheet [data-push-kat="${k}"]`);
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.hasAttribute('data-push-schalter') || t.hasAttribute('data-push-ein') || t.hasAttribute('data-push-neue') || t.hasAttribute('data-push-test')) {
      if (push.busy) return;
      const merke = t.hasAttribute('data-push-neue') ? '[data-push-neue]' : t.hasAttribute('data-push-test') ? '[data-push-test]' : '[data-push-schalter]';
      push.busy = true;
      try {
        if (t.hasAttribute('data-push-neue')) {
          push.neue = !push.neue;
          try { await pushMelden(await pushAbo(true)); pushSpeichern(); meldung(push.neue ? 'Du erfährst jetzt von neuen Anfragen in deiner Nähe.' : 'Keine Hinweise mehr auf neue Anfragen.'); }
          catch (err) { push.neue = !push.neue; throw err; }
        } else if (t.hasAttribute('data-push-test')) {
          await pushMelden(await pushAbo(true));
          const { error } = await db.client.rpc('push_test');
          if (error) throw error;
          meldung('Unterwegs. Die Benachrichtigung sollte gleich erscheinen.');
        } else if (t.hasAttribute('data-push-ein') || !pushAn()) {
          // Die Frage des Browsers muss direkt auf den Tipp folgen, deshalb vorher nichts abwarten
          if (await pushEin()) meldung('Eingeschaltet. Dein Handy meldet sich, wenn sich etwas tut.');
        } else {
          await pushTrennen(true);
          meldung('Benachrichtigungen sind ausgeschaltet.');
        }
      } catch (err) {
        meldung(fehlerText(err));
      }
      push.busy = false;
      if (ui.offen || ui.panel) renderSheet();
      const f = $('#sheet ' + merke);
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.schnellantwort) {
      const f = $('#chat-text');
      if (f) { f.value = t.dataset.schnellantwort; f.dispatchEvent(new Event('input', { bubbles: true })); f.focus(); }
      return;
    }
    const g = gesuche.find((x) => x.id === ui.offen);
    if (!g) return;
    const a = t.dataset.aktion;

    if (a === 'bescheid') { bescheidSagen(g); return; }
    if (a === 'vorlesen') {
      vorlesen(g);
      renderSheet();
      const f = $('#sheet [data-aktion="vorlesen"]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (a === 'nochmal') { bearbeitenStarten(g, 2, true); return; }
    if (a === 'karte') {
      ui.zuletzt = null;
      schliessen();
      ui.markiert = g.id;
      ui.zentrieren = g.id;
      gehe('karte');
      return;
    }
    if (a === 'rueckzug-frage' || a === 'rueckzug-nein') {
      ui.rueckzug = a === 'rueckzug-frage';
      renderSheet();
      const f = $('#sheet [data-aktion="rueckzug-nein"], #sheet [data-aktion="rueckzug-frage"]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (a === 'teilen') { gesuchTeilen(g); return; }
    if (a === 'kalender') { kalenderLaden(g); return; }
    if (a === 'bearbeiten' || a === 'bearbeiten-termin') { bearbeitenStarten(g, a === 'bearbeiten-termin' ? 2 : 1); return; }
    if (a === 'melden-frage' || a === 'melden-nein') {
      if (a === 'melden-frage' && istLive() && !db.profil) { oeffnePanel('anmelden', 'Bitte melde dich an, um etwas zu melden.'); return; }
      ui.melden = a === 'melden-frage';
      renderSheet();
      const f = ui.melden ? $('#melden-betrug') : $('#sheet [data-aktion="melden-frage"]');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    // Bewerten: Sterne wählen (noch nicht speichern), Text schreiben, dann abschicken
    if (t.dataset.stern || a === 'bewertung-aendern') {
      const feld = $('#bewertung-text');
      ui.bewertung = t.dataset.stern
        ? { id: g.id, sterne: Number(t.dataset.stern), text: feld ? feld.value : (ui.bewertung && ui.bewertung.id === g.id ? ui.bewertung.text : g.meinText || '') }
        : { id: g.id, sterne: g.meineBewertung, text: g.meinText || '' };
      renderSheet();
      const f = t.dataset.stern ? $('#stern-' + t.dataset.stern) : $('#bewertung-text');
      if (f) f.focus({ preventScroll: true });
      return;
    }
    if (!a) return;
    if (istLive() && !db.profil) {
      oeffnePanel('anmelden', a === 'zusagen' ? 'Melde dich an, um zu helfen. Danach kannst du direkt zusagen.' : 'Bitte melde dich an.');
      return;
    }

    ui.busy = true;
    renderSheet();
    try {
      await aendereStatus(g, a);
      if (a === 'bestaetigen') {
        ladeStatistik();
        feiern('Hand drauf!', feierText(gesuche.find((x) => x.id === g.id) || g));
      } else meldung(ERFOLG[a](g));
      if (a === 'rueckzug') { ui.busy = false; schliessen(); renderAlles(); return; }
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderAlles();
    if (ui.offen) renderSheet();
    const f = $('#sheet .btn');
    if (f) f.focus({ preventScroll: true });
  });

  // Anmelden und Registrieren
  async function chatAbsenden() {
    const g = gesuche.find((x) => x.id === ui.offen);
    const feld = $('#chat-text');
    if (!g || !feld) return;
    const text = feld.value.trim();
    if (!text) { feld.focus(); return; }
    if (istLive() && !db.profil) { oeffnePanel('anmelden', 'Bitte melde dich an.'); return; }
    if (anstoessig(text)) { meldung('Bitte schreib freundlich. Beleidigende oder anstößige Wörter werden nicht verschickt.'); feld.focus(); return; }
    $('#chat-form button[type="submit"]').disabled = true;
    try {
      await sendeNachricht(g, text);
      const f = $('#chat-text');
      if (f) f.value = '';
      aktualisiereChat();
      const l = $('#chat-liste');
      if (l) l.scrollTop = l.scrollHeight;
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      const k = $('#chat-form button[type="submit"]');
      if (k) k.disabled = false;
      const f = $('#chat-text');
      if (f) f.focus({ preventScroll: true });
    }
  }
  async function meldungAbsenden() {
    const g = gesuche.find((x) => x.id === ui.offen);
    if (!g) return;
    const wahl = $('#melden-form input[name="grund"]:checked');
    if (!wahl) {
      const f = $('#melden-fehler');
      f.textContent = 'Bitte wähle einen Grund.';
      f.hidden = false;
      $('#melden-betrug').focus();
      return;
    }
    const text = $('#melden-text').value.trim().slice(0, 500);
    ui.busy = true;
    renderSheet();
    try {
      await melde(g, wahl.value, text);
      ui.melden = false;
      const person = anderePerson(g);
      if (person && $('#melden-blockieren') && $('#melden-blockieren').checked) {
        await blockiere(person.id, person.name);
        ui.busy = false;
        schliessen();
        renderAlles();
        meldung(`Danke für deine Meldung. ${vorname(person.name)} ist blockiert.`);
        return;
      }
      meldung('Danke für deine Meldung. Wir prüfen sie.');
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderSheet();
    const f = $('#sheet .gemeldet, #sheet [data-aktion="melden-frage"], #melden-betrug');
    if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'P') f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  }

  // Enter sendet am Computer, Umschalt+Enter macht eine neue Zeile. Auf dem Handy: Senden-Knopf.
  $('#sheet').addEventListener('keydown', (e) => {
    if (e.target.id !== 'chat-text' || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    chatAbsenden();
  });
  // Eingabefeld wächst mit dem Text (bis 5 Zeilen)
  $('#sheet').addEventListener('input', (e) => {
    if (e.target.id === 'profil-bio') { const z = $('#bio-zahl'); if (z) z.textContent = e.target.value.length; return; }
    if (e.target.id !== 'chat-text') return;
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  });

  $('#sheet').addEventListener('submit', async (e) => {
    if (e.target.id === 'chat-form') { e.preventDefault(); chatAbsenden(); return; }
    if (e.target.id === 'melden-form') { e.preventDefault(); meldungAbsenden(); return; }
    if (e.target.id === 'bewerten-form') { e.preventDefault(); bewertungAbsenden(); return; }
    if (e.target.id === 'rez-melden-form') { e.preventDefault(); rezMeldenAbsenden(e.target); return; }
    if (e.target.id === 'profil-form') { e.preventDefault(); profilSpeichern(); return; }
    if (e.target.id === 'profil-melden-form') { e.preventDefault(); profilMeldenAbsenden(); return; }
    if (e.target.id === 'code-form') { e.preventDefault(); codeAbsenden(e.target); return; }
    if (e.target.id !== 'auth-form') return;
    e.preventDefault();
    const reg = ui.authModus === 'registrieren';
    const codeWeg = !reg && CONFIG.codeLogin && ui.authWeg === 'code';
    const fehler = $('#auth-fehler');
    const zeigeFehler = (text, feld) => { fehler.textContent = text; fehler.hidden = false; if (feld) feld.focus(); };
    const email = $('#auth-email').value.trim();
    const passwort = codeWeg ? '' : $('#auth-passwort').value;
    if (reg && !$('#auth-vorname').value.trim()) return zeigeFehler('Bitte gib deinen Vornamen ein.', $('#auth-vorname'));
    if (!/^\S+@\S+\.\S+$/.test(email)) return zeigeFehler('Bitte gib eine gültige E-Mail-Adresse ein.', $('#auth-email'));
    if (!codeWeg && passwort.length < (reg ? 8 : 1)) return zeigeFehler(reg ? 'Das Passwort braucht mindestens 8 Zeichen.' : 'Bitte gib dein Passwort ein.', $('#auth-passwort'));
    if (reg && !$('#auth-18').checked) return zeigeFehler('Hand Drauf ist erst ab 18 Jahren.', $('#auth-18'));
    if (reg && !$('#auth-regeln').checked) return zeigeFehler('Bitte bestätige, dass du die Regeln verstanden hast.', $('#auth-regeln'));

    const knopf = e.target.querySelector('button[type="submit"]');
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    fehler.hidden = true;
    try {
      if (reg) {
        const ort = await ortAufloesen($('#auth-stadtteil'));
        if (!ort) throw new Error('Bitte wähle deinen Ort aus der Liste.');
        const punkt = rasterpunkt(ort);
        ortWaehlen(ort);
        const { data, error } = await db.client.auth.signUp({
          email,
          password: passwort,
          options: {
            emailRedirectTo: NATIV ? OEFFENTLICH : location.origin + location.pathname,
            data: {
              vorname: $('#auth-vorname').value.trim().slice(0, 40),
              nachname_initial: $('#auth-initial').value.trim().slice(0, 1).toUpperCase(),
              stadtteil: ort.name,
              lat: punkt.lat,
              lng: punkt.lng,
              volljaehrig: 'true'
            }
          }
        });
        if (error) throw error;
        if (!data.session) { ui.authFertig = email; renderSheet(); return; }
      } else if (codeWeg) {
        // Nur für bestehende Konten: Wer neu ist, registriert sich mit Namen und Stadtteil
        const { error } = await db.client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (error) throw error;
        ui.authCode = email;
        renderSheet();
        const f = $('#auth-code');
        if (f) f.focus();
      } else {
        const { data, error } = await db.client.auth.signInWithPassword({ email, password: passwort });
        if (error) throw error;
        await setzeSitzung(data.session, true);
        if (!db.profil) throw new Error('Zu deinem Konto fehlt das Profil. Wurde supabase/schema.sql in Supabase ausgeführt?');
      }
    } catch (err) {
      knopf.disabled = false;
      knopf.removeAttribute('aria-busy');
      zeigeFehler(fehlerText(err));
    }
  });

  async function codeAbsenden(formular) {
    const fehler = $('#auth-fehler');
    const feld = $('#auth-code');
    const zeigeFehler = (text) => { fehler.textContent = text; fehler.hidden = false; feld.focus(); };
    const code = feld.value.replace(/\D/g, '');
    if (code.length !== 6) { zeigeFehler('Der Code hat 6 Ziffern.'); return; }
    const knopf = formular.querySelector('button[type="submit"]');
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    fehler.hidden = true;
    try {
      const { data, error } = await db.client.auth.verifyOtp({ email: ui.authCode, token: code, type: 'email' });
      if (error) throw error;
      await setzeSitzung(data.session, true);
      if (!db.profil) throw new Error('Zu deinem Konto fehlt das Profil. Bitte registriere dich neu.');
    } catch (err) {
      knopf.disabled = false;
      knopf.removeAttribute('aria-busy');
      zeigeFehler(fehlerText(err));
    }
  }

  // Stadtteil im Konto ändern
  $('#sheet').addEventListener('change', async (e) => {
    if (e.target.name === 'grund') { const f = $('#melden-fehler'); if (f) f.hidden = true; return; }
    if (e.target.id === 'foto-datei') { fotoGewaehlt(e.target.files && e.target.files[0]); e.target.value = ''; return; }
  });
  // Ort ändern (Menü, Konto, Liste) und übernehmen
  $('#sheet').addEventListener('click', async (e) => {
    if (e.target.closest('[data-ort-aendern]')) { const zurueck = ui.panel; oeffnePanel('ort'); ui.ortZurueck = zurueck; return; }
    const knopf = e.target.closest('[data-ort-speichern]');
    if (!knopf) return;
    knopf.disabled = true;
    try {
      const ort = await ortAufloesen($('#ort-wahl'));
      if (!ort) { $('#ort-fehler').hidden = false; $('#ort-wahl').focus(); return; }
      if (await ortUebernehmen(ort)) {
        // Aus Konto oder Menü gekommen: dorthin zurück
        const zurueck = ui.ortZurueck;
        ui.ortZurueck = null;
        if (zurueck && zurueck !== 'ort') oeffnePanel(zurueck); else schliessen();
        meldung(`Ort: ${ort.name}`);
      }
    } finally { knopf.disabled = false; }
  });
  $('#sheet').addEventListener('ortgewaehlt', (e) => {
    if (e.target.id === 'ort-wahl') { const f = $('#ort-fehler'); if (f) f.hidden = true; }
  });

  $('#backdrop').addEventListener('click', schliessen);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#feier').hidden) { feierEnde(); return; }
    if (ui.offen || ui.panel) schliessen();
  });

  /* ===== Teilen: Nachbarn einladen und einzelne Anfragen weitersagen (Wachstum über Empfehlungen statt Werbung) ===== */
  const appAdresse = () => NATIV ? OEFFENTLICH : location.origin + location.pathname + location.search;
  const gesuchLink = (g) => `${appAdresse()}#anfrage-${encodeURIComponent(g.id)}`;
  async function teilen(text, url) {
    const teilenPlugin = plugin('Share');
    if (teilenPlugin) {
      try { await teilenPlugin.share(url ? { title: 'Hand Drauf', text, url, dialogTitle: 'Teilen' } : { title: 'Hand Drauf', text, dialogTitle: 'Teilen' }); } catch (e) { /* abgebrochen */ }
      return;
    }
    if (navigator.share) {
      // Ohne Link kein url-Feld: Ein leeres würde die Adresse dieser Seite anhängen
      try { await navigator.share(url ? { title: 'Hand Drauf', text, url } : { title: 'Hand Drauf', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); meldung(url ? 'Link kopiert. Füge ihn in eine Nachricht ein.' : 'Text kopiert. Füge ihn in eine Nachricht ein.'); }
    catch (e) { meldung(url ? `Link zum Teilen: ${url}` : 'Teilen geht auf diesem Gerät gerade nicht.'); }
  }
  const einladen = () => teilen('Hand Drauf: Nachbarn helfen sich bei kleinen Dingen, gegen eine kleine Aufwandsentschädigung. Schau mal rein:', NATIV ? OEFFENTLICH : location.origin + location.pathname);
  function gesuchTeilen(g) {
    const was = `„${g.titel}“ in ${g.stadtteil}, ${g.wann}, ${euroKurz(g.betrag)} Aufwandsentschädigung`;
    teilen(g.eigen ? `Ich suche Hilfe: ${was}. Kannst du helfen oder kennst du jemanden?` : `${vorname(g.wer)} sucht Hilfe: ${was}. Kannst du helfen?`, gesuchLink(g));
  }

  // Bescheid sagen (Vorbild: „Fahrt teilen“ bei Uber): einer Vertrauensperson schreiben, wann und wo man hilft
  function bescheidSagen(g) {
    const adresse = adresseVon(g);
    const wo = adresse && adresse !== g.stadtteil ? (adresse.includes(g.stadtteil) ? adresse : `${adresse}, ${g.stadtteil}`) : g.stadtteil;
    teilen(g.eigen
      ? `Zur Info: ${g.helferName || 'Jemand aus der Nachbarschaft'} kommt über Hand Drauf vorbei und hilft bei „${g.titel}“${g.fuer ? ` (für: ${g.fuer})` : ''}. Termin: ${wannLang(g)}.`
      : `Zur Info: Ich helfe über Hand Drauf bei ${g.wer} in ${wo} („${g.titel}“). Termin: ${wannLang(g)}. Ich melde mich, wenn ich fertig bin.`, '');
  }

  /* ===== Vorlesen: für alle, die lieber hören als lesen ===== */
  const vorlesenMoeglich = () => 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  // „Sa. 14. Nov.“ liest die Sprachausgabe sonst als „Sa Punkt“
  function ausgeschrieben(text) {
    let t = String(text || '');
    WOCHENTAGE.forEach((k, i) => { t = t.split(k).join(TAGNAMEN[i]); });
    MONATE.forEach((k, i) => { if (k.endsWith('.')) t = t.split(k).join(MONATE_LANG[i]); });
    return t;
  }
  function vorlesenText(g) {
    const m = meterVonMir(g);
    const weit = m < 1000 ? `${Math.max(100, Math.round(m / 50) * 50)} Meter` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Kilometer`;
    return [
      `${katName(g.kat)}: ${g.titel}.`,
      g.eigen ? 'Das ist deine Anfrage.' : `${vorname(g.wer)} sucht Hilfe${g.fuer ? `, für: ${g.fuer}` : ''}.`,
      `Termin: ${ausgeschrieben(wannLang(g))}.`,
      g.eigen ? `In ${g.stadtteil}.` : `In ${g.stadtteil}, ${weit} von dir.`,
      `${g.betrag} Euro Aufwandsentschädigung.`,
      g.text || ''
    ].filter(Boolean).join(' ');
  }
  function vorlesenStopp() {
    if (!ui.vorlesen) return;
    ui.vorlesen = false;
    try { window.speechSynthesis.cancel(); } catch (e) { /* schon still */ }
  }
  function vorlesen(g) {
    if (!vorlesenMoeglich()) return;
    if (ui.vorlesen) { vorlesenStopp(); return; }
    const u = new window.SpeechSynthesisUtterance(vorlesenText(g));
    u.lang = 'de-DE';
    u.rate = 0.95;
    // Stimme vom Gerät bevorzugen: Die funktioniert auch ohne Internet und schickt den Text nirgends hin
    const stimmen = window.speechSynthesis.getVoices().filter((v) => /^de\b/i.test(v.lang));
    const stimme = stimmen.find((v) => v.localService && /de[-_]DE/i.test(v.lang)) || stimmen.find((v) => v.localService) || stimmen[0];
    if (stimme) u.voice = stimme;
    const ende = () => { if (ui.vorlesen) { ui.vorlesen = false; if (ui.offen === g.id) renderSheet(); } };
    u.onend = ende;
    u.onerror = ende;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      ui.vorlesen = true;
    } catch (e) { meldung('Vorlesen geht auf diesem Gerät gerade nicht.'); }
  }

  // Geteilter Link #anfrage-<id> öffnet die Anfrage direkt
  const GESUCH_LINK = /^(?:anfrage|gesuch)-(.+)$/;
  const linkId = (hash) => { const m = hash.match(GESUCH_LINK); return m ? decodeURIComponent(m[1]) : null; };
  let linkVersuch = null;
  async function gesuchAusLink(id) {
    if (gesuche.some((g) => g.id === id)) { oeffnen(id); return; }
    if (istLive() && !db.geladen) return; // wird nach dem Laden erneut versucht
    // Ganz neue Anfragen (z. B. aus einer Benachrichtigung) kennt die offene App noch nicht: einmal frisch laden
    if (istLive() && linkVersuch !== id && Date.now() - db.geladenUm > 3000) {
      linkVersuch = id;
      await neuLaden();
      if (gesuche.some((g) => g.id === id)) { if (ui.offen !== id) oeffnen(id); return; }
    }
    history.replaceState(null, '', '#' + ui.view);
    meldung('Diese Anfrage ist nicht mehr offen. Schau dir die anderen in deiner Nähe an.');
  }

  /* ===== Termin in den eigenen Kalender (.ics, funktioniert mit iPhone, Android, Outlook) ===== */
  function kalenderDatei(g) {
    const t = terminAusText(g.wann);
    if (!t) return null;
    const zwei = (n) => String(n).padStart(2, '0');
    const tag = (d) => `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}`;
    const um = (d, [h, m]) => `${tag(d)}T${zwei(h)}${zwei(m)}00`;
    const j = new Date();
    const stempel = `${j.getUTCFullYear()}${zwei(j.getUTCMonth() + 1)}${zwei(j.getUTCDate())}T${zwei(j.getUTCHours())}${zwei(j.getUTCMinutes())}${zwei(j.getUTCSeconds())}Z`;
    const txt = (x) => String(x).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const mitUhrzeit = +t.von === +t.bis && t.start;
    const mit = g.eigen ? (g.helferName ? ` mit ${vorname(g.helferName)}` : '') : ` bei ${g.wer}`;
    const beteiligt = g.eigen || g.helfer === 'ich';
    const adresse = beteiligt ? adresseVon(g) : '';
    const stadt = STADTTEILE.some((x) => x.name === g.stadtteil) ? ', Garbsen' : '';
    const ort = adresse ? `${adresse}${adresse.includes(g.stadtteil) ? '' : ', ' + g.stadtteil}${stadt}` : `${g.stadtteil}${stadt}`;
    const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hand Drauf//Nachbarschaftshilfe//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:${g.id}@hand-drauf`, `DTSTAMP:${stempel}`,
      ...(mitUhrzeit ? [`DTSTART:${um(t.von, t.start)}`, `DTEND:${um(t.von, t.ende)}`]
        : [`DTSTART;VALUE=DATE:${tag(t.von)}`, `DTEND;VALUE=DATE:${tag(plusTage(t.bis, 1))}`]),
      `SUMMARY:${txt(`Hand Drauf: ${g.titel}${mit}`)}`,
      `LOCATION:${txt(ort)}`,
      `DESCRIPTION:${txt([`Wann: ${g.wann}`, `Aufwandsentschädigung: ${euroKurz(g.betrag)}`, g.text, `In der App: ${gesuchLink(g)}`].filter(Boolean).join('\n'))}`,
      `URL:${gesuchLink(g)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(g.titel)}`, mitUhrzeit ? 'TRIGGER:-PT1H' : 'TRIGGER:PT8H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    // Zeilen über 75 Bytes werden nach dem Kalender-Standard umgebrochen
    const bytes = (x) => new TextEncoder().encode(x).length;
    const falten = (z) => {
      if (bytes(z) <= 75) return z;
      const teile = [];
      let akt = '';
      for (const ch of z) { if (bytes(akt + ch) > (teile.length ? 74 : 75)) { teile.push(akt); akt = ch; } else akt += ch; }
      teile.push(akt);
      return teile.join('\r\n ');
    };
    return zeilen.map(falten).join('\r\n') + '\r\n';
  }
  async function kalenderLaden(g) {
    const ics = kalenderDatei(g);
    if (!ics) return;
    if (VORSCHAU) { meldung('In dieser Vorschau gehen keine Downloads. In der App und auf der Website klappt es.'); return; }
    const dateiname = `hand-drauf-${g.titel.toLowerCase().replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'termin'}.ics`;
    // iPhone-App: Datei im Zwischenspeicher ablegen und über das Teilen-Menü öffnen („Zum Kalender hinzufügen“)
    const dateien = plugin('Filesystem'), teilenPlugin = plugin('Share');
    if (dateien && teilenPlugin) {
      try {
        const { uri } = await dateien.writeFile({ path: dateiname, data: ics, directory: 'CACHE', encoding: 'utf8' });
        await teilenPlugin.share({ title: g.titel, files: [uri], dialogTitle: 'In den Kalender' });
      } catch (e) { /* abgebrochen */ }
      return;
    }
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
    meldung('Termin geladen. Öffne die Datei, um ihn in deinen Kalender zu übernehmen.');
  }

  /* ===== Als App auf den Startbildschirm (Web-App, ohne App Store) ===== */
  const INSTALL_SPEICHER = 'handdrauf-installieren';
  let installEreignis = null; // Android/Chrome: Systemdialog zum Installieren
  const istInstalliert = () => NATIV || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const istIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installierenMoeglich = () => !VORSCHAU && !istInstalliert() && (!!installEreignis || istIOS());
  function startGesehen() { try { return localStorage.getItem(START_SPEICHER) === START_FASSUNG; } catch (e) { return true; } }
  function renderInstallieren() {
    const el = $('#installieren');
    let weg = false;
    try { weg = localStorage.getItem(INSTALL_SPEICHER) === 'nein'; } catch (e) { weg = false; }
    const zeigen = installierenMoeglich() && !weg && startGesehen();
    el.hidden = !zeigen;
    if (!zeigen) { el.innerHTML = ''; return; }
    el.innerHTML = `<img class="installieren-icon" src="assets/icon-192.png" alt="" width="44" height="44">
      <div><strong>Hand Drauf auf den Startbildschirm</strong>
        <p>${installEreignis ? 'Dann öffnest du es mit einem Tipp, wie eine App. Kostenlos und ohne App Store.'
          : `Tippe in Safari unten auf ${icon('teilen', 'i-xs')} „Teilen“ und dann auf „Zum Home-Bildschirm“. Dann öffnest du es wie eine App.`}</p>
        <div class="btn-row">${installEreignis ? '<button type="button" class="btn btn-primary btn-auto" data-installieren>Hinzufügen</button>' : ''}
          <button type="button" class="btn btn-secondary btn-auto" data-installieren-nein>${installEreignis ? 'Nicht jetzt' : 'Verstanden'}</button></div>
      </div>`;
  }
  async function installieren() {
    if (!installEreignis) { oeffnePanel('fragen'); return; }
    const e = installEreignis;
    installEreignis = null;
    e.prompt();
    try { await e.userChoice; } catch (err) { /* abgebrochen */ }
    renderInstallieren();
    if (ui.panel === 'ansicht') renderSheet();
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEreignis = e;
    renderInstallieren();
    if (ui.panel === 'ansicht') renderSheet();
  });
  window.addEventListener('appinstalled', () => {
    installEreignis = null;
    renderInstallieren();
    meldung('Hand Drauf ist jetzt auf deinem Startbildschirm.');
  });
  // Offline-Hülle: nur auf der echten Seite (https), nicht in der Claude-Vorschau
  if ('serviceWorker' in navigator && !VORSCHAU && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Hülle weiter */ }); });
  }

  /* ===== Neue Fassung und Verbindung =====
     Liegt die App lange offen (z. B. auf dem Startbildschirm), fragt sie beim Zurückkehren nach, ob es eine neue
     Fassung gibt, und bietet „Neu laden“ an. Ohne Internet steht oben ein kurzer Hinweis. */
  const FASSUNG = EINSTELLUNGEN.fassung || '';
  let fassungZuletzt = 0;
  async function fassungPruefen(sofort) {
    if (VORSCHAU || NATIV || !FASSUNG || !window.fetch || document.visibilityState === 'hidden') return;
    if (!sofort && Date.now() - fassungZuletzt < 20 * 60 * 1000) return;
    fassungZuletzt = Date.now();
    try {
      const antwort = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!antwort.ok) return;
      const neu = await antwort.json();
      if (neu && neu.fassung && neu.fassung !== FASSUNG) $('#neue-fassung').hidden = false;
    } catch (e) { /* ohne Netz: beim nächsten Mal */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fassungPruefen(); });
  setInterval(() => fassungPruefen(), 5 * 60 * 1000);
  // Kurz nach dem Start einmal: falls die Seite ohne Netz aus dem Speicher kam
  setTimeout(() => fassungPruefen(true), 8000);
  $('#neue-fassung').addEventListener('click', (e) => {
    if (e.target.closest('[data-neu-laden]')) location.reload();
    else if (e.target.closest('[data-spaeter]')) $('#neue-fassung').hidden = true;
  });
  function verbindungZeigen() {
    const offline = !VORSCHAU && navigator.onLine === false;
    $('#offline').hidden = !offline;
    document.documentElement.classList.toggle('ist-offline', offline);
  }
  // Profilbild lädt nicht (gelöscht, offline): dann bleiben die Anfangsbuchstaben
  document.addEventListener('error', (e) => {
    const t = e.target, el = t && t.parentNode;
    if (t && t.tagName === 'IMG' && el && el.classList && (el.classList.contains('avatar') || el.classList.contains('avatar-btn'))) { el.classList.remove('mit-bild'); el.removeChild(t); }
  }, true);
  window.addEventListener('online', verbindungZeigen);
  window.addEventListener('offline', verbindungZeigen);
  verbindungZeigen();

  /* ===== Benachrichtigungen aufs Handy (Web Push) =====
     Das Gerät meldet sich beim Dienst seines Browsers an und gibt uns eine Adresse dafür. Die Datenbank
     schickt darüber Bescheid, wenn jemand zusagt, schreibt oder ein Auftrag fertig ist. */
  const PUSH_SPEICHER = 'handdrauf-push';
  // kategorien: „Ich helfe gern bei …“, leer = bei allen Tätigkeiten Bescheid geben
  const push = { an: false, neue: false, spaeter: 0, kategorien: [], busy: false };
  try {
    const p = JSON.parse(localStorage.getItem(PUSH_SPEICHER) || '{}') || {};
    push.an = p.an === true; push.neue = p.neue === true; push.spaeter = Number(p.spaeter) || 0;
    if (Array.isArray(p.kategorien)) push.kategorien = p.kategorien.filter((k) => KATEGORIEN.some((x) => x.id === k));
  } catch (e) { /* ohne Speicher: aus */ }
  const pushSpeichern = () => { try { localStorage.setItem(PUSH_SPEICHER, JSON.stringify({ an: push.an, neue: push.neue, spaeter: push.spaeter, kategorien: push.kategorien })); } catch (e) { /* nur für diese Sitzung */ } };
  // Nur auf der echten Seite mit Datenbank: In der Demo gibt es niemanden, der Bescheid geben könnte
  const pushMoeglich = () => !VORSCHAU && !NATIV && istLive() && !!CONFIG.push && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const pushAn = () => pushMoeglich() && push.an && Notification.permission === 'granted' && !!db.profil;
  const pushAnbieten = () => !!db.profil && pushMoeglich() && !pushAn() && Notification.permission !== 'denied' && Date.now() - push.spaeter > 14 * TAG_MS;
  // Warum es hier (noch) nicht geht, in einem Satz
  function pushGrund() {
    if (!istLive()) return 'In der Demo ist das ausgeschaltet. Auf der echten Seite meldet sich dein Handy, wenn jemand zusagt oder dir schreibt.';
    if (NATIV) return 'In der iPhone-App kommen Benachrichtigungen mit einem der nächsten Updates.';
    if (!CONFIG.push) return 'Benachrichtigungen sind noch nicht eingerichtet.';
    if (istIOS() && !istInstalliert()) return 'Auf dem iPhone geht das, sobald Hand Drauf auf dem Home-Bildschirm liegt: in Safari auf „Teilen“ tippen, dann „Zum Home-Bildschirm“.';
    return 'Dieser Browser kann leider keine Benachrichtigungen empfangen.';
  }
  const b64zuBytes = (t) => Uint8Array.from(atob(String(t).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const bytesZuB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function pushAbo(anlegen) {
    // Ohne laufende Offline-Hülle gäbe es hier nie eine Antwort
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, nein) => setTimeout(() => nein(new Error('Benachrichtigungen sind gerade nicht verfügbar. Lade die Seite neu und versuch es noch einmal.')), 8000))]);
    let abo = await reg.pushManager.getSubscription();
    // Anmeldung mit einem älteren Schlüssel (nach einer neuen Einrichtung): ersetzen
    if (abo && anlegen && abo.options && abo.options.applicationServerKey && bytesZuB64(abo.options.applicationServerKey) !== CONFIG.push) {
      await abo.unsubscribe();
      abo = null;
    }
    if (!abo && anlegen) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64zuBytes(CONFIG.push) });
    return abo;
  }
  async function pushMelden(abo) {
    const j = abo.toJSON();
    const felder = { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_neue: !!push.neue };
    let { error } = await db.client.rpc('push_anmelden', { ...felder, p_kategorien: push.kategorien });
    // Datenbank ohne das Update vom 10. November (Teil 5) kennt die Auswahl noch nicht
    if (error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || ''))) ({ error } = await db.client.rpc('push_anmelden', felder));
    if (error) throw error;
  }
  async function pushEin() {
    if (!pushMoeglich()) { meldung(pushGrund()); return false; }
    if (!db.profil) { oeffnePanel('anmelden', 'Melde dich an, um Benachrichtigungen einzuschalten.'); return false; }
    const erlaubt = await Notification.requestPermission();
    if (erlaubt !== 'granted') {
      meldung(erlaubt === 'denied' ? 'Benachrichtigungen sind für diese Seite gesperrt. Du kannst sie in den Einstellungen deines Browsers wieder erlauben.' : 'Ohne deine Erlaubnis gibt es keine Benachrichtigungen.');
      return false;
    }
    await pushMelden(await pushAbo(true));
    push.an = true;
    pushSpeichern();
    return true;
  }
  // Gerät vom Konto lösen. ganz = auch beim Browser abmelden (Schalter aus), sonst nur beim Abmelden vom Konto
  async function pushTrennen(ganz) {
    if (!pushMoeglich()) return;
    try {
      const abo = await pushAbo(false);
      if (abo && db.user) await db.client.rpc('push_abmelden', { p_endpoint: abo.endpoint });
      if (abo && ganz) await abo.unsubscribe();
    } catch (e) { /* lokal trotzdem ausschalten */ }
    if (ganz) { push.an = false; pushSpeichern(); }
  }
  // Nach dem Anmelden und bei jedem Start: Gerät still wieder mit dem Konto verbinden (Adressen können sich ändern)
  async function pushAuffrischen() {
    if (!pushAn()) return;
    try { await pushMelden(await pushAbo(true)); } catch (e) { /* beim nächsten Start wieder */ }
  }
  function pushKarteHTML(g) {
    if (!pushAnbieten()) return '';
    const laeuft = (g.eigen && (g.status === 'zugesagt' || g.status === 'erledigt' || (g.status === 'offen' && !abgelaufen(g)))) || (g.helfer === 'ich' && (g.status === 'zugesagt' || g.status === 'erledigt'));
    if (!laeuft) return '';
    const text = g.eigen
      ? (g.status === 'offen' ? 'Dann meldet sich dein Handy, sobald jemand zusagt.' : `Dann meldet sich dein Handy, wenn ${esc(vorname(g.helferName) || 'dein Helfer')} schreibt oder fertig ist.`)
      : `Dann meldet sich dein Handy, wenn ${esc(vorname(g.wer))} schreibt oder bestätigt.`;
    return `<div class="push-karte">${icon('glocke')}
        <div><strong>Bescheid aufs Handy?</strong><p>${text}</p>
          <div class="btn-row"><button type="button" class="btn btn-primary btn-auto" data-push-ein>Einschalten</button>
          <button type="button" class="btn btn-secondary btn-auto" data-push-spaeter>Nicht jetzt</button></div>
        </div>
      </div>`;
  }
  function pushMenueHTML() {
    const schalter = (attr, an, titel, text) => `<div class="schalter-zeile"><span class="schalter-text"><strong>${titel}</strong><span>${text}</span></span>
        <button type="button" class="schalter" role="switch" aria-checked="${an}" aria-label="${titel}" ${attr} ${push.busy ? 'disabled' : ''}><span aria-hidden="true"></span></button></div>`;
    if (!pushMoeglich()) return `<p class="klein">${pushGrund()}</p>`;
    if (Notification.permission === 'denied') return '<p class="klein">Benachrichtigungen sind für diese Seite gesperrt. Du kannst sie in den Einstellungen deines Browsers wieder erlauben.</p>';
    const an = pushAn();
    const ort = (db.profil && db.profil.stadtteil) || 'meiner Nähe';
    // „Ich helfe gern bei …“: nur über passende neue Anfragen Bescheid geben
    const wahl = push.neue ? `<div class="hilft-gern" role="group" aria-labelledby="hilft-gern-titel">
        <span class="wahl-titel" id="hilft-gern-titel">Ich helfe gern bei</span>
        <div class="vorschlaege">${KATEGORIEN.map((k) => `<button type="button" class="chip chip-vorschlag" data-push-kat="${k.id}" aria-pressed="${push.kategorien.includes(k.id)}" ${push.busy ? 'disabled' : ''}>${icon(k.id)}<span>${k.name}</span></button>`).join('')}</div>
        <p class="klein">${push.kategorien.length ? `Nur bei ${push.kategorien.map((k) => katName(k)).join(', ')}.` : 'Keine Auswahl: Du erfährst von allen neuen Anfragen.'}</p>
      </div>` : '';
    return schalter('data-push-schalter', an, 'Bescheid aufs Handy', 'Wenn jemand zusagt, dir schreibt, ein Auftrag fertig ist, und am Abend vor dem Termin.') +
      (an ? schalter('data-push-neue', push.neue, `Neue Anfragen bis ${db.wohnort ? db.wohnort.umkreis : 5} km um ${esc(ort)}`, 'Höchstens alle 20 Minuten.') + wahl +
        '<button type="button" class="link-btn link-links" data-push-test>Test-Benachrichtigung schicken</button>' : '');
  }
  // Tipp auf eine Benachrichtigung, während die App offen ist: Die Offline-Hülle reicht das Ziel weiter
  if ('serviceWorker' in navigator && !VORSCHAU) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.typ !== 'push-link') return;
      const id = linkId(String(d.link || ''));
      if (id) gesuchAusLink(id); else if (istLive()) bald(neuLaden);
    });
  }

  /* ===== Zähler auf der Startseite: Wie oft wurde schon geholfen? ===== */
  async function ladeStatistik() {
    if (!istLive()) return;
    try {
      const { data, error } = await db.client.rpc('statistik');
      if (!error && data) { db.statistik = data; renderGeholfen(); }
    } catch (e) { /* ohne Zähler weiter */ }
    // Übliche Beträge aus echten Anfragen (erst ab 5 je Tätigkeit)
    try {
      const { data, error } = await db.client.rpc('richtwerte');
      if (!error && data) { db.richtwerte = data; if (wizSchritt === 3) renderRichtwert(); }
    } catch (e) { /* dann unser Vorschlag */ }
  }
  function renderGeholfen() {
    const el = $('#geholfen');
    if (!el) return;
    const fertig = gesuche.filter((g) => g.status === 'bezahlt').length;
    const st = istLive() || wartetAufLive() ? db.statistik : { woche: 12 + fertig, gesamt: 148 + fertig };
    const text = !st ? '' : st.woche > 0 ? `Diese Woche ${st.woche}× geholfen` : st.gesamt > 0 ? `Schon ${st.gesamt}× geholfen` : '';
    el.hidden = !text;
    el.innerHTML = text ? `${icon('check', 'i-xs')}<span>${text}</span>` : '';
  }

  /* ===== Klicks auf Listen und Filter ===== */
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { gehe(go.dataset.go); return; }
    if (e.target.closest('[data-einladen]')) { oeffnePanel('einladen'); return; }
    if (e.target.closest('[data-teilen-app]')) { einladen(); return; }
    if (e.target.closest('[data-installieren]')) { installieren(); return; }
    if (e.target.closest('[data-installieren-nein]')) {
      try { localStorage.setItem(INSTALL_SPEICHER, 'nein'); } catch (err) { /* nur für diese Sitzung */ }
      $('#installieren').hidden = true;
      return;
    }
    if (e.target.closest('[data-start-zeigen]')) { schliessen(); startZeigen(); return; }
    const auf = e.target.closest('[data-oeffne]');
    if (auf) { oeffnen(auf.dataset.oeffne, auf); return; }
    const panel = e.target.closest('[data-panel]');
    if (panel) { oeffnePanel(panel.dataset.panel); return; }
    const opt = e.target.closest('[data-ansicht]');
    if (opt) {
      ansichtSetzen(opt.dataset.ansicht, opt.dataset.wert);
      if (opt.dataset.ansicht === 'kartenart') kartenArtNeu();
      renderSheet();
      const zurueck = document.querySelector(`[data-ansicht="${opt.dataset.ansicht}"][data-wert="${opt.dataset.wert}"]`);
      if (zurueck) zurueck.focus({ preventScroll: true });
      if (kartenStatus.svg) kartenGroesse(false);
      return;
    }
    if (e.target.closest('[data-neu-laden]')) { db.fehler = null; renderListe(); neuLaden(); return; }
    const kat = e.target.closest('[data-kat]');
    if (kat) { ui.kat = kat.dataset.kat; renderChips(); renderListe(); renderKarte(); return; }
    const card = e.target.closest('.card[data-id]');
    if (card) { oeffnen(card.dataset.id, card); return; }
    if (e.target.closest('[data-reset]')) {
      gesuche = kopie(BEISPIELE);
      demoSpeichern();
      renderAlles();
      meldung('Beispieldaten wiederhergestellt');
    }
  });
  $('#suche').addEventListener('input', (e) => { ui.suche = e.target.value; renderListe(); renderKarte(); });
  $('#sort').addEventListener('change', (e) => { ui.sort = e.target.value; renderListe(); });
  $('#umkreis').addEventListener('change', (e) => {
    ui.umkreis = Number(e.target.value) || 10;
    try { localStorage.setItem(UMKREIS_SPEICHER, String(ui.umkreis)); } catch (err) { /* nur für diese Sitzung */ }
    kartenStatus.bewegt = false;
    if (kartenStatus.blick) blickSetzen(blickAufAlles(), true);
    renderListe();
    renderKarte();
  });
  $('#ort-knopf').addEventListener('click', () => oeffnePanel('ort'));

  /* ===== Begrüßung beim ersten Start (Vorbild: Too Good To Go, BlaBlaCar) ===== */
  let startSeite = 0;
  const START_SEITEN = 4;
  function startHTML() {
    const punkte = (n) => `<div class="start-punkte" aria-hidden="true">${Array.from({ length: START_SEITEN }, (_, i) => `<span class="${i === n ? 'an' : ''}"></span>`).join('')}</div>`;
    const ueber = `<button type="button" class="link-btn start-ueber" data-start="fertig">Überspringen</button>`;
    const fuss = (n, knopf, aktion) => `<div class="start-fuss">${punkte(n)}<button type="button" class="btn btn-primary" data-start="${aktion}">${knopf}</button></div>`;
    if (startSeite === 0) return `${ueber}
      <svg class="start-zeichen" viewBox="0 0 428 254" aria-hidden="true" focusable="false"><use href="#hs-form"/></svg>
      <h1 id="start-titel" tabindex="-1">Nachbarn helfen Nachbarn</h1>
      <p class="start-text">Rasen mähen, Einkauf hochtragen, Drucker einrichten: kleine Hilfen in deiner Nachbarschaft, gegen eine kleine Aufwandsentschädigung.</p>
      <ul class="start-liste">
        <li>${icon('winken')}<span><strong>Hilfe suchen</strong>Für dich oder für jemanden aus der Familie, in vier kurzen Schritten.</span></li>
        <li>${icon('stecknadel')}<span><strong>Helfen</strong>Sehen, wo in deiner Nähe Hilfe gebraucht wird.</span></li>
      </ul>
      ${fuss(0, 'Weiter', 'weiter')}`;
    if (startSeite === 1) return `${ueber}
      <h1 id="start-titel" tabindex="-1">Gut lesbar?</h1>
      <p class="start-text">Wähle die Schriftgröße, die für dich angenehm ist. Du kannst sie später im Menü ändern.</p>
      <div class="start-schrift" role="group" aria-label="Schriftgröße">${ANSICHT_OPTIONEN.schrift.map(([w, n], i) =>
        `<button type="button" class="wahl-knopf" data-start-schrift="${w}" aria-pressed="${ansicht.schrift === w}"><span style="font-size:${[17, 20, 23][i]}px">${n}</span><span style="font-size:${[17, 20, 23][i]}px" aria-hidden="true">Abc</span></button>`).join('')}</div>
      <p class="start-probe"><strong>Hecke schneiden</strong>Samstag, vormittags in Havelse. So groß ist die Schrift in der App.</p>
      ${fuss(1, 'Weiter', 'weiter')}`;
    if (startSeite === 2) return `${ueber}
      <h1 id="start-titel" tabindex="-1">Wo wohnst du?</h1>
      <p class="start-text">Dann zeigen wir dir zuerst, was in deiner Nähe los ist. Deine Adresse brauchen wir dafür nicht.</p>
      <div class="feld start-ort"><label for="start-ort">Ort, Stadtteil oder Postleitzahl</label>${ortFeldHTML('start-ort', gewaehlterOrt, 'z. B. Berenbostel, 30827 oder Linden')}
        <p class="feld-hinweis" id="start-ort-text">${gewaehlterOrt ? `Gewählt: ${esc(gewaehlterOrt.name)}` : 'Tippe die ersten Buchstaben und wähle aus der Liste.'}</p></div>
      ${fuss(2, gewaehlterOrt ? 'Weiter' : 'Ohne Ort weiter', 'weiter')}`;
    return `${ueber}
      <h1 id="start-titel" tabindex="-1">So bleibt es sicher</h1>
      <ul class="start-liste">
        <li>${icon('schloss')}<span><strong>Adresse erst nach der Zusage</strong>Auf der Karte erscheint nur ein Punkt in der Nähe.</span></li>
        <li>${icon('schild')}<span><strong>Ein Code an der Tür</strong>Wer hilft, nennt einen Code, den nur ihr beide kennt.</span></li>
        <li>${icon('stern')}<span><strong>Bewertungen und Melden</strong>Helfen kann man ab 18. Nach jedem Auftrag bewertet ihr euch, und wir prüfen jede Meldung.</span></li>
      </ul>
      ${fuss(3, 'Los geht’s', 'fertig')}`;
  }
  function renderStart(fokus) {
    $('#start-inhalt').innerHTML = startHTML();
    const f = fokus ? $(fokus) : $('#start-titel');
    if (f) f.focus({ preventScroll: true });
  }
  function startZeigen() {
    startSeite = 0;
    $('#start').hidden = false;
    document.body.classList.add('sheet-offen');
    renderStart();
  }
  $('#start').addEventListener('ortgewaehlt', (e) => {
    if (e.target.id !== 'start-ort' || !ortWaehlen(e.detail)) return;
    $('#start-ort-text').textContent = `Gewählt: ${gewaehlterOrt.name}`;
    const weiter = $('#start [data-start="weiter"]');
    if (weiter) weiter.textContent = 'Weiter';
  });
  function startBeenden() {
    $('#start').hidden = true;
    document.body.classList.remove('sheet-offen');
    try { localStorage.setItem(START_SPEICHER, START_FASSUNG); } catch (e) { /* nur für diese Sitzung */ }
    renderStadtteilAuswahl();
    renderAlles();
    const h = $(`#h-${ui.view}`);
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  $('#start').addEventListener('click', (e) => {
    const schrift = e.target.closest('[data-start-schrift]');
    if (schrift) { ansichtSetzen('schrift', schrift.dataset.startSchrift); renderStart(`[data-start-schrift="${schrift.dataset.startSchrift}"]`); return; }
    const a = e.target.closest('[data-start]');
    if (!a) return;
    if (a.dataset.start === 'weiter') {
      // Getippt, aber nicht aus der Liste gewählt: den ersten Vorschlag nehmen
      const feld = $('#start-ort');
      if (feld && feld.value.trim() && !ortAusFeld(feld)) { ortAufloesen(feld).then((o) => { if (o) ortWaehlen(o); startSeite += 1; renderStart(); }); return; }
      startSeite += 1; renderStart();
    }
    else startBeenden();
  });
  $('#start').addEventListener('keydown', (e) => { if (e.key === 'Escape') startBeenden(); });

  /* ===== Anfrage erstellen: vier Schritte (Vorbild: TaskRabbit, Kleinanzeigen) ===== */
  const form = $('#neu-form');
  const betragInput = $('#neu-betrag');
  const SCHRITT_NAMEN = ['Was?', 'Wann und wo?', 'Betrag', 'Prüfen'];
  // Unser Vorschlag je Tätigkeit, bis genug echte Anfragen aus Garbsen für einen Durchschnitt da sind
  const RICHTWERTE = { garten: [15, 25], einkaufen: [5, 10], tiere: [8, 15], haushalt: [10, 25], tragen: [10, 20], technik: [10, 20] };
  const VORSCHLAEGE = {
    garten: ['Rasen mähen', 'Hecke schneiden', 'Laub rechen'],
    einkaufen: ['Einkauf mitbringen', 'Getränkekisten hochtragen', 'Medikamente abholen'],
    tiere: ['Hund ausführen', 'Katze füttern', 'Kleintiere versorgen'],
    haushalt: ['Möbel aufbauen', 'Lampe anbringen', 'Fenster putzen'],
    tragen: ['Kartons tragen', 'Möbel tragen', 'Sperrmüll rausstellen'],
    technik: ['Handy einrichten', 'Drucker einrichten', 'Fahrrad reparieren']
  };
  let wizSchritt = 1;
  let betragGeaendert = false;

  $('#neu-kategorien').innerHTML = KATEGORIEN.map((k, i) =>
    `<label class="kachel-radio"><input type="radio" name="kat" id="neu-kat-${k.id}" value="${k.id}" ${i === 0 ? 'checked' : ''}><span class="kachel-karte">${icon(k.id)}<span>${k.name}</span></span></label>`
  ).join('');
  $('#neu-schnell').innerHTML = [10, 15, 20, 30].map((n) =>
    `<button type="button" class="chip" data-schnell="${n}">${n} €</button>`
  ).join('');

  const katWahl = () => form.querySelector('input[name="kat"]:checked').value;
  // Für wen ist die Hilfe? Viele fragen für Eltern oder Großeltern an (Vorbild: hilver in Heidelberg, „Fahrt für jemand anderen“ bei Uber)
  let fuerModus = 'ich';
  function renderFuer(fokus) {
    $('#neu-fuer-wahl').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fuer === fuerModus)));
    $('#fuer-feld').hidden = fuerModus !== 'andere';
    if (fokus) (fuerModus === 'andere' ? $('#neu-fuer') : $(`#neu-fuer-wahl [data-fuer="${fuerModus}"]`)).focus({ preventScroll: true });
  }
  function fuerSetzen(name) {
    fuerModus = name ? 'andere' : 'ich';
    $('#neu-fuer').value = name || '';
    renderFuer();
  }
  const fuerWert = () => fuerModus === 'andere' ? $('#neu-fuer').value.trim().slice(0, 40) : '';
  const telefonWert = () => $('#neu-telefon').value.trim();
  // Wie in der Datenbank: Ziffern, Leerzeichen und + ( ) / -, mit 6 bis 20 Ziffern
  const telefonGueltig = (t) => /^[0-9 +()\/-]{6,30}$/.test(t) && t.replace(/\D/g, '').length >= 6 && t.replace(/\D/g, '').length <= 20;
  $('#neu-fuer-wahl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fuer]');
    if (!b) return;
    fuerModus = b.dataset.fuer;
    $('#fehler-fuer').hidden = true;
    $('#neu-fuer').removeAttribute('aria-invalid');
    renderFuer(true);
  });
  const betragWert = () => { const v = parseInt(betragInput.value, 10); return Number.isFinite(v) ? v : NaN; };
  const betragGueltig = (b) => b >= CONFIG.minBetrag && b <= CONFIG.maxBetrag;

  function renderVorschlaege() {
    $('#neu-vorschlaege').innerHTML = (VORSCHLAEGE[katWahl()] || []).map((t) =>
      `<button type="button" class="chip chip-vorschlag" data-vorschlag="${esc(t)}">${esc(t)}</button>`).join('');
  }
  function renderRichtwert() {
    const k = katWahl();
    // Aus echten Anfragen in Garbsen, sobald es genug gibt, sonst unser Vorschlag
    const echt = istLive() && db.richtwerte && db.richtwerte[k];
    const [lo, hi] = echt ? [echt.von, Math.max(echt.von, echt.bis)] : (RICHTWERTE[k] || [10, 20]);
    const spanne = lo === hi ? `${lo} €` : `${lo} bis ${hi} €`;
    $('#neu-richtwert').innerHTML = echt
      ? `${icon('info', 'i-sm')}<span>So viel geben Nachbarn auf Hand Drauf für ${esc(katName(k))}: <strong>${spanne}</strong> <span class="richtwert-quelle">(aus ${echt.anzahl} Anfragen)</span></span>`
      : `${icon('info', 'i-sm')}<span>Unser Vorschlag für ${esc(katName(k))}: <strong>${spanne}</strong></span>`;
    if (!betragGeaendert) setzeBetrag(Math.round((lo + hi) / 2 / 5) * 5, true);
  }
  function renderKosten() {
    const b = betragWert();
    const el = $('#neu-kosten');
    if (!betragGueltig(b)) {
      el.innerHTML = `<div class="kosten-zeile"><span>Betrag zwischen ${CONFIG.minBetrag} und ${CONFIG.maxBetrag} € wählen</span></div>`;
      return;
    }
    if (!CONFIG.gebuehren) {
      el.innerHTML = `
        <div class="kosten-zeile kosten-summe" style="border:0;padding:0;margin:0"><span>Du zahlst direkt</span><span>${euro(b)}</span></div>
        <span class="kosten-hinweis">Ohne Gebühr in der Testphase.</span>`;
      return;
    }
    const g = CONFIG.gebuehrAuftraggeber;
    el.innerHTML = `
      <div class="kosten-zeile"><span>Aufwandsentschädigung</span><span>${euro(b)}</span></div>
      <div class="kosten-zeile"><span>Servicegebühr</span><span>${euro(g)}</span></div>
      <div class="kosten-zeile kosten-summe"><span>Du zahlst</span><span>${euro(b + g)}</span></div>
      <span class="kosten-hinweis">Erst nach dem erledigten Job.</span>`;
  }
  function setzeBetrag(b, automatisch) {
    betragInput.value = Math.min(CONFIG.maxBetrag, Math.max(CONFIG.minBetrag, b));
    betragInput.removeAttribute('aria-invalid');
    $('#fehler-betrag').hidden = true;
    if (!automatisch) betragGeaendert = true;
    renderKosten();
  }
  function renderPruefen() {
    const k = katWahl();
    const text = $('#neu-text').value.trim();
    const adresse = $('#neu-adresse').value.trim();
    const zeile = (dt, dd, n) => `<div><dt>${dt}</dt><dd>${dd}</dd><button type="button" class="link-btn aendern" data-gehe-schritt="${n}" aria-label="${dt} ändern">Ändern</button></div>`;
    $('#neu-pruefen').innerHTML =
      zeile('Tätigkeit', `${icon(k, 'i-sm')}${esc(katName(k))}: ${esc($('#neu-titel').value.trim())}`, 1) +
      (text ? zeile('Details', esc(text), 1) : '') +
      (fuerWert() ? zeile('Für wen', esc(fuerWert()), 1) : '') +
      zeile('Wann', esc(wannLang(terminSpeichern())), 2) +
      zeile('Wo', `${esc($('#neu-stadtteil').value)}${adresse ? `<span class="klein">${esc(adresse)}, sieht nur, wer zusagt</span>` : ''}`, 2) +
      (telefonWert() ? zeile('Telefon', `${esc(telefonWert())}<span class="klein">sieht nur, wer zusagt</span>`, 2) : '') +
      zeile('Aufwandsentschädigung', euro(betragWert()), 3);
  }
  function zeigeSchritt(n, fokus = true) {
    wizSchritt = n;
    form.querySelectorAll('.schritt').forEach((el) => { el.hidden = Number(el.dataset.schritt) !== n; });
    form.querySelectorAll('.wizard-leiste li').forEach((li, i) => { li.className = i < n ? 'ist-erreicht' : ''; });
    $('#wizard-stand').textContent = `Schritt ${n} von 4: ${SCHRITT_NAMEN[n - 1]}`;
    $('#neu-zurueck').hidden = n === 1;
    $('#neu-weiter').hidden = n === 4;
    $('#neu-senden').hidden = n !== 4;
    if (n === 2) renderTermin();
    if (n === 3) renderRichtwert();
    if (n === 4) { renderPruefen(); renderKosten(); }
    if (fokus) {
      const h = $(`#schritt-${n}-titel`);
      if (h) h.focus({ preventScroll: true });
      $('#h-neu').scrollIntoView({ block: 'start' });
    }
  }
  // Gibt das erste fehlerhafte Feld eines Schritts zurück
  function pruefeSchritt(n) {
    const fehler = (feld, id) => { feld.setAttribute('aria-invalid', 'true'); $(id).hidden = false; return feld; };
    if (n === 1 && $('#neu-titel').value.trim().length < 3) return fehler($('#neu-titel'), '#fehler-titel');
    if (n === 1 && anstoessig(`${$('#neu-titel').value} ${$('#neu-text').value}`)) return fehler(anstoessig($('#neu-titel').value) ? $('#neu-titel') : $('#neu-text'), '#fehler-wort');
    if (n === 1 && fuerModus === 'andere' && (fuerWert().length < 2 || anstoessig(fuerWert()))) {
      $('#fehler-fuer').textContent = anstoessig(fuerWert()) ? 'Bitte ohne beleidigende oder anstößige Wörter.' : 'Bitte schreib kurz, für wen die Hilfe ist.';
      return fehler($('#neu-fuer'), '#fehler-fuer');
    }
    if (n === 2 && !terminAuswahl().gueltig) { $('#fehler-tag').hidden = false; return $(termin.modus === 'tag' ? '#termin-tage .kal-tag[tabindex="0"]' : '#termin-woche .wahl-knopf'); }
    if (n === 2 && $('#neu-stadtteil').value.trim().length < 2) return fehler($('#neu-stadtteil'), '#fehler-ort');
    if (n === 2 && istLive() && $('#neu-adresse').value.trim().length < 3) return fehler($('#neu-adresse'), '#fehler-adresse');
    if (n === 2 && telefonWert() && !telefonGueltig(telefonWert())) return fehler($('#neu-telefon'), '#fehler-telefon');
    if (n === 3 && !betragGueltig(betragWert())) return fehler(betragInput, '#fehler-betrag');
    return null;
  }
  function weiter() {
    const f = pruefeSchritt(wizSchritt);
    if (f) { f.focus(); return; }
    zeigeSchritt(Math.min(4, wizSchritt + 1));
  }
  $('#neu-weiter').addEventListener('click', weiter);
  $('#neu-zurueck').addEventListener('click', () => zeigeSchritt(Math.max(1, wizSchritt - 1)));

  form.addEventListener('click', (e) => {
    const s = e.target.closest('[data-step]');
    if (s) { const b = betragWert(); setzeBetrag((Number.isFinite(b) ? b : 15) + Number(s.dataset.step)); return; }
    const q = e.target.closest('[data-schnell]');
    if (q) { setzeBetrag(Number(q.dataset.schnell)); return; }
    const v = e.target.closest('[data-vorschlag]');
    if (v) {
      const t = $('#neu-titel');
      t.value = v.dataset.vorschlag;
      t.removeAttribute('aria-invalid');
      $('#fehler-titel').hidden = true;
      t.focus();
      return;
    }
    const z = e.target.closest('[data-gehe-schritt]');
    if (z) zeigeSchritt(Number(z.dataset.geheSchritt));
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'kat') { renderVorschlaege(); betragGeaendert = false; }
  });
  betragInput.addEventListener('input', () => { betragGeaendert = true; renderKosten(); });
  $('#neu-titel').addEventListener('input', (e) => {
    if (e.target.value.trim().length >= 3) { e.target.removeAttribute('aria-invalid'); $('#fehler-titel').hidden = true; }
    $('#fehler-wort').hidden = true;
  });
  $('#neu-text').addEventListener('input', (e) => { e.target.removeAttribute('aria-invalid'); $('#fehler-wort').hidden = true; });
  $('#neu-adresse').addEventListener('input', (e) => {
    if (e.target.value.trim().length >= 3) { e.target.removeAttribute('aria-invalid'); $('#fehler-adresse').hidden = true; }
  });
  $('#neu-fuer').addEventListener('input', (e) => { e.target.removeAttribute('aria-invalid'); $('#fehler-fuer').hidden = true; });
  $('#neu-telefon').addEventListener('input', (e) => {
    if (!e.target.value.trim() || telefonGueltig(e.target.value.trim())) { e.target.removeAttribute('aria-invalid'); $('#fehler-telefon').hidden = true; }
  });
  renderVorschlaege();

  /* ----- Termin: Kalender mit einzelnen Tagen oder flexibel in einer Woche ----- */
  const ZEIT_WAHL = [['vormittags', 'Vormittags'], ['nachmittags', 'Nachmittags'], ['abends', 'Abends'], ['uhrzeit', 'Uhrzeit wählen'], ['flexibel', 'Ist mir egal']];
  const WOCHEN_WAHL = ['Diese Woche', 'Nächste Woche', 'In 2 Wochen'];
  const UMFANG_WAHL = [['ganz', 'Ganze Woche', 'Mo–So'], ['werktage', 'Werktage', 'Mo–Fr'], ['wochenende', 'Wochenende', 'Sa/So']];
  const MAX_TAGE_WAHL = 5;
  const termin = {};
  function terminStart() {
    const morgen = plusTage(heute(), 1);
    Object.assign(termin, { modus: 'tag', tage: [isoTag(morgen)], woche: 0, umfang: 'ganz', zeit: 'nachmittags', uhrzeit: '16:00', fokus: null });
    termin.monat = new Date(morgen.getFullYear(), morgen.getMonth(), 1); // am Monatsende gleich den nächsten Monat zeigen
  }
  // Welche Tage umfasst „Diese Woche, Werktage“ usw. ab heute?
  function wochenSpanne(woche, umfang) {
    const h = heute();
    const mo = plusTage(montagVon(h), 7 * woche);
    let von = umfang === 'wochenende' ? plusTage(mo, 5) : mo;
    const bis = plusTage(mo, umfang === 'werktage' ? 4 : 6);
    if (von < h) von = h;
    return von > bis ? null : { von, bis };
  }
  // Ergebnis der Auswahl: Text für die Anzeige und den letzten Tag (für den Ablauf)
  function terminAuswahl() {
    if (termin.modus === 'tag') {
      const daten = termin.tage.map(ausIso).filter((d) => d >= heute()).sort((x, y) => x - y);
      if (!daten.length) return { gueltig: false };
      return { gueltig: true, text: tageText(daten), von: daten[0], bis: daten[daten.length - 1] };
    }
    if (termin.woche < 0) return { gueltig: false };
    const sp = wochenSpanne(termin.woche, termin.umfang);
    if (!sp) return { gueltig: false };
    const { von, bis } = sp;
    if (+von === +bis) return { gueltig: true, text: tagText(von), von, bis };
    // Ab Samstag ist vom Rest der Woche nur noch das Wochenende übrig
    const umfang = termin.umfang === 'ganz' && von.getDay() === 6 ? 'wochenende' : termin.umfang;
    const vor = { ganz: 'Woche', werktage: 'Werktage', wochenende: 'Wochenende' }[umfang];
    const text = umfang === 'wochenende' && von.getMonth() === bis.getMonth() ? `${vor} ${von.getDate()}./${bis.getDate()}. ${MONATE[bis.getMonth()]}` : `${vor} ${spanneText(von, bis)}`;
    return { gueltig: true, text, von, bis };
  }
  const terminZeitText = () => termin.zeit === 'uhrzeit' ? uhrzeitText(termin.uhrzeit) : (ZEIT_TEXT[termin.zeit] || ZEIT_TEXT.flexibel);
  // Was gespeichert wird: lesbarer Text mit Datum und Uhrzeit und der letzte passende Tag
  function terminSpeichern() {
    const a = terminAuswahl();
    if (!a.gueltig) return { wann: '', bis: null };
    return { wann: `${a.text}, ${terminZeitText()}`, bis: isoTag(a.bis) };
  }
  // Zum Bearbeiten: aus dem gespeicherten Text wieder eine Auswahl machen
  function terminAusWann(wann, vorbei) {
    terminStart();
    termin.tage = [];
    if (!wann) return;
    const i = wann.lastIndexOf(', ');
    const datum = i > 0 ? wann.slice(0, i) : wann;
    const zeitTeil = i > 0 ? wann.slice(i + 2) : '';
    const gegen = zeitTeil.match(/gegen (\d{1,2})(?::(\d\d))? Uhr/);
    if (gegen) { termin.zeit = 'uhrzeit'; termin.uhrzeit = `${gegen[1].padStart(2, '0')}:${gegen[2] || '00'}`; }
    else termin.zeit = Object.keys(ZEIT_TEXT).find((k) => ZEIT_TEXT[k] === zeitTeil || k === zeitTeil) || 'flexibel';
    const t = terminAusText(wann);
    if (!t || vorbei) { termin.woche = -1; return; }
    const art = /^(Woche|Werktage|Wochenende)\b|^(Sa\.\/So\.)/.exec(datum);
    if (art) {
      termin.modus = 'woche';
      termin.umfang = art[1] === 'Werktage' ? 'werktage' : art[1] === 'Woche' ? 'ganz' : 'wochenende';
      termin.woche = Math.round((montagVon(t.von) - montagVon(heute())) / (7 * TAG_MS));
      if (termin.woche < 0 || termin.woche > 2) termin.woche = -1;
      return;
    }
    termin.tage = datenAusText(datum).filter((d) => d >= heute()).map(isoTag);
    if (termin.tage.length) termin.monat = new Date(ausIso(termin.tage[0]).getFullYear(), ausIso(termin.tage[0]).getMonth(), 1);
  }

  function kalenderHTML() {
    const h = heute(), max = plusTage(h, MAX_VORAUS);
    const m = termin.monat;
    const tageImMonat = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const versatz = (m.getDay() + 6) % 7;
    const gewaehlt = new Set(termin.tage);
    const imMonat = (iso) => { const d = ausIso(iso); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); };
    // Nur ein Tag ist per Tab erreichbar, die Pfeiltasten wechseln den Tag
    const kandidaten = [termin.fokus, ...termin.tage, isoTag(h), isoTag(new Date(m))].filter((x) => x && imMonat(x) && ausIso(x) >= h && ausIso(x) <= max);
    const fokus = kandidaten[0] || isoTag(new Date(m.getFullYear(), m.getMonth(), 1));
    let zellen = '';
    for (let k = 0; k < versatz; k++) zellen += '<span class="kal-leer" aria-hidden="true"></span>';
    for (let t = 1; t <= tageImMonat; t++) {
      const d = new Date(m.getFullYear(), m.getMonth(), t);
      const iso = isoTag(d);
      const aus = d < h || d > max;
      const istHeute = +d === +h;
      zellen += `<button type="button" class="kal-tag${istHeute ? ' ist-heute' : ''}${d.getDay() % 6 === 0 ? ' ist-we' : ''}" data-tag="${iso}"
        aria-pressed="${gewaehlt.has(iso)}" aria-label="${TAGNAMEN[d.getDay()]}, ${t}. ${MONATE_LANG[d.getMonth()]}${istHeute ? ', heute' : ''}"
        tabindex="${iso === fokus ? 0 : -1}" ${aus ? 'disabled' : ''}>${t}</button>`;
    }
    const vorher = m <= new Date(h.getFullYear(), h.getMonth(), 1);
    const nachher = new Date(m.getFullYear(), m.getMonth() + 1, 1) > max;
    return `<div class="kal">
      <div class="kal-kopf">
        <button type="button" class="kal-pfeil" data-kal="-1" aria-label="Voriger Monat" ${vorher ? 'disabled' : ''}>‹</button>
        <span class="kal-monat" aria-live="polite">${MONATE_LANG[m.getMonth()]} ${m.getFullYear()}</span>
        <button type="button" class="kal-pfeil" data-kal="1" aria-label="Nächster Monat" ${nachher ? 'disabled' : ''}>›</button>
      </div>
      <div class="kal-raster" role="group" aria-label="Tage im ${MONATE_LANG[m.getMonth()]}, mehrere möglich">
        ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span class="kal-wt" aria-hidden="true">${w}</span>`).join('')}
        ${zellen}
      </div>
      <p class="kal-hinweis">Tippe einen oder mehrere Tage an (höchstens ${MAX_TAGE_WAHL}).</p>
    </div>`;
  }
  function wocheHTML() {
    const knopf = (attr, wert, aktiv, titel, unter, aus) => `<button type="button" class="wahl-knopf" ${attr}="${wert}" aria-pressed="${aktiv}" ${aus ? 'disabled' : ''}>${titel}${unter ? `<small>${unter}</small>` : ''}</button>`;
    return `<div class="wahl-gruppe"><span class="wahl-titel">Welche Woche?</span>
        <div class="wahl-raster wahl-raster-3">${WOCHEN_WAHL.map((n, w) => {
          const sp = wochenSpanne(w, 'ganz');
          return knopf('data-woche', w, termin.woche === w, n, spanneText(sp.von, sp.bis), false);
        }).join('')}</div></div>
      <div class="wahl-gruppe"><span class="wahl-titel">Welche Tage?</span>
        <div class="wahl-raster wahl-raster-3">${UMFANG_WAHL.map(([k, n, unter]) =>
          knopf('data-umfang', k, termin.umfang === k, n, unter, termin.woche >= 0 && !wochenSpanne(termin.woche, k))).join('')}</div></div>`;
  }
  function renderTermin(fokus) {
    $('#termin-modus').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.terminModus === termin.modus)));
    $('#termin-tage').hidden = termin.modus !== 'tag';
    $('#termin-woche').hidden = termin.modus !== 'woche';
    if (termin.modus === 'tag') $('#termin-tage').innerHTML = kalenderHTML();
    else $('#termin-woche').innerHTML = wocheHTML();
    $('#termin-zeit').innerHTML = ZEIT_WAHL.map(([k, n]) => `<button type="button" class="wahl-knopf" data-zeit="${k}" aria-pressed="${termin.zeit === k}">${n}</button>`).join('');
    $('#uhrzeit-feld').hidden = termin.zeit !== 'uhrzeit';
    $('#neu-uhrzeit').value = termin.uhrzeit;
    const a = terminAuswahl();
    $('#termin-text').innerHTML = a.gueltig ? `${icon('kalender', 'i-sm')}<span>${esc(wannLang({ wann: `${a.text}, ${terminZeitText()}` }))}</span>` : '';
    if (a.gueltig) $('#fehler-tag').hidden = true;
    if (fokus) { const f = $(fokus); if (f) f.focus({ preventScroll: true }); }
  }
  function terminKlick(e) {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.terminModus) {
      termin.modus = t.dataset.terminModus;
      renderTermin(`#termin-modus [data-termin-modus="${termin.modus}"]`);
    } else if (t.dataset.kal) {
      termin.monat = new Date(termin.monat.getFullYear(), termin.monat.getMonth() + Number(t.dataset.kal), 1);
      termin.fokus = null;
      renderTermin(`#termin-tage [data-kal="${t.dataset.kal}"]:not([disabled])`);
      if (!$('#termin-tage [data-kal]:focus')) { const f = $('#termin-tage .kal-tag[tabindex="0"]'); if (f) f.focus({ preventScroll: true }); }
    } else if (t.dataset.tag) {
      const iso = t.dataset.tag;
      termin.fokus = iso;
      if (termin.tage.includes(iso)) termin.tage = termin.tage.filter((x) => x !== iso);
      else if (termin.tage.length >= MAX_TAGE_WAHL) { meldung(`Höchstens ${MAX_TAGE_WAHL} Tage. Für mehr nimm „Flexibel“.`); return; }
      else termin.tage = [...termin.tage, iso];
      renderTermin(`#termin-tage [data-tag="${iso}"]`);
    } else if (t.dataset.woche !== undefined) {
      termin.woche = Number(t.dataset.woche);
      if (!wochenSpanne(termin.woche, termin.umfang)) termin.umfang = 'ganz';
      renderTermin(`#termin-woche [data-woche="${termin.woche}"]`);
    } else if (t.dataset.umfang) {
      termin.umfang = t.dataset.umfang;
      if (termin.woche < 0) termin.woche = 0;
      renderTermin(`#termin-woche [data-umfang="${termin.umfang}"]`);
    } else if (t.dataset.zeit) {
      termin.zeit = t.dataset.zeit;
      renderTermin(termin.zeit === 'uhrzeit' ? '#neu-uhrzeit' : `#termin-zeit [data-zeit="${termin.zeit}"]`);
    }
  }
  ['#termin-modus', '#termin-tage', '#termin-woche', '#termin-zeit'].forEach((sel) => $(sel).addEventListener('click', terminKlick));
  // Pfeiltasten im Kalender: links/rechts ein Tag, hoch/runter eine Woche
  $('#termin-tage').addEventListener('keydown', (e) => {
    const t = e.target.closest('.kal-tag');
    const schritt = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!t || !schritt) return;
    e.preventDefault();
    const ziel = plusTage(ausIso(t.dataset.tag), schritt);
    if (ziel < heute() || ziel > plusTage(heute(), MAX_VORAUS)) return;
    termin.fokus = isoTag(ziel);
    if (ziel.getMonth() !== termin.monat.getMonth()) termin.monat = new Date(ziel.getFullYear(), ziel.getMonth(), 1);
    renderTermin(`#termin-tage [data-tag="${termin.fokus}"]`);
  });
  $('#neu-uhrzeit').addEventListener('input', (e) => {
    if (/^\d{2}:\d{2}$/.test(e.target.value)) { termin.uhrzeit = e.target.value; const a = terminAuswahl(); if (a.gueltig) $('#termin-text span').textContent = wannLang({ wann: `${a.text}, ${terminZeitText()}` }); }
  });
  terminStart();
  renderTermin();

  /* ----- Eigene Anfrage bearbeiten: dieselben Schritte, vorausgefüllt ----- */
  function renderWizardModus() {
    const b = !!ui.bearbeiten;
    $('#h-neu').textContent = b ? 'Anfrage bearbeiten' : 'Hilfe suchen';
    $('#neu-lead').textContent = b ? 'Änderungen sehen Nachbarn sofort.' : '';
    $('#neu-lead').hidden = !b;
    $('#neu-senden').textContent = b ? 'Änderungen speichern' : 'Anfrage veröffentlichen';
    $('#neu-abbrechen').hidden = !b;
  }
  // alsVorlage: „Noch mal anfragen“ übernimmt die Angaben einer erledigten Anfrage in eine neue
  async function bearbeitenStarten(g, schritt, alsVorlage) {
    if (istLive() && typeof db.adressen.get(g.id) !== 'string') { db.adressen.delete(g.id); await ladeAdresse(g.id); }
    const adresse = adresseVon(g) || '';
    form.reset();
    ui.bearbeiten = alsVorlage ? null : g.id;
    const kat = $(`#neu-kat-${g.kat}`);
    if (kat) kat.checked = true;
    renderVorschlaege();
    $('#neu-titel').value = g.titel;
    $('#neu-text').value = g.text || '';
    fuerSetzen(g.fuer || '');
    // Gespeicherten Termin wieder in den Kalender holen. Ist er vorbei, muss ein neuer gewählt werden.
    if (alsVorlage) terminStart(); else terminAusWann(g.wann, abgelaufen(g));
    renderTermin();
    renderStadtteilAuswahl();
    ortSetzenIn($('#neu-stadtteil'), { name: g.stadtteil, lat: g.lat, lng: g.lng });
    $('#neu-stadtteil').dataset.auto = '0';
    $('#neu-adresse').value = istLive() || adresse !== g.stadtteil ? adresse : '';
    $('#neu-telefon').value = telefonVon(g);
    betragInput.value = g.betrag;
    betragGeaendert = true;
    renderKosten();
    renderWizardModus();
    ui.zuletzt = null;
    schliessen();
    gehe('neu');
    zeigeSchritt(schritt);
    if (alsVorlage) meldung('Angaben übernommen. Wähle noch den Termin.');
  }
  function bearbeitenBeenden() {
    ui.bearbeiten = null;
    form.reset();
    fuerSetzen('');
    betragGeaendert = false;
    form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
    form.querySelectorAll('.fehler').forEach((f) => { f.hidden = true; });
    terminStart();
    renderTermin();
    renderVorschlaege();
    renderWizardModus();
    zeigeSchritt(1, false);
    renderStadtteilAuswahl();
    renderKosten();
  }
  $('#neu-abbrechen').addEventListener('click', () => {
    const id = ui.bearbeiten;
    bearbeitenBeenden();
    gehe('auftraege');
    if (gesuche.some((g) => g.id === id)) oeffnen(id);
  });

  $('#neu-stadtteil').addEventListener('input', (e) => {
    e.target.dataset.auto = '0';
    if (e.target.value.trim().length >= 2) { e.target.removeAttribute('aria-invalid'); $('#fehler-ort').hidden = true; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Enter in einem Feld führt zum nächsten Schritt, veröffentlicht wird erst im letzten
    if (wizSchritt < 4) { weiter(); return; }
    $('#neu-fehler').hidden = true;
    for (const n of [1, 2, 3]) {
      const f = pruefeSchritt(n);
      if (f) { zeigeSchritt(n, false); f.focus(); return; }
    }
    if (istLive() && !db.profil) {
      oeffnePanel('anmelden', 'Melde dich an, um deine Anfrage zu veröffentlichen. Deine Eingaben bleiben erhalten.');
      return;
    }

    const kat = katWahl();
    const titel = $('#neu-titel').value.trim();
    const adresse = $('#neu-adresse').value.trim();
    const b = betragWert();
    // Ort der Hilfe (öffentlich nur der Name) und, wenn möglich, die Lage der Adresse auf etwa 1 km genau
    const ortFeld = $('#neu-stadtteil');
    const ort = await ortAufloesen(ortFeld);
    if (!ort) { zeigeSchritt(2, false); $('#fehler-ort').hidden = false; ortFeld.setAttribute('aria-invalid', 'true'); ortFeld.focus(); return; }
    $('#fehler-ort').hidden = true; ortFeld.removeAttribute('aria-invalid');
    const stadtteil = ort.name;
    let punkt = ort;
    if (adresse && GEOCODER) {
      const genau = (await ortSuchen(`${adresse}, ${ort.name}`, 'adresse', ort))[0];
      if (genau && abstand(genau, ort) < 15000) punkt = genau;
    }
    const lage = rasterpunkt(punkt);
    const { wann, bis } = terminSpeichern();
    const text = $('#neu-text').value.trim();
    const fuer = fuerWert();
    const telefon = telefonWert();
    const bearbeitet = ui.bearbeiten;
    let neuId = bearbeitet;

    const knopf = $('#neu-senden');
    const zeigeFehler = (m) => { $('#neu-fehler').textContent = m; $('#neu-fehler').hidden = false; };
    if (istLive()) {
      knopf.disabled = true;
      knopf.setAttribute('aria-busy', 'true');
      try {
        const felder = { p_kategorie: kat, p_titel: titel, p_beschreibung: text, p_betrag: b, p_wann: wann, p_stadtteil: stadtteil, p_adresse: adresse };
        // Noch nicht aktualisierte Datenbank kennt p_bis und gesuch_bearbeiten nicht (Fehler PGRST202)
        const fehlt = (err) => err && (err.code === 'PGRST202' || /could not find the function/i.test(err.message || ''));
        // „Für wen“ und Telefon kennt erst die Datenbank mit dem Update vom 10. November 2026
        const dazu = { p_fuer: fuer, p_telefon: telefon };
        // Koordinaten (Rasterpunkt) kennt erst die Datenbank mit Update Teil 7; davor gehen nur Stadtteile von Garbsen
        const nurGarbsen = STADTTEILE.some((x) => x.name === stadtteil);
        const ohneOrt = () => { if (!nurGarbsen) throw new Error('Orte außerhalb von Garbsen gehen erst nach dem nächsten Datenbank-Update.'); };
        const mitLage = { p_lat: lage.lat, p_lng: lage.lng };
        if (bearbeitet) {
          let r = await db.client.rpc('gesuch_bearbeiten', { p_id: bearbeitet, ...felder, p_bis: bis, ...dazu, ...mitLage });
          if (fehlt(r.error)) { ohneOrt(); r = await db.client.rpc('gesuch_bearbeiten', { p_id: bearbeitet, ...felder, p_bis: bis, ...dazu }); }
          if (fehlt(r.error)) r = await db.client.rpc('gesuch_bearbeiten', { p_id: bearbeitet, ...felder, p_bis: bis });
          if (fehlt(r.error)) throw new Error('Bearbeiten ist noch nicht freigeschaltet. Zieh die Anfrage zurück und stelle sie neu.');
          if (r.error) throw r.error;
        } else {
          let r = db.altesSchema ? { error: { code: 'PGRST202' } } : await db.client.rpc('gesuch_erstellen', { ...felder, p_bis: bis, ...dazu, ...mitLage });
          if (fehlt(r.error)) ohneOrt();
          if (fehlt(r.error) && !db.altesSchema) r = await db.client.rpc('gesuch_erstellen', { ...felder, p_bis: bis, ...dazu });
          if (fehlt(r.error) && !db.altesSchema) r = await db.client.rpc('gesuch_erstellen', { ...felder, p_bis: bis });
          if (fehlt(r.error)) { db.altesSchema = true; r = await db.client.rpc('gesuch_erstellen', felder); }
          if (r.error) throw r.error;
          neuId = r.data;
        }
        db.adressen.set(neuId, adresse);
        db.telefone.set(neuId, telefon);
        await neuLaden();
      } catch (err) {
        zeigeFehler(fehlerText(err));
        return;
      } finally {
        knopf.disabled = false;
        knopf.removeAttribute('aria-busy');
      }
    } else if (bearbeitet) {
      const g = gesuche.find((x) => x.id === bearbeitet);
      if (!g || g.status !== 'offen') { zeigeFehler('Bearbeiten geht nur, solange noch niemand zugesagt hat.'); return; }
      if (stadtteil !== g.stadtteil || punkt !== ort) {
        const [nord, ost] = EIGEN_VERSATZ[gesuche.indexOf(g) % EIGEN_VERSATZ.length];
        Object.assign(g, versetze(stadtteil === meinOrt().stadtteil && punkt === ort ? meinOrt() : punkt, nord, ost));
      }
      Object.assign(g, { kat, titel, text, betrag: b, wann, bis, laeuftAb: demoAblauf(bis), stadtteil, adresse: adresse || stadtteil, fuer, telefon });
      demoSpeichern();
    } else {
      const anzahlEigene = gesuche.filter((g) => g.eigen).length;
      const [nord, ost] = EIGEN_VERSATZ[anzahlEigene % EIGEN_VERSATZ.length];
      const basis = stadtteil === meinOrt().stadtteil && punkt === ort ? meinOrt() : punkt;
      const pos = versetze(basis, nord, ost);
      neuId = 'e' + Date.now();
      gesuche.unshift({
        id: neuId, eigen: true, kat, titel, wer: 'Du', initialen: CONFIG.ich.initialen, betrag: b,
        stadtteil, lat: pos.lat, lng: pos.lng, wann, bis, laeuftAb: demoAblauf(bis), dauer: 'nach Absprache', text,
        adresse: adresse || stadtteil, fuer, telefon, status: 'offen', erstellt: Date.now()
      });
      demoSpeichern();
    }

    bearbeitenBeenden();
    ui.kat = 'alle'; ui.suche = ''; $('#suche').value = '';
    ui.zentrieren = neuId;
    renderAlles();
    gehe('karte');
    oeffnen(neuId);
    meldung(bearbeitet ? 'Änderungen gespeichert' : 'Anfrage veröffentlicht');
  });

  /* ===== Start-Animation: zwei Hände geben sich die Hand (läuft per CSS, hier nur Überspringen und Aufräumen) ===== */
  const intro = $('#intro');
  if (intro) {
    const introWeg = () => { intro.classList.add('weg'); setTimeout(() => { intro.hidden = true; }, 220); };
    intro.addEventListener('click', introWeg);
    setTimeout(() => { intro.hidden = true; }, 2400);
  }

  /* ===== Start ===== */
  if (BEISPIEL_MODUS) {
    $('#beispiel-band').hidden = false;
    $('#beispiel-zurueck').href = location.pathname + '#entdecken';
  }
  gesuche = LIVE_GEPLANT ? [] : demoLaden();
  const start = location.hash.slice(1);
  renderStadtteilAuswahl();
  renderAlles();
  renderKosten();
  zeige(VIEWS.includes(start) ? start : ansicht.start);
  if (istSeite(start)) oeffnePanel(start);
  else if (linkId(start)) { /* geteilte Anfrage: erst die Anfrage zeigen, die Begrüßung kommt beim nächsten Besuch */ }
  else {
    if (!startGesehen()) startZeigen();
  }
  umgebungStarten();
  // Erst jetzt, mit allen Inhalten, die Seite zeigen: So springt beim Laden nichts (siehe .startet in styles.css).
  // Mit Datenbank erst, wenn die Verbindung steht (starteLive), damit keine Demo-Inhalte aufblitzen.
  if (!LIVE_GEPLANT) seiteZeigen();
  starteLive().then((live) => {
    if (!live) { if (linkId(start)) gesuchAusLink(linkId(start)); return; }
    renderStadtteilAuswahl();
    renderKosten();
    ladeStatistik();
  });
})();
