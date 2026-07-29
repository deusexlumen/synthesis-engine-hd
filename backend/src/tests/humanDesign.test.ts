/**
 * Human Design Routes API Contract Tests (supertest)
 *
 * Exercises the real hdRouter with the deterministic sweph mock (chart
 * calculation runs for real against fake planet positions), a mocked
 * verifyAccessToken (user + admin identities) and an in-memory Prisma fake.
 *
 * The /save contract covered here is the post-M13 one: only birth data is
 * accepted, the chart is recomputed server-side and any client-supplied
 * chart values in the payload are ignored.
 */

import express from 'express';
import request from 'supertest';

jest.mock('sweph', () => jest.requireActual('../__mocks__/sweph'), { virtual: true });

jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-user-1') {
      return { userId: 'user-1', email: 'one@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    if (token === 'token-admin') {
      return { userId: 'admin-1', email: 'admin@test.dev', roles: ['USER', 'ADMIN'], tier: 'PRO' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

interface FakeProfile {
  id: string;
  userId: string;
  [key: string]: unknown;
}

let profiles: FakeProfile[];
let lastCreateArgs: any;

const prismaFake: any = {
  $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(prismaFake)),
  humanDesignProfile: {
    deleteMany: jest.fn(async ({ where }: any) => {
      profiles = profiles.filter((p) => p.userId !== where.userId);
      return { count: 0 };
    }),
    create: jest.fn(async (args: any) => {
      lastCreateArgs = args;
      const profile: FakeProfile = { id: `hd-profile-${profiles.length + 1}`, ...args.data };
      profiles.push(profile);
      return profile;
    }),
    findUnique: jest.fn(async ({ where }: any) =>
      profiles.find((p) => p.userId === where.userId) ?? null
    ),
  },
  communityStats: {
    findMany: jest.fn(async () => [
      { statType: 'energy_type', value: 'GENERATOR', percentage: 37.5 },
    ]),
  },
};

jest.mock('../lib/prisma', () => ({ prisma: prismaFake }));

import { hdRouter } from '../routes/humanDesign';
import { calculateHumanDesignChart } from '../services/humanDesignCalculator';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/hd', hdRouter);
  app.use(errorHandler);
  return app;
}

const asUser1 = { Authorization: 'Bearer token-user-1' };
const asAdmin = { Authorization: 'Bearer token-admin' };

const VALID_BIRTH_DATA = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  latitude: 52.52,
  longitude: 13.405,
  timezone: 2,
};

beforeEach(() => {
  profiles = [];
  lastCreateArgs = undefined;
  jest.clearAllMocks();
});

describe('humanDesign routes', () => {
  describe('POST /calculate', () => {
    test('200 computes a chart for a guest (no auth required)', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/hd/calculate').send(VALID_BIRTH_DATA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.energyType).toBeTruthy();
      expect(res.body.data.gates.length).toBeGreaterThan(0);
      expect(res.body.meta.birthData.julianDay).toEqual(expect.any(Number));
    });

    test('400 when birth data fails validation', async () => {
      const app = buildApp();

      const badMonth = await request(app)
        .post('/api/hd/calculate')
        .send({ ...VALID_BIRTH_DATA, month: 13 });
      expect(badMonth.status).toBe(400);

      const badLatitude = await request(app)
        .post('/api/hd/calculate')
        .send({ ...VALID_BIRTH_DATA, latitude: 123 });
      expect(badLatitude.status).toBe(400);

      const missing = await request(app).post('/api/hd/calculate').send({ year: 1990 });
      expect(missing.status).toBe(400);
    });
  });

  describe('POST /save (server-computed persistence, M13)', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/hd/save')
        .send({ birthData: VALID_BIRTH_DATA });
      expect(res.status).toBe(401);
    });

    test('200 persists the server-computed chart, not client-supplied values', async () => {
      const app = buildApp();

      // The payload deliberately includes forged chart fields alongside the
      // birth data — they must be stripped/ignored, and the persisted
      // profile must match the server-side calculation exactly.
      const res = await request(app)
        .post('/api/hd/save')
        .set(asUser1)
        .send({
          birthData: VALID_BIRTH_DATA,
          energyType: 'REFLECTOR',
          authority: 'LUNAR',
          profileLine1: 6,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const expected = calculateHumanDesignChart(VALID_BIRTH_DATA);
      expect(lastCreateArgs.data.userId).toBe('user-1');
      expect(lastCreateArgs.data.energyType).toBe(expected.energyType);
      expect(lastCreateArgs.data.authority).toBe(expected.authority);
      expect(lastCreateArgs.data.profileLine1).toBe(expected.profileLine1);
      expect(lastCreateArgs.data.profileLine2).toBe(expected.profileLine2);
      expect(lastCreateArgs.data.gates.create).toHaveLength(expected.gates.length);
      expect(lastCreateArgs.data.centers.create).toHaveLength(expected.definedCenters.length);
    });

    test('400 when birthData is missing or invalid', async () => {
      const app = buildApp();

      const missing = await request(app).post('/api/hd/save').set(asUser1).send({});
      expect(missing.status).toBe(400);

      const invalid = await request(app)
        .post('/api/hd/save')
        .set(asUser1)
        .send({ birthData: { ...VALID_BIRTH_DATA, timezone: 99 } });
      expect(invalid.status).toBe(400);
    });
  });

  describe('GET /profile', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/profile');
      expect(res.status).toBe(401);
    });

    test('404 when the user has no profile', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/profile').set(asUser1);
      expect(res.status).toBe(404);
    });

    test('200 returns the stored profile after saving', async () => {
      const app = buildApp();
      await request(app).post('/api/hd/save').set(asUser1).send({ birthData: VALID_BIRTH_DATA });

      const res = await request(app).get('/api/hd/profile').set(asUser1);
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user-1');
    });
  });

  describe('GET /stats', () => {
    test('200 returns community stats without auth', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/stats');

      expect(res.status).toBe(200);
      expect(res.body[0].statType).toBe('energy_type');
    });
  });

  describe('GET /health', () => {
    test('200 reports ephemeris status', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/health');

      expect(res.status).toBe(200);
      expect(res.body.ephemeris).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /diagnostics (admin only)', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/diagnostics');
      expect(res.status).toBe(401);
    });

    test('403 for a non-admin user', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/diagnostics').set(asUser1);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Required role: ADMIN/);
    });

    test('200 for an admin', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/hd/diagnostics').set(asAdmin);

      expect(res.status).toBe(200);
      expect(res.body.ephePath).toBeDefined();
      expect(res.body.instructions).toBeDefined();
    });
  });
});
