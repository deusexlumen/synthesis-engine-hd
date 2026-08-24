# Deployment — Render + Supabase (Standard-Tier)

Erstdeployment der Web-App auf Render mit Supabase als PostgreSQL.
Blueprint: [`render.yaml`](../render.yaml) im Repo-Root.

Dieses Setup deployt **ausschließlich das Standard-Tier**: das Image wird ohne
`WITH_SWEPH` gebaut, enthält also kein Swiss-Ephemeris-Modul. Damit ist
**keine Astrodienst-Lizenz nötig** — die AGPL-Komponente wird nicht
ausgeliefert. Für PREMIUM/PRO siehe [`EPHEMERIS_LICENSE_RUNBOOK.md`](EPHEMERIS_LICENSE_RUNBOOK.md).

Was hier **nicht** enthalten ist: Stripe. Bezahlung existiert im Code nicht
(nur Prisma-Schema). Nach diesem Deployment ist FREE nutzbar, kostenpflichtige
Tiers sind nur manuell in der DB setzbar.

---

## 1. Supabase-Projekt anlegen

1. Projekt erstellen, Region nahe der Render-Region wählen (Blueprint nutzt
   `frankfurt`).
2. **Connect** → **Connection string** öffnen. Es gibt drei Varianten; zwei
   davon werden gebraucht:

| Variante | Port | Verwendung hier |
|---|---|---|
| Direct connection (`db.<ref>.supabase.co`) | 5432 | **nicht verwenden** — nur über IPv6 erreichbar, Render geht per IPv4 raus |
| Session pooler (`...pooler.supabase.com`) | 5432 | `DIRECT_URL` — Migrationen |
| Transaction pooler (`...pooler.supabase.com`) | 6543 | `DATABASE_URL` — Laufzeit-Queries |

Warum getrennt: `prisma migrate deploy` braucht Advisory Locks und Prepared
Statements. Der Transaction Pooler unterstützt beides nicht — Migration über
Port 6543 schlägt fehl. `schema.prisma` verdrahtet das über
`datasource.directUrl`.

An `DATABASE_URL` anhängen: `?pgbouncer=true&connection_limit=1`.

---

## 2. Blueprint anwenden (Pass 1)

Render Dashboard → **New** → **Blueprint** → Repo auswählen. Render liest
`render.yaml` und legt zwei Services an:

- `synthesis-engine-api` — Docker Web Service aus `backend/Dockerfile`
- `synthesis-engine-app` — Static Site, Vite-Build aus `app/`

Render fragt die als `sync: false` markierten Werte ab. In Pass 1 diese
setzen:

| Variable | Service | Wert |
|---|---|---|
| `DATABASE_URL` | api | Transaction Pooler, Port 6543, mit `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | api | Session Pooler, Port 5432 |
| `JWT_SECRET` | api | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | api | `openssl rand -base64 48`, anderer Wert |

> `JWT_SECRET` und `JWT_REFRESH_SECRET` müssen **mindestens 32 Zeichen** haben.
> `backend/src/services/auth.ts` wirft beim Import, wenn kürzer — der Service
> geht dann in eine Crash-Loop mit einer Meldung, die nach Code-Bug aussieht.

Die drei URL-Variablen (`CORS_ORIGINS`, `FRONTEND_URL`, `VITE_API_URL`) in
Pass 1 **leer lassen**. Sie brauchen Hostnamen, die es noch nicht gibt.

---

## 3. URLs nachtragen (Pass 2)

Nach dem ersten Apply stehen die beiden URLs fest. Jetzt setzen:

| Variable | Service | Wert |
|---|---|---|
| `CORS_ORIGINS` | api | `https://synthesis-engine-app.onrender.com` |
| `FRONTEND_URL` | api | `https://synthesis-engine-app.onrender.com` |
| `VITE_API_URL` | app | `https://synthesis-engine-api.onrender.com` |

Speichern löst automatisch Redeploy (api) bzw. Rebuild (app) aus. Der Rebuild
ist zwingend: `VITE_*` wird zur **Build-Zeit** ins Bundle kompiliert
(`import.meta.env`), nicht zur Laufzeit gelesen.

Ohne `CORS_ORIGINS` fällt der Backend-Code in Production auf
`https://synthesis-engine.com` zurück (`backend/src/index.ts:37`) — jeder
Browser-Request vom Render-Frontend scheitert dann an CORS.

---

## 4. Migrationen

Laufen automatisch. `backend/docker-entrypoint.sh` führt bei jedem
Container-Start `prisma migrate deploy` aus und startet die API erst danach;
schlägt die Migration fehl, bricht der Container ab (`set -e`), statt gegen ein
unmigriertes Schema zu booten.

Die drei Migrationen in `backend/prisma/migrations/` sind **handgeschrieben**
und liefen nie gegen eine echte Datenbank. Der erste Deploy ist ihr erster
echter Test — Logs beobachten.

Skalierung: Der Entrypoint läuft pro Container. Bei mehr als einer Instanz
konkurrieren Starts um den Migrations-Advisory-Lock (Prisma lässt den
Verlierer warten, korrumpiert nichts). Vor dem Hochskalieren auf
Renders `preDeployCommand` umstellen — verfügbar ab den kostenpflichtigen
Instance-Typen.

---

## 5. Verifikation

```bash
# 1. Health-Endpunkt: prüft auch DB-Konnektivität (SELECT 1)
curl https://synthesis-engine-api.onrender.com/health
# erwartet: {"status":"ok","database":"connected",...}

# 2. Migrationen angekommen?
#    Supabase SQL Editor:
#    SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;
#    erwartet: 3 Zeilen (init, drop_transit_data, create_journal_entries)

# 3. Frontend lädt und spricht mit der API
#    Browser: https://synthesis-engine-app.onrender.com
#    DevTools -> Network: Requests gehen an die API-Domain, kein CORS-Fehler
#    Deep-Link testen (Reload auf einer Unterseite) -> 200, nicht 404
```

Render Free Tier: Der Service schläft nach 15 Minuten Inaktivität ein, der
erste Request danach braucht ~30–60 Sekunden. Ein Health-Check-Timeout beim
allerersten Aufruf ist normal, kein Fehler.

---

## 6. Vollständige Env-Matrix

| Variable | api | app | Pflicht | Ohne den Wert |
|---|---|---|---|---|
| `NODE_ENV` | ✅ (fix `production`) | — | ja | — |
| `DATABASE_URL` | ✅ Secret | — | **ja** | Start scheitert |
| `DIRECT_URL` | ✅ Secret | — | **ja** | Migration scheitert, Container bricht ab |
| `JWT_SECRET` | ✅ Secret | — | **ja** | Crash-Loop beim Import |
| `JWT_REFRESH_SECRET` | ✅ Secret | — | **ja** | Crash-Loop beim Import |
| `CORS_ORIGINS` | ✅ Pass 2 | — | **ja** | Frontend-Requests scheitern an CORS |
| `FRONTEND_URL` | ✅ Pass 2 | — | ja | Reset-/Verify-Links zeigen auf localhost |
| `VITE_API_URL` | — | ✅ Pass 2 | **ja** | Frontend ruft `localhost:3000` |
| `RESEND_API_KEY` | ✅ Secret | — | nein | Mails nur in Logs — kein Verify, kein Reset |
| `EMAIL_FROM` | ✅ Secret | — | mit Resend | — |
| `OPENAI_API_KEY` | ✅ Secret | — | nein | KI-Synthese und Coaching antworten nicht |
| `EPHEMERIS_PRO_ENABLED` | ✅ (fix `false`) | — | ja | — |
| `PNPM_VERSION` | — | ✅ (fix `9.15.0`) | ja | — |
| `PORT` | im Image gesetzt (3000) | — | — | — |
| `SE_EPHE_PATH` | ungenutzt im Standard-Image | — | nein | — |

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` aus
`.env.example` werden hier nicht gebraucht: Supabase dient nur als Postgres,
Auth läuft über die eigenen JWTs.

---

## 7. Danach

Reihenfolge nach dem ersten grünen Deploy:

1. `RESEND_API_KEY` + `EMAIL_FROM` setzen — ohne Mailversand kann sich niemand
   verifizieren oder ein Passwort zurücksetzen.
2. Stripe Checkout + Webhooks bauen. Bis dahin gibt es kein Upgrade-Pfad;
   Tiers sind nur direkt in der DB änderbar. Siehe `MONETIZATION_PLAN.md`.
3. Astrodienst-Lizenz erst kaufen, wenn PREMIUM-Nachfrage messbar ist. Dann
   Pro-Image (`WITH_SWEPH=true`) als zweiten Service, siehe
   [`EPHEMERIS_LICENSE_RUNBOOK.md`](EPHEMERIS_LICENSE_RUNBOOK.md).
