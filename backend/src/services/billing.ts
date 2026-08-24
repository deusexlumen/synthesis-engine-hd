/**
 * Applies Stripe subscription and invoice events to the local database.
 *
 * Stripe retries every non-2xx delivery and can deliver out of order, so every
 * write here has to be safe to repeat and safe to receive late.
 */

import type Stripe from 'stripe';
import type { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getTierForPriceId } from '../lib/stripe';
import { logger } from '../lib/logger';

/**
 * Stripe's status vocabulary is wider than ours. "incomplete" and
 * "incomplete_expired" describe a checkout that never produced a payment, so
 * they map to INACTIVE rather than to a paid-then-broken state.
 */
export function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'unpaid':
      return 'UNPAID';
    case 'paused':
      return 'PAUSED';
    case 'incomplete':
    case 'incomplete_expired':
      return 'INACTIVE';
    default:
      // A status added by a future API version must not throw, or the
      // delivery would be retried forever.
      logger.warn({ status }, 'unknown Stripe subscription status, treating as INACTIVE');
      return 'INACTIVE';
  }
}

/**
 * The billing period moved off the Subscription object and onto its items in
 * the 2025 API versions, so it is read from the first item rather than from
 * the top level.
 */
export function getBillingPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items?.data?.[0];
  if (!item) {
    return { start: null, end: null };
  }
  return {
    start: item.current_period_start ? new Date(item.current_period_start * 1000) : null,
    end: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
  };
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return typeof value === 'string' ? value : value.id;
}

/**
 * A cancelled or unpaid subscription loses its paid tier. PAST_DUE keeps it:
 * Stripe retries the charge for days, and revoking access on the first failed
 * attempt punishes an expired card.
 */
function tierAfterStatus(tier: SubscriptionTier, status: SubscriptionStatus): SubscriptionTier {
  if (status === 'CANCELED' || status === 'UNPAID' || status === 'INACTIVE') {
    return 'FREE';
  }
  return tier;
}

export async function applySubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const stripeCustomerId = idOf(subscription.customer);
  if (!stripeCustomerId) {
    logger.warn({ subscriptionId: subscription.id }, 'subscription event without a customer id');
    return;
  }

  const existing = await prisma.subscription.findFirst({ where: { stripeCustomerId } });
  if (!existing) {
    logger.warn({ stripeCustomerId }, 'no local subscription for this Stripe customer');
    return;
  }

  const period = getBillingPeriod(subscription);

  // Out-of-order delivery guard: a late "updated" event carrying an older
  // period must not overwrite a newer one, or a fresh upgrade gets undone by a
  // delayed retry.
  if (
    existing.currentPeriodEnd &&
    period.end &&
    period.end.getTime() < existing.currentPeriodEnd.getTime()
  ) {
    logger.info(
      { stripeCustomerId, incoming: period.end, stored: existing.currentPeriodEnd },
      'ignoring stale subscription event'
    );
    return;
  }

  const status = mapStripeStatus(subscription.status);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const mappedTier = getTierForPriceId(priceId);

  if (priceId && !mappedTier) {
    logger.warn({ priceId }, 'Stripe price is not mapped to a tier, keeping the current tier');
  }

  const tier = tierAfterStatus(mappedTier ?? existing.tier, status);

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      tier,
      status,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
  });

  logger.info({ stripeCustomerId, tier, status }, 'subscription updated from Stripe');
}

export async function applyCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  const stripeCustomerId = idOf(session.customer);
  const userId = session.client_reference_id;

  if (!stripeCustomerId) {
    logger.warn({ sessionId: session.id }, 'checkout session without a customer id');
    return;
  }

  // The checkout endpoint stores the customer id before redirecting, but
  // client_reference_id is carried as a fallback in case this event arrives
  // for a customer that was never linked.
  if (userId) {
    await prisma.subscription.updateMany({
      where: { userId, stripeCustomerId: null },
      data: { stripeCustomerId },
    });
  }

  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) {
    logger.info({ sessionId: session.id }, 'checkout completed without a subscription');
    return;
  }

  // The session carries only ids; tier and period live on the subscription.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await applySubscriptionChange(subscription);
}

export async function applyInvoice(invoice: Stripe.Invoice): Promise<void> {
  const stripeCustomerId = idOf(invoice.customer);
  if (!stripeCustomerId || !invoice.id) {
    logger.warn({ invoiceId: invoice.id }, 'invoice event without a customer or id');
    return;
  }

  const subscription = await prisma.subscription.findFirst({ where: { stripeCustomerId } });
  if (!subscription) {
    logger.warn({ stripeCustomerId }, 'no local subscription for this invoice');
    return;
  }

  const amount = invoice.amount_paid ?? invoice.amount_due ?? 0;
  const status = invoice.status ?? 'open';
  const paidAt = invoice.status === 'paid' ? new Date() : null;
  const pdfUrl = invoice.invoice_pdf ?? null;

  // stripeInvoiceId is unique, so a replayed delivery updates the existing row
  // instead of inserting a duplicate.
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      subscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      amount,
      currency: invoice.currency ?? 'eur',
      status,
      paidAt,
      pdfUrl,
    },
    update: { amount, status, paidAt, pdfUrl },
  });
}

/**
 * Returns whether the event type was one we act on. An unknown type is not an
 * error: the caller still answers 200, because any other status makes Stripe
 * retry an event that will never be handled.
 */
export async function handleStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<boolean> {
  switch (event.type) {
    case 'checkout.session.completed':
      await applyCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
      return true;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await applySubscriptionChange(event.data.object as Stripe.Subscription);
      return true;

    case 'invoice.paid':
    case 'invoice.payment_failed':
      await applyInvoice(event.data.object as Stripe.Invoice);
      return true;

    default:
      return false;
  }
}
