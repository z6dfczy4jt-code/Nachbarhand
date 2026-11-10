-- Hand Drauf: Datenbank-Update November 2026, Teil 5 (eingespielt am 10. November 2026)
-- * Erinnerungen per Benachrichtigung: am Abend vor dem Termin, am Tag danach („erledigt melden?“),
--   und wenn eine Bestätigung fehlt. Stündlich über pg_cron.
-- * Übliche Beträge je Tätigkeit aus echten Anfragen (richtwerte)
-- * „Ich helfe gern bei …“: Benachrichtigungen über neue Anfragen nur für gewählte Tätigkeiten
-- Kann gefahrlos mehrfach laufen. Alles hier steht auch in schema.sql.

alter table public.push_abos add column if not exists kategorien text[] not null default '{}';

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

-- Stündlich (Minute 7) die Erinnerungen prüfen. pg_cron gibt es bei Supabase, lokal fehlt es: dann nichts tun.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('hand-drauf-erinnerungen', '7 * * * *', 'select privat.erinnern()');
  end if;
end;
$$;

revoke execute on all functions in schema privat from public, anon, authenticated;
grant execute on function privat.ist_blockiert(uuid, uuid) to anon, authenticated;

-- Rechte
revoke execute on function public.push_anmelden(text, text, text, boolean, text[]) from public, anon;
grant execute on function public.push_anmelden(text, text, text, boolean, text[]) to authenticated;
revoke execute on function public.richtwerte() from public;
grant execute on function public.richtwerte() to anon, authenticated;
