<!-- From: C:/Users/Buxe/Projects/synthesis-engine-hd/AGENTS.md -->
# Synthesis Engine - AGENTS.md

> Diese Datei enthält technische Dokumentation für AI Coding Agents. Das Projekt verwendet überwiegend Deutsch für UI und Dokumentation, Code-Kommentare sind gemischt Deutsch/Englisch.

## Projekt-Übersicht

**Synthesis Engine** ist eine Web-Anwendung zur Synthese von Human Design, Gene Keys und Dan Millman Numerologie mit KI-gestützter Kreuzkorrelationsanalyse.

> **Architektur: Web-only.** React + Vite Frontend (`app/`) spricht per HTTP/REST mit einem Node.js/Express + Prisma Backend (`backend/`). Sämtliche Berechnungen (Human Design, Numerologie, Transits) laufen serverseitig im Backend. Die frühere Desktop-Variante (Tauri v2 / Rust-Core) wurde vollständig entfernt — es gibt kein `app/src-tauri` mehr.

### Kernfunktionen
- **Human Design Berechnungen**: BodyGraph (9 Zentren), Energie-Typ, Autorität, Profil (1-6 Linien), Tor-Aktivierungen (1-64), Kanal-Analyse, Variablen — serverseitig via Swiss Ephemeris (`sweph`)
- **Dan Millman Numerologie**: Lebensweg (z.B. 35/8), Wurzelzahlen, Meisterzahlen (11, 22), Null-Verstärker, Seelenweg (Vokale), Berufsweg (Konsonanten), Herausforderungen, Höhepunkte, Persönliches Jahr
- **Gene Keys**: 64 Gene Keys mit Schatten, Gabe und Siddhi
- **Planetare Transits**: Tägliche Planetenpositionen und Vergleich mit Natal-Chart
- **KI-Synthese**: OpenAI/Anthropic/Google über den Backend-Proxy (`/api/ai/proxy`) — API-Keys verlassen das Backend nicht Richtung Browser-Provider-Calls
- **Journal**: Serverseitig mit dem Konto verknüpft (`/api/journal`); ohne Konto (Gast-Modus) lokal im Browser. Bestehende lokale Einträge werden einmalig auf den Server migriert.
- **PDF-Export**: Export von Charts und Reports

## Architektur

### Projektstruktur

```
synthesis-engine/
├── app/                          # React + Vite Frontend
│   ├── src/
│   │   ├── App.tsx              # Hauptkomponente mit React Router
│   │   ├── main.tsx             # Entry Point (StrictMode, ErrorBoundary, AuthProvider)
│   │   ├── types/
│   │   │   ├── index.ts         # Legacy Re-exports
│   │   │   └── humanDesign.ts   # Haupt-TypeScript Interfaces
│   │   ├── sections/            # Seiten-Level Komponenten
│   │   │   ├── OnboardingFlow.tsx       # Onboarding
│   │   │   ├── ProcessingAnimation.tsx  # "Cosmic Calculation"
│   │   │   ├── ResultsDashboard.tsx     # Ergebnis-Anzeige (Tabs)
│   │   │   ├── AISettings.tsx           # KI-Konfiguration
│   │   │   ├── GeneKeysSection.tsx
│   │   │   ├── JournalSection.tsx
│   │   │   ├── TransitSection.tsx
│   │   │   └── SettingsSection.tsx
│   │   ├── pages/               # Route-Level Seiten
│   │   │   ├── DashboardPage.tsx
│   │   │   └── auth/
│   │   │       ├── LoginPage.tsx
│   │   │       └── RegisterPage.tsx
│   │   ├── stores/
│   │   │   ├── appStore.ts      # Haupt-State mit Persistenz
│   │   │   ├── aiConfigStore.ts # KI-Konfiguration (API-Key wird NICHT persistiert)
│   │   │   ├── authStore.ts     # Auth-State (Tokens werden NICHT persistiert)
│   │   │   └── toastStore.ts
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui Komponenten
│   │   │   ├── auth/            # Auth-Komponenten (LoginForm, RegisterForm, etc.)
│   │   │   ├── BodyGraph.tsx
│   │   │   ├── NumerologyChart.tsx
│   │   │   ├── GeneKeysDisplay.tsx
│   │   │   ├── TransitDisplay.tsx
│   │   │   ├── AICoaching.tsx
│   │   │   ├── JournalEditor.tsx
│   │   │   ├── JournalList.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── PDFExportButton.tsx
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── utils.ts         # cn() Helper für Tailwind
│   │   │   ├── api.ts           # API Client mit Retry-Logik und Request-Cache
│   │   │   ├── journalApi.ts    # Journal API Client (+ einmalige Migration lokaler Einträge)
│   │   │   ├── geneKeys.ts      # Gene Keys Daten
│   │   │   └── millmanCalculations.ts
│   │   └── services/
│   │       └── pdfExport.ts     # PDF Export Logik (jsPDF + html2canvas)
│   ├── e2e/
│   │   └── smoke.spec.ts        # Playwright Smoke-Test (Kern-Nutzerpfad)
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── components.json          # shadcn/ui Konfiguration
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json            # Projekt-Referenzen (app + node)
│   └── package.json             # pnpm
│
├── backend/                      # Node.js + Express API
│   ├── src/
│   │   ├── index.ts             # Express Server Setup (Graceful Shutdown, /health)
│   │   ├── lib/
│   │   │   ├── prisma.ts        # Prisma Client Singleton
│   │   │   ├── logger.ts        # Pino Logging
│   │   │   ├── ssrfGuard.ts     # SSRF-Schutz für Custom-AI-Provider
│   │   │   └── cleanup.ts       # Periodische Aufräum-Jobs
│   │   ├── routes/
│   │   │   ├── auth.ts          # Authentifizierung (JWT)
│   │   │   ├── humanDesign.ts   # HD API Endpunkte
│   │   │   ├── numerology.ts    # Numerologie API
│   │   │   ├── synthesis.ts     # KI-Synthese
│   │   │   ├── ai.ts            # AI Proxy (OpenAI/Anthropic/Google, SSRF-geschützt)
│   │   │   ├── transit.ts       # Transit API
│   │   │   ├── coaching.ts      # Coaching-Impulse
│   │   │   └── journal.ts       # Journal API (serverseitig)
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT Validation, RBAC, Tier-Checks
│   │   │   ├── errorHandler.ts  # asyncHandler, Zod Fehler
│   │   │   ├── rateLimit.ts     # Rate Limiter
│   │   │   └── traceId.ts       # Request Trace IDs
│   │   ├── services/
│   │   │   ├── auth.ts          # Auth-Service (Register/Login/Refresh/RBAC)
│   │   │   ├── ephemeris.ts     # Swiss Ephemeris Service (sweph)
│   │   │   ├── humanDesignCalculator.ts  # HD Chart-Berechnung
│   │   │   ├── hdConstants.ts   # HD Konstanten (Tore, Zentren, Kanäle)
│   │   │   ├── millmanCalculator.ts      # Numerologie
│   │   │   ├── aiProvider.ts    # KI-Provider Abstraktion
│   │   │   ├── coaching.ts      # Coaching-Logik
│   │   │   └── email.ts         # E-Mail-Versand (Resend)
│   │   └── tests/               # Jest + Supertest (siehe Testing)
│   ├── prisma/
│   │   ├── schema.prisma        # Datenbank-Schema
│   │   ├── seed.ts
│   │   └── migrations/          # Handgeschriebene SQL-Migrationen
│   ├── ephemeris/               # .se1 Ephemeris-Dateien
│   ├── Dockerfile
│   └── package.json             # pnpm
│
├── docs/                         # Projekt-Dokumentation
│   ├── EPHEMERIS_IMPLEMENTATION_GUIDE.md      # historisch (Tauri-Ära)
│   ├── PROFESSIONAL_CALCULATIONS_SPEC.md      # historisch (Tauri-Ära)
│   ├── SWISS_EPHEMERIS_PROFESSIONAL_SETUP.md  # historisch (Tauri-Ära)
│   ├── SWISS_EPHEMERIS_SETUP_README.md
│   └── TEST_REFERENCE_DATA.md
│
├── scripts/                      # Setup-Skripte
│   ├── download-ephemeris.ps1
│   ├── download-ephemeris.sh
│   └── ephemeris-checksums.sha256
│
├── docker-compose.yml            # Docker Compose (Postgres, Redis, Backend)
├── docker-compose.dev.yml        # Dev-Setup mit Hot-Reload
├── setup.sh / setup.ps1          # Projekt-Setup-Skripte
└── AGENTS.md                     # Diese Datei
```

### Technologie-Stack

#### Frontend (`app/`)
| Komponente | Version | Zweck |
|------------|---------|-------|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.9.3 | Typisierung |
| Vite | 7.2.4 | Build Tool |
| Tailwind CSS | 3.4.19 | Styling |
| shadcn/ui | latest | UI Komponenten (Radix UI basiert) |
| Framer Motion | 12.34.3 | Animationen |
| Zustand | 5.0.11 | State Management (mit immer, persist) |
| React Router | 8.3.0 | Client-Side Routing |
| Vitest | 3.0.0 | Test Framework |
| Playwright | 1.62.0 | E2E Tests |

#### Backend (`backend/`)
| Komponente | Version | Zweck |
|------------|---------|-------|
| Express | 4.18.2 | API Server |
| Prisma | 5.22.0 | ORM |
| OpenAI | 4.20.0 | KI-Integration |
| Supabase | 2.38.0 | Datenbank (PostgreSQL) |
| Zod | 3.22.4 | Validierung |
| Helmet | 7.1.0 | Security Headers |
| express-rate-limit | 7.1.0 | Rate Limiting |
| bcryptjs | 2.4.3 | Passwort-Hashing |
| jsonwebtoken | 9.0.2 | JWT Tokens |
| sweph | 2.10.3-b-1 | Swiss Ephemeris (Node.js, **AGPL** — siehe Launch-Blocker) |
| pino | 10.3.1 | Logging |
| Jest | 30.4.2 | Test Framework |
| Supertest | 7.2.2 | API Contract Tests |
| ts-jest | 29.4.12 | TypeScript für Jest |

## Build und Entwicklung

**Paketmanager ist pnpm** (beide Pakete haben `pnpm-lock.yaml`; npm/yarn nicht verwenden).

### Voraussetzungen
- Node.js 20+
- pnpm 9+
- PostgreSQL Datenbank (via Supabase oder Docker)

### Frontend (`app/`)

```bash
cd app
pnpm install

# Dev Server (Port 5173)
pnpm dev

# Linting
pnpm lint

# Unit-Tests (Vitest)
pnpm test

# TypeScript-Projekt-Referenzen prüfen
tsc -b

# Produktions-Build (tsc -b && vite build)
pnpm build

# E2E (Playwright, 1 Smoke-Test)
pnpm exec playwright test
```

### Backend (`backend/`)

```bash
cd backend
pnpm install

# Environment Setup
cp .env.example .env
# .env mit Datenbank-Credentials und Secrets anpassen

# Entwicklung mit Hot-Reload
pnpm dev

# Typecheck ohne Emit
tsc --noEmit

# Tests
pnpm test                 # Jest (einmalig)
pnpm run test:watch       # Jest (Watch-Modus)
pnpm run test:coverage    # Jest mit Coverage

# Produktions-Build
pnpm build
pnpm start
```

### Datenbank / Prisma

Die Migrationen in `backend/prisma/migrations/` sind **handgeschriebene SQL-Migrationen** — sie wurden ohne Live-Datenbank erstellt. Konsequenzen:

- Lokal/CI: `pnpm exec prisma generate` reicht für Typen; Tests brauchen **keine** Datenbank (Prisma wird gemockt).
- Beim ersten Deploy: `pnpm exec prisma migrate deploy` gegen die Ziel-DB ausführen.
- `prisma migrate dev` nur verwenden, wenn tatsächlich eine Dev-DB läuft und eine neue Migration erzeugt werden soll.

### Docker (Gesamtes Projekt)

```bash
# PostgreSQL + Redis + Backend starten
docker-compose up

# Dev-Setup mit Hot-Reload
docker-compose -f docker-compose.dev.yml up

# Backend-Image separat bauen
cd backend
docker build -t synthesis-backend .
```

**Hinweis Windows / sweph:** `sweph` ist ein natives Modul und braucht unter Windows Build-Tools (Visual Studio Build Tools / node-gyp). Die Backend-Tests nutzen deshalb einen Mock (`backend/src/__mocks__/sweph.ts`) und laufen auch ohne native Compilation. Im Docker-Image sind die nativen Build-Abhängigkeiten enthalten.

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

3. **State Management**: Zustand mit `immer` Middleware für Immutable Updates
   ```typescript
   export const useAppStore = create<AppStore>()(
     immer(persist((set) => ({ ... }), { name: 'synthesis-engine-v1' }))
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
   - CSS Variables für Theme-Farben (siehe `app/src/index.css`)
   - Serif-Font für Headlines: Cormorant Garamond
   - Sans-Font für Body: Inter

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

3. **Auth**: JWT Middleware mit `authenticate`, `requireTier`, `requireRole`, `requirePermission`

4. **Service-Pattern**: Geschäftslogik in `services/` auslagern, Routes bleiben dünn

## Testing

Aktueller Stand: **app: 28 Tests (Vitest), backend: 134 Tests (Jest), 1 Playwright-Smoke-Test** — alle grün.

### Frontend (Vitest, `app/`)

- `app/src/lib/calculations.test.ts` - HD Gate, Numerologie, Gene Keys, Transit Tests
- `app/src/lib/journalApi.test.ts` - Journal API Client
- `app/src/stores/aiConfigStore.test.ts` - Sicherheit: API-Key wird nicht persistiert
- `app/src/stores/authStore.test.ts` - Sicherheit: Tokens werden nicht persistiert

```bash
cd app
pnpm test                    # vitest run
pnpm exec playwright test    # E2E Smoke (app/e2e/smoke.spec.ts)
```

### Backend (Jest + Supertest, `backend/src/tests/`)

- `auth.test.ts` - Register/Login/Refresh/Logout, Tier-Gates, Token-Fälle
- `humanDesign.test.ts`, `humanDesignCalculator.test.ts`, `humanDesignChart.e2e.test.ts` - HD-Berechnung inkl. Referenz-Chart
- `humanDesignRateLimit.test.ts` - dedizierter Limiter für `/api/hd/calculate`
- `ai.test.ts`, `ssrfGuard.test.ts` - AI Proxy, SSRF-Guard inkl. DNS-Resolution-Pfad (gemockter Resolver)
- `coaching.test.ts`, `coachingRoutes.test.ts` - Coaching auf echten Transit-Daten
- `journal.test.ts` - Journal-Endpunkte
- `synthesis.test.ts`, `email.test.ts`, `ephemeris.test.ts` - Synthese, E-Mail-Service, Ephemeris-Genauigkeit

```bash
cd backend
pnpm test                    # jest
pnpm run test:coverage       # jest --coverage
```

**Ohne Datenbank lauffähig:** Prisma und `sweph` werden in Tests gemockt (`backend/src/__mocks__/`).

## Sicherheit & Datenschutz

### Authentifizierung & Autorisierung
- **JWT**: Access Tokens (15 Minuten) + Refresh Tokens (7 Tage, httpOnly Cookie)
- **RBAC**: Rollen-basierte Zugriffskontrolle (USER, ADMIN, SUPER_ADMIN)
- **Audit Logging**: Sicherheitsrelevante Aktionen werden protokolliert
- **bcryptjs**: Passwort-Hashing mit 12 Salt Rounds
- **Reset-/Verify-Tokens**: werden gehasht (SHA-256) in der DB gespeichert, Klartext nur per E-Mail
- **Zod**: Input-Validierung an allen API-Endpunkten

### Datenverarbeitung (Wirklichkeit seit dem Web-Pivot)
- **Geburtsdaten** werden zur Berechnung an das **eigene Backend** übertragen und dort serverseitig verarbeitet. Gespeichert werden die berechneten Profile/Charts (mit dem Konto verknüpft). Die frühere Aussage „Geburtsdaten verlassen das Gerät nie" stammte aus der Tauri-Ära und ist **nicht mehr gültig**.
- **Journal**: Serverseitig gespeichert und mit dem Konto verknüpft. Im Gast-Modus (ohne Login) lokal im Browser (localStorage, unverschlüsselt). Beim ersten Login werden lokale Einträge einmalig migriert.
- **KI-API-Keys**: Laufen über den Backend-Proxy (`/api/ai/proxy`). Das Frontend ruft keine Provider direkt auf; SSRF-Guard schützt Custom-Provider-Endpunkte.
- **Frontend-Persistenz**: API-Keys und Auth-Tokens werden NIEMALS in localStorage persistiert (`partialize` in `aiConfigStore`/`authStore`).

### API Sicherheit
- **Rate Limiting**: 100 Requests/Min (allgemein), 5/15min (Auth), 10/min dediziert für `/api/hd/calculate` (CPU-intensiv), Per-User-Limits für Synthesis/Coaching/Transit-Ranges
- **Helmet**: Security Headers
- **CORS**: Whitelist-basiert über `CORS_ORIGINS` (Default: `FRONTEND_URL`/localhost)
- **Fehler**: `err.message`/Stack-Leak nur in `development`

### Environment Variablen (Backend)
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=min-32-characters
JWT_REFRESH_SECRET=min-32-characters
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=re_...
EMAIL_FROM="Synthesis Engine <noreply@example.com>"
FRONTEND_URL=http://localhost:5173
PORT=3000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
SE_EPHE_PATH=./ephemeris
```

### Environment Variablen (Frontend)
```env
VITE_API_URL=http://localhost:3000
```

## Wichtige Konfigurationen

### Vite Config (`app/vite.config.ts`)
- Alias: `@/` → `./src`
- Plugin: `kimi-plugin-inspect-react` für Debugging

### Tailwind Config (`app/tailwind.config.js`)
- Dark Mode: `class`
- CSS Variables für Theme (HSL-basiert)
- shadcn/ui Integration

### TypeScript Config
- **Frontend**: Projekt-Referenzen (`tsconfig.json` referenziert `tsconfig.app.json` und `tsconfig.node.json`), Target ES2022, Strict Mode — `noUnusedLocals`/`noUnusedParameters` aktiv (verhindert „fertig, aber nie verdrahtet"-Fälle)
- **Backend**: ES2020 Target, CommonJS, Strict Mode

### shadcn/ui Config (`app/components.json`)
- Style: "new-york", Base Color: "slate", CSS Variables: true, Icons: lucide

## Datenbank-Schema (Prisma)

### Haupt-Entitäten
- **User**: ID, Email, Passwort-Hash, Email-Verifizierung, Status, RBAC-Rollen
- **Role / Permission / UserRole / RolePermission**: RBAC-System
- **Session / RefreshToken**: Token-Management
- **AuditLog**: Sicherheits-Audit-Trail
- **Subscription / Invoice**: Abonnement-Management mit Stripe-Feldern (Stripe-Code selbst fehlt noch)
- **MillmanProfile**: Lebensweg, Wurzelzahlen, Meisterzahlen, etc.
- **HumanDesignProfile**: Energie-Typ, Autorität, Profil, Zentren, Tore, Kanäle
- **GeneKeysProfile**: 11 Gene Keys des Hologenetischen Profils
- **JournalEntry**: Serverseitige Journal-Einträge
- **SynthesisCache**: KI-generierte Texte (30 Tage Cache)
- **DailyCoaching**: Tägliche Coaching-Impulse

### Enums
- `UserStatus`: ACTIVE, SUSPENDED, DELETED
- `RoleName`: USER, ADMIN, SUPER_ADMIN
- `SubscriptionTier`: FREE, BASIC, PREMIUM, PRO
- `SubscriptionStatus`: INACTIVE, TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID, PAUSED
- `EnergyType`: MANIFESTOR, GENERATOR, MANIFESTING_GENERATOR, PROJECTOR, REFLECTOR
- `Authority`: EMOTIONAL, SACRAL, SPLENIC, EGO, SELF_PROJECTED, MENTAL, LUNAR
- `CenterName`: HEAD, AJNA, THROAT, G_CENTER, HEART, SACRAL, ROOT, SPLEEN, SOLAR_PLEXUS
- `Planet`: SUN, EARTH, NORTH_NODE, SOUTH_NODE, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, URANUS, NEPTUNE, PLUTO

## Deployment

Empfohlener Ziel-Stack (siehe `MONETIZATION_PLAN.md`): **Render** (Backend) + **Supabase** (PostgreSQL) + Static Hosting/CDN fürs Frontend.

```bash
# Backend
cd backend
pnpm build
pnpm exec prisma migrate deploy   # beim ersten Deploy zwingend
pnpm start

# Frontend
cd app
pnpm build                         # dist/ auf Static Hosting
```

**Vor dem ersten Deploy Env-Checkliste:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `CORS_ORIGINS`, `SE_EPHE_PATH`.

## Launch-Blocker (kommerzieller Launch)

Siehe ausführlich in `PRODUCTION_READY_PLAN.md` (Abschnitt „Launch-Blocker"). Kurz:

1. **sweph ist AGPL** → kommerzielle Astrodienst-Lizenz (~500 €) oder Umstieg auf MIT-lizenzierte Ephemeriden-Alternative
2. **Stripe-Integration fehlt** (Schema vorbereitet, Checkout/Webhooks nicht implementiert)
3. **Deployment noch nicht erfolgt** (Empfehlung: Render + Supabase)
4. **`prisma migrate deploy`** beim ersten Deploy
5. **Env**: `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET`

## Bekannte offene Punkte

- **AuthProvider-Unmount-Bug**: Bei `isLoading` unmountet der `AuthProvider` den Router-Baum; ein `navigate()` direkt nach dem Login kann dadurch hängen bleiben (in Phase 4 des Fix-Plans gefunden, noch nicht behoben).
- **Nachgelagerte LOW-Findings aus dem Audit**:
  - JSON-Body-Limit von 10 MB ist zu großzügig
  - `parseInt` ohne Bound-Checks an einzelnen Stellen
  - Temperature-Slider in den KI-Einstellungen ruft unbeabsichtigt `setBaseUrl` auf
  - 737-KB-Frontend-Chunk ohne Code-Splitting
- **M9 (CI)**: `ci-docker.yml` baut das Docker-Image nur, startet es nie — Runtime-Healthcheck (`/health` im gestarteten Container + Prüfung der `.se1`-Dateien) fehlt in CI.

## Häufige Patterns

### State Update Pattern
```typescript
const { setUserData, setStep } = useAppStore();
setUserData(data);
setStep('processing');
```

### Selector Hooks (Performance)
```typescript
export function useHDChart(): HumanDesignChart | null {
  return useAppStore((state) => state.hdChart);
}
```

### API Call Pattern
```typescript
const response = await fetch(`${API_BASE}/api/synthesis/generate`, {
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

### Auth Middleware Pattern
```typescript
router.post('/generate', authenticate, requireTier(['PREMIUM', 'PRO']), asyncHandler(async (req, res) => {
  // Handler
}));
```

## Troubleshooting

### sweph Installation schlägt fehl (Windows)
- Visual Studio Build Tools (C++ Workload) installieren — node-gyp braucht sie
- Für reine Test-Läufe nicht nötig: Tests nutzen `backend/src/__mocks__/sweph.ts`
- Alternative: über Docker entwickeln (`docker-compose.dev.yml`), dort sind die Build-Deps enthalten

### Prisma Fehler
```bash
pnpm exec prisma generate      # Client neu generieren
pnpm exec prisma migrate deploy # Migrationen anwenden (keine Dev-DB nötig für die Migrationen selbst)
```

### Build Fehler
- `node_modules` löschen und `pnpm install`
- TypeScript Version prüfen (5.9.3 im Frontend, 5.2.2 im Backend)
- Frontend: `tsc -b` zeigt Projekt-Referenz-Fehler, die `vite build` allein verschluckt

## Professionelle Berechnungen & Swiss Ephemeris

Alle astronomischen Berechnungen laufen serverseitig über `sweph` (Swiss Ephemeris) in `backend/src/services/ephemeris.ts` bzw. `humanDesignCalculator.ts` — mit professioneller Genauigkeit (±0.0001°). Die Ephemeris-Dateien (.se1) liegen in `backend/ephemeris/` und werden mit `scripts/download-ephemeris.sh|.ps1` heruntergeladen.

**Lizenz-Hinweis:** Swiss Ephemeris steht unter AGPL bzw. einer kommerziellen Astrodienst-Lizenz. Für einen kommerziellen Closed-Source-Launch muss die Lizenzfrage geklärt werden — siehe Launch-Blocker in `PRODUCTION_READY_PLAN.md`.

Die älteren Dokumente in `docs/` (`EPHEMERIS_IMPLEMENTATION_GUIDE.md`, `PROFESSIONAL_CALCULATIONS_SPEC.md`, `SWISS_EPHEMERIS_PROFESSIONAL_SETUP.md`) beschreiben die Tauri/Rust-Umsetzung und sind nur noch als historische Referenz relevant; `docs/TEST_REFERENCE_DATA.md` bleibt für Validierungs-Tests nutzbar.

## Hinweise für Agents

1. **Sprache**: UI und Dokumentation sind auf Deutsch. Code-Kommentare können Englisch oder Deutsch sein.
2. **Datenschutz**: Geburtsdaten gehen ausschließlich an das eigene Backend. An externe KI-Provider gehen nur berechnete Profildaten — und nur über den Backend-Proxy, nie direkt aus dem Browser. Keine Aussagen wie „Daten verlassen das Gerät nie" mehr verwenden — sie sind seit dem Web-Pivot falsch.
3. **Paketmanager**: pnpm. Keine `package-lock.json`/`yarn.lock` erzeugen.
4. **KI-Prompts**: Sokratischer, reflektierender Stil (nicht belehrend). Siehe `backend/src/routes/synthesis.ts`.
5. **UI**: Dark Mode only, Neo-Mystic Minimalism Design mit Glassmorphism-Effekten.
6. **Imports**: Immer `@/` Alias verwenden, nie relative Pfade wie `../../`.
7. **Tailwind**: `cn()` Utility nutzen für bedingte Klassen.
8. **State**: Zustand mit Persistenz für Daten, die über Sessions erhalten bleiben sollen. **NIEMALS** API-Keys oder Auth-Tokens persistieren.
9. **Tests**: Nach jeder signifikanten Änderung Tests ausführen (`pnpm test` in app und backend). Backend-Tests brauchen keine DB (Prisma/sweph gemockt).
10. **Environment**: `.env.example` Dateien als Vorlage verwenden, nie echte Secrets committen.
