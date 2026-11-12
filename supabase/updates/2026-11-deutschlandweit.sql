-- Hand Drauf: Datenbank-Update November 2026, Teil 7 (eingespielt am 12. November 2026)
-- Deutschlandweit: Orte statt fester Stadtteile von Garbsen.
-- * Anfragen und Profile tragen einen Ortsnamen (z. B. „Linden-Mitte, Hannover“) statt eines Garbsener Stadtteils.
-- * Die App schickt beim Erstellen nur die Mitte eines Rasterfelds von etwa 1 km, nie die genaue Lage.
--   Der Pin liegt wie bisher 100 bis 400 m daneben.
-- * Wohnorte (Rasterpunkt und Umkreis) liegen privat und dienen nur „Neue Anfragen in der Nähe“.
-- * Ältere Fassungen der App (Stadtteil von Garbsen ohne Koordinaten) funktionieren weiter.
-- Voraussetzung: Teil 5 und Teil 6 sind eingespielt. Kann gefahrlos mehrfach laufen.

create schema if not exists privat;
alter table public.profile drop constraint if exists profile_stadtteil_fkey;
alter table public.profile drop constraint if exists profile_stadtteil_check;
alter table public.profile add constraint profile_stadtteil_check check (char_length(stadtteil) between 2 and 60);

create table if not exists privat.wohnorte (
  id uuid primary key references public.profile (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  umkreis_km integer not null default 5 check (umkreis_km between 1 and 50),
  geaendert timestamptz not null default now()
);
alter table privat.wohnorte enable row level security;
create index if not exists wohnorte_lage_idx on privat.wohnorte (lat, lng);

-- Entfernung in Kilometern (Haversine)
create or replace function privat.km(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 12742 * asin(least(1, sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2) +
    cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))));
$$;

-- Mitte des Rasterfelds (etwa 1 × 1 km), in dem ein Punkt liegt. Nur Deutschland.
create or replace function privat.rasterpunkt(p_lat double precision, p_lng double precision, out lat double precision, out lng double precision)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_lat is null or p_lng is null or p_lat not between 47.2 and 55.1 or p_lng not between 5.8 and 15.1 then
    raise exception 'Hand Drauf gibt es bisher nur in Deutschland. Bitte wähle einen Ort in Deutschland.';
  end if;
  lat := (floor(p_lat * 100) + 0.5) / 100;
  lng := (floor(p_lng * 66) + 0.5) / 66;
end;
$$;

-- Ort-Name prüfen: 2 bis 60 Zeichen, ohne anstößige Wörter
create or replace function privat.ortsname(p_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  n text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if char_length(n) < 2 then
    raise exception 'Bitte wähle deinen Ort aus der Liste.';
  end if;
  if privat.anstoessig(n) then
    raise exception 'Bitte wähle deinen Ort aus der Liste.';
  end if;
  return left(n, 60);
end;
$$;

-- Ungefähre Lage einer Anfrage: 100 bis 400 m um die Mitte des Rasterfelds (oder des Garbsener Stadtteils,
-- für ältere Fassungen der App ohne Koordinaten). So lässt sich aus dem Pin nicht auf die Hausnummer schließen.
create or replace function privat.lage_ungefaehr(p_stadtteil text, p_lat double precision, p_lng double precision,
  out lat double precision, out lng double precision)
language plpgsql
volatile
set search_path = ''
as $$
declare
  winkel double precision := random() * 2 * pi();
  abstand double precision := 100 + random() * 300;
  m record;
begin
  if p_lat is not null or p_lng is not null then
    select * into m from privat.rasterpunkt(p_lat, p_lng);
  else
    select s.lat, s.lng into m from public.stadtteile s where s.name = p_stadtteil;
    if not found then
      raise exception 'Bitte wähle deinen Ort aus der Liste.';
    end if;
  end if;
  lat := m.lat + abstand * cos(winkel) / 111320;
  lng := m.lng + abstand * sin(winkel) / (111320 * cos(radians(m.lat)));
end;
$$;

-- Eigenen Ort setzen (Name für andere, Rasterpunkt und Umkreis privat)
create or replace function public.ort_setzen(p_name text, p_lat double precision, p_lng double precision, p_umkreis integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  n text := privat.ortsname(p_name);
  m record;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into m from privat.rasterpunkt(p_lat, p_lng);
  update public.profile set stadtteil = n where id = ich;
  insert into privat.wohnorte (id, lat, lng, umkreis_km)
  values (ich, m.lat, m.lng, coalesce(p_umkreis, 5))
  on conflict (id) do update set lat = excluded.lat, lng = excluded.lng,
    umkreis_km = coalesce(p_umkreis, privat.wohnorte.umkreis_km), geaendert = now();
end;
$$;

-- Umkreis für „Neue Anfragen in der Nähe“ ändern
create or replace function public.umkreis_setzen(p_umkreis integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if p_umkreis is null or p_umkreis not between 1 and 50 then
    raise exception 'Der Umkreis muss zwischen 1 und 50 km liegen.';
  end if;
  update privat.wohnorte set umkreis_km = p_umkreis, geaendert = now() where id = auth.uid();
end;
$$;

-- Eigener Ort (nur für mich): Name, Rasterpunkt, Umkreis
create or replace function public.mein_ort()
returns table (name text, lat double precision, lng double precision, umkreis_km integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.stadtteil, w.lat, w.lng, coalesce(w.umkreis_km, 5)
  from public.profile p
  left join privat.wohnorte w on w.id = p.id
  where p.id = auth.uid();
$$;

alter table public.gesuche drop constraint if exists gesuche_stadtteil_fkey;
alter table public.gesuche drop constraint if exists gesuche_stadtteil_check;
alter table public.gesuche add constraint gesuche_stadtteil_check check (char_length(stadtteil) between 2 and 60);
create index if not exists gesuche_lage_idx on public.gesuche (lat, lng);

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
  m record;
begin
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
    coalesce(new.raw_user_meta_data ->> 'volljaehrig', '') = 'true'
  );
  select * into m from privat.rasterpunkt(v_lat, v_lng);
  insert into privat.wohnorte (id, lat, lng) values (new.id, m.lat, m.lng) on conflict (id) do nothing;
  return new;
end;
$$;


-- Bestehende Konten: Wohnort aus dem Garbsener Stadtteil
insert into privat.wohnorte (id, lat, lng)
select p.id, (floor(s.lat * 100) + 0.5) / 100, (floor(s.lng * 66) + 0.5) / 66
from public.profile p join public.stadtteile s on s.name = p.stadtteil
on conflict (id) do nothing;

drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text);
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
  p_lng double precision default null
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
    privat.ortsname(p_stadtteil),
    lage.lat,
    lage.lng,
    v_fuer
  )
  returning id into neu;

  insert into public.gesuch_adressen (gesuch_id, adresse, telefon) values (neu, btrim(p_adresse), v_telefon);
  return neu;
end;
$$;


drop function if exists public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text);
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
  p_lng double precision default null
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
    geaendert = now()
  where id = p_id;

  insert into public.gesuch_adressen (gesuch_id, adresse, telefon) values (p_id, btrim(p_adresse), v_telefon)
  on conflict (gesuch_id) do update set adresse = excluded.adresse, telefon = excluded.telefon;
end;
$$;


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


revoke execute on all functions in schema privat from public, anon, authenticated;
grant execute on function privat.ist_blockiert(uuid, uuid) to anon, authenticated;
revoke execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision) from public, anon;
revoke execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision) from public, anon;
revoke execute on function public.ort_setzen(text, double precision, double precision, integer) from public, anon;
revoke execute on function public.umkreis_setzen(integer) from public, anon;
revoke execute on function public.mein_ort() from public, anon;
grant execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision) to authenticated;
grant execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision) to authenticated;
grant execute on function public.ort_setzen(text, double precision, double precision, integer) to authenticated;
grant execute on function public.umkreis_setzen(integer) to authenticated;
grant execute on function public.mein_ort() to authenticated;
