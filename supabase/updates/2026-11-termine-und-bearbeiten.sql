-- Hand Drauf: Datenbank-Update November 2026, Teil 1 (eingespielt am 9. November 2026)
-- Termine mit echtem Datum, Ablauf offener Gesuche, eigene Gesuche bearbeiten.
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und "Run" tippen. Kann gefahrlos mehrfach laufen.
-- Die App funktioniert auch ohne dieses Update, nur Bearbeiten und Ablauf fehlen dann. Teil 2: 2026-11-blockieren-und-filter.sql

alter table public.gesuche add column if not exists bis date;
alter table public.gesuche add column if not exists laeuft_ab timestamptz not null default (now() + interval '21 days');
create index if not exists gesuche_status_idx on public.gesuche (status);
create index if not exists gesuche_ersteller_idx on public.gesuche (ersteller);
create index if not exists gesuche_helfer_idx on public.gesuche (helfer);
create index if not exists gesuche_offen_idx on public.gesuche (laeuft_ab) where status = 'offen';

-- Offene Gesuche sehen alle, bis der Termin vorbei ist (spätestens nach 21 Tagen).
-- Eigene Gesuche und Zusagen sehen die Beteiligten immer.
alter table public.gesuche enable row level security;
drop policy if exists "Offene und eigene Gesuche lesen" on public.gesuche;
create policy "Offene und eigene Gesuche lesen" on public.gesuche
  for select to anon, authenticated
  using ((status = 'offen' and laeuft_ab > now()) or ersteller = (select auth.uid()) or helfer = (select auth.uid()));
revoke insert, update, delete on public.gesuche from anon, authenticated;
grant select on public.gesuche to anon, authenticated;


-- Wann läuft ein offenes Gesuch ab? Um Mitternacht nach dem letzten gewünschten Tag
-- (deutsche Zeit), spätestens 21 Tage ab jetzt. Ohne Termin: nach 21 Tagen.
create or replace function public.ablauf(p_bis date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(
    now() + interval '21 days',
    coalesce(((p_bis + 1)::timestamp at time zone 'Europe/Berlin'), now() + interval '21 days')
  );
$$;

-- Prüft den Termin: heute oder in den nächsten 60 Tagen
create or replace function public.termin_pruefen(p_bis date)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if p_bis is not null and (p_bis < heute or p_bis > heute + 60) then
    raise exception 'Bitte wähle einen Termin ab heute.';
  end if;
end;
$$;

-- Zufällige Lage 100 bis 400 m um die Stadtteilmitte,
-- damit niemand aus dem Pin auf die Hausnummer schließen kann.
create or replace function public.ungefaehre_lage(p_stadtteil text, out lat double precision, out lng double precision)
language plpgsql
volatile
set search_path = ''
as $$
declare
  mitte public.stadtteile%rowtype;
  winkel double precision := random() * 2 * pi();
  abstand double precision := 100 + random() * 300;
begin
  select * into mitte from public.stadtteile where name = p_stadtteil;
  if not found then
    raise exception 'Bitte wähle einen Stadtteil von Garbsen.';
  end if;
  lat := mitte.lat + abstand * cos(winkel) / 111320;
  lng := mitte.lng + abstand * sin(winkel) / (111320 * cos(radians(mitte.lat)));
end;
$$;

-- Neues Gesuch
drop function if exists public.gesuch_erstellen(text, text, text, integer, text, text, text);
create or replace function public.gesuch_erstellen(
  p_kategorie text,
  p_titel text,
  p_beschreibung text,
  p_betrag integer,
  p_wann text,
  p_stadtteil text,
  p_adresse text,
  p_bis date default null
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
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into lage from public.ungefaehre_lage(p_stadtteil);
  if (select count(*) from public.gesuche
      where ersteller = ich and status in ('offen', 'zugesagt', 'erledigt')) >= 5 then
    raise exception 'Du hast schon 5 laufende Gesuche. Schließe zuerst eins ab.';
  end if;
  if char_length(btrim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Bitte gib deine Straße und Hausnummer an.';
  end if;
  perform public.termin_pruefen(p_bis);

  insert into public.gesuche (ersteller, kategorie, titel, beschreibung, betrag, wann, bis, laeuft_ab, stadtteil, lat, lng)
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
    lage.lng
  )
  returning id into neu;

  insert into public.gesuch_adressen (gesuch_id, adresse) values (neu, btrim(p_adresse));
  return neu;
end;
$$;

-- Eigenes Gesuch bearbeiten, solange noch niemand zugesagt hat. Mit neuem Termin
-- wird ein abgelaufenes Gesuch wieder sichtbar. Neuer Stadtteil = neue ungefähre Lage.
create or replace function public.gesuch_bearbeiten(
  p_id uuid,
  p_kategorie text,
  p_titel text,
  p_beschreibung text,
  p_betrag integer,
  p_wann text,
  p_stadtteil text,
  p_adresse text,
  p_bis date default null
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
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into g from public.gesuche where id = p_id for update;
  if not found or g.ersteller <> ich then
    raise exception 'Nur eigene Gesuche können bearbeitet werden.';
  end if;
  if g.status <> 'offen' then
    raise exception 'Bearbeiten geht nur, solange noch niemand zugesagt hat.';
  end if;
  if char_length(btrim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Bitte gib deine Straße und Hausnummer an.';
  end if;
  perform public.termin_pruefen(p_bis);
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
    geaendert = now()
  where id = p_id;

  insert into public.gesuch_adressen (gesuch_id, adresse) values (p_id, btrim(p_adresse))
  on conflict (gesuch_id) do update set adresse = excluded.adresse;
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
    raise exception 'Dieses Gesuch ist nicht mehr offen.';
  end if;
  if g.laeuft_ab <= now() then
    raise exception 'Dieses Gesuch ist abgelaufen.';
  end if;
  if g.ersteller = ich then
    raise exception 'Bei deinem eigenen Gesuch kannst du nicht helfen.';
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
  update public.gesuche set status = 'zugesagt', helfer = ich, geaendert = now() where id = p_id;
end;
$$;


-- Gesuch oder beteiligte Person melden. Wer meldet, bleibt für die gemeldete Person unsichtbar.
create or replace function public.melden(p_id uuid, p_grund text, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
  ziel uuid;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if p_grund is null or p_grund not in ('betrug', 'unangemessen', 'gefaehrlich', 'schwarzarbeit', 'anderes') then
    raise exception 'Bitte wähle einen Grund.';
  end if;
  select * into g from public.gesuche where id = p_id;
  if not found or not ((g.status = 'offen' and g.laeuft_ab > now()) or g.ersteller = ich or coalesce(g.helfer = ich, false)) then
    raise exception 'Dieses Gesuch gibt es nicht mehr.';
  end if;
  ziel := case when g.ersteller = ich then g.helfer else g.ersteller end;
  if ziel is null then
    raise exception 'Hier gibt es niemanden zu melden.';
  end if;
  if (select count(*) from public.meldungen
      where von = ich and erstellt > now() - interval '1 day') >= 10 then
    raise exception 'Du hast heute schon viele Meldungen geschickt. Wir prüfen sie zuerst.';
  end if;
  insert into public.meldungen (gesuch_id, gemeldet, von, grund, text)
  values (p_id, ziel, ich, p_grund, left(btrim(coalesce(p_text, '')), 500))
  on conflict on constraint meldungen_einmal
  do update set grund = excluded.grund, text = excluded.text, status = 'neu', erstellt = now();
end;
$$;


revoke execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date) from public, anon;
revoke execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date) from public, anon;
revoke execute on function public.ablauf(date) from public, anon, authenticated;
revoke execute on function public.termin_pruefen(date) from public, anon, authenticated;
revoke execute on function public.ungefaehre_lage(text) from public, anon, authenticated;
grant execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date) to authenticated;
grant execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date) to authenticated;

