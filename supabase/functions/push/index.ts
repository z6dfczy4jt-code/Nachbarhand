// Hand Drauf: verschickt Benachrichtigungen aufs Handy (Web Push).
//
// Die Datenbank ruft diese Funktion auf, sobald jemand zusagt, schreibt oder ein Auftrag
// erledigt ist (siehe privat.push_senden in supabase/schema.sql). Die Funktion speichert
// nichts: Sie verschlüsselt die kurze Nachricht für jedes Gerät und gibt sie an den Dienst
// des jeweiligen Browsers weiter (Google, Apple, Mozilla, Microsoft).
//
// Senden darf nur, wer den privaten Schlüssel zu ERLAUBT mitschickt. Der liegt allein in der
// Datenbank (privat.einstellungen) und steht nirgends im Code.
import { neuesPaar, schluesselLaden, senden } from './webpush.js';

// Öffentlicher Schlüssel dieser App (derselbe wie CONFIG.push in src/app.js).
// Leer = noch nicht eingerichtet, siehe SETUP.md.
const ERLAUBT = 'BAeSkBv6_TrKXn_vTxc3F5qJOLIJ2bIjB3ro4IFlHjX32LlpKFu4quz2Wr5DVsCatqeKFvXfYHgCZRPQr29zAuc';
// Ansprechpartner für die Push-Dienste, falls mit den Sendungen etwas nicht stimmt
const KONTAKT = 'https://z6dfczy4jt-code.github.io/Nachbarhand/';

function antwort(inhalt: unknown, status = 200): Response {
  return new Response(JSON.stringify(inhalt), { status, headers: { 'Content-Type': 'application/json' } });
}

const kurz = (wert: unknown, laenge: number) => String(wert ?? '').slice(0, laenge);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return antwort({ fehler: 'Nur POST' }, 405);
  // deno-lint-ignore no-explicit-any
  let eingabe: any;
  try {
    const roh = await req.text();
    if (roh.length > 400000) return antwort({ fehler: 'Zu groß' }, 413);
    eingabe = JSON.parse(roh);
  } catch (_e) {
    return antwort({ fehler: 'Kein JSON' }, 400);
  }

  if (!ERLAUBT) {
    // Einrichtung: einmal ein Schlüsselpaar erzeugen. Danach wird ERLAUBT eingetragen und dieser Weg ist zu.
    if (eingabe && eingabe.neu === true) return antwort(await neuesPaar());
    return antwort({ fehler: 'Noch nicht eingerichtet' }, 503);
  }

  let geladen;
  try {
    geladen = await schluesselLaden(eingabe && eingabe.schluessel, ERLAUBT);
  } catch (_e) {
    return antwort({ fehler: 'Nicht erlaubt' }, 403);
  }

  const abos = Array.isArray(eingabe.abos) ? eingabe.abos.slice(0, 300) : [];
  const n = eingabe.nachricht || {};
  const marke = kurz(n.g, 60);
  // t = Titel, b = Text, l = Sprungziel in der App, g = Marke (gleiche Marke ersetzt die ältere Benachrichtigung)
  const text = JSON.stringify({ t: kurz(n.t, 80), b: kurz(n.b, 240), l: kurz(n.l, 80), g: marke });
  // Hinweise auf neue Anfragen dürfen warten, bis das Handy ohnehin wach ist
  const dringend = !marke.startsWith('neu-');

  const weg: string[] = [];
  const status: Record<string, number> = {};
  let gesendet = 0;
  let fehler = 0;
  for (let i = 0; i < abos.length; i += 25) {
    const teil = abos.slice(i, i + 25);
    // deno-lint-ignore no-explicit-any
    const ergebnisse = await Promise.all(teil.map((abo: any) => senden(geladen, abo, text, { kontakt: KONTAKT, dringend })));
    ergebnisse.forEach((e, j) => {
      status[String(e.status)] = (status[String(e.status)] || 0) + 1;
      if (e.ergebnis === 'ok') gesendet++;
      else if (e.ergebnis === 'weg') weg.push(String(teil[j].endpoint));
      else fehler++;
    });
  }
  return antwort({ gesendet, weg, fehler, status });
});
