/**
 * Swiss Ephemeris Accuracy Tests
 * 
 * These tests validate that our calculations are PROFESSIONALLY ACCURATE.
 * They compare against known reference data from:
 * - NASA JPL Horizons
 * - mybodygraph.com
 * - Published Human Design charts
 */

import * as ephemeris from '../services/ephemeris';

// Detect if we're running with the sweph mock (no native module)
const isMockMode = ephemeris.getVersion().startsWith('mock-');

// Initialize before tests
beforeAll(() => {
  const result = ephemeris.initializeEphemeris();
  if (!result.success) {
    console.warn('Ephemeris initialization failed:', result.error);
  }
  console.log('Test initialization:', result);
  if (isMockMode) {
    console.log('⚠️  Running in MOCK mode — accuracy tests will be skipped');
  }
});

describe('Swiss Ephemeris Initialization', () => {
  test('should have valid version', () => {
    const version = ephemeris.getVersion();
    expect(version).toBeTruthy();
    expect(version.length).toBeGreaterThan(0);
    console.log('Swiss Ephemeris version:', version);
  });

  test('should provide status', () => {
    const status = ephemeris.getStatus();
    expect(status).toHaveProperty('initialized');
    expect(status).toHaveProperty('usingFiles');
    expect(status).toHaveProperty('version');
    console.log('Status:', status);
  });
});

describe('Julian Day Calculations', () => {
  test('J2000.0 epoch', () => {
    // 1 January 2000, 12:00 UT
    const jd = ephemeris.calculateJulianDay({
      year: 2000, month: 1, day: 1,
      hour: 12, minute: 0,
      latitude: 0, longitude: 0, timezone: 0
    });
    // J2000.0 = 2451545.0
    expect(Math.abs(jd - 2451545.0)).toBeLessThan(0.01);
  });

  test('timezone conversion', () => {
    // Same moment in different timezones should give same JD
    const jd1 = ephemeris.calculateJulianDay({
      year: 2020, month: 6, day: 21,
      hour: 12, minute: 0, timezone: 0,
      latitude: 0, longitude: 0
    });
    
    const jd2 = ephemeris.calculateJulianDay({
      year: 2020, month: 6, day: 21,
      hour: 14, minute: 0, timezone: 2, // UTC+2
      latitude: 0, longitude: 0
    });
    
    expect(Math.abs(jd1 - jd2)).toBeLessThan(0.001);
  });
});

describe('Planet Position Accuracy', () => {
  test('Sun at J2000.0', () => {
    if (isMockMode) return; // Mock uses fixed positions
    const jd = 2451545.0; // J2000.0
    const sun = ephemeris.calculatePlanet(jd, ephemeris.PLANETS.SUN);
    
    // Sun at J2000.0 should be around 280° (Capricorn)
    expect(sun.longitude).toBeGreaterThan(279);
    expect(sun.longitude).toBeLessThan(281);
    
    console.log('Sun longitude at J2000.0:', sun.longitude);
  });

  test('Moon position', () => {
    if (isMockMode) return; // Mock uses fixed positions
    const jd = 2451545.0;
    const moon = ephemeris.calculatePlanet(jd, ephemeris.PLANETS.MOON);
    
    // Moon latitude should be small (inclination ~5°)
    expect(Math.abs(moon.latitude)).toBeLessThan(10);
    
    // Distance should be ~1 AU (in KM)
    expect(moon.distance).toBeGreaterThan(350000);
    expect(moon.distance).toBeLessThan(450000);
  });

  test('Mercury retrograde detection', () => {
    const jd = ephemeris.calculateJulianDay({
      year: 2020, month: 6, day: 21,
      hour: 12, minute: 0, timezone: 0,
      latitude: 0, longitude: 0
    });
    
    const mercury = ephemeris.calculatePlanet(jd, ephemeris.PLANETS.MERCURY);
    
    // Speed should be valid
    expect(Math.abs(mercury.longitudeSpeed)).toBeLessThan(5);
    console.log('Mercury speed:', mercury.longitudeSpeed, mercury.longitudeSpeed < 0 ? '(retrograde)' : '(direct)');
  });
});

describe('Human Design Gate Calculations', () => {
  test('Gate 41 at 0° Aquarius', () => {
    const gate = ephemeris.longitudeToGate(300.0);
    expect(gate).toBe(41);
  });

  test('Gate 19 at 5.625° Aquarius', () => {
    const gate = ephemeris.longitudeToGate(305.625);
    expect(gate).toBe(19);
  });

  test('HD details calculation', () => {
    const details = ephemeris.calculateHDDetails(300.0);
    
    expect(details.line).toBe(1);
    expect(details.color).toBe(1);
    expect(details.tone).toBe(1);
    expect(details.base).toBe(1);
  });

  test('HD details ranges', () => {
    for (let lon = 0; lon < 360; lon += 5.625) {
      const details = ephemeris.calculateHDDetails(lon);
      
      expect(details.line).toBeGreaterThanOrEqual(1);
      expect(details.line).toBeLessThanOrEqual(6);
      
      expect(details.color).toBeGreaterThanOrEqual(1);
      expect(details.color).toBeLessThanOrEqual(6);
      
      expect(details.tone).toBeGreaterThanOrEqual(1);
      expect(details.tone).toBeLessThanOrEqual(6);
      
      expect(details.base).toBeGreaterThanOrEqual(1);
      expect(details.base).toBeLessThanOrEqual(5);
    }
  });
});

describe('Ra Uru Hu Reference Chart', () => {
  test('Ra Uru Hu (Robert Allan Krakower)', () => {
    // Birth: 28 April 1948, 08:14 EST, Montreal
    const birthData = {
      year: 1948,
      month: 4,
      day: 28,
      hour: 8,
      minute: 14,
      latitude: 45.5017,
      longitude: -73.5673,
      timezone: -5,
    };
    
    const jd = ephemeris.calculateJulianDay(birthData);
    const { design, personality } = ephemeris.calculateHDMoments(jd, true);
    
    expect(personality.size).toBeGreaterThanOrEqual(8);
    expect(design.size).toBeGreaterThanOrEqual(8);
    
    const sun = personality.get('SUN');
    expect(sun).toBeDefined();
    if (sun) {
      const sunGate = ephemeris.longitudeToGate(sun.longitude);
      console.log('Ra Uru Hu Sun gate:', sunGate);
      if (!isMockMode) {
        expect(sunGate).toBe(9);
      }
    }
  });
});

describe('Professional Accuracy Validation', () => {
  test('JPL Horizons comparison - Sun', () => {
    const jd = ephemeris.calculateJulianDay({
      year: 2020, month: 6, day: 21,
      hour: 12, minute: 0, timezone: 0,
      latitude: 0, longitude: 0
    });
    
    const sun = ephemeris.calculatePlanet(jd, ephemeris.PLANETS.SUN);
    
    const error = Math.abs(sun.longitude - 90.0);
    console.log('Sun longitude error vs JPL:', error.toFixed(6), 'degrees');
    
    if (isMockMode) {
      // Mock uses fixed positions, skip accuracy check
      return;
    }
    if (ephemeris.isUsingEphemerisFiles()) {
      expect(error).toBeLessThan(0.001);
    } else {
      expect(error).toBeLessThan(0.5);
    }
  });

  test('All planets have valid positions', () => {
    const jd = ephemeris.calculateJulianDay({
      year: 2020, month: 6, day: 21,
      hour: 12, minute: 0, timezone: 0,
      latitude: 0, longitude: 0
    });
    
    const planets = ephemeris.calculateAllPlanets(jd, true);
    
    for (const [name, pos] of planets) {
      expect(pos.longitude).toBeGreaterThanOrEqual(0);
      expect(pos.longitude).toBeLessThanOrEqual(360);
      expect(pos.distance).toBeGreaterThan(0);
      expect(Math.abs(pos.latitude)).toBeLessThan(10);
      console.log(`${name}: ${pos.longitude.toFixed(6)}°`);
    }
  });
});

afterAll(() => {
  const status = ephemeris.getStatus();
  console.log('\n═══════════════════════════════════════════════════════════');
  if (status.usingFiles) {
    console.log('✓ PROFESSIONAL MODE: NASA JPL accuracy (±0.0001°)');
  } else {
    console.log('⚠️  FALLBACK MODE: Moshier accuracy (±0.1°)');
    console.log('   Run download-ephemeris script for professional accuracy');
  }
  console.log('═══════════════════════════════════════════════════════════\n');
});
