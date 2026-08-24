/**
 * Billing API Client
 *
 * Talks to /api/billing. Unlike the journal endpoints these responses are not
 * wrapped in a `data` envelope — the routes return the object directly.
 *
 * When Stripe is not configured on the server every endpoint here answers 503
 * with code BILLING_NOT_CONFIGURED; callers should treat that as "billing
 * unavailable", not as a bug.
 */

import { APIError } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type PaidTier = 'BASIC' | 'PREMIUM' | 'PRO';
export type Tier = 'FREE' | PaidTier;

export interface SubscriptionStatus {
  tier: Tier;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/api/billing${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    let code = `HTTP_${response.status}`;
    try {
      const body = await response.json();
      message = body.error || message;
      code = body.code || code;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new APIError(message, response.status, code);
  }

  return (await response.json()) as T;
}

export async function getSubscription(token: string): Promise<SubscriptionStatus> {
  return request<SubscriptionStatus>(token, '/subscription');
}

/** Returns the Stripe Checkout URL the caller should navigate to. */
export async function startCheckout(token: string, tier: PaidTier): Promise<string> {
  const { url } = await request<{ url: string | null }>(token, '/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
  if (!url) {
    throw new APIError('Stripe returned no checkout URL.', 502, 'CHECKOUT_URL_MISSING');
  }
  return url;
}

/** Returns the Stripe Billing Portal URL for managing or cancelling a plan. */
export async function openBillingPortal(token: string): Promise<string> {
  const { url } = await request<{ url: string | null }>(token, '/portal', { method: 'POST' });
  if (!url) {
    throw new APIError('Stripe returned no portal URL.', 502, 'PORTAL_URL_MISSING');
  }
  return url;
}
