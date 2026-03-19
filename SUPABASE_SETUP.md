# Supabase Setup Guide (5 Minuten)

## Schritt 1: Projekt erstellen

1. Gehe zu https://supabase.com
2. Klicke "Start your project"
3. Wähle Organization (oder erstelle neue)
4. Projekt-Name: `synthesis-engine`
5. Database Password: Generiere starkes Passwort (speichern!)
6. Region: `Frankfurt (eu-central-1)` (nächstgelegen)
7. Klicke "Create new project"

→ Warte 2-3 Minuten bis die DB bereit ist

## Schritt 2: Connection URL kopieren

1. Im Dashboard → Project Settings → Database
2. Section "Connection string"
3. Wähle "URI" Tab
4. Kopiere die URL:

```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## Schritt 3: .env konfigurieren

```bash
# backend/.env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
JWT_ACCESS_SECRET="synthesis-access-secret-$(openssl rand -hex 32)"
JWT_REFRESH_SECRET="synthesis-refresh-secret-$(openssl rand -hex 32)"
```

## Schritt 4: Migration ausführen

```bash
cd backend

# Prisma Client generieren
npx prisma generate

# Migration durchführen
npx prisma migrate dev --name init_production

# Default-Rollen seeden
npx prisma db seed

# Server starten
npm run dev
```

## Schritt 5: Test

```bash
# In neuem Terminal:
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
```

✅ Erfolg: Response mit `accessToken` und User-Daten

## Troubleshooting

### Verbindungsfehler?
→ In Supabase Dashboard: Database → Connection Pooling → URI verwenden

### Migration schlägt fehl?
→ `npx prisma migrate reset` (löscht Daten!)

### CORS Fehler?
→ Backend .env: `FRONTEND_URL` setzen
