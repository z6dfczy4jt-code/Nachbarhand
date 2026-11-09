(() => {
  'use strict';

  /* ===== Betriebsart ===== */
  // Wird beim Bauen für die Claude-Vorschau auf true gesetzt: Dort ist keine Datenbank erreichbar, also immer Demo.
  const VORSCHAU = false;
  // Läuft die App als iPhone-App (Capacitor)? Dann liegt sie lokal auf dem Gerät, Links zeigen auf die Website.
  const NATIV = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const OEFFENTLICH = 'https://z6dfczy4jt-code.github.io/Nachbarhand/';
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
  const LIVE = {
    url: 'https://hgfwbjesolgneyapehta.supabase.co',
    key: 'sb_publishable_aHSISOj3lPHJwpWqa64gnA_iLcJV1w3'
  };
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/dist/umd/supabase.js';

  /* ===== Einstellungen: Gebühren, Regeln und Karte hier anpassen ===== */
  const CONFIG = {
    gebuehren: false,          // Weg 2 (Bezahlung über die App mit Gebühren). Erst einschalten, wenn Stripe eingerichtet ist
    gebuehrAuftraggeber: 0.99, // Weg 2: fester Betrag, den die suchende Person zusätzlich zahlt
    provisionHelfer: 0.05,     // Weg 2: Anteil, der vom Betrag des Helfers abgeht
    minBetrag: 5,
    maxBetrag: 50,             // Obergrenze für Nachbarschaftshilfe
    freigrenze: 255,           // § 22 Nr. 3 EStG: unter 256 € Gewinn im Jahr steuerfrei
    bereichMeter: 250,         // Radius des ungefähren Bereichs um eine Anfrage
    ich: { name: 'Tim', initialen: 'TS', stadtteil: 'Garbsen-Mitte', lat: 52.4248, lng: 9.5962 }, // Demo-Person
    // Betreiber für Impressum und Datenschutz. Vor dem öffentlichen Start ausfüllen.
    betreiber: { name: '', anschrift: '', email: '', telefon: '' }
  };

  const KARTE = {
    // Kartenkacheln ohne API-Key. Lädt ein Anbieter nicht, nimmt die App automatisch den nächsten.
    // OpenStreetMap erlaubt das für kleine Projekte mit Namensnennung; bei vielen Nutzern auf einen eigenen Anbieter wechseln.
    anbieter: [
      { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxNativeZoom: 19,
        quelle: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende' },
      { name: 'OpenStreetMap Deutschland', url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', maxNativeZoom: 18,
        quelle: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, <a href="https://www.openstreetmap.de">openstreetmap.de</a>' },
      { name: 'CARTO', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', maxNativeZoom: 20, subdomains: 'abcd',
        quelle: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende &copy; <a href="https://carto.com/attributions">CARTO</a>' }
    ],
    ortsQuelle: 'Orte: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, GeoNames',
    grenzen: [[52.33, 9.38], [52.55, 9.76]],      // so weit lässt sich die Karte verschieben
    minZoom: 11,
    maxZoom: 18
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
    { id: 'g6', kat: 'technik', titel: 'Drucker einrichten', wer: 'Gisela R.', initialen: 'GR', sterne: 4.9, bewertungen: 11, betrag: 12,
      stadtteil: 'Meyenfeld', lat: 52.4423, lng: 9.5698, wann: 'Diese Woche, flexibel', dauer: 'ca. 45 Min.',
      text: 'Der neue Drucker soll mit dem WLAN und meinem Laptop verbunden werden. Mit der Anleitung komme ich nicht klar.',
      adresse: 'Ortsmitte Meyenfeld', antwort: 'Vielen Dank! Das WLAN-Passwort klebt hinten am Router.', status: 'offen', erstellt: 8 },
    { id: 'g7', kat: 'tragen', titel: 'Kartons in den Keller tragen', wer: 'Marco B.', initialen: 'MB', sterne: 4.5, bewertungen: 4, betrag: 18,
      stadtteil: 'Stelingen', lat: 52.4506, lng: 9.6236, wann: 'Samstag, nachmittags', dauer: 'ca. 1 Std.',
      text: 'Etwa 15 Umzugskartons aus dem Flur in den Keller. Einige sind schwer, da sind Bücher drin.',
      adresse: 'Leinestraße, Stelingen', antwort: 'Klasse, danke! Der Keller ist offen.', status: 'offen', erstellt: 7 },
    { id: 'g8', kat: 'garten', titel: 'Hecke schneiden', wer: 'Ingrid P.', initialen: 'IP', sterne: 4.8, bewertungen: 17, betrag: 22,
      stadtteil: 'Horst', lat: 52.4420, lng: 9.5374, wann: 'Nächste Woche, vormittags', dauer: 'ca. 2 Std.',
      text: 'Ligusterhecke, etwa 15 m lang und 1,60 m hoch. Die elektrische Heckenschere ist da, der Schnitt kommt in die Biotonne.',
      adresse: 'Nähe Kirche, Horst', antwort: 'Wunderbar, danke! Die Heckenschere liegt in der Garage.', status: 'offen', erstellt: 6 },
    { id: 'g9', kat: 'einkaufen', titel: 'Einkauf aus Garbsen mitbringen', wer: 'Werner T.', initialen: 'WT', sterne: 5.0, bewertungen: 8, betrag: 7,
      stadtteil: 'Frielingen', lat: 52.4610, lng: 9.5361, wann: 'Donnerstag, vormittags', dauer: 'ca. 45 Min.',
      text: 'Ich komme gerade schlecht ins Zentrum. Eine kurze Liste vom Supermarkt, den Einkauf bezahle ich bei der Übergabe.',
      adresse: 'Schafbrink, Frielingen', antwort: 'Danke! Die Liste schicke ich dir gleich im Chat.', status: 'offen', erstellt: 5 },
    { id: 'g10', kat: 'tiere', titel: 'Katze füttern am Wochenende', wer: 'Sabine L.', initialen: 'SL', sterne: 4.9, bewertungen: 12, betrag: 12,
      stadtteil: 'Osterwald O.E.', lat: 52.4623, lng: 9.5926, wann: 'Samstag und Sonntag, abends', dauer: '2 × 15 Min.',
      text: 'Minka braucht abends Futter und frisches Wasser. Ich bin übers Wochenende bei meiner Schwester.',
      adresse: 'Neue Straße, Osterwald O.E.', antwort: 'Danke! Den Schlüssel bekommst du am Freitag von mir.', status: 'offen', erstellt: 4 },
    { id: 'g11', kat: 'technik', titel: 'Fahrradschlauch wechseln', wer: 'Paul D.', initialen: 'PD', sterne: 4.7, bewertungen: 5, betrag: 10,
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

  const SPEICHER = 'nachbarhand-prototyp-v2';
  const VIEWS = ['entdecken', 'karte', 'neu', 'auftraege'];
  const RECHT = RECHT_TEXTE(CONFIG.betreiber, (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
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
    laedt: false,
    fehler: null,
    bewertungen: new Map(), // gesuch_id -> meine Sterne
    adressen: new Map(),    // gesuch_id -> Adresse (nur für Beteiligte)
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
  const ui = { view: 'entdecken', kat: 'alle', stadtteil: 'alle', suche: '', sort: 'termin', offen: null, panel: null, authModus: 'anmelden', authGrund: '', authFertig: '', markiert: null, zentrieren: null, rueckzug: false, melden: false, loeschen: false, profilGesuch: null, zuletzt: null, busy: false, bearbeiten: null, blockieren: false };

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
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(r).getPropertyValue('--paper').trim() || '#F3F5F1';
  }
  function ansichtSetzen(k, w) {
    if (!ANSICHT_OPTIONEN[k] || !ANSICHT_OPTIONEN[k].some(([x]) => x === w)) return;
    ansicht[k] = w;
    try { localStorage.setItem(ANSICHT_SPEICHER, JSON.stringify(ansicht)); } catch (e) { /* nur für diese Sitzung */ }
    ansichtAnwenden();
  }
  ansichtAnwenden();

  // Stadtteil aus der Begrüßung (nur auf diesem Gerät). Angemeldet zählt der Stadtteil im Profil.
  const START_SPEICHER = 'handdrauf-start-gesehen';
  const ORT_SPEICHER = 'handdrauf-stadtteil';
  let gewaehlterOrt = null;
  try { const o = localStorage.getItem(ORT_SPEICHER); if (STADTTEILE.some((x) => x.name === o)) gewaehlterOrt = o; } catch (e) { /* ohne Speicher */ }
  function ortWaehlen(name) {
    if (!STADTTEILE.some((x) => x.name === name)) return;
    gewaehlterOrt = name;
    try { localStorage.setItem(ORT_SPEICHER, name); } catch (e) { /* nur für diese Sitzung */ }
  }

  /* ===== Hilfsfunktionen ===== */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const euroKurz = (n) => Number.isInteger(n) ? `${n} €` : euro(n);
  const katName = (id) => (KATEGORIEN.find((k) => k.id === id) || {}).name || '';
  const icon = (id, cls = '') => KAT_SYMBOLE[id]
    ? `<svg class="i ks ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${KAT_SYMBOLE[id]}</svg>`
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
  // Wo bin ich? Demo: Tim in Garbsen-Mitte. Live: Mitte des Stadtteils aus dem Profil.
  function ortVon(name) {
    const s = STADTTEILE.find((x) => x.name === name) || STADTTEILE[0];
    return { lat: s.lat, lng: s.lng, stadtteil: s.name };
  }
  function meinOrt() {
    if (!istLive()) return gewaehlterOrt && gewaehlterOrt !== CONFIG.ich.stadtteil ? ortVon(gewaehlterOrt) : CONFIG.ich;
    return ortVon((db.profil && db.profil.stadtteil) || gewaehlterOrt || 'Garbsen-Mitte');
  }
  const zeigeIch = () => !istLive() || !!db.profil || !!gewaehlterOrt;
  const meterVonMir = (g) => abstand(meinOrt(), g);
  function distanz(g) {
    if (g.eigen) return 'bei dir';
    const m = meterVonMir(g);
    if (m < 1000) return Math.max(100, Math.round(m / 50) * 50) + '\u00a0m';
    return (m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0km';
  }
  /* ===== Termine: „Morgen“ wird beim Speichern zum echten Datum ===== */
  const WOCHENTAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  const TAG_MS = 86400000;
  const MAX_TAGE = 21; // spätestens dann läuft eine offene Anfrage ab
  const TAG_WAHL = ['Heute', 'Morgen', 'Dieses Wochenende', 'Nächste Woche'];
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
  // Was gespeichert wird: lesbarer Text mit Datum und der letzte passende Tag
  function terminSpeichern(tag, zeit) {
    const z = zeitraum(tag) || zeitraum('Morgen');
    return { wann: `${z.text}, ${ZEIT_TEXT[zeit] || ZEIT_TEXT.flexibel}`, bis: isoTag(z.bis) };
  }
  // Liest den Termin aus dem Wann-Text: „Di. 10. Nov., nachmittags“, „Sa./So. 14./15. Nov.“, „Woche 16.–22. Nov.“,
  // ältere Texte wie „Samstag, vormittags“ oder „Morgen, ab 16 Uhr“. Ergebnis: erster und letzter Tag, Uhrzeit-Fenster.
  const MONAT_INDEX = { 'Jan.': 0, 'Feb.': 1, 'März': 2, 'Apr.': 3, 'Mai': 4, 'Juni': 5, 'Juli': 6, 'Aug.': 7, 'Sept.': 8, 'Okt.': 9, 'Nov.': 10, 'Dez.': 11 };
  const TAGNAMEN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function datumIm(monat, tag) {
    const h = heute();
    const d = new Date(h.getFullYear(), monat, tag);
    return d < plusTage(h, -180) ? new Date(h.getFullYear() + 1, monat, tag) : d; // Jahreswechsel
  }
  function terminAusText(wann) {
    if (!wann) return null;
    const i = wann.lastIndexOf(', ');
    const datum = (i > 0 ? wann.slice(0, i) : wann).trim();
    const zeit = i > 0 ? wann.slice(i + 2) : '';
    let von = null, bis = null, genau = false;
    const tage = [...datum.matchAll(/(\d{1,2})\.(?:\s(Jan\.|Feb\.|März|Apr\.|Mai|Juni|Juli|Aug\.|Sept\.|Okt\.|Nov\.|Dez\.))?/g)]
      .map((m) => [Number(m[1]), m[2] ? MONAT_INDEX[m[2]] : null]);
    if (tage.some((t) => t[1] !== null)) {
      for (let k = tage.length - 2; k >= 0; k--) if (tage[k][1] === null) tage[k][1] = tage[k + 1][1];
      for (let k = 1; k < tage.length; k++) if (tage[k][1] === null) tage[k][1] = tage[k - 1][1];
      von = datumIm(tage[0][1], tage[0][0]);
      bis = datumIm(tage.at(-1)[1], tage.at(-1)[0]);
      if (bis < von) bis = new Date(bis.getFullYear() + 1, bis.getMonth(), bis.getDate());
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
    if (spanne) { start = [+spanne[1], +(spanne[2] || 0)]; ende = [+spanne[3], +(spanne[4] || 0)]; }
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
  const demoAblauf = (bis) => Math.min(Date.now() + MAX_TAGE * TAG_MS, +plusTage(ausIso(bis), 1));

  /* ===== Anstößige Wörter (App Store 1.2). Dieselbe Liste prüft die Datenbank in privat.anstoessig. ===== */
  const ANSTOESSIG = new RegExp('(?<![a-zäöüß])(hure|fotze|wichser|arschloch|spast(i|en)?(?![a-zäöüß])|mongo(?![a-zäöüß])|nutte|(ge)?fick(en|t|st|e|er|te|ten)?(?![a-zäöüß])|bitch|kanake|neger|nigger|schwuchtel|vergewaltig)' +
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
    if (g.status === 'bezahlt') return `<span class="pill pill-good">${icon('check', 'i-xs')} ${istLive() ? 'Bestätigt' : 'Ausgezahlt'}</span>`;
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
    db.nachrichten.clear();
    db.letzte.clear();
    db.gemeldet.clear();
    db.blockiert.clear();
    if (uid) {
      const { data } = await db.client.from('profile').select('*').eq('id', uid).maybeSingle();
      db.profil = data || null;
    }
    if (ui.panel === 'anmelden' && db.profil) {
      schliessen();
      meldung(`Willkommen, ${db.profil.vorname}!`);
    }
    renderStadtteilAuswahl();
    renderKosten();
    await neuLaden();
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

  async function neuLaden() {
    if (!istLive()) return;
    db.laedt = true;
    try {
      const { data, error } = await db.client.from('gesuche').select(GESUCH_FELDER)
        .neq('status', 'zurueckgezogen').order('erstellt', { ascending: false }).limit(300);
      if (error) throw error;
      if (db.user) {
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
    const { data } = await db.client.from('gesuch_adressen').select('adresse').eq('gesuch_id', id).maybeSingle();
    db.adressen.set(id, data ? data.adresse : '');
    if (ui.offen === id) renderSheet();
  }
  const adresseVon = (g) => istLive() ? db.adressen.get(g.id) : g.adresse;

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
    gesuche.forEach((g) => { if (g.wer === name && g.helfer === 'ich' && g.status === 'zugesagt') { g.status = 'offen'; g.helfer = null; g.nachrichten = []; } });
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
    if (aktion === 'zusagen') { g.status = 'zugesagt'; g.helfer = 'ich'; g.nachrichten = []; if (g.antwort) demoNachricht(g.id, g.antwort, 1500); }
    else if (aktion === 'absagen') { g.status = 'offen'; g.helfer = null; g.nachrichten = []; }
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
      `<button type="button" class="chip" data-kat="${k.id}" aria-pressed="${ui.kat === k.id}">${k.id === 'alle' ? '' : icon(k.id, 'i-sm')}${k.name}</button>`
    ).join('');
  }
  function karteHTML(g, extra = '') {
    return `<button type="button" class="card" data-id="${g.id}">
      <span class="ico">${icon(g.kat)}</span>
      <span class="card-main">
        <span class="card-title">${esc(g.titel)}</span>
        <span class="card-ort">${icon('ort', 'i-xs')}${esc(g.stadtteil)} · ${distanz(g)}</span>
        <span class="card-meta">${esc(g.eigen ? 'Deine Anfrage' : g.wer)} · ${esc(wannText(g))}</span>
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

  function stadtteilOptionen(auswahl, mitAlle) {
    return (mitAlle ? `<option value="alle">Ganz Garbsen</option>` : '') +
      STADTTEIL_NAMEN.map((n) => `<option value="${esc(n)}" ${auswahl === n ? 'selected' : ''}>${esc(n)}</option>`).join('');
  }
  function renderStadtteilAuswahl() {
    $('#stadtteil').innerHTML = stadtteilOptionen(ui.stadtteil, true);
    $('#neu-stadtteil').innerHTML = stadtteilOptionen(meinOrt().stadtteil, false);
  }

  function renderListe() {
    const offene = gesuche.filter((g) => !g.eigen && g.status === 'offen' && !abgelaufen(g) && !versteckt(g));
    const ort = meinOrt();
    $('#h-entdecken').textContent = istLive() ? (db.profil ? `Hallo ${db.profil.vorname}` : 'Hilfe in Garbsen') : 'Hallo Tim';
    const anzahl = `${offene.length} ${offene.length === 1 ? 'Nachbar sucht' : 'Nachbarn suchen'} gerade Hilfe`;
    $('#anzahl-text').textContent = zeigeIch() ? `${ort.stadtteil}, Garbsen · ${anzahl}` : `Garbsen · ${anzahl}`;

    if (istLive() && !db.geladen) {
      $('#liste').innerHTML = db.fehler
        ? `<div class="leer"><p><strong>Die Anfragen konnten nicht geladen werden.</strong></p><p>${esc(db.fehler)}</p><button type="button" class="btn btn-secondary btn-auto" data-neu-laden>Erneut versuchen</button></div>`
        : `<p class="lade">Anfragen werden geladen …</p>`;
      return;
    }
    const treffer = sortiere(offene.filter((g) => passt(g) && (ui.stadtteil === 'alle' || g.stadtteil === ui.stadtteil)));
    if (!treffer.length) {
      const q = ui.suche.trim();
      const wo = ui.stadtteil === 'alle' ? '' : ` in ${esc(ui.stadtteil)}`;
      if (istLive() && !offene.length) {
        // Neue Plattform, noch leer: erklären, Anfang machen lassen, Beispiele zeigen (statt einer leeren Seite)
        const eigenesOffen = gesuche.some((g) => g.eigen && g.status === 'offen' && !abgelaufen(g));
        $('#liste').innerHTML = `<div class="leer leer-start">
          <p><strong>${eigenesOffen ? 'Deine Anfrage ist online.' : 'Hand Drauf startet gerade in Garbsen.'}</strong></p>
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
        <p>Probier eine andere Tätigkeit, Kategorie oder einen anderen Stadtteil. Oder such selbst Hilfe.</p>
        <button type="button" class="btn btn-secondary btn-auto" data-go="neu">Anfrage erstellen</button>
      </div>`;
      return;
    }
    if (ui.sort !== 'termin') { $('#liste').innerHTML = treffer.map((g) => karteHTML(g)).join(''); return; }
    // Nach Termin: Abschnitte Heute, Morgen, Diese Woche, Später, darin die nächsten zuerst
    const gruppen = new Map(TERMIN_GRUPPEN.map((n) => [n, []]));
    treffer.forEach((g) => gruppen.get(terminGruppe(g)).push(g));
    $('#liste').innerHTML = [...gruppen].filter(([, l]) => l.length).map(([name, l]) =>
      `<h2 class="liste-gruppe">${name}</h2>${l.sort((a, b) => (terminWert(a) - terminWert(b)) || (meterVonMir(a) - meterVonMir(b))).map((g) => karteHTML(g)).join('')}`).join('');
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
      else if (g.helfer === 'ich' && g.status === 'zugesagt') a = { prio: 3, titel: 'Du hilfst', text: `„${g.titel}“ bei ${wer}, ${wannText(g)}. Danach als erledigt melden.` };
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
      ? zusagen.map((g) => karteHTML(g, pills(g))).join('')
      : `<p class="leer-klein">Noch keine Zusagen.</p>`;
    $('#eigene').innerHTML = eigene.length
      ? eigene.map((g) => karteHTML(g, pills(g))).join('')
      : `<p class="leer-klein">Noch keine Anfragen.</p>`;
  }

  /* ===== Karte (Leaflet) ===== */
  const kartenStatus = { map: null, kacheln: null, anbieter: 0, pins: null, bereich: null, stadtteile: null, labels: null, vereinfacht: false, geladen: 0, fehler: 0, marker: new Map() };

  function dunklesThema() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function kachelSchicht(i) {
    const a = KARTE.anbieter[i];
    const s = window.L.tileLayer(a.url, { maxZoom: KARTE.maxZoom, maxNativeZoom: a.maxNativeZoom, subdomains: a.subdomains || 'abc', attribution: a.quelle });
    s.on('tileload', () => { kartenStatus.geladen++; });
    s.on('tileerror', () => {
      kartenStatus.fehler++;
      if (!kartenStatus.geladen && kartenStatus.fehler >= 4) naechsterAnbieter();
    });
    return s;
  }
  function naechsterAnbieter() {
    const k = kartenStatus;
    if (k.vereinfacht || !k.map) return;
    if (k.kacheln && k.map.hasLayer(k.kacheln)) k.map.removeLayer(k.kacheln);
    k.anbieter++;
    k.fehler = 0;
    if (k.anbieter >= KARTE.anbieter.length) { vereinfachen(); return; }
    k.kacheln = kachelSchicht(k.anbieter).addTo(k.map);
  }

  // Ganz Garbsen zeigen. Ist die Karte hoch genug, liegt die Stadt unterhalb der Kartenknöpfe, sonst links daneben.
  function zeigeGanzGarbsen() {
    const map = kartenStatus.map;
    const bounds = window.L.latLngBounds(STADTTEILE.map((s) => [s.lat, s.lng]));
    const knoepfe = document.querySelector('.karte-knoepfe');
    const unterKnoepfen = knoepfe.offsetTop + knoepfe.offsetHeight + 30;
    const hoch = map.getSize().y - unterKnoepfen - 40 > map.getSize().x * 0.7;
    map.fitBounds(bounds, hoch
      ? { paddingTopLeft: [26, unterKnoepfen], paddingBottomRight: [26, 40] }
      : { paddingTopLeft: [40, 40], paddingBottomRight: [72, 40] });
  }

  // Bei weiter Ansicht werden die Preisschilder kompakter, damit sie sich weniger überdecken.
  function zoomKlasse() {
    const map = kartenStatus.map;
    if (map) map.getContainer().classList.toggle('zoom-weit', map.getZoom() < 12.75);
  }

  function initKarte() {
    if (kartenStatus.map) return true;
    const L = window.L;
    if (!L || !L.map) { $('#karte-fehler').hidden = false; return false; }

    const map = L.map('map', {
      zoomControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      minZoom: KARTE.minZoom,
      maxZoom: KARTE.maxZoom,
      maxBounds: KARTE.grenzen,
      maxBoundsViscosity: 0.85
    });
    map.attributionControl.setPrefix(false);
    L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 100 }).addTo(map);
    map.createPane('stadtteile').style.zIndex = 350;
    map.createPane('labels').style.zIndex = 450;
    map.getPane('labels').style.pointerEvents = 'none';

    kartenStatus.map = map;
    // In der Claude-Vorschau sind Kartenbilder gesperrt: dort gleich die vereinfachte Karte
    if (!VORSCHAU) kartenStatus.kacheln = kachelSchicht(0).addTo(map);
    aktualisiereKachelThema();
    kartenStatus.bereich = L.layerGroup().addTo(map);
    kartenStatus.pins = L.layerGroup().addTo(map);

    map.on('zoomend', () => { zoomKlasse(); labelsAufraeumen(); });
    map.on('resize moveend', labelsAufraeumen);
    map.on('click', () => { if (ui.markiert) { ui.markiert = null; renderKarte(); } });
    zeigeGanzGarbsen();
    zoomKlasse();
    if (VORSCHAU) vereinfachen();
    return true;
  }

  // Wenn keine Kartenbilder laden dürfen (z. B. in der Claude-Vorschau), zeigen wir die Stadtteile als vereinfachte Karte.
  function vereinfachen() {
    const k = kartenStatus;
    if (k.vereinfacht || !k.map) return;
    k.vereinfacht = true;
    const L = window.L;
    if (k.kacheln && k.map.hasLayer(k.kacheln)) k.map.removeLayer(k.kacheln);
    k.map.attributionControl.addAttribution(KARTE.ortsQuelle);
    k.stadtteile = L.layerGroup(STADTTEILE.map((s) => L.circle([s.lat, s.lng], {
      radius: s.r, pane: 'stadtteile', className: 'stadtteil-flaeche', interactive: false, weight: 1
    }))).addTo(k.map);
    k.labels = L.layerGroup(STADTTEILE.map((s) => L.marker([s.lat, s.lng], {
      pane: 'labels', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'stadtteil-label', html: `<span>${esc(s.name)}</span>`, iconSize: null })
    }))).addTo(k.map);
    $('#karte-hinweis').hidden = !VORSCHAU;
    $('#legende-stadtteil').hidden = false;
    requestAnimationFrame(labelsAufraeumen);
  }

  // Blendet Stadtteil-Namen aus, die von Preisschildern, Knöpfen oder anderen Namen verdeckt würden.
  function labelsAufraeumen() {
    const k = kartenStatus;
    if (!k.labels || !k.map) return;
    const rahmen = k.map.getContainer().getBoundingClientRect();
    const belegt = [document.querySelector('.karte-knoepfe').getBoundingClientRect()];
    k.pins.eachLayer((m) => {
      const pin = m.getElement() && m.getElement().querySelector('.pin');
      if (pin) belegt.push(pin.getBoundingClientRect());
    });
    k.labels.eachLayer((m) => {
      const el = m.getElement();
      const span = el && el.firstElementChild;
      if (!span) return;
      span.classList.remove('versteckt');
      span.style.marginLeft = '0px';
      let r = span.getBoundingClientRect();
      // Namen am Rand nach innen schieben statt sie abzuschneiden
      const links = rahmen.left + 6 - r.left, rechts = rahmen.right - 6 - r.right;
      if (links > 0 || rechts < 0) {
        span.style.marginLeft = (links > 0 ? links : rechts) + 'px';
        r = span.getBoundingClientRect();
      }
      const draussen = r.top < rahmen.top || r.bottom > rahmen.bottom - 24 || Math.abs(parseFloat(span.style.marginLeft)) > r.width / 2;
      const kollidiert = belegt.some((b) => r.left < b.right + 1 && r.right > b.left - 1 && r.top < b.bottom + 1 && r.bottom > b.top - 1);
      if (draussen || kollidiert) span.classList.add('versteckt'); else belegt.push(r);
    });
  }

  function aktualisiereKachelThema() {
    const k = kartenStatus;
    // Die Kacheln gibt es nur hell; im dunklen Design werden sie per Filter abgedunkelt
    if (k.map) k.map.getContainer().classList.toggle('karte-dunkel', dunklesThema());
  }

  function renderKarte() {
    const sichtbar = gesuche.filter((g) => passt(g) && !versteckt(g) && (g.eigen || (g.status === 'offen' && !abgelaufen(g)) || g.helfer === 'ich'));
    $('#karte-anzahl').textContent = `${sichtbar.length} ${sichtbar.length === 1 ? 'Anfrage' : 'Anfragen'}${ui.kat !== 'alle' ? ' · ' + katName(ui.kat) : ''}`;
    $('#karte-leer').hidden = !(istLive() && db.geladen && !sichtbar.length && ui.kat === 'alle' && !ui.suche.trim());
    const k = kartenStatus;
    if (!k.map) return;
    const L = window.L;
    k.pins.clearLayers();
    k.bereich.clearLayers();
    k.marker.clear();

    const hervor = ui.offen || ui.markiert;
    const aktiv = gesuche.find((g) => g.id === hervor);
    if (aktiv && !aktiv.eigen) {
      L.circle([aktiv.lat, aktiv.lng], { radius: CONFIG.bereichMeter, className: 'bereich-kreis', interactive: false }).addTo(k.bereich);
    }

    if (zeigeIch()) {
      const ort = meinOrt();
      L.marker([ort.lat, ort.lng], {
        interactive: false, keyboard: false, zIndexOffset: -500,
        icon: L.divIcon({ className: 'ich-anker', html: '<span class="ich"></span><span class="ich-label">Du</span>', iconSize: null })
      }).addTo(k.pins);
    }

    sichtbar.forEach((g) => {
      const cls = [g.eigen ? 'pin-eigen' : '', abgelaufen(g) ? 'pin-abgelaufen' : '', g.helfer === 'ich' ? 'pin-zugesagt' : '', g.id === hervor ? 'is-aktiv' : ''].join(' ');
      const m = L.marker([g.lat, g.lng], {
        riseOnHover: true,
        zIndexOffset: g.id === hervor ? 1000 : 0,
        icon: L.divIcon({
          className: 'pin-anker',
          iconSize: null,
          html: `<span class="pin ${cls}" aria-hidden="true">${g.helfer === 'ich' ? icon('check', 'i-xs') : ''}${euroKurz(g.betrag)}</span>`
        })
      });
      m.on('click', () => oeffnen(g.id, m.getElement()));
      m.addTo(k.pins);
      const el = m.getElement();
      if (el) {
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `${g.titel}, ${euro(g.betrag)}, ${g.stadtteil}, ${distanz(g)}${g.eigen ? (abgelaufen(g) ? ', deine Anfrage, abgelaufen' : ', deine Anfrage') : ''}`);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); oeffnen(g.id, el); }
        });
      }
      k.marker.set(g.id, m);
    });
    requestAnimationFrame(labelsAufraeumen);
  }

  function zentriereAuf(id) {
    const g = gesuche.find((x) => x.id === id);
    const map = kartenStatus.map;
    if (g && map) map.setView([g.lat, g.lng], Math.max(map.getZoom(), 15), { animate: false });
  }

  document.querySelector('.karte-knoepfe').addEventListener('click', (e) => {
    const b = e.target.closest('[data-karte]');
    const map = kartenStatus.map;
    if (!b || !map) return;
    const was = b.dataset.karte;
    if (was === 'rein') map.zoomIn();
    else if (was === 'raus') map.zoomOut();
    else if (was === 'ich') { const o = meinOrt(); map.setView([o.lat, o.lng], 15); }
    else if (was === 'alles') zeigeGanzGarbsen();
  });

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', aktualisiereKachelThema);
  }
  new MutationObserver(aktualisiereKachelThema).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

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
    else if (echteAdresse) adressZeile = `${esc(echteAdresse)}<span class="fakt-leise">${g.eigen ? 'sieht nur, wer zusagt' : 'nur für dich sichtbar'}</span>`;
    else adressZeile = `<span class="fakt-leise">${adresse === null ? 'wird geladen …' : g.eigen ? 'nur der Stadtteil' : 'nicht verfügbar'}</span>`;

    html += `<div class="betrag">
      <div><div class="betrag-zahl">${euroKurz(g.betrag)}</div><div class="betrag-label">Aufwandsentschädigung</div></div>
      <div class="betrag-detail">${detail}</div>
    </div>
    <dl class="fakten">
      <div><dt>Wann</dt><dd>${esc(wannLang(g))}</dd></div>
      <div><dt>Dauer</dt><dd>${esc(g.dauer)}</dd></div>
      <div><dt>Stadtteil</dt><dd>${esc(g.stadtteil)}</dd></div>
      <div><dt>Entfernung</dt><dd>${distanz(g)}</dd></div>
      <div class="breit"><dt>Adresse</dt><dd>${adressZeile}</dd></div>
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
        html += `<div class="status-box good">${icon('check')}${esc(g.helferName || 'Jemand')} hilft dir</div>`;
      } else if (g.status === 'erledigt') {
        html += `<div class="status-box warn">${esc(hn)} hat den Job als erledigt gemeldet.</div>
          <button type="button" class="btn btn-primary" data-aktion="bestaetigen" ${dis}>Erledigt bestätigen</button>`;
      } else if (g.status === 'bezahlt') {
        html += `<div class="status-box good">${icon('check')}Abgeschlossen</div>` + (g.helferName ? sterneHTML(g.meineBewertung || 0, hn) : '');
      }
    } else if (g.status === 'offen') {
      html += `<button type="button" class="btn btn-primary" data-aktion="zusagen" ${dis}>Ich helfe</button>`;
    } else if (g.status === 'zugesagt') {
      html += `<button type="button" class="btn btn-primary" data-aktion="erledigt" ${dis}>Job erledigt melden</button>
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
      </div>`;
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
  function chatHTML(g) {
    const partner = esc((g.eigen ? vorname(g.helferName) : vorname(g.wer)) || 'deinem Nachbarn');
    return `<section class="chat" aria-labelledby="chat-titel">
        <h3 class="chat-titel" id="chat-titel">${icon('sprechblase', 'i-sm')}Nachrichten mit ${partner}</h3>
        <div class="chat-liste" id="chat-liste" role="log" aria-live="polite" tabindex="0">${chatListeHTML(g)}</div>
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
    const kopf = `<div class="sheet-top">
        <span class="eyebrow">Konto</span>
        <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
      </div>`;
    if (ui.authFertig) {
      return kopf + `<h2 id="sheet-titel">Fast geschafft</h2>
        <div class="erfolg"><strong>Schau in dein Postfach.</strong><p>Wir haben dir eine E-Mail an ${esc(ui.authFertig)} geschickt. Tippe auf den Link darin, dann bist du angemeldet.</p></div>
        <button type="button" class="btn btn-secondary" data-close>Alles klar</button>`;
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
        <div class="feld"><label for="auth-stadtteil">Dein Stadtteil</label><select id="auth-stadtteil">${stadtteilOptionen(gewaehlterOrt || 'Garbsen-Mitte', false)}</select></div>` : ''}
        <div class="feld"><label for="auth-email">E-Mail</label><input id="auth-email" type="email" autocomplete="email" required></div>
        <div class="feld"><label for="auth-passwort">Passwort</label><input id="auth-passwort" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required>${reg ? '<p class="feld-hinweis" style="margin-top:0">Mindestens 8 Zeichen.</p>' : ''}</div>
        ${reg ? `<label class="check"><input type="checkbox" id="auth-18"><span>Ich bin mindestens 18 Jahre alt.</span></label>
        <label class="check"><input type="checkbox" id="auth-regeln"><span>Ich akzeptiere die Nutzungsbedingungen. Hand Drauf vermittelt nur, die Absprache und Bezahlung läuft direkt zwischen uns Nachbarn, gelegentlich und in kleinem Umfang.</span></label>
        <p class="klein recht-links-form">Lies vorher die <a href="${NATIV ? OEFFENTLICH : ''}#nutzung" target="_blank" rel="noopener">Nutzungsbedingungen</a> und die <a href="${NATIV ? OEFFENTLICH : ''}#datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a> (öffnen ${NATIV ? 'im Browser' : 'in neuem Tab'}).</p>` : ''}
        <p class="fehler" id="auth-fehler" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary" ${ui.busy ? 'disabled aria-busy="true"' : ''}>${reg ? 'Konto erstellen' : 'Anmelden'}</button>
      </form>`;
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
      <p class="klein">Angemeldet als ${esc(db.user && db.user.email)}. Andere sehen nur deinen Vornamen, den Anfangsbuchstaben und deinen Stadtteil.</p>
      <div class="feld"><label for="konto-stadtteil">Dein Stadtteil</label><select id="konto-stadtteil">${stadtteilOptionen(p.stadtteil, false)}</select></div>
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
      return { name: g.wer, kuerzel: g.initialen, stadtteil: g.stadtteil, dabei: DEMO_DABEI.at(n % DEMO_DABEI.length),
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
      <p class="klein">Andere sehen nur Vorname, Anfangsbuchstabe und Stadtteil. Adresse und E-Mail sieht niemand.</p>
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
        ${ohneKonto ? `<div class="menue-zeile"><label class="menue-label" for="ansicht-ort">Stadtteil</label><select id="ansicht-ort">${gewaehlterOrt ? '' : '<option value="">Bitte wählen</option>'}${stadtteilOptionen(gewaehlterOrt || '', false)}</select></div>` : ''}
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

  function renderAlles() {
    renderKopf();
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
      kartenStatus.map.invalidateSize({ pan: false });
      if (ui.zentrieren) { zentriereAuf(ui.zentrieren); ui.zentrieren = null; }
      renderKarte();
      labelsAufraeumen();
    }
    if (view === 'auftraege') renderAuftraege();
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
    if (name === 'konto' && !db.profil) name = 'anmelden';
    ui.zuletzt = document.activeElement;
    ui.offen = null;
    ui.panel = name;
    ui.authModus = 'anmelden';
    ui.loeschen = false;
    ui.authGrund = grund || '';
    ui.authFertig = '';
    ui.blockieren = false;
    renderSheet();
    sheetZeigen();
    renderKarte();
  }
  function schliessen() {
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
    if (!ziel && id && ui.view === 'karte' && kartenStatus.marker.has(id)) ziel = kartenStatus.marker.get(id).getElement();
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
      await db.client.auth.signOut();
      ui.busy = false;
      schliessen();
      meldung('Du bist abgemeldet.');
      return;
    }
    const g = gesuche.find((x) => x.id === ui.offen);
    if (!g) return;
    const a = t.dataset.aktion;

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
    if (e.target.id !== 'auth-form') return;
    e.preventDefault();
    const reg = ui.authModus === 'registrieren';
    const fehler = $('#auth-fehler');
    const zeigeFehler = (text, feld) => { fehler.textContent = text; fehler.hidden = false; if (feld) feld.focus(); };
    const email = $('#auth-email').value.trim();
    const passwort = $('#auth-passwort').value;
    if (reg && !$('#auth-vorname').value.trim()) return zeigeFehler('Bitte gib deinen Vornamen ein.', $('#auth-vorname'));
    if (!/^\S+@\S+\.\S+$/.test(email)) return zeigeFehler('Bitte gib eine gültige E-Mail-Adresse ein.', $('#auth-email'));
    if (passwort.length < (reg ? 8 : 1)) return zeigeFehler(reg ? 'Das Passwort braucht mindestens 8 Zeichen.' : 'Bitte gib dein Passwort ein.', $('#auth-passwort'));
    if (reg && !$('#auth-18').checked) return zeigeFehler('Hand Drauf ist erst ab 18 Jahren.', $('#auth-18'));
    if (reg && !$('#auth-regeln').checked) return zeigeFehler('Bitte bestätige, dass du die Regeln verstanden hast.', $('#auth-regeln'));

    const knopf = e.target.querySelector('button[type="submit"]');
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    fehler.hidden = true;
    try {
      if (reg) {
        const { data, error } = await db.client.auth.signUp({
          email,
          password: passwort,
          options: {
            emailRedirectTo: NATIV ? OEFFENTLICH : location.origin + location.pathname,
            data: {
              vorname: $('#auth-vorname').value.trim().slice(0, 40),
              nachname_initial: $('#auth-initial').value.trim().slice(0, 1).toUpperCase(),
              stadtteil: $('#auth-stadtteil').value,
              volljaehrig: 'true'
            }
          }
        });
        if (error) throw error;
        if (!data.session) { ui.authFertig = email; renderSheet(); return; }
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

  // Stadtteil im Konto ändern
  $('#sheet').addEventListener('change', async (e) => {
    if (e.target.name === 'grund') { const f = $('#melden-fehler'); if (f) f.hidden = true; return; }
    if (e.target.id === 'ansicht-ort') {
      ortWaehlen(e.target.value);
      renderStadtteilAuswahl();
      renderAlles();
      if (kartenStatus.map) renderKarte();
      meldung(`Stadtteil: ${e.target.value}`);
      return;
    }
    if (e.target.id !== 'konto-stadtteil' || !db.profil) return;
    const neu = e.target.value;
    const { error } = await db.client.from('profile').update({ stadtteil: neu }).eq('id', db.profil.id);
    if (error) { meldung(fehlerText(error)); e.target.value = db.profil.stadtteil; return; }
    db.profil.stadtteil = neu;
    meldung(`Stadtteil geändert: ${neu}`);
    renderStadtteilAuswahl();
    renderAlles();
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
      try { await teilenPlugin.share({ title: 'Hand Drauf', text, url, dialogTitle: 'Teilen' }); } catch (e) { /* abgebrochen */ }
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'Hand Drauf', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); meldung('Link kopiert. Füge ihn in eine Nachricht ein.'); }
    catch (e) { meldung(`Link zum Teilen: ${url}`); }
  }
  const einladen = () => teilen('Hand Drauf: Nachbarn in Garbsen helfen sich bei kleinen Dingen, gegen eine kleine Aufwandsentschädigung. Schau mal rein:', NATIV ? OEFFENTLICH : location.origin + location.pathname);
  function gesuchTeilen(g) {
    const was = `„${g.titel}“ in ${g.stadtteil}, ${g.wann}, ${euroKurz(g.betrag)} Aufwandsentschädigung`;
    teilen(g.eigen ? `Ich suche Hilfe: ${was}. Kannst du helfen oder kennst du jemanden?` : `${vorname(g.wer)} sucht Hilfe: ${was}. Kannst du helfen?`, gesuchLink(g));
  }

  // Geteilter Link #anfrage-<id> öffnet die Anfrage direkt
  const GESUCH_LINK = /^(?:anfrage|gesuch)-(.+)$/;
  const linkId = (hash) => { const m = hash.match(GESUCH_LINK); return m ? decodeURIComponent(m[1]) : null; };
  function gesuchAusLink(id) {
    if (gesuche.some((g) => g.id === id)) { oeffnen(id); return; }
    if (istLive() && !db.geladen) return; // wird nach dem Laden erneut versucht
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
    const ort = adresse ? `${adresse}${adresse.includes(g.stadtteil) ? '' : ', ' + g.stadtteil}, Garbsen` : `${g.stadtteil}, Garbsen`;
    const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hand Drauf//Nachbarschaftshilfe Garbsen//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
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
  function startGesehen() { try { return localStorage.getItem(START_SPEICHER) === '1'; } catch (e) { return true; } }
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

  /* ===== Klicks auf Listen und Filter ===== */
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { gehe(go.dataset.go); return; }
    if (e.target.closest('[data-einladen]')) { einladen(); return; }
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
      if (kartenStatus.map) kartenStatus.map.invalidateSize({ pan: false });
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
  $('#stadtteil').addEventListener('change', (e) => { ui.stadtteil = e.target.value; renderListe(); });

  /* ===== Begrüßung beim ersten Start (Vorbild: Too Good To Go, BlaBlaCar) ===== */
  let startSeite = 0;
  function startHTML() {
    const punkte = (n) => `<div class="start-punkte" aria-hidden="true">${[0, 1, 2].map((i) => `<span class="${i === n ? 'an' : ''}"></span>`).join('')}</div>`;
    const ueber = `<button type="button" class="link-btn start-ueber" data-start="fertig">Überspringen</button>`;
    const fuss = (n, knopf, aktion) => `<div class="start-fuss">${punkte(n)}<button type="button" class="btn btn-primary" data-start="${aktion}">${knopf}</button></div>`;
    if (startSeite === 0) return `${ueber}
      <div class="start-logo">${$('.marke-logo') ? $('.marke-logo').outerHTML : ''}</div>
      <h1 id="start-titel" tabindex="-1">Nachbarn helfen Nachbarn</h1>
      <p class="start-text">Rasen mähen, Einkauf hochtragen, Drucker einrichten: kleine Hilfen in Garbsen, gegen eine kleine Aufwandsentschädigung.</p>
      <ul class="start-liste">
        <li>${icon('plus')}<span><strong>Hilfe suchen</strong>Eine Anfrage in vier kurzen Schritten stellen.</span></li>
        <li>${icon('karte')}<span><strong>Helfen</strong>Auf der Karte sehen, wo in deiner Nähe Hilfe gebraucht wird.</span></li>
      </ul>
      ${fuss(0, 'Weiter', 'weiter')}`;
    if (startSeite === 1) return `${ueber}
      <h1 id="start-titel" tabindex="-1">Wo wohnst du?</h1>
      <p class="start-text">Dann zeigen wir dir zuerst, was in deiner Nähe los ist. Deine Adresse brauchen wir dafür nicht.</p>
      <div class="start-orte" role="group" aria-label="Stadtteil wählen">${STADTTEIL_NAMEN.map((n) =>
        `<button type="button" class="wahl-knopf" data-start-ort="${esc(n)}" aria-pressed="${gewaehlterOrt === n}">${esc(n)}</button>`).join('')}</div>
      ${fuss(1, gewaehlterOrt ? 'Weiter' : 'Ohne Stadtteil weiter', 'weiter')}`;
    return `${ueber}
      <h1 id="start-titel" tabindex="-1">So bleibt es sicher</h1>
      <ul class="start-liste">
        <li>${icon('schloss')}<span><strong>Adresse erst nach der Zusage</strong>Auf der Karte erscheint nur ein Punkt im Stadtteil.</span></li>
        <li>${icon('stern')}<span><strong>Echte Profile und Bewertungen</strong>Helfen kann man ab 18. Nach jedem Auftrag bewertet ihr euch gegenseitig.</span></li>
        <li>${icon('flagge')}<span><strong>Melden in jedem Auftrag</strong>Wir prüfen jede Meldung.</span></li>
      </ul>
      ${fuss(2, 'Los geht’s', 'fertig')}`;
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
  function startBeenden() {
    $('#start').hidden = true;
    document.body.classList.remove('sheet-offen');
    try { localStorage.setItem(START_SPEICHER, '1'); } catch (e) { /* nur für diese Sitzung */ }
    renderStadtteilAuswahl();
    renderAlles();
    const h = $(`#h-${ui.view}`);
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  $('#start').addEventListener('click', (e) => {
    const ort = e.target.closest('[data-start-ort]');
    if (ort) { ortWaehlen(ort.dataset.startOrt); renderStart(`[data-start-ort="${CSS.escape(ort.dataset.startOrt)}"]`); return; }
    const a = e.target.closest('[data-start]');
    if (!a) return;
    if (a.dataset.start === 'weiter') { startSeite += 1; renderStart(); }
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
  const wahlWert = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value || '';
  const betragWert = () => { const v = parseInt(betragInput.value, 10); return Number.isFinite(v) ? v : NaN; };
  const betragGueltig = (b) => b >= CONFIG.minBetrag && b <= CONFIG.maxBetrag;

  function renderVorschlaege() {
    $('#neu-vorschlaege').innerHTML = (VORSCHLAEGE[katWahl()] || []).map((t) =>
      `<button type="button" class="chip chip-vorschlag" data-vorschlag="${esc(t)}">${esc(t)}</button>`).join('');
  }
  function renderRichtwert() {
    const k = katWahl();
    const [lo, hi] = RICHTWERTE[k] || [10, 20];
    $('#neu-richtwert').innerHTML = `${icon('info', 'i-sm')}<span>Üblich für ${esc(katName(k))}: <strong>${lo} bis ${hi} €</strong></span>`;
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
      zeile('Wann', esc(wannLang({ ...terminSpeichern(wahlWert('tag'), wahlWert('zeit')) })), 2) +
      zeile('Wo', `${esc($('#neu-stadtteil').value)}${adresse ? `<span class="klein">${esc(adresse)}, sieht nur, wer zusagt</span>` : ''}`, 2) +
      zeile('Aufwandsentschädigung', euro(betragWert()), 3);
  }
  function zeigeSchritt(n, fokus = true) {
    wizSchritt = n;
    form.querySelectorAll('.schritt').forEach((el) => { el.hidden = Number(el.dataset.schritt) !== n; });
    form.querySelectorAll('.wizard-leiste li').forEach((li, i) => { li.className = i < n ? 'ist-erreicht' : ''; });
    $('#wizard-stand').textContent = `Schritt ${n} von 4: ${SCHRITT_NAMEN.at(n - 1)}`;
    $('#neu-zurueck').hidden = n === 1;
    $('#neu-weiter').hidden = n === 4;
    $('#neu-senden').hidden = n !== 4;
    if (n === 2) renderTage();
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
    if (n === 2 && !wahlWert('tag')) { $('#fehler-tag').hidden = false; return form.querySelector('input[name="tag"]'); }
    if (n === 2 && istLive() && $('#neu-adresse').value.trim().length < 3) return fehler($('#neu-adresse'), '#fehler-adresse');
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
    if (e.target.name === 'tag') $('#fehler-tag').hidden = true;
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
  renderVorschlaege();

  // Datum unter „Heute“, „Morgen“ usw., damit klar ist, welcher Tag gemeint ist
  function renderTage() {
    form.querySelectorAll('input[name="tag"]').forEach((i) => {
      const z = zeitraum(i.value);
      const el = i.parentElement.querySelector('.wahl-datum');
      if (z && el) el.textContent = z.kurz;
    });
  }
  renderTage();

  /* ----- Eigene Anfrage bearbeiten: dieselben Schritte, vorausgefüllt ----- */
  function renderWizardModus() {
    const b = !!ui.bearbeiten;
    $('#h-neu').textContent = b ? 'Anfrage bearbeiten' : 'Hilfe suchen';
    $('#neu-lead').textContent = b ? 'Änderungen sehen Nachbarn sofort.' : '';
    $('#neu-lead').hidden = !b;
    $('#neu-senden').textContent = b ? 'Änderungen speichern' : 'Anfrage veröffentlichen';
    $('#neu-abbrechen').hidden = !b;
  }
  async function bearbeitenStarten(g, schritt) {
    let adresse = istLive() ? db.adressen.get(g.id) : g.adresse;
    if (istLive() && typeof adresse !== 'string') {
      const { data } = await db.client.from('gesuch_adressen').select('adresse').eq('gesuch_id', g.id).maybeSingle();
      adresse = data ? data.adresse : '';
      db.adressen.set(g.id, adresse);
    }
    form.reset();
    ui.bearbeiten = g.id;
    const kat = $(`#neu-kat-${g.kat}`);
    if (kat) kat.checked = true;
    renderVorschlaege();
    $('#neu-titel').value = g.titel;
    $('#neu-text').value = g.text || '';
    // Passt der gespeicherte Termin noch zu einer Auswahl? Sonst neu wählen lassen.
    const tag = TAG_WAHL.find((w) => g.bis && isoTag(zeitraum(w).bis) === g.bis && !abgelaufen(g));
    form.querySelectorAll('input[name="tag"]').forEach((i) => { i.checked = i.value === tag; });
    const zeitTeil = (g.wann || '').slice((g.wann || '').lastIndexOf(', ') + 2);
    const zeit = Object.keys(ZEIT_TEXT).find((k) => ZEIT_TEXT[k] === zeitTeil || k === zeitTeil);
    if (zeit) form.querySelectorAll('input[name="zeit"]').forEach((i) => { i.checked = i.value === zeit; });
    renderStadtteilAuswahl();
    $('#neu-stadtteil').value = g.stadtteil;
    $('#neu-adresse').value = istLive() || adresse !== g.stadtteil ? (adresse || '') : '';
    betragInput.value = g.betrag;
    betragGeaendert = true;
    renderKosten();
    renderWizardModus();
    ui.zuletzt = null;
    schliessen();
    gehe('neu');
    zeigeSchritt(schritt);
  }
  function bearbeitenBeenden() {
    ui.bearbeiten = null;
    form.reset();
    betragGeaendert = false;
    form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
    form.querySelectorAll('.fehler').forEach((f) => { f.hidden = true; });
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
    const stadtteil = $('#neu-stadtteil').value;
    const { wann, bis } = terminSpeichern(wahlWert('tag'), wahlWert('zeit'));
    const text = $('#neu-text').value.trim();
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
        if (bearbeitet) {
          const { error } = await db.client.rpc('gesuch_bearbeiten', { p_id: bearbeitet, ...felder, p_bis: bis });
          if (fehlt(error)) throw new Error('Bearbeiten ist noch nicht freigeschaltet. Zieh die Anfrage zurück und stelle sie neu.');
          if (error) throw error;
        } else {
          let r = db.altesSchema ? { error: { code: 'PGRST202' } } : await db.client.rpc('gesuch_erstellen', { ...felder, p_bis: bis });
          if (fehlt(r.error)) { db.altesSchema = true; r = await db.client.rpc('gesuch_erstellen', felder); }
          if (r.error) throw r.error;
          neuId = r.data;
        }
        db.adressen.set(neuId, adresse);
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
      if (stadtteil !== g.stadtteil) {
        const [nord, ost] = EIGEN_VERSATZ[gesuche.indexOf(g) % EIGEN_VERSATZ.length];
        Object.assign(g, versetze(stadtteil === meinOrt().stadtteil ? meinOrt() : STADTTEILE.find((x) => x.name === stadtteil), nord, ost));
      }
      Object.assign(g, { kat, titel, text, betrag: b, wann, bis, laeuftAb: demoAblauf(bis), stadtteil, adresse: adresse || stadtteil });
      demoSpeichern();
    } else {
      const anzahlEigene = gesuche.filter((g) => g.eigen).length;
      const [nord, ost] = EIGEN_VERSATZ[anzahlEigene % EIGEN_VERSATZ.length];
      const basis = stadtteil === meinOrt().stadtteil ? meinOrt() : STADTTEILE.find((x) => x.name === stadtteil);
      const pos = versetze(basis, nord, ost);
      neuId = 'e' + Date.now();
      gesuche.unshift({
        id: neuId, eigen: true, kat, titel, wer: 'Du', initialen: CONFIG.ich.initialen, betrag: b,
        stadtteil, lat: pos.lat, lng: pos.lng, wann, bis, laeuftAb: demoAblauf(bis), dauer: 'nach Absprache', text,
        adresse: adresse || stadtteil, status: 'offen', erstellt: Date.now()
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
    let gesehen = false;
    try { gesehen = localStorage.getItem(START_SPEICHER) === '1'; } catch (e) { gesehen = true; }
    if (!gesehen) startZeigen();
  }
  starteLive().then((live) => {
    if (!live) { if (linkId(start)) gesuchAusLink(linkId(start)); return; }
    renderStadtteilAuswahl();
    renderKosten();
  });
})();
