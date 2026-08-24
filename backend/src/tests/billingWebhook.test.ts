/**
 * Stripe webhook contract tests.
 *
 * The Stripe SDK is NOT mocked: payloads are signed with
 * stripe.webhooks.generateTestHeaderString against a known secret, so
 * signature verification, event routing, tier mapping and idempotency are all
 * exercised for real. No Stripe account is involved — nothing here makes a
 * network call.
 */

import express from 'express';
import request from 'supertest';
import Stripe from 'stripe';

const WEBHOOK_SECRET = 'whsec_test_secret_for_signing_fixtures';

// The webhook itself is authenticated by its signature, but importing the
// billing router pulls in the auth middleware, and services/auth throws at
// import time without JWT_SECRET. Mocking it keeps the suite independent of
// whether a local backend/.env happens to exist — CI has none.
jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn(() => {
    throw new Error('not used by the webhook route');
  }),
}));

interface FakeSubscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

interface FakeInvoice {
  subscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  pdfUrl: string | null;
}

let subscriptions: FakeSubscription[];
let invoices: FakeInvoice[];

jest.mock('../lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: jest.fn(async ({ where }: any) =>
        subscriptions.find((s) => s.stripeCustomerId === where.stripeCustomerId) ?? null
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        subscriptions.find((s) => s.userId === where.userId || s.id === where.id) ?? null
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const row = subscriptions.find((s) => s.id === where.id);
        if (!row) {
          throw new Error('subscription not found');
        }
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const matches = subscriptions.filter(
          (s) => s.userId === where.userId && s.stripeCustomerId === where.stripeCustomerId
        );
        matches.forEach((m) => Object.assign(m, data));
        return { count: matches.length };
      }),
    },
    invoice: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = invoices.find((i) => i.stripeInvoiceId === where.stripeInvoiceId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: FakeInvoice = { ...create };
        invoices.push(row);
        return row;
      }),
    },
  },
}));

import { stripeWebhookRouter } from '../routes/billing';
import { errorHandler } from '../middleware/errorHandler';
import { resetStripeClientForTests } from '../lib/stripe';

function buildApp() {
  const app = express();
  // Mirrors index.ts: the webhook is mounted before any JSON parser.
  app.use('/api/billing/webhook', stripeWebhookRouter);
  app.use(express.json());
  app.use(errorHandler);
  return app;
}

function sign(payload: unknown): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return { body, signature };
}

function post(app: express.Express, payload: unknown, signature?: string) {
  const signed = sign(payload);
  return request(app)
    .post('/api/billing/webhook')
    .set('stripe-signature', signature ?? signed.signature)
    .set('Content-Type', 'application/json')
    .send(signed.body);
}

function subscriptionEvent(overrides: {
  type?: string;
  customer?: string;
  status?: Stripe.Subscription.Status;
  priceId?: string;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}) {
  const periodEnd = overrides.periodEnd ?? 1900000000;
  return {
    id: 'evt_test',
    object: 'event',
    type: overrides.type ?? 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_test',
        object: 'subscription',
        customer: overrides.customer ?? 'cus_test',
        status: overrides.status ?? 'active',
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              current_period_start: periodEnd - 2592000,
              current_period_end: periodEnd,
              price: { id: overrides.priceId ?? 'price_premium_test' },
            },
          ],
        },
      },
    },
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  subscriptions = [
    {
      id: 'sub-row-1',
      userId: 'user-1',
      tier: 'FREE',
      status: 'INACTIVE',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  ];
  invoices = [];

  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_never_used_for_network_calls';
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.STRIPE_PRICE_BASIC = 'price_basic_test';
  process.env.STRIPE_PRICE_PREMIUM = 'price_premium_test';
  process.env.STRIPE_PRICE_PRO = 'price_pro_test';
  resetStripeClientForTests();
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  resetStripeClientForTests();
});

describe('POST /api/billing/webhook', () => {
  describe('signature verification', () => {
    test('400 without a stripe-signature header', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(subscriptionEvent({})));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SIGNATURE_MISSING');
    });

    test('400 for a signature made with the wrong secret', async () => {
      const body = JSON.stringify(subscriptionEvent({}));
      const wrong = Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: 'whsec_a_different_secret_entirely',
      });

      const app = buildApp();
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', wrong)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SIGNATURE_INVALID');
      expect(subscriptions[0].tier).toBe('FREE');
    });

    test('400 when the body was altered after signing', async () => {
      const original = subscriptionEvent({});
      const signature = sign(original).signature;
      const tampered = JSON.stringify(subscriptionEvent({ priceId: 'price_pro_test' }));

      const app = buildApp();
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(tampered);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SIGNATURE_INVALID');
    });

    test('503 when the webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const app = buildApp();
      const res = await post(app, subscriptionEvent({}));

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
    });
  });

  describe('customer.subscription.updated', () => {
    test('an active premium subscription upgrades the tier', async () => {
      const app = buildApp();
      const res = await post(app, subscriptionEvent({ priceId: 'price_premium_test' }));

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(true);
      expect(subscriptions[0].tier).toBe('PREMIUM');
      expect(subscriptions[0].status).toBe('ACTIVE');
      expect(subscriptions[0].stripeSubscriptionId).toBe('sub_test');
    });

    test('the billing period is read from the subscription item', async () => {
      const app = buildApp();
      await post(app, subscriptionEvent({ periodEnd: 1893456000 }));

      expect(subscriptions[0].currentPeriodEnd).toEqual(new Date(1893456000 * 1000));
      expect(subscriptions[0].currentPeriodStart).toEqual(new Date((1893456000 - 2592000) * 1000));
    });

    test('past_due keeps the paid tier so an expired card is not an instant lockout', async () => {
      subscriptions[0].tier = 'PREMIUM';
      const app = buildApp();
      await post(app, subscriptionEvent({ status: 'past_due' }));

      expect(subscriptions[0].status).toBe('PAST_DUE');
      expect(subscriptions[0].tier).toBe('PREMIUM');
    });

    test('a canceled subscription drops back to FREE', async () => {
      subscriptions[0].tier = 'PREMIUM';
      const app = buildApp();
      await post(app, subscriptionEvent({ type: 'customer.subscription.deleted', status: 'canceled' }));

      expect(subscriptions[0].status).toBe('CANCELED');
      expect(subscriptions[0].tier).toBe('FREE');
    });

    test('an unknown price keeps the current tier instead of guessing', async () => {
      subscriptions[0].tier = 'PREMIUM';
      const app = buildApp();
      await post(app, subscriptionEvent({ priceId: 'price_created_in_dashboard_only' }));

      expect(subscriptions[0].tier).toBe('PREMIUM');
      expect(subscriptions[0].stripePriceId).toBe('price_created_in_dashboard_only');
    });

    test('cancelAtPeriodEnd is carried over', async () => {
      const app = buildApp();
      await post(app, subscriptionEvent({ cancelAtPeriodEnd: true }));

      expect(subscriptions[0].cancelAtPeriodEnd).toBe(true);
    });

    test('an event for an unknown customer is acknowledged, not applied', async () => {
      const app = buildApp();
      const res = await post(app, subscriptionEvent({ customer: 'cus_never_seen' }));

      expect(res.status).toBe(200);
      expect(subscriptions[0].tier).toBe('FREE');
    });
  });

  describe('out-of-order delivery', () => {
    test('a late event with an older period does not undo a newer one', async () => {
      const app = buildApp();
      await post(app, subscriptionEvent({ priceId: 'price_pro_test', periodEnd: 1900000000 }));
      expect(subscriptions[0].tier).toBe('PRO');

      // A delayed retry of the previous cycle, still on the old plan.
      const res = await post(
        app,
        subscriptionEvent({ priceId: 'price_basic_test', periodEnd: 1800000000 })
      );

      expect(res.status).toBe(200);
      expect(subscriptions[0].tier).toBe('PRO');
      expect(subscriptions[0].currentPeriodEnd).toEqual(new Date(1900000000 * 1000));
    });

    test('replaying the same event twice is a no-op', async () => {
      const app = buildApp();
      const event = subscriptionEvent({ priceId: 'price_premium_test' });

      await post(app, event);
      await post(app, event);

      expect(subscriptions[0].tier).toBe('PREMIUM');
      expect(subscriptions).toHaveLength(1);
    });
  });

  describe('invoices', () => {
    const invoiceEvent = (overrides: { id?: string; status?: string; type?: string } = {}) => ({
      id: 'evt_invoice',
      object: 'event',
      type: overrides.type ?? 'invoice.paid',
      data: {
        object: {
          id: overrides.id ?? 'in_test_1',
          object: 'invoice',
          customer: 'cus_test',
          amount_paid: 999,
          amount_due: 999,
          currency: 'eur',
          status: overrides.status ?? 'paid',
          invoice_pdf: 'https://stripe.example/invoice.pdf',
        },
      },
    });

    test('a paid invoice is recorded', async () => {
      const app = buildApp();
      const res = await post(app, invoiceEvent());

      expect(res.status).toBe(200);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].amount).toBe(999);
      expect(invoices[0].status).toBe('paid');
      expect(invoices[0].paidAt).toBeInstanceOf(Date);
    });

    test('a replayed invoice updates rather than duplicating', async () => {
      const app = buildApp();
      await post(app, invoiceEvent());
      await post(app, invoiceEvent());

      expect(invoices).toHaveLength(1);
    });

    test('a failed payment is recorded without a paid timestamp', async () => {
      const app = buildApp();
      await post(app, invoiceEvent({ type: 'invoice.payment_failed', status: 'open' }));

      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe('open');
      expect(invoices[0].paidAt).toBeNull();
    });
  });

  describe('unhandled event types', () => {
    test('acknowledged with 200 so Stripe stops retrying', async () => {
      const app = buildApp();
      const res = await post(app, {
        id: 'evt_other',
        object: 'event',
        type: 'customer.created',
        data: { object: { id: 'cus_test', object: 'customer' } },
      });

      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(false);
    });
  });
});
