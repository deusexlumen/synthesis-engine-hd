# BUXE_OS v24.X — Monetarisierungs-Plan: Synthesis Engine Web

## Kern-These
Web-App = SaaS-Modell mit Subscription-Tiers. (Die frühere Tauri-Desktop-Variante als "Privacy-Premium" Add-on existiert nicht mehr — das Projekt ist Web-only.)

## Subscription-Tiers (Enum in `backend/prisma/schema.prisma`)

| Feature | FREE | BASIC | PREMIUM | PRO |
|---------|------|-------|---------|-----|
| HD-Chart (Basis) | ✅ 1x | ✅ unlimited | ✅ unlimited | ✅ unlimited |
| Transit-Tages-Impuls | ✅ | ✅ | ✅ | ✅ |
| KI-Synthese (Basis) | ❌ | ✅ 5/Monat | ✅ 20/Monat | ✅ unlimited |
| Coaching-Impulse | ❌ | ❌ | ✅ 10/Monat | ✅ unlimited |
| Transit-Zeitraum-Vergleich | ❌ | ❌ | ❌ | ✅ |
| PDF-Export | ❌ | ✅ | ✅ | ✅ |
| API-Zugriff | ❌ | ❌ | ❌ | ✅ |
| Präzisions-Ephemeris | Standard (astronomia) | Standard | **Swiss Ephemeris Professional** | **Swiss Ephemeris Professional** |
| Preis (Ziel) | 0€ | ~4,99€/Monat | ~9,99€/Monat | ~29,99€/Monat |

> Die Tier-Namen entsprechen dem Prisma-Enum `SubscriptionTier` (FREE, BASIC, PREMIUM, PRO). Die frühere Bezeichnung `SOUL_SYNC_PREMIUM` wurde auf `PREMIUM` vereinheitlicht. BASIC ist im Schema angelegt, das konkrete Feature-Set/der Preis ist noch offen.

### Präzisions-Staffelung (PREMIUM/PRO-Verkaufsargument)

Seit der Ephemeris-Provider-Architektur ist die Rechengenauigkeit ein Tier-Feature:

- **FREE/BASIC**: Standard-Provider (astronomia/Meeus, MIT) — gemessener Max-Fehler gegen eine Swiss-Ephemeris-Referenz über 10 Stichtage 1950–2030: Sonne 0,0059°, Mond 0,0152°, alle Planeten ≤ 0,0094° (Details: `docs/EPHEMERIS_STANDARD_PROVIDER.md`). Chiron ist im Standard-Tier nicht verfügbar.
- **PREMIUM/PRO**: „Swiss Ephemeris Professional" — Referenzgenauigkeit (±0,0001°) inkl. Chiron. Erfordert die kommerzielle Astrodienst-Lizenz und `EPHEMERIS_PRO_ENABLED=true` (Vorgehen: `docs/EPHEMERIS_LICENSE_RUNBOOK.md`).

Ehrliche Marketing-Aussagen: Für FREE/BASIC nur die gemessenen Standard-Werte nennen (für HD-Gates mit 5,625° Breite mehr als ausreichend) — keine absoluten Superlative und keine NASA-JPL-Vergleiche fürs FREE-Tier. Das Frontend zeigt die verwendete Genauigkeitsstufe als Accuracy-Badge mit Upsell-Hinweis (`app/src/components/AccuracyBadge.tsx`).

## Technische Architektur für Web-Monetarisierung

### 1. Backend-Hosting
- **Empfohlen**: Render.com (kostenloser Tier für Start, einfaches Scaling)
- **Alternative**: Railway.app, Fly.io, Hetzner Cloud
- **Docker**: Bereits eingerichtet (`backend/Dockerfile` + `docker-compose.yml`)

### 2. Datenbank
- **Empfohlen**: Supabase PostgreSQL (kostenloser Tier: 500MB, gute DX)
- **Alternative**: Render PostgreSQL, Neon.tech (serverless)
- **Migration**: `prisma migrate deploy` im Container-Start

### 3. Payments
- **Stripe** für Subscriptions (am reifsten, beste DX)
- Webhooks für Tier-Upgrades/Downgrades/Cancellations
- `subscription` Feld im `User` Model erweitern

### 4. Auth & Billing-Flow
```
1. User registriert sich (Supabase Auth oder eigene JWT)
2. FREE-Tier sofort verfügbar (1x HD-Chart)
3. Upsell nach erster Berechnung → Stripe Checkout
4. Webhook aktualisiert `subscription.tier` in DB
5. Middleware `requireTier` prüft Zugriff auf Endpunkte
```

### 5. HD-Berechnungen im Web-Modus
HD-Berechnungen laufen inzwischen vollständig im Backend (`humanDesignCalculator.ts` + `sweph`):
- **Datenschutz-Policy**: Berechnung im Backend; gespeichert werden die berechneten Profile/Charts, keine Roh-Geburtsdaten als Dauerzustand
- **Audit-Log**: Nur Ergebnisse speichern, keine Rohdaten
- **DSGVO**: Datenschutzerklärung muss die serverseitige Verarbeitung korrekt beschreiben
- **Offen**: WASM-Module im Browser (swisseph zu WASM kompilieren) wären die privatsphäre-stärkste Option, aber deutlich komplexer — aktuell nicht geplant

### 6. Deployment-Pipeline
1. GitHub → GitHub Actions → Docker Build
2. Render/Railway pullt Image
3. Prisma Migration im Container-Start
4. Health-Check bestätigt Readiness

## Nächste Schritte
1. [ ] Stripe-Account erstellen + Produkte anlegen
2. [ ] Backend: Subscription-Webhook-Handler implementieren
3. [ ] Frontend: Pricing-Page + Stripe Checkout Integration
4. [x] Backend: HD-Berechnungs-Endpunkt (läuft, siehe `backend/src/routes/humanDesign.ts`)
5. [ ] Supabase/Railway PostgreSQL einrichten
6. [ ] Deploy auf Render/Railway (beim ersten Deploy: `prisma migrate deploy`)
7. [ ] Domain + SSL (Cloudflare)
8. [ ] Analytics (Plausible oder PostHog)

## Quick-Start für Dev-Preview
- Backend + Frontend auf Render deployen
- Supabase PostgreSQL als DB
- `VITE_API_URL` auf Render-Backend-URL setzen
- `pnpm build && pnpm preview` → Tunnel oder direkt Render static
