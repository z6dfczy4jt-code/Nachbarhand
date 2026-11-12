-- =====================================================================
-- Hand Drauf: Datenbank für Supabase
-- Im Supabase-Dashboard unter "SQL Editor" komplett einfügen und auf
-- "Run" tippen. Das Skript kann gefahrlos mehrfach ausgeführt werden.
--
-- Grundsätze
-- * Lesen: Jeder (auch ohne Konto) sieht offene Gesuche mit Vorname,
--   Anfangsbuchstabe und ungefährer Lage, bis der gewünschte Termin vorbei
--   ist (ohne Termin nach 21 Tagen). Laufende Aufträge sehen nur die beiden Beteiligten.
-- * Die genaue Adresse sieht nur, wer das Gesuch erstellt hat, und wer
--   zugesagt hat.
-- * Schreiben: Niemand ändert Tabellen direkt. Alles läuft über die
--   Funktionen unten, die Regeln prüfen (Anmeldung, 18+, Grenzen für
--   Nachbarschaftshilfe, erlaubte Statuswechsel).
-- * Nachrichten lesen und schreiben nur die beiden Beteiligten eines
--   Auftrags. Meldungen kann über die App niemand lesen.
-- * Bewertungen (Sterne und Text) erscheinen für beide gleichzeitig: sobald beide
--   bewertet haben, spätestens nach 14 Tagen. Danach sind sie für alle lesbar.
-- * Wer jemanden blockiert, sieht dessen Anfragen nicht mehr (und umgekehrt).
--   Beleidigende Wörter in Anfragen, Nachrichten und Bewertungen werden abgelehnt.
-- * Wer zusagt, bekommt einen vierstelligen Sicherheits-Code für die Tür. Den Code
--   und eine freiwillige Telefonnummer sehen nur die beiden Beteiligten.
-- * Benachrichtigungen (Web Push): Die Geräte-Adressen kann über die App niemand lesen.
--   Auslöser in der Datenbank schicken sie an die Edge Function „push“.
-- * Testphase (Weg 1): Die App vermittelt nur. Die Aufwandsentschädigung
--   zahlen die Beteiligten direkt untereinander.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Stadtteile von Garbsen (Mittelpunkte für die ungefähre Lage)
-- ---------------------------------------------------------------------
create table if not exists public.stadtteile (
  name text primary key,
  lat double precision not null,
  lng double precision not null
);

insert into public.stadtteile (name, lat, lng) values
  ('Altgarbsen', 52.4188, 9.5815),
  ('Auf der Horst', 52.4166, 9.5975),
  ('Berenbostel', 52.4352, 9.6098),
  ('Frielingen', 52.4612, 9.5357),
  ('Garbsen-Mitte', 52.4262, 9.6015),
  ('Havelse', 52.4108, 9.6125),
  ('Heitlingen', 52.4679, 9.6170),
  ('Horst', 52.4418, 9.5370),
  ('Meyenfeld', 52.4420, 9.5703),
  ('Osterwald O.E.', 52.4620, 9.5930),
  ('Osterwald U.E.', 52.4615, 9.5532),
  ('Schloß Ricklingen', 52.4298, 9.5088),
  ('Stelingen', 52.4510, 9.6240)
on conflict (name) do update set lat = excluded.lat, lng = excluded.lng;

alter table public.stadtteile enable row level security;
drop policy if exists "Stadtteile sind lesbar" on public.stadtteile;
create policy "Stadtteile sind lesbar" on public.stadtteile
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.stadtteile from anon, authenticated;
grant select on public.stadtteile to anon, authenticated;

-- ---------------------------------------------------------------------
-- Profile (wird bei der Registrierung automatisch angelegt)
-- ---------------------------------------------------------------------
create table if not exists public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  vorname text not null check (char_length(vorname) between 1 and 40),
  nachname_initial text not null default '' check (char_length(nachname_initial) <= 1),
  stadtteil text not null check (char_length(stadtteil) between 2 and 60), -- Ort, wie andere ihn sehen, z. B. „Linden-Mitte, Hannover“
  volljaehrig boolean not null default false,
  sterne_summe integer not null default 0,
  sterne_anzahl integer not null default 0,
  hilfen_anzahl integer not null default 0,   -- bestätigte Aufträge als Helfer
  gesuche_anzahl integer not null default 0,  -- bestätigte eigene Gesuche
  erstellt timestamptz not null default now()
);
-- Für Projekte, die vor dem Profil-Ausbau angelegt wurden
alter table public.profile add column if not exists hilfen_anzahl integer not null default 0;
alter table public.profile add column if not exists gesuche_anzahl integer not null default 0;

alter table public.profile enable row level security;
drop policy if exists "Profile sind lesbar" on public.profile;
create policy "Profile sind lesbar" on public.profile
  for select to anon, authenticated using (true);
drop policy if exists "Eigenes Profil ändern" on public.profile;
create policy "Eigenes Profil ändern" on public.profile
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Nur Vorname, Initial und Stadtteil dürfen selbst geändert werden (nicht die Bewertungen).
revoke insert, update, delete on public.profile from anon, authenticated;
grant select on public.profile to anon, authenticated;
grant update (vorname, nachname_initial, stadtteil) on public.profile to authenticated;

-- ---------------------------------------------------------------------
-- Deutschlandweit: Orte statt fester Stadtteile
-- Die App sucht Adressen auf dem Gerät und schickt nur die Mitte eines Rasters von etwa 1 km.
-- Wohnorte sind privat (nur für „Neue Anfragen in der Nähe“), andere sehen nur den Namen des Orts.
-- ---------------------------------------------------------------------
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

drop trigger if exists beim_registrieren on auth.users;
create trigger beim_registrieren
  after insert on auth.users
  for each row execute function public.neues_profil();

-- ---------------------------------------------------------------------
-- Blockieren (App Store 1.2): Wer jemanden blockiert, sieht dessen Anfragen
-- nicht mehr und umgekehrt. Zusagen und Nachrichten zwischen beiden gehen nicht.
-- Die blockierte Person erfährt davon nichts.
-- ---------------------------------------------------------------------
create table if not exists public.blockiert (
  von uuid not null references public.profile (id) on delete cascade,
  wen uuid not null references public.profile (id) on delete cascade,
  erstellt timestamptz not null default now(),
  primary key (von, wen),
  constraint blockiert_nicht_selbst check (von <> wen)
);
create index if not exists blockiert_wen_idx on public.blockiert (wen);
alter table public.blockiert enable row level security;
drop policy if exists "Eigene Blockierungen lesen" on public.blockiert;
create policy "Eigene Blockierungen lesen" on public.blockiert
  for select to authenticated using (von = (select auth.uid()));
revoke all on public.blockiert from anon;
revoke insert, update, delete on public.blockiert from authenticated;
grant select on public.blockiert to authenticated;

-- Hilfsfunktionen im Schema „privat“: Supabase stellt es nicht über die API bereit,
-- die Zugriffsregeln können sie trotzdem nutzen.
create schema if not exists privat;
grant usage on schema privat to anon, authenticated;

-- Hat eine der beiden Personen die andere blockiert?
create or replace function privat.ist_blockiert(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blockiert
    where (von = a and wen = b) or (von = b and wen = a)
  );
$$;

-- Filter für anstößige Wörter (App Store 1.2). Dieselbe Liste steht in src/app.js.
create or replace function privat.anstoessig(p_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    translate(lower(p_text), '013457@$', 'oieastas') ~
      '(\mhure|hurensohn|\mfotze|\mwichser|\marschloch|schlampe|missgeburt|\mspast(i|en)?\M|\mmongo\M|\mnutte|\m(ge)?fick(en|t|st|e|er|te|ten)?\M|\mbitch|heil hitler|sieg heil|\mkanake|\mneger|\mnigger|\mschwuchtel|\mvergewaltig)',
    false);
$$;
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

revoke execute on all functions in schema privat from public, anon, authenticated;
grant execute on function privat.ist_blockiert(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Gesuche
-- ---------------------------------------------------------------------
create table if not exists public.gesuche (
  id uuid primary key default gen_random_uuid(),
  ersteller uuid not null,
  kategorie text not null check (kategorie in ('garten', 'einkaufen', 'tiere', 'haushalt', 'tragen', 'technik')),
  titel text not null check (char_length(titel) between 3 and 60),
  beschreibung text not null default '' check (char_length(beschreibung) <= 400),
  betrag integer not null check (betrag between 5 and 50),
  wann text not null check (char_length(wann) between 1 and 120),
  dauer text not null default 'nach Absprache' check (char_length(dauer) <= 40),
  stadtteil text not null check (char_length(stadtteil) between 2 and 60), -- Ort, wie andere ihn sehen
  lat double precision not null,
  lng double precision not null,
  status text not null default 'offen'
    check (status in ('offen', 'zugesagt', 'erledigt', 'bestaetigt', 'zurueckgezogen')),
  helfer uuid,
  fuer text not null default '' check (char_length(fuer) <= 40),   -- für wen die Hilfe ist, wenn nicht für die Person selbst
  tuercode text check (tuercode is null or tuercode ~ '^[0-9]{4}$'), -- Sicherheits-Code für die Tür, ab der Zusage
  bis date,                                                         -- letzter Tag des gewünschten Termins
  laeuft_ab timestamptz not null default (now() + interval '21 days'), -- danach sehen andere das offene Gesuch nicht mehr
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  constraint gesuche_ersteller_fkey foreign key (ersteller) references public.profile (id) on delete cascade,
  constraint gesuche_helfer_fkey foreign key (helfer) references public.profile (id) on delete set null
);
-- Für Projekte, die vor dem Ablauf-Ausbau angelegt wurden
alter table public.gesuche add column if not exists bis date;
alter table public.gesuche add column if not exists laeuft_ab timestamptz not null default (now() + interval '21 days');
-- Deutschlandweit: Ort als Text statt fester Stadtteile von Garbsen
alter table public.gesuche drop constraint if exists gesuche_stadtteil_fkey;
alter table public.gesuche drop constraint if exists gesuche_stadtteil_check;
alter table public.gesuche add constraint gesuche_stadtteil_check check (char_length(stadtteil) between 2 and 60);
create index if not exists gesuche_lage_idx on public.gesuche (lat, lng);
-- Für Projekte, die vor „Für jemand anderen“ und dem Sicherheits-Code angelegt wurden
alter table public.gesuche add column if not exists fuer text not null default '';
alter table public.gesuche drop constraint if exists gesuche_fuer_check;
alter table public.gesuche add constraint gesuche_fuer_check check (char_length(fuer) <= 40);
alter table public.gesuche add column if not exists tuercode text;
alter table public.gesuche drop constraint if exists gesuche_tuercode_check;
alter table public.gesuche add constraint gesuche_tuercode_check check (tuercode is null or tuercode ~ '^[0-9]{4}$');
-- Termin-Text mit mehreren Tagen und Uhrzeit („Mo. 16., Mi. 18. oder Fr. 20. Nov., gegen 16:30 Uhr“)
alter table public.gesuche drop constraint if exists gesuche_wann_check;
alter table public.gesuche add constraint gesuche_wann_check check (char_length(wann) between 1 and 120);
create index if not exists gesuche_status_idx on public.gesuche (status);
create index if not exists gesuche_ersteller_idx on public.gesuche (ersteller);
create index if not exists gesuche_helfer_idx on public.gesuche (helfer);
create index if not exists gesuche_offen_idx on public.gesuche (laeuft_ab) where status = 'offen';

-- Offene Gesuche sehen alle, bis der Termin vorbei ist (ohne Termin nach 21 Tagen).
-- Eigene Gesuche und Zusagen sehen die Beteiligten immer.
alter table public.gesuche enable row level security;
drop policy if exists "Offene und eigene Gesuche lesen" on public.gesuche;
create policy "Offene und eigene Gesuche lesen" on public.gesuche
  for select to anon, authenticated
  using (
    (status = 'offen' and laeuft_ab > now() and not privat.ist_blockiert((select auth.uid()), ersteller))
    or ersteller = (select auth.uid()) or helfer = (select auth.uid())
  );
revoke insert, update, delete on public.gesuche from anon, authenticated;
grant select on public.gesuche to anon, authenticated;

-- ---------------------------------------------------------------------
-- Adressen und Telefonnummern (getrennt gespeichert, nur für die Beteiligten lesbar)
-- ---------------------------------------------------------------------
create table if not exists public.gesuch_adressen (
  gesuch_id uuid primary key references public.gesuche (id) on delete cascade,
  adresse text not null check (char_length(adresse) between 3 and 120),
  telefon text not null default '' check (telefon ~ '^[0-9 +()/-]{0,30}$')   -- freiwillig, zum Anrufen nach der Zusage
);
alter table public.gesuch_adressen add column if not exists telefon text not null default '';
alter table public.gesuch_adressen drop constraint if exists gesuch_adressen_telefon_check;
alter table public.gesuch_adressen add constraint gesuch_adressen_telefon_check check (telefon ~ '^[0-9 +()/-]{0,30}$');

alter table public.gesuch_adressen enable row level security;
drop policy if exists "Adresse nur für Beteiligte" on public.gesuch_adressen;
create policy "Adresse nur für Beteiligte" on public.gesuch_adressen
  for select to authenticated
  using (exists (
    select 1 from public.gesuche g
    where g.id = gesuch_id
      and (g.ersteller = (select auth.uid()) or g.helfer = (select auth.uid()))
  ));
revoke all on public.gesuch_adressen from anon;
revoke insert, update, delete on public.gesuch_adressen from authenticated;
grant select on public.gesuch_adressen to authenticated;

-- ---------------------------------------------------------------------
-- Bewertungen
-- ---------------------------------------------------------------------
create table if not exists public.bewertungen (
  gesuch_id uuid not null references public.gesuche (id) on delete cascade,
  von uuid not null references public.profile (id) on delete cascade,
  an uuid not null references public.profile (id) on delete cascade,
  sterne integer not null check (sterne between 1 and 5),
  erstellt timestamptz not null default now(),
  primary key (gesuch_id, von)
);

alter table public.bewertungen enable row level security;
drop policy if exists "Eigene Bewertungen lesen" on public.bewertungen;
create policy "Eigene Bewertungen lesen" on public.bewertungen
  for select to authenticated using (von = (select auth.uid()));
revoke all on public.bewertungen from anon;
revoke insert, update, delete on public.bewertungen from authenticated;
grant select on public.bewertungen to authenticated;
-- Text zur Bewertung und ob sie schon erschienen ist (beide erscheinen gleichzeitig, siehe bewerten)
alter table public.bewertungen add column if not exists text text not null default '';
alter table public.bewertungen drop constraint if exists bewertungen_text_check;
alter table public.bewertungen add constraint bewertungen_text_check check (char_length(text) <= 600);
alter table public.bewertungen add column if not exists sichtbar boolean;
-- Bisherige Bewertungen zählen schon im Profil: Sie sind ab sofort sichtbar
update public.bewertungen set sichtbar = true where sichtbar is null;
alter table public.bewertungen alter column sichtbar set default false;
alter table public.bewertungen alter column sichtbar set not null;
create index if not exists bewertungen_wartend_idx on public.bewertungen (erstellt) where not sichtbar;
create index if not exists bewertungen_an_sichtbar_idx on public.bewertungen (an, erstellt desc) where sichtbar;


-- ---------------------------------------------------------------------
-- Nachrichten (nur zwischen den beiden Beteiligten eines Auftrags)
-- ---------------------------------------------------------------------
create table if not exists public.nachrichten (
  id bigint generated always as identity primary key,
  gesuch_id uuid not null references public.gesuche (id) on delete cascade,
  von uuid not null references public.profile (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  erstellt timestamptz not null default now()
);
create index if not exists nachrichten_gesuch_idx on public.nachrichten (gesuch_id, erstellt);
create index if not exists nachrichten_von_idx on public.nachrichten (von, erstellt);

alter table public.nachrichten enable row level security;
drop policy if exists "Nachrichten nur für Beteiligte" on public.nachrichten;
create policy "Nachrichten nur für Beteiligte" on public.nachrichten
  for select to authenticated
  using (exists (
    select 1 from public.gesuche g
    where g.id = gesuch_id
      and (g.ersteller = (select auth.uid()) or g.helfer = (select auth.uid()))
  ));
revoke all on public.nachrichten from anon;
revoke insert, update, delete on public.nachrichten from authenticated;
grant select on public.nachrichten to authenticated;

-- ---------------------------------------------------------------------
-- Meldungen (Meldeweg nach dem Digital Services Act)
-- Niemand kann Meldungen über die App lesen. Prüfen im Supabase-Dashboard:
-- Table Editor → meldungen
-- ---------------------------------------------------------------------
create table if not exists public.meldungen (
  id bigint generated always as identity primary key,
  gesuch_id uuid references public.gesuche (id) on delete set null,
  gemeldet uuid references public.profile (id) on delete set null,
  von uuid not null references public.profile (id) on delete cascade,
  grund text not null check (grund in ('betrug', 'unangemessen', 'gefaehrlich', 'schwarzarbeit', 'anderes')),
  text text not null default '' check (char_length(text) <= 500),
  status text not null default 'neu' check (status in ('neu', 'geprueft', 'erledigt')),
  erstellt timestamptz not null default now(),
  constraint meldungen_einmal unique (gesuch_id, von)
);
alter table public.meldungen enable row level security;
revoke all on public.meldungen from anon, authenticated;
-- Meldungen können auch eine Bewertung betreffen
alter table public.meldungen add column if not exists art text not null default 'anfrage';
alter table public.meldungen drop constraint if exists meldungen_art_check;
alter table public.meldungen add constraint meldungen_art_check check (art in ('anfrage', 'bewertung'));
alter table public.meldungen drop constraint if exists meldungen_einmal;
alter table public.meldungen add constraint meldungen_einmal unique (gesuch_id, von, art, gemeldet);


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
  kategorien text[] not null default '{}',       -- nur diese Tätigkeiten (leer = alle)
  zuletzt_neu timestamptz,                       -- letzte Benachrichtigung über eine neue Anfrage (höchstens alle 20 Minuten)
  getestet timestamptz,
  erstellt timestamptz not null default now()
);
create index if not exists push_abos_profil_idx on public.push_abos (profil);
alter table public.push_abos add column if not exists kategorien text[] not null default '{}';
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

-- ---------------------------------------------------------------------
-- Funktionen: alle Änderungen laufen hierüber
-- ---------------------------------------------------------------------

-- Wann läuft ein offenes Gesuch ab? Um Mitternacht nach dem letzten gewünschten Tag
-- (deutsche Zeit). Der Tag liegt höchstens 60 Tage voraus (termin_pruefen). Ohne Termin: nach 21 Tagen.
create or replace function public.ablauf(p_bis date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(((p_bis + 1)::timestamp at time zone 'Europe/Berlin'), now() + interval '21 days');
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
  if p_bis is not null and p_bis < heute then
    raise exception 'Bitte wähle einen Termin ab heute.';
  end if;
  if p_bis is not null and p_bis > heute + 60 then
    raise exception 'Termine gehen höchstens 60 Tage im Voraus.';
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

-- Eigenes Gesuch bearbeiten, solange noch niemand zugesagt hat. Mit neuem Termin
-- wird ein abgelaufenes Gesuch wieder sichtbar. Neuer Stadtteil = neue ungefähre Lage.
drop function if exists public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date);
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

-- Job als erledigt melden (nur wer zugesagt hat)
create or replace function public.gesuch_erledigt(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gesuche set status = 'erledigt', geaendert = now()
  where id = p_id and status = 'zugesagt' and helfer = auth.uid();
  if not found then
    raise exception 'Nur wer zugesagt hat, kann den Job als erledigt melden.';
  end if;
end;
$$;

-- Erledigten Job bestätigen (nur wer das Gesuch erstellt hat). Zählt für beide Profile mit.
create or replace function public.gesuch_bestaetigen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.gesuche%rowtype;
begin
  update public.gesuche set status = 'bestaetigt', geaendert = now()
  where id = p_id and status = 'erledigt' and ersteller = auth.uid()
  returning * into g;
  if not found then
    raise exception 'Bestätigen kann nur, wer die Anfrage gestellt hat, nachdem der Job als erledigt gemeldet wurde.';
  end if;
  update public.profile set gesuche_anzahl = gesuche_anzahl + 1 where id = g.ersteller;
  if g.helfer is not null then
    update public.profile set hilfen_anzahl = hilfen_anzahl + 1 where id = g.helfer;
  end if;
end;
$$;

-- Offenes Gesuch zurückziehen (nur wer es erstellt hat)
create or replace function public.gesuch_zurueckziehen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gesuche set status = 'zurueckgezogen', geaendert = now()
  where id = p_id and status = 'offen' and ersteller = auth.uid();
  if not found then
    raise exception 'Nur offene eigene Anfragen können zurückgezogen werden.';
  end if;
end;
$$;

-- Nach einem bestätigten Auftrag bewerten sich beide gegenseitig (1 bis 5 Sterne und ein freiwilliger Text).
-- Wartende Bewertungen erscheinen lassen: wenn beide bewertet haben oder die erste 14 Tage alt ist.
-- Läuft beim Bewerten, beim Ansehen eines Profils und stündlich.
create or replace function privat.bewertungen_freigeben()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with faellig as (
    select b.gesuch_id, b.von
    from public.bewertungen b
    where not b.sichtbar
      and (b.erstellt < now() - interval '14 days'
        or exists (select 1 from public.bewertungen x where x.gesuch_id = b.gesuch_id and x.von = b.an))
  ), frei as (
    update public.bewertungen b set sichtbar = true
    from faellig f
    where b.gesuch_id = f.gesuch_id and b.von = f.von
    returning b.an, b.sterne
  ), zaehlen as (
    update public.profile p
    set sterne_summe = p.sterne_summe + s.summe, sterne_anzahl = p.sterne_anzahl + s.anzahl
    from (select an, sum(sterne)::integer as summe, count(*)::integer as anzahl from frei group by an) s
    where p.id = s.an
    returning 1
  )
  select count(*) into n from frei;
  return n;
end;
$$;

-- Bewerten: 1 bis 5 Sterne, dazu ein freiwilliger Text. Ändern geht, bis die Bewertung erschienen ist.
drop function if exists public.bewerten(uuid, integer);
create or replace function public.bewerten(p_id uuid, p_sterne integer, p_text text default null)
returns boolean -- true: Die Bewertung ist schon erschienen (beide haben bewertet)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
  ziel uuid;
  meine public.bewertungen%rowtype;
  t text := left(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')), 600);
begin
  if p_sterne is null or p_sterne < 1 or p_sterne > 5 then
    raise exception 'Bitte vergib 1 bis 5 Sterne.';
  end if;
  select * into g from public.gesuche where id = p_id;
  if not found or g.status <> 'bestaetigt' then
    raise exception 'Bewerten geht erst, wenn der Auftrag bestätigt ist.';
  end if;
  if ich = g.ersteller then
    ziel := g.helfer;
  elsif ich = g.helfer then
    ziel := g.ersteller;
  else
    raise exception 'Du warst an diesem Auftrag nicht beteiligt.';
  end if;
  if ziel is null then
    raise exception 'Diese Person gibt es nicht mehr.';
  end if;
  if t <> '' and privat.anstoessig(t) then
    raise exception 'Bitte schreib sachlich. Beleidigende oder anstößige Wörter werden nicht veröffentlicht.';
  end if;
  perform privat.bewertungen_freigeben();

  select * into meine from public.bewertungen where gesuch_id = p_id and von = ich;
  if found then
    if meine.sichtbar then
      raise exception 'Eure Bewertungen sind schon erschienen. Ändern geht nicht mehr.';
    end if;
    -- Ältere Fassungen der App schicken keinen Text: dann bleibt der bisherige
    update public.bewertungen set sterne = p_sterne, text = case when p_text is null then text else t end
    where gesuch_id = p_id and von = ich;
  else
    if exists (select 1 from public.bewertungen where gesuch_id = p_id and von = ziel and sichtbar) then
      raise exception 'Die Zeit zum Bewerten ist vorbei: Die Bewertung der anderen Person ist schon erschienen.';
    end if;
    insert into public.bewertungen (gesuch_id, von, an, sterne, text, sichtbar) values (p_id, ich, ziel, p_sterne, t, false);
  end if;

  perform privat.bewertungen_freigeben();
  return (select sichtbar from public.bewertungen where gesuch_id = p_id and von = ich);
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
    order by b.erstellt desc
    limit 200;
end;
$$;

-- Eine erschienene Bewertung melden (zum Beispiel beleidigend oder mit privaten Angaben)
create or replace function public.bewertung_melden(p_gesuch uuid, p_von uuid, p_grund text, p_text text)
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
  if p_grund is null or p_grund not in ('betrug', 'unangemessen', 'gefaehrlich', 'schwarzarbeit', 'anderes') then
    raise exception 'Bitte wähle einen Grund.';
  end if;
  if not exists (select 1 from public.bewertungen where gesuch_id = p_gesuch and von = p_von and sichtbar) then
    raise exception 'Diese Bewertung gibt es nicht mehr.';
  end if;
  if p_von = ich then
    raise exception 'Deine eigene Bewertung kannst du nicht melden.';
  end if;
  if (select count(*) from public.meldungen
      where von = ich and erstellt > now() - interval '1 day') >= 10 then
    raise exception 'Du hast heute schon viele Meldungen geschickt. Wir prüfen sie zuerst.';
  end if;
  insert into public.meldungen (gesuch_id, gemeldet, von, grund, text, art)
  values (p_gesuch, p_von, ich, p_grund, left(btrim(coalesce(p_text, '')), 500), 'bewertung')
  on conflict on constraint meldungen_einmal
  do update set grund = excluded.grund, text = excluded.text, status = 'neu', erstellt = now();
end;
$$;

-- Wird eine erschienene Bewertung gelöscht (Konto gelöscht, nach einer Meldung entfernt), stimmt der Durchschnitt weiter
create or replace function privat.bewertung_geloescht()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.sichtbar then
    update public.profile
    set sterne_summe = greatest(0, sterne_summe - old.sterne), sterne_anzahl = greatest(0, sterne_anzahl - 1)
    where id = old.an;
  end if;
  return old;
end;
$$;
drop trigger if exists bewertung_geloescht on public.bewertungen;
create trigger bewertung_geloescht after delete on public.bewertungen
  for each row execute function privat.bewertung_geloescht();

-- Nachricht schreiben: nur die beiden Beteiligten, erst nach der Zusage
create or replace function public.nachricht_senden(p_id uuid, p_text text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
  t text := btrim(coalesce(p_text, ''));
  neu bigint;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into g from public.gesuche where id = p_id;
  if not found or (g.ersteller <> ich and g.helfer is distinct from ich) then
    raise exception 'Nachrichten gibt es nur zwischen den Beteiligten eines Auftrags.';
  end if;
  if g.status not in ('zugesagt', 'erledigt', 'bestaetigt') then
    raise exception 'Nachrichten sind erst nach einer Zusage möglich.';
  end if;
  if char_length(t) = 0 then
    raise exception 'Die Nachricht ist leer.';
  end if;
  if char_length(t) > 1000 then
    raise exception 'Die Nachricht ist zu lang (höchstens 1000 Zeichen).';
  end if;
  if privat.ist_blockiert(g.ersteller, g.helfer) then
    raise exception 'Ihr könnt euch hier keine Nachrichten mehr schreiben.';
  end if;
  if privat.anstoessig(t) then
    raise exception 'Bitte schreib freundlich. Beleidigende oder anstößige Wörter werden nicht verschickt.';
  end if;
  if (select count(*) from public.nachrichten
      where von = ich and erstellt > now() - interval '10 minutes') >= 30 then
    raise exception 'Du hast gerade sehr viele Nachrichten geschickt. Warte bitte ein paar Minuten.';
  end if;
  insert into public.nachrichten (gesuch_id, von, text) values (p_id, ich, t) returning id into neu;
  return neu;
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
    raise exception 'Diese Anfrage gibt es nicht mehr.';
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

-- Blockierung aufheben
create or replace function public.entblocken(p_person uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  delete from public.blockiert where von = auth.uid() and wen = p_person;
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

-- Übliche Beträge je Tätigkeit aus echten Anfragen der letzten 120 Tage (mittlere Hälfte, auf ganze Euro).
-- Erst ab 5 Anfragen je Tätigkeit, vorher nimmt die App ihren eigenen Vorschlag. Keine Namen, nur Zahlen.
create or replace function public.richtwerte()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_object_agg(kategorie, json_build_object('von', von, 'bis', bis, 'anzahl', anzahl)), '{}'::json)
  from (
    select kategorie,
      round(percentile_cont(0.25) within group (order by betrag))::int as von,
      round(percentile_cont(0.75) within group (order by betrag))::int as bis,
      count(*)::int as anzahl
    from public.gesuche
    where status in ('offen', 'zugesagt', 'erledigt', 'bestaetigt') and erstellt > now() - interval '120 days'
    group by kategorie
    having count(*) >= 5
  ) x;
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
-- p_kategorie: Bei 'neu' nur an Geräte, die diese Tätigkeit gewählt haben (oder keine Auswahl getroffen haben).
drop function if exists privat.push_senden(uuid[], text, text, text, text, text);
create or replace function privat.push_senden(
  p_empfaenger uuid[],
  p_titel text,
  p_text text,
  p_link text,
  p_tag text,
  p_art text default '',
  p_kategorie text default null
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
      and (p_art <> 'neu' or (neue_anfragen and (p_kategorie is null or cardinality(kategorien) = 0 or p_kategorie = any (kategorien))))
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
      and (p_art <> 'neu' or (neue_anfragen and (p_kategorie is null or cardinality(kategorien) = 0 or p_kategorie = any (kategorien))))
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
drop function if exists public.push_anmelden(text, text, text, boolean);
-- p_kategorien: Tätigkeiten für neue Anfragen (leer = alle, null = bisherige Auswahl behalten)
create or replace function public.push_anmelden(p_endpoint text, p_p256dh text, p_auth text, p_neue boolean default false, p_kategorien text[] default null)
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
  if p_kategorien is not null and not (p_kategorien <@ array['garten', 'einkaufen', 'tiere', 'haushalt', 'tragen', 'technik']) then
    raise exception 'Diese Tätigkeit gibt es nicht.';
  end if;
  insert into public.push_abos (endpoint, profil, p256dh, auth, neue_anfragen, kategorien)
  values (p_endpoint, ich, p_p256dh, p_auth, coalesce(p_neue, false), coalesce(p_kategorien, '{}'))
  on conflict (endpoint) do update
    set profil = excluded.profil, p256dh = excluded.p256dh, auth = excluded.auth, neue_anfragen = excluded.neue_anfragen,
        kategorien = case when p_kategorien is null and public.push_abos.profil = excluded.profil then public.push_abos.kategorien else excluded.kategorien end;
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

-- ---------------------------------------------------------------------
-- Erinnerungen (stündlich über pg_cron, siehe unten). Jede nur einmal je Auftrag und Person, nie nachts.
--   vorher:     am Abend vor dem Termin an beide (bei mehreren möglichen Tagen: vor dem letzten Tag an die helfende Person)
--   nachher:    am Tag nach dem Termin an die helfende Person: „Hat alles geklappt? Melde es als erledigt.“
--   bestaetigen: einen Tag nach „erledigt“ an die suchende Person, wenn sie noch nicht bestätigt hat
-- ---------------------------------------------------------------------
create table if not exists privat.erinnerungen (
  gesuch_id uuid not null references public.gesuche (id) on delete cascade,
  art text not null,
  an uuid not null,
  gesendet timestamptz not null default now(),
  primary key (gesuch_id, art, an)
);
alter table privat.erinnerungen enable row level security;
revoke all on privat.erinnerungen from public, anon, authenticated;

create or replace function privat.erinnern(p_jetzt timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ortszeit timestamp := p_jetzt at time zone 'Europe/Berlin';
  heute date := (p_jetzt at time zone 'Europe/Berlin')::date;
  stunde integer := extract(hour from p_jetzt at time zone 'Europe/Berlin');
  g record;
  ein_tag boolean;
  anzahl integer := 0;
begin
  if stunde < 9 or stunde >= 21 then
    return 0;   -- nachts nie
  end if;

  -- Am Abend vor dem Termin (ab 17 Uhr)
  if stunde >= 17 then
    for g in
      select x.*, e.vorname as wer, h.vorname as hilft
      from public.gesuche x
      join public.profile e on e.id = x.ersteller
      join public.profile h on h.id = x.helfer
      where x.status = 'zugesagt' and x.bis = heute + 1
    loop
      -- Ein einzelner Tag („Mi. 11. Nov., nachmittags“) oder mehrere zur Wahl („Mo. 16. oder Mi. 18. Nov.“, „Woche …“)?
      ein_tag := g.wann ~ '^(Mo|Di|Mi|Do|Fr|Sa|So)\. [0-9]{1,2}\. [^,]+(,|$)' and position(' oder ' in g.wann) = 0;
      if not exists (select 1 from privat.erinnerungen where gesuch_id = g.id and art = 'vorher' and an = g.helfer) then
        insert into privat.erinnerungen (gesuch_id, art, an) values (g.id, 'vorher', g.helfer);
        anzahl := anzahl + 1;
        if ein_tag then
          perform privat.push_senden(array[g.helfer], 'Morgen bei ' || g.wer || ': „' || g.titel || '“',
            g.wann || '. Tippe für Adresse und Sicherheits-Code.', 'anfrage-' || g.id, 'erinnerung-' || g.id);
        else
          perform privat.push_senden(array[g.helfer], 'Morgen ist der letzte Tag: „' || g.titel || '“',
            'Habt ihr schon einen Tag ausgemacht? Tippe, um ' || g.wer || ' zu schreiben.', 'anfrage-' || g.id, 'erinnerung-' || g.id);
        end if;
      end if;
      if ein_tag and not exists (select 1 from privat.erinnerungen where gesuch_id = g.id and art = 'vorher' and an = g.ersteller) then
        insert into privat.erinnerungen (gesuch_id, art, an) values (g.id, 'vorher', g.ersteller);
        anzahl := anzahl + 1;
        perform privat.push_senden(array[g.ersteller], 'Morgen kommt ' || g.hilft,
          '„' || g.titel || '“ · ' || g.wann || '. Frag an der Tür nach dem Sicherheits-Code.', 'anfrage-' || g.id, 'erinnerung-' || g.id);
      end if;
    end loop;
  end if;

  -- Am Tag nach dem Termin (ab 10 Uhr): erledigt melden?
  if stunde >= 10 then
    for g in
      select x.*, e.vorname as wer
      from public.gesuche x join public.profile e on e.id = x.ersteller
      where x.status = 'zugesagt' and x.bis is not null and x.bis < heute and x.bis >= heute - 14
        and not exists (select 1 from privat.erinnerungen r where r.gesuch_id = x.id and r.art = 'nachher' and r.an = x.helfer)
    loop
      insert into privat.erinnerungen (gesuch_id, art, an) values (g.id, 'nachher', g.helfer);
      anzahl := anzahl + 1;
      perform privat.push_senden(array[g.helfer], 'Hat alles geklappt?',
        '„' || g.titel || '“ bei ' || g.wer || ': Melde den Auftrag als erledigt, dann kann ' || g.wer || ' bestätigen.', 'anfrage-' || g.id, 'erinnerung-' || g.id);
    end loop;

    -- Einen Tag nach „erledigt“: bitte bestätigen
    for g in
      select x.*, h.vorname as hilft
      from public.gesuche x join public.profile h on h.id = x.helfer
      where x.status = 'erledigt' and x.geaendert < p_jetzt - interval '1 day' and x.geaendert > p_jetzt - interval '14 days'
        and not exists (select 1 from privat.erinnerungen r where r.gesuch_id = x.id and r.art = 'bestaetigen' and r.an = x.ersteller)
    loop
      insert into privat.erinnerungen (gesuch_id, art, an) values (g.id, 'bestaetigen', g.ersteller);
      anzahl := anzahl + 1;
      perform privat.push_senden(array[g.ersteller], 'Bitte kurz bestätigen',
        g.hilft || ' hat „' || g.titel || '“ als erledigt gemeldet. Ein Tipp genügt.', 'anfrage-' || g.id, 'erinnerung-' || g.id);
    end loop;
  end if;

  delete from privat.erinnerungen where gesendet < p_jetzt - interval '60 days';
  return anzahl;
exception when others then
  raise warning 'Erinnerungen nicht verschickt: %', sqlerrm;
  return anzahl;
end;
$$;

-- ---------------------------------------------------------------------
-- Fehlerberichte der App (ohne Namen und Inhalte, 30 Tage) und Indizes für Fremdschlüssel
-- ---------------------------------------------------------------------
create table if not exists privat.fehlerberichte (
  id bigint generated always as identity primary key,
  tag date not null default current_date,
  schluessel text not null,
  zeit timestamptz not null default now(),
  anzahl integer not null default 1,
  angemeldet boolean not null default false,
  nachricht text not null,
  stelle text not null default '',
  geraet text not null default '',
  fassung text not null default '',
  unique (tag, schluessel)
);
alter table privat.fehlerberichte enable row level security;
create index if not exists fehlerberichte_zeit_idx on privat.fehlerberichte (zeit);

create or replace function public.fehler_melden(p_nachricht text, p_stelle text default '', p_geraet text default '', p_fassung text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text := left(btrim(coalesce(p_nachricht, '')), 300);
  s text := left(btrim(coalesce(p_stelle, '')), 200);
  g text := left(btrim(coalesce(p_geraet, '')), 200);
  f text := left(btrim(coalesce(p_fassung, '')), 20);
begin
  if n = '' then
    return;
  end if;
  -- Schutz vor Überflutung: höchstens 300 verschiedene Meldungen pro Stunde
  if (select count(*) from privat.fehlerberichte where zeit > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into privat.fehlerberichte (tag, schluessel, angemeldet, nachricht, stelle, geraet, fassung)
  values (current_date, md5(n || '|' || s || '|' || g || '|' || f), auth.uid() is not null, n, s, g, f)
  on conflict (tag, schluessel) do update
    set anzahl = least(privat.fehlerberichte.anzahl + 1, 1000000), zeit = now();
  delete from privat.fehlerberichte where tag < current_date - 30;
end;
$$;

revoke execute on function public.fehler_melden(text, text, text, text) from public;
grant execute on function public.fehler_melden(text, text, text, text) to anon, authenticated;

create index if not exists bewertungen_von_idx on public.bewertungen (von);
create index if not exists bewertungen_an_idx on public.bewertungen (an);
create index if not exists gesuche_stadtteil_idx on public.gesuche (stadtteil);
create index if not exists meldungen_gemeldet_idx on public.meldungen (gemeldet);
create index if not exists meldungen_von_idx on public.meldungen (von);
create index if not exists profile_stadtteil_idx on public.profile (stadtteil);

-- Stündlich (Minute 7) die Erinnerungen prüfen. pg_cron gibt es bei Supabase, lokal fehlt es: dann nichts tun.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('hand-drauf-erinnerungen', '7 * * * *', 'select privat.erinnern()');
    perform cron.schedule('hand-drauf-bewertungen', '17 * * * *', 'select privat.bewertungen_freigeben()');
  end if;
end;
$$;

revoke execute on all functions in schema privat from public, anon, authenticated;
grant execute on function privat.ist_blockiert(uuid, uuid) to anon, authenticated;

-- Nur angemeldete Nutzer dürfen die Funktionen aufrufen
revoke execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision) from public, anon;
revoke execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision) from public, anon;
revoke execute on function public.ort_setzen(text, double precision, double precision, integer) from public, anon;
revoke execute on function public.umkreis_setzen(integer) from public, anon;
revoke execute on function public.mein_ort() from public, anon;
revoke execute on function public.gesuch_zusagen(uuid) from public, anon;
revoke execute on function public.gesuch_absagen(uuid) from public, anon;
revoke execute on function public.gesuch_erledigt(uuid) from public, anon;
revoke execute on function public.gesuch_bestaetigen(uuid) from public, anon;
revoke execute on function public.gesuch_zurueckziehen(uuid) from public, anon;
revoke execute on function public.bewerten(uuid, integer, text) from public, anon;
revoke execute on function public.bewertung_melden(uuid, uuid, text, text) from public, anon;
revoke execute on function public.bewertungen_von(uuid) from public;
revoke execute on function public.nachricht_senden(uuid, text) from public, anon;
revoke execute on function public.melden(uuid, text, text) from public, anon;
revoke execute on function public.konto_loeschen() from public, anon;
revoke execute on function public.blockieren(uuid) from public, anon;
revoke execute on function public.entblocken(uuid) from public, anon;
revoke execute on function public.push_anmelden(text, text, text, boolean, text[]) from public, anon;
revoke execute on function public.push_abmelden(text) from public, anon;
revoke execute on function public.push_test() from public, anon;
revoke execute on function public.neues_profil() from public, anon, authenticated;
-- Hilfsfunktionen nur für die Funktionen oben, nicht direkt aufrufbar
revoke execute on function public.ablauf(date) from public, anon, authenticated;
revoke execute on function public.termin_pruefen(date) from public, anon, authenticated;
revoke execute on function public.ungefaehre_lage(text) from public, anon, authenticated;
revoke execute on function public.telefon_pruefen(text) from public, anon, authenticated;
grant execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date, text, text, double precision, double precision) to authenticated;
grant execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date, text, text, double precision, double precision) to authenticated;
grant execute on function public.ort_setzen(text, double precision, double precision, integer) to authenticated;
grant execute on function public.umkreis_setzen(integer) to authenticated;
grant execute on function public.mein_ort() to authenticated;
grant execute on function public.gesuch_zusagen(uuid) to authenticated;
grant execute on function public.gesuch_absagen(uuid) to authenticated;
grant execute on function public.gesuch_erledigt(uuid) to authenticated;
grant execute on function public.gesuch_bestaetigen(uuid) to authenticated;
grant execute on function public.gesuch_zurueckziehen(uuid) to authenticated;
grant execute on function public.bewerten(uuid, integer, text) to authenticated;
grant execute on function public.bewertung_melden(uuid, uuid, text, text) to authenticated;
grant execute on function public.bewertungen_von(uuid) to anon, authenticated;
grant execute on function public.nachricht_senden(uuid, text) to authenticated;
grant execute on function public.melden(uuid, text, text) to authenticated;
grant execute on function public.konto_loeschen() to authenticated;
grant execute on function public.blockieren(uuid) to authenticated;
grant execute on function public.entblocken(uuid) to authenticated;
grant execute on function public.push_anmelden(text, text, text, boolean, text[]) to authenticated;
grant execute on function public.push_abmelden(text) to authenticated;
grant execute on function public.push_test() to authenticated;
-- Die Summen für die Startseite darf jeder lesen
revoke execute on function public.statistik() from public;
grant execute on function public.statistik() to anon, authenticated;
revoke execute on function public.richtwerte() from public;
grant execute on function public.richtwerte() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Live-Aktualisierung: Änderungen an Gesuchen und neue Nachrichten sofort an die Geräte senden
-- (Nachrichten bekommen nur die Beteiligten, die Zugriffsregeln oben gelten auch hier)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['gesuche', 'nachrichten'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then
        null;
      end;
    end loop;
  end if;
end;
$$;
