/**
 * Minimal runtime configuration for the ephemeris tier selection (Phase C).
 *
 * Deliberately NOT a general config refactor — this module only bundles the
 * values the provider resolver and the SwephProvider need. Values are read
 * lazily (functions, not module constants) so tests can set/unset env vars
 * per case without resetting the module registry.
 */

import * as path from 'path';

/**
 * Feature flag for the professional ephemeris tier. Only when this is
 * 'true' AND the sweph native module is loadable do PREMIUM/PRO users get
 * the Swiss Ephemeris backend; everyone else (and every failure mode) falls
 * back to the standard provider. Defaults to off.
 */
export function isEphemerisProEnabled(): boolean {
  return process.env.EPHEMERIS_PRO_ENABLED === 'true';
}

/**
 * Directory containing the Swiss Ephemeris .se1 data files.
 * Default: <backend>/ephemeris (backend/src/lib → backend/).
 */
export function getSeEphePath(): string {
  return process.env.SE_EPHE_PATH || path.join(__dirname, '../../ephemeris');
}
