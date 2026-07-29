# Holistischer Audit-Report — Synthesis Engine
**Datum:** 2026-07-07
**Scope:** Full-Stack-Web-Anwendung (React/Vite Frontend, Node.js/Express Backend, Prisma/PostgreSQL) — **nach vollständigem Pivot weg von Tauri/Desktop**
**Auditor:** Claude Code (3 parallele Audit-Agenten + manuelle Verifikation der kritischsten Befunde)
**Basis:** Aktueller Working-Tree-Stand (uncommitted), verglichen gegen `AUDIT_REPORT_2026-05-20.md` und `AUDIT_REPORT.md` (2026-06-05)

---

## 0. Was sich seit dem letzten Audit geändert hat

Der komplette `app/src-tauri`-Ordner (Rust-Core, Swiss-Ephemeris-FFI, OS-Keychain, lokale AES-256-Verschlüsselung) wurde aus dem Working Tree entfernt. Human-Design-Berechnungen laufen jetzt ausschließlich im Node-Backend (`backend/src/services/humanDesignCalculator.ts`, `hdConstants.ts`). Das ist ein **fundamentaler Architektur-Wechsel**: die frühere Datenschutz-Kernaussage "Geburtsdaten verlassen das Gerät nie" gilt nicht mehr — sie war ohnehin schon in früheren Audits als teilweise verletzt markiert, ist jetzt aber strukturell nicht mehr haltbar.

Positiv: Die Migration der reinen Rechenlogik ist sauber und mit ehrlichen Kommentaren zu bekannten Grenzen versehen (z.B. Inkarnationskreuz-Platzhalter statt erfundener Daten, DNS-Rebinding-Hinweis im SSRF-Guard). Viele P0-Findings aus den beiden Vorgänger-Audits sind tatsächlich behoben (siehe Abschnitt 6).

Negativ: Der Pivot ist **nicht zu Ende geführt worden**. Mehrere große UI-Bereiche wurden im Detail überarbeitet, aber nie wieder an die App angeschlossen — sie sind im Code vorhanden, kompilieren, werden aber nirgends gerendert. Das ist der schwerwiegendste Einzelbefund dieses Audits.

---

## 1. ZUSAMMENFASSUNG

| Kategorie | Score (1–10) | Bewertung |
|-----------|-------------|-----------|
| Funktionsumfang (erreichbar für Nutzer) | 3 | Journal, Gene Keys, Transits, echtes Settings-Panel sind aus der UI nicht erreichbar |
| Stabilität | 6 | Backend robust; Frontend-Lint/CI bricht; ein Dev-Docker-Setup crasht beim Start |
| Sicherheit | 5 | Solides Auth/JWT/SSRF/RBAC-Fundament, aber eine live falsche Sicherheitsaussage + deaktivierte Schutz-Tests |
| Berechnungs-Genauigkeit | 7 | EARTH/Design-Offset korrekt; ein stiller Bug bei einer PHS-Variable betrifft *jeden* Chart |
| Testabdeckung | 4 | Gute Unit-Tests für Helferfunktionen, keine Integrationstests, zwei sicherheitskritische Suiten sind `.skip`'d |
| Deployment/CI | 4 | Docker ist produktionsreif gebaut, aber CI (Frontend-Lint) ist aktuell rot |
| Monetarisierung/Kern-Features | 3 | Coaching-Feature ist für zahlende Nutzer komplett hartkodiert/wertlos |

**Gesamturteil:** Das Projekt ist technisch näher an Produktionsreife als in den Vorgänger-Audits, aber es kann in seinem aktuellen Zustand **nicht ausgeliefert werden** — nicht wegen Sicherheitslücken primär, sondern weil zentrale, bereits gebaute Features (Journal, Gene Keys, Transits, vollständige Settings) für echte Nutzer schlicht unsichtbar sind, und ein bezahltes Feature (Coaching) Fake-Inhalte liefert.

---

## 2. KRITISCHE BEFUNDE (CRITICAL — Release-Blocker)

### K1. Vier fertige UI-Sections sind aus der App nicht erreichbar
- **Dateien:** `app/src/App.tsx`, `app/src/sections/ResultsDashboard.tsx`
- **Befund:** `App.tsx` importiert nur `OnboardingFlow`, `ProcessingAnimation`, `ResultsDashboard`, `AISettings`. `ResultsDashboard.tsx` verdrahtet nur die Tabs `overview`, `bodygraph`, `numerology`, `details`, `coaching`. **`JournalSection.tsx`, `GeneKeysSection.tsx`, `TransitSection.tsx` und das 690-Zeilen-`SettingsSection.tsx` werden nirgends importiert** — verifiziert per Grep über den gesamten `app/src`-Baum. Der `'settings'`-Tab in `App.tsx` rendert stattdessen eine separat definierte `SettingsPlaceholder()`-Funktion (Zeilen 297–407) mit nur Profil-Karte, Logout und Backend-Health-Check.
- **Impact:** Nutzer können **keine Journal-Einträge anlegen oder ansehen**, keine eigenständige Gene-Keys- oder Transit-Seite öffnen, und haben kein funktionierendes Settings-Panel (Appearance/Privacy/Data-Export fehlen komplett). Gleichzeitig wurden genau diese vier Dateien im aktuellen Diff bewusst überarbeitet (Tauri-Referenzen entfernt, Zustand-Store-Anbindung korrigiert) — die Arbeit ist vorhanden, aber nutzlos, solange sie nicht verdrahtet ist.
- **Fix:** Tabs/Routen in `ResultsDashboard.tsx` bzw. `App.tsx` für Journal, Gene Keys, Transit ergänzen; `SettingsPlaceholder` durch echtes `SettingsSection` ersetzen (bereits in AUDIT_REPORT.md vom 2026-06-05 als L1 vermerkt — offenbar nie behoben, nur weiter dran gearbeitet).

### K2. Falsche Sicherheitsaussage zur API-Key-Speicherung (live, nutzerseitig sichtbar)
- **Datei:** `app/src/sections/AISettings.tsx:362`
- **Befund:** UI-Text: *"Dein API-Key wird verschlüsselt auf deinem Gerät gespeichert."* Tatsächlich zeigt `aiConfigStore.ts:75-82` (`partialize`), dass der API-Key **überhaupt nicht persistiert** wird (Kommentar im Code: *"NEVER persist API keys to localStorage (XSS risk)"*) — er ist nur im Memory und geht bei jedem Reload verloren. `AISettings` wird über `App.tsx:9,183` aktiv im "KI"-Tab gerendert, ist also live für jeden Nutzer sichtbar.
- **Impact:** Nutzer verlassen sich auf eine falsche Sicherheitszusage; zusätzlich verwirrend, weil der Key entgegen der Erwartung bei jedem Reload neu eingegeben werden muss.
- **Fix:** Text korrigieren ("wird nur für diese Sitzung im Speicher gehalten, nicht dauerhaft gespeichert") oder – besser – Key serverseitig verschlüsselt hinterlegen (siehe H4).

### K3. Sicherheitsregressionstests sind deaktiviert — genau die, die K2 verhindert hätten
- **Dateien:** `app/src/stores/aiConfigStore.test.ts:23`, `app/src/stores/authStore.test.ts:27`
- **Befund:** Beide `describe(...)`-Blöcke, die verifizieren, dass API-Keys/Tokens **nie** in `localStorage` landen, sind mit `.skip` deaktiviert. Damit hat das Projekt aktuell keinerlei automatisierten Schutz gegen eine künftige Regression in genau diesem sicherheitskritischen Verhalten.
- **Fix:** Tests reaktivieren. Laut `SESSION_NOTES.md` (2026-06-05) war der Grund "Zustand persist flush timing ist in Tests nicht zuverlässig reproduzierbar" — das ist lösbar (z.B. `await vi.waitFor(...)` statt fixer Timeouts, oder direkt gegen `localStorage.getItem(...)` nach synchronem `persist.rehydrate()` prüfen) und sollte nicht dauerhaft als Ausrede stehen bleiben.

### K4. Coaching-Feature (PREMIUM/PRO, bezahlt) liefert für jeden Nutzer an jedem Tag denselben Fake-Inhalt
- **Datei:** `backend/src/routes/coaching.ts:26-37`
- **Befund:** `transitData: { sunGate: 1, moonGate: 2 }` ist hartkodiert (Kommentar: *"Placeholder"*), `impulseText` ist ein einziger fixer deutscher Satz für alle Nutzer, alle Tage. `calculateDailyTransit()` (`services/ephemeris.ts`) ist voll funktionsfähig und wird bereits in `transit.ts` verwendet — wird hier aber nicht aufgerufen.
- **Impact:** Ein explizit beworbenes Bezahl-Feature (PREMIUM/PRO-Tier) ist Attrappe. Bei Entdeckung durch zahlende Nutzer ein Vertrauens- und ggf. Rückerstattungsproblem.
- **Fix:** Echte Transit-Daten aus `calculateDailyTransit()` beziehen; `impulseText` entweder aus einem Pool kuratierter, transit-abhängiger Texte auswählen oder (later) via AI-Synthese generieren.

### K5. Kein E-Mail-Versand — Passwort-Reset und E-Mail-Verifizierung sind Sackgassen
- **Dateien:** `backend/src/services/auth.ts`, `backend/src/routes/auth.ts:237-258`
- **Befund:** Grep über das gesamte Backend nach `nodemailer`/`sendgrid`/`mailgun`/`resend`/`smtp`: keine Treffer. Tokens werden erzeugt und in der DB gespeichert, aber nie zugestellt (und aus gutem Grund auch nicht mehr im Response geleakt — das alte Leak-Finding ist behoben). Praktisch bedeutet das: **kein realer Nutzer kann sein Passwort zurücksetzen oder seine E-Mail verifizieren.**
- **Fix:** E-Mail-Service integrieren (z.B. Resend, Postmark oder SMTP via `nodemailer`) — siehe `PRODUCTION_READY_PLAN.md` C3, war schon vor einem Monat geplant, ist aber nicht umgesetzt.

### K6. Stiller Berechnungsfehler: PHS-Variable "Style" ist für JEDEN Chart falsch
- **Datei:** `backend/src/services/humanDesignCalculator.ts:100, 121, 280, 288`
- **Befund:** `planetsToGates()` schreibt den Node-Planeten bereits kanonisiert als `'NORTH_NODE'` in die Gates (Zeile 121, via `canonicalPlanetName`). `calculateVariables()` sucht aber weiterhin nach `g.planet === 'MEAN_NODE'` (Zeile 280) — ein Wert, der im Array nicht mehr vorkommt. `northNode` ist deshalb immer `undefined`, wodurch das `style`-Feld (Zeile 288) für **jeden einzigen berechneten Chart** auf den Fallback `'Lunar'` fällt, unabhängig vom tatsächlichen North-Node-Tone.
- **Impact:** Ein an Nutzer ausgeliefertes, für die HD-Analyse relevantes Datenfeld ist durchgängig falsch — und das seit der Einführung von `humanDesignCalculator.ts`, unbemerkt, weil kein Test die Funktion end-to-end aufruft.
- **Fix:** Zeile 280 auf `g.planet === 'NORTH_NODE'` ändern. Danach einen End-to-End-Test für `calculateHumanDesignChart()` ergänzen (aktuelle Tests decken nur die reinen Center-Helfer ab, nicht die Hauptfunktion — genau das hat den Bug durchgelassen).

### K7. CI ist aktuell rot
- **Datei:** `.github/workflows/ci-frontend.yml:53`
- **Befund:** `pnpm lint` läuft ohne Fallback; ein lokaler Testlauf ergab **69 Lint-Fehler** in `app/` (u.a. `api.ts`, `millmanCalculations.ts`, `OnboardingFlow.tsx`, `SettingsSection.tsx`, `authStore.ts` — ungenutzte Variablen, `prefer-const`, `no-explicit-any`, zwei React `set-state-in-effect`-Verstöße). Jeder Push/PR auf `app/**` schlägt aktuell fehl.
- **Fix:** Lint-Fehler beheben (mechanisch, kein Architektur-Thema) oder Step vorübergehend mit Fallback versehen wie im Backend-Workflow — aber das nur als Übergangslösung, nicht als Dauerzustand.

### K8. Dokumentation behauptet eine Datenschutz-Architektur, die es nicht mehr gibt
- **Dateien:** `PROJECT_OVERVIEW.md:29`, `README.md`, `AGENTS.md`
- **Befund:** `PROJECT_OVERVIEW.md` behauptet weiterhin *"Geburtsdaten verlassen das Gerät nie... Keine Cloud, keine externe API für sensible Daten"*. Das ist nach dem Tauri-Pivot schlicht falsch — Geburtsdaten gehen zwingend an den Node-Backend-Endpunkt `/api/hd/calculate`. `AGENTS.md` beschreibt in ~40 Referenzen eine Tauri/Rust-Architektur, die es im Working Tree nicht mehr gibt.
- **Impact:** Nicht nur Code-Hygiene — falls diese Aussage in einer Datenschutzerklärung oder gegenüber Nutzern/Investoren wiederholt wird, ist es eine sachlich falsche Zusicherung mit DSGVO-Relevanz.
- **Fix:** Alle drei Dokumente an die neue Web-only-Architektur anpassen, bevor irgendetwas davon extern kommuniziert wird.

---

## 3. HOHE BEFUNDE (HIGH)

### H1. Dev-Docker-Setup crasht beim Start
- **Dateien:** `docker-compose.dev.yml:47-48`, `backend/src/services/auth.ts:19-33`
- **Befund:** Compose setzt `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `auth.ts` liest aber `process.env.JWT_SECRET` (wirft beim Fehlen einen Startup-Error). Die Produktions-Compose (`docker-compose.yml:43`) verwendet korrekt `JWT_SECRET`. Verifiziert durch direkten Vergleich beider Dateien.
- **Fix:** `docker-compose.dev.yml` auf `JWT_SECRET`/`JWT_REFRESH_SECRET` umbenennen.

### H2. Client-seitiges BYOK umgeht den bereits vorhandenen sicheren Backend-Proxy
- **Dateien:** `app/src/sections/AICoaching.tsx:272-351`, `AISettings.tsx:410-490`
- **Befund:** Diese Komponenten rufen OpenAI/Anthropic/Google direkt aus dem Browser mit dem rohen Nutzer-API-Key auf; `AICoaching.tsx:308` setzt sogar `'anthropic-dangerous-direct-browser-access': 'true'`, um Anthropics eigenen Browser-Schutz zu umgehen. `backend/src/routes/ai.ts` (`POST /api/ai/proxy`, mit Auth, Tier-Gate und SSRF-Guard) existiert bereits als sicherer Pfad, wird vom Frontend aber nie aufgerufen.
- **Fix:** Frontend auf den Backend-Proxy umstellen; direkten Provider-Zugriff aus dem Browser entfernen.

### H3. Passwort-Reset-/E-Mail-Verify-Token im Klartext in der DB
- **Datei:** `backend/prisma/schema.prisma:19-21`
- **Befund:** `passwordResetToken`/`emailVerifyToken` liegen unverschlüsselt/ungehasht auf `User`. Ein DB-Leak (Backup, Fehlkonfiguration einer Replika) erlaubt sofortige Account-Übernahme für jedes aktive Token.
- **Fix:** Nur den Hash (z.B. SHA-256) speichern, Klartext-Token nur einmalig per E-Mail versenden und beim Verify/Reset hashen+vergleichen.

### H4. `pnpm audit` findet reale Schwachstellen
- **Befund:** Backend: 1 *high* (`form-data` CRLF-Injection via `openai@4.104.0` → `form-data@4.0.5`, Fix ist `>=4.0.6`), 2 *moderate* (`js-yaml` ReDoS, dev-only via jest; `uuid` Buffer-Bounds). Frontend: 1 *moderate* (`dompurify` via `jspdf`), 2 *low* (`esbuild` Dev-Server-Filelesen unter Windows).
- **Fix:** `pnpm update` für die betroffenen Pakete, insbesondere `form-data` (High, production-relevant).

### H5. AGPL-Lizenzrisiko bei Swiss Ephemeris ist unverändert ungelöst
- **Datei:** `backend/package.json` (`sweph@^2.10.3-b-1`)
- **Befund:** Bereits in `PROJECT_OVERVIEW.md` als Risiko dokumentiert, aber weiterhin nicht adressiert. Für ein Closed-Source-SaaS-Produkt ist eine kommerzielle Astrodienst-Lizenz (~500€) erforderlich, wenn nicht der gesamte Quellcode unter AGPL veröffentlicht werden soll.
- **Fix:** Vor kommerziellem Launch Lizenz klären — das ist ein rechtliches, kein technisches Ticket, aber ein echter Blocker für Monetarisierung.

### H6. Keine Integrations-/Route-Tests im Backend
- **Befund:** Kein `supertest` oder Äquivalent; keine Tests für `auth.ts`, `ai.ts`, `humanDesign.ts`, `synthesis.ts`, `coaching.ts`, `numerology.ts` oder die Middleware (`auth`, `rateLimit`, `errorHandler`). Die gesamte Auth-/Tier-/Validierungslogik jeder Route ist ungetestet.
- **Fix:** Mindestens Smoke-Tests pro Route (Auth erforderlich? richtiger Tier-Gate? Zod lehnt Falscheingaben ab?) mit `supertest` gegen eine Test-DB.

### H7. SSRF-Guard-Test prüft nicht den eigentlich kritischen Pfad
- **Datei:** `backend/src/tests/ssrfGuard.test.ts`
- **Befund:** Testet nur Literal-IP-Hostnamen und die Denylist-Regex; `dns.promises.lookup` wird nie gemockt. Der eigentliche Kern der SSRF-Absicherung — "Hostname löst zu einer privaten/Metadata-IP auf" (`ssrfGuard.ts:79-89`) — ist ungetestet.
- **Fix:** `dns.promises.lookup` in Tests mocken und Fälle wie "öffentlicher Hostname, der zu 169.254.169.254 auflöst" abdecken.

### H8. Doppelte Lockfiles in beiden Packages
- **Befund:** `backend/package-lock.json` (Mai) und `backend/pnpm-lock.yaml` (Juni) koexistieren; gleiches Muster vermutlich in `app/`. CI nutzt `pnpm install --frozen-lockfile`, also gewinnt `pnpm-lock.yaml` — aber das veraltete `package-lock.json` ist ein Footgun für jeden, der lokal `npm install` statt `pnpm install` ausführt.
- **Fix:** `package-lock.json` in beiden Packages löschen, `.gitignore` entsprechend ergänzen falls nötig.

---

## 4. MITTLERE BEFUNDE (MEDIUM)

| # | Datei | Befund |
|---|-------|--------|
| M1 | `backend/src/middleware/errorHandler.ts:117-121` | 500-Handler leakt `err.message` es sei denn `NODE_ENV === 'production'` exakt — Staging/fehlkonfigurierte Envs leaken interne Fehlertexte |
| M2 | `backend/src/services/auth.ts:20,25-33,37` | `JWT_REFRESH_SECRET` wird validiert, aber nie verwendet (Refresh-Tokens sind opake `uuidv4()`, DB-abgeglichen) — irreführend für Ops, die glauben, Rotation dieses Secrets invalidiere Refresh-Tokens |
| M3 | `backend/src/middleware/traceId.ts:18` | Client-gelieferter `X-Trace-Id`-Header wird ungeprüft übernommen und gespiegelt — Log-Injection/Trace-Spoofing möglich |
| M4 | `backend/src/routes/humanDesign.ts` `/calculate` | Teilt sich den generischen 100/min-Limiter mit günstigen Endpunkten, obwohl es der CPU-intensivste Endpunkt ist (Newton-Iteration) |
| M5 | `app/src/sections/JournalEditor.tsx:114,131`, `PDFExportButton.tsx:57` | Blockierende `alert()`-Dialoge, inkonsistent mit dem sonst verwendeten `sonner`-Toast-Pattern |
| M6 | `app/src/sections/SettingsSection.tsx:123-142` | `exportData()` bündelt den rohen `aiConfig.apiKey` in eine herunterladbare Klartext-JSON-Datei — aktuell harmlos nur weil die Section nicht erreichbar ist (K1), aber ein Zeitbombe bei Reconnect |
| M7 | `app/src/sections/JournalSection.tsx:98` | Zeigt "AES-256-GCM Verschlüsselung" — Relikt aus der Tauri-Ära; `JournalEditor.tsx`/`JournalList.tsx` speichern tatsächlich unverschlüsselten Klartext in `localStorage`. Gleiches Reconnect-Risiko wie M6 |
| M8 | `backend/src/services/auth.ts` `login()` | Timing-Seitenkanal: nicht-existierende E-Mail antwortet sofort, existierende mit falschem Passwort wartet auf `bcrypt.compare` (~100ms) — ermöglicht E-Mail-Enumeration über Response-Zeit |
| M9 | `.github/workflows/ci-docker.yml` | Baut das Image nur (`push: false`), startet es nie, prüft nie `/health` oder ob Ephemeris-Dateien im Image tatsächlich vorhanden/ladbar sind |
| M10 | `backend/prisma/schema.prisma` `TransitData`-Modell | Definiert, aber nirgends gelesen/geschrieben — totes Schema; Transits werden bei jedem Request neu berechnet statt gecacht |
| M11 | `backend/src/middleware/auth.ts` | `requireOwnership`, `requirePermission`, `requireAnyRole` exportiert, aber nie verwendet; feingranulares RBAC (Permission/RolePermission-Tabellen, in `seed.ts` befüllt) ist reine Dekoration — nur grobes `requireRole('ADMIN')` wird einmal genutzt |
| M12 | `app/src/lib/calculations.test.ts:188-207` | Ein `describe('Encryption', ...)`-Block testet einen isolierten `btoa`/`atob`-Mock ohne jede Verbindung zu echtem App-Code — täuscht getestete Verschlüsselung vor, obwohl es keine mehr gibt |
| M13 | `backend/src/routes/humanDesign.ts`, `numerology.ts` (`saveHDSchema` etc.) | Persistiert vollständig client-berechnete Chart-Daten ohne serverseitige Re-Validierung gegen die Geburtsdaten — Nutzer könnte inkonsistente Profile abspeichern (nur eigene Daten betroffen) |

---

## 5. NIEDRIGE BEFUNDE (LOW)

- `backend/src/index.ts` — `express.json({ limit: '10mb' })` großzügig für eine reine JSON-API ohne Datei-Uploads.
- `backend/src/routes/coaching.ts:76-77` — `limit`/`offset` per bloßem `parseInt()`, kein Zod-Bound (nur eigene Daten betroffen).
- `app/src/sections/SettingsSection.tsx:108` — Temperature-Slider ruft noch `setBaseUrl` als Platzhalter auf, obwohl `setTemperature` seit längerem existiert (aktuell irrelevant, da Section unerreichbar).
- `app/tsconfig.app.json` — `noUnusedLocals`/`noUnusedParameters: false` verdeckt genau die toten Exporte aus K1.
- Vite-Build (`app`) meldet einen >500 KB Hauptchunk (737 KB / 228 KB gzip) — kein Code-Splitting konfiguriert.
- `AGENTS.md`, `README.md` — weitere kleinere Tauri-Restreferenzen über K8 hinaus.

---

## 6. WAS SEIT DEN LETZTEN AUDITS NACHWEISLICH BEHOBEN WURDE

- SSRF-Schutz für die Custom-AI-Provider-URL ist real implementiert und tatsächlich vor dem Fetch verdrahtet (`lib/ssrfGuard.ts`, `routes/ai.ts:50`), inkl. `redirect: 'manual'` gegen Redirect-Bypass.
- PrismaClient-Singleton wird überall korrekt verwendet, keine verstreuten `new PrismaClient()` mehr in Routen.
- JWT-Secrets: kein hartkodierter Fallback mehr; beide Secrets müssen ≥32 Zeichen sein oder der Prozess startet nicht; `algorithms: ['HS256']` explizit gepinnt.
- `req.user.userId` wird jetzt durchgängig korrekt verwendet (keine `req.user.id`-Verwechslungen mehr).
- `SubscriptionTier`-Enum (`FREE/BASIC/PREMIUM/PRO`) stimmt jetzt überall mit den Route-Gates überein — das alte `SOUL_SYNC_PREMIUM`-Problem ist vollständig weg.
- EARTH-Gate korrekt 180° gegenüber der Sonne berechnet; Design-Offset ist eine echte iterative Newton-Verfahren-Lösung für den 88°-Sonnenbogen, kein fixer 88-Tage-Wert mehr.
- `gateToCenter()` deckt jetzt alle 64 Gates auf genau 9 Zentren ab (vorheriger Bug: Gates 8, 16, 17, 31, 43 fielen auf `UNKNOWN`).
- Keine rohen Geburtsdaten werden in der DB persistiert oder geloggt (`requestLogger` loggt nie `req.body`).
- Pino-Logging, Request-Logging, `/health` mit echtem DB-Ping, Graceful Shutdown (SIGTERM/SIGINT) sind alle tatsächlich verdrahtet, nicht nur als Dependency vorhanden.
- Echtes per-User-Rate-Limiting für General/Auth/Synthesis/Coaching/Transit-Range.
- Docker ist echtes Multi-Stage-Build, non-root User, kopiert `.se1`-Ephemeris-Dateien, hat einen `HEALTHCHECK`; Produktions-Compose hat kein Dev-Volume-Mounting/Hot-Reload mehr.
- Prisma-Migrationshistorie ist konsistent mit dem aktuellen Schema (keine Drift).
- Keine committeten Secrets gefunden.
- Registrierungs-Race-Condition (TOCTOU) ist behoben (atomarer Unique-Constraint + P2002-Handling).
- Prompt-Injection-Schutz (`sanitizePromptValue`) vor AI-Prompt-Interpolation vorhanden.

---

## 7. EMPFOHLENE PRIORISIERUNG

| Priorität | Maßnahme | Geschätzter Aufwand |
|-----------|----------|---------------------|
| P0 | K1: Journal/Gene-Keys/Transit/Settings wieder in die App verdrahten | 0.5–1 Tag |
| P0 | K6: `MEAN_NODE` → `NORTH_NODE` Bugfix + E2E-Test für `calculateHumanDesignChart` | 1–2 h |
| P0 | K7: Frontend-Lint-Fehler beheben, CI grün bekommen | 2–4 h |
| P0 | K2/K3: Falsche Security-Aussage korrigieren + Regressionstests reaktivieren | 2–4 h |
| P0 | H1: Docker-Dev-Env-Var-Namen fixen | 15 min |
| P1 | K4: Coaching-Feature auf echte Transit-Daten umstellen | 4–6 h |
| P1 | K5: E-Mail-Service integrieren (Reset/Verify) | 4–8 h |
| P1 | H2: Frontend auf Backend-AI-Proxy umstellen, Browser-Direct-Calls entfernen | 4–6 h |
| P1 | H3: Reset-/Verify-Token gehasht statt Klartext speichern | 2 h |
| P1 | H4: `pnpm audit`-Findings fixen (v.a. `form-data`) | 1 h |
| P1 | K8: Doku (README/AGENTS/PROJECT_OVERVIEW) an Web-only-Architektur anpassen | 2–4 h |
| P2 | H6: Backend-Integrationstests (Supertest) für alle Routen | 1–2 Tage |
| P2 | H7: SSRF-Test um echten DNS-Resolution-Pfad ergänzen | 1–2 h |
| P2 | H8: Doppelte Lockfiles entfernen | 15 min |
| P2 | H5: AGPL-Lizenzfrage klären (rechtlich, nicht technisch) | — |
| P3 | M1–M13: siehe Tabelle oben, überwiegend Härtung ohne Nutzer-Impact | 1–2 Tage gesamt |

---

*Ende des Audit-Reports. Der aktualisierte Umsetzungsplan befindet sich in `PRODUCTION_READY_PLAN.md`.*
