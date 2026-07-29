/**
 * End-to-end tests for calculateHumanDesignChart().
 *
 * Regression coverage for the audit finding that calculateVariables looked
 * up the lunar node as 'MEAN_NODE' while planetsToGates had already
 * canonicalized it to 'NORTH_NODE' — so the lookup always missed and every
 * chart silently got variables.style = 'Lunar'.
 *
 * The sweph native module is replaced by the deterministic mock; the mock's
 * __setFakePosition helper lets us move the Mean Node to longitudes with
 * known tones to prove that `style` actually follows the node position.
 */

// Force the deterministic mock even on machines where the native sweph
// module happens to load. requireActual is needed because the mock file is
// registered as the manual mock for 'sweph' — a plain require here would
// re-enter this factory recursively.
jest.mock('sweph', () => jest.requireActual('../__mocks__/sweph'), { virtual: true });

import { calculateHumanDesignChart } from '../services/humanDesignCalculator';
import { calculateHDDetails, type BirthData } from '../services/ephemeris';
import * as swephMock from '../__mocks__/sweph';

const FIXTURE_BIRTH: BirthData = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  latitude: 52.52,
  longitude: 13.405,
  timezone: 2,
};

// Mirrors services/humanDesignCalculator.styleFromTone (not exported).
function expectedStyleForTone(tone: number): string {
  if (tone <= 2) return 'Lunar';
  if (tone <= 4) return 'Passive';
  return 'Active';
}

afterEach(() => {
  swephMock.__resetFakePositions();
});

describe('calculateHumanDesignChart (e2e with mocked ephemeris)', () => {
  test('produces a complete chart for a fixture birth date', () => {
    const chart = calculateHumanDesignChart(FIXTURE_BIRTH);

    expect(chart.energyType).toBeTruthy();
    expect(chart.authority).toBeTruthy();
    expect(chart.profile).toMatch(/^[1-6]\/[1-6]$/);
    // 13 activations per side (12 planets + south node), minus excluded Chiron
    expect(chart.gates.length).toBeGreaterThan(0);
    expect(chart.gates.some((g) => g.planet === 'NORTH_NODE')).toBe(true);
    expect(chart.gates.some((g) => g.planet === 'SOUTH_NODE')).toBe(true);
    expect(chart.variables.style).toBeTruthy();
  });

  test('variables.style is derived from the NORTH_NODE gate tone, not hardcoded', () => {
    const chart = calculateHumanDesignChart(FIXTURE_BIRTH);

    const northNodeGate = chart.gates.find((g) => g.planet === 'NORTH_NODE' && !g.isDesign);
    expect(northNodeGate).toBeDefined();
    expect(chart.variables.style).toBe(expectedStyleForTone(northNodeGate!.tone));
  });

  test('variables.style varies with the node position (regression: always-Lunar bug)', () => {
    // Node longitudes chosen so calculateHDDetails yields tones in each of the
    // three style buckets; expectations are derived, not hand-computed.
    const longitudes = [180.0, 300.065, 300.117];
    const styles = new Set<string>();

    for (const lon of longitudes) {
      const expectedTone = calculateHDDetails(lon).tone;
      swephMock.__setFakePosition(swephMock.SE_MEAN_NODE, lon);

      const chart = calculateHumanDesignChart(FIXTURE_BIRTH);
      expect(chart.variables.style).toBe(expectedStyleForTone(expectedTone));
      styles.add(chart.variables.style);
    }

    // The pre-fix code returned 'Lunar' for every chart; require actual variation.
    expect(styles.size).toBeGreaterThan(1);
  });
});
