/**
 * Rate-limit test for POST /api/hd/calculate (M4).
 *
 * The endpoint is the most CPU-intensive in the API (Newton-iteration
 * ephemeris) and reachable as a guest, so it has its own 10/min limiter
 * (hdCalculateLimiter) instead of sharing the generic 100/min one. This
 * suite mounts the real router with the real limiter and proves the 11th
 * request inside the window is rejected with 429.
 *
 * Runs in its own file on purpose: Jest gives every test file a fresh
 * module registry, so the limiter starts with a clean hit counter here.
 */

import express from 'express';
import request from 'supertest';

// Deterministic ephemeris so the 10 successful calculations stay fast.
jest.mock('sweph', () => jest.requireActual('../__mocks__/sweph'), { virtual: true });

// Not exercised by /calculate, but the router imports them at module load
// (PrismaClient construction, JWT-secret validation) — replace with stubs.
jest.mock('../lib/prisma', () => ({ prisma: {} }));
jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn(() => {
    throw new Error('not used in this suite');
  }),
}));

import { hdRouter } from '../routes/humanDesign';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/hd', hdRouter);
  app.use(errorHandler);
  return app;
}

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

describe('POST /api/hd/calculate rate limit (M4)', () => {
  test('allows 10 requests per minute, rejects the 11th with 429', async () => {
    const app = buildApp();

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/hd/calculate').send(VALID_BIRTH_DATA);
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post('/api/hd/calculate').send(VALID_BIRTH_DATA);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many chart calculation requests/);
  });
});
