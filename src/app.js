(() => {
  'use strict';

  /* ===== Betriebsart ===== */
  // Wird beim Bauen für die Claude-Vorschau auf true gesetzt: Dort ist keine Datenbank erreichbar, also immer Demo.
  const VORSCHAU = false;

  // Zugang zur Datenbank (Supabase). Beide Werte sind öffentlich und dürfen im Code stehen.
  // Leer = Demo-Modus mit erfundenen Beispieldaten.
  const LIVE = {
    url: '',
    key: ''
  };
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

  /* ===== Einstellungen: Gebühren, Regeln und Karte hier anpassen ===== */
  const CONFIG = {
    gebuehrAuftraggeber: 1.99, // nur Demo: fester Betrag, den die suchende Person zusätzlich zahlt
    provisionHelfer: 0.05,     // nur Demo: Anteil, der vom Betrag des Helfers abgeht
    minBetrag: 5,
    maxBetrag: 50,             // Obergrenze für Nachbarschaftshilfe
    freigrenze: 255,           // § 22 Nr. 3 EStG: unter 256 € Gewinn im Jahr steuerfrei
    bereichMeter: 250,         // Radius des ungefähren Bereichs um ein Gesuch
    ich: { name: 'Tim', initialen: 'TS', stadtteil: 'Garbsen-Mitte', lat: 52.4248, lng: 9.5962 } // Demo-Person
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
    adressen: new Map()     // gesuch_id -> Adresse (nur für Beteiligte)
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
  const ui = { view: 'entdecken', kat: 'alle', stadtteil: 'alle', suche: '', sort: 'naehe', offen: null, panel: null, authModus: 'anmelden', authGrund: '', authFertig: '', markiert: null, zentrieren: null, rueckzug: false, zuletzt: null, busy: false };

  /* ===== Hilfsfunktionen ===== */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const euroKurz = (n) => Number.isInteger(n) ? `${n} €` : euro(n);
  const katName = (id) => (KATEGORIEN.find((k) => k.id === id) || {}).name || '';
  const icon = (id, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const vorname = (name) => String(name || '').split(' ')[0];
  const anzeigename = (p) => p ? `${p.vorname}${p.nachname_initial ? ' ' + p.nachname_initial + '.' : ''}` : 'Unbekannt';
  const kuerzel = (p) => p ? ((p.vorname || '?')[0] + (p.nachname_initial || '')).toUpperCase() : '?';
  const auszahlung = (g) => istLive() ? g.betrag : Math.round(g.betrag * (1 - CONFIG.provisionHelfer) * 100) / 100;

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
  function meinOrt() {
    if (!istLive()) return CONFIG.ich;
    const name = (db.profil && db.profil.stadtteil) || 'Garbsen-Mitte';
    const s = STADTTEILE.find((x) => x.name === name) || STADTTEILE[0];
    return { lat: s.lat, lng: s.lng, stadtteil: s.name };
  }
  const zeigeIch = () => !istLive() || !!db.profil;
  const meterVonMir = (g) => abstand(meinOrt(), g);
  function distanz(g) {
    if (g.eigen) return 'bei dir';
    const m = meterVonMir(g);
    if (m < 1000) return Math.max(100, Math.round(m / 50) * 50) + ' m';
    return (m / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
  }
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
    else l.sort((a, b) => meterVonMir(a) - meterVonMir(b));
    return l;
  }
  function statusPill(g) {
    if (g.eigen) {
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
    if (VORSCHAU || !LIVE.url || !LIVE.key) return false;
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

  const GESUCH_FELDER = 'id, ersteller, kategorie, titel, beschreibung, betrag, wann, dauer, stadtteil, lat, lng, status, helfer, erstellt, ' +
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
      eigen: !!ich && r.ersteller === ich,
      helfer: ich && r.helfer === ich ? 'ich' : (r.helfer ? 'andere' : null),
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
        const b = await db.client.from('bewertungen').select('gesuch_id, sterne').eq('von', db.user.id);
        if (!b.error && b.data) b.data.forEach((x) => db.bewertungen.set(x.gesuch_id, x.sterne));
      }
      gesuche = (data || []).map(ausDb);
      db.fehler = null;
      db.geladen = true;
    } catch (e) {
      db.fehler = fehlerText(e);
    } finally {
      db.laedt = false;
    }
    if (ui.offen && !gesuche.some((g) => g.id === ui.offen)) {
      schliessen();
      meldung('Dieses Gesuch ist nicht mehr verfügbar.');
    }
    renderAlles();
  }

  async function ladeAdresse(id) {
    if (db.adressen.has(id)) return;
    db.adressen.set(id, null); // wird geladen
    const { data } = await db.client.from('gesuch_adressen').select('adresse').eq('gesuch_id', id).maybeSingle();
    db.adressen.set(id, data ? data.adresse : '');
    if (ui.offen === id) renderSheet();
  }
  const adresseVon = (g) => istLive() ? db.adressen.get(g.id) : g.adresse;

  // Statuswechsel: Live über Datenbankfunktionen, Demo direkt hier
  async function aendereStatus(g, aktion) {
    if (istLive()) {
      const rpc = { zusagen: 'gesuch_zusagen', absagen: 'gesuch_absagen', erledigt: 'gesuch_erledigt', bestaetigen: 'gesuch_bestaetigen', rueckzug: 'gesuch_zurueckziehen' }[aktion];
      const { error } = await db.client.rpc(rpc, { p_id: g.id });
      if (error) throw error;
      await neuLaden();
      return;
    }
    if (aktion === 'zusagen') { g.status = 'zugesagt'; g.helfer = 'ich'; }
    else if (aktion === 'absagen') { g.status = 'offen'; g.helfer = null; }
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
        <span class="card-meta">${esc(g.eigen ? 'Dein Gesuch' : g.wer)} · ${esc(g.wann)}</span>
        ${extra}
      </span>
      <span class="price">${euroKurz(g.betrag)}</span>
    </button>`;
  }

  function renderKopf() {
    const el = $('#kopf-rechts');
    if (!istLive()) el.innerHTML = '<span class="pill pill-muted">Demo</span>';
    else if (!db.profil) el.innerHTML = '<button type="button" class="btn btn-secondary btn-klein" data-panel="anmelden">Anmelden</button>';
    else el.innerHTML = `<button type="button" class="avatar-btn" data-panel="konto" aria-label="Dein Konto">${esc(kuerzel(db.profil))}</button>`;
    $('#fuss').textContent = istLive()
      ? 'Testphase: Die Aufwandsentschädigung zahlt ihr direkt untereinander. Nachbarhand vermittelt nur und nimmt noch keine Gebühr.'
      : 'Prototyp mit erfundenen Beispiel-Gesuchen in Garbsen. Es fließt kein echtes Geld.';
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
    const offene = gesuche.filter((g) => !g.eigen && g.status === 'offen');
    const ort = meinOrt();
    $('#h-entdecken').textContent = istLive() ? (db.profil ? `Hallo ${db.profil.vorname}` : 'Hilfe in Garbsen') : 'Hallo Tim';
    const anzahl = `${offene.length} ${offene.length === 1 ? 'Nachbar sucht' : 'Nachbarn suchen'} gerade Hilfe`;
    $('#anzahl-text').textContent = zeigeIch() ? `${ort.stadtteil}, Garbsen · ${anzahl}` : `Garbsen · ${anzahl}`;

    if (istLive() && !db.geladen) {
      $('#liste').innerHTML = db.fehler
        ? `<div class="leer"><p><strong>Die Gesuche konnten nicht geladen werden.</strong></p><p>${esc(db.fehler)}</p><button type="button" class="btn btn-secondary btn-auto" data-neu-laden>Erneut versuchen</button></div>`
        : `<p class="lade">Gesuche werden geladen …</p>`;
      return;
    }
    const treffer = sortiere(offene.filter((g) => passt(g) && (ui.stadtteil === 'alle' || g.stadtteil === ui.stadtteil)));
    if (!treffer.length) {
      const q = ui.suche.trim();
      const wo = ui.stadtteil === 'alle' ? '' : ` in ${esc(ui.stadtteil)}`;
      const nochNichts = istLive() && !offene.length;
      $('#liste').innerHTML = `<div class="leer">
        <p><strong>${nochNichts ? 'Noch keine offenen Gesuche in Garbsen.' : `Nichts gefunden${q ? ` für „${esc(q)}“` : ''}${wo}.`}</strong></p>
        <p>${nochNichts ? 'Mach den Anfang: Wobei könntest du Hilfe gebrauchen?' : 'Probier eine andere Tätigkeit, Kategorie oder einen anderen Stadtteil. Oder such selbst Hilfe.'}</p>
        <button type="button" class="btn btn-secondary btn-auto" data-go="neu">Gesuch erstellen</button>
      </div>`;
      return;
    }
    $('#liste').innerHTML = treffer.map((g) => karteHTML(g)).join('');
  }

  function renderAuftraege() {
    const abschnitte = document.querySelectorAll('#view-auftraege .abschnitt');
    if (istLive() && !db.profil) {
      $('#summe').innerHTML = `<span class="h-klein">Deine Aufträge</span>
        <p>Melde dich an, um deine Gesuche und Zusagen zu sehen.</p>
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
    $('#summe').innerHTML = `
      <span class="h-klein">${istLive() ? 'Aufwandsentschädigungen (bestätigt)' : 'Verdient über Nachbarhand'}</span>
      <span class="summe-zahl">${euro(verdient)}</span>
      <div class="meter" role="img" aria-label="${euro(verdient)} von ${euro(CONFIG.freigrenze)} steuerfreiem Betrag"><span style="width:${anteil.toFixed(1)}%"></span></div>
      <span class="summe-hint">Bis ${CONFIG.freigrenze} € Gewinn im Jahr steuerfrei (§ 22 Nr. 3 EStG). Noch ${euro(rest)} frei.</span>`;
    $('#zusagen').innerHTML = zusagen.length
      ? zusagen.map((g) => karteHTML(g, statusPill(g))).join('')
      : `<p class="leer-klein">Noch keine Zusagen. Such dir in der Liste oder auf der Karte einen Job in deiner Nähe.</p>`;
    $('#eigene').innerHTML = eigene.length
      ? eigene.map((g) => karteHTML(g, statusPill(g))).join('')
      : `<p class="leer-klein">Du hast noch kein Gesuch erstellt. Über „Hilfe suchen“ geht das in einer Minute.</p>`;
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
    const sichtbar = gesuche.filter((g) => passt(g) && (g.eigen || g.status === 'offen' || g.helfer === 'ich'));
    $('#karte-anzahl').textContent = `${sichtbar.length} ${sichtbar.length === 1 ? 'Gesuch' : 'Gesuche'}${ui.kat !== 'alle' ? ' · ' + katName(ui.kat) : ''}`;
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
      const cls = [g.eigen ? 'pin-eigen' : '', g.helfer === 'ich' ? 'pin-zugesagt' : '', g.id === hervor ? 'is-aktiv' : ''].join(' ');
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
        el.setAttribute('aria-label', `${g.titel}, ${euro(g.betrag)}, ${g.stadtteil}, ${distanz(g)}${g.eigen ? ', dein Gesuch' : ''}`);
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
      html += `<p class="klein">Dein Gesuch · sichtbar für Nachbarn in Garbsen</p>`;
    } else {
      const bewertung = g.bewertungen
        ? `${icon('stern', 'i-xs i-fill')}${g.sterne.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${g.bewertungen} ${g.bewertungen === 1 ? 'Bewertung' : 'Bewertungen'}`
        : 'Neu bei Nachbarhand';
      html += `<div class="person">
        <span class="avatar" aria-hidden="true">${esc(g.initialen)}</span>
        <div>
          <div class="person-name">${esc(g.wer)}${live ? '' : ` <span class="pill pill-good">${icon('check', 'i-xs')}Verifiziert</span>`}</div>
          <div class="person-meta">${bewertung}</div>
        </div>
      </div>`;
    }

    let detail;
    if (live) detail = g.eigen
      ? `Zahlst du direkt<span>an die Person, die dir hilft</span>`
      : `Bekommst du direkt<span>von ${esc(vn)}, ohne Gebühr in der Testphase</span>`;
    else detail = g.eigen
      ? `Du zahlst ${euro(g.betrag + gebuehr)}<span>inkl. ${euro(gebuehr)} Servicegebühr, erst nach Erledigung</span>`
      : `Du erhältst ${euro(auszahlung(g))}<span>nach ${Math.round(CONFIG.provisionHelfer * 100)} % Servicegebühr</span>`;
    html += `<div class="betrag">
      <div><div class="betrag-zahl">${euroKurz(g.betrag)}</div><div class="betrag-label">Aufwandsentschädigung</div></div>
      <div class="betrag-detail">${detail}</div>
    </div>
    <dl class="fakten">
      <div><dt>Stadtteil</dt><dd>${esc(g.stadtteil)}</dd></div>
      <div><dt>Entfernung</dt><dd>${distanz(g)}</dd></div>
      <div><dt>Wann</dt><dd>${esc(g.wann)}</dd></div>
      <div><dt>Dauer</dt><dd>${esc(g.dauer)}</dd></div>
    </dl>`;
    if (g.text) html += `<p class="beschreibung">${esc(g.text)}</p>`;
    html += `<button type="button" class="link-inline" data-aktion="karte">${icon('karte', 'i-sm')}Auf der Karte zeigen</button>`;

    // Adresse: nur für Beteiligte
    const beteiligt = g.eigen || g.helfer === 'ich';
    const adresse = beteiligt ? adresseVon(g) : '';
    if (beteiligt && live) ladeAdresse(g.id);
    if (g.eigen) {
      html += `<div class="hinweis">${icon('schloss')}<span>${adresse ? `Deine Adresse <strong>${esc(adresse)}</strong> sieht` : 'Deine genaue Adresse sieht'} nur, wer zusagt.</span></div>`;
    } else if (g.status === 'offen') {
      html += `<div class="hinweis">${icon('schloss')}<span>Die genaue Adresse siehst du nach deiner Zusage.</span></div>`;
    } else {
      const adressText = adresse ? esc(adresse) : (adresse === '' ? 'Adresse nicht verfügbar' : 'Adresse wird geladen …');
      html += `<div class="hinweis hinweis-offen">${icon('ort')}<span><strong>${adressText}</strong><br>Nur für dich sichtbar</span></div>`;
    }

    // Fortschritt für laufende Aufträge
    if (g.status !== 'offen' && (g.helfer === 'ich' || g.eigen)) {
      const stufen = ['zugesagt', 'erledigt', 'bezahlt'];
      const namen = ['Zugesagt', 'Erledigt gemeldet', live ? 'Bestätigt' : 'Bestätigt und ausgezahlt'];
      const idx = stufen.indexOf(g.status);
      html += `<ol class="schritte" aria-label="Fortschritt">${namen.map((n, i) =>
        `<li class="${i <= idx ? 'is-done' : ''} ${i === idx ? 'is-current' : ''}"><span class="punkt">${i <= idx ? icon('check', 'i-xs') : ''}</span>${n}</li>`
      ).join('')}</ol>`;
      if (!live && g.helfer === 'ich' && g.antwort) html += `<div class="nachricht"><span class="nachricht-von">Nachricht von ${esc(vn)}</span><p>${esc(g.antwort)}</p></div>`;
    }

    const sterneHTML = (b, wen) => `<div class="bewerten"><span><strong>${b ? 'Danke für deine Bewertung.' : `Wie war es mit ${esc(wen)}?`}</strong></span>
      <div class="sterne" role="group" aria-label="Bewertung">${[1, 2, 3, 4, 5].map((n) =>
        `<button type="button" class="stern ${n <= b ? 'is-an' : ''}" data-stern="${n}" aria-label="${n} ${n === 1 ? 'Stern' : 'Sterne'}" aria-pressed="${n <= b}" ${dis}>${icon('stern')}</button>`
      ).join('')}</div></div>`;

    if (g.eigen) {
      if (g.status === 'offen') {
        html += ui.rueckzug
          ? `<div class="bestaetigen-box"><p>Gesuch wirklich zurückziehen? Nachbarn sehen es dann nicht mehr.</p>
              <div class="btn-row"><button type="button" class="btn btn-danger-solid" data-aktion="rueckzug" ${dis}>Zurückziehen</button>
              <button type="button" class="btn btn-secondary" data-aktion="rueckzug-nein">Abbrechen</button></div></div>`
          : `<button type="button" class="btn btn-secondary btn-danger" data-aktion="rueckzug-frage">Gesuch zurückziehen</button>`;
      } else if (g.status === 'zugesagt') {
        html += `<div class="status-box good">${icon('check')}${esc(g.helferName || 'Jemand')} hilft dir</div>
          <p class="klein">Sobald der Job erledigt ist, meldet ${esc(hn)} das hier. Danach bestätigst du.</p>`;
      } else if (g.status === 'erledigt') {
        html += `<div class="status-box warn">${esc(hn)} hat den Job als erledigt gemeldet.</div>
          <button type="button" class="btn btn-primary" data-aktion="bestaetigen" ${dis}>Erledigt bestätigen</button>`;
      } else if (g.status === 'bezahlt') {
        html += `<div class="status-box good">${icon('check')}Abgeschlossen</div>` + (g.helferName ? sterneHTML(g.meineBewertung || 0, hn) : '');
      }
    } else if (g.status === 'offen') {
      html += `<button type="button" class="btn btn-primary" data-aktion="zusagen" ${dis}>Ich helfe</button>
        <p class="klein">${live ? `Die Aufwandsentschädigung bekommst du direkt von ${esc(vn)}.` : 'Bezahlt wird sicher über die App, nicht bar.'} Helfen kannst du ab 18 Jahren.</p>`;
    } else if (g.status === 'zugesagt') {
      html += `<button type="button" class="btn btn-primary" data-aktion="erledigt" ${dis}>Job erledigt melden</button>
        <button type="button" class="link-btn" data-aktion="absagen" ${dis}>Zusage zurückziehen</button>`;
    } else if (g.status === 'erledigt') {
      html += `<div class="status-box warn">Warte auf Bestätigung von ${esc(vn)}.${live ? '' : ' Danach wird ausgezahlt.'}</div>` +
        (live ? '' : `<button type="button" class="btn btn-secondary" data-aktion="bestaetigen">Demo: ${esc(vn)} bestätigt</button>`);
    } else if (g.status === 'bezahlt') {
      html += `<div class="status-box good">${icon('check')}${live ? `${esc(vn)} hat bestätigt` : `${euro(auszahlung(g))} ausgezahlt`}</div>` + sterneHTML(g.meineBewertung || 0, vn);
    }
    return html;
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
        <div class="feld"><label for="auth-stadtteil">Dein Stadtteil</label><select id="auth-stadtteil">${stadtteilOptionen('Garbsen-Mitte', false)}</select></div>` : ''}
        <div class="feld"><label for="auth-email">E-Mail</label><input id="auth-email" type="email" autocomplete="email" required></div>
        <div class="feld"><label for="auth-passwort">Passwort</label><input id="auth-passwort" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required>${reg ? '<p class="feld-hinweis" style="margin-top:0">Mindestens 8 Zeichen.</p>' : ''}</div>
        ${reg ? `<label class="check"><input type="checkbox" id="auth-18"><span>Ich bin mindestens 18 Jahre alt.</span></label>
        <label class="check"><input type="checkbox" id="auth-regeln"><span>Ich habe verstanden: Nachbarhand vermittelt nur. Die Absprache und Bezahlung läuft direkt zwischen uns Nachbarn, gelegentlich und in kleinem Umfang.</span></label>` : ''}
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
      <button type="button" class="btn btn-secondary" data-abmelden ${ui.busy ? 'disabled' : ''}>Abmelden</button>`;
  }

  function renderSheet() {
    let html = '';
    if (ui.panel === 'anmelden') html = sheetAnmeldenHTML();
    else if (ui.panel === 'konto') html = sheetKontoHTML();
    else {
      const g = gesuche.find((x) => x.id === ui.offen);
      if (!g) { schliessen(); return; }
      html = sheetGesuchHTML(g);
    }
    $('#sheet-inhalt').innerHTML = html;
  }

  function renderAlles() {
    renderKopf();
    renderChips();
    renderListe();
    renderKarte();
    renderAuftraege();
    if (ui.offen) renderSheet();
  }

  /* ===== Navigation ===== */
  function zeige(view) {
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
    if (VIEWS.includes(v)) zeige(v);
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
    ui.authGrund = grund || '';
    ui.authFertig = '';
    renderSheet();
    sheetZeigen();
    renderKarte();
  }
  function schliessen() {
    const id = ui.offen;
    ui.offen = null;
    ui.panel = null;
    $('#backdrop').hidden = true;
    $('#sheet').hidden = true;
    document.body.classList.remove('sheet-offen');
    renderKarte();
    let ziel = (ui.zuletzt && ui.zuletzt.isConnected) ? ui.zuletzt : (id ? $(`#view-${ui.view} .card[data-id="${id}"]`) : null);
    if (!ziel && id && ui.view === 'karte' && kartenStatus.marker.has(id)) ziel = kartenStatus.marker.get(id).getElement();
    if (ziel && ziel.focus) ziel.focus({ preventScroll: true });
  }

  const ERFOLG = {
    zusagen: (g) => `Zugesagt. ${vorname(g.wer)} sieht jetzt deinen Namen.`,
    absagen: () => 'Zusage zurückgezogen. Das Gesuch ist wieder offen.',
    erledigt: (g) => `Gemeldet. ${vorname(g.wer)} muss noch bestätigen.`,
    bestaetigen: (g) => istLive() ? 'Bestätigt. Danke, dass ihr euch geholfen habt!' : `${euro(auszahlung(g))} ausgezahlt`,
    rueckzug: () => 'Gesuch zurückgezogen'
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
        meldung(ERFOLG[a](g));
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
  $('#sheet').addEventListener('submit', async (e) => {
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
    if (reg && !$('#auth-18').checked) return zeigeFehler('Nachbarhand ist erst ab 18 Jahren.', $('#auth-18'));
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
            emailRedirectTo: location.origin + location.pathname,
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
    if (e.key === 'Escape' && (ui.offen || ui.panel)) schliessen();
  });

  /* ===== Klicks auf Listen und Filter ===== */
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { gehe(go.dataset.go); return; }
    const panel = e.target.closest('[data-panel]');
    if (panel) { oeffnePanel(panel.dataset.panel); return; }
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

  /* ===== Gesuch erstellen ===== */
  const form = $('#neu-form');
  const betragInput = $('#neu-betrag');
  $('#neu-kategorien').innerHTML = KATEGORIEN.map((k, i) =>
    `<label class="chip-radio"><input type="radio" name="kat" id="neu-kat-${k.id}" value="${k.id}" ${i === 0 ? 'checked' : ''}><span class="chip">${icon(k.id, 'i-sm')}${k.name}</span></label>`
  ).join('');
  $('#neu-schnell').innerHTML = [10, 15, 20, 30].map((n) =>
    `<button type="button" class="chip" data-schnell="${n}">${n} €</button>`
  ).join('');

  const betragWert = () => { const v = parseInt(betragInput.value, 10); return Number.isFinite(v) ? v : NaN; };
  const betragGueltig = (b) => b >= CONFIG.minBetrag && b <= CONFIG.maxBetrag;
  function renderKosten() {
    const b = betragWert();
    const el = $('#neu-kosten');
    if (!betragGueltig(b)) {
      el.innerHTML = `<div class="kosten-zeile"><span>Betrag zwischen ${CONFIG.minBetrag} und ${CONFIG.maxBetrag} € wählen</span></div>`;
      return;
    }
    if (istLive()) {
      el.innerHTML = `
        <div class="kosten-zeile kosten-summe" style="border:0;padding:0;margin:0"><span>Du zahlst direkt</span><span>${euro(b)}</span></div>
        <span class="kosten-hinweis">Die Aufwandsentschädigung gibst du der Person, die dir hilft. Nachbarhand nimmt in der Testphase keine Gebühr.</span>`;
      return;
    }
    const g = CONFIG.gebuehrAuftraggeber;
    el.innerHTML = `
      <div class="kosten-zeile"><span>Aufwandsentschädigung</span><span>${euro(b)}</span></div>
      <div class="kosten-zeile"><span>Servicegebühr</span><span>${euro(g)}</span></div>
      <div class="kosten-zeile kosten-summe"><span>Du zahlst</span><span>${euro(b + g)}</span></div>
      <span class="kosten-hinweis">Abgebucht wird erst, wenn du den erledigten Job bestätigst.</span>`;
  }
  function setzeBetrag(b) {
    betragInput.value = Math.min(CONFIG.maxBetrag, Math.max(CONFIG.minBetrag, b));
    betragInput.removeAttribute('aria-invalid');
    $('#fehler-betrag').hidden = true;
    renderKosten();
  }
  form.addEventListener('click', (e) => {
    const s = e.target.closest('[data-step]');
    if (s) { const b = betragWert(); setzeBetrag((Number.isFinite(b) ? b : 15) + Number(s.dataset.step)); return; }
    const q = e.target.closest('[data-schnell]');
    if (q) setzeBetrag(Number(q.dataset.schnell));
  });
  betragInput.addEventListener('input', renderKosten);
  $('#neu-titel').addEventListener('input', (e) => {
    if (e.target.value.trim().length >= 3) { e.target.removeAttribute('aria-invalid'); $('#fehler-titel').hidden = true; }
  });
  $('#neu-adresse').addEventListener('input', (e) => {
    if (e.target.value.trim().length >= 3) { e.target.removeAttribute('aria-invalid'); $('#fehler-adresse').hidden = true; }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titel = $('#neu-titel').value.trim();
    const adresse = $('#neu-adresse').value.trim();
    const b = betragWert();
    let ersterFehler = null;
    $('#neu-fehler').hidden = true;
    if (titel.length < 3) {
      $('#neu-titel').setAttribute('aria-invalid', 'true'); $('#fehler-titel').hidden = false;
      ersterFehler = ersterFehler || $('#neu-titel');
    }
    if (istLive() && adresse.length < 3) {
      $('#neu-adresse').setAttribute('aria-invalid', 'true'); $('#fehler-adresse').hidden = false;
      ersterFehler = ersterFehler || $('#neu-adresse');
    }
    if (!betragGueltig(b)) {
      betragInput.setAttribute('aria-invalid', 'true'); $('#fehler-betrag').hidden = false;
      ersterFehler = ersterFehler || betragInput;
    }
    if (ersterFehler) { ersterFehler.focus(); return; }
    if (istLive() && !db.profil) {
      oeffnePanel('anmelden', 'Melde dich an, um dein Gesuch zu veröffentlichen. Deine Eingaben bleiben erhalten.');
      return;
    }

    const kat = form.querySelector('input[name="kat"]:checked').value;
    const stadtteil = $('#neu-stadtteil').value;
    const wann = `${$('#neu-tag').value}, ${$('#neu-zeit').value}`;
    const text = $('#neu-text').value.trim();
    let neuId;

    if (istLive()) {
      const knopf = $('#neu-senden');
      knopf.disabled = true;
      knopf.setAttribute('aria-busy', 'true');
      try {
        const { data, error } = await db.client.rpc('gesuch_erstellen', {
          p_kategorie: kat, p_titel: titel, p_beschreibung: text, p_betrag: b,
          p_wann: wann, p_stadtteil: stadtteil, p_adresse: adresse
        });
        if (error) throw error;
        neuId = data;
        db.adressen.set(neuId, adresse);
        await neuLaden();
      } catch (err) {
        $('#neu-fehler').textContent = fehlerText(err);
        $('#neu-fehler').hidden = false;
        return;
      } finally {
        knopf.disabled = false;
        knopf.removeAttribute('aria-busy');
      }
    } else {
      const anzahlEigene = gesuche.filter((g) => g.eigen).length;
      const [nord, ost] = EIGEN_VERSATZ[anzahlEigene % EIGEN_VERSATZ.length];
      const basis = stadtteil === CONFIG.ich.stadtteil ? CONFIG.ich : STADTTEILE.find((s) => s.name === stadtteil);
      const pos = versetze(basis, nord, ost);
      neuId = 'e' + Date.now();
      gesuche.unshift({
        id: neuId, eigen: true, kat, titel, wer: 'Du', initialen: CONFIG.ich.initialen, betrag: b,
        stadtteil, lat: pos.lat, lng: pos.lng, wann, dauer: 'nach Absprache', text,
        adresse: adresse || stadtteil, status: 'offen', erstellt: Date.now()
      });
      demoSpeichern();
    }

    form.reset();
    renderStadtteilAuswahl();
    renderKosten();
    ui.kat = 'alle'; ui.suche = ''; $('#suche').value = '';
    ui.zentrieren = neuId;
    renderAlles();
    gehe('karte');
    oeffnen(neuId);
    meldung('Gesuch veröffentlicht');
  });

  /* ===== Start ===== */
  gesuche = demoLaden();
  const start = location.hash.slice(1);
  renderStadtteilAuswahl();
  renderAlles();
  renderKosten();
  zeige(VIEWS.includes(start) ? start : 'entdecken');
  starteLive().then((live) => {
    if (!live) return;
    renderStadtteilAuswahl();
    renderKosten();
  });
})();
