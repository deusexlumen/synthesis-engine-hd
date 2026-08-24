/**
 * Boot safety without OPENAI_API_KEY.
 *
 * synthesis.ts used to build `new OpenAI()` at module load, and the OpenAI
 * SDK throws in its constructor when the key is missing. Since index.ts
 * imports the router at startup, a deployment without OPENAI_API_KEY did not
 * degrade — the whole process died before it ever listened. Every existing
 * suite missed it because they mock the openai module away.
 *
 * The real openai package is deliberately NOT mocked here.
 *
 * The key is cleared *after* the requires, not before: importing
 * @prisma/client (via errorHandler) loads backend/.env and repopulates
 * process.env, which is exactly why local runs never reproduced the crash
 * while the container — which has no .env file — died on startup.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-premium') {
      return { userId: 'user-premium', email: 'premium@test.dev', roles: ['USER'], tier: 'PREMIUM' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

jest.mock('../lib/prisma', () => ({
  prisma: {
    synthesisCache: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({})),
    },
  },
}));

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

const originalKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  jest.resetModules();
});

afterAll(() => {
  if (originalKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalKey;
  }
});

describe('synthesis router without OPENAI_API_KEY', () => {
  test('the module imports without throwing', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../routes/synthesis');
    }).not.toThrow();
  });

  test('POST /generate answers 503 instead of killing the process', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { synthesisRouter } = require('../routes/synthesis');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { errorHandler } = require('../middleware/errorHandler');

    const app = express();
    app.use(express.json());
    app.use('/api/synthesis', synthesisRouter);
    app.use(errorHandler);

    delete process.env.OPENAI_API_KEY;

    const res = await request(app)
      .post('/api/synthesis/generate')
      .set({ Authorization: 'Bearer token-premium' })
      .send(VALID_BODY);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_NOT_CONFIGURED');
  });
});
