/**
 * StandardProvider — free-tier ephemeris backend (no native deps).
 *
 * Implements the EphemerisProvider contract on top of the MIT-licensed
 * `astronomia` library (Meeus algorithms: VSOP87 for Mercury–Neptune,
 * ELP2000-82 truncated for the Moon, Meeus ch. 37 for Pluto, mean lunar
 * node per Meeus ch. 22). Positions are geocentric ecliptic of date with
 * light-time correction, matching the frame the SwephProvider returns for
 * SEFLG_SWIEPH — minus aberration and nutation (together ≤ ~0.01°, well
 * inside the tier's tolerance).
 *
 * Measured accuracy vs. Swiss Ephemeris (.se1 files), 10 samples 1950–2030:
 * Sun/planets/node ≤ 0.010°, Moon ≤ 0.016° (see
 * tests/standardProvider.accuracy.test.ts and docs/EPHEMERIS_STANDARD_PROVIDER.md).
 *
 * Chiron is not covered by the library; calcUt throws PlanetUnavailableError
 * (code PLANET_UNAVAILABLE) for it, so callers can degrade gracefully.
 */

import { Planet } from 'astronomia/planetposition';
import vsop87Bmercury from 'astronomia/data/vsop87Bmercury';
import vsop87Bvenus from 'astronomia/data/vsop87Bvenus';
import vsop87Bearth from 'astronomia/data/vsop87Bearth';
import vsop87Bmars from 'astronomia/data/vsop87Bmars';
import vsop87Bjupiter from 'astronomia/data/vsop87Bjupiter';
import vsop87Bsaturn from 'astronomia/data/vsop87Bsaturn';
import vsop87Buranus from 'astronomia/data/vsop87Buranus';
import vsop87Bneptune from 'astronomia/data/vsop87Bneptune';
import * as moonposition from 'astronomia/moonposition';
import * as pluto from 'astronomia/pluto';
import { Ecliptic } from 'astronomia/coord';
import { eclipticPosition } from 'astronomia/precess';
import { JDEToJulianYear } from 'astronomia/base';
import type { CalcFlags, EphemerisProvider, PlanetId, PlanetPositionRaw } from './types';

// Swiss Ephemeris planet IDs (mirrors PLANETS in services/ephemeris.ts;
// hardcoded so this module has no dependency on the native-backed service,
// which auto-initializes sweph on import).
const SE_SUN = 0;
const SE_MOON = 1;
const SE_MERCURY = 2;
const SE_VENUS = 3;
const SE_MARS = 4;
const SE_JUPITER = 5;
const SE_SATURN = 6;
const SE_URANUS = 7;
const SE_NEPTUNE = 8;
const SE_PLUTO = 9;
const SE_MEAN_NODE = 10;
const SE_TRUE_NODE = 11;

const RAD2DEG = 180 / Math.PI;
const KM_PER_AU = 149597870.7;
/** Light travel time in days per AU (Meeus ch. 33). */
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;
/** Half-step for the central finite difference used for speeds. */
const SPEED_STEP_DAYS = 0.05;

/**
 * Error thrown when the standard backend cannot provide a body
 * (e.g. Chiron, or any unknown planet ID). Callers are expected to catch it
 * and continue without that body.
 */
export class PlanetUnavailableError extends Error {
  readonly code = 'PLANET_UNAVAILABLE';
  constructor(readonly planetId: PlanetId) {
    super(`Planet ID ${planetId} is not available in the standard ephemeris backend`);
    this.name = 'PlanetUnavailableError';
  }
}

interface LonLatRange {
  lon: number; // radians
  lat: number; // radians
  range: number; // AU
}

const V87_PLANETS: Record<number, Planet> = {
  [SE_MERCURY]: new Planet(vsop87Bmercury),
  [SE_VENUS]: new Planet(vsop87Bvenus),
  [SE_MARS]: new Planet(vsop87Bmars),
  [SE_JUPITER]: new Planet(vsop87Bjupiter),
  [SE_SATURN]: new Planet(vsop87Bsaturn),
  [SE_URANUS]: new Planet(vsop87Buranus),
  [SE_NEPTUNE]: new Planet(vsop87Bneptune),
};

function helioToXYZ({ lon, lat, range }: LonLatRange): { x: number; y: number; z: number } {
  return {
    x: range * Math.cos(lat) * Math.cos(lon),
    y: range * Math.cos(lat) * Math.sin(lon),
    z: range * Math.sin(lat),
  };
}

function xyzToLonLat({ x, y, z }: { x: number; y: number; z: number }): LonLatRange {
  const range = Math.sqrt(x * x + y * y + z * z);
  return { lon: Math.atan2(y, x), lat: Math.asin(z / range), range };
}

/** Geocentric ecliptic-of-date position for a VSOP87 planet, with light time. */
function geocentricV87(planet: Planet, jde: number, earth: LonLatRange): LonLatRange {
  let tau = 0;
  for (let i = 0; i < 2; i++) {
    const p = planet.position(jde - tau);
    const pv = helioToXYZ(p);
    const ev = helioToXYZ(earth);
    const g = xyzToLonLat({ x: pv.x - ev.x, y: pv.y - ev.y, z: pv.z - ev.z });
    tau = g.range * LIGHT_TIME_DAYS_PER_AU;
    if (i === 1) return g;
  }
  throw new Error('unreachable');
}

/** Geocentric Sun = negative Earth vector, with light time (~8.3 min). */
function geocentricSun(jde: number): LonLatRange {
  let tau = 0;
  for (let i = 0; i < 2; i++) {
    const e = EARTH.position(jde - tau);
    const ev = helioToXYZ(e);
    const g = xyzToLonLat({ x: -ev.x, y: -ev.y, z: -ev.z });
    tau = g.range * LIGHT_TIME_DAYS_PER_AU;
    if (i === 1) return g;
  }
  throw new Error('unreachable');
}

/** Geocentric Pluto: Meeus ch. 37 heliocentric J2000, precessed to of-date. */
function geocentricPluto(jde: number, earth: LonLatRange): LonLatRange {
  let tau = 0;
  for (let i = 0; i < 2; i++) {
    const h = pluto.heliocentric(jde - tau);
    const ofDate = eclipticPosition(new Ecliptic(h.lon, h.lat), 2000.0, JDEToJulianYear(jde));
    const pv = helioToXYZ({ lon: ofDate.lon, lat: ofDate.lat, range: h.range });
    const ev = helioToXYZ(earth);
    const g = xyzToLonLat({ x: pv.x - ev.x, y: pv.y - ev.y, z: pv.z - ev.z });
    tau = g.range * LIGHT_TIME_DAYS_PER_AU;
    if (i === 1) return g;
  }
  throw new Error('unreachable');
}

const EARTH = new Planet(vsop87Bearth);

/** Longitude/latitude/range for one body, internal radian-based form. */
function positionOf(jd: number, planetId: PlanetId): LonLatRange {
  // astronomia expects JDE (TT); we pass UT. ΔT (~1 min of time) shifts
  // longitudes by ≤ ~0.002° even for the Moon — below this tier's tolerance.
  const jde = jd;
  switch (planetId) {
    case SE_SUN:
      return geocentricSun(jde);
    case SE_MOON: {
      const m = moonposition.position(jde);
      return { lon: m.lon, lat: m.lat, range: m.range / KM_PER_AU };
    }
    case SE_PLUTO:
      return geocentricPluto(jde, EARTH.position(jde));
    case SE_MEAN_NODE:
      return { lon: moonposition.node(jde), lat: 0, range: 0 };
    case SE_TRUE_NODE:
      return { lon: moonposition.trueNode(jde), lat: 0, range: 0 };
    default: {
      const planet = V87_PLANETS[planetId];
      if (!planet) {
        throw new PlanetUnavailableError(planetId);
      }
      return geocentricV87(planet, jde, EARTH.position(jde));
    }
  }
}

/** Shortest signed angular difference b−a in degrees, in (−180, 180]. */
function angDiffDeg(b: number, a: number): number {
  return ((b - a + 540) % 360) - 180;
}

export class StandardProvider implements EphemerisProvider {
  readonly name = 'standard' as const;

  /**
   * Julian Day (UT) for a Gregorian calendar date — Meeus ch. 7.
   * J2000.0 check: julday(2000, 1, 1, 12) === 2451545.0.
   */
  julday(year: number, month: number, day: number, hourUT: number): number {
    let y = year;
    let m = month;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const a = Math.floor(y / 100);
    const b = 2 - a + Math.floor(a / 4);
    return (
      Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      day + b - 1524.5 +
      hourUT / 24
    );
  }

  /**
   * Geocentric ecliptic-of-date position. The flags argument is accepted for
   * interface compatibility; speeds are always computed (SEFLG_SPEED is the
   * only flag the calculation layer sets).
   */
  calcUt(jd: number, planetId: PlanetId, _flags: CalcFlags): PlanetPositionRaw {
    const p = positionOf(jd, planetId);
    const before = positionOf(jd - SPEED_STEP_DAYS, planetId);
    const after = positionOf(jd + SPEED_STEP_DAYS, planetId);

    const lon = ((p.lon * RAD2DEG) % 360 + 360) % 360;
    const lonBefore = ((before.lon * RAD2DEG) % 360 + 360) % 360;
    const lonAfter = ((after.lon * RAD2DEG) % 360 + 360) % 360;

    return {
      data: [
        lon,
        p.lat * RAD2DEG,
        p.range,
        angDiffDeg(lonAfter, lonBefore) / (2 * SPEED_STEP_DAYS),
        (after.lat - before.lat) * RAD2DEG / (2 * SPEED_STEP_DAYS),
        (after.range - before.range) / (2 * SPEED_STEP_DAYS),
      ],
    };
  }

  version(): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('astronomia/package.json') as { version: string };
    return `astronomia-${pkg.version} (Meeus VSOP87/ELP2000)`;
  }

  /**
   * Parity with SwephProvider: no initialization needed — the library is
   * pure JS with no ephemeris files. Always succeeds, never uses files.
   */
  initialize(): { success: boolean; usingFiles: boolean } {
    return { success: true, usingFiles: false };
  }

  isUsingFiles(): boolean {
    return false;
  }

  /** No-op: there are no resources to release. */
  close(): void {
    // nothing to close
  }
}
