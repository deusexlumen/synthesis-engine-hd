import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';

/**
 * Landing page after a completed Stripe Checkout.
 *
 * The access token carries the tier and lives 15 minutes, so a fresh purchase
 * would otherwise stay invisible until the token happened to rotate. Refreshing
 * here re-reads the subscription server-side and issues a token with the new
 * tier, which makes the upgrade effective immediately.
 *
 * Stripe redirects here as soon as payment is submitted, which can be a moment
 * before the webhook has been processed — so one retry covers the race.
 */
export default function BillingSuccessPage(): React.ReactElement {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [state, setState] = useState<'refreshing' | 'done' | 'stale'>('refreshing');

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const first = await refreshToken();
      if (cancelled) {
        return;
      }
      if (first) {
        setState('done');
        return;
      }

      // The webhook may not have landed yet; give it a moment and try once more.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (cancelled) {
        return;
      }
      setState((await refreshToken()) ? 'done' : 'stale');
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return (
    <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {state === 'refreshing' ? (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-purple-400" />
        ) : (
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        )}

        <h1 className="mt-6 font-serif text-3xl font-medium">Danke für deinen Kauf</h1>

        <p className="mt-3 text-white/60">
          {state === 'refreshing' && 'Dein Zugang wird freigeschaltet …'}
          {state === 'done' && 'Dein neuer Plan ist aktiv.'}
          {state === 'stale' &&
            'Die Zahlung ist eingegangen. Die Freischaltung kann einen Moment dauern — melde dich neu an, falls dein Plan gleich noch nicht aktualisiert ist.'}
        </p>

        <Button asChild className="mt-8">
          <Link to="/">Zurück zur App</Link>
        </Button>
      </div>
    </div>
  );
}
