/**
 * One-off generator for src/tests/fixtures/swephReference.json.
 *
 * Requires the native `sweph` module to be built (node-gyp) and the .se1
 * ephemeris files in backend/ephemeris. The generated fixture pins Swiss
 * Ephemeris reference positions so the StandardProvider accuracy benchmark
 * can run on machines where the native module is unavailable (CI, tests
 * running against the sweph mock).
 *
 * Usage: node scripts/generate-sweph-reference.mjs
 */

import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const sweph = require('sweph');
sweph.set_ephe_path(path.join(__dirname, '..', 'ephemeris'));

const SEFLG_SWIEPH = 2;
const SEFLG_SPEED = 256;
const FLAGS = SEFLG_SWIEPH | SEFLG_SPEED;

const PLANET_IDS = {
  SUN: 0, MOON: 1, MERCURY: 2, VENUS: 3, MARS: 4, JUPITER: 5,
  SATURN: 6, URANUS: 7, NEPTUNE: 8, PLUTO: 9, MEAN_NODE: 10,
};

// 10 samples spread across 1950–2030, varied hours to catch retrograde and
// fast-moving bodies in different configurations.
const SAMPLES = [
  { year: 1950, month: 3, day: 21, hourUT: 6.0 },
  { year: 1958, month: 11, day: 5, hourUT: 18.5 },
  { year: 1967, month: 7, day: 14, hourUT: 0.0 },
  { year: 1973, month: 1, day: 30, hourUT: 12.0 },
  { year: 1981, month: 9, day: 9, hourUT: 21.75 },
  { year: 1990, month: 5, day: 27, hourUT: 3.25 },
  { year: 2000, month: 1, day: 1, hourUT: 12.0 },
  { year: 2008, month: 12, day: 31, hourUT: 23.9833333 },
  { year: 2017, month: 6, day: 15, hourUT: 9.5 },
  { year: 2030, month: 2, day: 14, hourUT: 15.0 },
];

const round = (v, digits = 8) => Number(v.toFixed(digits));

const fixture = {
  generatedAt: new Date().toISOString(),
  generator: 'scripts/generate-sweph-reference.mjs',
  swephVersion: sweph.version(),
  flags: FLAGS,
  note: 'Geocentric ecliptic-of-date positions (SEFLG_SWIEPH|SEFLG_SPEED), ' +
    'data = [lon, lat, dist, lonSpeed, latSpeed, distSpeed].',
  samples: SAMPLES.map(({ year, month, day, hourUT }) => {
    const jd = sweph.julday(year, month, day, hourUT, sweph.constants.SE_GREG_CAL);
    const planets = {};
    for (const [name, id] of Object.entries(PLANET_IDS)) {
      const r = sweph.calc_ut(jd, id, FLAGS);
      if (r.error) throw new Error(`calc_ut failed for ${name} at JD ${jd}: ${r.error}`);
      planets[name] = r.data.map((v) => round(v));
    }
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year, month, day, hourUT,
      julianDay: round(jd, 6),
      planets,
    };
  }),
};

const outPath = path.join(__dirname, '..', 'src', 'tests', 'fixtures', 'swephReference.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n');
console.log(`Wrote ${fixture.samples.length} samples to ${outPath}`);
