# Holistischer Audit-Report — Synthesis Engine
**Datum:** 2026-05-20  
**Scope:** Full-Stack-Desktop/Web-Anwendung (React/Tauri, Rust-Core, Node.js/Express Backend, Prisma/PostgreSQL)  
**Auditor:** Kimi Code CLI (4 parallele Audit-Agenten + manuelle Rust-Core-Prüfung)

---

## Executive Summary

Die Codebase ist **architektonisch gut strukturiert**, weist aber **kritische Sicherheitslücken, Runtime-Defekte und Datenschutzverstöße** auf, die vor einem Release behoben werden müssen. Die schwerwiegendsten Probleme konzentrieren sich auf:

1. **Datenschutz**: Roh-Geburtsdaten werden an das Backend gesendet (Widerspruch zur eigenen Doku).
2. **Sicherheit**: Unverschlüsselte JWT/API-Key-Speicherung im Frontend, hartkodierte Secrets, ungeschützte Admin-Endpunkte.
3. **Stabilität**: Fehlende Auth-Store-Methoden führen zu garantierten Runtime-Crashes; fehlende Tauri-Abstraktion bricht den Web-Build.
4. **Genauigkeit**: Swiss Ephemeris ist integriert, wird aber mit `None` initialisiert → Moshier-Fallback (±0,1° statt ±0,0001°).

---

## Kritische Befunde (CRITICAL)

### 1. Roh-Geburtsdaten werden an Backend übermittelt (Datenschutzverstoß)
- **Dateien:** `app/src/lib/api.ts`, `backend/src/routes/humanDesign.ts`
- **Befund:** `api.calculateHD()` sendet exakte Geburtsdaten (Datum, Uhrzeit, Lat/Lon, Zeitzone) an `POST /api/hd/calculate`. Das Backend spiegelt diese Rohdaten im Response-Body unter `meta.birthData` wider. Dies widerspricht `AGENTS.md`: *"Geburtsdaten bleiben lokal, werden nie an Cloud gesendet"*.
- **Fix:** HD-Berechnungen ausschließlich im Rust/Tauri-Layer lokal durchführen. Backend nur mit anonymisierten/derived Daten füttern.

### 2. Fehlende Auth-Store-Methoden → Garantierter App-Crash
- **Dateien:** `app/src/stores/authStore.ts`, `app/src/components/auth/AuthProvider.tsx`, `app/src/components/auth/ProtectedRoute.tsx`, `app/src/components/auth/AdminGuard.tsx`
- **Befund:** `authStore.ts` implementiert keine Methoden `checkAuth`, `hasRole`, `hasTier`, `hasPermission` oder `features`. Diese werden jedoch in `AuthProvider`, `ProtectedRoute` und `AdminGuard` destrukturiert und aufgerufen → `TypeError: X is not a function` beim App-Start.
- **Fix:** Methoden im Store implementieren oder aufrufende Komponenten auf vorhandene Felder (`user?.roles`) umstellen.

### 3. `RegisterForm` übergibt 3 Argumente an 2-Parameter-Funktion
- **Datei:** `app/src/components/auth/RegisterForm.tsx:69`
- **Befund:** `register(formData.email, formData.password, formData.name)` wird aufgerufen, aber `authStore.ts` definiert `register: (email, password) => Promise<void>`. Der Name wird stillschweigend verworfen und nie ans Backend gesendet.
- **Fix:** Store-Action um `name`-Parameter erweitern und im POST-Body übermitteln.

### 4. Tauri-Imports in Web-Only-Stack → Build-Bruch
- **Dateien:** `app/src/sections/TransitSection.tsx`, `SettingsSection.tsx`, `components/JournalList.tsx`, `components/JournalEditor.tsx`
- **Befund:** Diese Dateien importieren `invoke` aus `@tauri-apps/api/core` und rufen Tauri-Commands auf. Da der Web-Build (Vite/Browser) keine Tauri-Runtime bereitstellt, schlagen diese Aufrufe im Browser fehl.
- **Fix:** Tauri-Calls durch HTTP-Calls ans Node-Backend ersetzen **oder** eine Abstraktionsschicht einführen, die zur Laufzeit zwischen Tauri-Invoke und Fetch switched.

### 5. JWT & API-Keys unverschlüsselt im `localStorage`
- **Dateien:** `app/src/stores/aiConfigStore.ts`, `app/src/stores/authStore.ts`
- **Befund:** AI-API-Keys und JWT-Access-Tokens werden per Zustand-Persistenz in `localStorage` geschrieben. XSS-Angriffe oder bösartige Browser-Extensions können diese auslesen.
- **Fix:**
  - Tokens: `httpOnly`-Cookies verwenden (Backend setzt bereits `credentials: 'include'`).
  - API-Keys: Nicht persistieren oder mit einem user-derived Key (z.B. via Web Crypto API) verschlüsseln.

### 6. Hartkodierte JWT-Fallback-Secrets
- **Datei:** `backend/src/services/auth.ts:16-18`
- **Befund:** `JWT_CONFIG.accessTokenSecret` und `refreshTokenSecret` fallen auf vorhersagbare Strings zurück, wenn `JWT_SECRET` fehlt. Zudem wird **dasselbe Secret** für Access- und Refresh-Tokens verwendet.
- **Fix:** Fallbacks entfernen → Startup-Error bei fehlendem Secret. Separate Secrets für Access (`JWT_SECRET`) und Refresh (`JWT_REFRESH_SECRET`) verwenden.

### 7. Nicht-existierende Middleware-Imports → Runtime-Crash bei Aktivierung
- **Dateien:** `backend/src/routes/synthesis.ts`, `coaching.ts`, `ai.ts`, `transit.ts`
- **Befund:** `requirePremium` wird aus `../middleware/auth` importiert, existiert dort aber nicht. `transit.ts` importiert `authenticateToken` statt `authenticate`. Werden die Routes jemals eingebunden, crasht die App beim Start.
- **Fix:** `requirePremium` in `middleware/auth.ts` definieren oder Imports/Usage entfernen. `authenticateToken` → `authenticate` korrigieren.

### 8. Falsche `req.user` Property-Zugriffe
- **Dateien:** `backend/src/routes/numerology.ts:34`, `synthesis.ts:38`, `coaching.ts:12`
- **Befund:** Verwendung von `req.user!.id`, aber das Auth-Middleware setzt `req.user.userId`. Dadurch ist `userId` immer `undefined` → Daten werden ohne User-Relation gespeichert oder Logic-Failures.
- **Fix:** Alle Vorkommen zu `req.user!.userId` ändern.

### 9. Mehrfache PrismaClient-Instanzen → Connection-Pool-Erschöpfung
- **Dateien:** `backend/src/routes/humanDesign.ts`, `numerology.ts`, `synthesis.ts`, `coaching.ts`
- **Befund:** Jede Route-Datei erzeugt lokal `new PrismaClient()` statt den Singleton aus `../lib/prisma` zu importieren. Mehrere PrismaClients erschöpfen den DB-Connection-Pool.
- **Fix:** `import { prisma } from '../lib/prisma';` verwenden.

### 10. Swiss Ephemeris wird mit `None` initialisiert → Moshier-Fallback
- **Dateien:** `app/src-tauri/src/human_design.rs:179`, `transit.rs:64`
- **Befund:** `ephemeris::init_ephemeris(None)?` wird aufgerufen. Dadurch verwendet `libswe-sys` die internen Moshier-Formeln (±0,1°) statt der professionellen `.se1`-Ephemeriden (±0,0001°). Die Funktion `find_ephemeris_path()` existiert, wird aber nirgends genutzt.
- **Fix:** In `main.rs` beim App-Start `find_ephemeris_path()` aufrufen und das Ergebnis an die Commands weiterreichen, oder direkt in `human_design.rs`/`transit.rs` den Pfad auflösen.

### 11. Journal-Master-Key ungeschützt auf der Festplatte
- **Datei:** `app/src-tauri/src/storage.rs:75-98`
- **Befund:** Der AES-256-GCM-Masterkey wird als rohe 32-Byte-Datei (`master.key`) im App-Data-Verzeichnis abgelegt. `argon2` ist in `Cargo.toml` importiert, wird aber **nie** für Key-Derivation verwendet.
- **Fix:** OS-Keychain integration (z.B. `keyring`-Crate) oder Ableitung des Keys aus einem User-Passwort mittels Argon2.

### 12. Docker Compose referenziert nicht-existierendes Dockerfile
- **Datei:** `docker-compose.yml:37`
- **Befund:** `dockerfile: Dockerfile` im Backend-Service, aber **kein** `backend/Dockerfile` existiert im Projekt. `docker-compose up` schlägt sofort fehl.
- **Fix:** `backend/Dockerfile` erstellen oder Compose auf ein Image umstellen.

---

## Hohe Befunde (HIGH)

### 13. `JSON.parse` ohne `try/catch` → Runtime-Crash bei korruptem localStorage
- **Dateien:** `app/src/sections/SettingsSection.tsx`, `TransitSection.tsx`, `GeneKeysSection.tsx`, `components/auth/AuthProvider.tsx`, `components/JournalList.tsx`
- **Fix:** Jedes `JSON.parse` in `try/catch` wrappen und bei Fehler den Eintrag löschen.

### 14. Unauthentifizierter Diagnostics-Endpunkt leakt Dateisystem-Pfade
- **Datei:** `backend/src/routes/humanDesign.ts:376-388`
- **Befund:** `GET /api/hd/diagnostics` hat **keine** Authentifizierung. Gibt Ephemeris-Pfade, vorhandene/fehlende Dateien und Swiss-Ephemeris-Version preis.
- **Fix:** `authenticate` + `requireRole('ADMIN')` Middleware hinzufügen.

### 15. SSRF über unvalidierte Custom-AI-Provider-URL
- **Datei:** `backend/src/routes/ai.ts:45-50, 226-246`
- **Befund:** `/api/ai/proxy` akzeptiert eine `baseUrl` für den `custom`-Provider ohne Validierung. Authentifizierte User können das Backend zu beliebigen internen/externen HTTP-Requests zwingen.
- **Fix:** `baseUrl` gegen Allowlist prüfen; private IPs und Metadata-Endpunkte blockieren.

### 16. Schwache Zod-Validierung für Prisma-Enums
- **Datei:** `backend/src/routes/humanDesign.ts:28-56`
- **Befund:** `saveHDSchema` nutzt `z.string()` für `energyType`, `authority`, `planet`. Ungültige Strings passieren Zod, verursachen aber Prisma-Runtime-Fehler.
- **Fix:** `z.enum([...])` mit exakten Prisma-Enum-Werten verwenden.

### 17. Password-Reset-Token wird im Development-Response geleakt
- **Datei:** `backend/src/routes/auth.ts:241-252`
- **Befund:** Im `development`-Mode gibt `/forgot-password` den rohen `resetToken` im JSON-Body (`debugToken`) zurück. Bei falsch konfiguriertem `NODE_ENV` oder Dev-Mode in Produktion sind Reset-Tokens abfangbar.
- **Fix:** Reset-Tokens **nie** im HTTP-Response zurückgeben.

### 18. Unauthentifizierter HD-Berechnungs-Endpunkt (Ressourcen-Exhaustion)
- **Datei:** `backend/src/routes/humanDesign.ts:144-288`
- **Befund:** `POST /api/hd/calculate` ist öffentlich (kein `authenticate`). Führt CPU-intensive Ephemeris-Berechnungen durch → potentielle DoS.
- **Fix:** `authenticate` + strikteres Rate-Limiting hinzufügen.

### 19. `Mutex::unwrap()` in Cache-Implementation → Panic bei Lock-Poisoning
- **Datei:** `app/src-tauri/src/main.rs:54, 71, 89, 106, 163, 175, 189, 201`
- **Befund:** Alle `cache.*.lock().unwrap()` führen zu einem sofortigen Panic, wenn ein Thread während des Lock-Haltens panicked (Mutex-Poisoning).
- **Fix:** `lock()` behandeln: `let mut hd_cache = cache.hd_cache.lock().map_err(|e| e.into_inner())?;` oder poisoned Mutexes recoveren.

### 20. SettingsSection bypassed Zustand → Duale Wahrheitsquelle
- **Datei:** `app/src/sections/SettingsSection.tsx`
- **Befund:** Lokaler State wird in eigene `localStorage`-Keys geschrieben (`synthesis_user_profile`, etc.), während der Rest der App `useAppStore` und `useAIConfigStore` mit **anderen** Keys verwendet. Änderungen propagieren nicht.
- **Fix:** Allen lokalen State durch globale Zustand-Stores ersetzen.

### 21. Insecure CORS in Development
- **Datei:** `backend/src/index.ts:23-28`
- **Befund:** `origin: '*'` kombiniert mit `credentials: true` ist in modernen Browsern ungültig und schafft ein Sicherheitsloch.
- **Fix:** Explizite localhost-Origins (`http://localhost:5173`) auch im Dev-Mode erlauben.

---

## Mittlere Befunde (MEDIUM)

### 22. Frontend-Tests nicht ausführbar (fehlendes Vitest)
- **Datei:** `app/src/lib/calculations.test.ts`
- **Befund:** Importiert `vitest`, aber `vitest` fehlt in `app/package.json` devDependencies.
- **Fix:** `vitest` hinzufügen und Test-Script konfigurieren.

### 23. Mehrheit der Backend-Routes ist deaktiviert (Dead Code)
- **Datei:** `backend/src/index.ts:11-13, 57-60`
- **Befund:** `numerology`, `synthesis`, `ai`, `transit`, `coaching` Router sind auskommentiert. Die Dateien existieren, enthalten aber zusätzlich Bugs (siehe CRITICAL).
- **Fix:** Routes aktivieren (nach Bugfix) oder Code entfernen und Doku anpassen.

### 24. Dokumentation widerspricht sich (README vs. AGENTS.md)
- **Dateien:** `README.md`, `AGENTS.md`
- **Befund:** `README.md` beschreibt die App als Web-App (ohne Tauri). `AGENTS.md` beschreibt sie als Full-Stack-Desktop-App mit Tauri. Beides existiert parallel.
- **Fix:** Dokumentation harmonisieren. Klarstellen, dass beide Builds unterstützt werden.

### 25. HD-Gate 44 doppelt zugeordnet
- **Dateien:** `app/src-tauri/src/human_design.rs:109,115`, `backend/src/routes/humanDesign.ts`
- **Befund:** Gate `44` ist sowohl `HEART` als auch `SPLEEN` zugeordnet. Laut Human-Design-Kanon gehört es zur Milz (Spleen).
- **Fix:** Gate `44` aus `HEART`-Array entfernen.

### 26. OnboardingFlow verliert Zeitzonen-Information
- **Datei:** `app/src/sections/OnboardingFlow.tsx:213`
- **Befund:** `timezone: parseFloat(timezone) || 1` wandelt IANA-Strings wie `"Europe/Berlin"` in `NaN` → `1`. Der echte Offset geht verloren.
- **Fix:** Originalen IANA-String speichern und Offset via `getTimezoneOffset` berechnen.

### 27. Rust-Cache-Key enthält keine Zeitzone → Cache-Kollisionen
- **Datei:** `app/src-tauri/src/main.rs:49-50`
- **Befund:** Der Cache-Key für HD-Berechnungen setzt sich aus Datum, Uhrzeit, Lat/Lon zusammen – **ohne** Zeitzone. Gleiche Uhrzeiten in verschiedenen Zeitzonen kollidieren.
- **Fix:** Zeitzone in den Cache-Key aufnehmen.

### 28. Design-Offset ist fixe 88 Tage (Approximation)
- **Datei:** `app/src-tauri/src/ephemeris.rs:303`
- **Befund:** Für Human-Design-Design-Berechnungen wird ein fixes Offset von 88 Tagen verwendet. Die exakte Design-Phase basiert auf 88° Sonnenbogen, was **nicht** exakt 88 Tagen entspricht.
- **Fix:** Design-JD iterativ berechnen: suche den Zeitpunkt, an dem die Sonne 88° vor der Geburts-Sonne steht.

### 29. `optionalAuth` ignoriert Fehler stillschweigend
- **Datei:** `backend/src/middleware/auth.ts:86-107`
- **Befund:** Bei malformed/expired Tokens fängt `optionalAuth` den Fehler ab und ruft `next()` ohne `req.user`. Downstream-Code kann nicht unterscheiden zwischen "kein Token" und "ungültiges Token".
- **Fix:** Unterscheiden: Kein Token → `next()`, Ungültiges Token → `401`.

### 30. Geocoding erzeugt jedes Mal einen neuen HTTP-Client
- **Datei:** `app/src-tauri/src/geocoding.rs:46`, `76`
- **Befund:** `reqwest::Client::new()` wird in jeder Funktion neu erzeugt. Das ist ineffizient (TCP-Connection-Pool wird nicht wiederverwendet).
- **Fix:** Singleton-Client im Modul oder global erstellen.

---

## Niedrige Befunde (LOW)

### 31. `.gitignore` enthält Duplikate und fehlende Patterns
- **Fix:** Duplikate entfernen; `.DS_Store`, `Thumbs.db`, `.vscode/`, `*.log`, `backend/ephemeris/` hinzufügen.

### 32. Setup-Scripts fordern Node 18 statt 20
- **Dateien:** `setup.ps1`, `setup.sh`
- **Fix:** Auf Node 20+ anheben (wie in `AGENTS.md` dokumentiert).

### 33. Falsche Behauptungen im Implementation Summary
- **Datei:** `IMPLEMENTATION_SUMMARY.md`
- **Befund:** Behauptet Argon2 wird für Key-Derivation verwendet – ist aber importiert und ungenutzt.
- **Fix:** Behauptung entfernen oder Argon2 tatsächlich implementieren.

### 34. `index.html` hat falsches Lang-Attribut
- **Datei:** `app/index.html:2`
- **Befund:** `lang="en"`, obwohl die gesamte UI auf Deutsch ist.
- **Fix:** `lang="de"` setzen.

### 35. Inkarnationskreuz-Mapping ist unvollständig
- **Datei:** `app/src-tauri/src/human_design.rs:365-437`
- **Befund:** `determine_incarnation_cross` enthält nur sequentielle Paare (1+2, 3+4, ...) mit generischen Namen. Die echten 192 Kreuze des Human Design fehlen.
- **Fix:** Vollständiges Mapping der 64 Gates zu ihren tatsächlichen Kreuz-Partnern implementieren.

### 36. Variablen-Berechnung ist stark vereinfacht
- **Datei:** `app/src-tauri/src/human_design.rs:440-537`
- **Befund:** `calculate_variables` nutzt grobe Gate-Nummern-Bereiche statt exakter Planetenpositionen (PHS/Design-Tierce). Dies ist keine professionelle Berechnung.
- **Fix:** Exakte Variablen-Logik aus professionellen HD-Quellen implementieren.

---

## Empfohlene Priorisierung

| Priorität | Maßnahme | Geschätzter Aufwand |
|-----------|----------|---------------------|
| P0 | Auth-Store-Methoden implementieren / Tauri-Web-Abstraktion | 4–6 h |
| P0 | Roh-Geburtsdaten **nicht** ans Backend senden | 2–4 h |
| P0 | Swiss Ephemeris mit korrektem Pfad initialisieren | 1–2 h |
| P0 | JWT-Secrets hartkodierte Fallbacks entfernen | 30 min |
| P0 | Journal-Key in OS Keychain oder Argon2-Derivation | 4–8 h |
| P1 | `JSON.parse` + `try/catch` überall im Frontend | 2 h |
| P1 | `localStorage`-Token/API-Key-Persistenz entfernen | 2–4 h |
| P1 | PrismaClient-Singleton im Backend durchsetzen | 1–2 h |
| P1 | Dead/commented Routes fixen oder entfernen | 2–4 h |
| P2 | Docker/Dockerfile aufsetzen | 2 h |
| P2 | Tests (Vitest Frontend, Jest Backend) zum Laufen bringen | 4 h |
| P2 | Gate 44 Doppelzuordnung fixen | 15 min |
| P2 | Cache-Key um Zeitzone erweitern | 15 min |
| P3 | Dokumentation harmonisieren | 2 h |
| P3 | shadcn/ui-Konsistenz im Settings-Bereich | 4 h |

---

## Positive Befunde (Was gut läuft)

- **Synthesis-Route sendet nur Derived Data:** `backend/src/routes/synthesis.ts` übermittelt korrekterweise nur abgeleitete HD-Felder (`energyType`, `profile`, etc.) an OpenAI, nie Roh-Geburtsdaten.
- **Rust-Unit-Tests vorhanden:** 19 Rust-Tests covering Verschlüsselung, Julian Day, Gate-Mappings, Energietyp-Bestimmung, Autorität und Referenz-Charts (Ra Uru Hu). Die Testabdeckung ist besser als in `AGENTS.md` dokumentiert.
- **Neo-Mystic UI-Theme ist konsistent:** Tailwind-Config, CSS-Variables und Glassmorphism-Effekte sind sauber implementiert.
- **Keine hardcodierten API-Keys im Source:** Secrets werden über `import.meta.env` bzw. `.env` injiziert.

---

*Ende des Reports*
