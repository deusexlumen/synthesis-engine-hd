/**
 * Coaching Routes API Contract Tests (supertest)
 *
 * Exercises the real coachingRouter with a mocked coaching service (the
 * transit/LLM internals are covered by coaching.test.ts), a mocked
 * verifyAccessToken (FREE + PREMIUM) and an in-memory dailyCoaching fake.
 */

import express from 'express';
import request from 'supertest';

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

jest.mock('../services/coaching', () => ({
  getOrCreateDailyCoaching: jest.fn(),
}));

interface FakeCoaching {
  id: string;
  userId: string;
  date: Date;
  impulseText: string;
  transitData: unknown;
  isRead: boolean;
}

let entries: FakeCoaching[];

jest.mock('../lib/prisma', () => ({
  prisma: {
    dailyCoaching: {
      update: jest.fn(async ({ where, data }: any) => {
        const entry = entries.find(
          (e) =>
            e.userId === where.userId_date.userId &&
            e.date.getTime() === where.userId_date.date.getTime()
        );
        if (!entry) {
          const err = new Error('Record not found');
          (err as any).code = 'P2025';
          throw err;
        }
        Object.assign(entry, data);
        return entry;
      }),
      findMany: jest.fn(async ({ where, take, skip }: any) =>
        entries
          .filter((e) => e.userId === where.userId)
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(skip ?? 0, (skip ?? 0) + (take ?? entries.length))
      ),
    },
  },
}));

import { coachingRouter } from '../routes/coaching';
import { getOrCreateDailyCoaching } from '../services/coaching';
import { errorHandler } from '../middleware/errorHandler';

const mockGetOrCreate = getOrCreateDailyCoaching as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/coaching', coachingRouter);
  app.use(errorHandler);
  return app;
}

const asPremium = { Authorization: 'Bearer token-premium' };
const asFree = { Authorization: 'Bearer token-free' };

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

beforeEach(() => {
  entries = [];
  jest.clearAllMocks();
});

describe('coaching routes', () => {
  describe('GET /daily', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/coaching/daily');
      expect(res.status).toBe(401);
    });

    test('403 for FREE tier (requires PREMIUM or PRO)', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/coaching/daily').set(asFree);

      expect(res.status).toBe(403);
      expect(mockGetOrCreate).not.toHaveBeenCalled();
    });

    test('200 returns today\'s impulse for PREMIUM', async () => {
      mockGetOrCreate.mockResolvedValue({
        date: todayMidnight(),
        impulseText: 'Heute steht die Sonne in Tor 15 ...',
        transitData: { sunGate: 15, moonGate: 8 },
        isRead: false,
      });

      const app = buildApp();
      const res = await request(app).get('/api/coaching/daily').set(asPremium);

      expect(res.status).toBe(200);
      expect(res.body.impulse).toMatch(/Sonne in Tor 15/);
      expect(res.body.isRead).toBe(false);
      // Third arg: the tier-resolved ephemeris provider (Phase C).
      expect(mockGetOrCreate).toHaveBeenCalledWith('user-premium', undefined, expect.objectContaining({ name: expect.any(String) }));
    });

    test('passes BYOK credentials from headers to the service', async () => {
      mockGetOrCreate.mockResolvedValue({
        date: todayMidnight(),
        impulseText: 'LLM-Impuls',
        transitData: {},
        isRead: false,
      });

      const app = buildApp();
      const res = await request(app)
        .get('/api/coaching/daily')
        .set({ ...asPremium, 'X-AI-API-Key': 'sk-user', 'X-AI-Provider': 'anthropic' });

      expect(res.status).toBe(200);
      expect(mockGetOrCreate).toHaveBeenCalledWith(
        'user-premium',
        expect.objectContaining({ provider: 'anthropic', apiKey: 'sk-user' }),
        // Third arg: the tier-resolved ephemeris provider (Phase C).
        expect.objectContaining({ name: expect.any(String) })
      );
    });
  });

  describe('POST /daily/read', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/coaching/daily/read');
      expect(res.status).toBe(401);
    });

    test('200 marks today\'s entry as read', async () => {
      entries.push({
        id: 'c1',
        userId: 'user-premium',
        date: todayMidnight(),
        impulseText: 'Impuls',
        transitData: {},
        isRead: false,
      });

      const app = buildApp();
      const res = await request(app).post('/api/coaching/daily/read').set(asPremium);

      expect(res.status).toBe(200);
      expect(entries[0].isRead).toBe(true);
    });
  });

  describe('GET /history', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/coaching/history');
      expect(res.status).toBe(401);
    });

    test('200 returns only the user\'s own history, newest first', async () => {
      const today = todayMidnight();
      const yesterday = new Date(today.getTime() - 24 * 3600_000);
      entries.push(
        { id: 'c1', userId: 'user-premium', date: yesterday, impulseText: 'Alt', transitData: {}, isRead: true },
        { id: 'c2', userId: 'user-premium', date: today, impulseText: 'Neu', transitData: {}, isRead: false },
        { id: 'c3', userId: 'someone-else', date: today, impulseText: 'Fremd', transitData: {}, isRead: false }
      );

      const app = buildApp();
      const res = await request(app).get('/api/coaching/history').set(asPremium);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].impulseText).toBe('Neu');
      expect(res.body[1].impulseText).toBe('Alt');
    });

    test('honors limit and offset', async () => {
      const today = todayMidnight();
      for (let i = 0; i < 5; i++) {
        entries.push({
          id: `c${i}`,
          userId: 'user-premium',
          date: new Date(today.getTime() - i * 24 * 3600_000),
          impulseText: `Impuls ${i}`,
          transitData: {},
          isRead: false,
        });
      }

      const app = buildApp();
      const res = await request(app)
        .get('/api/coaching/history?limit=2&offset=1')
        .set(asPremium);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].impulseText).toBe('Impuls 1');
    });
  });
});
