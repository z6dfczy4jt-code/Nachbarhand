-- =====================================================================
-- Hand Drauf: Datenbank für Supabase
-- Im Supabase-Dashboard unter "SQL Editor" komplett einfügen und auf
-- "Run" tippen. Das Skript kann gefahrlos mehrfach ausgeführt werden.
--
-- Grundsätze
-- * Lesen: Jeder (auch ohne Konto) sieht offene Gesuche mit Vorname,
--   Anfangsbuchstabe und ungefährer Lage, bis der gewünschte Termin vorbei
--   ist (spätestens 21 Tage). Laufende Aufträge sehen nur die beiden Beteiligten.
-- * Die genaue Adresse sieht nur, wer das Gesuch erstellt hat, und wer
--   zugesagt hat.
-- * Schreiben: Niemand ändert Tabellen direkt. Alles läuft über die
--   Funktionen unten, die Regeln prüfen (Anmeldung, 18+, Grenzen für
--   Nachbarschaftshilfe, erlaubte Statuswechsel).
-- * Nachrichten lesen und schreiben nur die beiden Beteiligten eines
--   Auftrags. Meldungen kann über die App niemand lesen.
-- * Wer jemanden blockiert, sieht dessen Anfragen nicht mehr (und umgekehrt).
--   Beleidigende Wörter in Anfragen und Nachrichten werden abgelehnt.
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
  stadtteil text not null references public.stadtteile (name),
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

create or replace function public.neues_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := coalesce(new.raw_user_meta_data ->> 'stadtteil', '');
begin
  if not exists (select 1 from public.stadtteile where name = st) then
    st := 'Garbsen-Mitte';
  end if;
  insert into public.profile (id, vorname, nachname_initial, stadtteil, volljaehrig)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'vorname'), ''), 'Nachbar'), 40),
    upper(left(btrim(coalesce(new.raw_user_meta_data ->> 'nachname_initial', '')), 1)),
    st,
    coalesce(new.raw_user_meta_data ->> 'volljaehrig', '') = 'true'
  );
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
  wann text not null check (char_length(wann) between 1 and 60),
  dauer text not null default 'nach Absprache' check (char_length(dauer) <= 40),
  stadtteil text not null references public.stadtteile (name),
  lat double precision not null,
  lng double precision not null,
  status text not null default 'offen'
    check (status in ('offen', 'zugesagt', 'erledigt', 'bestaetigt', 'zurueckgezogen')),
  helfer uuid,
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
  using (
    (status = 'offen' and laeuft_ab > now() and not privat.ist_blockiert((select auth.uid()), ersteller))
    or ersteller = (select auth.uid()) or helfer = (select auth.uid())
  );
revoke insert, update, delete on public.gesuche from anon, authenticated;
grant select on public.gesuche to anon, authenticated;

-- ---------------------------------------------------------------------
-- Adressen (getrennt gespeichert, nur für die Beteiligten lesbar)
-- ---------------------------------------------------------------------
create table if not exists public.gesuch_adressen (
  gesuch_id uuid primary key references public.gesuche (id) on delete cascade,
  adresse text not null check (char_length(adresse) between 3 and 120)
);

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

-- ---------------------------------------------------------------------
-- Funktionen: alle Änderungen laufen hierüber
-- ---------------------------------------------------------------------

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
    raise exception 'Du hast schon 5 laufende Anfragen. Schließe zuerst eine ab.';
  end if;
  if char_length(btrim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Bitte gib deine Straße und Hausnummer an.';
  end if;
  perform public.termin_pruefen(p_bis);
  if privat.anstoessig(p_titel || ' ' || coalesce(p_beschreibung, '')) then
    raise exception 'Bitte formuliere deine Anfrage ohne beleidigende oder anstößige Wörter.';
  end if;

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
    raise exception 'Nur eigene Anfragen können bearbeitet werden.';
  end if;
  if g.status <> 'offen' then
    raise exception 'Bearbeiten geht nur, solange noch niemand zugesagt hat.';
  end if;
  if char_length(btrim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Bitte gib deine Straße und Hausnummer an.';
  end if;
  perform public.termin_pruefen(p_bis);
  if privat.anstoessig(p_titel || ' ' || coalesce(p_beschreibung, '')) then
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
  update public.gesuche set status = 'zugesagt', helfer = ich, geaendert = now() where id = p_id;
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
  update public.gesuche set status = 'offen', helfer = null, geaendert = now()
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

-- Nach einem bestätigten Auftrag bewerten sich beide gegenseitig (1 bis 5 Sterne).
create or replace function public.bewerten(p_id uuid, p_sterne integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  g public.gesuche%rowtype;
  ziel uuid;
  alt integer;
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

  select sterne into alt from public.bewertungen where gesuch_id = p_id and von = ich;
  if found then
    update public.bewertungen set sterne = p_sterne, erstellt = now() where gesuch_id = p_id and von = ich;
    update public.profile set sterne_summe = sterne_summe - alt + p_sterne where id = ziel;
  else
    insert into public.bewertungen (gesuch_id, von, an, sterne) values (p_id, ich, ziel, p_sterne);
    update public.profile set sterne_summe = sterne_summe + p_sterne, sterne_anzahl = sterne_anzahl + 1 where id = ziel;
  end if;
end;
$$;

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
  update public.gesuche set status = 'offen', helfer = null, geaendert = now()
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
  update public.gesuche set status = 'offen', helfer = null, geaendert = now()
  where helfer = ich and status = 'zugesagt';
  delete from auth.users where id = ich;
end;
$$;

-- Nur angemeldete Nutzer dürfen die Funktionen aufrufen
revoke execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date) from public, anon;
revoke execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date) from public, anon;
revoke execute on function public.gesuch_zusagen(uuid) from public, anon;
revoke execute on function public.gesuch_absagen(uuid) from public, anon;
revoke execute on function public.gesuch_erledigt(uuid) from public, anon;
revoke execute on function public.gesuch_bestaetigen(uuid) from public, anon;
revoke execute on function public.gesuch_zurueckziehen(uuid) from public, anon;
revoke execute on function public.bewerten(uuid, integer) from public, anon;
revoke execute on function public.nachricht_senden(uuid, text) from public, anon;
revoke execute on function public.melden(uuid, text, text) from public, anon;
revoke execute on function public.konto_loeschen() from public, anon;
revoke execute on function public.blockieren(uuid) from public, anon;
revoke execute on function public.entblocken(uuid) from public, anon;
revoke execute on function public.neues_profil() from public, anon, authenticated;
-- Hilfsfunktionen nur für die Funktionen oben, nicht direkt aufrufbar
revoke execute on function public.ablauf(date) from public, anon, authenticated;
revoke execute on function public.termin_pruefen(date) from public, anon, authenticated;
revoke execute on function public.ungefaehre_lage(text) from public, anon, authenticated;
grant execute on function public.gesuch_erstellen(text, text, text, integer, text, text, text, date) to authenticated;
grant execute on function public.gesuch_bearbeiten(uuid, text, text, text, integer, text, text, text, date) to authenticated;
grant execute on function public.gesuch_zusagen(uuid) to authenticated;
grant execute on function public.gesuch_absagen(uuid) to authenticated;
grant execute on function public.gesuch_erledigt(uuid) to authenticated;
grant execute on function public.gesuch_bestaetigen(uuid) to authenticated;
grant execute on function public.gesuch_zurueckziehen(uuid) to authenticated;
grant execute on function public.bewerten(uuid, integer) to authenticated;
grant execute on function public.nachricht_senden(uuid, text) to authenticated;
grant execute on function public.melden(uuid, text, text) to authenticated;
grant execute on function public.konto_loeschen() to authenticated;
grant execute on function public.blockieren(uuid) to authenticated;
grant execute on function public.entblocken(uuid) to authenticated;

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
