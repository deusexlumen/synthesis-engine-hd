/**
 * AccuracyBadge — shows which ephemeris backend calculated the chart.
 *
 * PROFESSIONAL (Swiss Ephemeris, PREMIUM/PRO tier with EPHEMERIS_PRO_ENABLED)
 * gets a highlighted "Professional · Swiss Ephemeris" badge; the standard
 * astronomia/Meeus backend gets a neutral "Standard" badge.
 *
 * Guests and FREE users additionally see a discreet upsell hint (text/link
 * style only — no checkout, Stripe integration is still missing).
 * When the backend reports missing bodies (e.g. Chiron on the standard
 * tier), a short explanation replaces the otherwise empty values.
 */

import { Badge } from '@/components/ui/badge';
import { useUserTier } from '@/stores/authStore';
import { Sparkles } from 'lucide-react';
import type { HDChartResponse } from '@/types/humanDesign';

interface AccuracyBadgeProps {
  accuracy: HDChartResponse['accuracy'] | null;
  missingBodies?: string[];
  className?: string;
}

export function AccuracyBadge({ accuracy, missingBodies = [], className }: AccuracyBadgeProps) {
  const tier = useUserTier();

  if (!accuracy) {
    return null;
  }

  const isProfessional = accuracy === 'PROFESSIONAL';
  const showUpsell = !isProfessional && tier === 'FREE';
  const chironMissing = missingBodies.includes('CHIRON');

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {isProfessional ? (
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-400"
            data-testid="accuracy-badge-professional"
          >
            <Sparkles className="w-3 h-3" />
            Professional · Swiss Ephemeris
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-white/20 text-white/60"
            data-testid="accuracy-badge-standard"
          >
            Standard
          </Badge>
        )}
        {showUpsell && (
          <a
            href="#upgrade"
            className="text-xs text-purple-400/80 hover:text-purple-300 underline underline-offset-2 transition-colors"
            data-testid="accuracy-upsell-hint"
          >
            Präzisions-Upgrade: Swiss-Ephemeris-Genauigkeit mit Premium
          </a>
        )}
      </div>
      {chironMissing && (
        <p className="mt-2 text-xs text-white/40" data-testid="chiron-missing-hint">
          Chiron ist in der Standard-Berechnung nicht enthalten und wird daher nicht angezeigt.
        </p>
      )}
    </div>
  );
}
