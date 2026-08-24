/**
 * Billing API client.
 *
 * The important case is a server without Stripe configured: it answers 503
 * with code BILLING_NOT_CONFIGURED, and the UI distinguishes that from a real
 * failure to show "billing unavailable" instead of an error toast.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIError } from '@/lib/api';
import { getSubscription, openBillingPortal, startCheckout } from './billingApi';

const TOKEN = 'access-token';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSubscription', () => {
  test('returns the tier and status unwrapped', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        tier: 'PREMIUM',
        status: 'ACTIVE',
        currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      })
    );

    const subscription = await getSubscription(TOKEN);

    expect(subscription.tier).toBe('PREMIUM');
    expect(subscription.cancelAtPeriodEnd).toBe(false);
  });

  test('sends the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tier: 'FREE', status: 'INACTIVE' }));

    await getSubscription(TOKEN);

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });
});

describe('startCheckout', () => {
  test('posts the tier and returns the redirect URL', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ url: 'https://checkout.stripe.example/cs', sessionId: 'cs' })
    );

    const url = await startCheckout(TOKEN, 'PREMIUM');

    expect(url).toBe('https://checkout.stripe.example/cs');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ tier: 'PREMIUM' });
  });

  test('surfaces BILLING_NOT_CONFIGURED so the UI can show it as unavailable', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'Billing is not configured on this server.', code: 'BILLING_NOT_CONFIGURED' },
        503
      )
    );

    await expect(startCheckout(TOKEN, 'BASIC')).rejects.toMatchObject({
      code: 'BILLING_NOT_CONFIGURED',
      status: 503,
    });
  });

  test('keeps the server message rather than the bare status text', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'No subscription record for this user.' }, 404)
    );

    await expect(startCheckout(TOKEN, 'PRO')).rejects.toThrow(
      'No subscription record for this user.'
    );
  });

  test('a 200 without a URL is treated as a failure, not a silent no-op', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: null }));

    await expect(startCheckout(TOKEN, 'PREMIUM')).rejects.toBeInstanceOf(APIError);
  });
});

describe('openBillingPortal', () => {
  test('returns the portal URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: 'https://portal.stripe.example/s' }));

    await expect(openBillingPortal(TOKEN)).resolves.toBe('https://portal.stripe.example/s');
  });

  test('a 200 without a URL is a failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(openBillingPortal(TOKEN)).rejects.toBeInstanceOf(APIError);
  });
});
