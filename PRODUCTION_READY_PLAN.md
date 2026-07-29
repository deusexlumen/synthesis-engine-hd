# BUXE_OS v24.X — PRODUCTION READY PLAN (Revision 2026-07-07)
# Synthesis Engine — Von "technisch fertig, aber unsichtbar" zu Production

> Basierend auf `AUDIT_REPORT_2026-07-07.md`
> Ersetzt den Plan vom 2026-06-05 (dessen Phase A–D größtenteils umgesetzt wurde — siehe Abschnitt 0)
> Zeitrahmen: ~2 Wochen (1 Entwickler Vollzeit)
> Reihenfolge: 0 → 1 → 2 → 3 → 4 (nicht überspringen — Phase 0 macht das Produkt erst benutzbar)

---

## 0. STATUS DES ALTEN PLANS (2026-06-05)

Bereits umgesetzt und verifiziert: Backend-Compile-Fixes, EARTH-Gate-Berechnung, iterativer Design-Offset, Docker Multi-Stage-Build, Graceful Shutdown, `/health` mit DB-Check, Pino-Logging, Per-User-Rate-Limiting, SSRF-Guard, PrismaClient-Singleton, JWT-Secret-Härtung, CI-Workflows für Backend/Frontend/Docker.

Zwischenzeitlich passiert, aber nicht im alten Plan: **vollständige Entfernung von Tauri/Desktop** — das Backend berechnet Human-Design-Charts jetzt selbst (`humanDesignCalculator.ts`). Das macht Teile des alten Plans (B1: "Berechnungen lokal im Browser/Rust") obsolet — Web-Ansatz ist jetzt gesetzt, nicht mehr Desktop-first.

Noch offen aus dem alten Plan: E-Mail-Service (C3), einige Härtungspunkte. Diese sind unten in Phase 1 übernommen.

---

## PHASE 0: SHIP-BLOCKER (1–2 Tage)

Ohne diese Phase ist die App für echte Nutzer im Wesentlichen ein Onboarding-Flow + ein Chart-Screen. Alles andere ist gebaut, aber unsichtbar.

### 0.1 Journal, Gene Keys, Transit, Settings wieder anschließen

**Problem:** `app/src/App.tsx` importiert nur `OnboardingFlow`, `ProcessingAnimation`, `ResultsDashboard`, `AISettings`. `ResultsDashboard.tsx` kennt nur die Tabs `overview/bodygraph/numerology/details/coaching`. `JournalSection`, `GeneKeysSection`, `TransitSection`, `SettingsSection` existieren, sind aktuell überarbeitet und kompilierbar — aber unerreichbar.

**Vorgehen:**
1. In `ResultsDashboard.tsx` die Tab-Liste um `gene-keys`, `transit`, `journal` erweitern und die jeweilige Section rendern (Pattern wie bei `AICoaching` im `coaching`-Tab).
2. In `App.tsx` den `'settings'`-Case von der inline definierten `SettingsPlaceholder()` (Zeilen ~297–407) auf das echte `<SettingsSection />` umstellen. `SettingsPlaceholder` danach löschen, nicht auskommentieren.
3. Nach dem Verdrahten: jede Section einmal im Browser öffnen (Dev-Server) und auf Runtime-Fehler prüfen — die Dateien wurden zwar für sich überarbeitet, aber nie im vollen App-Kontext getestet.
4. **Vorsicht bei M6/M7 aus dem Audit:** Beim Reconnect von `SettingsSection.tsx` (`exportData()`) und `JournalSection.tsx` (irreführender "AES-256-GCM"-Text) diese zwei Stellen gleich mitfixen, sonst werden sie beim Reconnect live und aktiv falsch/unsicher:
   - `SettingsSection.tsx` `exportData()`: `aiConfig.apiKey` aus dem Export-Payload entfernen.
   - `JournalSection.tsx:98`: Text "AES-256-GCM Verschlüsselung" entfernen oder durch ehrliche Aussage ersetzen ("Lokal in diesem Browser gespeichert, nicht verschlüsselt" — passend zu dem, was `JournalEditor`/`JournalList` tatsächlich tun).
5. `app/tsconfig.app.json`: `noUnusedLocals`/`noUnusedParameters` auf `true` setzen, damit ein zukünftiger "fertig, aber nie verdrahtet"-Fall beim Build auffällt statt erst bei einem manuellen Audit.

### 0.2 Bugfix: PHS-Variable "Style" ist für jeden Chart falsch

**Datei:** `backend/src/services/humanDesignCalculator.ts:280`

```typescript
// ALT:
const northNode = gates.find((g) => g.planet === 'MEAN_NODE');

// NEU: planetsToGates() kanonisiert MEAN_NODE bereits zu NORTH_NODE (Zeile 121)
const northNode = gates.find((g) => g.planet === 'NORTH_NODE');
```

Danach einen Regressionstest ergänzen, der `calculateHumanDesignChart()` end-to-end mit einem bekannten Geburtsdatum aufruft und `variables.style` gegen einen erwarteten Wert prüft (bisherige Tests decken nur die reinen Center-Helferfunktionen ab, nicht die Hauptfunktion — deshalb ist der Bug durchgerutscht).

### 0.3 CI grün bekommen

`pnpm lint` in `app/` liefert aktuell 69 Fehler. Mechanisch abarbeiten (ungenutzte Variablen, `prefer-const`, `no-explicit-any`, zwei `set-state-in-effect`-Verstöße). Kein Architektur-Thema, aber blockiert jede PR-Validierung, bis es erledigt ist.

### 0.4 Falsche Sicherheitsaussage + deaktivierte Schutz-Tests

- `app/src/sections/AISettings.tsx:362`: Text von "wird verschlüsselt auf deinem Gerät gespeichert" auf "wird nur für diese Sitzung im Speicher gehalten" ändern (passend zum tatsächlichen `partialize`-Verhalten).
- `app/src/stores/aiConfigStore.test.ts:23`, `app/src/stores/authStore.test.ts:27`: `.skip` entfernen. Falls das ursprüngliche Timing-Problem (Zustand-persist-Flush) weiterhin besteht, direkt gegen `localStorage.getItem('synthesis-ai-config')` nach einem synchronen `useAiConfigStore.persist.rehydrate()`-Aufruf prüfen statt auf einen Async-Flush zu warten.

### 0.5 Docker-Dev-Setup fixen

**Datei:** `docker-compose.dev.yml:47-48`

```yaml
# ALT:
JWT_ACCESS_SECRET: dev-access-secret-min-32-chars-long
JWT_REFRESH_SECRET: dev-refresh-secret-min-32-chars-long

# NEU (auth.ts liest JWT_SECRET, nicht JWT_ACCESS_SECRET):
JWT_SECRET: dev-access-secret-min-32-chars-long
JWT_REFRESH_SECRET: dev-refresh-secret-min-32-chars-long
```

---

## PHASE 1: VERTRAUEN & SICHERHEIT (3–5 Tage)

### 1.1 Coaching-Feature auf echte Daten umstellen

**Datei:** `backend/src/routes/coaching.ts:26-37` — `calculateDailyTransit()` aus `services/ephemeris.ts` (bereits in `transit.ts` verwendet) statt der hartkodierten `{ sunGate: 1, moonGate: 2 }` nutzen. Für `impulseText`: kurzfristig ein kuratierter, transit-abhängiger Textpool (z.B. nach Sonnen-Gate indiziert); mittelfristig echte AI-Synthese wie in `synthesis.ts`.

### 1.2 E-Mail-Service integrieren

Wie im Vorgänger-Plan (C3) skizziert: `nodemailer` oder ein transaktionaler Anbieter (Resend/Postmark) für Passwort-Reset und E-Mail-Verifizierung. Ohne das sind zwei Kern-Auth-Flows tote Enden.

### 1.3 Frontend auf den bestehenden AI-Backend-Proxy umstellen

`app/src/sections/AICoaching.tsx` und `AISettings.tsx` rufen aktuell OpenAI/Anthropic/Google direkt aus dem Browser auf (inkl. `anthropic-dangerous-direct-browser-access: true`, was Anthropics eigenen Schutz aktiv umgeht). `backend/src/routes/ai.ts` (`POST /api/ai/proxy`) existiert bereits, mit Auth, Tier-Gate und SSRF-Schutz für Custom-Provider. Frontend-Calls auf diesen Endpunkt umstellen; direkte Provider-Calls aus dem Browser entfernen.

### 1.4 Reset-/Verify-Token hashen statt Klartext speichern

**Datei:** `backend/prisma/schema.prisma` (`passwordResetToken`, `emailVerifyToken` auf `User`) + `backend/src/services/auth.ts`. Nur `sha256(token)` in der DB ablegen, den Klartext-Token nur einmalig per E-Mail versenden, beim Verify/Reset hashen und vergleichen.

### 1.5 Dependency-Vulnerabilities fixen

```bash
cd backend && pnpm audit
# form-data (high) -> über openai-Upgrade oder direktes pnpm overrides auf >=4.0.6 lösen
cd ../app && pnpm audit
# dompurify (moderate, via jspdf) prüfen ob Upgrade verfügbar
```

### 1.6 Doppelte Lockfiles entfernen

`backend/package-lock.json` löschen (pnpm ist die tatsächlich genutzte CI-Toolchain). Gleiches in `app/` prüfen.

### 1.7 Dokumentation an die Web-only-Architektur anpassen

`README.md`, `AGENTS.md`, `PROJECT_OVERVIEW.md`: alle Tauri-Referenzen und die jetzt falsche Aussage "Geburtsdaten verlassen das Gerät nie" entfernen/korrigieren. Falls diese Aussage in einer öffentlichen Datenschutzerklärung existiert, dort ebenfalls korrigieren — das ist keine Doku-Kosmetik, sondern eine sachliche Zusicherung mit DSGVO-Relevanz.

---

## PHASE 2: QUALITÄTSSICHERUNG (3–4 Tage)

### 2.1 Backend-Integrationstests

Kein `supertest` vorhanden; keine Route ist end-to-end getestet. Mindestens:
- `auth.test.ts`: Register/Login/Refresh/Logout, inkl. Tier-Gates und abgelaufene/ungültige Tokens.
- `humanDesign.test.ts`: `/calculate` mit gültigen/ungültigen Geburtsdaten, `calculateHumanDesignChart()` end-to-end gegen mind. eine Referenz-Geburtszeit (z.B. Ra Uru Hu Chart, war in den Rust-Tests vorhanden — als Portierungs-Referenz nutzen).
- `ai.ts`: SSRF-Guard tatsächlich mit einem Hostname testen, der zu `169.254.169.254` auflöst (aktuell nur Denylist/Literal-IP getestet, nicht der DNS-Resolution-Pfad — `dns.promises.lookup` dafür mocken).

### 2.2 E2E-Test für den kompletten Nutzerpfad

Playwright-Test, der Onboarding → Chart-Anzeige → **Journal-Eintrag anlegen → Gene Keys öffnen → Transit öffnen → Settings ändern** abdeckt — genau die Pfade, die durch Phase 0.1 überhaupt erst wieder erreichbar werden. Dieser Test hätte K1 sofort auffangen müssen und sollte ihn künftig verhindern.

### 2.3 CI um einen Docker-Runtime-Check erweitern

`ci-docker.yml` baut das Image aktuell nur (`push: false`), startet es nie. Ergänzen: Container starten, `curl localhost:3000/health` erwarten `200`, prüfen dass die `.se1`-Ephemeris-Dateien im Image vorhanden sind.

---

## PHASE 3: HÄRTUNG & COMPLIANCE (2–3 Tage)

- `errorHandler.ts`: `err.message`-Leak nur bei `NODE_ENV === 'production'` unterdrücken → auf Allowlist umstellen (nur in `development`/`test` leaken, sonst nie).
- `traceId.ts`: eingehenden `X-Trace-Id`-Header validieren (Format/Länge) statt blind zu übernehmen.
- Dedizierter, engerer Rate-Limiter für `/api/hd/calculate` (CPU-intensivster Endpunkt, teilt sich aktuell den generischen 100/min-Limiter).
- `login()`-Timing-Seitenkanal: konstante Mindestlaufzeit (z.B. immer ein Dummy-`bcrypt.compare` bei nicht-existierender E-Mail) gegen E-Mail-Enumeration.
- Fein-granulares RBAC (`requirePermission`, `requireOwnership`, `Permission`/`RolePermission`-Tabellen) entweder tatsächlich an mindestens einem sensiblen Endpunkt verwenden oder als YAGNI entfernen — aktuell reine Dekoration, die falsche Sicherheit suggeriert.
- Totes `TransitData`-Prisma-Modell entweder für Caching nutzen oder aus dem Schema entfernen.
- **AGPL-Lizenzfrage für Swiss Ephemeris (`sweph`) klären** — rechtliches, kein Code-Ticket, aber ein echter Blocker für kommerzielle Closed-Source-Nutzung. Vor Monetarisierungsstart mit Astrodienst klären (~500€ kommerzielle Lizenz laut eigener Doku).

---

## PHASE 4: DEPLOYMENT & RELEASE

### 4.1 Pre-Deployment-Checkliste

- [ ] Alle Phase-0-Punkte umgesetzt (App ist für Nutzer vollständig, nicht nur teilweise erreichbar)
- [ ] CI grün (Lint + Test + Build, Frontend und Backend)
- [ ] `pnpm audit` sauber oder Findings bewusst akzeptiert
- [ ] E-Mail-Service konfiguriert und gegen echten Posteingang getestet
- [ ] AGPL-Lizenzfrage geklärt (kommerzielle Lizenz erworben oder Open-Source-Verpflichtung akzeptiert)
- [ ] Doku (README/AGENTS/PROJECT_OVERVIEW) beschreibt die tatsächliche Architektur
- [ ] E2E-Test für den vollständigen Nutzerpfad läuft grün
- [ ] Environment-Variablen-Checkliste aus dem Vorgänger-Plan (Abschnitt E1, weiterhin gültig) abgehakt

### 4.2 Rollout-Reihenfolge

Empfehlung: Phase 0 zuerst und isoliert deployen/testen (macht das bereits gebaute Feature-Set nutzbar, ohne neue Abhängigkeiten). Phase 1 vor jedem Marketing-Push (Coaching-Fake und fehlender E-Mail-Versand sind beides Dinge, die bei echten zahlenden Nutzern sofort auffallen). Phase 2–3 können parallel zum Soft-Launch laufen.

---

> Ende des Plans. Bei Rückfragen zu einzelnen Punkten: siehe Referenzen auf Datei:Zeile im zugehörigen `AUDIT_REPORT_2026-07-07.md`.
