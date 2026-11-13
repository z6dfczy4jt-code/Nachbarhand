-- Hand Drauf: Datenbank-Update November 2026, Teil 10: Ab 16 Jahren
-- * Bei der Anmeldung gibt man das Geburtsdatum an. Wer 16 oder 17 ist, darf mit Zustimmung der Eltern
--   helfen, nach den Regeln der Taschengeldbörsen: keine Anfragen stellen, nur leichte Tätigkeiten
--   (nicht Tragen), nicht abends und nicht nur sonntags, höchstens 2 offene Zusagen, kein Profilbild.
--   Wer anfragt, entscheidet, ob auch Jugendliche helfen dürfen.
-- * Eltern stimmen über einen Link zu (ohne Konto), sehen die laufenden Aufträge mit Adresse und Zeit,
--   bekommen auf Wunsch Benachrichtigungen und können die Zustimmung zurückziehen.
-- * Profile von Jugendlichen sehen nur sie selbst und wer mit ihnen einen Auftrag hat.
-- * Mit 18 wird das Konto automatisch umgestellt und das Geburtsdatum gelöscht.
-- * Für alle: höchstens 29 Aufträge im Kalenderjahr (Plattformen-Steuertransparenzgesetz: unter 30
--   Aufträgen und 2.000 € muss niemand ans Finanzamt gemeldet werden).
-- Voraussetzung: Teil 5 bis 9 sind eingespielt. Kann gefahrlos mehrfach laufen. Alles hier steht auch in schema.sql.

create schema if not exists privat;

-- Jugendliche (16 und 17): Geburtsdatum (nur bis zum 18. Geburtstag, danach gelöscht) und die
-- Zustimmung der Eltern. Die Eltern bekommen einen Link; gespeichert wird nur sein Fingerabdruck (SHA-256).
create table if not exists privat.jugendliche (
  id uuid primary key references public.profile (id) on delete cascade,
  geburt date not null,
  eltern_schluessel text unique,                                         -- SHA-256 des Eltern-Links (hex)
  eltern_name text not null default '' check (char_length(eltern_name) <= 80),
  eltern_ok timestamptz,                                                 -- wann die Eltern zugestimmt haben
  link_erstellt timestamptz,
  erstellt timestamptz not null default now()
);
alter table privat.jugendliche enable row level security;
revoke all on privat.jugendliche from public, anon, authenticated;

-- Geräte der Eltern für Benachrichtigungen (ohne eigenes Konto, nur über den Eltern-Link)
create table if not exists privat.eltern_push (
  endpoint text primary key check (char_length(endpoint) between 20 and 1000),
  kind uuid not null references public.profile (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 40),
  erstellt timestamptz not null default now()
);
create index if not exists eltern_push_kind_idx on privat.eltern_push (kind);
alter table privat.eltern_push enable row level security;
revoke all on privat.eltern_push from public, anon, authenticated;

-- Ist die Person volljährig? (Ohne Nebenwirkung, für Zugriffsregeln.)
create or replace function privat.ist_erwachsen(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p is not null and (
    coalesce((select volljaehrig from public.profile where id = p), false)
    or exists (select 1 from privat.jugendliche j where j.id = p and j.geburt <= (current_date - interval '18 years')::date)
  );
$$;

-- Wie ist_erwachsen; wer inzwischen 18 ist, wird dabei umgestellt und das Geburtsdatum gelöscht.
create or replace function privat.erwachsen(p uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p is null then
    return false;
  end if;
  if coalesce((select volljaehrig from public.profile where id = p), false) then
    return true;
  end if;
  if exists (select 1 from privat.jugendliche j where j.id = p and j.geburt <= (current_date - interval '18 years')::date) then
    update public.profile set volljaehrig = true where id = p;
    delete from privat.jugendliche where id = p;
    return true;
  end if;
  return false;
end;
$$;

-- Täglich: Wer 18 geworden ist, gilt als erwachsen; das Geburtsdatum wird gelöscht.
create or replace function privat.volljaehrig_werden()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profile p set volljaehrig = true
  from privat.jugendliche j
  where j.id = p.id and j.geburt <= (current_date - interval '18 years')::date;
  delete from privat.jugendliche j
  using public.profile p
  where p.id = j.id and p.volljaehrig;
end;
$$;

-- Darf bei dieser Anfrage jemand mit 16 oder 17 helfen? Wie bei den Taschengeldbörsen: leichte
-- Tätigkeiten (nicht Tragen), nicht abends, Uhrzeit zwischen 8 und 16 Uhr (fertig bis 18 Uhr),
-- nicht nur an Sonntagen. Der Text kommt aus der Terminauswahl der App.
create or replace function privat.fuer_jugend(p_kategorie text, p_wann text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_kategorie is distinct from 'tragen'
    and coalesce(p_wann, '') !~* 'abends'
    and coalesce((substring(coalesce(p_wann, '') from 'gegen (\d{1,2})(?::\d\d)? Uhr'))::integer between 8 and 16, true)
    and coalesce((substring(coalesce(p_wann, '') from '\mab (\d{1,2})(?::\d\d)? Uhr'))::integer between 8 and 16, true)
    and not (coalesce(p_wann, '') ~ 'So\.' and coalesce(p_wann, '') !~ '(Mo|Di|Mi|Do|Fr|Sa)\.')
    and coalesce(p_wann, '') !~* '^sonntag';
$$;

-- Ab 16 Jahren: Darf bei dieser Anfrage auch jemand mit 16 oder 17 helfen? (Wählt, wer anfragt,
-- und nur wenn die Tätigkeit dafür passt.) Hat jemand mit 16 oder 17 zugesagt, sehen die Beteiligten das.
alter table public.gesuche add column if not exists jugend boolean not null default false;
alter table public.gesuche add column if not exists helfer_jugendlich boolean not null default false;

-- Hatten zwei Personen schon einmal einen gemeinsamen Auftrag (oder haben sie gerade einen)?
create or replace function privat.zusammen(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.gesuche g
    where (g.ersteller = a and g.helfer = b) or (g.ersteller = b and g.helfer = a)
  );
$$;

-- Profile von Erwachsenen sieht jeder. Profile von Jugendlichen nur sie selbst und wer mit ihnen
-- einen Auftrag hat (dort steht auch, dass sie 16 oder 17 sind).
drop policy if exists "Profile sind lesbar" on public.profile;
create policy "Profile sind lesbar" on public.profile
  for select to anon, authenticated
  using (volljaehrig or id = (select auth.uid()) or privat.zusammen((select auth.uid()), id));

create or replace function public.neues_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := left(regexp_replace(btrim(coalesce(new.raw_user_meta_data ->> 'stadtteil', '')), '\s+', ' ', 'g'), 60);
  v_lat double precision;
  v_lng double precision;
  v_geburt date;
  v_voll boolean;
  m record;
begin
  -- Ab 16 Jahren: Die App schickt das Geburtsdatum. Ältere Fassungen nur „volljaehrig“.
  begin
    v_geburt := (new.raw_user_meta_data ->> 'geburt')::date;
  exception when others then
    v_geburt := null;
  end;
  if v_geburt is not null and (v_geburt > current_date or v_geburt < date '1900-01-01') then
    v_geburt := null;
  end if;
  v_voll := case when v_geburt is not null then v_geburt <= (current_date - interval '18 years')::date
                 else coalesce(new.raw_user_meta_data ->> 'volljaehrig', '') = 'true' end;
  begin
    v_lat := (new.raw_user_meta_data ->> 'lat')::double precision;
    v_lng := (new.raw_user_meta_data ->> 'lng')::double precision;
  exception when others then
    v_lat := null; v_lng := null;
  end;
  if v_lat is null or v_lat not between 47.2 and 55.1 or v_lng not between 5.8 and 15.1 then
    -- Ältere Fassungen der App: Stadtteil von Garbsen aus der Liste
    select s.lat, s.lng into v_lat, v_lng from public.stadtteile s where s.name = st;
    if not found then
      st := 'Garbsen-Mitte';
      select s.lat, s.lng into v_lat, v_lng from public.stadtteile s where s.name = st;
    end if;
  end if;
  if char_length(st) < 2 or privat.anstoessig(st) then
    st := 'Mein Ort';
  end if;
  insert into public.profile (id, vorname, nachname_initial, stadtteil, volljaehrig)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'vorname'), ''), 'Nachbar'), 40),
    upper(left(btrim(coalesce(new.raw_user_meta_data ->> 'nachname_initial', '')), 1)),
    st,
    v_voll
  );
  -- 16 und 17: Geburtsdatum merken (bis zum 18. Geburtstag). Unter 16 geht nichts (die App lässt es nicht zu).
  if not v_voll and v_geburt is not null and v_geburt <= (current_date - interval '16 years')::date then
    insert into privat.jugendliche (id, geburt) values (new.id, v_geburt) on conflict (id) do nothing;
  end if;
  select * into m from privat.rasterpunkt(v_lat, v_lng);
  insert into privat.wohnorte (id, lat, lng) values (new.id, m.lat, m.lng) on conflict (id) do nothing;
  return new;
end;
$$;

drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text);
drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text, date);
drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text);
drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision);
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
  p_telefon text default '',
  p_lat double precision default null,
  p_lng double precision default null,
  p_jugend boolean default false
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
  if not privat.erwachsen(ich) then
    raise exception 'Anfragen stellen können nur Erwachsene. Du kannst bei Anfragen helfen.';
  end if;
  select * into lage from privat.lage_ungefaehr(p_stadtteil, p_lat, p_lng);
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

  insert into public.gesuche (ersteller, kategorie, titel, beschreibung, betrag, wann, bis, laeuft_ab, stadtteil, lat, lng, fuer, jugend)
  values (
    ich,
    p_kategorie,
    btrim(p_titel),
    btrim(coalesce(p_beschreibung, '')),
    p_betrag,
    btrim(p_wann),
    p_bis,
    public.ablauf(p_bis),
    privat.ortsname(p_stadtteil),
    lage.lat,
    lage.lng,
    v_fuer,
    coalesce(p_jugend, false) and privat.fuer_jugend(p_kategorie, p_wann)
  )
  returning id into neu;

  insert into public.gesuch_adressen (gesuch_id, adresse, telefon) values (neu, btrim(p_adresse), v_telefon);
  return neu;
end;
$$;

-- Eigenes Gesuch bearbeiten, solange noch niemand zugesagt hat. Mit neuem Termin
-- wird ein abgelaufenes Gesuch wieder sichtbar. Neuer Stadtteil = neue ungefähre Lage.
drop function if exists public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date);
drop function if exists public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text);
drop function if exists public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision);
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
  p_telefon text default '',
  p_lat double precision default null,
  p_lng double precision default null,
  p_jugend boolean default null
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
  if p_lat is not null or p_lng is not null or (p_stadtteil is distinct from g.stadtteil and exists (select 1 from public.stadtteile s where s.name = p_stadtteil)) then
    select * into lage from privat.lage_ungefaehr(p_stadtteil, p_lat, p_lng);
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
    stadtteil = privat.ortsname(p_stadtteil),
    lat = lage.lat,
    lng = lage.lng,
    fuer = v_fuer,
    -- ohne p_jugend (ältere App): bisherige Wahl behalten, aber nur wenn Tätigkeit und Termin passen
    jugend = coalesce(p_jugend, g.jugend) and privat.fuer_jugend(p_kategorie, p_wann),
    geaendert = now()
  where id = p_id;

  insert into public.gesuch_adressen (gesuch_id, adresse, telefon) values (p_id, btrim(p_adresse), v_telefon)
  on conflict (gesuch_id) do update set adresse = excluded.adresse, telefon = excluded.telefon;
end;
$$;

-- Helfen. Grenzen für Nachbarschaftshilfe: höchstens 8 Aufträge in 30 Tagen,
-- höchstens 2 für dieselbe Person in 30 Tagen (keine Daueraufträge) und höchstens 29 im
-- Kalenderjahr (unter 30 Verkäufen meldet eine Plattform niemanden ans Finanzamt, PStTG).
-- 16 und 17: nur mit Zustimmung der Eltern, nur bei Anfragen für Jugendliche, höchstens 2 offene Zusagen.
create or replace function public.gesuch_zusagen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
  erwachsen boolean;
  jung privat.jugendliche%rowtype;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  erwachsen := privat.erwachsen(ich);
  if not erwachsen then
    select * into jung from privat.jugendliche where id = ich;
    if not found then
      raise exception 'Helfen kannst du ab 16 Jahren, mit Zustimmung deiner Eltern.';
    end if;
    if jung.eltern_ok is null then
      raise exception 'Deine Eltern müssen erst zustimmen. Schick ihnen den Link aus „Dein Konto“.';
    end if;
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
  if not erwachsen then
    if not g.jugend or not privat.fuer_jugend(g.kategorie, g.wann) then
      raise exception 'Bei dieser Anfrage helfen nur Erwachsene.';
    end if;
    if (select count(*) from public.gesuche where helfer = ich and status = 'zugesagt') >= 2 then
      raise exception 'Du hast schon 2 offene Zusagen. Erledige zuerst eine davon.';
    end if;
  end if;
  if (select count(*) from public.gesuche
      where helfer = ich and status <> 'zurueckgezogen'
        and geaendert >= date_trunc('year', now())) >= 29 then
    raise exception 'Du hast dieses Jahr schon 29 Aufträge übernommen. Mehr geht bei Nachbarschaftshilfe nicht, ab dem 1. Januar wieder.';
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
  update public.gesuche set status = 'zugesagt', helfer = ich, helfer_jugendlich = not erwachsen,
    tuercode = privat.neuer_code(), geaendert = now() where id = p_id;
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
  update public.gesuche set status = 'offen', helfer = null, helfer_jugendlich = false, tuercode = null, geaendert = now()
  where id = p_id and status = 'zugesagt' and helfer = auth.uid();
  if not found then
    raise exception 'Diese Zusage kannst du nicht mehr zurückziehen.';
  end if;
  -- Der nächste Helfer soll den alten Verlauf nicht sehen
  delete from public.nachrichten where gesuch_id = p_id;
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
  update public.gesuche set status = 'offen', helfer = null, helfer_jugendlich = false, tuercode = null, geaendert = now()
  where helfer = ich and status = 'zugesagt';
  delete from auth.users where id = ich;
end;
$$;

-- Erschienene Bewertungen über eine Person, neueste zuerst. Für alle lesbar (wie das Profil).
-- rolle: 'geholfen' (die Person hat bei diesem Auftrag geholfen) oder 'gesucht' (sie hat Hilfe gesucht)
create or replace function public.bewertungen_von(p_person uuid)
returns table (gesuch_id uuid, sterne integer, text text, erstellt timestamptz, von uuid, von_name text, rolle text, kategorie text, titel text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privat.bewertungen_freigeben();
  return query
    select b.gesuch_id, b.sterne, b.text, b.erstellt, b.von,
      p.vorname || case when p.nachname_initial <> '' then ' ' || p.nachname_initial || '.' else '' end,
      case when g.helfer = b.an then 'geholfen' else 'gesucht' end,
      g.kategorie, g.titel
    from public.bewertungen b
    join public.profile p on p.id = b.von
    join public.gesuche g on g.id = b.gesuch_id
    where b.an = p_person and b.sichtbar
      and (privat.ist_erwachsen(p_person) or p_person = auth.uid() or privat.zusammen(auth.uid(), p_person))
    order by b.erstellt desc
    limit 200;
end;
$$;

-- Profilbild setzen ('' = entfernen). Das Bild muss vorher in den eigenen Ordner hochgeladen sein.
-- Gibt den bisherigen Pfad zurück, damit die App das alte Bild löschen kann.
create or replace function public.profilbild_setzen(p_pfad text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  alt text;
  da boolean := true;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  p_pfad := coalesce(p_pfad, '');
  if p_pfad <> '' and not privat.erwachsen(ich) then
    raise exception 'Profilbilder gibt es ab 18 Jahren. So bleibt dein Profil privat.';
  end if;
  if p_pfad <> '' then
    if p_pfad !~ ('^' || ich::text || '/[0-9a-z_-]{1,40}\.jpg$') then
      raise exception 'Dieses Bild gehört nicht zu deinem Profil.';
    end if;
    if to_regclass('storage.objects') is not null then
      execute 'select exists (select 1 from storage.objects where bucket_id = $1 and name = $2)' into da using 'profilbilder', p_pfad;
    end if;
    if not da then
      raise exception 'Das Bild ist noch nicht hochgeladen.';
    end if;
  end if;
  select bild into alt from public.profile where id = ich;
  update public.profile set bild = p_pfad where id = ich;
  return coalesce(alt, '');
end;
$$;

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
        delete from privat.eltern_push
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

-- Ab 16 Jahren: Zustimmung der Eltern über einen Link (ohne eigenes Konto)
-- * Wer 16 oder 17 ist, holt sich in der App einen Link und schickt ihn den Eltern.
-- * Die Eltern stimmen über den Link zu, sehen dort die laufenden Aufträge ihres Kindes
--   (mit Adresse und Zeit) und können Benachrichtigungen einschalten oder die Zustimmung zurückziehen.
-- * Gespeichert wird nur der Fingerabdruck des Links (SHA-256). Ein neuer Link macht den alten ungültig.
-- ---------------------------------------------------------------------
create or replace function privat.eltern_kind(p_link text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select j.id from privat.jugendliche j
  where p_link ~ '^[0-9a-f]{64}$'
    and j.eltern_schluessel = encode(sha256(convert_to(p_link, 'UTF8')), 'hex');
$$;

-- Für die App: Bin ich 16 oder 17, und haben meine Eltern zugestimmt?
create or replace function public.mein_alter()
returns table (jugendlich boolean, eltern_ok boolean, eltern_name text, link_da boolean, volljaehrig_ab date)
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
  if privat.erwachsen(ich) then
    return query select false, true, ''::text, false, null::date;
    return;
  end if;
  return query
    select j.id is not null, j.eltern_ok is not null, coalesce(j.eltern_name, ''), j.eltern_schluessel is not null,
      (j.geburt + interval '18 years')::date
    from (select 1) x left join privat.jugendliche j on j.id = ich;
end;
$$;

-- Neuer Link für die Eltern. Der alte wird ungültig; die Eltern müssen über den neuen noch einmal zustimmen.
create or replace function public.eltern_link()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  link text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  zuletzt timestamptz;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if privat.erwachsen(ich) or not exists (select 1 from privat.jugendliche where id = ich) then
    raise exception 'Den Link für Eltern brauchst du nur, wenn du 16 oder 17 bist.';
  end if;
  select link_erstellt into zuletzt from privat.jugendliche where id = ich;
  if zuletzt > now() - interval '10 seconds' then
    raise exception 'Warte kurz, bevor du einen neuen Link erstellst.';
  end if;
  update privat.jugendliche
    set eltern_schluessel = encode(sha256(convert_to(link, 'UTF8')), 'hex'), eltern_ok = null, eltern_name = '', link_erstellt = now()
    where id = ich;
  delete from privat.eltern_push where kind = ich;
  return link;
end;
$$;

-- Was die Eltern über den Link sehen: Vorname, Ort, ob sie zugestimmt haben, laufende und letzte Aufträge
create or replace function public.eltern_ansehen(p_link text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind uuid := privat.eltern_kind(p_link);
  j privat.jugendliche%rowtype;
  p public.profile%rowtype;
begin
  if v_kind is null then
    return null;
  end if;
  if privat.erwachsen(v_kind) then
    return jsonb_build_object('erwachsen', true);
  end if;
  select * into j from privat.jugendliche where id = v_kind;
  select * into p from public.profile where id = v_kind;
  return jsonb_build_object(
    'vorname', p.vorname,
    'ort', p.stadtteil,
    'zugestimmt', j.eltern_ok,
    'eltern_name', j.eltern_name,
    'volljaehrig_ab', (j.geburt + interval '18 years')::date,
    'geraete', (select count(*) from privat.eltern_push e where e.kind = j.id),
    'auftraege', coalesce((
      select jsonb_agg(a order by a.laufend desc, a.geaendert desc)
      from (
        select g.titel, g.kategorie, g.wann, g.status, g.betrag, g.stadtteil, g.geaendert,
          g.status in ('zugesagt', 'erledigt') as laufend,
          e.vorname || case when e.nachname_initial <> '' then ' ' || e.nachname_initial || '.' else '' end as bei,
          case when g.status in ('zugesagt', 'erledigt') then a.adresse else null end as adresse
        from public.gesuche g
        join public.profile e on e.id = g.ersteller
        left join public.gesuch_adressen a on a.gesuch_id = g.id
        where g.helfer = v_kind and g.status in ('zugesagt', 'erledigt', 'bestaetigt')
        order by g.geaendert desc
        limit 20
      ) a), '[]'::jsonb)
  );
end;
$$;

-- Eltern stimmen zu (mit ihrem Namen)
create or replace function public.eltern_zustimmen(p_link text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind uuid := privat.eltern_kind(p_link);
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
begin
  if v_kind is null then
    raise exception 'Dieser Link gilt nicht mehr. Bitte dein Kind um einen neuen.';
  end if;
  if char_length(v_name) < 3 then
    raise exception 'Bitte gib deinen Vor- und Nachnamen ein.';
  end if;
  if privat.anstoessig(v_name) then
    raise exception 'Bitte gib deinen richtigen Namen ein.';
  end if;
  update privat.jugendliche set eltern_ok = coalesce(eltern_ok, now()), eltern_name = v_name where id = v_kind;
  return true;
end;
$$;

-- Eltern ziehen die Zustimmung zurück. Offene Zusagen werden freigegeben (wer angefragt hat, erfährt es).
create or replace function public.eltern_widerrufen(p_link text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind uuid := privat.eltern_kind(p_link);
begin
  if v_kind is null then
    raise exception 'Dieser Link gilt nicht mehr.';
  end if;
  update privat.jugendliche set eltern_ok = null where id = v_kind;
  delete from public.nachrichten
  where gesuch_id in (select id from public.gesuche where helfer = v_kind and status = 'zugesagt');
  update public.gesuche set status = 'offen', helfer = null, helfer_jugendlich = false, tuercode = null, geaendert = now()
  where helfer = v_kind and status = 'zugesagt';
  return true;
end;
$$;

-- Benachrichtigungen für die Eltern (höchstens 3 Geräte)
create or replace function public.eltern_push_anmelden(p_link text, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind uuid := privat.eltern_kind(p_link);
begin
  if v_kind is null then
    raise exception 'Dieser Link gilt nicht mehr.';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://((([a-z0-9-]+\.)*google\.com)|(([a-z0-9-]+\.)*googleapis\.com)|(updates\.push\.services\.mozilla\.com)|([a-z0-9-]+\.push\.apple\.com)|(([a-z0-9-]+\.)+notify\.windows\.com))/' then
    raise exception 'Dieser Browser wird für Benachrichtigungen noch nicht unterstützt.';
  end if;
  insert into privat.eltern_push (endpoint, kind, p256dh, auth) values (p_endpoint, v_kind, p_p256dh, p_auth)
  on conflict (endpoint) do update set kind = excluded.kind, p256dh = excluded.p256dh, auth = excluded.auth;
  delete from privat.eltern_push
  where eltern_push.kind = v_kind
    and endpoint not in (select x.endpoint from privat.eltern_push x where x.kind = v_kind order by x.erstellt desc limit 3);
end;
$$;

create or replace function public.eltern_push_abmelden(p_link text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from privat.eltern_push e where e.endpoint = p_endpoint and e.kind = privat.eltern_kind(p_link);
end;
$$;

-- Benachrichtigung an die Geräte der Eltern (wie push_senden, Link öffnet die Eltern-Seite)
create or replace function privat.push_eltern(p_kind uuid, p_titel text, p_text text)
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
  if p_kind is null or to_regnamespace('net') is null then
    return;
  end if;
  select wert into v_url from privat.einstellungen where name = 'push_url';
  select wert into v_schluessel from privat.einstellungen where name = 'push_schluessel';
  select wert into v_jwt from privat.einstellungen where name = 'push_jwt';
  if v_url is null or v_schluessel is null then
    return;
  end if;
  select jsonb_agg(jsonb_build_object('endpoint', e.endpoint, 'p256dh', e.p256dh, 'auth', e.auth)) into abos
  from privat.eltern_push e where e.kind = p_kind;
  if abos is null then
    return;
  end if;
  select net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'schluessel', v_schluessel::jsonb,
      'abos', abos,
      'nachricht', jsonb_build_object('t', p_titel, 'b', p_text, 'l', 'eltern', 'g', 'eltern-' || p_kind)),
    headers := jsonb_build_object('Content-Type', 'application/json')
      || case when v_jwt is null then '{}'::jsonb else jsonb_build_object('Authorization', 'Bearer ' || v_jwt) end,
    timeout_milliseconds := 8000
  ) into anfrage;
  insert into privat.push_anfragen (id) values (anfrage) on conflict do nothing;
exception when others then
  raise warning 'Benachrichtigung an die Eltern nicht gesendet: %', sqlerrm;
end;
$$;

revoke execute on function privat.eltern_kind(text) from public, anon, authenticated;
revoke execute on function privat.push_eltern(uuid, text, text) from public, anon, authenticated;
revoke execute on function privat.zusammen(uuid, uuid) from public;
revoke execute on function privat.ist_erwachsen(uuid) from public;
revoke execute on function privat.erwachsen(uuid) from public, anon, authenticated;
revoke execute on function privat.volljaehrig_werden() from public, anon, authenticated;
revoke execute on function privat.fuer_jugend(text, text) from public, anon, authenticated;
grant execute on function privat.zusammen(uuid, uuid) to anon, authenticated;
grant execute on function privat.ist_erwachsen(uuid) to anon, authenticated;
revoke execute on function public.mein_alter() from public, anon;
revoke execute on function public.eltern_link() from public, anon;
revoke execute on function public.eltern_ansehen(text) from public;
revoke execute on function public.eltern_zustimmen(text, text) from public;
revoke execute on function public.eltern_widerrufen(text) from public;
revoke execute on function public.eltern_push_anmelden(text, text, text, text) from public;
revoke execute on function public.eltern_push_abmelden(text, text) from public;
grant execute on function public.mein_alter() to authenticated;
grant execute on function public.eltern_link() to authenticated;
grant execute on function public.eltern_ansehen(text) to anon, authenticated;
grant execute on function public.eltern_zustimmen(text, text) to anon, authenticated;
grant execute on function public.eltern_widerrufen(text) to anon, authenticated;
grant execute on function public.eltern_push_anmelden(text, text, text, text) to anon, authenticated;
grant execute on function public.eltern_push_abmelden(text, text) to anon, authenticated;

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
        and not privat.ist_blockiert(g.helfer, new.ersteller)
        and (new.jugend or privat.ist_erwachsen(g.helfer));
      perform privat.push_senden(stamm, coalesce(wer, 'Jemand') || ' sucht wieder Hilfe', kurz, link, 'neu-' || new.id, 'stamm');
      -- Danach alle, die neue Anfragen sehen wollen und in deren Umkreis die Anfrage liegt
      select array_agg(p.id) into nachbarn
      from public.profile p
      left join privat.wohnorte w on w.id = p.id
      where p.id <> new.ersteller
        and case when w.id is null then p.stadtteil = new.stadtteil
                 else w.lat between new.lat - 0.5 and new.lat + 0.5
                  and privat.km(w.lat, w.lng, new.lat, new.lng) <= w.umkreis_km end
        and not (p.id = any (coalesce(stamm, '{}')))
        and not privat.ist_blockiert(p.id, new.ersteller)
        and (new.jugend or p.volljaehrig or privat.ist_erwachsen(p.id))
        and exists (select 1 from public.push_abos a where a.profil = p.id and a.neue_anfragen
                    and (cardinality(a.kategorien) = 0 or new.kategorie = any (a.kategorien)));
      perform privat.push_senden(nachbarn, 'Neu in ' || new.stadtteil, kurz, link, 'neu-' || new.id, 'neu', new.kategorie);
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
    if new.helfer_jugendlich then
      perform privat.push_eltern(new.helfer, coalesce(hilft, 'Dein Kind') || ' hilft bei ' || coalesce(wer, 'jemandem'),
        '„' || new.titel || '“ · ' || new.wann || ' · ' || new.stadtteil || '. Tippe für Adresse und Zeit.');
    end if;
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


-- Rechte für die geänderten Funktionen (neue Angabe p_jugend)
revoke execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision, boolean) from public, anon;
revoke execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision, boolean) from public, anon;
grant execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision, boolean) to authenticated;
grant execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision, boolean) to authenticated;
revoke execute on function public.neues_profil() from public, anon, authenticated;
revoke execute on function privat.push_gesuch() from public, anon, authenticated;
revoke execute on function privat.push_aufraeumen() from public, anon, authenticated;

-- Profilbilder hochladen nur für Erwachsene
do $$
begin
  if to_regclass('storage.buckets') is not null then
    drop policy if exists "Profilbild: hochladen" on storage.objects;
    create policy "Profilbild: hochladen" on storage.objects for insert to authenticated
      with check (bucket_id = 'profilbilder' and (storage.foldername(name))[1] = (select auth.uid())::text
                  and privat.ist_erwachsen((select auth.uid())));
  end if;
end;
$$;

-- Täglich um 3:27 Uhr: Wer 18 geworden ist, wird umgestellt
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('hand-drauf-volljaehrig', '27 3 * * *', 'select privat.volljaehrig_werden()');
  end if;
end;
$$;
