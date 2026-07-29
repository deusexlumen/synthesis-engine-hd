# BUXE_OS v24.X — Synthesis Engine: Projektübersicht

> Stand: Juli 2026 | Für interne Demo & Kollegen-Besprechung

---

## 1. Was ist Synthesis Engine?

Eine Web-Anwendung zur Synthese von **Human Design**, **Gene Keys** und **Dan Millman Numerologie** — mit KI-gestützter Kreuzkorrelationsanalyse.

**Kernidee:** Der Nutzer gibt seine Geburtsdaten ein und bekommt eine personalisierte, ganzheitliche Analyse, die drei spirituelle/psychoanalytische Systeme in einem Dashboard vereint.

**Architektur:** Web-only — React + Vite Frontend (`app/`), Node.js/Express + Prisma Backend (`backend/`). Alle Berechnungen laufen serverseitig. Die frühere Desktop-Variante (Tauri/Rust) wurde vollständig entfernt.

---

## 2. Aktueller Funktionsumfang (Web-App)

| Modul | Status | Beschreibung |
|---|---|---|
| **Human Design Chart** | ✅ Produktionsreif | BodyGraph mit 9 Zentren, Energie-Typ, Autorität, Profil (1-6 Linien), Tor-Aktivierungen (1-64), Kanal-Analyse, Variablen. Berechnung serverseitig via Swiss Ephemeris (professionelle astronomische Genauigkeit). |
| **Dan Millman Numerologie** | ✅ Produktionsreif | Lebensweg, Wurzelzahlen, Meisterzahlen (11, 22), Null-Verstärker, Seelenweg (Vokale), Berufsweg (Konsonanten), Herausforderungen, Höhepunkte, Persönliches Jahr. |
| **Gene Keys** | ✅ Produktionsreif | 64 Gene Keys mit Schatten, Gabe und Siddhi — Hologenetisches Profil. |
| **Planetare Transits** | ✅ Produktionsreif | Tägliche Planetenpositionen und Vergleich mit Natal-Chart. |
| **KI-Synthese** | ✅ Produktionsreif | OpenAI/Anthropic/Google über den Backend-Proxy (API-Keys bleiben serverseitig bzw. laufen nur durch den Proxy). |
| **Journal** | ✅ Produktionsreif | Serverseitig mit dem Konto verknüpft; Gast-Modus lokal im Browser. |
| **PDF-Export** | ✅ Produktionsreif | Export von Charts und Reports als PDF. |
| **Auth & Subscription** | ⚠️ Teilweise | JWT-Authentifizierung und Subscription-Tiers (FREE / BASIC / PREMIUM / PRO) sind implementiert; Stripe-Anbindung fehlt noch. |

### Datenschutz-Realität
> **Alle Berechnungen laufen serverseitig im eigenen Backend.** Geburtsdaten werden dafür an das Backend übertragen; gespeichert werden die berechneten Profile/Charts mit dem Konto. KI-API-Keys laufen über den Backend-Proxy. Journal-Einträge liegen serverseitig (Gast-Modus: lokal im Browser). Die frühere Aussage „Geburtsdaten verlassen das Gerät nie" stammte aus der Desktop-Phase und gilt nicht mehr.

---

## 3. Technologie-Stack

### Frontend (Web: React + Vite)
| Komponente | Version | Zweck |
|---|---|---|
| React | 19.2 | UI Framework |
| TypeScript | 5.9 | Typisierung |
| Vite | 7.2 | Build Tool |
| Tailwind CSS | 3.4 | Styling |
| shadcn/ui | latest | 50+ UI Komponenten |
| Framer Motion | 12.34 | Animationen |
| Zustand | 5.0 | State Management |

### Backend (Node.js + Express)
| Komponente | Version | Zweck |
|---|---|---|
| Express | 4.18 | API Server |
| Prisma | 5.22 | ORM |
| OpenAI | 4.20 | KI-Integration |
| Supabase | 2.38 | Datenbank (PostgreSQL) |
| Zod | 3.22 | Validierung |
| Helmet | 7.1 | Security Headers |
| Swiss Ephemeris (Node) | sweph | Astronomische Berechnungen (AGPL — Lizenzfrage offen) |

---

## 4. Architektur-Entscheidungen

### Web-only (aktuell, gesetzt)
- **Grund:** Monetarisierung via SaaS-Modell, niedrigere Eintrittsbarriere, ein Deployment statt plattformspezifischer Builds
- **Umsetzung:** Browser-Frontend + gehostetes Backend; alle Berechnungen serverseitig (`humanDesignCalculator.ts`, `sweph`)
- **Historie:** Bis Mitte 2026 Desktop-first (Tauri v2 + Rust-Core); der Pivot zu Web-only ist abgeschlossen, `app/src-tauri` existiert nicht mehr

---

## 5. Next Steps / Roadmap

### Phase 1: Soft Launch (Web) — Q3 2026
- [ ] Beta-Test mit 10–20 Nutzern
- [ ] Feedback-Loop: UI/UX Verbesserungen
- [ ] Bugfixes & Stabilität
- [ ] Content: Erweiterte KI-Prompts, mehr Coaching-Impulse

### Phase 2: Kommerzieller Launch — Q4 2026
- [ ] Launch-Blocker abarbeiten (siehe `PRODUCTION_READY_PLAN.md`): sweph-Lizenz, Stripe, Deployment, Migrationen, Env
- [ ] Stripe-Integration für Subscriptions
- [ ] Landing Page + Pricing-Page
- [ ] Render + Supabase Deployment
- [ ] DSGVO-konforme Datenschutzerklärung (spiegelt die serverseitige Verarbeitung korrekt wider)

### Phase 3: Scale — Q1 2027
- [ ] Mobile-App (PWA oder React Native)
- [ ] Community-Features (Chart-Vergleiche, Freunde)
- [ ] Erweiterte Transit-Analyse (Jahres-Transits)
- [ ] API-Zugriff für PRO-Nutzer
- [ ] White-Label für Coaches & Berater

---

## 6. Monetarisierungs-Modell

| Tier | Preis (Ziel) | Features |
|---|---|---|
| **FREE** | 0€ | 1x HD-Chart, Basis-Transit, Tages-Impuls |
| **BASIC** | (reserviert) | Tier ist im Prisma-Enum angelegt, aktuell ohne eigenes Feature-Set |
| **PREMIUM** | ~9,99€/Monat | Unlimited Charts, KI-Synthese (20/Monat), PDF-Export, Coaching-Impulse (10/Monat) |
| **PRO** | ~29,99€/Monat | Alles aus PREMIUM + API-Zugriff, Transit-Zeitraum-Vergleich, Prioritätssupport |

**Zielgruppen:** Spirituell Interessierte, Coaches, Therapeuten, HR-Berater, Persönlichkeitsentwicklung

---

## 7. Assets für diese Session

| Asset | Pfad | Beschreibung |
|---|---|---|
| Monetarisierungs-Plan | `MONETIZATION_PLAN.md` | Detaillierte Tech-Stack & Launch-Strategie |
| Launch-Blocker | `PRODUCTION_READY_PLAN.md` | Was vor dem kommerziellen Launch fehlt |
| CI/CD Pipeline | `.github/workflows/` | GitHub Actions für Backend, Frontend, Docker |
| Docker-Setup | `docker-compose.yml` + `backend/Dockerfile` | Production-Ready Multi-Stage Build |

---

## 8. Risiken & Blocker

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Swiss Ephemeris Lizenz (AGPL) | Mittel | Kommerzielle Lizenz von Astrodienst erwerben (~500€) |
| KI-Kosten (OpenAI API) | Hoch | Token-Limiting pro Nutzer, Caching, günstigere Modelle |
| Konkurrenz (MyBodyGraph, etc.) | Mittel | Differenzierung via KI-Synthese & 3-System-Integration |
| Datenschutz-Aufwand (DSGVO) | Mittel | Serverseitige Verarbeitung transparent dokumentieren; gespeichert werden berechnete Ergebnisse, keine Roh-Geburtsdaten als Dauerzustand |

---

*Dokument generiert für interne Demo-Session. Bei Fragen: Buxe.*
