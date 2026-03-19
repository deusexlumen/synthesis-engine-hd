# Synthesis Engine - AGENTS.md

> Diese Datei enthält technische Dokumentation für AI Coding Agents. Das Projekt verwendet überwiegend Deutsch für UI und Dokumentation.

## Projekt-Übersicht

**Synthesis Engine** ist eine Full-Stack-Desktop-Anwendung zur Synthese von Human Design, Gene Keys und Dan Millman Numerologie mit KI-gestützter Kreuzkorrelationsanalyse.

### Kernfunktionen
- **Human Design Berechnungen**: BodyGraph (9 Zentren), Energie-Typ, Autorität, Profil (1-6 Linien), Tor-Aktivierungen (1-64), Kanal-Analyse, Variablen
- **Dan Millman Numerologie**: Lebensweg (z.B. 35/8), Wurzelzahlen, Meisterzahlen (11, 22), Null-Verstärker, Seelenweg (Vokale), Berufsweg (Konsonanten), Herausforderungen, Höhepunkte, Persönliches Jahr
- **Gene Keys**: 64 Gene Keys mit Schatten, Gabe und Siddhi
- **Planetare Transits**: Tägliche Planetenpositionen und Vergleich mit Natal-Chart
- **KI-Synthese**: OpenAI/Anthropic/Google AI Integration für personalisierte Analyse
- **Verschlüsseltes Journal**: AES-256-GCM verschlüsselte Journal-Einträge (lokal gespeichert)
- **PDF-Export**: Export von Charts und Reports

## Architektur

### Projektstruktur

```
synthesis-engine/
├── app/                          # React + Tauri Frontend
│   ├── src/
│   │   ├── App.tsx              # Hauptkomponente mit View-Routing
│   │   ├── main.tsx             # Entry Point
│   │   ├── types/index.ts       # TypeScript Interfaces (HD, Millman, UserData)
│   │   ├── sections/            # Seiten-Level Komponenten
│   │   │   ├── OnboardingFlow.tsx       # 6-Schritt Onboarding
│   │   │   ├── ProcessingAnimation.tsx  # "Cosmic Calculation"
│   │   │   ├── ResultsDashboard.tsx     # Ergebnis-Anzeige
│   │   │   ├── AISettings.tsx           # KI-Konfiguration
│   │   │   ├── GeneKeysSection.tsx
│   │   │   ├── JournalSection.tsx
│   │   │   ├── TransitSection.tsx
│   │   │   └── SettingsSection.tsx
│   │   ├── stores/
│   │   │   ├── appStore.ts      # Haupt-State (Zustand) mit Persistenz
│   │   │   └── aiConfigStore.ts # KI-Konfiguration
│   │   ├── components/
│   │   │   ├── ui/              # 50+ shadcn/ui Komponenten
│   │   │   ├── BodyGraph.tsx    # HD BodyGraph Visualisierung
│   │   │   ├── NumerologyChart.tsx
│   │   │   ├── GeneKeysDisplay.tsx
│   │   │   ├── TransitDisplay.tsx
│   │   │   ├── AICoaching.tsx
│   │   │   ├── JournalEditor.tsx
│   │   │   ├── JournalList.tsx
│   │   │   └── PDFExportButton.tsx
│   │   ├── hooks/
│   │   │   └── use-mobile.ts    # Mobile Detection
│   │   ├── lib/
│   │   │   ├── utils.ts         # cn() Helper für Tailwind
│   │   │   ├── geneKeys.ts      # Gene Keys Daten
│   │   │   └── calculations.test.ts
│   │   └── services/
│   │       └── pdfExport.ts     # PDF Export Logik
│   ├── src-tauri/               # Rust Backend (Tauri v2)
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/
│   │       ├── main.rs          # Tauri Commands & Cache
│   │       ├── human_design.rs  # HD-Berechnungen (Swiss Ephemeris)
│   │       ├── numerology.rs    # Millman-Algorithmus
│   │       ├── transit.rs       # Transit-Berechnungen
│   │       ├── geocoding.rs     # Open-Meteo Geocoding
│   │       └── storage.rs       # AES-256-GCM Verschlüsselung
│   ├── components.json          # shadcn/ui Konfiguration
│   ├── tailwind.config.js       # Tailwind + Custom Theme
│   ├── vite.config.ts           # Vite + Path Aliases
│   └── package.json
│
├── backend/                      # Node.js + Express API
│   ├── src/
│   │   ├── index.ts             # Express Server Setup
│   │   ├── routes/
│   │   │   ├── auth.ts          # Authentifizierung (JWT)
│   │   │   ├── humanDesign.ts   # HD API Endpunkte
│   │   │   ├── numerology.ts    # Numerologie API
│   │   │   ├── synthesis.ts     # KI-Synthese (OpenAI)
│   │   │   ├── ai.ts            # AI Proxy (OpenAI/Anthropic/Google)
│   │   │   ├── transit.ts       # Transit API
│   │   │   └── coaching.ts      # Coaching-Impulse
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT Validation
│   │   │   └── errorHandler.ts  # Fehlerbehandlung
│   │   └── services/
│   │       └── ephemeris.ts     # Ephemeris Service
│   ├── prisma/
│   │   └── schema.prisma        # Datenbank-Schema
│   └── package.json
│
└── AGENTS.md                     # Diese Datei
```

### Technologie-Stack

#### Frontend (React + Tauri v2)
| Komponente | Version | Zweck |
|------------|---------|-------|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.9.3 | Typisierung |
| Vite | 7.2.4 | Build Tool |
| Tailwind CSS | 3.4.19 | Styling |
| shadcn/ui | latest | UI Komponenten (Radix UI basiert) |
| Framer Motion | 12.34.3 | Animationen |
| Zustand | 5.0.11 | State Management |
| Tauri | 2.10.x | Desktop-Wrapper |
| Tauri API | 2.10.x | Frontend-Rust Bridge |

#### Backend (Node.js)
| Komponente | Version | Zweck |
|------------|---------|-------|
| Express | 4.18.2 | API Server |
| Prisma | 5.6.0 | ORM |
| OpenAI | 4.20.0 | KI-Integration |
| Supabase | 2.38.0 | Auth & Datenbank |
| Zod | 3.22.4 | Validierung |
| Helmet | 7.1.0 | Security Headers |
| express-rate-limit | 7.1.0 | Rate Limiting |

#### Rust (Tauri Core)
| Crate | Version | Zweck |
|-------|---------|-------|
| tauri | 2.0 | Framework |
| libswe-sys | 0.2 | Swiss Ephemeris (astronomische Berechnungen) |
| aes-gcm | 0.10 | AES-256-GCM Verschlüsselung |
| argon2 | 0.5 | Passwort-Hashing |
| chrono | 0.4 | Datums-/Zeit-Berechnungen |
| reqwest | 0.11 | HTTP Client (Geocoding) |
| serde | 1.0 | JSON-Serialisierung |
| thiserror | 1.0 | Error Handling |

## Build und Entwicklung

### Voraussetzungen
- Node.js 20+
- Rust 1.70+ (für Tauri)
- PostgreSQL Datenbank (für Backend, via Supabase)

### Frontend (App)

```bash
cd app
npm install

# Web-Version (Vite Dev Server)
npm run dev

# Desktop-Version (Tauri)
npm run tauri dev

# Produktions-Build
npm run build

# Tauri Build (Desktop-Apps)
npm run tauri build
```

**Wichtige Scripts** (aus `app/package.json`):
- `dev` - Vite Dev Server (Port 5173)
- `build` - TypeScript Kompilierung + Vite Build
- `lint` - ESLint mit TypeScript
- `preview` - Vite Preview
- `tauri dev` - Tauri Development Mode
- `tauri build` - Tauri Production Build

### Backend (API)

```bash
cd backend
npm install

# Environment Setup
cp .env.example .env
# .env mit Datenbank-Credentials anpassen

# Entwicklung mit Hot-Reload
npm run dev

# Datenbank-Migrationen
npx prisma generate
npx prisma db push
npx prisma migrate dev
npx prisma studio

# Produktions-Build
npm run build
npm start
```

**Wichtige Scripts** (aus `backend/package.json`):
- `dev` - ts-node-dev mit Hot-Reload
- `build` - TypeScript Kompilierung
- `start` - Node.js Server
- `db:generate` - Prisma Client generieren
- `db:push` - Schema zu DB pushen
- `db:migrate` - Migration erstellen/ausführen
- `db:studio` - Prisma Studio öffnen

### Rust (Tauri)

```bash
cd app/src-tauri
cargo build
cargo test
```

**Verfügbare Tests**:
- `test_encrypt_decrypt` - AES-256-GCM Verschlüsselung
- `test_different_keys` - Verschlüsselung Key-Isolation

## Code-Organisation

### Frontend Struktur

```
app/src/
├── App.tsx              # Hauptkomponente mit View-State (main/ai-config/settings)
├── main.tsx             # Entry Point
├── types/index.ts       # TypeScript Interfaces (HumanDesignChart, MillmanProfile, UserData)
├── sections/            # Seiten-Level Komponenten
│   ├── OnboardingFlow.tsx       # 6-Schritt Onboarding (Welcome → Name → Birthdate → Birthtime → Birthplace → Confirm)
│   ├── ProcessingAnimation.tsx  # Lade-Animation mit Framer Motion
│   ├── ResultsDashboard.tsx     # Haupt-Ergebnis-Anzeige
│   ├── AISettings.tsx           # KI-Anbieter Konfiguration
│   ├── GeneKeysSection.tsx      # Gene Keys Anzeige
│   ├── JournalSection.tsx       # Journal Verwaltung
│   ├── TransitSection.tsx       # Transit-Anzeige
│   └── SettingsSection.tsx      # App-Einstellungen
├── stores/
│   ├── appStore.ts      # Zustand Store mit Persistenz (localStorage)
│   └── aiConfigStore.ts # KI-Konfiguration Store
├── components/
│   ├── ui/              # 50+ shadcn/ui Komponenten
│   ├── BodyGraph.tsx    # SVG BodyGraph Visualisierung
│   ├── NumerologyChart.tsx
│   ├── GeneKeysDisplay.tsx
│   ├── TransitDisplay.tsx
│   ├── AICoaching.tsx
│   ├── JournalEditor.tsx
│   ├── JournalList.tsx
│   └── PDFExportButton.tsx
├── lib/
│   ├── utils.ts         # cn() Helper für Tailwind
│   ├── geneKeys.ts      # Gene Keys Daten (64 Keys)
│   └── calculations.test.ts
└── services/
    └── pdfExport.ts     # PDF Export mit jsPDF + html2canvas
```

### Backend Struktur

```
backend/src/
├── index.ts             # Express Server Setup mit Middleware
├── routes/
│   ├── auth.ts          # JWT Auth (Register/Login/Me)
│   ├── humanDesign.ts   # HD Berechnungs-Endpunkte
│   ├── numerology.ts    # Numerologie Endpunkte
│   ├── synthesis.ts     # KI-Synthese mit OpenAI GPT-4o-mini
│   ├── ai.ts            # AI Proxy für OpenAI/Anthropic/Google
│   ├── transit.ts       # Transit-Endpunkte
│   └── coaching.ts      # Coaching-Impulse
├── middleware/
│   ├── auth.ts          # JWT Validation, requirePremium
│   └── errorHandler.ts  # asyncHandler, Zod Fehler
└── services/
    └── ephemeris.ts     # Astronomische Berechnungen
```

### Rust Struktur

```
app/src-tauri/src/
├── main.rs              # Tauri Commands, Cache-Management
├── human_design.rs      # HD Berechnungen (Swiss Ephemeris)
├── numerology.rs        # Millman Numerologie Algorithmus
├── transit.rs           # Transit-Berechnungen
├── geocoding.rs         # Open-Meteo Geocoding API
└── storage.rs           # AES-256-GCM Verschlüsselung
```

#### Verfügbare Tauri Commands
- `calculate_human_design` - HD Chart berechnen (mit Cache)
- `calculate_numerology` - Millman Profil berechnen (mit Cache)
- `save_journal_entry` - Verschlüsselten Journal-Eintrag speichern
- `load_journal_entry` - Journal-Eintrag entschlüsseln
- `list_journal_entries` - Alle Journal-Einträge auflisten
- `delete_journal_entry` - Journal-Eintrag löschen
- `search_location_command` - Ortsuche via Open-Meteo
- `get_timezone_command` - Zeitzone ermitteln
- `get_daily_transit` - Tägliche Transits berechnen
- `get_today_transit_command` - Heutige Transits
- `compare_transit_to_natal_command` - Transit vs Natal Vergleich
- `trigger_haptic` - Haptic Feedback (Stub)

## Code Style Guidelines

### TypeScript/React

1. **Komponenten**: Funktionskomponenten mit expliziten Return Types
   ```typescript
   export function ComponentName(): JSX.Element { }
   ```

2. **Imports**: Alias `@/` für `src/` verwenden
   ```typescript
   import { useAppStore } from '@/stores/appStore';
   import { Button } from '@/components/ui/button';
   ```

3. **State Management**: Zustand mit Persistenz für lokale Daten
   ```typescript
   export const useAppStore = create<AppStore>()(
     persist((set) => ({ ... }), { name: 'synthesis-engine-storage' })
   );
   ```

4. **Tailwind Klassen**: `cn()` Utility für bedingte Klassen
   ```typescript
   className={cn("base-classes", condition && "conditional")}
   ```

5. **UI Styling**: Neo-Mystic Minimalism Design-System
   - Dunkles Theme: `bg-[#020202]`
   - Akzentfarben: Purple-500 (`hsl(270 60% 40%)`), Blue-500
   - Glassmorphism: `bg-white/5 backdrop-blur-xl`
   - Border Radius: `var(--radius)` basiert
   - CSS Variables für Theme-Farben (siehe `app/src/index.css`)

### Rust

1. **Error Handling**: Eigene Error-Typen mit `thiserror`
   ```rust
   #[derive(Debug)]
   pub struct HDError { pub message: String }
   impl std::fmt::Display for HDError { ... }
   impl std::error::Error for HDError {}
   ```

2. **Serialisierung**: `serde` für JSON-Serialisierung
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct HumanDesignChart { ... }
   ```

3. **Command Pattern**: Tauri Commands für Frontend-Integration
   ```rust
   #[tauri::command]
   fn calculate_human_design(...) -> Result<HumanDesignChart, String>
   ```

4. **Cache-Management**: In-Memory Cache mit `Mutex<HashMap>`

### Backend

1. **Route Handler**: Mit `asyncHandler` Wrapper für Fehler
   ```typescript
   router.get('/', asyncHandler(async (req, res) => { }));
   ```

2. **Validierung**: Zod Schemas für Request-Body
   ```typescript
   const schema = z.object({ field: z.string().min(1) });
   const data = schema.parse(req.body);
   ```

3. **Auth**: JWT Middleware mit `authenticate`, `requirePremium`

## Testing

### Frontend
```bash
cd app
# Keine Test-Framework konfiguriert (kann mit Vitest ergänzt werden)
```

### Backend
```bash
cd backend
# Keine Test-Framework konfiguriert (kann mit Jest ergänzt werden)
```

### Rust
```bash
cd app/src-tauri
cargo test
```

**Vorhandene Rust Tests**:
- `test_encrypt_decrypt` - AES-256-GCM Verschlüsselung
- `test_different_keys` - Verschlüsselung Key-Isolation

## Sicherheit

### Datenverschlüsselung
- **Lokale Daten**: AES-256-GCM für Journal-Einträge
- **Key Management**: Lokale Key-Datei in App-Daten (dev) / OS Keychain (prod geplant)
- **Geburtsdaten**: Bleiben lokal, werden nie an Cloud gesendet (außer deterministische Ergebnisse)

### API Sicherheit
- **Rate Limiting**: 100 Requests/Min (allgemein), 5/15min (Auth)
- **Helmet**: Security Headers
- **CORS**: Whitelist-basiert (`https://synthesis-engine.com`, `tauri://localhost`)
- **JWT**: Token-basierte Authentifizierung
- **CSP**: Content Security Policy in Tauri konfiguriert

### Environment Variablen (Backend)
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=...
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Wichtige Konfigurationen

### Vite Config (`app/vite.config.ts`)
- Base: `./` (für Desktop-Build)
- Alias: `@/` → `./src`
- Plugin: `kimi-plugin-inspect-react` für Debugging

### Tailwind Config (`app/tailwind.config.js`)
- Dark Mode: `class`
- CSS Variables für Theme (HSL-basiert)
- Custom Animations (accordion, caret-blink)
- shadcn/ui Integration

### Tauri Config (`app/src-tauri/tauri.conf.json`)
- Version: 2.0 Schema
- Window: 1200x800, Dark Theme, center, decorations
- CSP: Eingeschränkte Connect-Src (Supabase, OpenAI, Anthropic, Google, Open-Meteo)
- Capabilities: fs:default, shell:default
- Plugins: fs (scope: `$APP/*`, `$APP/journal/*`)

### TypeScript Config
- **Frontend**: ES2022 Target, Strict Mode, Bundler Module Resolution
- **Backend**: ES2020 Target, CommonJS, Strict Mode

### shadcn/ui Config (`app/components.json`)
- Style: "new-york"
- Base Color: "slate"
- CSS Variables: true
- Icons: lucide

## Datenbank-Schema (Prisma)

### Haupt-Entitäten
- **User**: ID, Email, SubscriptionTier (FREE/SOUL_SYNC_PREMIUM)
- **MillmanProfile**: Lebensweg, Wurzelzahlen, Meisterzahlen, etc.
- **HumanDesignProfile**: Energie-Typ, Autorität, Profil, Zentren, Tore, Kanäle
- **GeneKeysProfile**: 11 Gene Keys des Hologenetischen Profils
- **SynthesisCache**: KI-generierte Texte (30 Tage Cache)
- **DailyCoaching**: Tägliche Coaching-Impulse
- **TransitData**: Tägliche Planeten-Positionen
- **CommunityStats**: Pre-berechnete Statistiken

## Deployment

### Desktop (Tauri)
```bash
cd app
npm run tauri build    # Erstellt .exe, .dmg, .appimage
```

### Backend
```bash
cd backend
npm run build
# Deploy dist/ zu VPS/Cloud
```

### Datenbank
- Prisma Migrations für Schema-Updates
- PostgreSQL via Supabase

## Häufige Patterns

### State Update Pattern
```typescript
const { setUserData, setStep } = useAppStore();
setUserData(data);
setStep('processing');
```

### Tauri Command Invocation
```typescript
import { invoke } from '@tauri-apps/api/core';
const chart = await invoke('calculate_human_design', { year, month, ... });
```

### API Call Pattern
```typescript
const response = await fetch('/api/synthesis/generate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(data)
});
```

### Zod Validation
```typescript
const schema = z.object({
  field: z.string().min(1),
  number: z.number().optional()
});
const data = schema.parse(req.body);
```

## Troubleshooting

### Tauri Dev Startet Nicht
- Prüfe: Rust installiert (`rustc --version`)
- Prüfe: Windows WebView2 Runtime vorhanden
- Prüfe: Node.js 20+ installiert

### Prisma Fehler
```bash
npx prisma generate    # Client neu generieren
npx prisma db push     # Schema synchronisieren
npx prisma migrate dev # Migration erstellen
```

### Build Fehler
- `node_modules` löschen und `npm install`
- TypeScript Version prüfen (5.9.3 im Frontend)
- Rust Toolchain aktualisieren: `rustup update`

## Ressourcen

- **Human Design**: Based on Ra Uru Hu's system
- **Gene Keys**: Richard Rudd's system
- **Numerologie**: Dan Millman's "The Life You Were Born to Live"
- **Swiss Ephemeris**: Astronomische Berechnungen (libswe-sys)

## Professionelle Berechnungen & Swiss Ephemeris

### Aktueller Status der Berechnungen

Die Berechnungsmodule sind **funktional**, aber **nicht professionell präzise**:

| Modul | Status | Genauigkeit |
|-------|--------|-------------|
| Human Design | ⚠️ Funktional | Analytische Formeln (±2° für Planeten) |
| Numerologie | ✅ Produktionsreif | Korrekt nach Dan Millman |
| Transit | ⚠️ Funktional | Gleiche Einschränkungen wie HD |

### Was ist notwendig für professionelle Genauigkeit?

**Swiss Ephemeris Integration** ist kritisch:

1. **Ephemeris-Dateien** (.se1) in `app/src-tauri/ephemeris/` ablegen
2. **`ephemeris.rs`** Modul erstellen (Safe Wrapper für libswe-sys)
3. **`human_design.rs`** auf Ephemeris-Berechnungen umstellen
4. **Tests** mit JPL Horizons und mybodygraph.com validieren

Detaillierte Spezifikationen:
- `docs/PROFESSIONAL_CALCULATIONS_SPEC.md` - Gesamtkonzept
- `docs/EPHEMERIS_IMPLEMENTATION_GUIDE.md` - Schritt-für-Schritt Umsetzung
- `docs/TEST_REFERENCE_DATA.md` - Testdaten und Referenzwerte

### Abweichungen aktueller Implementierung

```
Planet      | Aktuell (Analytisch) | Professionell (Swiss Ephem.)
------------|---------------------|----------------------------
Sonne       | ±0.01°              | ±0.0001°
Mond        | ±0.5°               | ±0.0001°
Merkur      | ±2°                 | ±0.0001°
Venus       | ±1°                 | ±0.0001°
Mars        | ±1.5°               | ±0.0001°
```

**Konsequenz**: Bei ±2° Abweichung kann ein Planet im falschen Human Design Gate liegen (jedes Tor = 5.625°).

### Swiss Ephemeris Setup

```powershell
# 1. Ephemeris-Dateien downloaden
wget https://www.astro.com/swisseph/ephe/archive/seplm18.se1
wget https://www.astro.com/swisseph/ephe/archive/semom18.se1

# 2. In Projekt-Verzeichnis verschieben
mv *.se1 app/src-tauri/ephemeris/

# 3. libswe-sys ist bereits in Cargo.toml
# 4. Implementation folgt Guide in docs/
```

### Validierung

Nach Implementierung muss getestet werden:

1. **Ra Uru Hu Chart**: 28.04.1948, 08:14 EST, Montreal → Manifestor 5/1
2. **JPL Horizons**: Vergleich mit NASA Planetenpositionen
3. **MyBodyGraph**: 10+ zufällige Charts vergleichen

## Hinweise für Agents

1. **Sprache**: UI und Dokumentation sind auf Deutsch. Code-Kommentare können Englisch oder Deutsch sein.
2. **Datenschutz**: Geburtsdaten dürfen NIE an externe APIs gesendet werden (außer deterministische Ergebnisse).
3. **Performance**: Berechnungen im Rust-Core cachen (bereits implementiert via `CalculationCache`).
4. **KI-Prompts**: Sokratischer, reflektierender Stil (nicht belehrend). Siehe `backend/src/routes/synthesis.ts`.
5. **UI**: Dark Mode only, Neo-Mystic Minimalism Design mit Glassmorphism-Effekten.
6. **Imports**: Immer `@/` Alias verwenden, nie relative Pfade wie `../../`.
7. **Tailwind**: `cn()` Utility nutzen für bedingte Klassen.
8. **State**: Zustand mit Persistenz für Daten, die über Sessions erhalten bleiben sollen.
9. **Berechnungen**: Aktuelle Implementierung ist analytisch, nicht mit Swiss Ephemeris. Siehe `docs/PROFESSIONAL_CALCULATIONS_SPEC.md` für Upgrade.
