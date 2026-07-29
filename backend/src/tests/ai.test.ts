/**
 * AI Proxy Routes API Contract Tests (supertest)
 *
 * Exercises the real aiRouter with mocked callAIProvider (no outbound
 * network) and a mocked verifyAccessToken with FREE and PREMIUM identities.
 * The real proxyRequestSchema is kept so the validation cases exercise the
 * actual Zod contract.
 */

import express from 'express';
import request from 'supertest';
import { APIError } from '../middleware/errorHandler';

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

jest.mock('../services/aiProvider', () => {
  const actual = jest.requireActual('../services/aiProvider');
  return {
    ...actual,
    callAIProvider: jest.fn(),
  };
});

import { aiRouter } from '../routes/ai';
import { callAIProvider } from '../services/aiProvider';
import { errorHandler } from '../middleware/errorHandler';

const mockCallAIProvider = callAIProvider as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  app.use(errorHandler);
  return app;
}

const asPremium = { Authorization: 'Bearer token-premium' };
const asFree = { Authorization: 'Bearer token-free' };
const withApiKey = { 'X-AI-API-Key': 'sk-user-key' };

const VALID_PROXY_BODY = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hallo' }],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ai routes', () => {
  describe('POST /proxy', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/ai/proxy').send(VALID_PROXY_BODY);
      expect(res.status).toBe(401);
    });

    test('403 for FREE tier (requires PREMIUM or PRO)', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/proxy')
        .set({ ...asFree, ...withApiKey })
        .send(VALID_PROXY_BODY);

      expect(res.status).toBe(403);
      expect(res.body.upgradeRequired).toBe(true);
      expect(mockCallAIProvider).not.toHaveBeenCalled();
    });

    test('400 without the X-AI-API-Key header', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/proxy')
        .set(asPremium)
        .send(VALID_PROXY_BODY);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/API key required/);
    });

    test('400 when the body fails schema validation (unknown provider)', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/proxy')
        .set({ ...asPremium, ...withApiKey })
        .send({ ...VALID_PROXY_BODY, provider: 'mistral' });

      expect(res.status).toBe(400);
      expect(mockCallAIProvider).not.toHaveBeenCalled();
    });

    test('200 proxies the provider response on the happy path', async () => {
      mockCallAIProvider.mockResolvedValue({
        choices: [{ message: { role: 'assistant', content: 'Antwort' } }],
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/proxy')
        .set({ ...asPremium, ...withApiKey })
        .send(VALID_PROXY_BODY);

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe('Antwort');
      expect(mockCallAIProvider).toHaveBeenCalledWith(
        'sk-user-key',
        expect.objectContaining({ provider: 'openai', model: 'gpt-4o-mini' })
      );
    });

    test('preserves APIError status codes (e.g. the SSRF guard 400)', async () => {
      mockCallAIProvider.mockRejectedValue(
        new APIError('Base URL points to a blocked/internal address', 400, 'BLOCKED_BASE_URL')
      );

      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/proxy')
        .set({ ...asPremium, ...withApiKey })
        .send({ ...VALID_PROXY_BODY, provider: 'custom', baseUrl: 'http://169.254.169.254' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BLOCKED_BASE_URL');
    });

    test('502 when the provider call fails generically', async () => {
      mockCallAIProvider.mockRejectedValue(new Error('upstream exploded'));

      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/proxy')
        .set({ ...asPremium, ...withApiKey })
        .send(VALID_PROXY_BODY);

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('AI_PROVIDER_ERROR');
    });
  });

  describe('GET /models', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/ai/models');
      expect(res.status).toBe(401);
    });

    test('200 lists models per provider', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/ai/models').set(asFree);

      expect(res.status).toBe(200);
      expect(res.body.openai.length).toBeGreaterThan(0);
      expect(res.body.anthropic.length).toBeGreaterThan(0);
      expect(res.body.google.length).toBeGreaterThan(0);
    });
  });

  describe('POST /estimate-cost', () => {
    test('200 returns a cost breakdown', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/estimate-cost')
        .set(asFree)
        .send({ provider: 'openai', model: 'gpt-4o-mini', estimatedTokens: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.currency).toBe('USD');
      expect(res.body.estimatedCost).toBeGreaterThan(0);
      expect(res.body.breakdown.inputTokens).toBe(700);
    });

    test('400 for an unknown model', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/estimate-cost')
        .set(asFree)
        .send({ provider: 'openai', model: 'gpt-99-ultra', estimatedTokens: 1000 });

      expect(res.status).toBe(400);
    });

    test('400 when estimatedTokens fails validation', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/ai/estimate-cost')
        .set(asFree)
        .send({ provider: 'openai', model: 'gpt-4o-mini', estimatedTokens: 0 });

      expect(res.status).toBe(400);
    });
  });
});
