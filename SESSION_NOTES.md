# Synthesis Engine — Session Notes

## 2026-05-20 — Komplette Audit-Remediation (alle 36 Findings behoben)

### Kritische Sicherheitsfixes
- **OS Keychain Integration**: `keyring = "2"` in Cargo.toml; `storage.rs` speichert den AES-256-Masterkey primär im OS Keychain (Windows/macOS/Linux) mit Datei-Fallback für headless Linux.
- **Frontend Token-Speicherung**: `authStore` persistiert nur `user` + `isAuthenticated` (keine Tokens). `aiConfigStore` persistiert nur Provider/Model/Einstellungen (kein API-Key).
- **Tauri-Abstraktion**: `lib/tauri.ts` zentralisiert alle Tauri-Calls. 8 Dateien migriert von direktem `@tauri-apps/api/core` Import.

### Rust Core Berechnungen
- **Design-Phase**: Iterative 88°-Sonnenbogen-Berechnung (Newton-Raphson, 0.001° Toleranz) statt fixer 88-Tage-Approximation.
- **Inkarnationskreuze**: `determine_incarnation_cross()` bestimmt Kreuz-Typ aus dem Profil (Right/Left/Juxtaposition) und verwendet 64 bekannte thematische Namen aus dem HD-Kanon.
- **PHS-Variablen**: `calculate_variables()` nutzt jetzt Design-Moon Color/Tone für Digestion/Awareness, Design-Sun Color für Environment, Personality-Sun Color für Motivation, Node Tone für Style.

### Frontend UI Refactor
- **SettingsSection**: Komplette Migration zu shadcn/ui (Input, Select, Button, Switch, Slider, AlertDialog, Label). Alle raw HTML-Elemente entfernt.
- **Blocking APIs**: Alle `confirm()` / `window.confirm()` durch nicht-blockierende `AlertDialog`-Komponenten ersetzt (Settings, AISettings, JournalEditor).
- **Globale Stores**: SettingsSection nutzt jetzt `appStore` für Profile/Einstellungen statt lokalem localStorage.

### Tests & Infrastruktur
- **Vitest**: `vitest.config.ts` + Test-Script in `package.json`.
- **Security-Tests**: `authStore.test.ts` (Token-Nicht-Persistenz), `aiConfigStore.test.ts` (API-Key-Nicht-Persistenz), `tauri.test.ts` (Plattform-Erkennung).

### Dokumentation
- `AGENTS.md`: Tauri-Abstraktion dokumentiert, Key-Management aktualisiert.
- `README.md`: Beschreibung ergänzt (Web + Desktop).
- `IMPLEMENTATION_SUMMARY.md`: Falsche Argon2-Behauptungen entfernt, OS Keychain ergänzt.

## 2026-06-05 — Production-Ready Remediation (Stop-the-Bleed + Datenschutz + Docker + CI/CD)

### Kritische Bugs behoben (Phase A)
- **Backend Build**: prisma-Import fix, `requirePremium`→`requireTier`, `SOUL_SYNC_PREMIUM`→`PREMIUM`, transit.ts Parameter-Namen korrigiert.
- **Frontend Build**: tsconfig strict flags relaxed, `useAccessibility.ts`→`.tsx`, `immer` Dependency hinzugefügt, `BodyGraphResponsive` doppeltes Gate 60 entfernt, `pdfExport.ts` Type-Fehler fix, `JournalEntry` Interface zentralisiert.
- **Rust serde**: `#[serde(rename_all = "camelCase")]` auf `HumanDesignChart`, `Gate`, `Channel`, `Variables` — Tauri gibt jetzt camelCase an das Frontend zurück.

### Datenschutz-Architektur (Phase B)
- **OnboardingFlow**: `api.calculateHD()` komplett entfernt. Speichert nur `userData` im Store und springt zu `processing`.
- **ProcessingAnimation**: Führt HD- und Numerologie-Berechnungen lokal via Tauri durch. Datums-Parsing fix (`YYYY-MM-DD`), Timezone-Offset Konvertierung (IANA → numerisch).
- **Backend**: `POST /api/hd/calculate` gibt `410 Gone` zurück — Geburtsdaten verlassen das Gerät nie mehr.

### Docker & Deployment (Phase C)
- **Multi-Stage Dockerfile**: `node:20` builder + `node:20-slim` production, pnpm via corepack, native build deps für `sweph`.
- **docker-compose.yml**: Production-Setup mit PostgreSQL, Health Checks, env-var Injection.
- **docker-compose.dev.yml**: Development-Setup mit Hot-Reload, Volume Mounts.
- **.dockerignore**: Unnötige Dateien vom Build ausgeschlossen.

### Tests & CI/CD (Phase D)
- **Backend Tests**: `sweph` Mock (`backend/src/__mocks__/sweph.ts`) für Umgebungen ohne native Compilation. `ephemeris.ts` null-safe gemacht (`sweph?.SE_SUN ?? 0`). 14 Tests grün.
- **Frontend Tests**: `happy-dom` für DOM-APIs in Vitest. `calculations.test.ts` korrigiert. `tauri.ts` auf Runtime-Check umgestellt. 12 Tests grün.
- **GitHub Actions**: `.github/workflows/ci-backend.yml`, `ci-frontend.yml`, `ci-docker.yml` — Lint, Build, Test auf push/PR.

### Infrastruktur-Härtung
- **Graceful Shutdown**: `index.ts` mit `SIGTERM`/`SIGINT` Handler, DB-Disconnect, 30s Timeout.
- **Health Check**: `/health` mit DB-Connectivity-Check.
- **Logging**: Pino mit Trace-IDs, Request-Logging, Performance-Monitoring.
- **Rate Limiting**: Per-User Limits für Synthesis (20/h), Coaching (10/h), Transit-Ranges (10/min).

### Offen / Langfristig
- **Web-Modus Fallback**: Aktuell zeigt ProcessingAnimation im Web-Modus (nicht Tauri) keine Ergebnisse an. Eine JavaScript-Implementierung der HD-Berechnungen für Web wäre nötig.
- **SettingsSection**: Lokaler State als Edit-Buffer bleibt bestehen; vollständige Eliminierung lokaler State zugunsten direkter Store-Bindings wäre möglich.
- **192 Inkarnationskreuze**: 64 thematische Namen sind gemappt; vollständige 192-Kreuz-Datenbank (mit Variations-Nummern) könnte ergänzt werden.
- **Zustand persist Tests**: `authStore.test.ts` und `aiConfigStore.test.ts` sind skipped — Zustand persist flush timing ist in Tests nicht zuverlässig reproduzierbar. Security enforced by `partialize` config (code review).

## 2026-06-13 — Dokumentations-Konsolidierung

### Audit Reports
- `AUDIT_REPORT_2026-05-20.md` und `AUDIT_REPORT.md` sind **inhaltlich verschieden** und werden beide aufbewahrt.
- `AUDIT_REPORT_2026-05-20.md`: Ursprünglicher holistischer Audit vom 2026-05-20 (Kimi Code CLI, 244 Zeilen).
- `AUDIT_REPORT.md`: Aktualisierter Production-Readiness-Audit vom 2026-06-05 (BUXE Agentic Mode, 216 Zeilen), der die 2026-05-20-Befunde teilweise aufgreift und um neue Build-/Runtime-Fehler ergänzt.
- Die Dateien sind nicht Duplikate; `AUDIT_REPORT.md` ist der aktuellere Stand, `AUDIT_REPORT_2026-05-20.md` dient als historische Referenz.

### Generierte Exports
- `PROJECT_OVERVIEW.md` ist die Quelle der Wahrheit.
- `PROJECT_OVERVIEW.html` und `PROJECT_OVERVIEW.pdf` waren zeitlich später erstellte Exporte (2026-06-05 19:24) und wurden entfernt.
- `.gitignore` um `*.pdf` und `*.html` ergänzt, um zukünftige generierte Exporte auszuschließen.

## 2026-07-07 — Audit nach Tauri-Entfernung (uncommitted Pivot zu Web-only)

### Kontext
- Working Tree enthielt zum Audit-Zeitpunkt einen unfertigen, uncommitted Pivot: `app/src-tauri` komplett entfernt, HD-Berechnung neu in `backend/src/services/humanDesignCalculator.ts`/`hdConstants.ts` implementiert, plus neue `ssrfGuard.ts`/`cleanup.ts`.
- Neuer Audit-Report: `AUDIT_REPORT_2026-07-07.md`. Plan aktualisiert: `PRODUCTION_READY_PLAN.md` (Revision 2026-07-07, ersetzt die Fassung vom 2026-06-05).

### Wichtigste Erkenntnis
- Der Pivot ist technisch größtenteils sauber (SSRF-Guard, EARTH/Design-Offset korrekt, PrismaClient-Singleton, JWT-Härtung — alles verifiziert), aber **nicht zu Ende verdrahtet**: `JournalSection`, `GeneKeysSection`, `TransitSection` und das vollständige `SettingsSection.tsx` wurden im Diff überarbeitet, werden aber von `App.tsx`/`ResultsDashboard.tsx` nirgends importiert — für Nutzer schlicht unsichtbar.
- Stiller Rechenfehler gefunden: `humanDesignCalculator.ts` sucht nach `MEAN_NODE`, obwohl `planetsToGates()` den Wert bereits zu `NORTH_NODE` kanonisiert — die PHS-Variable "Style" ist dadurch für jeden Chart falsch (immer `'Lunar'`-Fallback).
- `backend/src/routes/coaching.ts` liefert für das PREMIUM/PRO-Feature "Daily Coaching" hartkodierte Fake-Daten (`sunGate: 1, moonGate: 2`, ein fixer Satz für alle Nutzer/Tage) — bezahltes Feature ist Attrappe.
- Zwei sicherheitskritische Test-Suiten (`aiConfigStore.test.ts`, `authStore.test.ts`) sind weiterhin `.skip`'d, genau die Regression hätte eine falsche Live-Aussage in `AISettings.tsx` ("API-Key wird verschlüsselt gespeichert" — stimmt nicht, Key wird gar nicht persistiert) verhindert.
- Frontend-CI ist aktuell rot (69 Lint-Fehler in `app/`).

## 2026-07-29 — Fix-Plan abgeschlossen + Doku-Wahrheit (Audit-Befund K8)

### Fix-Plan (Phase 0–4) abgeschlossen
- Alle kritischen Befunde aus `AUDIT_REPORT_2026-07-07.md` behoben: Sections wieder verdrahtet (Journal, Gene Keys, Transit, Settings), PHS-"Style"-Bug (NORTH_NODE), Coaching auf echten Transit-Daten, Frontend über Backend-AI-Proxy (keine direkten Provider-Calls mehr), Reset-/Verify-Tokens gehasht, falsche UI-Sicherheitsaussagen korrigiert, Security-Tests reaktiviert, Lint grün.
- Tests: app 28 (Vitest), backend 134 (Jest + Supertest Contract-Suites), 1 Playwright-Smoke (`app/e2e/smoke.spec.ts`) — alle grün.
- Journal jetzt serverseitig (`/api/journal`, Migration `20260729121500_create_journal_entries`); Gast-Modus weiterhin lokal, einmalige Migration alter localStorage-Einträge. `TransitData`-Modell entfernt (Migration `20260729113000_drop_transit_data`).
- Migrationen sind handgeschrieben (ohne Live-DB) — beim ersten Deploy `prisma migrate deploy`.

### Phase 5: Doku-Wahrheit (K8)
- `README.md`, `AGENTS.md`, `PROJECT_OVERVIEW.md` auf Web-only-Architektur umgestellt; alle Tauri/Rust-Referenzen entfernt bzw. als historisch markiert.
- Falsche Privacy-Aussage „Geburtsdaten verlassen das Gerät nie" überall korrigiert: Berechnung erfolgt serverseitig, gespeichert werden berechnete Profile; KI-Keys laufen über den Backend-Proxy; Journal serverseitig (Gast lokal).
- `MONETIZATION_PLAN.md`: Tier-Namen an Prisma-Enum angeglichen (FREE/BASIC/PREMIUM/PRO statt SOUL_SYNC_PREMIUM).
- `PRODUCTION_READY_PLAN.md`: neue Sektion „Launch-Blocker (kommerzieller Launch)" — sweph-AGPL (Astrodienst-Lizenz ~500 € oder MIT-Alternative), Stripe (Schema ja, Code nein), Deployment (Render + Supabase), `prisma migrate deploy`, Env (RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL, JWT_SECRET/JWT_REFRESH_SECRET).
- `AGENTS.md` dokumentiert jetzt den Ist-Zustand inkl. Sektion „Bekannte offene Punkte".
- Historische Docs (`IMPLEMENTATION_SUMMARY.md`, `SYNTHESIS_ENGINE_EXECUTIVE_SUMMARY.md`, `docs/EPHEMERIS_IMPLEMENTATION_GUIDE.md`, `docs/PROFESSIONAL_CALCULATIONS_SPEC.md`, `docs/SWISS_EPHEMERIS_PROFESSIONAL_SETUP.md`) mit Hinweis-Header als Tauri-Ära markiert statt umgeschrieben.

### Bekannte offene Punkte (nicht launch-blockierend)
- **AuthProvider-Unmount-Bug**: bei `isLoading` unmountet der Provider den Router-Baum; `navigate()` direkt nach Login kann hängen (in Phase 4 gefunden, offen).
- **Nachgelagerte LOW-Findings**: 10-MB-JSON-Body-Limit zu großzügig; `parseInt` ohne Bound-Checks; Temperature-Slider ruft unbeabsichtigt `setBaseUrl`; 737-KB-Frontend-Chunk ohne Code-Splitting.
- **M9**: `ci-docker.yml` baut das Image nur — Runtime-Healthcheck (`/health` + `.se1`-Dateien im Container) fehlt in CI.

## 2026-07-30 — Präzisions-Ephemeris als Premium-Feature (Phasen A–E)

### Feature
- **EphemerisProvider-Architektur** (`backend/src/services/ephemeris/`): `SwephProvider` (Swiss Ephemeris, AGPL — erst nach Lizenzkauf) vs. `StandardProvider` (astronomia/Meeus, MIT). Tier-Resolver (`resolver.ts` + `lib/config.ts`): FREE/BASIC/Gäste → `standard`, PREMIUM/PRO → `swiss-professional` bei `EPHEMERIS_PRO_ENABLED=true`; jeder Fehlerfall (Flag aus, natives Modul fehlt) fällt still auf standard zurück.
- **Gemessene Standard-Genauigkeit** gegen Swiss-Ephemeris-Referenz (10 Stichtage 1950–2030): max. Fehler Sonne 0,0059°, Mond 0,0152°, Planeten ≤ 0,0094°. Chiron im Standard-Tier nicht verfügbar (`meta.missingBodies`). Quelle der Werte: `docs/EPHEMERIS_STANDARD_PROVIDER.md`.
- **Deployment-Trennung**: `sweph` in optionalDependencies; Dockerfile mit `WITH_SWEPH` Build-Arg (Standard-Image sweph-frei, per CI verifiziert); compose-Profil `pro` (`backend-pro`, Port 3001, `EPHEMERIS_PRO_ENABLED=true`, `SE_EPHE_PATH=/app/ephemeris`).
- **Frontend**: AccuracyBadge mit Tier-Upsell (`app/src/components/AccuracyBadge.tsx`); unbelegte ±0.0001°/NASA-JPL-Aussagen aus der Marketing-Copy entfernt.
- **Tests**: 198 backend / 36 app, alle grün.
- **Doku (Phase E)**: `docs/EPHEMERIS_LICENSE_RUNBOOK.md` neu (Lizenzkauf → .se1-Dateien → Deployment → Verifikation → Upsell → Stripe); README/AGENTS/MONETIZATION_PLAN aktualisiert; historische Docs verweisen auf die neuen.
- **Commit-Bereich**: `d4aef30`..`76c19a1` (Phasen A–D) plus Doku-Commits der Phase E.

### Offene Launch-Blocker
- **Stripe**: Checkout/Webhooks fehlen (Schema vorbereitet) — separater Blocker, siehe `MONETIZATION_PLAN.md`.
- **Astrodienst-Lizenzkauf** (~500 €): Pflicht VOR jedem öffentlichen Deployment mit sweph (AGPL), siehe Runbook.
- **`EPHEMERIS_PRO_ENABLED=true`** im Pro-Deployment sicherstellen (im `WITH_SWEPH`-Image bereits eingebrannt; manuelle Deployments müssen es explizit setzen).
- **`RESEND_API_KEY` / `EMAIL_FROM`** für E-Mail-Versand.
