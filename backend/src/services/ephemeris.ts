/**
 * Swiss Ephemeris Service - PROFESSIONAL VERSION
 *
 * Provides NASA JPL-level accuracy (±0.0001°) for astronomical calculations.
 * This is CRITICAL for Human Design - incorrect positions mean wrong gates!
 *
 * Each HD Gate = 5.625°
 * Moshier accuracy = ±0.1° (can be wrong gate!)
 * Swiss Ephemeris = ±0.0001° (always correct gate)
 *
 * Phase A refactor: all backend access goes through an EphemerisProvider
 * (see services/ephemeris/types.ts). The calculation functions take an
 * optional `provider` argument and default to the shared SwephProvider
 * instance, which holds the state that used to be module-global here.
 * Tier selection arrives in Phase C.
 */

import { CHANNELS } from './hdConstants';
import { SwephProvider } from './ephemeris/swephProvider';
import type { EphemerisProvider } from './ephemeris/types';

export type { EphemerisProvider } from './ephemeris/types';
export type { PlanetId, CalcFlags, PlanetPositionRaw } from './ephemeris/types';

// Default backend until Phase C adds tier selection. State (initialization,
// ephemeris-file usage) lives on this instance, not in module globals.
const defaultProvider = new SwephProvider();

// ============================================================================
// PLANET CONSTANTS
// ============================================================================

// Swiss Ephemeris planet IDs (values mirror sweph.constants; hardcoded so
// importing this module doesn't load the native module).
export const PLANETS = {
  SUN: 0,
  MOON: 1,
  MERCURY: 2,
  VENUS: 3,
  MARS: 4,
  JUPITER: 5,
  SATURN: 6,
  URANUS: 7,
  NEPTUNE: 8,
  PLUTO: 9,
  MEAN_NODE: 10,
  TRUE_NODE: 11,
  CHIRON: 15,
} as const;

// Human Design Mandala - Gates in correct order
const MANDALA_GATES = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60
];

// ============================================================================
// TYPES
// ============================================================================

export interface PlanetPosition {
  longitude: number;
  latitude: number;
  distance: number;
  longitudeSpeed: number;
  latitudeSpeed: number;
  distanceSpeed: number;
}

export interface BirthData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  latitude: number;
  longitude: number;
  timezone: number;
}

export interface HDGate {
  number: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  planet: string;
  isDesign: boolean;
  longitude: number;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Julian Day from birth data
 * Uses UT (Universal Time) - critical for accuracy
 */
export function calculateJulianDay(birthData: BirthData, provider: EphemerisProvider = defaultProvider): number {
  const { year, month, day, hour, minute, timezone } = birthData;
  // Convert local time to UT
  const hourUT = hour - timezone;
  return provider.julday(year, month, day, hourUT + minute / 60);
}

/**
 * Calculate planet position with PROFESSIONAL accuracy
 */
// Geocentric tropical ECLIPTIC longitude, with speed data for retrograde
// detection and the Design-Sun Newton iteration below. Using the equatorial
// frame here would return right ascension instead of ecliptic longitude,
// which silently misassigns HD gates (the 64-gate mandala is ecliptic-based).
// Value: sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED.
const CALC_FLAGS = 2 | 256;

export function calculatePlanet(jd: number, planet: number, provider: EphemerisProvider = defaultProvider): PlanetPosition {
  const result = provider.calcUt(jd, planet, CALC_FLAGS);

  return {
    longitude: result.data[0],
    latitude: result.data[1],
    distance: result.data[2],
    longitudeSpeed: result.data[3],
    latitudeSpeed: result.data[4],
    distanceSpeed: result.data[5],
  };
}

/**
 * Convert longitude to Human Design Gate
 * HD Mandala starts at 0° Aquarius = 300° ecliptic
 */
export function longitudeToGate(longitude: number): number {
  const HD_OFFSET = 300.0;
  const GATE_DEGREES = 5.625;

  const normalized = ((longitude % 360) + 360) % 360;
  const hdPosition = ((normalized - HD_OFFSET) % 360 + 360) % 360;
  const gateIndex = Math.floor(hdPosition / GATE_DEGREES);

  return MANDALA_GATES[gateIndex % 64];
}

/**
 * Calculate HD details: Line, Color, Tone, Base
 */
export function calculateHDDetails(longitude: number): {
  line: number;
  color: number;
  tone: number;
  base: number;
} {
  const HD_OFFSET = 300.0;
  const GATE_DEGREES = 5.625;
  const LINE_DEGREES = 0.9375;
  const COLOR_DEGREES = 0.15625;
  const TONE_DEGREES = 0.02604167;
  const BASE_DEGREES = 0.00520833;

  const normalized = ((longitude % 360) + 360) % 360;
  const hdPosition = ((normalized - HD_OFFSET) % 360 + 360) % 360;
  const withinGate = hdPosition % GATE_DEGREES;

  const line = Math.min(6, Math.max(1, Math.floor(withinGate / LINE_DEGREES) + 1));
  const withinLine = withinGate - (line - 1) * LINE_DEGREES;

  const color = Math.min(6, Math.max(1, Math.floor(withinLine / COLOR_DEGREES) + 1));
  const withinColor = withinLine - (color - 1) * COLOR_DEGREES;

  const tone = Math.min(6, Math.max(1, Math.floor(withinColor / TONE_DEGREES) + 1));
  const withinTone = withinColor - (tone - 1) * TONE_DEGREES;

  const base = Math.min(5, Math.max(1, Math.floor(withinTone / BASE_DEGREES) + 1));

  return { line, color, tone, base };
}

/**
 * Calculate all planet positions
 */
export function calculateAllPlanets(
  jd: number,
  includeOuter = true,
  provider: EphemerisProvider = defaultProvider
): Map<string, PlanetPosition> {
  const planets: [string, number][] = [
    ['SUN', PLANETS.SUN],
    ['MOON', PLANETS.MOON],
    ['MERCURY', PLANETS.MERCURY],
    ['VENUS', PLANETS.VENUS],
    ['MARS', PLANETS.MARS],
    ['JUPITER', PLANETS.JUPITER],
    ['SATURN', PLANETS.SATURN],
    ['MEAN_NODE', PLANETS.MEAN_NODE],
  ];

  if (includeOuter) {
    planets.push(
      ['URANUS', PLANETS.URANUS],
      ['NEPTUNE', PLANETS.NEPTUNE],
      ['PLUTO', PLANETS.PLUTO],
      ['CHIRON', PLANETS.CHIRON]
    );
  }

  const results = new Map<string, PlanetPosition>();

  for (const [name, id] of planets) {
    try {
      const pos = calculatePlanet(jd, id, provider);
      results.set(name, pos);
    } catch (error) {
      console.error(`Failed to calculate ${name}:`, error);
      // Continue with other planets
    }
  }

  // EARTH is 180° opposite the SUN
  const sunPos = results.get('SUN');
  if (sunPos) {
    results.set('EARTH', {
      longitude: (sunPos.longitude + 180.0) % 360.0,
      latitude: -sunPos.latitude,
      distance: sunPos.distance,
      longitudeSpeed: sunPos.longitudeSpeed,
      latitudeSpeed: sunPos.latitudeSpeed,
      distanceSpeed: sunPos.distanceSpeed,
    });
  }

  return results;
}

/**
 * Calculate Design and Personality positions for HD
 * Design: ~88° before birth (Sun moves ~1° per day)
 */
export function calculateHDMoments(
  birthJd: number,
  includeOuter = true,
  provider: EphemerisProvider = defaultProvider
): { design: Map<string, PlanetPosition>; personality: Map<string, PlanetPosition> } {
  // 1. Get birth sun longitude
  const birthSun = provider.calcUt(birthJd, PLANETS.SUN, CALC_FLAGS);
  const birthSunLon = birthSun.data[0];

  // 2. Iteratively find JD where sun is exactly 88° before birth sun
  let designJd = birthJd - 89.0; // rough estimate
  const targetArc = 88.0;
  const tolerance = 0.001;

  for (let i = 0; i < 20; i++) {
    const designSun = provider.calcUt(designJd, PLANETS.SUN, CALC_FLAGS);
    const diff = ((birthSunLon - designSun.data[0]) % 360 + 360) % 360;
    const error = diff - targetArc;

    if (Math.abs(error) < tolerance) {
      break;
    }

    const speed = designSun.data[3]; // longitude speed
    if (Math.abs(speed) < 0.01) {
      designJd -= error / 0.9856;
    } else {
      designJd -= error / speed;
    }
  }

  const personality = calculateAllPlanets(birthJd, includeOuter, provider);
  const design = calculateAllPlanets(designJd, includeOuter, provider);

  return { design, personality };
}

// ============================================================================
// STATUS & DIAGNOSTICS
// ============================================================================

/**
 * Initialize the default ephemeris provider - CRITICAL STEP
 * Must be called before any calculations!
 */
export function initializeEphemeris(): { success: boolean; usingFiles: boolean; error?: string; details?: string } {
  return defaultProvider.initialize();
}

/**
 * Check if using professional ephemeris files
 */
export function isUsingEphemerisFiles(): boolean {
  return defaultProvider.isUsingFiles();
}

/**
 * Get ephemeris backend version
 */
export function getVersion(): string {
  return defaultProvider.version();
}

/**
 * Get initialization status
 */
export function getStatus(): {
  initialized: boolean;
  usingFiles: boolean;
  error: string | null;
  version: string;
} {
  return defaultProvider.getStatus();
}

/**
 * Get detailed diagnostics
 */
export function getDiagnostics(): {
  ephePath: string;
  files: { found: string[]; missing: string[] };
  status: ReturnType<typeof getStatus>;
} {
  return defaultProvider.getDiagnostics();
}

/**
 * Close ephemeris (cleanup)
 */
export function closeEphemeris(): void {
  defaultProvider.close();
}

// ============================================================================
// TRANSIT CALCULATIONS
// ============================================================================

export interface TransitPlanet {
  name: string;
  longitude: number;
  gate: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  retrograde: boolean;
  zodiacSign: string;
  zodiacDegree: number;
}

export interface DailyTransit {
  date: string;
  planets: TransitPlanet[];
  moonPhase: string;
  activeGates: number[];
  dailyTheme: string;
}

export interface PlanetTransit {
  planet: string;
  transitGate: number;
  natalGate: number;
  aspect: string;
  influence: string;
}

export interface TransitComparison {
  date: string;
  transits: PlanetTransit[];
  activatedGates: number[];
  activatedChannels: Array<[number, number]>;
  themes: string[];
  summary: string;
}

// Planets tracked as daily transits (mirrors the retired Rust transit
// module). Earth/Chiron are part of the natal chart's 13 activations but
// are conventionally left out of day-to-day transit tracking.
const TRANSIT_PLANETS: Array<{ key: string; name: string; trackRetrograde: boolean }> = [
  { key: 'SUN', name: 'Sonne', trackRetrograde: false },
  { key: 'MOON', name: 'Mond', trackRetrograde: false },
  { key: 'MERCURY', name: 'Merkur', trackRetrograde: true },
  { key: 'VENUS', name: 'Venus', trackRetrograde: true },
  { key: 'MARS', name: 'Mars', trackRetrograde: true },
  { key: 'JUPITER', name: 'Jupiter', trackRetrograde: true },
  { key: 'SATURN', name: 'Saturn', trackRetrograde: true },
  { key: 'URANUS', name: 'Uranus', trackRetrograde: true },
  { key: 'NEPTUNE', name: 'Neptun', trackRetrograde: true },
  { key: 'PLUTO', name: 'Pluto', trackRetrograde: true },
  { key: 'MEAN_NODE', name: 'Nordknoten', trackRetrograde: false },
];

const ZODIAC_SIGNS = [
  'Widder', 'Stier', 'Zwillinge', 'Krebs', 'Löwe', 'Jungfrau',
  'Waage', 'Skorpion', 'Schütze', 'Steinbock', 'Wassermann', 'Fische',
];

const DAILY_THEMES: Record<number, string> = {
  1: 'Selbstausdruck & Kreativität', 2: 'Rezeptivität & Empfangen', 3: 'Mutation & Veränderung',
  4: 'Formulierung & Antworten', 5: 'Rhythmus & Muster', 6: 'Intimität & Konflikt',
  7: 'Führung & Rolle', 8: 'Beitrag & Einfluss', 9: 'Konzentration & Fokus',
  10: 'Selbstverhalten & Identität', 11: 'Ideen & Inspiration', 12: 'Vorsicht & Standhaftigkeit',
  13: 'Zuhören & Geheimnisse', 14: 'Macht & Vermögen', 15: 'Extreme & Rhythmen',
  16: 'Enthusiasmus & Fähigkeiten', 17: 'Meinungen & Überzeugungen', 18: 'Korrektur & Perfektion',
  19: 'Bedürfnisse & Wünsche', 20: 'Jetzt & Gegenwart', 21: 'Kontrolle & Durchsetzung',
  22: 'Offenheit & Scham', 23: 'Vereinfachung & Assimilation', 24: 'Rückkehr & Wiederholung',
  25: 'Unschuld & Liebe', 26: 'Täuschung & Manipulation', 27: 'Fürsorge & Ernährung',
  28: 'Risiko & Tiefe', 29: 'Commitment & Ja-Sagen', 30: 'Intensität & Gefühl',
  31: 'Einfluss & Führung', 32: 'Kontinuität & Erinnerung', 33: 'Rückzug & Privatsphäre',
  34: 'Macht & Autorität', 35: 'Veränderung & Fortschritt', 36: 'Krise & Erfahrung',
  37: 'Freundschaft & Gemeinschaft', 38: 'Kampf & Druck', 39: 'Provokation & Konfrontation',
  40: 'Einsamkeit & Übertragung', 41: 'Phantasie & Träume', 42: 'Wachstum & Reifung',
  43: 'Einsicht & Verständnis', 44: 'Instinkt & Überleben', 45: 'Sammlung & Besitz',
  46: 'Determination & Serendipität', 47: 'Realisation & Abstraktion', 48: 'Tiefe & Kompetenz',
  49: 'Prinzipien & Revolution', 50: 'Werte & Gesetze', 51: 'Schock & Erweckung',
  52: 'Inaktivität & Konzentration', 53: 'Beginn & Start', 54: 'Transformation & Antrieb',
  55: 'Freiheit & Geist', 56: 'Wanderung & Suche', 57: 'Intuition & Klarheit',
  58: 'Vitalität & Lebendigkeit', 59: 'Sexualität & Verbindung', 60: 'Einschränkung & Akzeptanz',
  61: 'Mysterium & Wissen', 62: 'Details & Fakten', 63: 'Zweifel & Verdacht',
  64: 'Verwirrung & Vor-Logik',
};

function longitudeToZodiac(longitude: number): { sign: string; degree: number } {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  return { sign: ZODIAC_SIGNS[signIndex % 12], degree: normalized % 30 };
}

function getMoonPhase(sunLon: number, moonLon: number): string {
  const diff = ((moonLon - sunLon) % 360 + 360) % 360;
  if (diff < 45) return 'new';
  if (diff < 90) return 'waxing_crescent';
  if (diff < 135) return 'first_quarter';
  if (diff < 180) return 'waxing_gibbous';
  if (diff < 225) return 'full';
  if (diff < 270) return 'waning_gibbous';
  if (diff < 315) return 'last_quarter';
  return 'waning_crescent';
}

export function calculateDailyTransit(
  year: number,
  month: number,
  day: number,
  provider: EphemerisProvider = defaultProvider
): DailyTransit {
  const jd = calculateJulianDay({
    year, month, day,
    hour: 12, minute: 0,
    latitude: 0, longitude: 0, timezone: 0,
  }, provider);

  const allPlanets = calculateAllPlanets(jd, true, provider);

  const planetList: TransitPlanet[] = [];
  for (const { key, name, trackRetrograde } of TRANSIT_PLANETS) {
    const pos = allPlanets.get(key);
    if (!pos) continue;

    const gate = longitudeToGate(pos.longitude);
    const details = calculateHDDetails(pos.longitude);
    const { sign, degree } = longitudeToZodiac(pos.longitude);

    planetList.push({
      name,
      longitude: pos.longitude,
      gate,
      line: details.line,
      color: details.color,
      tone: details.tone,
      base: details.base,
      retrograde: trackRetrograde && pos.longitudeSpeed < 0,
      zodiacSign: sign,
      zodiacDegree: degree,
    });
  }

  const sunPos = allPlanets.get('SUN');
  const moonPos = allPlanets.get('MOON');
  const moonPhase = sunPos && moonPos ? getMoonPhase(sunPos.longitude, moonPos.longitude) : 'unknown';

  const activeGates = planetList.map((p) => p.gate);
  const sunGate = planetList.find((p) => p.name === 'Sonne')?.gate ?? 1;

  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    planets: planetList,
    moonPhase,
    activeGates,
    dailyTheme: DAILY_THEMES[sunGate] ?? 'Allgemeine Transformation',
  };
}

export function compareTransitToNatal(
  year: number,
  month: number,
  day: number,
  natalGates: number[],
  provider: EphemerisProvider = defaultProvider
): TransitComparison {
  const transit = calculateDailyTransit(year, month, day, provider);

  const transitGates = new Set(transit.planets.map((p) => p.gate));
  const natalSet = new Set(natalGates);

  const activatedGates: number[] = [];
  const transitsHit: PlanetTransit[] = [];
  const themes: string[] = [];

  for (const planet of transit.planets) {
    if (natalSet.has(planet.gate)) {
      activatedGates.push(planet.gate);
      transitsHit.push({
        planet: planet.name,
        transitGate: planet.gate,
        natalGate: planet.gate,
        aspect: `${planet.name} transitiert Tor ${planet.gate}`,
        influence: `${planet.name} aktiviert dein natales Tor ${planet.gate}`,
      });
      themes.push(`${planet.name}-Energie aktiviert`);
    }
  }

  const activatedChannels: Array<[number, number]> = [];
  for (const [g1, g2] of CHANNELS) {
    if (transitGates.has(g1) && natalSet.has(g2)) {
      activatedChannels.push([g1, g2]);
    }
    if (transitGates.has(g2) && natalSet.has(g1)) {
      if (!activatedChannels.some(c => c[0] === g1 && c[1] === g2)) {
        activatedChannels.push([g1, g2]);
      }
    }
  }

  const uniqueGates = Array.from(new Set(activatedGates)).sort((a, b) => a - b);
  const uniqueThemes = Array.from(new Set(themes)).sort();

  return {
    date: transit.date,
    transits: transitsHit,
    activatedGates: uniqueGates,
    activatedChannels,
    themes: uniqueThemes,
    summary: `${uniqueGates.length} Gates und ${activatedChannels.length} Kanäle aktiviert`,
  };
}

// Auto-initialize on module load
initializeEphemeris();
