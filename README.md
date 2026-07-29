<div align="center">

# 🔮 Synthesis Engine

### *Wo Wissenschaft auf Spiritualität trifft*

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Eine transformative Full-Stack-Anwendung zur Synthese von Human Design, Gene Keys und Dan Millman Numerologie mit KI-gestützter Kreuzkorrelationsanalyse**

> Web-App: React + Vite Frontend (`app/`) mit Node.js/Express + Prisma Backend (`backend/`). Alle Berechnungen laufen serverseitig.

[🚀 Features](#features) • [📦 Installation](#installation) • [🏗️ Architektur](#architektur) • [📚 Dokumentation](#dokumentation)

</div>

---

## ✨ Features

### 🔷 Human Design
- **Vollständige Chart-Berechnung** basierend auf Ra Uru Hu's System
- **9 Zentren** mit individueller Definition
- **Energie-Typ** (Manifestor, Generator, Manifesting Generator, Projector, Reflector)
- **Autorität** (emotionale, sakrale, Selbst-projizierte, etc.)
- **Profil** (Linien 1-6 Kombinationen)
- **64 Tor-Aktivierungen** mit planetaren Positionen
- **Kanal-Analyse** für definierte Verbindungen
- **SVG BodyGraph-Visualisierung**

### 🔑 Gene Keys
- **Alle 64 Gene Keys** mit detaillierten Beschreibungen
- **Drei Frequenzen**: Schatten → Gabe → Siddhi
- **Hologenetisches Profil**
- **Pearl-Sequenzen** (64 verschiedene Kombinationen)
- **Kontemplations-Fragen & Affirmationen**

### 🔢 Dan Millman Numerologie
- **Lebensweg-Berechnung** (z.B. 35/8)
- **Wurzelzahlen** und ihre Bedeutungen
- **Meisterzahlen** (11, 22, 33) Erkennung
- **Null-Verstärker** Logik
- **Seelenweg** (Vokale aus dem Namen)
- **Berufsweg** (Konsonanten aus dem Namen)
- **Herausforderungen** (1., 2., 3., 4.)
- **Höhepunkte** nach Lebensaltern
- **Persönliches Jahr** Berechnung

### 🤖 KI-Synthese
- **Multi-Provider Support**: OpenAI GPT-4o-mini, Anthropic Claude, Google Gemini
- **Sokratischer, reflektierender Stil** (nicht belehrend)
- **Kreuzkorrelationsanalyse** aller drei Systeme
- **Personalisierte Coaching-Impulse**
- **30-Tage Cache** für KI-generierte Inhalte

### 🌟 Zusätzliche Features
- **🪐 Planetare Transits**: Tägliche Planetenpositionen und Vergleich mit Natal-Chart
- **📓 Journal**: Einträge serverseitig mit dem Konto verknüpft; im Gast-Modus lokal im Browser
- **📄 PDF-Export**: Exportiere Charts, Reports und Journal-Einträge
- **🌍 Smart Geocoding**: Open-Meteo Integration für Ortsuche und Zeitzonenerkennung
- **🎨 Neo-Mystic Design**: Dark Mode, Glassmorphism, Framer Motion Animationen

---

## 🖥️ Screenshots

> *Screenshots werden nach dem ersten Release hinzugefügt*

```
┌─────────────────────────────────────────────────────────────┐
│  Synthesis Engine                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  BodyGraph Visualisierung                           │   │
│  │  ╭───────────────────────────────╮                  │   │
│  │  │        [9 Zentren]            │   Numerologie    │   │
│  │  │         [Kanäle]              │   ┌──────────┐   │   │
│  │  │      [Tor-Aktivierungen]      │   │ Lebensweg│   │   │
│  │  ╰───────────────────────────────╯   │   35/8   │   │   │
│  │                                        └──────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│  Gene Keys • Transits • Journal • KI-Coaching              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Voraussetzungen

| Komponente | Version | Download |
|------------|---------|----------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | [pnpm.io](https://pnpm.io) |
| PostgreSQL | 15+ | [postgresql.org](https://postgresql.org) |
| Redis | 7+ | [redis.io](https://redis.io) |

### Schnellstart mit Docker

```bash
# 1. Repository klonen
git clone https://github.com/deusexlumen/synthesis-engine-hd.git
cd synthesis-engine-hd

# 2. Mit Docker Compose starten
docker-compose up -d

# 3. Datenbank-Migrationen ausführen
cd backend
pnpm install
pnpm exec prisma migrate deploy

# 4. Frontend starten
cd ../app
pnpm install
pnpm dev
```

### Manuelle Installation

```bash
# 1. Repository klonen
git clone https://github.com/deusexlumen/synthesis-engine-hd.git
cd synthesis-engine-hd

# 2. Backend installieren & starten
cd backend
pnpm install

# .env Datei erstellen und anpassen
cp .env.example .env
# DATABASE_URL und JWT_SECRET/JWT_REFRESH_SECRET konfigurieren

pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev

# 3. Frontend installieren & starten (neues Terminal)
cd ../app
pnpm install
pnpm dev
```

Die App ist dann verfügbar unter:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

---

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  BodyGraph   │  │  Numerology  │  │  Gene Keys   │  │   Journal    │ │
│  │  Component   │  │   Component  │  │   Display    │  │    Editor    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Zustand State Management                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Node.js + Express)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Auth (JWT)  │  │  Synthesis   │  │  AI Proxy    │  │   Transit    │ │
│  │   Routes     │  │   Routes     │  │   Routes     │  │   Routes     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────────────────────────────────────────┐ │
│  │  Swiss       │  │              Prisma ORM                          │ │
│  │  Ephemeris   │  │                                                  │ │
│  │  (sweph)     │  └──────────────────────────────────────────────────┘ │
│  └──────────────┘                         │                             │
└───────────────────────────────────────────┼─────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              PostgreSQL                    │           Redis            │
│  ┌─────────────────────────────────────┐   │   ┌─────────────────────┐  │
│  │  Users, Profiles, Charts, Journal   │   │   │  Sessions, Cache    │  │
│  └─────────────────────────────────────┘   │   └─────────────────────┘  │
└────────────────────────────────────────────┴────────────────────────────┘
```

### Technologie-Stack

#### Frontend
| Technologie | Version | Zweck |
|-------------|---------|-------|
| React | 19.2 | UI Framework |
| TypeScript | 5.9 | Typisierung |
| Vite | 7.2 | Build Tool & Dev Server |
| Tailwind CSS | 3.4 | Styling |
| Framer Motion | 12.x | Animationen |
| shadcn/ui | latest | UI Komponenten |
| Zustand | 5.x | State Management |

#### Backend
| Technologie | Version | Zweck |
|-------------|---------|-------|
| Node.js | 20+ | Runtime |
| Express | 4.18 | API Framework |
| Prisma | 5.6 | ORM |
| Swiss Ephemeris | 2.10 | Astronomische Berechnungen |
| OpenAI SDK | 4.20 | KI-Integration |
| Redis | 7.x | Cache & Sessions |
| PostgreSQL | 15+ | Hauptdatenbank |
| JWT | 9.x | Authentifizierung |
| Zod | 3.22 | Validierung |

---

## 📚 Dokumentation

Detaillierte Dokumentation findest du in den folgenden Dateien:

| Dokument | Inhalt |
|----------|--------|
| [`AGENTS.md`](AGENTS.md) | Technische Dokumentation für Entwickler |
| [`IMPLEMENTATION_SUMMARY.md`](IMPLEMENTATION_SUMMARY.md) | Implementierungsstatus & Roadmap |
| [`SYNTHESIS_ENGINE_EXECUTIVE_SUMMARY.md`](SYNTHESIS_ENGINE_EXECUTIVE_SUMMARY.md) | Executive Summary |
| [`DATABASE_SETUP.md`](DATABASE_SETUP.md) | Datenbank-Setup Anleitung |
| [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) | Supabase Konfiguration |

### API-Endpunkte

#### Authentifizierung
```
POST   /api/auth/register           # Registrierung
POST   /api/auth/login              # Login
POST   /api/auth/logout             # Logout
POST   /api/auth/refresh            # Token erneuern
GET    /api/auth/me                 # Profil abrufen
```

#### Human Design
```
POST   /api/human-design/calculate  # Chart berechnen
GET    /api/human-design/profile    # Profil abrufen
```

#### Numerologie
```
POST   /api/numerology/calculate    # Berechnung
GET    /api/numerology/profile      # Profil abrufen
```

#### Transit
```
GET    /api/transit/daily           # Tägliche Transits
GET    /api/transit/today           # Heutige Transits
GET    /api/transit/compare         # Vergleich mit Natal
GET    /api/transit/range           # Zeitraum-Transits
```

#### KI
```
POST   /api/ai/chat                 # Chat-Completion
POST   /api/synthesis               # KI-Synthese
GET    /api/coaching/daily          # Täglicher Coaching-Impuls
```

---

## 🔒 Sicherheit & Datenschutz

- **🛡️ JWT** für API-Authentifizierung (Access & Refresh Tokens)
- **⚡ Rate Limiting** (100 Requests/Min allgemein, engere Limits für Auth und Berechnungs-Endpunkte)
- **🛡️ Helmet** für Security Headers
- **🗝️ bcrypt** für Passwort-Hashing; Reset-/Verify-Tokens werden gehasht gespeichert
- **🔑 API-Keys** der KI-Provider laufen über den Backend-Proxy (`/api/ai/proxy`), nicht direkt aus dem Browser
- **📊 Berechnungen erfolgen serverseitig**: Geburtsdaten werden zur Chart-Berechnung an das eigene Backend übertragen und dort verarbeitet. Gespeichert werden die berechneten Profile/Charts mit dem Konto; Journal-Einträge liegen serverseitig (Gast-Modus: lokal im Browser).

> Hinweis: Die frühere Aussage „Geburtsdaten verlassen das Gerät nie" stammte aus der Desktop-Phase (Tauri/Rust-Core) und gilt seit dem Umstieg auf die Web-Architektur nicht mehr.

---

## 🗺️ Roadmap

### ✅ Abgeschlossen (Phase 1-4)
- [x] Human Design Berechnungen mit Swiss Ephemeris
- [x] Dan Millman Numerologie
- [x] Gene Keys Integration
- [x] KI-Synthese (OpenAI/Anthropic/Google)
- [x] Planetare Transits
- [x] Journal (serverseitig, Gast-Modus lokal)
- [x] PDF-Export
- [x] JWT-Authentifizierung
- [x] Docker-Setup

### 🚧 Vor einem kommerziellen Launch offen

Die vollständige Liste steht in [`PRODUCTION_READY_PLAN.md`](PRODUCTION_READY_PLAN.md) (Abschnitt „Launch-Blocker"). Kurzfassung:

- [ ] **Swiss Ephemeris Lizenz**: `sweph` steht unter AGPL — kommerzielle Astrodienst-Lizenz (~500 €) erwerben oder auf eine MIT-lizenzierte Ephemeriden-Alternative umsteigen
- [ ] **Stripe-Integration**: Schema vorbereitet (`Subscription` mit Stripe-Feldern), Checkout-/Webhook-Code fehlt
- [ ] **Deployment**: Empfehlung Render (Backend) + Supabase (PostgreSQL), siehe `MONETIZATION_PLAN.md`
- [ ] **Erster Deploy**: `prisma migrate deploy` ausführen (Migrationen sind handgeschrieben)
- [ ] **Env-Variablen** setzen: `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`

### 🚧 Geplant (Zukünftige Releases)
- [ ] **Mobile App** (React Native / PWA)
- [ ] **Cloud-Sync** (Optionaler Backup)
- [ ] **Transit-Kalender** mit Benachrichtigungen
- [ ] **Community-Features** (Anonyme Insights)
- [ ] **Erweiterte KI-Prompts** mit besserer Kontext-Kombination
- [ ] **i18n** - Mehrsprachige Unterstützung

---

## 🤝 Mitwirken

Beiträge sind willkommen! Bitte beachte:

1. **Fork** das Repository
2. Erstelle einen **Feature Branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit** deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. **Push** zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen **Pull Request**

Siehe [`AGENTS.md`](AGENTS.md) für detaillierte Code-Richtlinien.

---

## 📝 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe die [LICENSE](LICENSE) Datei für Details.

---

## 🙏 Danksagungen

- **Human Design** - Basierend auf Ra Uru Hu's System
- **Gene Keys** - Richard Rudd's System
- **Numerologie** - Dan Millman's "The Life You Were Born to Live"
- **Swiss Ephemeris** - Professionelle astronomische Berechnungen

---

<div align="center">

**[⬆ Nach oben](#-synthesis-engine)**

Made with 💜 and ☕

</div>
