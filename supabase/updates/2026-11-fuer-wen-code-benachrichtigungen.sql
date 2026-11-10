-- Hand Drauf: Datenbank-Update November 2026, Teil 4 (eingespielt am 10. November 2026)
-- * Für jemand anderen anfragen (z. B. für die eigene Mutter) und freiwillige Telefonnummer zum Anrufen
-- * Sicherheits-Code für die Tür, sobald jemand zusagt
-- * Zähler für die Startseite („Diese Woche 12× geholfen“)
-- * Benachrichtigungen aufs Handy (Web Push)
-- Kann gefahrlos mehrfach laufen. Alles hier steht auch in schema.sql.

-- Für Projekte, die vor „Für jemand anderen“ und dem Sicherheits-Code angelegt wurden
alter table public.gesuche add column if not exists fuer text not null default '';
alter table public.gesuche drop constraint if exists gesuche_fuer_check;
alter table public.gesuche add constraint gesuche_fuer_check check (char_length(fuer) <= 40);
alter table public.gesuche add column if not exists tuercode text;
alter table public.gesuche drop constraint if exists gesuche_tuercode_check;
alter table public.gesuche add constraint gesuche_tuercode_check check (tuercode is null or tuercode ~ '^[0-9]{4}$');

-- Telefonnummer neben der Adresse: sehen nur die beiden Beteiligten
alter table public.gesuch_adressen add column if not exists telefon text not null default '';
alter table public.gesuch_adressen drop constraint if exists gesuch_adressen_telefon_check;
alter table public.gesuch_adressen add constraint gesuch_adressen_telefon_check check (telefon ~ '^[0-9 +()/-]{0,30}$');

-- Vierstelliger Sicherheits-Code für die Tür (aus einer Zufalls-UUID, also nicht vorhersagbar)
create or replace function privat.neuer_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))::bit(28)::int) % 10000)::text, 4, '0');
$$;

-- Einstellungen, die nicht im öffentlichen Code stehen dürfen (Schlüssel für Benachrichtigungen).
-- Über die API nicht erreichbar, nur die Funktionen unten lesen sie.
create table if not exists privat.einstellungen (
  name text primary key,
  wert text not null
);
alter table privat.einstellungen enable row level security;
revoke all on privat.einstellungen from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Benachrichtigungen aufs Handy (Web Push)
-- Jedes Gerät, auf dem jemand Benachrichtigungen einschaltet, bekommt von seinem
-- Browser eine eigene Adresse beim Dienst des Herstellers (Google, Apple, Mozilla,
-- Microsoft). Die Adressen kann über die App niemand lesen.
-- ---------------------------------------------------------------------
create table if not exists public.push_abos (
  endpoint text primary key check (char_length(endpoint) between 20 and 1000),
  profil uuid not null references public.profile (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 40),
  neue_anfragen boolean not null default false,  -- auch bei neuen Anfragen im eigenen Stadtteil
  zuletzt_neu timestamptz,                       -- letzte Benachrichtigung über eine neue Anfrage (höchstens alle 20 Minuten)
  getestet timestamptz,
  erstellt timestamptz not null default now()
);
create index if not exists push_abos_profil_idx on public.push_abos (profil);
alter table public.push_abos enable row level security;
revoke all on public.push_abos from anon, authenticated;

-- Laufende Sendungen an die Edge Function, um abgemeldete Geräte danach zu löschen
create table if not exists privat.push_anfragen (
  id bigint primary key,
  erstellt timestamptz not null default now()
);
alter table privat.push_anfragen enable row level security;
revoke all on privat.push_anfragen from public, anon, authenticated;

-- pg_net schickt Anfragen aus der Datenbank ins Netz, ohne dass ein Auftrag darauf warten muss
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    -- bei Supabase wie die anderen Erweiterungen im Schema „extensions“, die Funktionen liegen in „net“
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension if not exists pg_net with schema extensions;
    else
      create extension if not exists pg_net;
    end if;
  end if;
end;
$$;

-- Neues Gesuch
-- Telefonnummer prüfen: leer oder 6 bis 20 Ziffern, erlaubt sind Leerzeichen und + ( ) / -
create or replace function public.telefon_pruefen(p_telefon text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := btrim(coalesce(p_telefon, ''));
begin
  if t = '' then
    return '';
  end if;
  if t !~ '^[0-9 +()/-]{6,30}$' or char_length(regexp_replace(t, '[^0-9]', '', 'g')) not between 6 and 20 then
    raise exception 'Bitte prüfe die Telefonnummer.';
  end if;
  return t;
end;
$$;

drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text);
drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text, date);
create or replace function public.gesuch_erstellen(
  p_kategorie text,
  p_titel text,
  p_beschreibung text,
  p_betrag integer,
  p_wann text,
  p_stadtteil text,
  p_adresse text,
  p_bis date default null,
  p_fuer text default '',
  p_telefon text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  lage record;
  neu uuid;
  v_fuer text := btrim(coalesce(p_fuer, ''));
  v_telefon text := public.telefon_pruefen(p_telefon);
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into lage from public.ungefaehre_lage(p_stadtteil);
  if (select count(*) from public.gesuche
      where ersteller = ich and status in ('offen', 'zugesagt', 'erledigt')) >= 5 then
    raise exception 'Du hast schon 5 laufende Anfragen. Schließe zuerst eine ab.';
  end if;
  if char_length(btrim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Bitte gib deine Straße und Hausnummer an.';
  end if;
  perform public.termin_pruefen(p_bis);
  if char_length(v_fuer) > 40 then
    raise exception 'Der Name ist zu lang (höchstens 40 Zeichen).';
  end if;
  if privat.anstoessig(p_titel || ' ' || coalesce(p_beschreibung, '') || ' ' || v_fuer) then
    raise exception 'Bitte formuliere deine Anfrage ohne beleidigende oder anstößige Wörter.';
  end if;

  insert into public.gesuche (ersteller, kategorie, titel, beschreibung, betrag, wann, bis, laeuft_ab, stadtteil, lat, lng, fuer)
  values (
    ich,
    p_kategorie,
    btrim(p_titel),
    btrim(coalesce(p_beschreibung, '')),
    p_betrag,
    btrim(p_wann),
    p_bis,
    public.ablauf(p_bis),
    p_stadtteil,
    lage.lat,
    lage.lng,
    v_fuer
  )
  returning id into neu;

  insert into public.gesuch_adressen (gesuch_id, adresse, telefon) values (neu, btrim(p_adresse), v_telefon);
  return neu;
end;
$$;

-- Eigenes Gesuch bearbeiten, solange noch niemand zugesagt hat. Mit neuem Termin
-- wird ein abgelaufenes Gesuch wieder sichtbar. Neuer Stadtteil = neue ungefähre Lage.
drop function if exists public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date);
create or replace function public.gesuch_bearbeiten(
  p_id uuid,
  p_kategorie text,
  p_titel text,
  p_beschreibung text,
  p_betrag integer,
  p_wann text,
  p_stadtteil text,
  p_adresse text,
  p_bis date default null,
  p_fuer text default '',
  p_telefon text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
  lage record;
  v_fuer text := btrim(coalesce(p_fuer, ''));
  v_telefon text := public.telefon_pruefen(p_telefon);
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into g from public.gesuche where id = p_id for update;
  if not found or g.ersteller <> ich then
    raise exception 'Nur eigene Anfragen können bearbeitet werden.';
  end if;
  if g.status <> 'offen' then
    raise exception 'Bearbeiten geht nur, solange noch niemand zugesagt hat.';
  end if;
  if char_length(btrim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Bitte gib deine Straße und Hausnummer an.';
  end if;
  perform public.termin_pruefen(p_bis);
  if char_length(v_fuer) > 40 then
    raise exception 'Der Name ist zu lang (höchstens 40 Zeichen).';
  end if;
  if privat.anstoessig(p_titel || ' ' || coalesce(p_beschreibung, '') || ' ' || v_fuer) then
    raise exception 'Bitte formuliere deine Anfrage ohne beleidigende oder anstößige Wörter.';
  end if;
  if p_stadtteil is distinct from g.stadtteil then
    select * into lage from public.ungefaehre_lage(p_stadtteil);
  else
    select g.lat as lat, g.lng as lng into lage;
  end if;

  update public.gesuche set
    kategorie = p_kategorie,
    titel = btrim(p_titel),
    beschreibung = btrim(coalesce(p_beschreibung, '')),
    betrag = p_betrag,
    wann = btrim(p_wann),
    bis = p_bis,
    laeuft_ab = public.ablauf(p_bis),
    stadtteil = p_stadtteil,
    lat = lage.lat,
    lng = lage.lng,
    fuer = v_fuer,
    geaendert = now()
  where id = p_id;

  insert into public.gesuch_adressen (gesuch_id, adresse, telefon) values (p_id, btrim(p_adresse), v_telefon)
  on conflict (gesuch_id) do update set adresse = excluded.adresse, telefon = excluded.telefon;
end;
$$;

-- Helfen. Grenzen für Nachbarschaftshilfe: höchstens 8 Aufträge in 30 Tagen
-- und höchstens 2 für dieselbe Person in 30 Tagen (keine Daueraufträge).
create or replace function public.gesuch_zusagen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if not coalesce((select volljaehrig from public.profile where id = ich), false) then
    raise exception 'Helfen kannst du erst ab 18 Jahren.';
  end if;
  select * into g from public.gesuche where id = p_id for update;
  if not found or g.status <> 'offen' then
    raise exception 'Diese Anfrage ist nicht mehr offen.';
  end if;
  if g.laeuft_ab <= now() then
    raise exception 'Diese Anfrage ist abgelaufen.';
  end if;
  if g.ersteller = ich then
    raise exception 'Bei deiner eigenen Anfrage kannst du nicht helfen.';
  end if;
  if privat.ist_blockiert(ich, g.ersteller) then
    raise exception 'Diese Anfrage ist nicht mehr offen.';
  end if;
  if (select count(*) from public.gesuche
      where helfer = ich and status <> 'zurueckgezogen'
        and geaendert > now() - interval '30 days') >= 8 then
    raise exception 'Du hast in den letzten 30 Tagen schon 8 Aufträge übernommen. Für mehr brauchst du ein Gewerbe.';
  end if;
  if (select count(*) from public.gesuche
      where helfer = ich and ersteller = g.ersteller
        and geaendert > now() - interval '30 days') >= 2 then
    raise exception 'Nachbarschaftshilfe bleibt gelegentlich: Für diese Person hast du in den letzten 30 Tagen schon zweimal geholfen.';
  end if;
  -- Sicherheits-Code für die Tür: Den kennen ab jetzt nur diese beiden
  update public.gesuche set status = 'zugesagt', helfer = ich, tuercode = privat.neuer_code(), geaendert = now() where id = p_id;
end;
$$;

-- Zusage zurückziehen (nur wer zugesagt hat, solange noch nicht erledigt)
create or replace function public.gesuch_absagen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gesuche set status = 'offen', helfer = null, tuercode = null, geaendert = now()
  where id = p_id and status = 'zugesagt' and helfer = auth.uid();
  if not found then
    raise exception 'Diese Zusage kannst du nicht mehr zurückziehen.';
  end if;
  -- Der nächste Helfer soll den alten Verlauf nicht sehen
  delete from public.nachrichten where gesuch_id = p_id;
end;
$$;

-- Person blockieren. Laufende Zusagen zwischen beiden enden: Die Anfrage ist wieder offen,
-- der Nachrichtenverlauf wird gelöscht.
create or replace function public.blockieren(p_person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if p_person is null or p_person = ich or not exists (select 1 from public.profile where id = p_person) then
    raise exception 'Diese Person gibt es nicht.';
  end if;
  insert into public.blockiert (von, wen) values (ich, p_person) on conflict do nothing;
  delete from public.nachrichten where gesuch_id in (
    select id from public.gesuche
    where status = 'zugesagt' and ((ersteller = ich and helfer = p_person) or (ersteller = p_person and helfer = ich)));
  update public.gesuche set status = 'offen', helfer = null, tuercode = null, geaendert = now()
  where status = 'zugesagt' and ((ersteller = ich and helfer = p_person) or (ersteller = p_person and helfer = ich));
end;
$$;

-- Eigenes Konto löschen (Recht auf Löschung, Art. 17 DSGVO).
-- Laufende Zusagen werden freigegeben, damit andere ihre Gesuche wieder ausschreiben können.
-- Profil, eigene Gesuche, Adressen, Nachrichten und Bewertungen fallen per Kaskade weg.
create or replace function public.konto_loeschen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  delete from public.nachrichten
  where gesuch_id in (select id from public.gesuche where helfer = ich and status = 'zugesagt');
  update public.gesuche set status = 'offen', helfer = null, tuercode = null, geaendert = now()
  where helfer = ich and status = 'zugesagt';
  delete from auth.users where id = ich;
end;
$$;

-- Zahlen für die Startseite: Wie oft wurde geholfen? Nur Summen, keine Namen.
create or replace function public.statistik()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'woche', (select count(*) from public.gesuche where status = 'bestaetigt' and geaendert > now() - interval '7 days'),
    'gesamt', (select count(*) from public.gesuche where status = 'bestaetigt')
  );
$$;

-- ---------------------------------------------------------------------
-- Benachrichtigungen: senden, an- und abmelden, Auslöser
-- ---------------------------------------------------------------------

-- Antworten der Edge Function auswerten: Geräte, die es nicht mehr gibt, werden gelöscht
create or replace function privat.push_aufraeumen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if to_regclass('net._http_response') is null then
    return;
  end if;
  for r in
    select a.id, h.status_code, h.content
    from privat.push_anfragen a join net._http_response h on h.id = a.id
  loop
    if r.status_code = 200 and r.content is not null then
      begin
        delete from public.push_abos
        where endpoint in (select jsonb_array_elements_text((r.content::jsonb) -> 'weg'));
      exception when others then
        null;
      end;
    end if;
    delete from privat.push_anfragen where id = r.id;
  end loop;
  delete from privat.push_anfragen where erstellt < now() - interval '1 day';
end;
$$;

-- Benachrichtigung an alle Geräte der Empfänger schicken. Die Edge Function „push“ verschlüsselt
-- und übergibt sie an den Dienst des jeweiligen Browsers. Fehler hier dürfen nie einen Auftrag aufhalten.
-- p_art: '' = immer (Zusage, Nachricht, erledigt …), 'stamm' = neue Anfrage von jemandem, dem man
-- schon geholfen hat, 'neu' = neue Anfrage im Stadtteil (nur Geräte, die das eingeschaltet haben).
-- Über neue Anfragen gibt es je Gerät höchstens alle 20 Minuten eine Benachrichtigung.
create or replace function privat.push_senden(
  p_empfaenger uuid[],
  p_titel text,
  p_text text,
  p_link text,
  p_tag text,
  p_art text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_schluessel text;
  v_jwt text;
  abos jsonb;
  anfrage bigint;
begin
  if p_empfaenger is null or cardinality(p_empfaenger) = 0 or to_regnamespace('net') is null then
    return;
  end if;
  select wert into v_url from privat.einstellungen where name = 'push_url';
  select wert into v_schluessel from privat.einstellungen where name = 'push_schluessel';
  -- Die Edge Function prüft wie alle Supabase-Funktionen ein JWT (der öffentliche anon-Schlüssel reicht).
  -- Senden darf sie trotzdem nur mit dem privaten Schlüssel oben.
  select wert into v_jwt from privat.einstellungen where name = 'push_jwt';
  if v_url is null or v_schluessel is null then
    return;
  end if;
  perform privat.push_aufraeumen();

  select jsonb_agg(jsonb_build_object('endpoint', a.endpoint, 'p256dh', a.p256dh, 'auth', a.auth)) into abos
  from (
    select endpoint, p256dh, auth from public.push_abos
    where profil = any (p_empfaenger)
      and (p_art <> 'neu' or neue_anfragen)
      and (p_art = '' or zuletzt_neu is null or zuletzt_neu < now() - interval '20 minutes')
    order by erstellt desc
    limit 300
  ) a;
  if abos is null then
    return;
  end if;
  if p_art <> '' then
    update public.push_abos set zuletzt_neu = now()
    where profil = any (p_empfaenger)
      and (p_art <> 'neu' or neue_anfragen)
      and (zuletzt_neu is null or zuletzt_neu < now() - interval '20 minutes');
  end if;

  select net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'schluessel', v_schluessel::jsonb,
      'abos', abos,
      'nachricht', jsonb_build_object('t', p_titel, 'b', p_text, 'l', p_link, 'g', p_tag)),
    headers := jsonb_build_object('Content-Type', 'application/json')
      || case when v_jwt is null then '{}'::jsonb else jsonb_build_object('Authorization', 'Bearer ' || v_jwt) end,
    timeout_milliseconds := 8000
  ) into anfrage;
  insert into privat.push_anfragen (id) values (anfrage) on conflict do nothing;
exception when others then
  raise warning 'Benachrichtigung nicht gesendet: %', sqlerrm;
end;
$$;

-- Gerät für Benachrichtigungen anmelden (oder Einstellungen ändern). Erlaubt sind nur die
-- Adressen der bekannten Dienste von Google, Mozilla, Apple und Microsoft.
create or replace function public.push_anmelden(p_endpoint text, p_p256dh text, p_auth text, p_neue boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://((([a-z0-9-]+\.)*google\.com)|(([a-z0-9-]+\.)*googleapis\.com)|(updates\.push\.services\.mozilla\.com)|([a-z0-9-]+\.push\.apple\.com)|(([a-z0-9-]+\.)+notify\.windows\.com))/' then
    raise exception 'Dieser Browser wird für Benachrichtigungen noch nicht unterstützt.';
  end if;
  insert into public.push_abos (endpoint, profil, p256dh, auth, neue_anfragen)
  values (p_endpoint, ich, p_p256dh, p_auth, coalesce(p_neue, false))
  on conflict (endpoint) do update
    set profil = excluded.profil, p256dh = excluded.p256dh, auth = excluded.auth, neue_anfragen = excluded.neue_anfragen;
  -- höchstens 5 Geräte pro Person, die ältesten fallen weg
  delete from public.push_abos
  where profil = ich
    and endpoint not in (select endpoint from public.push_abos where profil = ich order by erstellt desc limit 5);
end;
$$;

-- Gerät abmelden (beim Ausschalten und beim Abmelden)
create or replace function public.push_abmelden(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  delete from public.push_abos where endpoint = p_endpoint and profil = auth.uid();
end;
$$;

-- Test-Benachrichtigung an die eigenen Geräte
create or replace function public.push_test()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if not exists (select 1 from public.push_abos where profil = ich) then
    raise exception 'Auf diesem Gerät sind Benachrichtigungen noch nicht eingeschaltet.';
  end if;
  if exists (select 1 from public.push_abos where profil = ich and getestet > now() - interval '20 seconds') then
    raise exception 'Warte kurz, bevor du noch einen Test schickst.';
  end if;
  update public.push_abos set getestet = now() where profil = ich;
  perform privat.push_senden(array[ich], 'Hand Drauf', 'So sieht eine Benachrichtigung aus. Alles eingerichtet!', '', 'test');
end;
$$;

-- Auslöser: neue Anfrage und jeder Schritt eines Auftrags. Wer den Schritt selbst macht, bekommt nichts.
create or replace function privat.push_gesuch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  link text := 'anfrage-' || new.id;
  wer text;
  hilft text;
  stamm uuid[];
  nachbarn uuid[];
  kurz text := new.titel || ' · ' || new.wann || ' · ' || new.betrag || ' €';
begin
  select vorname into wer from public.profile where id = new.ersteller;
  if tg_op = 'INSERT' then
    if new.status = 'offen' then
      -- Wer dieser Person schon einmal geholfen hat, erfährt es zuerst
      select array_agg(distinct g.helfer) into stamm
      from public.gesuche g
      where g.ersteller = new.ersteller and g.status = 'bestaetigt' and g.helfer is not null
        and not privat.ist_blockiert(g.helfer, new.ersteller);
      perform privat.push_senden(stamm, coalesce(wer, 'Jemand') || ' sucht wieder Hilfe', kurz, link, 'neu-' || new.id, 'stamm');
      -- Danach alle im Stadtteil, die neue Anfragen sehen wollen
      select array_agg(p.id) into nachbarn
      from public.profile p
      where p.stadtteil = new.stadtteil and p.id <> new.ersteller
        and not (p.id = any (coalesce(stamm, '{}')))
        and not privat.ist_blockiert(p.id, new.ersteller)
        and exists (select 1 from public.push_abos a where a.profil = p.id and a.neue_anfragen);
      perform privat.push_senden(nachbarn, 'Neu in ' || new.stadtteil, kurz, link, 'neu-' || new.id, 'neu');
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;
  select vorname into hilft from public.profile where id = coalesce(new.helfer, old.helfer);
  if new.status = 'zugesagt' and old.status = 'offen' then
    perform privat.push_senden(array[new.ersteller], coalesce(hilft, 'Jemand') || ' hilft dir',
      '„' || new.titel || '“ · ' || new.wann || '. Tippe, um euch abzusprechen.', link, 'auftrag-' || new.id);
  elsif new.status = 'offen' and old.status = 'zugesagt' then
    if ich is distinct from new.ersteller then
      perform privat.push_senden(array[new.ersteller], 'Zusage zurückgezogen',
        '„' || new.titel || '“ ist wieder offen. Andere Nachbarn können jetzt zusagen.', link, 'auftrag-' || new.id);
    end if;
  elsif new.status = 'erledigt' and old.status = 'zugesagt' then
    perform privat.push_senden(array[new.ersteller], coalesce(hilft, 'Dein Helfer') || ' ist fertig',
      '„' || new.titel || '“: Bitte bestätige, dass alles erledigt ist.', link, 'auftrag-' || new.id);
  elsif new.status = 'bestaetigt' and old.status = 'erledigt' and new.helfer is not null then
    perform privat.push_senden(array[new.helfer], 'Hand drauf!',
      coalesce(wer, 'Dein Nachbar') || ' hat „' || new.titel || '“ bestätigt. Danke fürs Helfen!', link, 'auftrag-' || new.id);
  end if;
  return new;
exception when others then
  raise warning 'Benachrichtigung zum Auftrag nicht gesendet: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_bei_gesuch on public.gesuche;
create trigger push_bei_gesuch
  after insert or update of status on public.gesuche
  for each row execute function privat.push_gesuch();

-- Auslöser: neue Nachricht. Der Text selbst steht nicht in der Benachrichtigung.
create or replace function privat.push_nachricht()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.gesuche%rowtype;
  an uuid;
  wer text;
begin
  select * into g from public.gesuche where id = new.gesuch_id;
  if not found then
    return new;
  end if;
  an := case when new.von = g.ersteller then g.helfer else g.ersteller end;
  if an is null or an = new.von then
    return new;
  end if;
  select vorname into wer from public.profile where id = new.von;
  perform privat.push_senden(array[an], 'Neue Nachricht von ' || coalesce(wer, 'deinem Nachbarn'),
    'Zu „' || g.titel || '“. Tippe, um zu antworten.', 'anfrage-' || g.id, 'nachricht-' || g.id);
  return new;
exception when others then
  raise warning 'Benachrichtigung zur Nachricht nicht gesendet: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists push_bei_nachricht on public.nachrichten;
create trigger push_bei_nachricht
  after insert on public.nachrichten
  for each row execute function privat.push_nachricht();

revoke execute on all functions in schema privat from public, anon, authenticated;
grant execute on function privat.ist_blockiert(uuid, uuid) to anon, authenticated;

-- Rechte
revoke execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text) from public, anon;
revoke execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text) from public, anon;
revoke execute on function public.gesuch_zusagen(uuid) from public, anon;
revoke execute on function public.gesuch_absagen(uuid) from public, anon;
revoke execute on function public.konto_loeschen() from public, anon;
revoke execute on function public.blockieren(uuid) from public, anon;
revoke execute on function public.push_anmelden(text, text, text, boolean) from public, anon;
revoke execute on function public.push_abmelden(text) from public, anon;
revoke execute on function public.push_test() from public, anon;
revoke execute on function public.telefon_pruefen(text) from public, anon, authenticated;
grant execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text) to authenticated;
grant execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text) to authenticated;
grant execute on function public.gesuch_zusagen(uuid) to authenticated;
grant execute on function public.gesuch_absagen(uuid) to authenticated;
grant execute on function public.konto_loeschen() to authenticated;
grant execute on function public.blockieren(uuid) to authenticated;
grant execute on function public.push_anmelden(text, text, text, boolean) to authenticated;
grant execute on function public.push_abmelden(text) to authenticated;
grant execute on function public.push_test() to authenticated;
revoke execute on function public.statistik() from public;
grant execute on function public.statistik() to anon, authenticated;
