# BUXE_OS v24.1 -- PRODUCTION READY PLAN
# Synthesis Engine — Von Prototyp zu Production

> Basierend auf Audit Report vom 2026-06-05
> Zeitrahmen: 3 Wochen (1 Entwickler Vollzeit)
> Priorität: Stabilität → Datenschutz → Infrastruktur → Qualität

---

## ÜBERSICHT DER PHASEN

| Phase | Fokus | Dauer | Deliverable |
|-------|-------|-------|-------------|
| A | Stop-the-Bleed (Kritische Bugs) | 2 Tage | Backend läuft ohne Crashes |
| B | Architektur-Fixes | 3 Tage | Datenschutz-konform, Berechnungen korrekt |
| C | Production-Härtung | 5 Tage | Docker-Production, E-Mail, Monitoring |
| D | Qualitätssicherung | 4 Tage | Tests, E2E, Performance |
| E | Deployment & Release | 1 Tag | Live-Deployment, Runbook |

---

## PHASE A: STOP-THE-BLEED (2 Tage)

### A1. Backend Compile/Runtime-Fehler fixen

#### A1.1 `backend/src/routes/auth.ts` — Prisma Import hinzufügen

```typescript
// Zeile 1-10: Import hinzufügen
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';  // <-- HINZUFÜGEN
import { authService, rbacService, subscriptionService } from '../services/auth';
```

#### A1.2 `backend/src/routes/ai.ts` — `requirePremium` → `requireTier`

```typescript
// ALT (Zeile 4):
import { authenticate, AuthenticatedRequest, requirePremium } from '../middleware/auth';

// NEU:
import { authenticate, AuthenticatedRequest, requireTier } from '../middleware/auth';

// ALT (Zeile 22):
router.post('/proxy', authenticate, requirePremium, asyncHandler(async ...

// NEU:
router.post('/proxy', authenticate, requireTier(['PREMIUM', 'PRO']), asyncHandler(async ...
```

#### A1.3 `backend/src/routes/synthesis.ts` — Tier-Namen korrigieren

```typescript
// ALT (Zeile 35):
router.post('/generate', authenticate, requireTier(['SOUL_SYNC_PREMIUM', 'PRO']), ...

// NEU:
router.post('/generate', authenticate, requireTier(['PREMIUM', 'PRO']), ...
```

#### A1.4 `backend/src/routes/coaching.ts` — Tier-Namen korrigieren

```typescript
// ALT (Zeile 10):
router.get('/daily', authenticate, requireTier(['SOUL_SYNC_PREMIUM', 'PRO']), ...

// NEU:
router.get('/daily', authenticate, requireTier(['PREMIUM', 'PRO']), ...
```

#### A1.5 `backend/src/routes/transit.ts` — Variablen fixen

```typescript
// ALT (Zeile 156):
date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,

// NEU:
date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
```

### A2. EARTH-Planet in HD-Berechnungen hinzufügen

#### A2.1 `backend/src/services/ephemeris.ts` — `calculateAllPlanets` erweitern

Nach der Berechnung aller Planeten, füge die Erde hinzu (180° gegenüber der Sonne):

```typescript
// In calculateAllPlanets(), nach der Schleife:
// Erde ist 180° gegenüber der Sonne
const sunPos = results.get('SUN');
if (sunPos) {
  results.set('EARTH', {
    longitude: (sunPos.longitude + 180.0) % 360.0,
    latitude: -sunPos.latitude,
    distance: sunPos.distance,
    longitudeSpeed: sunPos.longitudeSpeed,
    latitudeSpeed: sunPos.latitudeSpeed,
    distanceSpeed: sunPos.distanceSpeed,
  });
}
```

#### A2.2 `app/src-tauri/src/human_design.rs` — EARTH hinzufügen

```rust
// Nach der Personality-Planeten-Schleife in calculate_hd_chart():
// Erde explizit berechnen (180° gegenüber der Sonne)
let sun_long = personality_planets.iter()
    .find(|(p, _)| p.name() == "SUN")
    .map(|(_, pos)| pos.longitude)
    .unwrap_or(0.0);

gates.push(Gate {
    number: longitude_to_hd_gate((sun_long + 180.0) % 360.0),
    line: 1, // Wird überschrieben wenn wir calculate_hd_details aufrufen
    color: 1,
    tone: 1,
    base: 1,
    planet: "EARTH".to_string(),
    is_design: false,
});

// Und für Design:
gates.push(Gate {
    number: longitude_to_hd_gate((sun_long + 180.0) % 360.0),
    line: 1,
    color: 1,
    tone: 1,
    base: 1,
    planet: "EARTH_DESIGN".to_string(),
    is_design: true,
});
```

**Hinweis:** Die obige Rust-Implementierung ist vereinfacht. Die korrekte Implementierung sollte die Erde aus den Design-Positionen berechnen, nicht aus der Personality-Sonne. Die bessere Lösung ist, `calculate_all_planets` in `ephemeris.rs` um die Erde zu erweitern (analog zum Backend).

### A3. `optionalAuth` Middleware fixen

#### A3.1 `backend/src/middleware/auth.ts`

```typescript
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
      tier: payload.tier,
    };

    next();
  } catch (error) {
    // WICHTIG: Bei abgelaufenem oder ungültigem Token einfach anonym weiter
    // NICHT 401 zurückgeben — das ist optionalAuth!
    next();
  }
}
```

---

## PHASE B: ARCHITEKTUR-FIXES (3 Tage)

### B1. Geburtsdaten-Verarbeitung ins Frontend verschieben

**Problem:** `AGENTS.md` verbietet das Senden von Geburtsdaten an externe APIs. Die Berechnungen müssen lokal im Browser (Web) oder Rust-Core (Desktop) erfolgen.

#### B1.1 Neue Strategie

- **Web-Modus:** Berechnungen erfolgen im Browser via `sweph` WebAssembly oder einem dedizierten Web Worker
- **Desktop-Modus:** Berechnungen erfolgen via Tauri/Rust Commands
- **Backend:** Speichert nur die **Ergebnisse** (Chart-Daten), nie die Roh-Geburtsdaten

#### B1.2 `app/src/lib/api.ts` — `calculateHD` umbauen

```typescript
/**
 * Calculate HD chart LOCALLY (never sends birth data to server)
 * For Web: Uses wasm-sweph or analytical fallback
 * For Desktop: Uses Tauri Rust commands
 */
async calculateHD(data: BirthData, accessToken?: string): Promise<{
  hdChart: HumanDesignChart;
  millmanProfile: MillmanProfile;
}> {
  if (isTauri()) {
    // Desktop: Rust-Backend
    const chart = await invokeSafe('calculate_human_design', {
      year: data.year,
      month: data.month,
      day: data.day,
      hour: data.hour,
      minute: data.minute,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezoneOffset,
    });
    
    const millmanProfile = calculateMillmanProfile({
      fullName: data.name,
      birthDate: data.birthDate,
    });
    
    return { hdChart: chart, millmanProfile };
  } else {
    // Web: Lokale Berechnung (zukünftig wasm-sweph)
    // Fallback: Analytische Formeln (mit Warnung über Genauigkeit)
    const hdChart = await calculateHDAnalytical(data);
    const millmanProfile = calculateMillmanProfile({
      fullName: data.name,
      birthDate: data.birthDate,
    });
    
    return { hdChart, millmanProfile };
  }
}
```

#### B1.3 Backend `/api/hd/calculate` — Entfernen oder umbauen

Der Endpunkt sollte entweder:
- **Entfernt** werden (wenn alles lokal berechnet wird)
- **Oder** nur noch Chart-Daten aus der DB laden, nie berechnen

**Empfohlener Ansatz:** Backend-Endpunkt entfernen. Stattdessen:
```typescript
// NEU: POST /api/hd/save-results
// Speichert nur die berechneten Chart-Daten, nicht Geburtsdaten
router.post('/save-results', authenticate, asyncHandler(async (req, res) => {
  const data = saveHDSchema.parse(req.body);
  const userId = req.user!.userId;
  
  // Nur Chart-Ergebnisse speichern, KEINE Geburtsdaten
  await prisma.humanDesignProfile.upsert({...});
  
  res.json({ success: true });
}));
```

### B2. `kimi-plugin-inspect-react` aus Production entfernen

#### B2.1 `app/vite.config.ts`

```typescript
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    // Nur im Development-Modus laden
    mode === 'development' && (await import('kimi-plugin-inspect-react')).inspectAttr(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

**Alternative (einfacher):** Plugin komplett entfernen und nur bei Bedarf manuell hinzufügen.

### B3. Backend Design-Offset iterativ berechnen

#### B3.1 `backend/src/services/ephemeris.ts` — `calculateHDMoments` ersetzen

```typescript
export function calculateHDMoments(
  birthJd: number,
  includeOuter = true
): { design: Map<string, PlanetPosition>; personality: Map<string, PlanetPosition> } {
  ensureInitialized();
  
  const flags = sweph.SE_EQUATORIAL;
  
  // 1. Sonnen-Longitude zur Geburt
  const birthSun = sweph.calc_ut(birthJd, sweph.SE_SUN, flags);
  const birthSunLon = birthSun.data[0];
  
  // 2. Iterativ: Finde JD wo Sonne 88° vor birthSunLon steht
  let designJd = birthJd - 89.0;
  const targetArc = 88.0;
  const tolerance = 0.001;
  
  for (let i = 0; i < 20; i++) {
    const designSun = sweph.calc_ut(designJd, sweph.SE_SUN, flags);
    const diff = ((birthSunLon - designSun.data[0]) % 360 + 360) % 360;
    const error = diff - targetArc;
    
    if (Math.abs(error) < tolerance) break;
    
    const speed = designSun.data[3]; // longitude speed
    if (Math.abs(speed) < 0.01) {
      designJd -= error / 0.9856;
    } else {
      designJd -= error / speed;
    }
  }
  
  const personality = calculateAllPlanets(birthJd, includeOuter);
  const design = calculateAllPlanets(designJd, includeOuter);
  
  return { design, personality };
}
```

### B4. Zod Versions-Mismatch fixen

#### B4.1 Frontend Zod downgraden oder Backend upgraden

**Empfehlung:** Beide auf Zod 3.22.4 (Backend-Version) bringen für Kompatibilität.

```bash
cd app
pnpm remove zod
pnpm add zod@3.22.4
```

---

## PHASE C: PRODUCTION-HÄRTUNG (5 Tage)

### C1. Docker Multi-Stage Build

#### C1.1 `backend/Dockerfile`

```dockerfile
# ============================================================================
# BUILD STAGE
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build TypeScript
RUN pnpm run build

# ============================================================================
# PRODUCTION STAGE
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.pnpm/@prisma+client* ./node_modules/.pnpm/
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy ephemeris files (if available)
COPY ephemeris ./ephemeris

# Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app/ephemeris
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/index.js"]
```

#### C1.2 `docker-compose.yml` (Production)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: synthesis-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: synthesis_engine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: synthesis-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: synthesis-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_URL: ${DIRECT_URL}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      REDIS_URL: ${REDIS_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SE_EPHE_PATH: ./ephemeris
      RATE_LIMIT_WINDOW_MS: 60000
      RATE_LIMIT_MAX_REQUESTS: 100
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    # Kein Volume-Mounting in Production!
    # Kein dev-command!

volumes:
  postgres_data:
  redis_data:
```

### C2. Graceful Shutdown + Health Checks

#### C2.1 `backend/src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression'; // HINZUFÜGEN
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';

// ... existing imports ...

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression()); // HINZUFÜGEN
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));

// ... existing rate limiting ...

// Health check mit DB-Verbindung
app.get('/health', async (req, res) => {
  try {
    // Prüfe DB-Verbindung
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// ... existing routes ...

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Synthesis Engine API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      console.log('Database connections closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### C3. E-Mail-Service integrieren

#### C3.1 `backend/src/services/email.ts` (Neue Datei)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Passwort zurücksetzen — Synthesis Engine',
    html: `
      <h1>Passwort zurücksetzen</h1>
      <p>Klicke auf den folgenden Link, um dein Passwort zurückzusetzen:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Dieser Link ist 1 Stunde gültig.</p>
    `,
  });
}

export async function sendVerificationEmail(email: string, verifyToken: string): Promise<void> {
  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${verifyToken}`;
  
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'E-Mail-Adresse bestätigen — Synthesis Engine',
    html: `
      <h1>Willkommen bei Synthesis Engine</h1>
      <p>Klicke auf den folgenden Link, um deine E-Mail-Adresse zu bestätigen:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
    `,
  });
}
```

#### C3.2 `.env.example` erweitern

```env
# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
FROM_EMAIL=noreply@synthesis-engine.com
APP_URL=https://synthesis-engine.com
```

### C4. Per-User Rate Limiting für teure API-Calls

#### C4.1 `backend/src/middleware/rateLimit.ts` (Neue Datei)

```typescript
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';

// Generelles Rate Limiting (bestehend)
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
});

// Auth-spezifisches Rate Limiting (bestehend)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// AI / Synthesis Rate Limiting pro User
export const synthesisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 20, // 20 Synthesen pro Stunde
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: { 
    error: 'AI synthesis limit reached. Please try again later.',
    limit: 20,
    window: '1h',
  },
});

// Transit Range Rate Limiting (verhindert DoS durch große Ranges)
export const transitRangeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 10,
  keyGenerator: (req) => req.user?.userId || req.ip,
});
```

### C5. Strukturiertes Logging

#### C5.1 `backend/src/lib/logger.ts` (Neue Datei)

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'synthesis-engine-api',
    version: process.env.npm_package_version,
  },
});

// Request Logger Middleware
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      req: {
        method: req.method,
        url: req.url,
        userId: req.user?.userId,
        ip: req.ip,
      },
      res: {
        statusCode: res.statusCode,
        duration,
      },
    }, `${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  
  next();
}
```

### C6. Request-/Trace-IDs

#### C6.1 `backend/src/middleware/traceId.ts` (Neue Datei)

```typescript
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = req.headers['x-trace-id'] as string || randomUUID();
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
}
```

---

## PHASE D: QUALITÄTSSICHERUNG (4 Tage)

### D1. API Integration Tests

#### D1.1 `backend/src/tests/auth.test.ts` (Neue Datei)

```typescript
import request from 'supertest';
import { app } from '../index';
import { prisma } from '../lib/prisma';

describe('Auth API', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: 'Test User',
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });
  });
});
```

### D2. E2E Tests mit Playwright

#### D2.1 `app/e2e/onboarding.spec.ts` (Neue Datei)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('user can complete onboarding', async ({ page }) => {
    await page.goto('/');
    
    // Step 1: Welcome
    await page.click('text=Weiter');
    
    // Step 2: Name
    await page.fill('input[placeholder="Dein Name"]', 'Max Mustermann');
    await page.click('text=Weiter');
    
    // Step 3: Birthdate
    await page.click('text=Datum wählen');
    await page.click('text=15'); // Tag auswählen
    await page.click('text=Weiter');
    
    // ... weitere Steps
    
    // Ergebnisse sollten angezeigt werden
    await expect(page.locator('text=Human Design')).toBeVisible();
  });
});
```

#### D2.2 Playwright konfigurieren

```bash
cd app
pnpm add -D @playwright/test
pnpm exec playwright install
```

### D3. GitHub Actions CI/CD

#### D3.1 `.github/workflows/ci.yml` (Neue Datei)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run test
      - run: pnpm run build

  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: cd backend && pnpm install --frozen-lockfile
      - run: cd backend && pnpm prisma generate
      - run: cd backend && pnpm prisma migrate deploy
      - run: cd backend && pnpm run test
      - run: cd backend && pnpm run build

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-action@stable
      - run: cd app/src-tauri && cargo test
```

### D4. Performance-Monitoring

#### D4.1 `backend/src/middleware/performance.ts` (Neue Datei)

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    
    // Log slow requests (> 1s)
    if (durationMs > 1000) {
      logger.warn({
        type: 'slow_request',
        method: req.method,
        url: req.url,
        durationMs,
        userId: req.user?.userId,
      }, `Slow request: ${req.method} ${req.url} took ${durationMs.toFixed(2)}ms`);
    }
  });
  
  next();
}
```

---

## PHASE E: DEPLOYMENT & RELEASE (1 Tag)

### E1. Environment-Variablen-Checkliste

| Variable | Required | Beschreibung |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL Connection String |
| `DIRECT_URL` | ✅ | Prisma Direct Connection |
| `JWT_ACCESS_SECRET` | ✅ | Mindestens 32 Zeichen |
| `JWT_REFRESH_SECRET` | ✅ | Mindestens 32 Zeichen, != Access Secret |
| `OPENAI_API_KEY` | ⚠️ | Nur wenn KI-Synthese aktiv |
| `SMTP_HOST` | ✅ | Für E-Mail-Funktionalität |
| `SMTP_USER` | ✅ | SMTP Benutzername |
| `SMTP_PASSWORD` | ✅ | SMTP Passwort |
| `FROM_EMAIL` | ✅ | Absender-E-Mail |
| `APP_URL` | ✅ | Öffentliche App-URL |
| `CORS_ORIGINS` | ✅ | Komma-separierte erlaubte Origins |
| `SE_EPHE_PATH` | ⚠️ | Pfad zu Swiss Ephemeris .se1 Dateien |
| `REDIS_URL` | ⚠️ | Für Sessions/Rate Limiting |
| `NODE_ENV` | ✅ | `production` |
| `LOG_LEVEL` | ❌ | `info`, `warn`, `error` (default: info) |

### E2. Pre-Deployment Checklist

- [ ] Alle HIGH-Fehler aus dem Audit sind gefixt
- [ ] Alle Tests laufen grün (Frontend, Backend, Rust)
- [ ] E2E-Tests laufen grün
- [ ] Docker-Build erfolgreich
- [ ] Security-Scan (Dependabot, `npm audit`) sauber
- [ ] Environment-Variablen im Production-Environment gesetzt
- [ ] Datenbank-Migrationen sind vorbereitet
- [ ] SSL-Zertifikate konfiguriert
- [ ] Backup-Strategie definiert
- [ ] Rollback-Plan dokumentiert

### E3. Runbook (Erste Schritte nach Deployment)

```bash
# 1. Datenbank-Migrationen ausführen
cd backend
pnpm prisma migrate deploy

# 2. Seed-Daten laden (nur bei erstem Deployment)
pnpm prisma db seed

# 3. Swiss Ephemeris Dateien prüfen
ls -la backend/ephemeris/*.se1

# 4. Health Check
curl https://api.synthesis-engine.com/health

# 5. Logs überwachen
docker logs -f synthesis-backend

# 6. Metriken prüfen (nach Einrichtung)
# Grafana Dashboard öffnen
```

---

## ANHANG A: DEPENDENCY-UPDATES

### Frontend (`app/package.json`)

```json
{
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

### Backend (`backend/package.json`)

```json
{
  "dependencies": {
    "compression": "^1.7.4",
    "nodemailer": "^6.9.7",
    "pino": "^8.16.0",
    "pino-pretty": "^10.2.0"
  },
  "devDependencies": {
    "@types/compression": "^1.7.4",
    "@types/nodemailer": "^6.4.14",
    "@types/supertest": "^6.0.0",
    "supertest": "^6.3.3"
  }
}
```

---

## ANHANG B: MIGRATIONS-ÜBERSICHT

### Prisma Migration (falls nötig)

```prisma
// SynthesisCache.expiresAt sollte required sein
model SynthesisCache {
  // ...
  expiresAt DateTime // Entferne "?"
}
```

```bash
cd backend
pnpm prisma migrate dev --name make_expires_at_required
```

---

## ANHANG C: PERFORMANCE-BUDGET

| Metrik | Ziel | Grenzwert |
|--------|------|-----------|
| First Contentful Paint (FCP) | < 1.5s | 2.0s |
| Largest Contentful Paint (LCP) | < 2.5s | 3.5s |
| Time to Interactive (TTI) | < 3.5s | 5.0s |
| API Response (p95) | < 200ms | 500ms |
| API Response (p99) | < 500ms | 1000ms |
| Database Query (p95) | < 50ms | 100ms |

---

> Ende des Production Ready Plans. Jede Phase ist als eigenständiger Milestone umsetzbar.
> Empfohlene Reihenfolge: A → B → C → D → E
