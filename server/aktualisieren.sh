#!/bin/sh
# Neue Fassung von GitHub holen, bauen und ausliefern. Auf dem Server im Projektordner ausführen:
#   sh server/aktualisieren.sh
set -e
cd "$(dirname "$0")/.."
git pull --ff-only
python3 tools/build.py --dist
cd server
if docker compose ps --status running --services 2>/dev/null | grep -q '^web$'; then
  # Neue Kopfzeilen übernehmen, ohne die Seite zu unterbrechen
  docker compose exec -T web caddy reload --config /etc/caddy/Caddyfile
else
  docker compose up -d
fi
echo "Fertig. Hand Drauf läuft mit der neuen Fassung."
