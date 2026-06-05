# BUXE_OS v24.X — Monetarisierungs-Plan: Synthesis Engine Web

## Kern-These
Web-App = SaaS-Modell mit Subscription-Tiers. Tauri-Desktop bleibt als "Privacy-Premium" Add-on für Power-User.

## Subscription-Tiers (bereits im Code angelegt)

| Feature | FREE | SOUL_SYNC_PREMIUM | PRO |
|---------|------|-------------------|-----|
| HD-Chart (Basis) | ✅ 1x | ✅ unlimited | ✅ unlimited |
| Transit-Tages-Impuls | ✅ | ✅ | ✅ |
| KI-Synthese (Basis) | ❌ | ✅ 20/Monat | ✅ unlimited |
| Coaching-Impulse | ❌ | ✅ 10/Monat | ✅ unlimited |
| Transit-Zeitraum-Vergleich | ❌ | ❌ | ✅ |
| PDF-Export | ❌ | ✅ | ✅ |
| Desktop-App (Tauri) | ❌ | ❌ | ✅ |
| API-Zugriff | ❌ | ❌ | ✅ |
| Preis (Ziel) | 0€ | ~9,99€/Monat | ~29,99€/Monat |

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
Für Web-Monetarisierung müssen HD-Berechnungen ans Backend:
- **Datenschutz-Lösung**: Berechnung im Backend, aber keine Speicherung von Geburtsdaten
- **Audit-Log**: Nur Ergebnisse speichern, keine Rohdaten
- **DSGVO-konform**: Datenverarbeitung nur auf Anfrage, keine persistierten Geburtsdaten
- **Alternative**: WASM-Module im Browser (swisseph zu WASM kompilieren) → höchste Privatsphäre, aber komplexer

### 6. Deployment-Pipeline
1. GitHub → GitHub Actions → Docker Build
2. Render/Railway pullt Image
3. Prisma Migration im Container-Start
4. Health-Check bestätigt Readiness

## Nächste Schritte (nach Tauri-Demo)
1. [ ] Stripe-Account erstellen + Produkte anlegen
2. [ ] Backend: Subscription-Webhook-Handler implementieren
3. [ ] Frontend: Pricing-Page + Stripe Checkout Integration
4. [ ] Backend: HD-Berechnungs-Endpunkt wiederherstellen (mit No-Persist-Policy)
5. [ ] Supabase/Railway PostgreSQL einrichten
6. [ ] Deploy auf Render/Railway
7. [ ] Domain + SSL (Cloudflare)
8. [ ] Analytics (Plausible oder PostHog)

## Quick-Start für Dev-Preview (heute)
- Backend + Frontend auf Render deployen
- Supabase PostgreSQL als DB
- `VITE_API_URL` auf Render-Backend-URL setzen
- `npm run build && npm run preview` → Tunnel oder direkt Render static
