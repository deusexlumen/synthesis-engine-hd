/**
 * Billing API contract tests for the authenticated endpoints.
 *
 * The Stripe SDK is mocked here (unlike billingWebhook.test.ts) because these
 * routes make outbound calls — creating customers and sessions — which must
 * never leave the test process.
 */

import express from 'express';
import request from 'supertest';

const createCustomer = jest.fn();
const createCheckoutSession = jest.fn();
const createPortalSession = jest.fn();

jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      customers: { create: createCustomer },
      checkout: { sessions: { create: createCheckoutSession } },
      billingPortal: { sessions: { create: createPortalSession } },
    })),
  };
});

jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-user') {
      return { userId: 'user-1', email: 'user@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

interface FakeSubscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

let subscriptions: FakeSubscription[];

jest.mock('../lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(async ({ where }: any) =>
        subscriptions.find((s) => s.userId === where.userId) ?? null
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const row = subscriptions.find((s) => s.id === where.id);
        Object.assign(row!, data);
        return row;
      }),
    },
  },
}));

import { billingRouter } from '../routes/billing';
import { errorHandler } from '../middleware/errorHandler';
import { resetStripeClientForTests } from '../lib/stripe';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRouter);
  app.use(errorHandler);
  return app;
}

const asUser = { Authorization: 'Bearer token-user' };
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  subscriptions = [
    {
      id: 'sub-row-1',
      userId: 'user-1',
      tier: 'FREE',
      status: 'INACTIVE',
      stripeCustomerId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  ];

  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_PRICE_BASIC = 'price_basic_test';
  process.env.STRIPE_PRICE_PREMIUM = 'price_premium_test';
  process.env.STRIPE_PRICE_PRO = 'price_pro_test';
  process.env.FRONTEND_URL = 'https://app.example';

  resetStripeClientForTests();
  jest.clearAllMocks();

  createCustomer.mockResolvedValue({ id: 'cus_created' });
  createCheckoutSession.mockResolvedValue({
    id: 'cs_test',
    url: 'https://checkout.stripe.example/cs_test',
  });
  createPortalSession.mockResolvedValue({ url: 'https://portal.stripe.example/session' });
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  resetStripeClientForTests();
});

describe('POST /api/billing/checkout', () => {
  test('401 without a token', async () => {
    const res = await request(buildApp()).post('/api/billing/checkout').send({ tier: 'PREMIUM' });
    expect(res.status).toBe(401);
  });

  test('400 for a tier that cannot be purchased', async () => {
    const res = await request(buildApp())
      .post('/api/billing/checkout')
      .set(asUser)
      .send({ tier: 'FREE' });

    expect(res.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  test('200 returns the Stripe checkout URL', async () => {
    const res = await request(buildApp())
      .post('/api/billing/checkout')
      .set(asUser)
      .send({ tier: 'PREMIUM' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.example/cs_test');
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_created',
        client_reference_id: 'user-1',
        line_items: [{ price: 'price_premium_test', quantity: 1 }],
      })
    );
  });

  test('the Stripe customer id is stored before redirecting', async () => {
    await request(buildApp()).post('/api/billing/checkout').set(asUser).send({ tier: 'BASIC' });

    // Without this the first webhook could not map the event back to a user.
    expect(subscriptions[0].stripeCustomerId).toBe('cus_created');
  });

  test('an existing customer is reused instead of creating a second one', async () => {
    subscriptions[0].stripeCustomerId = 'cus_existing';

    await request(buildApp()).post('/api/billing/checkout').set(asUser).send({ tier: 'PRO' });

    expect(createCustomer).not.toHaveBeenCalled();
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });

  test('success and cancel URLs are built from FRONTEND_URL', async () => {
    await request(buildApp()).post('/api/billing/checkout').set(asUser).send({ tier: 'PREMIUM' });

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining('https://app.example/billing/success'),
        cancel_url: 'https://app.example/billing/cancelled',
      })
    );
  });

  describe('missing configuration', () => {
    test('503 when the price for the tier is not configured', async () => {
      delete process.env.STRIPE_PRICE_PREMIUM;

      const res = await request(buildApp())
        .post('/api/billing/checkout')
        .set(asUser)
        .send({ tier: 'PREMIUM' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
      // Refused before creating anything on Stripe's side.
      expect(createCustomer).not.toHaveBeenCalled();
      expect(createCheckoutSession).not.toHaveBeenCalled();
    });

    test('503 when the secret key is missing', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      resetStripeClientForTests();

      const res = await request(buildApp())
        .post('/api/billing/checkout')
        .set(asUser)
        .send({ tier: 'PREMIUM' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
    });
  });
});

describe('POST /api/billing/portal', () => {
  test('401 without a token', async () => {
    const res = await request(buildApp()).post('/api/billing/portal');
    expect(res.status).toBe(401);
  });

  test('200 returns the portal URL', async () => {
    subscriptions[0].stripeCustomerId = 'cus_existing';

    const res = await request(buildApp()).post('/api/billing/portal').set(asUser);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://portal.stripe.example/session');
    expect(createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });
});

describe('GET /api/billing/subscription', () => {
  test('401 without a token', async () => {
    const res = await request(buildApp()).get('/api/billing/subscription');
    expect(res.status).toBe(401);
  });

  test('200 returns the current tier and status', async () => {
    subscriptions[0].tier = 'PREMIUM';
    subscriptions[0].status = 'ACTIVE';
    subscriptions[0].cancelAtPeriodEnd = true;

    const res = await request(buildApp()).get('/api/billing/subscription').set(asUser);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tier: 'PREMIUM',
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
    });
  });

  test('reading the subscription needs no Stripe configuration at all', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    resetStripeClientForTests();

    const res = await request(buildApp()).get('/api/billing/subscription').set(asUser);

    expect(res.status).toBe(200);
  });
});
