# PostgreSQL Setup Guide

## Option 1: PostgreSQL Installer (Empfohlen)

1. **Download**: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. **Version**: PostgreSQL 16.x
3. **Installation**: Standard-Einstellungen verwenden
4. **Passwort**: `postgres` (für Entwicklung)
5. **Port**: 5432

### Nach der Installation:

```bash
# Datenbank erstellen
psql -U postgres -c "CREATE DATABASE synthesis_engine;"

# Oder über pgAdmin 4 (wird mitinstalliert)
```

## Option 2: Docker (Für Entwickler)

```bash
# Docker starten
docker run --name synthesis-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=synthesis_engine \
  -p 5432:5432 \
  -d postgres:16-alpine
```

## Option 3: Supabase (Cloud)

1. Account erstellen: https://supabase.com
2. Neues Project anlegen
3. Database URL kopieren
4. In `.env` eintragen

## Prisma Migration

Nach PostgreSQL-Installation:

```bash
cd backend

# 1. Prisma Client generieren
npx prisma generate

# 2. Migration durchführen
npx prisma migrate dev --name init_auth_rbac

# 3. Default-Rollen seeden
npx prisma db seed

# 4. Datenbank UI öffnen (optional)
npx prisma studio
```

## Verifizierung

```bash
# Datenbank-Verbindung testen
npx prisma db pull

# Oder: Server starten und API testen
npm run dev
```

## Fehlerbehebung

### Port 5432 belegt?
```bash
# Prozess finden und beenden
netstat -ano | findstr :5432
taskkill /PID <PID> /F
```

### Berechtigungsfehler?
```bash
# PostgreSQL Service neu starten
services.msc → PostgreSQL → Neustarten
```

### Migration schlägt fehl?
```bash
# Datenbank zurücksetzen (VORSICHT!)
npx prisma migrate reset
```
