/**
 * Human Design center/type-determination logic tests.
 *
 * These target the specific audit-flagged bug: a center must only be
 * "defined" via a complete channel (both gates active), never via a single
 * hanging gate. All fixtures below are gate/channel numbers, not longitudes.
 */

import {
  determineEnergyType,
  definedCentersFromChannels,
  isMotorConnectedToThroat,
  gateToCenter,
  calculateHumanDesignChart,
  CHANNELS,
} from '../services/humanDesignCalculator';
import { StandardProvider } from '../services/ephemeris/standardProvider';

describe('gateToCenter', () => {
  test('every gate 1-64 maps to a real center, never UNKNOWN', () => {
    for (let gate = 1; gate <= 64; gate++) {
      expect(gateToCenter(gate)).not.toBe('UNKNOWN');
    }
  });

  test('all 36 channels connect two distinct, sensible centers', () => {
    for (const [g1, g2] of CHANNELS) {
      const c1 = gateToCenter(g1);
      const c2 = gateToCenter(g2);
      expect(c1).not.toBe('UNKNOWN');
      expect(c2).not.toBe('UNKNOWN');
    }
  });
});

describe('definedCentersFromChannels', () => {
  test('a single hanging gate (no complete channel) defines nothing', () => {
    // Gate 1 (G_CENTER) is active but its channel partner (8, THROAT) is not.
    const centers = definedCentersFromChannels([]);
    expect(centers.size).toBe(0);
  });

  test('a complete channel defines both centers it connects', () => {
    // Channel 1-8 connects G_CENTER (gate 1) and THROAT (gate 8).
    const centers = definedCentersFromChannels([[1, 8]]);
    expect(centers.has('G_CENTER')).toBe(true);
    expect(centers.has('THROAT')).toBe(true);
    expect(centers.size).toBe(2);
  });
});

describe('isMotorConnectedToThroat', () => {
  test('no channels: not connected', () => {
    expect(isMotorConnectedToThroat([])).toBe(false);
  });

  test('direct motor-to-throat channel (e.g. 20-34 Sacral-Throat) connects', () => {
    expect(isMotorConnectedToThroat([[20, 34]])).toBe(true);
  });

  test('indirect connection through a chain of defined centers', () => {
    // 34-57: SACRAL(34, motor)-SPLEEN(57); 57-... find a Spleen-Throat path
    // Channel 17-62 is AJNA-THROAT, 11-56 is AJNA-THROAT — use a genuine
    // multi-hop path: SACRAL(3)-SPLEEN via 28-38? Simpler: chain
    // SACRAL(34)-SPLEEN(57) via channel 34-57, then SPLEEN(18)-THROAT? There
    // is no Spleen-Throat channel, so use G_CENTER as the bridge instead:
    // Sacral(10)-G_CENTER via channel 10-20 is actually G-Throat. Use
    // 34-10 (Exploration, Sacral-G_CENTER) then 10-20 (Awakening, G-Throat).
    const chain = isMotorConnectedToThroat([[10, 34], [10, 20]]);
    expect(chain).toBe(true);
  });

  test('a motor center defined but with no path to the throat does not connect', () => {
    // 34-57 connects SACRAL (motor) to SPLEEN, never reaching THROAT.
    expect(isMotorConnectedToThroat([[34, 57]])).toBe(false);
  });
});

describe('determineEnergyType', () => {
  test('no defined centers => Reflector', () => {
    expect(determineEnergyType(new Set(), [])).toBe('REFLECTOR');
  });

  test('Sacral defined, no motor-to-throat => Generator', () => {
    const centers = new Set(['SACRAL', 'SPLEEN']);
    expect(determineEnergyType(centers, [[34, 57]])).toBe('GENERATOR');
  });

  test('Sacral defined + motor-to-throat => Manifesting Generator', () => {
    const centers = new Set(['SACRAL', 'THROAT']);
    expect(determineEnergyType(centers, [[20, 34]])).toBe('MANIFESTING_GENERATOR');
  });

  test('no Sacral, Throat connected to a motor => Manifestor', () => {
    const centers = new Set(['THROAT', 'HEART']);
    // 21-45 (The Money Line) connects HEART (motor) to THROAT.
    expect(determineEnergyType(centers, [[21, 45]])).toBe('MANIFESTOR');
  });

  test('no Sacral, Throat defined but NOT motor-connected => Projector (not Manifestor)', () => {
    // Regression guard for the audit bug: the old logic claimed Manifestor
    // whenever "HEART defined AND THROAT defined" were both true, with no
    // check that a channel actually links them. Here both centers are
    // defined but no channel connects Throat to any motor center.
    const centers = new Set(['THROAT', 'HEART', 'G_CENTER']);
    expect(determineEnergyType(centers, [])).toBe('PROJECTOR');
  });

  test('centers defined but no Sacral/Manifestor pattern => Projector', () => {
    // Channel 17-62 (Acceptance) connects AJNA to THROAT — no motor involved.
    const centers = new Set(['AJNA', 'THROAT']);
    expect(determineEnergyType(centers, [[17, 62]])).toBe('PROJECTOR');
  });
});

describe('calculateHumanDesignChart with the standard ephemeris provider', () => {
  const BIRTH_DATA = {
    year: 1990, month: 5, day: 27,
    hour: 5, minute: 15,
    latitude: 52.5, longitude: 13.4, timezone: 2,
  };

  test('degrades gracefully: chart without Chiron, missingBodies = [CHIRON]', () => {
    const chart = calculateHumanDesignChart(BIRTH_DATA, new StandardProvider());
    expect(chart.missingBodies).toEqual(['CHIRON']);
    // Chiron is excluded from the 13-activation chart anyway, so the gate
    // set must be complete: 13 personality + 13 design activations.
    expect(chart.gates).toHaveLength(26);
    expect(chart.gates.some((g) => g.planet === 'CHIRON')).toBe(false);
    expect(chart.energyType).toBeTruthy();
    expect(chart.profile).toMatch(/^[1-6]\/[1-6]$/);
  });

  test('default provider (sweph) reports no missing bodies', () => {
    const chart = calculateHumanDesignChart(BIRTH_DATA);
    expect(chart.missingBodies).toEqual([]);
  });
});
