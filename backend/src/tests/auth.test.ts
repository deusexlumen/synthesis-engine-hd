/**
 * Auth Routes API Contract Tests (supertest)
 *
 * Exercises the real authRouter through a minimal express app. The auth
 * service, email service and Prisma are mocked; verifyAccessToken maps
 * bearer tokens to deterministic identities (same pattern as
 * journal.test.ts). The rate limiter is neutralized (authLimiter allows
 * only 5 requests per 15 min per IP — every supertest request shares one
 * IP, so the suite would otherwise 429 itself); rate limiting is covered
 * separately in humanDesignRateLimit.test.ts.
 */

import express from 'express';
import request from 'supertest';
import { APIError } from '../middleware/errorHandler';

jest.mock('../middleware/rateLimit', () => ({
  authLimiter: (req: any, res: any, next: any) => next(),
  generalLimiter: (req: any, res: any, next: any) => next(),
}));

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  changePassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
};

jest.mock('../services/auth', () => ({
  authService: mockAuthService,
  rbacService: {
    getUserPermissions: jest.fn(async () => ['journal:read', 'journal:write']),
  },
  subscriptionService: {
    getTier: jest.fn(async () => 'FREE'),
  },
  hashToken: jest.fn((token: string) => `hashed-${token}`),
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-user-1') {
      return { userId: 'user-1', email: 'one@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

jest.mock('../services/email', () => ({
  sendVerificationEmail: jest.fn(async () => {}),
  sendPasswordResetEmail: jest.fn(async () => {}),
}));

let users: Array<{ id: string; email: string; emailVerified: boolean; emailVerifyToken: string | null }>;

jest.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(async ({ where }: any) =>
        users.find((u) => u.emailVerifyToken === where.emailVerifyToken) ?? null
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error('Record not found');
        Object.assign(user, data);
        return user;
      }),
    },
  },
}));

import { authRouter } from '../routes/auth';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

const asUser1 = { Authorization: 'Bearer token-user-1' };

beforeEach(() => {
  jest.clearAllMocks();
  users = [
    { id: 'user-1', email: 'one@test.dev', emailVerified: false, emailVerifyToken: 'hashed-valid-verify-token' },
  ];
});

describe('auth routes', () => {
  describe('POST /register', () => {
    test('201 with user + tokens on the happy path', async () => {
      mockAuthService.register.mockResolvedValue({
        user: { id: 'user-9', email: 'new@test.dev', emailVerified: false, createdAt: new Date().toISOString() },
        tokens: { accessToken: 'access-9', refreshToken: 'refresh-9', expiresIn: 900 },
        emailVerifyToken: 'verify-9',
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.dev', password: 'supersecret1', name: 'Neu' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('new@test.dev');
      expect(res.body.data.tokens.accessToken).toBe('access-9');
      expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=refresh-9/);
    });

    test('400 when password is too short or email invalid', async () => {
      const app = buildApp();

      const shortPw = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.dev', password: 'short' });
      expect(shortPw.status).toBe(400);

      const badEmail = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'supersecret1' });
      expect(badEmail.status).toBe(400);

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });
  });

  describe('POST /login', () => {
    test('200 with user + tokens on the happy path', async () => {
      mockAuthService.login.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'one@test.dev',
          emailVerified: true,
          roles: [{ role: { name: 'USER' } }],
          subscription: { tier: 'FREE' },
        },
        tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 },
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'one@test.dev', password: 'supersecret1' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toEqual(['USER']);
      expect(res.body.data.tokens.accessToken).toBe('access-1');
    });

    test('401 when the service rejects the credentials', async () => {
      mockAuthService.login.mockRejectedValue(new APIError('Invalid email or password', 401));

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'one@test.dev', password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    test('400 when the body fails validation', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/auth/login').send({ email: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /refresh', () => {
    test('401 when no refresh token is provided', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(401);
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    });

    test('200 with a new access token', async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        expiresIn: 900,
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'refresh-old' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBe('access-new');
    });
  });

  describe('GET /me', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('200 with permissions and tier for a valid token', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/auth/me').set(asUser1);

      expect(res.status).toBe(200);
      expect(res.body.data.user.userId).toBe('user-1');
      expect(res.body.data.permissions).toContain('journal:read');
      expect(res.body.data.tier).toBe('FREE');
    });
  });

  describe('POST /change-password', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ oldPassword: 'x', newPassword: 'supersecret2' });
      expect(res.status).toBe(401);
    });

    test('400 when the new password is too short', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(asUser1)
        .send({ oldPassword: 'x', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    test('200 on the happy path', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(asUser1)
        .send({ oldPassword: 'supersecret1', newPassword: 'supersecret2' });

      expect(res.status).toBe(200);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-1', 'supersecret1', 'supersecret2');
    });
  });

  describe('POST /forgot-password', () => {
    test('always 200 with a uniform message (no email enumeration)', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue(null);

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@test.dev' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/If an account exists/);
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    });

    test('400 on invalid email', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /reset-password', () => {
    test('200 on the happy path', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'reset-token', newPassword: 'supersecret3' });

      expect(res.status).toBe(200);
    });

    test('400 when the new password is too short', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'reset-token', newPassword: 'short' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /verify-email', () => {
    test('200 marks the user verified for a known token', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'valid-verify-token' });

      expect(res.status).toBe(200);
      expect(users[0].emailVerified).toBe(true);
      expect(users[0].emailVerifyToken).toBeNull();
    });

    test('400 for an unknown token', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'unknown-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /logout', () => {
    test('401 without a token', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });

    test('200 clears the session', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const app = buildApp();
      const res = await request(app).post('/api/auth/logout').set(asUser1);

      expect(res.status).toBe(200);
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', undefined, expect.anything());
    });
  });
});
