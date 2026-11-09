-- Hand Drauf: Datenbank-Update November 2026, Teil 2 (eingespielt am 9. November 2026)
-- Blockieren, Filter für anstößige Wörter, Fehlermeldungen mit „Anfrage“ statt „Gesuch“.
-- Setzt Teil 1 (2026-11-termine-und-bearbeiten.sql) voraus. Kann gefahrlos mehrfach laufen.

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

drop policy if exists "Offene und eigene Gesuche lesen" on public.gesuche;
create policy "Offene und eigene Gesuche lesen" on public.gesuche
  for select to anon, authenticated
  using (
    (status = 'offen' and laeuft_ab > now() and not privat.ist_blockiert((select auth.uid()), ersteller))
    or ersteller = (select auth.uid()) or helfer = (select auth.uid())
  );

-- Neues Gesuch
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

revoke execute on function public.blockieren(uuid) from public, anon;
revoke execute on function public.entblocken(uuid) from public, anon;
grant execute on function public.blockieren(uuid) to authenticated;
grant execute on function public.entblocken(uuid) to authenticated;

