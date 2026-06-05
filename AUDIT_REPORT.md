# BUXE_OS v24.1 -- AUDIT REPORT
# Synthesis Engine — Production Readiness Audit

> Audit-Datum: 2026-06-05
> Auditor: BUXE Agentic Mode
> Scope: Full-Stack (React/Vite Frontend, Express Backend, Rust/Tauri Core, Prisma/PostgreSQL)

---

## 1. ZUSAMMENFASSUNG

**Status:** Das Projekt ist funktional als Prototyp/MVP, aber **NICHT production-ready**. Es existieren mehrere kritische Bugs, die beim Build oder zur Laufzeit crashen, Datenschutz-Verletzungen gegenüber der eigenen Architektur-Spezifikation, und fehlende Infrastruktur für Production-Deployment.

| Kategorie | Score (1-10) | Bewertung |
|-----------|-------------|-----------|
| Stabilität | 4 | Kritische Runtime/Compile-Fehler vorhanden |
| Sicherheit | 5 | Auth solide, aber Datenschutz- und XSS-Lücken |
| Genauigkeit (Berechnungen) | 6 | Swiss Ephemeris vorhanden, aber inkomplett verdrahtet |
| Testabdeckung | 4 | Tests existieren, decken aber nicht die kritischen Pfade ab |
| Deployment | 3 | Docker-Setup für Dev, nicht Production |
| Monitoring/Observability | 2 | Kein Logging, Metrics, Health Checks |

---

## 2. KRITISCHE FEHLER (HIGH — Blocker für Production)

### 2.1 Backend Compile/Runtime-Fehler

| # | Datei | Zeile | Problem | Impact |
|---|-------|-------|---------|--------|
| H1 | `backend/src/routes/auth.ts` | 283-301 | `prisma` wird verwendet, aber **nicht importiert** in `/verify-email` Route | Route crasht mit `ReferenceError` |
| H2 | `backend/src/routes/ai.ts` | 4 | `requirePremium` wird importiert, existiert aber **nicht** in `middleware/auth.ts` | Build-Fehler oder Runtime-Crash |
| H3 | `backend/src/routes/synthesis.ts` | 35 | `requireTier(['SOUL_SYNC_PREMIUM', 'PRO'])` — Tier-Name `SOUL_SYNC_PREMIUM` existiert **nicht** im Prisma-Enum | Jeder Synthese-Request wird mit 403 abgelehnt |
| H4 | `backend/src/routes/coaching.ts` | 10 | Gleiches Problem: `SOUL_SYNC_PREMIUM` ist kein gültiger Tier-Name | Coaching für niemanden verfügbar |
| H5 | `backend/src/routes/transit.ts` | 156 | Variablen `y` und `m` sind **nicht definiert** in `/moon-phases` | Route crasht bei jedem Aufruf |

**Root Cause:** Diese Fehler entstanden durch inkonsistente Refactoring-Schritte. Die Tier-Namen wurden im Prisma-Schema auf `FREE, BASIC, PREMIUM, PRO` festgelegt, aber in den Routes wurde ein alter Produktname (`SOUL_SYNC_PREMIUM`) verwendet.

### 2.2 Datenschutz & Architektur-Verletzungen

| # | Datei | Problem | Impact |
|---|-------|---------|--------|
| H6 | `app/src/lib/api.ts` | `api.calculateHD()` sendet **vollständige Geburtsdaten** (Datum, Uhrzeit, Koordinaten) an das Backend | Verstößt explizit gegen `AGENTS.md` Regel: *"Geburtsdaten dürfen NIE an externe APIs gesendet werden"* |
| H7 | `app/vite.config.ts` | `kimi-plugin-inspect-react` ist im Production-Build aktiv | Debugging-Plugin leakt interne React-Strukturen; Performance-Impact |
| H8 | `app/src-tauri/tauri.conf.json` | CSP erlaubt `unsafe-inline` für Scripts | Notwendig für React, aber nicht ideal für Desktop-Security |

### 2.3 Berechnungs-Genauigkeit (Human Design)

| # | Datei | Problem | Impact |
|---|-------|---------|--------|
| H9 | `app/src-tauri/src/human_design.rs` | **Erde (EARTH)** wird nie berechnet oder zu `gates` hinzugefügt | `earth_gate_info.find(|g| g.planet == "EARTH")` gibt `None` → `panic` oder falsches Profil |
| H10 | `backend/src/routes/humanDesign.ts` | Gleiches Problem: `EARTH` Planet wird nie berechnet | `earthGate` ist `undefined` → Profil und Inkarnationskreuz sind falsch |
| H11 | `backend/src/services/ephemeris.ts` | Design-Offset ist **fix 88 Tage** statt iterativ berechnet (88° vor Geburts-Sonne) | Design-Positionen sind ungenau; falsche Gates möglich |
| H12 | `backend/src/routes/humanDesign.ts` | Variablen-Berechnung ist **hartkodiert/stubbed** (z.B. `digestion: moonGate.number <= 16 ? 'COLD' : 'HOT'`) | PHS-Variablen (Primary Health System) sind nicht korrekt |

### 2.4 Auth & Security Bugs

| # | Datei | Problem | Impact |
|---|-------|---------|--------|
| H13 | `backend/src/middleware/auth.ts` | `optionalAuth` gibt **401** zurück, wenn ein abgelaufener Token übermittelt wird | Ein authentifizierter Nutzer mit abgelaufenem Token kann nicht mal anonym browsen; er wird hart ausgesperrt |
| H14 | `backend/src/routes/ai.ts` | `X-AI-API-Key` Header wird vom Frontend übernommen und durch das Backend geleitet | API-Keys werden potenziell in Logs gespeichert; Backend sollte Keys selbst verwalten |
| H15 | `backend/src/routes/synthesis.ts` | Kein **per-User Rate Limiting** für OpenAI-Calls | Teure API-Calls ohne Schutz vor Abuse |

---

## 3. MITTELERE FEHLER (MEDIUM — Sollte vor Release gefixt werden)

### 3.1 Infrastruktur & Deployment

| # | Datei | Problem | Impact |
|---|-------|---------|--------|
| M1 | `docker-compose.yml` | `command: npm run dev` — Backend läuft mit `ts-node-dev`, nicht dem gebauten Code | Nicht production-tauglich; Hot-Reload im Container |
| M2 | `backend/Dockerfile` | Keine Multi-Stage Build; `USER node` ohne garantierte Berechtigungen für Ephemeris-Dateien | Dateizugriffsfehler möglich; Container-Image ist unnötig groß |
| M3 | `backend/src/index.ts` | Kein **graceful shutdown** (SIGTERM/SIGINT Handler) | Prisma-Verbindungen werden nicht ordentlich geschlossen; Datenverlust möglich |
| M4 | `backend/src/index.ts` | `/health` prüft nicht Datenbank-Erreichbarkeit | Load Balancer denkt, der Service ist healthy, obwohl DB down ist |
| M5 | `backend/src/index.ts` | Keine **Compression Middleware** (`compression`) | Größere Response-Sizes, schlechtere Performance |

### 3.2 TypeScript & Type-Safety

| # | Datei | Problem | Impact |
|---|-------|---------|--------|
| M6 | `backend/src/routes/auth.ts` | Mehrere `any` Types (z.B. `user.roles.map((ur: any) => ur.role.name)`) | Verlust von Type-Safety; Refactoring ist gefährlich |
| M7 | `app/src/stores/authStore.ts` | `User` Interface hat kein `name` Feld, aber `App.tsx` verwendet `user?.name` | TypeScript-Fehler im Strict Mode; UI zeigt `undefined` |
| M8 | `app/package.json` | `zod` Version **4.3.5**, Backend hat `zod` **3.22.4** | API-Schemas könnten inkompatibel sein; unterschiedliche Validation-Verhalten |
| M9 | `backend/package.json` | `@prisma/client` **5.6.0**, aber `prisma` **5.22.0** | Versions-Mismatch kann zu Runtime-Fehlern führen |

### 3.3 Fehlende Features für Production

| # | Problem | Impact |
|---|---------|--------|
| M10 | **Kein E-Mail-Versand** — Passwort-Reset und E-Mail-Verifizierung erstellen Tokens, aber senden keine E-Mails | Nutzer können Passwort nicht zurücksetzen; Verifizierung ist nutzlos |
| M11 | **Coaching-Impulse sind hartkodiert** — `coaching.ts` speichert statischen Text in der DB | Keine Personalisierung; Feature ist wertlos für Nutzer |
| M12 | **Kein Stripe-Integration** — Subscription-Felder existieren im Schema, aber keine Payment-Logik | Monetarisierung nicht möglich |
| M13 | **Keine API-Versionierung** — `/api/...` ohne Versionsnummer | Breaking Changes sind schwer zu deployen |
| M14 | **Keine strukturierte Request-Logging** — Kein Morgan, Pino oder Winston | Debugging in Production nahezu unmöglich |
| M15 | **Keine Request-/Trace-IDs** — Keine Korrelation von Frontend-Requests zu Backend-Logs | Distributed Tracing nicht möglich |

### 3.4 Performance

| # | Datei | Problem | Impact |
|---|-------|---------|--------|
| M16 | `app/src/App.tsx` | Kein **Code-Splitting** / Lazy Loading | Gesamte App wird als ein Bundle geladen; schlechte Initial-Load-Time |
| M17 | `app/src/lib/api.ts` | Geocoding direkt an OpenStreetMap Nominatim vom Frontend | CORS-Probleme; Rate-Limiting trifft direkt den Nutzer; keine Proxy-Logik |
| M18 | `app/src/lib/api.ts` | Timezone-Lookup direkt an `timeapi.io` | Externe Abhängigkeit ohne Fallback-Strategie |

---

## 4. NIEDRIGE FEHLER (LOW — Kosmetisch oder Code Smell)

| # | Datei | Problem |
|---|-------|---------|
| L1 | `app/src/App.tsx` | `SettingsPlaceholder` statt `SettingsSection` verwendet |
| L2 | `app/src/stores/authStore.ts` | `features` Feld im State wird nie gesetzt oder verwendet |
| L3 | `app/src/stores/authStore.ts` | `hasPermission` ist ein Stub (prüft nur auf Admin-Rolle) |
| L4 | `backend/src/routes/humanDesign.ts` | `saveHDSchema` verwendet `as any` für Prisma Enums |
| L5 | `backend/src/services/auth.ts` | `accessToken.slice(-32)` als Session-Token gespeichert — nur ein Teil des Tokens |
| L6 | `backend/src/services/auth.ts` | `refreshToken` wird als `uuidv4()` generiert — könnte kryptographisch stärker sein |
| L7 | `backend/src/index.ts` | CORS Origins sind hardcoded; sollten via Env-Var konfigurierbar sein |
| L8 | `backend/prisma/schema.prisma` | `SynthesisCache.expiresAt` ist optional (`DateTime?`) — Caches können unendlich gültig bleiben |
| L9 | `app/src/components/auth/ProtectedRoute.tsx` | `hasTier` wird mit unsicherem Type-Cast aufgerufen |
| L10 | `backend/src/routes/coaching.ts` | `/history` Endpunkt hat kein `limit` Max-Cap (nur Parsing aus Query) |

---

## 5. SICHERHEITSBEWERTUNG

### Was gut ist
- JWT mit Access + Refresh Tokens (15min / 7 Tage)
- httpOnly Cookies für Refresh Tokens
- bcryptjs mit 12 Salt Rounds
- RBAC-System mit Rollen und Permissions
- Audit-Logging für sicherheitsrelevante Aktionen
- Zod-Validierung an API-Endpunkten
- Rate Limiting (generell und Auth-spezifisch)
- AES-256-GCM für lokale Journal-Verschlüsselung
- OS Keychain Integration für Key-Management

### Was schlecht ist
- **Geburtsdaten** werden an das Backend gesendet (Verstoß gegen eigene Policy)
- `optionalAuth` sperrt bei abgelaufenem Token aus (DoS auf eigene Nutzer)
- Kein API-Key-Management im Backend (Keys werden vom Frontend durchgereicht)
- Keine per-User Rate Limits für teure OpenAI-Calls
- Kein Request-Logging für Abuse-Detection
- Keine Input-Sanitierung über Zod hinaus

---

## 6. TESTBEWERTUNG

### Vorhandene Tests
- `app/src/lib/calculations.test.ts` — Frontend Unit Tests (Vitest)
- `app/src/lib/tauri.test.ts` — Tauri Abstraktion Tests
- `app/src/stores/aiConfigStore.test.ts` — Store-Sicherheit Tests
- `app/src/stores/authStore.test.ts` — Auth Store Tests
- `backend/src/tests/ephemeris.test.ts` — Swiss Ephemeris Genauigkeitstests
- `app/src-tauri/src/storage.rs` — Rust Tests (AES Encryption)
- `app/src-tauri/src/human_design.rs` — Rust Tests (HD Berechnungen)
- `app/src-tauri/src/ephemeris.rs` — Rust Tests (Planetenpositionen)

### Fehlende Tests
- **Auth API Tests** — Keine Tests für Login/Register/Refresh/Logout
- **HD API Tests** — Keine Tests für `/api/hd/calculate`
- **Synthesis API Tests** — Keine Tests für OpenAI-Integration
- **Transit API Tests** — Keine Tests für Transit-Berechnungen
- **E2E Tests** — Keine Playwright/Cypress Tests
- **Load Tests** — Keine Performance-/Stress-Tests
- **Security Tests** — Keine Penetration-Test-Scenarios

---

## 7. BERECHNUNGS-GENAUIGKEIT

### Aktueller Status
| Modul | Status | Bemerkung |
|-------|--------|-----------|
| Swiss Ephemeris (Rust) | Gut | Professionelle FFI-Integration; iterative Design-Berechnung korrekt |
| Swiss Ephemeris (Node) | Mangelhaft | Fixer 88-Tage-Offset; keine Erde-Berechnung |
| Numerologie | Gut | Dan Millman Algorithmus scheint korrekt implementiert |
| Variables (PHS) | Schlecht | Hartkodierte Stub-Werte im Backend |
| Transit | Mittel | Funktional, aber nicht gegen Referenzdaten validiert |

### Referenz-Validierung
- **Ra Uru Hu Chart** (28.04.1948, 08:14 EST, Montreal) — Rust-Test vorhanden, aber wird nicht automatisch in CI ausgeführt
- **JPL Horizons Vergleich** — Teilweise implementiert, aber keine automatisierte Regression
- **MyBodyGraph Vergleich** — Nicht implementiert

---

## 8. EMPFEHLUNG (Priorisiert)

### Phase A: Stop-the-Bleed (Sofort)
1. Fix Backend Compile/Runtime-Fehler (H1-H5)
2. EARTH-Planet in HD-Berechnungen hinzufügen (H9-H10)
3. `optionalAuth` Bug fixen (H13)

### Phase B: Architektur (Woche 1)
4. Geburtsdaten-Verarbeitung ins Frontend verschieben (H6)
5. `kimi-plugin-inspect-react` aus Production entfernen (H7)
6. Design-Offset iterativ berechnen (H11)
7. Graceful Shutdown + Health Checks implementieren (M3-M4)

### Phase C: Production-Härtung (Woche 2)
8. Docker Multi-Stage Build + Production Compose (M1-M2)
9. E-Mail-Service integrieren (M10)
10. Per-User Rate Limiting + API-Key-Management (H14-H15)
11. Strukturiertes Logging + Monitoring (M14-M15)

### Phase D: Qualität (Woche 3)
12. E2E Tests mit Playwright
13. API Integration Tests mit Supertest
14. Performance-Monitoring einbauen
15. Dokumentation aktualisieren

---

> Ende des Audit Reports. Der detaillierte Umsetzungsplan folgt in `PRODUCTION_READY_PLAN.md`.
