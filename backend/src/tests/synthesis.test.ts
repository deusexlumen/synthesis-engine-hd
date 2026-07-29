/**
 * Synthesis Routes API Contract Tests (supertest)
 *
 * Exercises the real synthesisRouter with a mocked OpenAI client (the route
 * instantiates `new OpenAI()` at module load, which would throw without an
 * API key — and no test should ever hit the real API), a mocked
 * verifyAccessToken (FREE + PREMIUM) and an in-memory synthesisCache fake.
 */

import express from 'express';
import request from 'supertest';

jest.mock('openai', () => {
  const create = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    __mockCreate: create,
  };
});

jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-premium') {
      return { userId: 'user-premium', email: 'premium@test.dev', roles: ['USER'], tier: 'PREMIUM' };
    }
    if (token === 'token-free') {
      return { userId: 'user-free', email: 'free@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

interface FakeCacheEntry {
  userId: string;
  contextKey: string;
  section: string;
  generatedText: string;
  createdAt: Date;
  expiresAt: Date | null;
}

let cache: FakeCacheEntry[];

jest.mock('../lib/prisma', () => ({
  prisma: {
    synthesisCache: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { userId, contextKey, section } = where.userId_contextKey_section;
        return (
          cache.find(
            (c) => c.userId === userId && c.contextKey === contextKey && c.section === section
          ) ?? null
        );
      }),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const { userId, contextKey, section } = where.userId_contextKey_section;
        const idx = cache.findIndex(
          (c) => c.userId === userId && c.contextKey === contextKey && c.section === section
        );
        if (idx >= 0) {
          Object.assign(cache[idx], update);
          return cache[idx];
        }
        const entry: FakeCacheEntry = { ...create, createdAt: new Date() };
        cache.push(entry);
        return entry;
      }),
    },
  },
}));

import { synthesisRouter } from '../routes/synthesis';
import { errorHandler } from '../middleware/errorHandler';

const { __mockCreate: mockCreate } = jest.requireMock('openai') as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/synthesis', synthesisRouter);
  app.use(errorHandler);
  return app;
}

const asPremium = { Authorization: 'Bearer token-premium' };
const asFree = { Authorization: 'Bearer token-free' };

const VALID_BODY = {
  contextKey: 'chart-1990-05-15',
  section: 'overview',
  hdData: {
    energyType: 'GENERATOR',
    authority: 'SACRAL',
    profile: '3/5',
    definedCenters: ['SACRAL', 'THROAT'],
  },
  numerologyData: {
    lifePathString: '6-5-11',
    destinyNumber: 11,
    hasMasterNumber: true,
  },
};

beforeEach(() => {
  cache = [];
  jest.clearAllMocks();
});

describe('synthesis routes', () => {
  describe('POST /generate', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/synthesis/generate').send(VALID_BODY);
      expect(res.status).toBe(401);
    });

    test('403 for FREE tier (requires PREMIUM or PRO)', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/synthesis/generate')
        .set(asFree)
        .send(VALID_BODY);

      expect(res.status).toBe(403);
      expect(res.body.upgradeRequired).toBe(true);
    });

    test('400 when the body fails validation', async () => {
      const app = buildApp();

      const badSection = await request(app)
        .post('/api/synthesis/generate')
        .set(asPremium)
        .send({ ...VALID_BODY, section: 'horoscope' });
      expect(badSection.status).toBe(400);

      const missingHd = await request(app)
        .post('/api/synthesis/generate')
        .set(asPremium)
        .send({ contextKey: 'x', section: 'overview', numerologyData: VALID_BODY.numerologyData });
      expect(missingHd.status).toBe(400);

      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('200 generates and caches on a cache miss', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Deine Synthese.' } }],
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/synthesis/generate')
        .set(asPremium)
        .send(VALID_BODY);

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Deine Synthese.');
      expect(res.body.cached).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(cache).toHaveLength(1);
      expect(cache[0].generatedText).toBe('Deine Synthese.');
      expect(cache[0].expiresAt).toBeInstanceOf(Date);
    });

    test('200 serves a fresh cache entry without calling OpenAI', async () => {
      cache.push({
        userId: 'user-premium',
        contextKey: VALID_BODY.contextKey,
        section: VALID_BODY.section,
        generatedText: 'Aus dem Cache.',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/synthesis/generate')
        .set(asPremium)
        .send(VALID_BODY);

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Aus dem Cache.');
      expect(res.body.cached).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('regenerates when the cache entry is expired', async () => {
      cache.push({
        userId: 'user-premium',
        contextKey: VALID_BODY.contextKey,
        section: VALID_BODY.section,
        generatedText: 'Abgelaufen.',
        createdAt: new Date(Date.now() - 60 * 24 * 3600_000),
        expiresAt: new Date(Date.now() - 1000),
      });
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Frisch generiert.' } }],
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/synthesis/generate')
        .set(asPremium)
        .send(VALID_BODY);

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Frisch generiert.');
      expect(res.body.cached).toBe(false);
      // The existing row was updated in place and got a fresh expiry.
      expect(cache).toHaveLength(1);
      expect(cache[0].generatedText).toBe('Frisch generiert.');
      expect(cache[0].expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('GET /cache/:contextKey', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/synthesis/cache/whatever');
      expect(res.status).toBe(401);
    });

    test('404 when nothing is cached', async () => {
      const app = buildApp();
      const res = await request(app)
        .get('/api/synthesis/cache/whatever')
        .set(asPremium);
      expect(res.status).toBe(404);
    });

    test('200 returns the cached text', async () => {
      cache.push({
        userId: 'user-premium',
        contextKey: 'chart-1990-05-15',
        section: 'overview',
        generatedText: 'Aus dem Cache.',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      const app = buildApp();
      const res = await request(app)
        .get('/api/synthesis/cache/chart-1990-05-15?section=overview')
        .set(asPremium);

      expect(res.status).toBe(200);
      expect(res.body.text).toBe('Aus dem Cache.');
    });
  });
});
