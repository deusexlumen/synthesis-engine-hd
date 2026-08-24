import { Link } from 'react-router';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Landing page when the user leaves Stripe Checkout without paying. */
export default function BillingCancelledPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <XCircle className="mx-auto h-12 w-12 text-white/40" />

        <h1 className="mt-6 font-serif text-3xl font-medium">Kauf abgebrochen</h1>

        <p className="mt-3 text-white/60">
          Es wurde nichts abgebucht. Dein bisheriger Plan bleibt unverändert.
        </p>

        <Button asChild className="mt-8">
          <Link to="/">Zurück zur App</Link>
        </Button>
      </div>
    </div>
  );
}
