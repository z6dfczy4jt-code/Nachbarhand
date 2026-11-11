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
    // Kartenbilder: ohne Eintrag die amtliche Straßenkarte basemap.de (Bund und Länder, kostenlos, ohne Schlüssel).
    // Optional mit kostenlosem Schlüssel von carto.com (siehe SETUP.md) der Stil „Voyager“. Der Schlüssel ist öffentlich.
    karte: { carto: EINSTELLUNGEN.karte.carto || '' },
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
  const STADTTEIL_NAMEN = STADTTEILE.map((s) => s.name).sort((a, b) => a.localeCompare(b, 'de'));

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

  const SPEICHER = 'nachbarhand-prototyp-v3';
  const VIEWS = ['entdecken', 'karte', 'neu', 'auftraege'];
  const RECHT = RECHT_TEXTE(CONFIG.betreiber, Object.assign({ supabaseCdn: /^https?:/.test(SUPABASE_JS), geocoder: String(EINSTELLUNGEN.geocoder || '') }, CONFIG.hosting), (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
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
    altesSchema: false,     // Datenbank ohne das Update vom November 2026 (kein Termin, kein Bearbeiten)
    blockiert: new Map()    // profil_id -> Name (von mir blockiert)
  };
  const istLive = () => db.modus === 'live';

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
  const ui = { view: 'entdecken', kat: 'alle', umkreis: 10, suche: '', sort: 'termin', offen: null, panel: null, authModus: 'anmelden', authGrund: '', authFertig: '', authWeg: 'passwort', authCode: '', vorlesen: false, markiert: null, zentrieren: null, rueckzug: false, melden: false, loeschen: false, profilGesuch: null, zuletzt: null, busy: false, bearbeiten: null, blockieren: false };

  /* ===== Ansicht: Design, Schriftgröße, Startseite (nur auf diesem Gerät gespeichert) ===== */
  const ANSICHT_SPEICHER = 'handdrauf-ansicht';
  const ANSICHT_OPTIONEN = {
    thema: [['auto', 'Automatisch'], ['hell', 'Hell'], ['dunkel', 'Dunkel']],
    schrift: [['normal', 'Normal'], ['gross', 'Groß'], ['sehr-gross', 'Sehr groß']],
    start: [['entdecken', 'Liste'], ['karte', 'Karte']]
  };
  const ansicht = { thema: 'auto', schrift: 'normal', start: 'entdecken' };
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
      meldung('Die Datenbank ist gerade nicht erreichbar. Du siehst die Demo.');
      return false;
    }
    db.modus = 'live';
    gesuche = [];
    renderAlles();
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
      meineBewertung: db.bewertungen.get(r.id) || 0
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
        const b = await db.client.from('bewertungen').select('gesuch_id, sterne').eq('von', db.user.id);
        if (!b.error && b.data) b.data.forEach((x) => db.bewertungen.set(x.gesuch_id, x.sterne));
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

  async function bewerte(g, sterne) {
    if (istLive()) {
      const { error } = await db.client.rpc('bewerten', { p_id: g.id, p_sterne: sterne });
      if (error) throw error;
      db.bewertungen.set(g.id, sterne);
    }
    g.meineBewertung = sterne;
    demoSpeichern();
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
      <span class="price">${euroKurz(g.betrag)}</span>
    </button>`;
  }

  function renderKopf() {
    const el = $('#kopf-rechts');
    if (!istLive()) el.innerHTML = `<span class="pill pill-muted">${BEISPIEL_MODUS ? 'Beispiele' : 'Demo'}</span>`;
    else if (!db.profil) el.innerHTML = '<button type="button" class="btn btn-secondary btn-klein" data-panel="anmelden">Anmelden</button>';
    else el.innerHTML = `<button type="button" class="avatar-btn" data-panel="konto" aria-label="Dein Konto">${esc(kuerzel(db.profil))}</button>`;
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
    $('#h-entdecken').textContent = istLive() ? (db.profil ? `Hallo ${db.profil.vorname}` : 'Hilfe in deiner Nähe') : 'Hallo Tim';
    $('#datum').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const nah = offene.filter((g) => meterVonMir(g) <= ui.umkreis * 1000);
    $('#anzahl-text').textContent = `${nah.length} ${nah.length === 1 ? 'Nachbar sucht' : 'Nachbarn suchen'} gerade Hilfe, bis ${ui.umkreis} km um ${ort.stadtteil}`;

    if (istLive() && !db.geladen) {
      ui.umgebungListe = [];
      umgebungZeichnen();
      $('#liste').innerHTML = db.fehler
        ? `<div class="leer"><p><strong>Die Anfragen konnten nicht geladen werden.</strong></p><p>${esc(db.fehler)}</p><button type="button" class="btn btn-secondary btn-auto" data-neu-laden>Erneut versuchen</button></div>`
        : `<p class="lade">Anfragen werden geladen …</p>`;
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
     Unten liegen Kartenbilder (Straßen, Namen, Parks) wie bei Google Maps, darüber Preisschilder.
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
  // So weit lässt sich die Karte verschieben: Deutschland mit etwas Rand
  const DE_A = inMeter(55.3, 5.4), DE_B = inMeter(47.0, 15.5);
  const massstabFuerZoom = (z) => 256 * Math.pow(2, z) / WELT;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const kartenStatus = { svg: null, welt: null, schicht: null, huelle: null, w: 0, h: 0, blick: null, ruhig: null,
    formen: [], grenzen: null, bewegt: false, gezogen: 0, marker: new Map(), elemente: [], gruppen: [], stufe: null, animation: 0 };
  const groesster = () => massstabFuerZoom(kacheln.aus ? KARTE.zoomMaxOhne : KARTE.zoomMax);
  // So weit lässt sich herauszoomen: ganz Deutschland mit Rand (Zoomstufe 5)
  const kleinster = () => massstabFuerZoom(KARTE.zoomMin);

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
     Standard: basemap.de, die amtliche Straßenkarte von Bund und Ländern (BKG, Frankfurt). Kostenlos, ohne Schlüssel,
     auch für kommerzielle Nutzung (CC BY 4.0), Server in Deutschland. Ersatz: OpenStreetMap.
     Mit CONFIG.karte.carto (kostenloser Schlüssel von carto.com) zuerst der Stil „Voyager“, nachts „Dark Matter“.
     Lädt ein Anbieter nicht, nimmt die App den nächsten, zuletzt die vereinfachte Zeichnung. */
  const OSM_QUELLE = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende';
  const kacheln = { el: null, quellen: [], nr: 0, z: null, vorZ: null, ref: null, bilder: new Map(), ok: 0, fehler: 0, aus: false, ruhe: 0 };
  function kachelQuellen() {
    const q = [];
    const carto = CONFIG.karte && CONFIG.karte.carto;
    if (carto) q.push({ url: 'https://basemaps.cartocdn.com/rastertiles/{stil}/{z}/{x}/{y}{r}.png?key=' + encodeURIComponent(carto), max: 20, retina: true, carto: true,
      quelle: OSM_QUELLE + ' © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' });
    q.push({ url: 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', min: 5, max: 18,
      quelle: `© <a href="https://www.bkg.bund.de" target="_blank" rel="noopener">GeoBasis-DE / BKG</a> (${new Date().getFullYear()}) <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a><span class="k-veraendert">, Farben angepasst</span>` });
    q.push({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, quelle: OSM_QUELLE + '<span class="k-veraendert">, Farben angepasst</span>' });
    q.push({ url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', max: 18, quelle: OSM_QUELLE + ', openstreetmap.de<span class="k-veraendert">, Farben angepasst</span>' });
    return q;
  }
  function kachelUrl(q, z, x, y) {
    return q.url.replace('{stil}', dunklesThema() ? 'dark_all' : 'voyager').replace('{z}', z).replace('{x}', x).replace('{y}', y)
      .replace('{r}', q.retina && (window.devicePixelRatio || 1) > 1.4 ? '@2x' : '');
  }
  function kachelWeg(t, key) {
    t.img.onload = t.img.onerror = null;
    if (t.img.parentNode) t.img.parentNode.removeChild(t.img);
    kacheln.bilder.delete(key);
  }
  function kachelnLeeren() {
    kacheln.bilder.forEach((t, key) => kachelWeg(t, key));
    kacheln.z = null; kacheln.vorZ = null; kacheln.ref = null;
    if (kacheln.el) kacheln.el.style.transform = '';
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
    h.classList.toggle('k-filter', !q.carto);
    $('.k-quelle').innerHTML = q.quelle;
    $('#karte-hinweis').hidden = true;
    if (warAus) renderKarte();
  }
  function kachelnAus() {
    const kc = kacheln;
    kachelnLeeren();
    kc.aus = true;
    kartenStatus.huelle.classList.add('ohne-kacheln');
    kartenStatus.huelle.classList.remove('k-filter');
    $('.k-quelle').textContent = 'Vereinfacht · Lage: © OpenStreetMap-Mitwirkende, GeoNames';
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
  function neueKachel(z, x, y, key) {
    const kc = kacheln;
    const img = document.createElement('img');
    img.className = 'k-kachel';
    img.alt = '';
    img.draggable = false;
    img.setAttribute('decoding', 'async');
    const t = { img, z, x, y, fertig: false, fehler: false };
    img.onload = () => { t.fertig = true; img.className = 'k-kachel da'; kc.ok++; altesWeg(); };
    img.onerror = () => { t.fehler = true; kachelFehler(); if (!kc.aus) altesWeg(); };
    kc.bilder.set(key, t);
    kc.el.appendChild(img);
    img.src = kachelUrl(kc.quellen[kc.nr], z, x, y);
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
    kc.el.style.transform = '';
    const brauche = {};
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) {
      const key = r.z + '/' + x + '/' + y;
      brauche[key] = true;
      if (!kc.bilder.has(key)) neueKachel(r.z, x, y, key);
    }
    if (kc.aus) return; // alle Anbieter sind gescheitert
    kc.bilder.forEach((t, key) => {
      if (brauche[key]) return;
      if (t.z === kc.z || t.z !== kc.vorZ || !t.fertig) { kachelWeg(t, key); return; }
      // Ältere Stufe: nur behalten, solange sie im Bild liegt
      const T = WELT / Math.pow(2, t.z);
      const l = (t.x * T - r.ox) * b.s + b.x, o = (t.y * T - r.oy) * b.s + b.y;
      if (l > k.w || o > k.h || l + T * b.s < 0 || o + T * b.s < 0) kachelWeg(t, key);
    });
    kc.bilder.forEach((t) => {
      const T = WELT / Math.pow(2, t.z);
      const l = Math.round((t.x * T - r.ox) * b.s + b.x), rr = Math.round(((t.x + 1) * T - r.ox) * b.s + b.x);
      const o = Math.round((t.y * T - r.oy) * b.s + b.y), u = Math.round(((t.y + 1) * T - r.oy) * b.s + b.y);
      t.img.style.cssText = `left:${l}px;top:${o}px;width:${rr - l}px;height:${u - o}px;z-index:${t.z === kc.z ? 2 : 1}`;
    });
    altesWeg();
  }
  // Pro Bild der Bewegung nur die ganze Schicht verschieben und skalieren. Neu gelegt wird erst,
  // wenn Bilder fehlen oder die Bewegung kurz ruht (dann wieder gestochen scharf).
  function zeichneKacheln(b) {
    const kc = kacheln, k = kartenStatus;
    if (kc.aus || !kc.el || !kc.quellen.length || ui.view !== 'karte') return;
    // Beim Zoomen über mehrere Stufen erst am Ende neue Bilder holen (schont Datenvolumen und Kartenserver),
    // beim Verschieben fehlende Ränder sofort nachladen
    let neu = !kc.ref, andereStufe = false;
    if (!neu) {
      const r = kachelBereich(b, kachelZoom(b.s));
      andereStufe = r.z !== kc.z;
      for (let x = r.x0; x <= r.x1 && !neu && !andereStufe; x++) for (let y = r.y0; y <= r.y1 && !neu; y++) if (!kc.bilder.has(r.z + '/' + x + '/' + y)) neu = true;
    }
    clearTimeout(kc.ruhe);
    if (neu) { kachelnLegen(b); return; }
    const f = b.s / kc.ref.s;
    kc.el.style.transform = f === 1 ? `translate(${b.x - kc.ref.x}px, ${b.y - kc.ref.y}px)` : `translate(${b.x - kc.ref.x * f}px, ${b.y - kc.ref.y * f}px) scale(${f})`;
    if (f !== 1 || andereStufe) kc.ruhe = setTimeout(() => { if (k.blick) kachelnLegen(k.blick); }, andereStufe ? 160 : 220);
  }
  // Nachts andere Bilder (CARTO) bzw. umgefärbte Bilder (basemap.de, OpenStreetMap, per CSS)
  function kachelnThema() {
    const kc = kacheln;
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
    if (!kacheln.aus || !kartenStatus.huelle || VORSCHAU) return;
    kacheln.quellen = kachelQuellen();
    kachelQuelleSetzen(0);
    if (kartenStatus.blick) kachelnLegen(kartenStatus.blick);
  });

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
    const u = umgebung, box = u.el.querySelector('.u-kacheln'), q = u.aus ? null : u.quellen[u.nr];
    u.el.classList.toggle('u-ohne', !q);
    u.el.classList.toggle('k-filter', !!q && !q.carto);
    const quelle = u.el.querySelector('.u-quelle');
    if (!q) {
      box.textContent = '';
      quelle.textContent = VORSCHAU ? 'Straßenkarte in der App' : 'Straßenkarte gerade nicht erreichbar';
      return;
    }
    quelle.innerHTML = q.quelle;
    const n = Math.pow(2, b.z), T = WELT / n, ox = NULLPUNKT.x + WELT / 2, oy = NULLPUNKT.y + WELT / 2;
    const fest = (v) => Math.max(0, Math.min(n - 1, Math.floor(v / T)));
    const x0 = fest(ox - b.x / b.s), x1 = fest(ox + (u.w - b.x) / b.s), y0 = fest(oy - b.y / b.s), y1 = fest(oy + (u.h - b.y) / b.s);
    // Bilder, die schon da sind, bleiben liegen (kein Flackern beim Tippen in der Suche)
    const da = {};
    [].slice.call(box.children).forEach((img) => { da[img.dataset.k] = img; });
    const brauche = {};
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = b.z + '/' + x + '/' + y;
      brauche[key] = true;
      let img = da[key];
      if (!img) {
        img = document.createElement('img');
        img.className = 'k-kachel'; img.alt = ''; img.draggable = false; img.dataset.k = key;
        img.setAttribute('decoding', 'async');
        img.onload = () => { img.className = 'k-kachel da'; u.ok++; };
        img.onerror = () => {
          u.fehler++;
          if (u.ok || u.fehler < 3) return;
          // Dieser Anbieter lädt nicht: nächster, zuletzt ohne Kartenbilder
          if (u.nr + 1 < u.quellen.length) u.nr++; else u.aus = true;
          u.fehler = 0; u.schluessel = ''; box.textContent = '';
          umgebungZeichnen();
        };
        img.src = kachelUrl(q, b.z, x, y);
        box.appendChild(img);
      }
      img.style.cssText = `left:${Math.round((x * T - ox) * b.s + b.x)}px;top:${Math.round((y * T - oy) * b.s + b.y)}px;width:256px;height:256px`;
    }
    Object.keys(da).forEach((key) => { if (!brauche[key]) box.removeChild(da[key]); });
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
    const schluessel = [b.z, b.x, b.y, w, h, u.nr, u.aus, dunklesThema()].join('|');
    if (schluessel !== u.schluessel) { u.schluessel = schluessel; umgebungKacheln(b); }
    // Schilder wie auf der großen Karte; wo sie sich berühren würden, steht eine Zahl
    const gruppen = [];
    liste.forEach((g) => {
      const m = inMeter(g.lat, g.lng), x = m.x * b.s + b.x, y = m.y * b.s + b.y;
      if (x < 22 || x > w - 22 || y < 44 || y > h - 30) return;
      const ziel = gruppen.find((gr) => Math.abs(gr.x - x) < 56 && Math.abs(gr.y - y) < 42);
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
    if (zeigeIch()) html += an(w / 2, h / 2, '<span class="k-ich" aria-hidden="true"><i></i><b>Du</b></span>', 'k-mein-anker');
    gruppen.forEach((gr, i) => {
      if (gr.liste.length > 1) {
        const ab = Math.min(...gr.liste.map((g) => g.betrag));
        html += an(gr.x, gr.y, `<button type="button" class="k-sammel" data-u-sammel="${i}" aria-label="${gr.liste.length} Anfragen hier, ab ${euroKurz(ab)}. Auf der großen Karte ansehen">${gr.liste.length}</button>`);
        return;
      }
      const g = gr.liste[0];
      const label = esc(`${g.titel}, ${euro(g.betrag)}, ${wannText(g)}, ${g.stadtteil}, ${distanz(g)}`);
      html += an(gr.x, gr.y, `<button type="button" class="k-pin" data-oeffne="${esc(g.id)}" aria-label="${label}"><span class="pin${g.helfer === 'ich' ? ' pin-zugesagt' : ''}">${g.helfer === 'ich' ? icon('check', 'i-xs') : ''}${euroKurz(g.betrag)}</span></button>`);
    });
    u.el.querySelector('.u-schicht').innerHTML = html;
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
    huelle.textContent = '';
    huelle.appendChild(bilder); huelle.appendChild(svg); huelle.appendChild(schicht); huelle.appendChild(massstab);
    Object.assign(k, { svg, welt, schicht, massstab, sockel });
    kacheln.el = bilder;
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
    // Deutschland darf nicht ganz aus dem Bild rutschen
    const x = Math.min(k.w * 0.6 - g.x0 * s, Math.max(k.w * 0.4 - g.x1 * s, b.x));
    const y = Math.min(k.h * 0.6 - g.y0 * s, Math.max(k.h * 0.4 - g.y1 * s, b.y));
    return { s, x, y };
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

  function zeichneBlick() {
    const k = kartenStatus, b = k.blick;
    if (!k.svg || !b) return;
    k.welt.setAttribute('transform', `matrix(${b.s} 0 0 ${b.s} ${b.x} ${b.y})`);
    // Die Platten sind immer gleich dick, egal wie nah man herangeht
    k.sockel.setAttribute('transform', `translate(0 ${(KARTE.sockel / b.s).toFixed(1)})`);
    // Bei jeder halben Zoomstufe neu sortieren, welche Schilder zusammengefasst werden
    if (zoomStufe(b.s) !== k.stufe) { renderKarte(true); return; }
    zeichneKacheln(b);
    k.elemente.forEach((e) => {
      const x = Math.round(e.m.x * b.s + b.x), y = Math.round(e.m.y * b.s + b.y);
      // Was weit außerhalb liegt, wird nicht gezeichnet und ist auch mit der Tastatur nicht erreichbar
      const drin = x > -80 && x < k.w + 80 && y > -60 && y < k.h + 80;
      if (drin !== e.drin) { e.drin = drin; e.el.style.visibility = drin ? '' : 'hidden'; }
      if (drin) e.el.style.transform = `translate(${x}px, ${y}px)`;
    });
    // Maßstab: eine runde Strecke zwischen 50 und 125 Bildpunkten (in echten Metern)
    const strecken = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
    const pxJeMeter = b.s * dehnung(breiteVon((k.h / 2 - b.y) / b.s));
    const m = strecken.find((x) => x * pxJeMeter >= 50) || 200000;
    k.massstab.style.width = Math.round(m * pxJeMeter) + 'px';
    k.massstab.textContent = m >= 1000 ? `${m / 1000} km` : `${m} m`;
    clearTimeout(k.ruhig);
    k.ruhig = setTimeout(namenAufraeumen, 120);
    clearTimeout(k.nachladen);
    if (istLive() && db.client) k.nachladen = setTimeout(ausschnittLaden, 700);
  }

  const zoomStufe = (s) => Math.round(Math.log(s) / Math.LN2 * 2);

  function blickSetzen(ziel, sanft) {
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
      const mv = { x: (k.w / 2 - von.x) / von.s, y: (k.h / 2 - von.y) / von.s }, mz = { x: (k.w / 2 - ziel.x) / ziel.s, y: (k.h / 2 - ziel.y) / ziel.s };
      k.blick = blickAuf({ x: mv.x + (mz.x - mv.x) * e, y: mv.y + (mz.y - mv.y) * e }, s);
      zeichneBlick();
      if (f < 1) k.animation = requestAnimationFrame(schritt); else k.ziel = null;
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
    blickSetzen({ s, x: px - (px - b.x) * s / b.s, y: py - (py - b.y) * s / b.s }, sanft);
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
    const ort = (e) => { const r = h.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const runter = (id, p, ziel) => {
      cancelAnimationFrame(k.animation); k.ziel = null;
      finger.set(id, p);
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
        zeichneBlick();
        return true;
      }
      const dx = p.x - start.p.x, dy = p.y - start.p.y;
      start.weg = Math.max(start.weg, Math.hypot(dx, dy));
      if (start.weg < 7) return false;
      k.bewegt = true;
      k.huelle.classList.add('ist-gezogen');
      k.blick = blickBegrenzen({ s: start.blick.s, x: start.blick.x + dx, y: start.blick.y + dy });
      zeichneBlick();
      return true;
    };
    const hoch = (id, p, ziel) => {
      if (!finger.has(id)) return;
      finger.delete(id);
      k.huelle.classList.remove('ist-gezogen');
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
      h.addEventListener('pointercancel', (e) => { finger.delete(e.pointerId); start = null; h.classList.remove('ist-gezogen'); });
    } else {
      // Ältere iPhones (vor iOS 13) kennen keine Pointer-Events
      const jedes = (e, fn) => { for (let i = 0; i < e.changedTouches.length; i++) { const t = e.changedTouches[i]; fn(t.identifier, ort(t), e.target); } };
      h.addEventListener('touchstart', (e) => jedes(e, runter), { passive: true });
      h.addEventListener('touchmove', (e) => { let b = false; jedes(e, (id, p) => { b = bewegen(id, p) || b; }); if (b && e.cancelable) e.preventDefault(); }, { passive: false });
      h.addEventListener('touchend', (e) => jedes(e, hoch));
      h.addEventListener('touchcancel', () => { finger.clear(); start = null; });
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
      zoomen(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.006), p.x, p.y, false);
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
    const fest = [...document.querySelectorAll('.karte-knoepfe, .k-quelle, #map .k-massstab')].map((el) => el.getBoundingClientRect());
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
      // Preisschilder sind breiter als hoch: berühren sich, wenn sie weniger als 56 × 42 Bildpunkte auseinander liegen
      const ziel = g.id === hervor || !zusammen ? null : gruppen.find((gr) => !gr.fest && Math.abs(gr.m.x - m.x) * s < 56 && Math.abs(gr.m.y - m.y) * s < 42);
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
    gruppen.forEach((gr, i) => {
      if (gr.liste.length > 1) {
        const ab = Math.min(...gr.liste.map((g) => g.betrag));
        const orte = [...new Set(gr.liste.map((g) => g.stadtteil))];
        const eigene = gr.liste.some((g) => g.eigen || g.helfer === 'ich');
        const label = `${gr.liste.length} Anfragen in ${orte.length > 2 ? orte.slice(0, 2).join(', ') + ' und Umgebung' : orte.join(' und ')}, ab ${euroKurz(ab)}. Hineinzoomen`;
        anker(gr.m, `<button type="button" class="k-sammel${eigene ? ' k-sammel-eigen' : ''}" data-sammel="${i}" aria-label="${esc(label)}">${gr.liste.length}</button>`);
        return;
      }
      const g = gr.liste[0];
      const cls = [g.eigen ? 'pin-eigen' : '', abgelaufen(g) ? 'pin-abgelaufen' : '', g.helfer === 'ich' ? 'pin-zugesagt' : '', g.id === hervor ? 'is-aktiv' : ''].join(' ');
      anker(gr.m, `<button type="button" class="k-pin" data-oeffne="${esc(g.id)}" aria-label="${text(g)}"><span class="pin ${cls}">${g.helfer === 'ich' ? icon('check', 'i-xs') : ''}${euroKurz(g.betrag)}</span></button>`, g.id === hervor ? 'k-oben' : '', g.id);
    });
    const b = k.blick;
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
      const bewertung = g.bewertungen
        ? `${icon('stern', 'i-xs i-fill')}${g.sterne.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${g.bewertungen} ${g.bewertungen === 1 ? 'Bewertung' : 'Bewertungen'}`
        : 'Neu bei Hand Drauf';
      html += `<button type="button" class="person person-knopf" data-profil aria-label="Profil von ${esc(g.wer)} ansehen">
        <span class="avatar" aria-hidden="true">${esc(g.initialen)}</span>
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

    const sterneHTML = (b, wen) => `<div class="bewerten"><span><strong>${b ? 'Danke für deine Bewertung.' : `Wie war es mit ${esc(wen)}?`}</strong></span>
      <div class="sterne" role="group" aria-label="Bewertung">${[1, 2, 3, 4, 5].map((n) =>
        `<button type="button" class="stern ${n <= b ? 'is-an' : ''}" data-stern="${n}" aria-label="${n} ${n === 1 ? 'Stern' : 'Sterne'}" aria-pressed="${n <= b}" ${dis}>${icon('stern')}</button>`
      ).join('')}</div></div>`;

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
        html += `<div class="status-box good">${icon('check')}${esc(g.helferName || 'Jemand')} hilft dir</div>${codeHTML}`;
      } else if (g.status === 'erledigt') {
        html += `<div class="status-box warn">${esc(hn)} hat den Job als erledigt gemeldet.</div>
          <button type="button" class="btn btn-primary" data-aktion="bestaetigen" ${dis}>Erledigt bestätigen</button>`;
      } else if (g.status === 'bezahlt') {
        html += `<div class="status-box good">${icon('check')}Abgeschlossen</div>` + (g.helferName ? sterneHTML(g.meineBewertung || 0, hn) : '');
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
        <span class="avatar" aria-hidden="true">${esc(kuerzel(p))}</span>
        <div>
          <h2 id="sheet-titel">${esc(anzeigename(p))}</h2>
          <div class="person-meta">${bewertung}</div>
        </div>
      </div>
      <p class="klein">Angemeldet als ${esc(db.user && db.user.email)}. Andere sehen nur deinen Vornamen, den Anfangsbuchstaben und deinen Ort.</p>
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

  // Öffentliches Profil (Vorbild: BlaBlaCar D.R.E.A.M.S. und Airbnb): Angaben, Bewertungen, Aktivität
  const DEMO_DABEI = ['Januar 2025', 'März 2025', 'Mai 2025', 'August 2025', 'Oktober 2025', 'Februar 2026'];
  function profilDaten(g) {
    if (!istLive()) {
      const n = Number(String(g.id).replace(/\D/g, '')) || 0;
      return { name: g.wer, kuerzel: g.initialen, stadtteil: g.stadtteil, dabei: DEMO_DABEI[n % DEMO_DABEI.length],
        sterne: g.sterne, bewertungen: g.bewertungen || 0, hilfen: Math.max(0, (g.bewertungen || 0) - 3 - (n % 4)), gesuche: Math.min(g.bewertungen || 0, 3 + (n % 5)), volljaehrig: true };
    }
    const id = g.eigen ? g.helferId : g.erstellerId;
    if (!id) return null;
    if (!db.profile.has(id)) {
      db.profile.set(id, null);
      db.client.from('profile').select('vorname, nachname_initial, stadtteil, volljaehrig, sterne_summe, sterne_anzahl, hilfen_anzahl, gesuche_anzahl, erstellt').eq('id', id).maybeSingle()
        .then(({ data }) => { db.profile.set(id, data || false); if (ui.panel === 'profil') renderSheet(); });
    }
    const p = db.profile.get(id);
    if (!p) return p;
    const dabei = new Date(p.erstellt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return { name: anzeigename(p), kuerzel: kuerzel(p), stadtteil: p.stadtteil, dabei, sterne: p.sterne_anzahl ? p.sterne_summe / p.sterne_anzahl : null,
      bewertungen: p.sterne_anzahl, hilfen: p.hilfen_anzahl || 0, gesuche: p.gesuche_anzahl || 0, volljaehrig: p.volljaehrig };
  }
  // Die andere Person einer Anfrage: live über die Profil-ID, in der Demo über den Namen
  function anderePerson(g) {
    if (!g) return null;
    const name = g.eigen ? g.helferName : g.wer;
    const id = istLive() ? (g.eigen ? g.helferId : g.erstellerId) : name;
    return id && name ? { id, name } : null;
  }
  function blockierenHTML(g) {
    const person = anderePerson(g);
    if (!person) return '';
    const vn = esc(vorname(person.name));
    if (!ui.blockieren) return `<button type="button" class="link-btn link-melden" data-blockieren-frage>${icon('x', 'i-sm')}${vn} blockieren</button>`;
    return `<div class="bestaetigen-box"><p><strong>${vn} blockieren?</strong> Ihr seht eure Anfragen gegenseitig nicht mehr, und laufende Zusagen zwischen euch enden. ${vn} erfährt davon nichts. Unter „${istLive() ? 'Konto' : 'Menü'}“ kannst du das jederzeit aufheben.</p>
        <div class="btn-row"><button type="button" class="btn btn-danger-solid" data-blockieren ${ui.busy ? 'disabled aria-busy="true"' : ''}>Blockieren</button>
        <button type="button" class="btn btn-secondary" data-blockieren-nein>Abbrechen</button></div></div>`;
  }
  function sheetProfilHTML() {
    const g = gesuche.find((x) => x.id === ui.profilGesuch);
    const kopf = `<div class="sheet-top">
        <button type="button" class="link-btn zurueck" data-zurueck-gesuch><span class="zurueck-pfeil" aria-hidden="true">‹</span>Zurück zur Anfrage</button>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>`;
    const p = g && profilDaten(g);
    if (!p) return kopf + `<h2 id="sheet-titel">${p === null ? 'Profil wird geladen …' : 'Profil nicht verfügbar'}</h2>`;
    const stern = p.bewertungen ? p.sterne.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
    return kopf + `<div class="profil-kopf">
        <span class="avatar avatar-gross" aria-hidden="true">${esc(p.kuerzel)}</span>
        <div><h2 id="sheet-titel">${esc(p.name)}</h2><p class="person-meta">${esc(p.stadtteil)} · dabei seit ${esc(p.dabei)}</p></div>
      </div>
      <dl class="profil-zahlen">
        <div><dt>Bewertung</dt><dd>${p.bewertungen ? icon('stern', 'i-sm i-fill') : ''}${stern}</dd><dd class="klein">${p.bewertungen} ${p.bewertungen === 1 ? 'Bewertung' : 'Bewertungen'}</dd></div>
        <div><dt>Geholfen</dt><dd>${p.hilfen}</dd><dd class="klein">${p.hilfen === 1 ? 'Auftrag' : 'Aufträge'}</dd></div>
        <div><dt>Hilfe bekommen</dt><dd>${p.gesuche}</dd><dd class="klein">${p.gesuche === 1 ? 'Auftrag' : 'Aufträge'}</dd></div>
      </dl>
      <ul class="profil-belege">
        ${p.volljaehrig ? `<li>${icon('check', 'i-sm')}Mindestens 18 Jahre, bei der Anmeldung bestätigt</li>` : ''}
        <li>${icon('check', 'i-sm')}Konto mit E-Mail-Adresse</li>
        <li>${icon('check', 'i-sm')}Hat den Regeln für Nachbarn zugestimmt</li>
      </ul>
      <p class="klein">Andere sehen nur Vorname, Anfangsbuchstabe und Ort. Adresse und E-Mail sieht niemand.</p>
      ${blockierenHTML(g)}`;
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
    if (t.hasAttribute('data-zurueck-gesuch')) { const id = ui.profilGesuch; ui.profilGesuch = null; oeffnen(id); return; }
    if (t.hasAttribute('data-profil')) {
      const id = ui.offen;
      const zuletzt = ui.zuletzt;
      oeffnePanel('profil');
      ui.profilGesuch = id;
      ui.zuletzt = zuletzt;
      renderSheet();
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
      const person = anderePerson(gesuche.find((x) => x.id === ui.profilGesuch));
      if (!person) return;
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
    if (!a && !t.dataset.stern) return;
    if (istLive() && !db.profil) {
      oeffnePanel('anmelden', a === 'zusagen' ? 'Melde dich an, um zu helfen. Danach kannst du direkt zusagen.' : 'Bitte melde dich an.');
      return;
    }

    ui.busy = true;
    renderSheet();
    try {
      if (t.dataset.stern) {
        await bewerte(g, Number(t.dataset.stern));
        meldung('Bewertung gespeichert');
      } else {
        await aendereStatus(g, a);
        if (a === 'bestaetigen') {
          ladeStatistik();
          feiern('Hand drauf!', feierText(gesuche.find((x) => x.id === g.id) || g));
        } else meldung(ERFOLG[a](g));
        if (a === 'rueckzug') { ui.busy = false; schliessen(); renderAlles(); return; }
      }
    } catch (err) {
      meldung(fehlerText(err));
    } finally {
      ui.busy = false;
    }
    renderAlles();
    if (ui.offen) renderSheet();
    const fokus = t.dataset.stern ? `#sheet [data-stern="${t.dataset.stern}"]` : '#sheet .btn';
    const f = $(fokus);
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
    if (e.target.id !== 'chat-text') return;
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  });

  $('#sheet').addEventListener('submit', async (e) => {
    if (e.target.id === 'chat-form') { e.preventDefault(); chatAbsenden(); return; }
    if (e.target.id === 'melden-form') { e.preventDefault(); meldungAbsenden(); return; }
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
    const st = istLive() ? db.statistik : { woche: 12 + fertig, gesamt: 148 + fertig };
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
  gesuche = demoLaden();
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
  starteLive().then((live) => {
    if (!live) { if (linkId(start)) gesuchAusLink(linkId(start)); return; }
    renderStadtteilAuswahl();
    renderKosten();
    ladeStatistik();
  });
})();
