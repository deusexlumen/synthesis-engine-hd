/**
 * Provider resolver — tier-based ephemeris backend selection (Phase C).
 *
 * PREMIUM/PRO users get the Swiss Ephemeris professional backend, but only
 * when the EPHEMERIS_PRO_ENABLED feature flag is on AND the sweph native
 * module is loadable on this machine. Every other tier (FREE, BASIC,
 * guests) and every failure mode falls back to the StandardProvider
 * (astronomia/Meeus) — the resolver never throws.
 *
 * Provider instances are shared singletons: SwephProvider holds native
 * module state and StandardProvider is stateless, so per-request
 * construction would buy nothing.
 */

import { isEphemerisProEnabled } from '../../lib/config';
import { SwephProvider } from './swephProvider';
import { StandardProvider } from './standardProvider';
import type { EphemerisProvider } from './types';

const PRO_TIERS = new Set(['PREMIUM', 'PRO']);

let swephInstance: SwephProvider | null = null;
let standardInstance: StandardProvider | null = null;

/**
 * Check whether the sweph native module can be loaded without initializing
 * it. Mirrors SwephProvider.loadSweph: in the test environment the
 * deterministic mock counts as loadable.
 */
export function isSwephLoadable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('sweph');
    return true;
  } catch {
    if (process.env.NODE_ENV === 'test') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../../__mocks__/sweph');
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

function getSwephProvider(): SwephProvider {
  if (!swephInstance) {
    swephInstance = new SwephProvider();
  }
  return swephInstance;
}

function getStandardProvider(): StandardProvider {
  if (!standardInstance) {
    standardInstance = new StandardProvider();
  }
  return standardInstance;
}

/**
 * Resolve the ephemeris provider for a subscription tier.
 * `tier` is the JWT tier string ('FREE' | 'BASIC' | 'PREMIUM' | 'PRO');
 * callers pass 'FREE' for guests.
 */
export function resolveProvider(tier: string): EphemerisProvider {
  if (PRO_TIERS.has(tier) && isEphemerisProEnabled() && isSwephLoadable()) {
    return getSwephProvider();
  }
  return getStandardProvider();
}

export interface ProviderAvailability {
  name: EphemerisProvider['name'];
  /** Whether the backend can actually serve calculations on this machine. */
  available: boolean;
  /** Professional tier only: whether EPHEMERIS_PRO_ENABLED allows its use. */
  enabledByConfig?: boolean;
}

/**
 * Availability report for health/diagnostics endpoints — both backends,
 * independent of which one the current request would resolve to.
 */
export function getAvailableProviders(): ProviderAvailability[] {
  return [
    {
      name: 'swiss-professional',
      available: isSwephLoadable(),
      enabledByConfig: isEphemerisProEnabled(),
    },
    {
      name: 'standard',
      available: true,
    },
  ];
}
