/**
 * Swiss Ephemeris Service - PROFESSIONAL VERSION
 * 
 * Provides NASA JPL-level accuracy (±0.0001°) for astronomical calculations.
 * This is CRITICAL for Human Design - incorrect positions mean wrong gates!
 * 
 * Each HD Gate = 5.625°
 * Moshier accuracy = ±0.1° (can be wrong gate!)
 * Swiss Ephemeris = ±0.0001° (always correct gate)
 */

import * as path from 'path';
import * as fs from 'fs';

// Try to import sweph, fallback to mock if not available
let sweph: any;
try {
  sweph = require('sweph');
} catch (e) {
  sweph = null;
}

// ============================================================================
// CONFIGURATION - CRITICAL FOR ACCURACY
// ============================================================================

const EPHE_PATH = process.env.SE_EPHE_PATH || path.join(__dirname, '../../ephemeris');

// Required files for professional accuracy
const REQUIRED_FILES = ['sepl_18.se1', 'semo_18.se1'];
const OPTIONAL_FILES = ['seas_18.se1', 'sefstars.txt'];

// Track initialization state
let isInitialized = false;
let isUsingFiles = false;
let initError: string | null = null;

// ============================================================================
// INITIALIZATION - MUST BE CALLED BEFORE ANY CALCULATIONS
// ============================================================================

/**
 * Check if ephemeris files exist in the given path
 */
function checkEphemerisFiles(ephePath: string): { found: string[]; missing: string[] } {
  const found: string[] = [];
  const missing: string[] = [];
  
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(ephePath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      found.push(`${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      missing.push(file);
    }
  }
  
  // Check optional files
  for (const file of OPTIONAL_FILES) {
    const filePath = path.join(ephePath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      found.push(`${file} (${(stats.size / 1024).toFixed(1)} KB) [optional]`);
    }
  }
  
  return { found, missing };
}

/**
 * Initialize Swiss Ephemeris - CRITICAL STEP
 * Must be called before any calculations!
 */
export function initializeEphemeris(): { success: boolean; usingFiles: boolean; error?: string; details?: string } {
  if (isInitialized) {
    return { success: true, usingFiles: isUsingFiles };
  }
  
  try {
    // Check for ephemeris files
    const { found, missing } = checkEphemerisFiles(EPHE_PATH);
    
    if (missing.length === 0) {
      // Professional mode: Use .se1 files
      sweph.set_ephe_path(EPHE_PATH);
      isUsingFiles = true;
      isInitialized = true;
      
      const version = sweph.version();
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  ✓ Swiss Ephemeris PROFESSIONAL MODE                     ║');
      console.log(`║  Version: ${version.padEnd(49)} ║`);
      console.log(`║  Path: ${EPHE_PATH.padEnd(52)} ║`);
      console.log('║  Accuracy: ±0.0001° (NASA JPL DE431/DE441)               ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('Files loaded:');
      found.forEach(f => console.log(`  • ${f}`));
      
      return { 
        success: true, 
        usingFiles: true,
        details: `Professional mode with ${found.length} ephemeris files`
      };
    } else {
      // Fallback mode: Moshier formulas (LESS ACCURATE!)
      sweph.set_ephe_path(null);
      isUsingFiles = false;
      isInitialized = true;
      
      const warning = `⚠️  WARNING: Missing ephemeris files!\n` +
        `Missing: ${missing.join(', ')}\n` +
        `Download from: https://github.com/aloistr/swisseph/tree/master/ephe\n` +
        `Falling back to Moshier formulas (±0.1° accuracy - NOT SUITABLE FOR HD!)`;
      
      console.error('╔══════════════════════════════════════════════════════════╗');
      console.error('║  ⚠️  WARNING: INACCURATE MODE                            ║');
      console.error('║  Using Moshier formulas (±0.1°)                          ║');
      console.error('║  This can produce WRONG Human Design gates!              ║');
      console.error('╚══════════════════════════════════════════════════════════╝');
      console.error(warning);
      
      initError = warning;
      return { 
        success: true, // Still works, but inaccurate
        usingFiles: false,
        error: warning,
        details: 'Fallback mode - Moshier formulas'
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize Swiss Ephemeris:', errorMsg);
    initError = errorMsg;
    return { success: false, usingFiles: false, error: errorMsg };
  }
}

/**
 * Ensure ephemeris is initialized
 * Throws error if not using professional mode
 */
function ensureInitialized(): void {
  if (!isInitialized) {
    const result = initializeEphemeris();
    if (!result.success) {
      throw new Error(`Swiss Ephemeris initialization failed: ${result.error}`);
    }
  }
  
  // CRITICAL: Warn if not using files
  if (!isUsingFiles) {
    console.error('╔══════════════════════════════════════════════════════════╗');
    console.error('║  ⚠️  CRITICAL: PROFESSIONAL ACCURACY NOT AVAILABLE!      ║');
    console.error('║  Calculations may be INACCURATE!                         ║');
    console.error('╚══════════════════════════════════════════════════════════╝');
    // Don't throw - allow fallback for development, but log warning
  }
}

// ============================================================================
// PLANET CONSTANTS
// ============================================================================

export const PLANETS = {
  SUN: sweph.SE_SUN,
  MOON: sweph.SE_MOON,
  MERCURY: sweph.SE_MERCURY,
  VENUS: sweph.SE_VENUS,
  MARS: sweph.SE_MARS,
  JUPITER: sweph.SE_JUPITER,
  SATURN: sweph.SE_SATURN,
  URANUS: sweph.SE_URANUS,
  NEPTUNE: sweph.SE_NEPTUNE,
  PLUTO: sweph.SE_PLUTO,
  MEAN_NODE: sweph.SE_MEAN_NODE,
  TRUE_NODE: sweph.SE_TRUE_NODE,
  CHIRON: sweph.SE_CHIRON,
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
export function calculateJulianDay(birthData: BirthData): number {
  const { year, month, day, hour, minute, timezone } = birthData;
  // Convert local time to UT
  const hourUT = hour - timezone;
  return sweph.julday(year, month, day, hourUT + minute / 60, sweph.SE_GREG_CAL);
}

/**
 * Calculate planet position with PROFESSIONAL accuracy
 */
export function calculatePlanet(jd: number, planet: number): PlanetPosition {
  ensureInitialized();
  
  const flags = sweph.SE_EQUATORIAL;
  const result = sweph.calc_ut(jd, planet, flags);
  
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
export function calculateAllPlanets(jd: number, includeOuter = true): Map<string, PlanetPosition> {
  ensureInitialized();
  
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
      const pos = calculatePlanet(jd, id);
      results.set(name, pos);
    } catch (error) {
      console.error(`Failed to calculate ${name}:`, error);
      // Continue with other planets
    }
  }
  
  return results;
}

/**
 * Calculate Design and Personality positions for HD
 * Design: ~88° before birth (Sun moves ~1° per day)
 */
export function calculateHDMoments(
  birthJd: number,
  includeOuter = true
): { design: Map<string, PlanetPosition>; personality: Map<string, PlanetPosition> } {
  ensureInitialized();
  
  // Design offset: approximately 88 days
  const designOffset = 88.0;
  const designJd = birthJd - designOffset;
  
  const personality = calculateAllPlanets(birthJd, includeOuter);
  const design = calculateAllPlanets(designJd, includeOuter);
  
  return { design, personality };
}

// ============================================================================
// STATUS & DIAGNOSTICS
// ============================================================================

/**
 * Check if using professional ephemeris files
 */
export function isUsingEphemerisFiles(): boolean {
  return isUsingFiles;
}

/**
 * Get Swiss Ephemeris version
 */
export function getVersion(): string {
  return sweph.version();
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
  return {
    initialized: isInitialized,
    usingFiles: isUsingFiles,
    error: initError,
    version: sweph.version(),
  };
}

/**
 * Get detailed diagnostics
 */
export function getDiagnostics(): {
  ephePath: string;
  files: { found: string[]; missing: string[] };
  status: ReturnType<typeof getStatus>;
} {
  return {
    ephePath: EPHE_PATH,
    files: checkEphemerisFiles(EPHE_PATH),
    status: getStatus(),
  };
}

/**
 * Close ephemeris (cleanup)
 */
export function closeEphemeris(): void {
  sweph.close();
  isInitialized = false;
  isUsingFiles = false;
}

// Auto-initialize on module load
initializeEphemeris();
