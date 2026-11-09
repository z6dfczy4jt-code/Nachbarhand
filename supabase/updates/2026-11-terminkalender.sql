-- Hand Drauf: Datenbank-Update November 2026, Teil 3 (eingespielt am 9. November 2026)
-- Terminkalender: mehrere Tage und genaue Uhrzeit brauchen etwas mehr Platz im Wann-Text,
-- z. B. „Mo. 16., Mi. 18. oder Fr. 20. Nov., gegen 16:30 Uhr“. Kann gefahrlos mehrfach laufen.

alter table public.gesuche drop constraint if exists gesuche_wann_check;
alter table public.gesuche add constraint gesuche_wann_check check (char_length(wann) between 1 and 120);

-- Klarere Meldung, wenn ein Termin zu weit in der Zukunft liegt
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
revoke execute on function public.termin_pruefen(date) from public, anon, authenticated;

-- Mit dem Kalender lassen sich Tage bis zu 60 Tage im Voraus wählen. Die Anfrage bleibt
-- deshalb sichtbar, bis der letzte gewählte Tag vorbei ist (vorher: höchstens 21 Tage).
-- Ohne Termin (alte App) gilt weiter: nach 21 Tagen.
create or replace function public.ablauf(p_bis date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(((p_bis + 1)::timestamp at time zone 'Europe/Berlin'), now() + interval '21 days');
$$;
revoke execute on function public.ablauf(date) from public, anon, authenticated;
