# Spec — Stripe Billing

Status: implemented (`feature/stripe-billing`). The API is complete; see
"Out of scope" for what is not.

## Problem

`MONETIZATION_PLAN.md` sells four tiers, the Prisma schema has `Subscription`
and `Invoice` with Stripe columns, and `requireTier` gates PREMIUM/PRO
endpoints — but no payment code exists. There is no way for a user to move off
FREE; tiers can only be changed by editing the database directly.

## Scope

A user can start a checkout for a paid tier, and their tier updates when
Stripe confirms payment. Subscription changes made outside the app (cancel,
payment failure, plan change in the billing portal) reach the database.

### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/billing/checkout` | JWT | Create a Stripe Checkout session for a tier, return its URL |
| `POST` | `/api/billing/portal` | JWT | Create a Billing Portal session so the user can manage or cancel |
| `GET` | `/api/billing/subscription` | JWT | Current tier, status, period end, `cancelAtPeriodEnd` |
| `POST` | `/api/billing/webhook` | Stripe signature | Apply subscription and invoice events |

### Handled events

`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

Anything else is acknowledged with 200 and ignored — Stripe retries every
non-2xx, so an unhandled event type must not look like a failure.

## Design decisions

### The webhook must not go through `express.json()`

`stripe.webhooks.constructEvent` verifies the signature against the **raw**
request body. The global JSON parser in `index.ts` would consume it and every
verification would fail. The webhook router is therefore mounted with
`express.raw({ type: 'application/json' })` *before* the global parser.

It also gets no `authenticate` (Stripe does not hold a JWT — the signature is
the authentication) and no `generalLimiter` (throttling Stripe's retries turns
a transient failure into a permanently lost event).

### Lookup key is `stripeCustomerId`, not `userId`

Stripe events carry a customer id, not our user id. `Subscription.userId` is
`@unique` and a row is created at registration with `tier: FREE`, so webhooks
always **update** an existing row, never create one. The checkout endpoint
stores `stripeCustomerId` before redirecting, so the reverse lookup exists by
the time the first event arrives. `client_reference_id` carries the user id as
a fallback for `checkout.session.completed`.

### Idempotency and ordering

Stripe retries and can deliver out of order.

- Invoices are keyed on the existing `stripeInvoiceId` unique constraint via
  `upsert`, so a replayed `invoice.paid` cannot duplicate a row.
- Subscription updates ignore an event whose `currentPeriodEnd` is older than
  what is already stored. Without that, a delayed `customer.subscription
  .updated` can downgrade a user who has just upgraded.

### Price IDs are configuration

Stripe price ids differ between test and live mode, so the tier mapping lives
in `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PREMIUM` / `STRIPE_PRICE_PRO`.

Missing configuration fails at the endpoint with `503
BILLING_NOT_CONFIGURED`, never at module load. The Stripe client is built on
first use for the same reason: an eager client is exactly the bug that stopped
the whole API from booting without `OPENAI_API_KEY`.

### Tier staleness is bounded by the access token

`requireTier` reads the tier from the JWT, which lives 15 minutes. After a
successful checkout the frontend calls `/api/auth/refresh`, whose query
includes `subscription`, so an upgrade is effective immediately.

A downgrade arriving by webhook is **not** — it takes effect on the next token
rotation, at most 15 minutes later. That is accepted: making `requireTier` hit
the database on every gated request is a larger change than this needs, and 15
minutes of retained access after a cancellation is not a business risk.

## Out of scope

- **Proration and mid-cycle plan changes** — handled by Stripe's billing
  portal rather than our own UI.
- **Taxes and invoicing rules** — Stripe Tax is not configured.
- **BASIC feature set** — the tier exists in the enum and gets a price id, but
  which features it unlocks is still undecided in `MONETIZATION_PLAN.md`.

## Verification

Signature verification, event routing, tier mapping and idempotency are tested
with `stripe.webhooks.generateTestHeaderString`, which signs fixtures using a
known secret. No live Stripe account is required for the test suite.

Before going live: create the products and prices in the Stripe dashboard, set
the four environment variables, and register the webhook endpoint. Steps are
in `docs/DEPLOY_RENDER.md`.
