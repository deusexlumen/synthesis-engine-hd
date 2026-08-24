/**
 * Stripe client and billing configuration.
 *
 * Everything here is read lazily. An eager `new Stripe()` or a module-level
 * config check would make a deployment without billing credentials fail at
 * import time, and index.ts imports every router at startup — that is exactly
 * how a missing OPENAI_API_KEY used to kill the whole process.
 */

import Stripe from 'stripe';
import { APIError } from '../middleware/errorHandler';

export type PaidTier = 'BASIC' | 'PREMIUM' | 'PRO';

const PRICE_ENV_BY_TIER: Record<PaidTier, string> = {
  BASIC: 'STRIPE_PRICE_BASIC',
  PREMIUM: 'STRIPE_PRICE_PREMIUM',
  PRO: 'STRIPE_PRICE_PRO',
};

let cachedClient: Stripe | null = null;
let cachedForKey: string | null = null;

function notConfigured(what: string): APIError {
  return new APIError(
    `Billing is not configured on this server (${what}).`,
    503,
    'BILLING_NOT_CONFIGURED'
  );
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw notConfigured('STRIPE_SECRET_KEY');
  }
  // Rebuild when the key changes so tests can swap credentials between cases.
  if (!cachedClient || cachedForKey !== secretKey) {
    cachedClient = new Stripe(secretKey);
    cachedForKey = secretKey;
  }
  return cachedClient;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw notConfigured('STRIPE_WEBHOOK_SECRET');
  }
  return secret;
}

export function getPriceIdForTier(tier: PaidTier): string {
  const priceId = process.env[PRICE_ENV_BY_TIER[tier]];
  if (!priceId) {
    throw notConfigured(PRICE_ENV_BY_TIER[tier]);
  }
  return priceId;
}

/**
 * Reverse lookup for webhook payloads, which carry a price id rather than a
 * tier. Returns null for a price this deployment does not know — a price
 * created in the dashboard but never configured here must not silently map to
 * some tier.
 */
export function getTierForPriceId(priceId: string | null | undefined): PaidTier | null {
  if (!priceId) {
    return null;
  }
  const match = (Object.keys(PRICE_ENV_BY_TIER) as PaidTier[]).find(
    (tier) => process.env[PRICE_ENV_BY_TIER[tier]] === priceId
  );
  return match ?? null;
}

/** Reset the memoised client. Tests only. */
export function resetStripeClientForTests(): void {
  cachedClient = null;
  cachedForKey = null;
}
