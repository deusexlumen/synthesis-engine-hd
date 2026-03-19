<div align="center">

# 🔮 Synthesis Engine

### *Wo Wissenschaft auf Spiritualität trifft*

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.70+-000000?logo=rust)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Eine transformative Desktop-App zur Synthese von Human Design, Gene Keys und Dan Millman Numerologie mit KI-gestützter Kreuzkorrelationsanalyse**

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
- **Gene Keys Sektion** mit durchdachtem Design

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
- **📓 Verschlüsseltes Journal**: AES-256-GCM verschlüsselte Einträge mit Stimmungs-Tracking
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
| Rust | 1.70+ | [rustup.rs](https://rustup.rs) |
| PostgreSQL | 15+ | [postgresql.org](https://postgresql.org) |

### Schnellstart

```bash
# 1. Repository klonen
git clone https://github.com/username/synthesis-engine.git
cd synthesis-engine

# 2. Frontend & Backend installieren
npm install
cd backend && npm install && cd ..

# 3. Datenbank konfigurieren
cd backend
cp .env.example .env
# .env mit deinen PostgreSQL-Credentials anpassen
npx prisma generate
npx prisma migrate dev

cd ..

# 4. Desktop-App starten
npm run tauri dev
```

### Alternative: Nur Web-Version

```bash
cd app
npm install
npm run dev
```

### Build für Produktion

```bash
# Desktop-Apps bauen (.exe, .dmg, .appimage)
npm run tauri build

# Web-Version bauen
cd app
npm run build
```

---

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Tauri)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  BodyGraph   │  │  Numerology  │  │  Gene Keys   │  │   Journal    │ │
│  │  Component   │  │   Component  │  │   Display    │  │    Editor    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Zustand State Management                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      TAURI BRIDGE (Rust)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Human      │  │  Numerology  │  │   Transit    │  │   Storage    │ │
│  │   Design     │  │    Calc      │  │     Calc     │  │ (AES-256)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              Swiss Ephemeris (libswe-sys)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Node.js + Express)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Auth (JWT)  │  │  Synthesis   │  │  AI Proxy    │  │   Transit    │ │
│  │   Routes     │  │   Routes     │  │   Routes     │  │   Routes     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              Prisma ORM + PostgreSQL                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technologie-Stack

#### Frontend
| Technologie | Zweck |
|-------------|-------|
| React 19.2 | UI Framework |
| TypeScript 5.9 | Typisierung |
| Vite 7.2 | Build Tool |
| Tailwind CSS 3.4 | Styling |
| Framer Motion | Animationen |
| shadcn/ui | UI Komponenten |
| Zustand | State Management |
| Tauri v2 | Desktop-Wrapper |

#### Backend
| Technologie | Zweck |
|-------------|-------|
| Express 4.18 | API Server |
| Prisma 5.6 | ORM |
| OpenAI SDK | KI-Integration |
| Supabase | Auth & Datenbank |
| Zod | Validierung |

#### Rust (Tauri Core)
| Crate | Zweck |
|-------|-------|
| tauri 2.0 | Framework |
| libswe-sys | Swiss Ephemeris |
| aes-gcm | Verschlüsselung |
| argon2 | Passwort-Hashing |
| chrono | Datumsberechnungen |

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
POST   /api/auth/register     # Registrierung
POST   /api/auth/login        # Login
GET    /api/auth/me           # Profil abrufen
```

#### Human Design
```
POST   /api/hd/calculate      # Chart berechnen
GET    /api/hd/profile/:id    # Profil abrufen
```

#### Numerologie
```
POST   /api/numerology/calculate    # Berechnung
GET    /api/numerology/profile/:id  # Profil abrufen
```

#### Transit
```
GET    /api/transit/daily     # Tägliche Transits
GET    /api/transit/today     # Heutige Transits
GET    /api/transit/compare   # Vergleich mit Natal
GET    /api/transit/range     # Zeitraum-Transits
```

#### KI
```
POST   /api/ai/chat           # Chat-Completion
POST   /api/synthesis         # KI-Synthese
```

---

## 🔒 Sicherheit

- **🔐 AES-256-GCM** Verschlüsselung für lokale Journal-Einträge
- **🗝️ Argon2** für sichere Key-Derivation
- **🛡️ JWT** für API-Authentifizierung
- **⚡ Rate Limiting** (100 Requests/Min)
- **🚫 Geburtsdaten** bleiben lokal, werden nie an Cloud gesendet

---

## 🗺️ Roadmap

### ✅ Abgeschlossen (Phase 1-4)
- [x] Human Design Berechnungen
- [x] Dan Millman Numerologie
- [x] Gene Keys Integration
- [x] KI-Synthese
- [x] Planetare Transits
- [x] Verschlüsseltes Journal
- [x] PDF-Export
- [x] Tauri v2 Migration

### 🚧 Geplant (Zukünftige Releases)
- [ ] **Swiss Ephemeris Integration** (Professionelle astronomische Genauigkeit)
- [ ] **Mobile App** (React Native / Capacitor)
- [ ] **Cloud-Sync** (Optionaler Backup)
- [ ] **Transit-Kalender** mit Benachrichtigungen
- [ ] **Community-Features** (Anonyme Insights)
- [ ] **Erweiterte KI-Prompts** mit besserer Kontext-Kombination

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
- **Swiss Ephemeris** - Astronomische Berechnungen

---

<div align="center">

**[⬆ Nach oben](#-synthesis-engine)**

Made with 💜 and ☕

</div>
