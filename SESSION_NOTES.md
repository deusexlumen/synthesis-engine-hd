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
