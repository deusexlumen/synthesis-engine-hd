/**
 * SwephProvider — professional ephemeris backend.
 *
 * Wraps the `sweph` native module (Swiss Ephemeris, NASA JPL-level accuracy
 * ±0.0001°) behind the EphemerisProvider interface. Owns everything that
 * used to be module-global state in services/ephemeris.ts: initialization,
 * .se1 ephemeris-file detection, and the Moshier fallback warning when the
 * files are missing.
 *
 * The native module is loaded lazily so importing this file never crashes on
 * machines without sweph; a controlled error is raised on first use instead.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getSeEphePath } from '../../lib/config';
import type { CalcFlags, EphemerisProvider, PlanetId, PlanetPositionRaw } from './types';

// ============================================================================
// CONFIGURATION - CRITICAL FOR ACCURACY
// ============================================================================
// The ephemeris path lives in lib/config (Phase C) and is read lazily so
// tests can point SE_EPHE_PATH at a fixture directory per case.

// Required files for professional accuracy
const REQUIRED_FILES = ['sepl_18.se1', 'semo_18.se1'];
const OPTIONAL_FILES = ['seas_18.se1', 'sefstars.txt'];

export interface SwephInitResult {
  success: boolean;
  usingFiles: boolean;
  error?: string;
  details?: string;
}

export interface SwephStatus {
  initialized: boolean;
  usingFiles: boolean;
  error: string | null;
  version: string;
}

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

export class SwephProvider implements EphemerisProvider {
  readonly name = 'swiss-professional' as const;

  // sweph is a native CommonJS module without typings; keep it as `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sweph: any = null;
  private initialized = false;
  private usingFiles = false;
  private initError: string | null = null;

  /**
   * Lazily load the native module. In the test environment the deterministic
   * mock is used as fallback; everywhere else a missing module raises a
   * controlled error instead of a TypeError on first property access.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private loadSweph(): any {
    if (this.sweph) {
      return this.sweph;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.sweph = require('sweph');
    } catch (e) {
      if (process.env.NODE_ENV === 'test') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.sweph = require('../../__mocks__/sweph');
      } else {
        throw new Error(
          'Swiss Ephemeris native module "sweph" is not available. ' +
          'Install it (pnpm add sweph) or run with the standard ephemeris provider.'
        );
      }
    }
    return this.sweph;
  }

  /**
   * Initialize Swiss Ephemeris - CRITICAL STEP
   * Must be called before any calculations!
   */
  initialize(): SwephInitResult {
    if (this.initialized) {
      return { success: true, usingFiles: this.usingFiles };
    }

    try {
      const sweph = this.loadSweph();
      const ephePath = getSeEphePath();

      // Check for ephemeris files
      const { found, missing } = checkEphemerisFiles(ephePath);

      if (missing.length === 0) {
        // Professional mode: Use .se1 files
        sweph.set_ephe_path(ephePath);
        this.usingFiles = true;
        this.initialized = true;

        const version = sweph.version();
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  ✓ Swiss Ephemeris PROFESSIONAL MODE                     ║');
        console.log(`║  Version: ${version.padEnd(49)} ║`);
        console.log(`║  Path: ${ephePath.padEnd(52)} ║`);
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
        this.usingFiles = false;
        this.initialized = true;

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

        this.initError = warning;
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
      this.initError = errorMsg;
      return { success: false, usingFiles: false, error: errorMsg };
    }
  }

  /**
   * Ensure ephemeris is initialized
   * Throws error if initialization failed
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      const result = this.initialize();
      if (!result.success) {
        throw new Error(`Swiss Ephemeris initialization failed: ${result.error}`);
      }
    }

    // CRITICAL: Warn if not using files
    if (!this.usingFiles) {
      console.error('╔══════════════════════════════════════════════════════════╗');
      console.error('║  ⚠️  CRITICAL: PROFESSIONAL ACCURACY NOT AVAILABLE!      ║');
      console.error('║  Calculations may be INACCURATE!                         ║');
      console.error('╚══════════════════════════════════════════════════════════╝');
      // Don't throw - allow fallback for development, but log warning
    }
  }

  julday(year: number, month: number, day: number, hourUT: number): number {
    const sweph = this.loadSweph();
    // sweph.SE_GREG_CAL does not exist (constants live under sweph.constants);
    // passing undefined here left the calendar system unspecified.
    return sweph.julday(year, month, day, hourUT, sweph.constants?.SE_GREG_CAL ?? 1);
  }

  calcUt(jd: number, planetId: PlanetId, flags: CalcFlags): PlanetPositionRaw {
    this.ensureInitialized();
    return this.loadSweph().calc_ut(jd, planetId, flags);
  }

  version(): string {
    return this.loadSweph().version();
  }

  /**
   * Check if using professional ephemeris files
   */
  isUsingFiles(): boolean {
    return this.usingFiles;
  }

  /**
   * Get initialization status
   */
  getStatus(): SwephStatus {
    return {
      initialized: this.initialized,
      usingFiles: this.usingFiles,
      error: this.initError,
      version: this.version(),
    };
  }

  /**
   * Get detailed diagnostics
   */
  getDiagnostics(): {
    ephePath: string;
    files: { found: string[]; missing: string[] };
    status: SwephStatus;
  } {
    const ephePath = getSeEphePath();
    return {
      ephePath,
      files: checkEphemerisFiles(ephePath),
      status: this.getStatus(),
    };
  }

  /**
   * Close ephemeris (cleanup)
   */
  close(): void {
    if (this.sweph) {
      this.sweph.close();
    }
    this.initialized = false;
    this.usingFiles = false;
  }
}
