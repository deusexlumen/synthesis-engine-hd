/**
 * Provider-neutral contract for ephemeris backends.
 *
 * Introduced in Phase A of the precision-ephemeris feature so the
 * calculation layer (services/ephemeris.ts) no longer depends on the sweph
 * native module directly. The SwephProvider (swiss-professional tier) is the
 * only backend for now; a StandardProvider (no native deps) follows in
 * Phase B.
 */

/** Swiss Ephemeris planet ID (see PLANETS in services/ephemeris.ts). */
export type PlanetId = number;

/** Bitmask of SEFLG_* calculation flags understood by the backend. */
export type CalcFlags = number;

/**
 * Raw calculation result, mirroring sweph's calc_ut return shape:
 * data = [longitude, latitude, distance, longitudeSpeed, latitudeSpeed, distanceSpeed]
 */
export interface PlanetPositionRaw {
  data: number[];
  error?: string;
}

export interface EphemerisProvider {
  /** Tier identifier — drives the API `accuracy` label. */
  readonly name: 'swiss-professional' | 'standard';

  /** Julian Day (UT) for a Gregorian calendar date and UT hour. */
  julday(year: number, month: number, day: number, hourUT: number): number;

  /** Planet position for a Julian Day; flags select frame/speed data. */
  calcUt(jd: number, planetId: PlanetId, flags: CalcFlags): PlanetPositionRaw;

  /** Backend version string. */
  version(): string;
}
