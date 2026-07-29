/**
 * Mock for sweph (Swiss Ephemeris) — used when native module is not available
 * Provides deterministic fake positions for testing
 */

// Planet IDs
export const SE_SUN = 0;
export const SE_MOON = 1;
export const SE_MERCURY = 2;
export const SE_VENUS = 3;
export const SE_MARS = 4;
export const SE_JUPITER = 5;
export const SE_SATURN = 6;
export const SE_URANUS = 7;
export const SE_NEPTUNE = 8;
export const SE_PLUTO = 9;
export const SE_MEAN_NODE = 10;
export const SE_TRUE_NODE = 11;
export const SE_CHIRON = 15;

// Calendar
export const SE_GREG_CAL = 1;

// Flags
export const SE_EQUATORIAL = 2;
export const SEFLG_SWIEPH = 2;
export const SEFLG_SPEED = 256;

// The real `sweph` package nests all constants under `.constants`
// (sweph.constants.SE_SUN, not sweph.SE_SUN) — mirror that shape here so the
// mock doesn't diverge from the real module's access pattern.
export const constants = {
  SE_SUN, SE_MOON, SE_MERCURY, SE_VENUS, SE_MARS, SE_JUPITER, SE_SATURN,
  SE_URANUS, SE_NEPTUNE, SE_PLUTO, SE_MEAN_NODE, SE_TRUE_NODE, SE_CHIRON,
  SE_GREG_CAL, SE_EQUATORIAL, SEFLG_SWIEPH, SEFLG_SPEED,
};

// Deterministic fake positions for each planet (longitude in degrees)
const FAKE_POSITIONS: Record<number, number> = {
  [SE_SUN]: 15.5,
  [SE_MOON]: 120.3,
  [SE_MERCURY]: 18.2,
  [SE_VENUS]: 45.7,
  [SE_MARS]: 200.1,
  [SE_JUPITER]: 85.4,
  [SE_SATURN]: 310.8,
  [SE_URANUS]: 25.6,
  [SE_NEPTUNE]: 350.2,
  [SE_PLUTO]: 295.4,
  [SE_MEAN_NODE]: 180.0,
  [SE_TRUE_NODE]: 181.5,
  [SE_CHIRON]: 15.0,
};

export function set_ephe_path(_path: string | null): void {
  // no-op in mock
}

export function version(): string {
  return 'mock-2.10.03';
}

export function julday(
  year: number,
  month: number,
  day: number,
  hour: number,
  _cal: number
): number {
  // Simplified Julian Day calculation (accurate enough for tests)
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jd - 0.5 + hour / 24;
}

export function calc_ut(
  _jd: number,
  planet: number,
  _flags: number
): { data: number[]; error?: string } {
  const longitude = FAKE_POSITIONS[planet] ?? 0;
  // Return: [longitude, latitude, distance, speedLongitude, speedLatitude, speedDistance]
  return {
    data: [longitude, 0, 1, 0.01, 0, 0],
  };
}

export function close(): void {
  // no-op in mock
}
