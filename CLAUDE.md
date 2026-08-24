# CLAUDE.md

Leitfaden für Claude Code und andere AI-Agents in diesem Repository.

> **Sprache:** UI und Dokumentation sind auf **Deutsch**, Code-Kommentare gemischt (Backend überwiegend Englisch). Neue Doku auf Deutsch schreiben, neue Code-Kommentare in der Sprache der umgebenden Datei.
>
> **Verhältnis zu `AGENTS.md`:** `AGENTS.md` ist die ausführliche technische Referenz (Versionstabellen, Schema-Details, Historie). Diese Datei ist der operative Einstieg: was man braucht, um hier produktiv und ohne Regressionen zu arbeiten. Bei Widersprüchen gilt der Code — und beide Dateien sind zu korrigieren.

---

## 1. Was ist das Projekt

**Synthesis Engine** synthetisiert **Human Design**, **Gene Keys** und **Dan-Millman-Numerologie** und reichert das Ergebnis mit KI-gestützter Kreuzkorrelationsanalyse an.

**Architektur: Web-only.** React-19/Vite-Frontend (`app/`) spricht per HTTP/REST mit einem Express/Prisma-Backend (`backend/`). Alle astronomischen Berechnungen laufen **serverseitig**.

> Die frühere Desktop-Variante (Tauri v2 + Rust-Core) wurde vollständig entfernt. Es gibt kein `app/src-tauri` mehr. Trifft man in älteren Dokumenten auf Tauri/Rust/`invoke()`, ist das **historisch** — nicht als Vorlage verwenden.

### Kernfunktionen
- **Human Design**: BodyGraph (9 Zentren), Energie-Typ, Autorität, Profil (1–6), Tore 1–64, Kanäle, PHS-Variablen
- **Numerologie (Millman)**: Lebensweg (z. B. 35/8), Wurzelzahlen, Meisterzahlen (11/22), Null-Verstärker, Seelen-/Berufsweg, Herausforderungen, Höhepunkte, Persönliches Jahr
- **Gene Keys**: 64 Keys mit Schatten / Gabe / Siddhi
- **Transits**: Tagesplaneten + Vergleich mit dem Natal-Chart
- **KI-Synthese & Coaching**: OpenAI / Anthropic / Google — ausschließlich über den Backend-Proxy
- **Journal**: serverseitig am Konto; im Gast-Modus lokal, mit einmaliger Migration beim ersten Login
- **PDF-Export** von Charts und Reports

---

## 2. Repo-Layout

```
synthesis-engine-hd/
├── app/                     # React 19 + Vite + TypeScript (pnpm)
│   ├── src/
│   │   ├── App.tsx          # Router (öffentliche + geschützte Routen) + MainApp-Shell
│   │   ├── main.tsx         # StrictMode, ErrorBoundary, AuthProvider
│   │   ├── sections/        # Seiten-Level-Flows (Onboarding, Results, Journal, Transit, Settings, AISettings, GeneKeys, Processing)
│   │   ├── pages/           # Route-Level-Seiten (DashboardPage, auth/*)
│   │   ├── components/      # Fachkomponenten + components/ui (shadcn) + components/auth
│   │   ├── stores/          # Zustand-Stores (app, auth, aiConfig, toast)
│   │   ├── lib/             # api.ts, journalApi.ts, millmanCalculations.ts, geneKeys.ts, utils.ts, animations.ts
│   │   ├── services/        # pdfExport.ts (jsPDF + html2canvas)
│   │   ├── hooks/           # use-mobile, useAccessibility, useAuthEvents
│   │   └── types/           # humanDesign.ts (Haupt-Interfaces), index.ts (Legacy-Re-Exports)
│   ├── e2e/smoke.spec.ts    # Playwright-Smoke (Kern-Nutzerpfad)
│   ├── vitest.config.ts     # happy-dom, e2e/ ausgeschlossen
│   └── vite.config.ts       # Alias @/ → ./src, base './'
│
├── backend/                 # Node 20 + Express 4 + Prisma 5 (pnpm)
│   ├── src/
│   │   ├── index.ts         # App-Setup, Router-Mounting, /health, Graceful Shutdown, Cleanup-Job
│   │   ├── routes/          # auth, humanDesign, numerology, synthesis, ai, transit, coaching, journal
│   │   ├── middleware/      # auth (JWT/RBAC/Tier), errorHandler (asyncHandler), rateLimit, traceId
│   │   ├── services/        # Geschäftslogik (siehe unten)
│   │   ├── services/ephemeris/  # Provider-Architektur (types, swephProvider, standardProvider, resolver)
│   │   ├── lib/             # config, prisma, logger (pino), ssrfGuard, cleanup
│   │   ├── __mocks__/       # sweph-Mock (Tests laufen ohne native Compilation)
│   │   └── tests/           # Jest + Supertest
│   ├── prisma/              # schema.prisma, seed.ts, migrations/ (handgeschriebenes SQL)
│   ├── ephemeris/           # .se1-Dateien (semo_18, sepl_18)
│   └── Dockerfile           # Multi-Stage, Build-Arg WITH_SWEPH
│
├── docs/                    # Ephemeris-Guides, Lizenz-Runbook, Test-Referenzdaten
├── scripts/                 # download-ephemeris.sh/.ps1 + Checksums
├── .github/workflows/       # ci-backend, ci-frontend, ci-docker
├── docker-compose.yml       # postgres + backend (+ backend-pro über Profil "pro")
├── docker-compose.dev.yml   # postgres + redis + backend mit Hot-Reload
└── setup.sh / setup.ps1
```

---

## 3. Setup & Befehle

**Paketmanager ist pnpm** (beide Pakete haben `pnpm-lock.yaml`). **Kein npm, kein yarn** — niemals `package-lock.json` oder `yarn.lock` erzeugen. Node 20+, pnpm 9+.

> In frischen Umgebungen sind `node_modules` nicht vorhanden — vor Test-/Build-Läufen `pnpm install` in `app/` **und** `backend/` ausführen.

### Frontend (`app/`)
```bash
cd app
pnpm install
pnpm dev                     # Vite Dev-Server, Port 5173
pnpm lint                    # ESLint (flat config) — in CI blockierend
pnpm test                    # Vitest (happy-dom, e2e/ ausgeschlossen)
pnpm build                   # tsc -b && vite build
pnpm exec tsc -b             # Typecheck über die Projekt-Referenzen
pnpm exec playwright test    # E2E-Smoke
```
Es gibt **kein** eigenes `typecheck`-Script — `tsc -b` bzw. `pnpm build` übernimmt das.

### Backend (`backend/`)
```bash
cd backend
pnpm install
cp .env.example .env         # Secrets/DB-URLs eintragen
pnpm exec prisma generate    # Typen erzeugen (auch ohne laufende DB)
pnpm dev                     # ts-node-dev, Port 3000
pnpm exec tsc --noEmit       # Typecheck
pnpm test                    # Jest (+ Supertest) — braucht KEINE Datenbank
pnpm run test:coverage
pnpm build && pnpm start
```
Es gibt **kein** `lint`-Script im Backend (die CI toleriert das explizit). Nicht „reparieren“, ohne das mit dem Nutzer abzustimmen.

### Docker
```bash
docker compose up                                  # postgres + backend (Standard, sweph-frei)
docker compose -f docker-compose.dev.yml up        # + redis, Hot-Reload
docker compose --profile pro up -d backend-pro     # Professional-Image, Port 3001

docker build -t synthesis-backend ./backend
docker build --build-arg WITH_SWEPH=true -t synthesis-backend-pro ./backend
```

### CI (`.github/workflows/`)
Getriggert per Pfad-Filter auf `main`/`master` (push + PR):
- `ci-frontend.yml` — install → **lint** → build → test (`app/**`)
- `ci-backend.yml` — install → `prisma generate` → lint (optional) → build → test (`backend/**`)
- `ci-docker.yml` — baut das Standard-Image und **verifiziert, dass es sweph-frei ist** (kein `node_modules/sweph`, leeres `/app/ephemeris`, `EPHEMERIS_PRO_ENABLED=false`); zweiter Job baut die Pro-Variante

---

## 4. Architektur & Datenfluss

### Request-Fluss (HD-Chart)
1. `OnboardingFlow` sammelt Geburtsdaten → `appStore.setUserData()` → Step `processing`
2. `ProcessingAnimation` ruft `api.calculateHD()` (`app/src/lib/api.ts`, mit Retry + 30 s Request-Dedupe-Cache)
3. `POST /api/hd/calculate` → `hdCalculateLimiter` (10/min) → `optionalAuth` → Zod-Validierung
4. `resolveProvider(tier)` wählt den Ephemeris-Provider → `calculateHumanDesignChart(birthData, provider)`
5. Antwort: `{ success, accuracy: 'STANDARD'|'PROFESSIONAL', data: chart, meta: { ephemerisProvider, usingEphemeris, missingBodies, calculationTimeMs, birthData:{...,julianDay} } }`
6. Frontend rendert `BodyGraph` + `AccuracyBadge` (Tier-Anzeige inkl. Upsell und `missingBodies`)

**Numerologie wird im Frontend gerechnet** (`app/src/lib/millmanCalculations.ts`, aufgerufen aus `api.ts`) — das Backend hat mit `services/millmanCalculator.ts` eine **zweite** Implementierung für `POST /api/numerology/save`. Ändert man Numerologie-Regeln, müssen **beide** Seiten angefasst werden, sonst driften gespeicherte und angezeigte Profile auseinander.

### Ephemeris-Provider & Präzisions-Staffelung

Alles läuft über die `EphemerisProvider`-Abstraktion; `services/ephemeris.ts` ist die provider-agnostische Fassade, `services/ephemeris/resolver.ts` wählt pro Request:

| Tier | Provider | Genauigkeit |
|---|---|---|
| FREE, BASIC, Gast | `standard` (astronomia/Meeus, MIT) | gemessener Max-Fehler: Sonne 0,0059°, Mond 0,0152°, Planeten ≤ 0,0094° |
| PREMIUM, PRO | `swiss-professional` (Swiss Ephemeris, ±0,0001°, inkl. Chiron) | Referenz — nur wenn `EPHEMERIS_PRO_ENABLED=true` **und** natives `sweph` ladbar |

- Der Resolver **wirft nie**: Flag aus, Modul fehlt, Ladefehler → stiller Fallback auf `standard`.
- Chiron fehlt im Standard-Tier → landet in `meta.missingBodies`.
- Flags in `backend/src/lib/config.ts` werden **lazy** gelesen (Funktionen, keine Modul-Konstanten), damit Tests Env-Vars pro Fall setzen können. Dieses Muster beibehalten.
- Verifikation eines Deployments: `GET /api/hd/health` → `providers`-Feld.
- Details: `docs/EPHEMERIS_STANDARD_PROVIDER.md` (gemessene Werte), `docs/EPHEMERIS_LICENSE_RUNBOOK.md` (Lizenzkauf → Aktivierung).

**Lizenz:** `sweph` ist **AGPL** und steht deshalb in `optionalDependencies`; das Standard-Image ist sweph-frei (`pnpm install --no-optional`). Vor jedem öffentlichen Pro-Deployment ist die Astrodienst-Lizenz (~500 €) zu erwerben. Der Standard-Tier (MIT) ist davon nicht betroffen — diese Trennung bei Änderungen an Dockerfile/Dependencies **nicht aufweichen**.

### API-Endpunkte

Alle unter `/api`, alle hinter `generalLimiter` (Default 100/min, per `RATE_LIMIT_*` konfigurierbar).

| Präfix | Endpunkte | Auth |
|---|---|---|
| `/auth` | `register`, `login`, `refresh`, `logout`, `me`, `change-password`, `forgot-password`, `reset-password`, `verify-email` | gemischt; `authLimiter` (5/15 min) nur auf der Credential-Rate-Fläche |
| `/hd` | `POST calculate`, `POST save`, `GET profile`, `GET stats`, `GET health`, `GET diagnostics` | `calculate` optional-auth; `diagnostics` nur ADMIN |
| `/numerology` | `POST save`, `GET profile`, `GET stats`, `GET soulmates` | überwiegend authentifiziert |
| `/synthesis` | `POST generate`, `GET cache/:contextKey` | `authenticate` + `requireTier(['PREMIUM','PRO'])`, `synthesisLimiter` 20/h |
| `/ai` | `POST proxy`, `GET models`, `POST estimate-cost` | `proxy`: PREMIUM/PRO |
| `/transit` | `GET daily`, `today`, `compare`, `range`, `moon-phases` | `daily`/`today` optional-auth; `range` mit `transitRangeLimiter` 10/min |
| `/coaching` | `GET daily`, `POST daily/read`, `GET history` | `daily`: PREMIUM/PRO, `coachingLimiter` 10/h |
| `/journal` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` | authentifiziert |

Dazu `GET /health` (außerhalb von `/api`) mit DB-Konnektivitätsprüfung.

**Wichtig:** `authLimiter` wird bewusst **pro Route** gesetzt, nicht auf dem `/api/auth`-Prefix — sonst drosselt er `/me` und `/refresh`, die der Client bei jedem App-Start aufruft. Das nicht „vereinfachen“ (siehe Kommentar in `index.ts`).

---

## 5. Konventionen

### Frontend
1. **Imports immer über den Alias `@/`** — keine `../../`-Pfade. Konfiguriert in `vite.config.ts`, `vitest.config.ts` und `tsconfig.app.json`.
2. **Funktionskomponenten mit explizitem Return-Type**: `export function Foo(): JSX.Element {}`
3. **State: Zustand + `immer`**, Persistenz über `persist`. Selector-Hooks für Performance:
   ```ts
   export function useHDChart(): HumanDesignChart | null {
     return useAppStore((s) => s.hdChart);
   }
   ```
4. **Tailwind-Klassen über `cn()`** (`@/lib/utils`) statt String-Konkatenation.
5. **UI-Bausteine aus `@/components/ui`** (shadcn/ui, Style „new-york“, Base „slate“, Icons: lucide). Keine rohen HTML-Formularelemente; keine blockierenden `confirm()`/`alert()` — stattdessen `AlertDialog` / Toasts.
6. **Design-System „Neo-Mystic Minimalism“**, Dark Mode only: Hintergrund `bg-[#020202]`, Akzent Purple/Blue, Glassmorphism `bg-white/5 backdrop-blur-xl`, Headlines Cormorant Garamond, Body Inter. Theme-Farben als CSS-Variablen in `app/src/index.css`.
7. **`noUnusedLocals`/`noUnusedParameters` sind aktiv** — genau deshalb fällt „implementiert, aber nie verdrahtet“ auf. Neue Sections/Komponenten immer bis in `App.tsx`/`ResultsDashboard.tsx` durchziehen.

### Backend
1. **Routes bleiben dünn**, Geschäftslogik nach `services/`.
2. **`asyncHandler`-Wrapper** um jeden async Handler (`middleware/errorHandler.ts`).
3. **Zod an jeder Eingangsstelle**: `const data = schema.parse(req.body)`.
4. **Auth-Middleware kombinieren**:
   ```ts
   router.post('/generate', authenticate, requireTier(['PREMIUM','PRO']), synthesisLimiter, asyncHandler(...));
   ```
   Verfügbar in `middleware/auth.ts`: `authenticate`, `optionalAuth`, `requireRole(role)`, `requireTier(tiers[])`, `requireOwnership(getResourceUserId)`. (`AGENTS.md` nennt zusätzlich ein `requirePermission` — das existiert im Code **nicht**.)
5. **Client-Berechnungen nie vertrauen**: `POST /api/hd/save` akzeptiert nur Geburtsdaten und rechnet den Chart serverseitig neu (Audit-Befund M13). Dieses Muster bei neuen Persistenz-Endpunkten übernehmen.
6. **Logging über pino** (`lib/logger.ts`) mit Trace-ID, nicht `console.log` in Request-Pfaden.

---

## 6. Tests

Backend läuft **ohne Datenbank und ohne native Compilation** — Prisma und `sweph` sind gemockt (`backend/src/__mocks__/`).

| Bereich | Runner | Umfang |
|---|---|---|
| `app/` | Vitest (happy-dom) | ~36 Tests: `lib/calculations.test.ts`, `lib/journalApi.test.ts`, `stores/aiConfigStore.test.ts`, `stores/authStore.test.ts`, `components/AccuracyBadge.test.tsx`, `pages/auth/authPages.test.tsx` |
| `app/e2e/` | Playwright | 1 Smoke-Test über den Kern-Nutzerpfad |
| `backend/` | Jest + Supertest | ~200 Tests: `auth`, `humanDesign*`, `humanDesignRateLimit`, `ai`, `ssrfGuard`, `coaching*`, `journal`, `synthesis`, `email`, `ephemeris`, `ephemerisTier`, `standardProvider*` |

Besonders schützenswerte Suiten — **nicht skippen, nicht abschwächen**:
- `authStore.test.ts` / `aiConfigStore.test.ts` — belegen, dass Tokens und API-Keys **nicht** persistiert werden (waren schon einmal `.skip`'d, was eine falsche Sicherheitsaussage in der UI durchrutschen ließ).
- `standardProvider.accuracy.test.ts` — prüft den Standard-Provider gegen die Swiss-Ephemeris-Referenz-Fixture (`tests/fixtures/swephReference.json`, 10 Stichtage 1950–2030).
- `ephemerisTier.test.ts` — Resolver-Matrix + `/calculate`-Contract pro Tier.

Nach jeder signifikanten Änderung: `pnpm test` in **beiden** Paketen, plus `pnpm lint` im Frontend.

---

## 7. Sicherheit & Datenschutz — harte Regeln

- **Niemals** Auth-Tokens oder KI-API-Keys in `localStorage` persistieren. Die `partialize`-Konfiguration in `authStore`/`aiConfigStore` ist eine Sicherheitsgrenze, kein Detail.
- **Keine direkten Provider-Calls aus dem Browser.** KI-Traffic läuft über `POST /api/ai/proxy`; Custom-Endpunkte werden vom `ssrfGuard` (inkl. DNS-Auflösungspfad) geprüft.
- **Keine Aussage „Geburtsdaten verlassen das Gerät nie“** — das stammt aus der Tauri-Ära und ist seit dem Web-Pivot falsch. Korrekt: Geburtsdaten gehen an das **eigene** Backend und werden dort verarbeitet; gespeichert werden die berechneten Profile. An externe KI-Provider gehen nur berechnete Profildaten, und nur über den Proxy.
- **Journal**: serverseitig am Konto; im Gast-Modus lokal (unverschlüsselt) mit einmaliger Migration beim ersten Login.
- **Auth**: JWT Access 15 min + Refresh 7 d (httpOnly-Cookie), bcryptjs mit 12 Runden, Reset-/Verify-Tokens **gehasht** (SHA-256) in der DB, Klartext nur per E-Mail. RBAC: USER / ADMIN / SUPER_ADMIN, plus Audit-Log.
- **Secrets nie committen** — `.env.example` als Vorlage nutzen. Fehler-Details/Stacks werden nur in `development` ausgeliefert.
- **CORS** ist Whitelist-basiert über `CORS_ORIGINS`.

### Environment

Backend (`backend/.env.example`): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (je ≥ 32 Zeichen), `PORT`, `NODE_ENV`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `SE_EPHE_PATH`, `EPHEMERIS_PRO_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, optional `CORS_ORIGINS`.

Frontend (`app/.env.example`): `VITE_API_URL`, `VITE_ENABLE_ANALYTICS`, `VITE_DEBUG_MODE`, `VITE_APP_NAME`, `VITE_APP_VERSION`.

Ohne `RESEND_API_KEY` loggt `services/email.ts` die Mail nur auf die Konsole (Dev-Fallback, kein SDK — plain `fetch` gegen `api.resend.com`).

---

## 8. Datenbank / Prisma

Schema: `backend/prisma/schema.prisma`. Zentrale Modelle: `User`, `Role`/`Permission`/`UserRole`/`RolePermission`, `Session`/`RefreshToken`, `AuditLog`, `Subscription`/`Invoice`, `MillmanProfile`, `HumanDesignProfile` (+ `ChartCenter`/`ChartGate`/`ChartChannel`), `GeneKeysProfile`/`GeneKeyActivation`, `SynthesisCache`, `DailyCoaching`, `JournalEntry`, `CommunityStats`.

Enums: `UserStatus`, `RoleName`, `SubscriptionTier` (FREE/BASIC/PREMIUM/PRO), `SubscriptionStatus`, `EnergyType`, `Authority`, `CenterName`, `Planet`.

**Die Migrationen in `prisma/migrations/` sind handgeschriebenes SQL** (ohne Live-DB erstellt):
- Lokal/CI reicht `pnpm exec prisma generate`; Tests brauchen keine DB.
- Beim **ersten Deploy** zwingend `pnpm exec prisma migrate deploy`.
- `prisma migrate dev` nur, wenn wirklich eine Dev-DB läuft und eine neue Migration entstehen soll.

Ein periodischer Cleanup-Job (`lib/cleanup.ts`, im Test-Modus abgeschaltet) räumt abgelaufene `SynthesisCache`-, `RefreshToken`-, `Session`- und alte `AuditLog`-Zeilen ab.

---

## 9. Fallstricke

- **`sweph` unter Windows**: natives Modul, braucht Visual Studio Build Tools / node-gyp. Für Tests irrelevant (Mock). Alternativ per `docker-compose.dev.yml` entwickeln.
- **`.se1`-Dateien**: `.gitignore` listet `*.se1` und `backend/ephemeris/`, die beiden vorhandenen Dateien (`semo_18.se1`, `sepl_18.se1`) sind aber bereits getrackt. Nicht „aufräumen“; weitere Dateien via `scripts/download-ephemeris.sh|.ps1` beziehen (Checksums in `scripts/ephemeris-checksums.sha256`).
- **`vite build` allein verschluckt Projekt-Referenz-Fehler** — `tsc -b` (bzw. `pnpm build`) ist die verlässliche Prüfung.
- **Vitest schließt `e2e/` explizit aus** — Playwright-Specs dürfen dort nicht hineinrutschen.
- **Zwei Zod-Majors im Repo**: Frontend `zod@4`, Backend `zod@3`. API-Schemas nicht 1:1 zwischen den Paketen kopieren.
- **`pnpm.overrides`** in beiden `package.json` pinnen Security-Fixes transitiver Pakete — beim Dependency-Update nicht wegwerfen.
- **Standard-Image sweph-frei halten**: Dependency- oder Dockerfile-Änderungen, die `sweph` in den Standard-Build ziehen, lässt `ci-docker.yml` durchfallen (und sie wären ein Lizenzproblem).

---

## 10. Bekannter Ist-Zustand

### Launch-Blocker (kommerziell) — Details in `PRODUCTION_READY_PLAN.md`
1. **Astrodienst-Lizenz (~500 €)** vor jedem öffentlichen Deployment mit `sweph` (AGPL) — nur PROFESSIONAL-Tier betroffen, Vorgehen in `docs/EPHEMERIS_LICENSE_RUNBOOK.md`
2. **Stripe fehlt** — Schema (`Subscription`/`Invoice`) ist vorbereitet, Checkout/Webhooks sind nicht implementiert
3. **Deployment noch nicht erfolgt** (Empfehlung: Render + Supabase + Static Hosting fürs Frontend)
4. **`prisma migrate deploy`** beim ersten Deploy
5. **Env**: `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `CORS_ORIGINS`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `EPHEMERIS_PRO_ENABLED` (im Pro-Deployment)

### Offene Punkte (nicht blockierend)
- **AuthProvider-Unmount-Bug**: bei `isLoading` unmountet der `AuthProvider` den Router-Baum; ein `navigate()` direkt nach dem Login kann hängen bleiben.
- **LOW-Findings**: 10-MB-JSON-Body-Limit zu großzügig; `parseInt` ohne Bound-Checks; Temperature-Slider in den KI-Einstellungen ruft unbeabsichtigt `setBaseUrl`; ~737-KB-Frontend-Chunk ohne Code-Splitting.
- **M9**: `ci-docker.yml` baut das Image nur — ein Runtime-Healthcheck (Container starten, `/health` prüfen, `.se1`-Dateien verifizieren) fehlt in der CI.

---

## 11. Doku-Landkarte

| Datei | Inhalt | Status |
|---|---|---|
| `AGENTS.md` | Ausführliche technische Referenz für Agents | aktuell |
| `README.md` | Einstieg, Features, Setup | aktuell |
| `PROJECT_OVERVIEW.md` | Produkt-/Projektüberblick (Quelle der Wahrheit für Exporte) | aktuell |
| `SESSION_NOTES.md` | Chronologie der Arbeitssessions und Entscheidungen | aktuell |
| `PRODUCTION_READY_PLAN.md` | Launch-Blocker & Produktionsplan | aktuell |
| `MONETIZATION_PLAN.md` | Tiers, Preise, Ziel-Stack | aktuell |
| `AUDIT_REPORT*.md` | Audits 2026-05-20 / 06-05 / 07-07 | historisch, keine Duplikate |
| `docs/EPHEMERIS_STANDARD_PROVIDER.md` | Bibliotheks-Entscheidung + gemessene Genauigkeit | aktuell |
| `docs/EPHEMERIS_LICENSE_RUNBOOK.md` | Lizenzkauf → Pro-Aktivierung → Verifikation | aktuell |
| `docs/TEST_REFERENCE_DATA.md` | Referenzdaten für Validierung | nutzbar |
| `docs/EPHEMERIS_IMPLEMENTATION_GUIDE.md`, `docs/PROFESSIONAL_CALCULATIONS_SPEC.md`, `docs/SWISS_EPHEMERIS_PROFESSIONAL_SETUP.md`, `IMPLEMENTATION_SUMMARY.md`, `SYNTHESIS_ENGINE_EXECUTIVE_SUMMARY.md` | Tauri-Ära | **historisch** — nicht als Vorlage |
| Beide `.md`-Langtexte im Root (Numerologie / HD-Leitfaden) | Fachliche Grundlagen (Deutsch) | Referenz für die Fachlogik |

---

## 12. Checkliste vor dem Abschluss einer Änderung

- [ ] `cd app && pnpm lint && pnpm test && pnpm build`
- [ ] `cd backend && pnpm exec tsc --noEmit && pnpm test`
- [ ] Neue UI wirklich verdrahtet (von `App.tsx` / `ResultsDashboard.tsx` aus erreichbar)?
- [ ] Numerologie-Regeln geändert → **beide** Implementierungen (Frontend + Backend) angepasst?
- [ ] Keine Tokens / API-Keys in Persistenz, keine Secrets im Diff, keine `console.log`-Reste im Request-Pfad
- [ ] Standard-Pfad bleibt sweph-frei und MIT-lizenziert
- [ ] Doku nachgezogen (`AGENTS.md`, diese Datei, `SESSION_NOTES.md` bei größeren Änderungen)
- [ ] Commit-Messages im Conventional-Commits-Stil des Repos (`feat(app):`, `fix(api):`, `docs(ephemeris):`, `build(docker):`, `ci(docker):`, `test(ephemeris):`, `refactor(...)`)
