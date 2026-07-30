/**
 * Minimal type declarations for the `astronomia` modules used by
 * services/ephemeris/standardProvider.ts. The package ships no typings;
 * only the surface we actually call is declared here.
 */

declare module 'astronomia/planetposition' {
  export interface EclipticCoord {
    lon: number; // radians
    lat: number; // radians
    range: number; // AU
  }
  export class Planet {
    constructor(series: unknown);
    /** Heliocentric ecliptic position, equinox and ecliptic of date. */
    position(jde: number): EclipticCoord;
    /** Heliocentric ecliptic position, J2000. */
    position2000(jde: number): EclipticCoord;
  }
}

declare module 'astronomia/data/vsop87Bmercury' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Bvenus' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Bearth' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Bmars' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Bjupiter' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Bsaturn' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Buranus' { const series: unknown; export default series; }
declare module 'astronomia/data/vsop87Bneptune' { const series: unknown; export default series; }

declare module 'astronomia/moonposition' {
  export interface MoonCoord {
    lon: number; // radians
    lat: number; // radians
    range: number; // km (center-to-center distance)
  }
  /** Geocentric Moon, mean equinox of date, no nutation. */
  export function position(jde: number): MoonCoord;
  /** Longitude of the mean ascending node of the lunar orbit, radians. */
  export function node(jde: number): number;
  /** Longitude of the true ascending node, radians. */
  export function trueNode(jde: number): number;
}

declare module 'astronomia/pluto' {
  export interface PlutoCoord {
    lon: number; // radians, J2000 ecliptic
    lat: number; // radians, J2000 ecliptic
    range: number; // AU
  }
  /** Heliocentric ecliptic position of Pluto (Meeus ch. 37), J2000. */
  export function heliocentric(jde: number): PlutoCoord;
}

declare module 'astronomia/coord' {
  export class Ecliptic {
    constructor(lon: number, lat: number);
    lon: number;
    lat: number;
  }
}

declare module 'astronomia/precess' {
  import type { Ecliptic } from 'astronomia/coord';
  /** Precess ecliptic coordinates from one epoch to another. */
  export function eclipticPosition(pos: Ecliptic, epochFrom: number, epochTo: number): Ecliptic;
}

declare module 'astronomia/base' {
  export function JDEToJulianYear(jde: number): number;
}
