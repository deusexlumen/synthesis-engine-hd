import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { APIError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getPriceIdForTier, getStripe, getWebhookSecret, type PaidTier } from '../lib/stripe';
import { handleStripeEvent } from '../services/billing';
import { logger } from '../lib/logger';

const router: Router = Router();

const checkoutSchema = z.object({
  tier: z.enum(['BASIC', 'PREMIUM', 'PRO']),
});

function appUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

/**
 * Find or create the Stripe customer for a user and remember its id, so later
 * webhooks can map an event back to a local subscription.
 */
async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    throw new APIError('No subscription record for this user.', 404, 'SUBSCRIPTION_NOT_FOUND');
  }
  if (subscription.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

router.post(
  '/checkout',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { tier } = checkoutSchema.parse(req.body);
    const user = req.user!;

    // Reads config before touching Stripe so a misconfigured deployment fails
    // with 503 BILLING_NOT_CONFIGURED rather than a half-finished checkout.
    const priceId = getPriceIdForTier(tier as PaidTier);
    const customerId = await ensureStripeCustomer(user.userId, user.email);

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // Fallback link back to the user if the customer id was not stored yet.
      client_reference_id: user.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/billing/cancelled`,
    });

    res.json({ url: session.url, sessionId: session.id });
  })
);

router.post(
  '/portal',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const customerId = await ensureStripeCustomer(user.userId, user.email);

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/`,
    });

    res.json({ url: session.url });
  })
);

router.get(
  '/subscription',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!subscription) {
      throw new APIError('No subscription record for this user.', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    res.json({
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });
  })
);

/**
 * Webhook receiver.
 *
 * Mounted separately in index.ts with express.raw BEFORE the global JSON
 * parser: constructEvent verifies the signature against the exact bytes
 * Stripe sent, and a parsed-and-restringified body never matches.
 *
 * No authenticate and no rate limiter here — Stripe holds no JWT (the
 * signature is the authentication), and throttling retries turns a transient
 * failure into a permanently lost event.
 */
export const stripeWebhookRouter: Router = Router();

stripeWebhookRouter.post(
  '/',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      throw new APIError('Missing stripe-signature header.', 400, 'SIGNATURE_MISSING');
    }

    const stripe = getStripe();
    // Resolved outside the try: a missing secret is a configuration fault
    // (503), and inside the catch it would be reported as a bad signature.
    const webhookSecret = getWebhookSecret();

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        'rejected a Stripe webhook with an invalid signature'
      );
      throw new APIError('Invalid webhook signature.', 400, 'SIGNATURE_INVALID');
    }

    const handled = await handleStripeEvent(event, stripe);
    if (!handled) {
      logger.debug({ type: event.type }, 'ignoring unhandled Stripe event type');
    }

    // Always 200 once the signature checks out. Anything else makes Stripe
    // retry, including for event types we deliberately ignore.
    res.json({ received: true, handled });
  })
);

export { router as billingRouter };
