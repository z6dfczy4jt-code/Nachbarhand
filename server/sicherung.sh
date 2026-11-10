#!/bin/bash
# Sichert die Datenbank (Supabase) auf den eigenen Server. Bewahrt 14 Tage auf.
# Einrichten und täglich laufen lassen: siehe SERVER.md, Abschnitt „Datensicherung“.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f sicherung.env ]; then
  echo "server/sicherung.env fehlt (Vorlage: sicherung.env.beispiel)"; exit 1
fi
. ./sicherung.env
mkdir -p sicherungen && chmod 700 sicherungen
datei="sicherungen/handdrauf-$(date +%Y-%m-%d).sql.gz"
# pg_dump in derselben Hauptversion wie die Datenbank (Supabase: PostgreSQL 17)
docker run --rm -e PGCONNECT_TIMEOUT=30 postgres:17-alpine \
  pg_dump --no-owner --no-privileges --schema=public --schema=privat --schema=auth "$DATENBANK_URL" \
  | gzip > "$datei.neu"
if [ "$(stat -c %s "$datei.neu")" -lt 2000 ]; then
  rm -f "$datei.neu"; echo "Sicherung ist verdächtig klein, bitte prüfen."; exit 1
fi
mv "$datei.neu" "$datei" && chmod 600 "$datei"
find sicherungen -name 'handdrauf-*.sql.gz' -mtime +14 -delete
echo "$(date '+%Y-%m-%d %H:%M') gesichert: $datei"
