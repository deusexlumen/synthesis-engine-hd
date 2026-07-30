# Ephemeris-Lizenz & Pro-Aktivierung — Runbook

Schritt-für-Schritt-Anleitung, um den PROFESSIONAL-Ephemeris-Tier (Swiss Ephemeris,
PREMIUM/PRO) produktiv zu schalten. Hintergrund und Architektur:
`AGENTS.md` (Abschnitt „Ephemeris-Provider & Präzisions-Staffelung"),
Standard-Tier-Genauigkeit: `docs/EPHEMERIS_STANDARD_PROVIDER.md`.

> **AGPL-Merksatz:** Swiss Ephemeris (`sweph`) steht unter der AGPL bzw. einer
> kommerziellen Astrodienst-Lizenz. Wer das Backend mit `sweph` öffentlich
> betreibt, ohne die kommerzielle Lizenz zu besitzen, muss nach AGPL den
> vollständigen Quelltext des Dienstes offenlegen. **Die Lizenz ist daher VOR
> jedem öffentlichen Deployment mit `EPHEMERIS_PRO_ENABLED=true` zu erwerben.**
> Der Standard-Tier (astronomia, MIT) ist davon nicht betroffen — ein Launch
> ohne Pro-Tier ist jederzeit lizenzfrei möglich.

## Schritt 1: Astrodienst-Lizenz erwerben

1. Auf [astrodienst.com](https://www.astrodienst.com) die Seite zur
   Swiss-Ephemeris-Lizenzierung aufrufen (Professional License).
2. Kommerzielle Lizenz erwerben — aktuell ca. **500 €** (einmalig, Stand 2026;
   Konditionen beim Anbieter prüfen).
3. Lizenznachweis ablegen (Kaufbestätigung/Rechnung), er wird bei Audits oder
   Rückfragen benötigt.

## Schritt 2: Ephemeris-Dateien (.se1) bereitstellen

Die Pro-Berechnung nutzt die komprimierten Swiss-Ephemeris-Dateien:

```bash
# Linux/macOS
scripts/download-ephemeris.sh

# Windows (PowerShell)
scripts/download-ephemeris.ps1
```

- Zielverzeichnis: `backend/ephemeris/` (Default-Auflösung von `SE_EPHE_PATH`).
- Integrität gegen `scripts/ephemeris-checksums.sha256` prüfen (das Skript
  verifiziert bereits beim Download).

## Schritt 3: Deployment mit Pro-Tier

**Variante A — Docker-Image mit WITH_SWEPH:**

```bash
cd backend
docker build --build-arg WITH_SWEPH=true -t synthesis-backend-pro .
```

Das Pro-Image enthält das native `sweph`-Modul (optionalDependencies), die
`.se1`-Dateien und setzt `EPHEMERIS_PRO_ENABLED=true` bereits im Image.

**Variante B — Docker Compose (Pro-Profil):**

```bash
docker compose --profile pro up -d backend-pro
```

Der `backend-pro`-Service baut automatisch mit `WITH_SWEPH=true`, läuft auf
Port **3001** (parallel zum Standard-Backend auf 3000) und setzt
`EPHEMERIS_PRO_ENABLED=true` sowie `SE_EPHE_PATH=/app/ephemeris`.

**Variante C — Manuelles Deployment (z. B. Render):**

1. `pnpm install` **mit** optionalen Dependencies ausführen (kein
   `--no-optional`), damit `sweph` nativ kompiliert wird (Build-Tools nötig).
2. `.se1`-Dateien nach `backend/ephemeris/` legen (Schritt 2).
3. Umgebungsvariablen setzen:
   - `EPHEMERIS_PRO_ENABLED=true`
   - `SE_EPHE_PATH=./ephemeris` (oder absoluter Pfad)

Ohne Flag oder ohne ladbarers `sweph`-Modul fällt der Resolver still auf den
Standard-Provider zurück — ein versehentlich falsch konfiguriertes Pro-
Deployment bricht also nicht, liefert aber nur Standard-Genauigkeit.

## Schritt 4: Verifikation

1. **Health-Endpoint** — meldet die Verfügbarkeit beider Backends:

   ```bash
   curl http://localhost:3001/api/hd/health
   ```

   Erwartung im `providers`-Feld:

   ```json
   { "name": "swiss-professional", "available": true, "enabledByConfig": true }
   ```

2. **Berechnung mit PRO-Token** — Request mit JWT eines PREMIUM/PRO-Nutzers:

   ```bash
   curl -X POST http://localhost:3001/api/hd/calculate \
     -H "Authorization: Bearer <PRO_TOKEN>" -H "Content-Type: application/json" \
     -d '{"date":"1990-01-01","time":"12:00","lat":52.52,"lon":13.405}'
   ```

   Erwartung: `"accuracy": "PROFESSIONAL"` und
   `"meta.ephemerisProvider": "swiss-professional"`. Ein FREE-/Gast-Request
   gegen dieselbe Instanz muss weiterhin `"accuracy": "STANDARD"` liefern.

## Schritt 5: Upsell-/Marketing-Texte final aktivieren

- Das Frontend zeigt die Genauigkeitsstufe bereits als Accuracy-Badge
  (`app/src/components/AccuracyBadge.tsx`) inkl. Upsell-Hinweis für
  Gäste/FREE — technisch nichts mehr zu ändern.
- Für externe Marketing-Texte (Pricing-Page, Ads) gelten nur belegte Aussagen:
  - PRO: „Swiss Ephemeris Professional — Referenzgenauigkeit inkl. Chiron".
  - FREE/BASIC: die **gemessenen** Standard-Werte aus
    `docs/EPHEMERIS_STANDARD_PROVIDER.md` (z. B. Sonne 0,0059° max. Fehler);
    keine absoluten Superlative, keine NASA-JPL-Vergleiche für das FREE-Tier.

## Schritt 6: Stripe-Tiers verdrahten

Der Resolver liest den Tier aus dem JWT (`SubscriptionTier` im Prisma-Schema).
Damit zahlende Nutzer tatsächlich PREMIUM/PRO erhalten, muss die
Stripe-Integration Checkout → Webhook → `subscription.tier`-Update liefern —
siehe `MONETIZATION_PLAN.md` (Schema vorbereitet, Checkout-/Webhook-Code fehlt).
**Stripe bleibt ein separater Launch-Blocker** und ist nicht Teil dieses
Runbooks; bis dahin können Pro-Tiers nur manuell in der Datenbank gesetzt
werden (z. B. für interne Tests).
