-- Hand Drauf: Datenbank-Update November 2026, Teil 8 (eingespielt am 12. November 2026)
-- Geschriebene Bewertungen und öffentliche Profile mit Rezensionen.
-- * Zu den Sternen kommt ein freiwilliger Text (bis 600 Zeichen).
-- * Beide Bewertungen eines Auftrags erscheinen gleichzeitig: sobald beide bewertet haben, spätestens 14 Tage
--   nach der ersten. Bis dahin lassen sie sich ändern, danach nicht mehr. Ist eine Bewertung schon erschienen,
--   kann die andere Person nicht mehr nachträglich bewerten. So kann niemand aus Ärger „zurückbewerten“.
-- * Durchschnitt und Anzahl im Profil zählen nur erschienene Bewertungen.
-- * Jede erschienene Bewertung lässt sich melden.
-- Voraussetzung: Teil 5 bis 7 sind eingespielt. Kann gefahrlos mehrfach laufen.

create schema if not exists privat;

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

-- Meldungen können jetzt auch eine Bewertung betreffen
alter table public.meldungen add column if not exists art text not null default 'anfrage';
alter table public.meldungen drop constraint if exists meldungen_art_check;
alter table public.meldungen add constraint meldungen_art_check check (art in ('anfrage', 'bewertung'));
alter table public.meldungen drop constraint if exists meldungen_einmal;
alter table public.meldungen add constraint meldungen_einmal unique (gesuch_id, von, art, gemeldet);

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

-- Eigene Bewertungen lesen (Sterne, Text, ob schon erschienen): wie bisher nur die eigenen
grant select on public.bewertungen to authenticated;

revoke execute on function privat.bewertungen_freigeben() from public, anon, authenticated;
revoke execute on function privat.bewertung_geloescht() from public, anon, authenticated;
revoke execute on function public.bewerten(uuid, integer, text) from public, anon;
revoke execute on function public.bewertung_melden(uuid, uuid, text, text) from public, anon;
revoke execute on function public.bewertungen_von(uuid) from public;
grant execute on function public.bewerten(uuid, integer, text) to authenticated;
grant execute on function public.bewertung_melden(uuid, uuid, text, text) to authenticated;
grant execute on function public.bewertungen_von(uuid) to anon, authenticated;

-- Stündlich (Minute 17) wartende Bewertungen erscheinen lassen. pg_cron gibt es bei Supabase, lokal fehlt es.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('hand-drauf-bewertungen', '17 * * * *', 'select privat.bewertungen_freigeben()');
  end if;
end;
$$;
