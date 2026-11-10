# Hand Drauf auf einem eigenen Server

Diese Anleitung bringt Hand Drauf von GitHub Pages auf eine eigene Adresse, zum Beispiel `https://handdrauf-garbsen.de/`. Die Datenbank bleibt bei Supabase in Frankfurt; nur die Website zieht um.

Alles, was sich beim Umzug ändert, steht in **einer** Datei: [`einstellungen.json`](einstellungen.json). Der Build prüft sie und bricht mit einer verständlichen Meldung ab, wenn etwas nicht passt (zum Beispiel ein geheimer Schlüssel an der falschen Stelle).

Es gibt zwei Wege:

| | Weg A: eigener Server (empfohlen) | Weg B: Webspace |
|---|---|---|
| Was | Ein kleiner Linux-Server mit Docker, darauf Caddy | Normaler Webspace mit Apache, Dateien per FTP hochladen |
| Kosten | ca. 4 bis 6 € im Monat plus Domain | oft schon vorhanden |
| HTTPS | Caddy holt das Zertifikat selbst | über das Kundenmenü des Anbieters |
| Updates | ein Befehl: `sh server/aktualisieren.sh` | Ordner `dist/` neu hochladen |
| Später möglich | Datensicherung, eigene Datenbank | eingeschränkt |

## Vorher: was es zu entscheiden gibt

1. **Domain**, zum Beispiel `handdrauf-garbsen.de` (bei INWX, IONOS, Strato, netcup …, ca. 1 € im Monat).
2. **Anbieter in Deutschland**, zum Beispiel Hetzner (Falkenstein/Nürnberg) oder netcup. Mit dem Anbieter einen **Vertrag zur Auftragsverarbeitung** abschließen; das geht bei beiden im Kundenmenü mit einem Klick.
3. **Betreiber-Angaben** für Impressum und Datenschutz (Name, ladungsfähige Anschrift, E-Mail). Ohne sie sollte die App nicht öffentlich beworben werden.

## Schritt 1: Einstellungen eintragen

In `einstellungen.json` (am einfachsten direkt auf GitHub bearbeiten):

```json
"adresse": "https://handdrauf-garbsen.de/",
"hosting": { "art": "server", "anbieter": "Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen", "standort": "Deutschland" },
"betreiber": { "name": "…", "anschrift": "…", "email": "…", "telefon": "" }
```

Bei Weg B ist `"art": "server"` ebenfalls richtig; bei `anbieter` den Webspace-Anbieter eintragen.

Damit passen sich automatisch an: Datenschutzerklärung (Abschnitt „Wenn du die App aufrufst“), der QR-Code unter „Nachbarn einladen“, die Link-Vorschau für WhatsApp und die Sicherheits-Kopfzeilen des Servers.

## Schritt 2a: Weg A, eigener Server mit Docker

**Server anlegen:** Ubuntu 24.04, kleinste Größe reicht (2 GB RAM). Beim Anlegen einen SSH-Schlüssel hinterlegen.

**Domain verbinden:** Beim Domain-Anbieter einen **A-Eintrag** für `@` und für `www` auf die IP-Adresse des Servers setzen (bei IPv6 zusätzlich **AAAA**). Das kann bis zu einer Stunde dauern.

**Auf dem Server** (per SSH angemeldet):

```sh
apt update && apt install -y git python3 docker.io docker-compose-v2 ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
git clone https://github.com/z6dfczy4jt-code/Nachbarhand.git /srv/handdrauf
cd /srv/handdrauf
cp server/.env.beispiel server/.env
nano server/.env          # DOMAIN und EMAIL eintragen, speichern mit Strg+O, Strg+X
sh server/aktualisieren.sh
```

Nach etwa einer Minute ist die App unter `https://DOMAIN/` erreichbar, mit gültigem Zertifikat. `www.DOMAIN` leitet auf die Domain ohne www.

**Updates** (nach jeder Änderung auf GitHub): auf dem Server `sh /srv/handdrauf/server/aktualisieren.sh`. Die App auf den Handys meldet sich dann mit „Es gibt eine neue Fassung“.

**Empfohlen:** supabase-js vom eigenen Server ausliefern statt vom CDN jsDelivr (eine fremde Stelle weniger, Abschnitt dazu verschwindet automatisch aus der Datenschutzerklärung):

```sh
cd /srv/handdrauf
curl -fo assets/vendor/supabase-js-2.110.1.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/dist/umd/supabase.js
sh server/aktualisieren.sh
```

Besser noch: die Datei einmal ins Repository legen (dann gilt es auch für GitHub Pages und die iPhone-App).

## Schritt 2b: Weg B, Webspace

1. Auf dem eigenen Rechner bauen: `python3 tools/build.py --dist`
2. Den **Inhalt** des Ordners `dist/` in das Hauptverzeichnis des Webspace hochladen, auch die versteckte Datei `.htaccess`.
3. Im Kundenmenü HTTPS (Let's Encrypt) für die Domain einschalten.

Die `.htaccess` setzt die Sicherheits-Kopfzeilen, leitet auf HTTPS um und regelt das Zwischenspeichern. Sie braucht die Apache-Module `mod_headers` und `mod_rewrite`, die bei üblichen Webspaces an sind.

## Schritt 3: Supabase auf die neue Adresse einstellen

Sonst führen die Bestätigungs-E-Mails noch zur alten Adresse.

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: die neue Adresse, z. B. `https://handdrauf-garbsen.de/`
3. **Redirect URLs**: die neue Adresse hinzufügen. Die alte erst nach ein paar Wochen entfernen.

Außerdem in `supabase/functions/push/index.ts` bei `KONTAKT` die neue Adresse eintragen und die Funktion neu veröffentlichen (Claude kann das übernehmen). Damit wissen Google, Apple und Mozilla, wer die Benachrichtigungen schickt.

## Schritt 4: Aushang und alte Adresse

- **Aushang:** Der QR-Code in der App passt sich beim Bauen selbst an. Das PDF zum Ausdrucken neu erzeugen: `python3 design/aushang.py` (oder Claude bitten). Alte Aushänge führen weiter zur alten Adresse, siehe nächster Punkt.
- **Alte Adresse:** GitHub Pages zunächst weiterlaufen lassen. Läuft die neue Adresse, erzeugt `python3 tools/weiterleitung.py https://NEUE-ADRESSE/` eine Umzugsseite: Sie erklärt kurz, was zu tun ist, leitet nach wenigen Sekunden weiter (Links auf Anfragen und den Aushang bleiben gültig) und räumt die alte Offline-Hülle auf. Die drei Dateien aus `weiterleitung/` kommen in einen eigenen Zweig `gh-pages`, und GitHub Pages wird auf diesen Zweig umgestellt (Settings → Pages). Claude kann das übernehmen.

**Wichtig für alle Nutzer:** Browser trennen Daten nach Adresse. Auf der neuen Adresse muss man sich **einmal neu anmelden** und **„Bescheid aufs Handy“ neu einschalten**. Wer die App auf dem Startbildschirm hat, legt sie von der neuen Adresse neu ab. Am besten in der Weiterleitung und einmal per Aushang/Nachricht darauf hinweisen.

## Schritt 5: Prüfen

- Die App öffnen, anmelden, eine Anfrage ansehen, die Karte ansehen.
- https://securityheaders.com mit der neuen Adresse aufrufen: Erwartet ist die Note **A** oder besser.
- Impressum und Datenschutz in der App lesen: Betreiber und Anbieter richtig?

## Datensicherung (nur Weg A)

Supabase sichert im kostenlosen Plan nicht dauerhaft. Der eigene Server kann das jede Nacht übernehmen:

```sh
cd /srv/handdrauf/server
cp sicherung.env.beispiel sicherung.env
nano sicherung.env        # Verbindung aus Supabase → „Connect“ → „Session pooler“, Passwort einsetzen
chmod 600 sicherung.env
./sicherung.sh            # einmal von Hand testen
crontab -e                # diese Zeile ergänzen:
# 30 3 * * * /srv/handdrauf/server/sicherung.sh >> /var/log/handdrauf-sicherung.log 2>&1
```

Die Sicherungen liegen in `server/sicherungen/` (nur für den Server-Administrator lesbar) und werden nach 14 Tagen gelöscht. Sie enthalten persönliche Daten (Adressen, Nachrichten): nicht weitergeben, nicht unverschlüsselt kopieren.

## Was der Server mitbringt

- **HTTPS** mit automatischer Verlängerung (Caddy)
- **Sicherheits-Kopfzeilen:** Content-Security-Policy (nur eigene Skripte, per Fingerabdruck), HSTS, kein Einbetten in fremde Seiten, keine Kamera/Mikrofon/Standort
- **Keine Zugriffsprotokolle** (Datenschutz)
- **Kompression** (zstd/gzip) und sinnvolles Zwischenspeichern: Seite immer frisch, Bilder und Schriften eine Woche
- **404-Seite**, `robots.txt`, `security.txt` (sobald eine Betreiber-E-Mail eingetragen ist)

Die Kopfzeilen erzeugt `python3 tools/build.py --dist` nach `server/erzeugt/` (für Caddy) und `dist/.htaccess` (für Apache). Nicht von Hand ändern, sie hängen vom Inhalt der App ab.

## Später: eigene Datenbank statt Supabase

Möglich, aber deutlich mehr Arbeit: Supabase lässt sich mit Docker selbst betreiben (Postgres, Anmeldung, Edge Functions). `supabase/schema.sql` enthält alles für die Datenbank, die Sicherung oben die Daten. Erst sinnvoll, wenn der kostenlose Plan nicht mehr reicht.
