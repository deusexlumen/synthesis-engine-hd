/**
 * Tier-based ephemeris provider selection tests (Phase C).
 *
 * Covers two levels:
 * 1. resolveProvider()/getAvailableProviders() unit matrix — tier ×
 *    EPHEMERIS_PRO_ENABLED flag.
 * 2. POST /api/hd/calculate contract per tier — accuracy label,
 *    meta.ephemerisProvider, meta.swissephVersion presence and
 *    meta.missingBodies (Chiron on the standard tier).
 *
 * Env manipulation: EPHEMERIS_PRO_ENABLED is read lazily (lib/config), so
 * setting/deleting process.env per test is sufficient — no module resets.
 * In NODE_ENV=test the sweph mock counts as loadable, and the real
 * .se1 fixture files in backend/ephemeris make the SwephProvider report
 * usingFiles=true (→ accuracy PROFESSIONAL).
 */

import express from 'express';
import request from 'supertest';

jest.mock('sweph', () => jest.requireActual('../__mocks__/sweph'), { virtual: true });

jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-free') {
      return { userId: 'user-free', email: 'free@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    if (token === 'token-basic') {
      return { userId: 'user-basic', email: 'basic@test.dev', roles: ['USER'], tier: 'BASIC' };
    }
    if (token === 'token-premium') {
      return { userId: 'user-premium', email: 'premium@test.dev', roles: ['USER'], tier: 'PREMIUM' };
    }
    if (token === 'token-pro') {
      return { userId: 'user-pro', email: 'pro@test.dev', roles: ['USER'], tier: 'PRO' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

jest.mock('../lib/prisma', () => ({ prisma: {} }));

import { resolveProvider, getAvailableProviders } from '../services/ephemeris/resolver';
import { hdRouter } from '../routes/humanDesign';
import { errorHandler } from '../middleware/errorHandler';

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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/hd', hdRouter);
  app.use(errorHandler);
  return app;
}

/** Snapshot and restore EPHEMERIS_PRO_ENABLED around each test. */
let savedFlag: string | undefined;

beforeEach(() => {
  savedFlag = process.env.EPHEMERIS_PRO_ENABLED;
});

afterEach(() => {
  if (savedFlag === undefined) {
    delete process.env.EPHEMERIS_PRO_ENABLED;
  } else {
    process.env.EPHEMERIS_PRO_ENABLED = savedFlag;
  }
});

describe('resolveProvider (unit matrix)', () => {
  describe('flag OFF (default)', () => {
    beforeEach(() => {
      delete process.env.EPHEMERIS_PRO_ENABLED;
    });

    test.each(['FREE', 'BASIC', 'PREMIUM', 'PRO', 'unknown-tier'])(
      'tier %s → standard provider',
      (tier) => {
        expect(resolveProvider(tier).name).toBe('standard');
      }
    );
  });

  describe('flag ON', () => {
    beforeEach(() => {
      process.env.EPHEMERIS_PRO_ENABLED = 'true';
    });

    test.each(['FREE', 'BASIC', 'unknown-tier'])(
      'tier %s → standard provider',
      (tier) => {
        expect(resolveProvider(tier).name).toBe('standard');
      }
    );

    test.each(['PREMIUM', 'PRO'])(
      'tier %s → swiss-professional provider',
      (tier) => {
        expect(resolveProvider(tier).name).toBe('swiss-professional');
      }
    );

    test('flag values other than "true" do not enable the professional tier', () => {
      process.env.EPHEMERIS_PRO_ENABLED = '1';
      expect(resolveProvider('PREMIUM').name).toBe('standard');
      process.env.EPHEMERIS_PRO_ENABLED = 'TRUE';
      expect(resolveProvider('PREMIUM').name).toBe('standard');
    });
  });

  test('returns shared singleton instances', () => {
    delete process.env.EPHEMERIS_PRO_ENABLED;
    expect(resolveProvider('FREE')).toBe(resolveProvider('BASIC'));

    process.env.EPHEMERIS_PRO_ENABLED = 'true';
    expect(resolveProvider('PREMIUM')).toBe(resolveProvider('PRO'));
    expect(resolveProvider('FREE')).not.toBe(resolveProvider('PREMIUM'));
  });
});

describe('getAvailableProviders', () => {
  test('reports both backends; standard is always available', () => {
    delete process.env.EPHEMERIS_PRO_ENABLED;
    const providers = getAvailableProviders();

    const pro = providers.find((p) => p.name === 'swiss-professional');
    const standard = providers.find((p) => p.name === 'standard');

    expect(pro).toBeDefined();
    expect(pro?.available).toBe(true); // sweph mock is loadable in tests
    expect(pro?.enabledByConfig).toBe(false);
    expect(standard?.available).toBe(true);

    process.env.EPHEMERIS_PRO_ENABLED = 'true';
    const enabled = getAvailableProviders().find((p) => p.name === 'swiss-professional');
    expect(enabled?.enabledByConfig).toBe(true);
  });
});

describe('POST /api/hd/calculate — tier matrix', () => {
  describe('flag OFF', () => {
    beforeEach(() => {
      delete process.env.EPHEMERIS_PRO_ENABLED;
    });

    test('guest (no token) → STANDARD, standard provider, Chiron missing', async () => {
      const res = await request(buildApp()).post('/api/hd/calculate').send(VALID_BIRTH_DATA);

      expect(res.status).toBe(200);
      expect(res.body.accuracy).toBe('STANDARD');
      expect(res.body.meta.ephemerisProvider).toBe('standard');
      expect(res.body.meta.swissephVersion).toBeUndefined();
      expect(res.body.meta.missingBodies).toContain('CHIRON');
    });

    test('FREE token → STANDARD', async () => {
      const res = await request(buildApp())
        .post('/api/hd/calculate')
        .set('Authorization', 'Bearer token-free')
        .send(VALID_BIRTH_DATA);

      expect(res.status).toBe(200);
      expect(res.body.accuracy).toBe('STANDARD');
      expect(res.body.meta.ephemerisProvider).toBe('standard');
    });

    test('PREMIUM token with flag off → STANDARD', async () => {
      const res = await request(buildApp())
        .post('/api/hd/calculate')
        .set('Authorization', 'Bearer token-premium')
        .send(VALID_BIRTH_DATA);

      expect(res.status).toBe(200);
      expect(res.body.accuracy).toBe('STANDARD');
      expect(res.body.meta.ephemerisProvider).toBe('standard');
    });
  });

  describe('flag ON', () => {
    beforeEach(() => {
      process.env.EPHEMERIS_PRO_ENABLED = 'true';
    });

    test('guest still → STANDARD', async () => {
      const res = await request(buildApp()).post('/api/hd/calculate').send(VALID_BIRTH_DATA);

      expect(res.status).toBe(200);
      expect(res.body.accuracy).toBe('STANDARD');
      expect(res.body.meta.ephemerisProvider).toBe('standard');
    });

    test('BASIC token → STANDARD', async () => {
      const res = await request(buildApp())
        .post('/api/hd/calculate')
        .set('Authorization', 'Bearer token-basic')
        .send(VALID_BIRTH_DATA);

      expect(res.status).toBe(200);
      expect(res.body.accuracy).toBe('STANDARD');
    });

    test.each(['token-premium', 'token-pro'])(
      '%s → PROFESSIONAL with swissephVersion and complete bodies',
      async (token) => {
        const res = await request(buildApp())
          .post('/api/hd/calculate')
          .set('Authorization', `Bearer ${token}`)
          .send(VALID_BIRTH_DATA);

        expect(res.status).toBe(200);
        expect(res.body.accuracy).toBe('PROFESSIONAL');
        expect(res.body.meta.ephemerisProvider).toBe('swiss-professional');
        expect(res.body.meta.swissephVersion).toEqual(expect.any(String));
        expect(res.body.meta.missingBodies).toEqual([]);
      }
    );
  });
});
