-- Hand Drauf: Datenbank-Update November 2026, Teil 9 (eingespielt am 12. November 2026)
-- Profile zum Selbstgestalten: Profilbild, „Über mich“, „Ich helfe gern bei …“, Sprachen, wann man meist Zeit hat.
-- * Alles davon ist freiwillig und für alle sichtbar (wie Vorname und Ort).
-- * Profilbilder liegen im öffentlichen Speicher „profilbilder“, jede Person nur im eigenen Ordner (Ordnername =
--   Profil-ID). Die App verkleinert Bilder vorher auf 400 × 400 Bildpunkte (JPEG); dabei fallen Metadaten wie
--   der Aufnahmeort weg.
-- * Profile lassen sich melden (zum Beispiel ein unpassendes Bild).
-- Voraussetzung: Teil 5 bis 8 sind eingespielt. Kann gefahrlos mehrfach laufen.

create schema if not exists privat;

alter table public.profile add column if not exists bio text not null default '';
alter table public.profile add column if not exists bild text not null default '';
alter table public.profile add column if not exists hilft_gern text[] not null default '{}';
alter table public.profile add column if not exists sprachen text[] not null default '{}';
alter table public.profile add column if not exists zeiten text[] not null default '{}';
alter table public.profile drop constraint if exists profile_bio_check;
alter table public.profile add constraint profile_bio_check check (char_length(bio) <= 300);
alter table public.profile drop constraint if exists profile_bild_check;
alter table public.profile add constraint profile_bild_check check (bild = '' or bild ~ '^[0-9a-f-]{36}/[0-9a-z_-]{1,40}\.jpg$');
alter table public.profile drop constraint if exists profile_hilft_gern_check;
alter table public.profile add constraint profile_hilft_gern_check
  check (hilft_gern <@ array['garten', 'einkaufen', 'tiere', 'haushalt', 'tragen', 'technik']);
alter table public.profile drop constraint if exists profile_zeiten_check;
alter table public.profile add constraint profile_zeiten_check
  check (zeiten <@ array['morgens', 'vormittags', 'nachmittags', 'abends', 'wochenende']);
alter table public.profile drop constraint if exists profile_sprachen_check;
alter table public.profile add constraint profile_sprachen_check check (cardinality(sprachen) <= 8);

-- Meldungen können jetzt auch ein Profil betreffen (ohne Anfrage)
alter table public.meldungen drop constraint if exists meldungen_art_check;
alter table public.meldungen add constraint meldungen_art_check check (art in ('anfrage', 'bewertung', 'profil'));

-- Angaben im eigenen Profil ändern. null = unverändert lassen.
create or replace function public.profil_bearbeiten(p_bio text default null, p_hilft_gern text[] default null,
  p_sprachen text[] default null, p_zeiten text[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
  b text;
  s text[];
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  if p_bio is not null then
    -- Leerzeichen zusammenfassen, höchstens eine Leerzeile am Stück
    b := btrim(regexp_replace(regexp_replace(p_bio, '[ \t]+', ' ', 'g'), '\n\s*\n+', E'\n\n', 'g'));
    if char_length(b) > 300 then
      raise exception '„Über mich“ darf höchstens 300 Zeichen lang sein.';
    end if;
    if b <> '' and privat.anstoessig(b) then
      raise exception 'Bitte schreib sachlich. Beleidigende oder anstößige Wörter werden nicht veröffentlicht.';
    end if;
    if b ~ '\S+@\S+\.\S+' or b ~ '\d[\d /-]{6,}\d' then
      raise exception 'Bitte keine Telefonnummern oder E-Mail-Adressen ins Profil schreiben. Alle können es lesen.';
    end if;
  end if;
  if p_hilft_gern is not null and not (p_hilft_gern <@ array['garten', 'einkaufen', 'tiere', 'haushalt', 'tragen', 'technik']) then
    raise exception 'Unbekannte Tätigkeit.';
  end if;
  if p_zeiten is not null and not (p_zeiten <@ array['morgens', 'vormittags', 'nachmittags', 'abends', 'wochenende']) then
    raise exception 'Unbekannte Tageszeit.';
  end if;
  if p_sprachen is not null then
    select coalesce(array_agg(distinct x order by x), '{}') into s
    from (select upper(left(v, 1)) || substr(v, 2) as x
          from (select btrim(regexp_replace(u, '\s+', ' ', 'g')) as v from unnest(p_sprachen) as u) roh) t
    where x <> '';
    if cardinality(s) > 8 then
      raise exception 'Bitte höchstens 8 Sprachen.';
    end if;
    if exists (select 1 from unnest(s) as x where char_length(x) > 30 or x !~ '^[[:alpha:]][[:alpha:] -]*$' or privat.anstoessig(x)) then
      raise exception 'Bitte nur Namen von Sprachen eintragen.';
    end if;
  end if;
  update public.profile set
    bio = coalesce(b, bio),
    hilft_gern = coalesce((select array_agg(distinct x order by x) from unnest(p_hilft_gern) as x), case when p_hilft_gern is null then hilft_gern else '{}' end),
    sprachen = coalesce(s, sprachen),
    zeiten = coalesce((select array_agg(distinct x order by x) from unnest(p_zeiten) as x), case when p_zeiten is null then zeiten else '{}' end)
  where id = ich;
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

-- Ein Profil melden (zum Beispiel ein unpassendes Bild oder ein beleidigender Text)
create or replace function public.profil_melden(p_person uuid, p_grund text, p_text text)
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
  if p_person = ich then
    raise exception 'Dein eigenes Profil kannst du nicht melden.';
  end if;
  if not exists (select 1 from public.profile where id = p_person) then
    raise exception 'Dieses Profil gibt es nicht mehr.';
  end if;
  if (select count(*) from public.meldungen
      where von = ich and erstellt > now() - interval '1 day') >= 10 then
    raise exception 'Du hast heute schon viele Meldungen geschickt. Wir prüfen sie zuerst.';
  end if;
  -- Je Person höchstens eine offene Meldung von dir: eine neue ersetzt die alte
  delete from public.meldungen where von = ich and gemeldet = p_person and art = 'profil' and status = 'neu';
  insert into public.meldungen (gesuch_id, gemeldet, von, grund, text, art)
  values (null, p_person, ich, p_grund, left(btrim(coalesce(p_text, '')), 500), 'profil');
end;
$$;

revoke execute on function public.profil_bearbeiten(text, text[], text[], text[]) from public, anon;
revoke execute on function public.profilbild_setzen(text) from public, anon;
revoke execute on function public.profil_melden(uuid, text, text) from public, anon;
grant execute on function public.profil_bearbeiten(text, text[], text[], text[]) to authenticated;
grant execute on function public.profilbild_setzen(text) to authenticated;
grant execute on function public.profil_melden(uuid, text, text) to authenticated;

-- Speicher für Profilbilder: öffentlich lesbar (nur über die genaue Adresse, keine Liste),
-- hochladen und löschen nur im eigenen Ordner, höchstens 1 MB, nur JPEG.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profilbilder', 'profilbilder', true, 1048576, array['image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
    drop policy if exists "Profilbild: eigenen Ordner lesen" on storage.objects;
    create policy "Profilbild: eigenen Ordner lesen" on storage.objects for select to authenticated
      using (bucket_id = 'profilbilder' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "Profilbild: hochladen" on storage.objects;
    create policy "Profilbild: hochladen" on storage.objects for insert to authenticated
      with check (bucket_id = 'profilbilder' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "Profilbild: löschen" on storage.objects;
    create policy "Profilbild: löschen" on storage.objects for delete to authenticated
      using (bucket_id = 'profilbilder' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end;
$$;
