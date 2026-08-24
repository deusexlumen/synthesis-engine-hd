import { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { APIError } from '@/lib/api';
import {
  getSubscription,
  openBillingPortal,
  startCheckout,
  type PaidTier,
  type SubscriptionStatus,
} from '@/lib/billingApi';

interface PlanCard {
  tier: PaidTier;
  name: string;
  price: string;
  features: string[];
}

// Mirrors the tier table in MONETIZATION_PLAN.md. Prices are display copy —
// the amount actually charged comes from the Stripe price id on the server.
const PLANS: PlanCard[] = [
  {
    tier: 'BASIC',
    name: 'Basic',
    price: '4,99 € / Monat',
    features: ['Unbegrenzte Charts', 'KI-Synthese (5 / Monat)', 'PDF-Export'],
  },
  {
    tier: 'PREMIUM',
    name: 'Premium',
    price: '9,99 € / Monat',
    features: [
      'KI-Synthese (20 / Monat)',
      'Coaching-Impulse (10 / Monat)',
      'Swiss Ephemeris Professional',
    ],
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: '29,99 € / Monat',
    features: ['Alles unbegrenzt', 'Transit-Zeitraum-Vergleich', 'API-Zugriff'],
  },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'aktiv',
  TRIALING: 'Testphase',
  PAST_DUE: 'Zahlung überfällig',
  CANCELED: 'gekündigt',
  UNPAID: 'unbezahlt',
  PAUSED: 'pausiert',
  INACTIVE: 'inaktiv',
};

export function BillingSection(): React.ReactElement {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  // Seeded from the token rather than flipped inside the effect: a synchronous
  // setState in an effect body triggers a cascading render (and the
  // react-hooks/set-state-in-effect rule).
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [pendingTier, setPendingTier] = useState<PaidTier | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const current = await getSubscription(accessToken);
        if (!cancelled) {
          setSubscription(current);
        }
      } catch {
        if (!cancelled) {
          setSubscription(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const handleUpgrade = async (tier: PaidTier) => {
    if (!accessToken) {
      return;
    }
    setPendingTier(tier);
    try {
      // Full navigation, not a new tab: Stripe redirects back to
      // /billing/success or /billing/cancelled when the user is done.
      window.location.assign(await startCheckout(accessToken, tier));
    } catch (error) {
      if (error instanceof APIError && error.code === 'BILLING_NOT_CONFIGURED') {
        setUnavailable(true);
        toast.error('Bezahlung ist auf diesem Server noch nicht eingerichtet.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Checkout fehlgeschlagen.');
      }
      setPendingTier(null);
    }
  };

  const handlePortal = async () => {
    if (!accessToken) {
      return;
    }
    setPortalPending(true);
    try {
      window.location.assign(await openBillingPortal(accessToken));
    } catch (error) {
      if (error instanceof APIError && error.code === 'BILLING_NOT_CONFIGURED') {
        setUnavailable(true);
      }
      toast.error(error instanceof Error ? error.message : 'Portal konnte nicht geöffnet werden.');
      setPortalPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  const currentTier = subscription?.tier ?? 'FREE';
  const hasPaidPlan = currentTier !== 'FREE';

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/50">Aktueller Plan</p>
            <p className="text-2xl font-medium">{currentTier}</p>
            {subscription && (
              <p className="mt-1 text-sm text-white/50">
                Status: {STATUS_LABELS[subscription.status] ?? subscription.status}
                {subscription.currentPeriodEnd && (
                  <>
                    {' · '}
                    {subscription.cancelAtPeriodEnd ? 'endet am ' : 'verlängert sich am '}
                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                      new Date(subscription.currentPeriodEnd)
                    )}
                  </>
                )}
              </p>
            )}
          </div>

          {hasPaidPlan && (
            <Button variant="outline" onClick={handlePortal} disabled={portalPending}>
              {portalPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Abo verwalten
            </Button>
          )}
        </div>

        {subscription?.status === 'PAST_DUE' && (
          <p className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Die letzte Zahlung ist fehlgeschlagen. Dein Zugang bleibt vorerst bestehen — bitte
            hinterlege im Abo-Portal eine gültige Zahlungsmethode.
          </p>
        )}

        {unavailable && (
          <p className="mt-4 rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
            Bezahlung ist auf diesem Server noch nicht eingerichtet.
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          return (
            <div
              key={plan.tier}
              className={`flex flex-col rounded-2xl border p-6 ${
                isCurrent
                  ? 'border-purple-500/40 bg-purple-500/[0.06]'
                  : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              <p className="text-lg font-medium">{plan.name}</p>
              <p className="mt-1 text-sm text-white/50">{plan.price}</p>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6"
                variant={isCurrent ? 'outline' : 'default'}
                disabled={isCurrent || pendingTier !== null}
                onClick={() => handleUpgrade(plan.tier)}
              >
                {pendingTier === plan.tier ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {isCurrent ? 'Aktueller Plan' : 'Auswählen'}
              </Button>
            </div>
          );
        })}
      </section>

      <p className="text-xs text-white/40">
        Zahlungen laufen über Stripe. Kündigung jederzeit über „Abo verwalten“ — der Zugang bleibt
        bis zum Ende der bezahlten Periode bestehen.
      </p>
    </div>
  );
}
