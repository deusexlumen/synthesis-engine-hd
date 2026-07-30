/**
 * Unit tests for the StandardProvider (astronomia / Meeus backend).
 *
 * These tests need neither the sweph native module nor .se1 files; the only
 * external reference values are well-known constants (J2000.0) and the
 * geocentric Sun longitude at J2000 (~280.37°, also pinned in the
 * swephReference.json fixture used by standardProvider.accuracy.test.ts).
 */

import { StandardProvider, PlanetUnavailableError } from '../services/ephemeris/standardProvider';

// Swiss Ephemeris planet IDs (mirror PLANETS in services/ephemeris.ts).
const SE_SUN = 0;
const SE_MOON = 1;
const SE_MERCURY = 2;
const SE_MARS = 4;
const SE_MEAN_NODE = 10;
const SE_TRUE_NODE = 11;
const SE_CHIRON = 15;

const SEFLG_SPEED = 256;
const SEFLG_SWIEPH = 2;
const FLAGS = SEFLG_SWIEPH | SEFLG_SPEED;

describe('StandardProvider', () => {
  let provider: StandardProvider;

  beforeEach(() => {
    provider = new StandardProvider();
  });

  describe('interface conformance', () => {
    test('name is "standard"', () => {
      expect(provider.name).toBe('standard');
    });

    test('version mentions the astronomia backend', () => {
      expect(provider.version()).toMatch(/^astronomia-\d+\.\d+\.\d+/);
    });

    test('initialize succeeds without ephemeris files', () => {
      const result = provider.initialize();
      expect(result.success).toBe(true);
      expect(result.usingFiles).toBe(false);
      expect(provider.isUsingFiles()).toBe(false);
    });

    test('close is a no-op and does not throw', () => {
      expect(() => provider.close()).not.toThrow();
    });

    test('calcUt returns the sweph-compatible data array shape', () => {
      const r = provider.calcUt(2451545.0, SE_SUN, FLAGS);
      expect(r.error).toBeUndefined();
      expect(r.data).toHaveLength(6);
      // [lon, lat, dist, lonSpeed, latSpeed, distSpeed]
      expect(r.data[0]).toBeGreaterThanOrEqual(0);
      expect(r.data[0]).toBeLessThan(360);
      expect(r.data[2]).toBeGreaterThan(0); // distance
      expect(Number.isFinite(r.data[3])).toBe(true);
    });
  });

  describe('julday (Meeus ch. 7)', () => {
    test('J2000.0: 2000-01-01 12:00 UT = 2451545.0', () => {
      expect(provider.julday(2000, 1, 1, 12)).toBeCloseTo(2451545.0, 9);
    });

    test('2000-01-01 00:00 UT = 2451544.5', () => {
      expect(provider.julday(2000, 1, 1, 0)).toBeCloseTo(2451544.5, 9);
    });

    test('1950-01-01 00:00 UT = 2433282.5', () => {
      expect(provider.julday(1950, 1, 1, 0)).toBeCloseTo(2433282.5, 9);
    });

    test('handles January/February month rollover (Meeus branch)', () => {
      // 2017-02-14 00:00 UT — known JD 2457798.5
      expect(provider.julday(2017, 2, 14, 0)).toBeCloseTo(2457798.5, 9);
    });
  });

  describe('calcUt positions', () => {
    test('Sun at J2000.0 ≈ 280.37° (sweph reference 280.3689°)', () => {
      const r = provider.calcUt(2451545.0, SE_SUN, FLAGS);
      expect(r.data[0]).toBeCloseTo(280.3689, 1); // well under 0.1° tolerance
    });

    test('Sun speed ≈ 1°/day', () => {
      const r = provider.calcUt(2451545.0, SE_SUN, FLAGS);
      expect(r.data[3]).toBeGreaterThan(0.9);
      expect(r.data[3]).toBeLessThan(1.1);
    });

    test('Moon distance ≈ 0.0024–0.0029 AU', () => {
      const r = provider.calcUt(2451545.0, SE_MOON, FLAGS);
      expect(r.data[2]).toBeGreaterThan(0.0024);
      expect(r.data[2]).toBeLessThan(0.0029);
    });

    test('mean node is always retrograde', () => {
      const r = provider.calcUt(2451545.0, SE_MEAN_NODE, FLAGS);
      expect(r.data[3]).toBeLessThan(0);
      expect(r.data[3]).toBeCloseTo(-0.053, 2);
    });
  });

  describe('retrograde detection via longitude speed', () => {
    test('Mercury retrograde on 1967-07-14 (sweph: -0.493°/day)', () => {
      const jd = provider.julday(1967, 7, 14, 0);
      const r = provider.calcUt(jd, SE_MERCURY, FLAGS);
      expect(r.data[3]).toBeLessThan(0);
    });

    test('Mars retrograde on 1950-03-21 (sweph: -0.387°/day)', () => {
      const jd = provider.julday(1950, 3, 21, 6);
      const r = provider.calcUt(jd, SE_MARS, FLAGS);
      expect(r.data[3]).toBeLessThan(0);
    });

    test('Mercury direct at J2000.0 (sweph: +1.556°/day)', () => {
      const r = provider.calcUt(2451545.0, SE_MERCURY, FLAGS);
      expect(r.data[3]).toBeGreaterThan(0);
    });
  });

  describe('PLANET_UNAVAILABLE', () => {
    test('throws PlanetUnavailableError with code PLANET_UNAVAILABLE for Chiron', () => {
      try {
        provider.calcUt(2451545.0, SE_CHIRON, FLAGS);
        fail('expected calcUt to throw for Chiron');
      } catch (e) {
        expect(e).toBeInstanceOf(PlanetUnavailableError);
        expect((e as PlanetUnavailableError).code).toBe('PLANET_UNAVAILABLE');
        expect((e as PlanetUnavailableError).planetId).toBe(SE_CHIRON);
      }
    });

    test('throws for unknown planet IDs', () => {
      expect(() => provider.calcUt(2451545.0, 99, FLAGS)).toThrow(PlanetUnavailableError);
    });

    test('supports the true node (no throw)', () => {
      expect(() => provider.calcUt(2451545.0, SE_TRUE_NODE, FLAGS)).not.toThrow();
    });
  });
});
