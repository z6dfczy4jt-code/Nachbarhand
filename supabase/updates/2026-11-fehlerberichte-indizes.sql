-- Hand Drauf: Datenbank-Update November 2026, Teil 6 (noch nicht eingespielt, siehe SETUP.md)
-- * Fehlerberichte: Stürzt die App auf einem Gerät ab, schickt sie eine kurze technische Meldung
--   (Fehlertext, Stelle im Programm, Browser und Gerät, App-Fassung). Keine Namen, keine Inhalte,
--   keine IP-Adresse. Gleiche Fehler am selben Tag werden nur gezählt. Nach 30 Tagen gelöscht.
--   Ansehen: Supabase → Table Editor → Schema „privat“ → fehlerberichte
-- * Indizes für Fremdschlüssel (Hinweis der Supabase-Prüfung; schneller beim Löschen von Konten)
-- Kann gefahrlos mehrfach laufen. Alles hier steht auch in schema.sql.

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
