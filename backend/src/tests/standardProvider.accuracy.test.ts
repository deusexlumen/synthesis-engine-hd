/**
 * Accuracy benchmark: StandardProvider (astronomia/Meeus) against pinned
 * Swiss Ephemeris reference positions (fixtures/swephReference.json,
 * generated with the real native sweph 2.10.03 + sepl_18/semo_18 files).
 *
 * Documented tolerances (see docs/EPHEMERIS_STANDARD_PROVIDER.md):
 *   Sun, planets, lunar nodes : max longitude error ≤ 0.1°
 *   Moon                      : max longitude error ≤ 0.5°
 * Measured across these 10 samples (1950–2030): Sun/planets ≤ 0.010°,
 * Moon ≤ 0.016°, so the asserts have ~10x headroom against regressions.
 */

import { StandardProvider } from '../services/ephemeris/standardProvider';
import fixture from './fixtures/swephReference.json';

const SEFLG_SPEED = 256;
const SEFLG_SWIEPH = 2;
const FLAGS = SEFLG_SWIEPH | SEFLG_SPEED;

const PLANET_IDS: Record<string, number> = {
  SUN: 0, MOON: 1, MERCURY: 2, VENUS: 3, MARS: 4, JUPITER: 5,
  SATURN: 6, URANUS: 7, NEPTUNE: 8, PLUTO: 9, MEAN_NODE: 10,
};

/** Shortest angular distance a↔b in degrees, in [0, 180]. */
function angDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a % 360) + 360) % 360 - ((b % 360) + 360) % 360) % 360;
  return d > 180 ? 360 - d : d;
}

const toleranceFor = (name: string): number => (name === 'MOON' ? 0.5 : 0.1);

describe('StandardProvider accuracy vs Swiss Ephemeris reference', () => {
  const provider = new StandardProvider();

  test('fixture covers 10 dates 1950–2030', () => {
    expect(fixture.samples).toHaveLength(10);
    const years = fixture.samples.map((s) => s.year);
    expect(Math.min(...years)).toBeGreaterThanOrEqual(1950);
    expect(Math.max(...years)).toBeLessThanOrEqual(2030);
  });

  test('julday matches the sweph julian day for every sample', () => {
    for (const s of fixture.samples) {
      const jd = provider.julday(s.year, s.month, s.day, s.hourUT);
      expect(Math.abs(jd - s.julianDay)).toBeLessThan(1e-6);
    }
  });

  describe('longitude accuracy per body', () => {
    for (const s of fixture.samples) {
      test(`${s.date}: all bodies within tolerance`, () => {
        const jd = provider.julday(s.year, s.month, s.day, s.hourUT);
        for (const [name, ref] of Object.entries(s.planets)) {
          const r = provider.calcUt(jd, PLANET_IDS[name], FLAGS);
          const err = angDiffDeg(r.data[0], ref[0]);
          // `${name} @ ${s.date}` — error must not exceed tolerance
          expect(err).toBeLessThanOrEqual(toleranceFor(name));
        }
      });
    }
  });

  describe('retrograde direction agrees with sweph speeds', () => {
    // Speed magnitude threshold below which sign comparison is meaningless
    // (near-stationary bodies).
    const STATIONARY = 0.05;

    for (const s of fixture.samples) {
      test(`${s.date}: speed signs match`, () => {
        const jd = provider.julday(s.year, s.month, s.day, s.hourUT);
        for (const [name, ref] of Object.entries(s.planets)) {
          const refSpeed = ref[3];
          if (Math.abs(refSpeed) < STATIONARY) continue;
          const r = provider.calcUt(jd, PLANET_IDS[name], FLAGS);
          // `${name} @ ${s.date}` — sign of lonSpeed must match reference
          expect(Math.sign(r.data[3])).toBe(Math.sign(refSpeed));
        }
      });
    }
  });
});
