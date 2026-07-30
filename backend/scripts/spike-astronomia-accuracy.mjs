/* Accuracy spike: astronomia geocentric ecliptic vs sweph reference fixture. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pp = require('astronomia/planetposition');
const moonposition = require('astronomia/moonposition');
const pluto = require('astronomia/pluto');
const precess = require('astronomia/precess');
const coord = require('astronomia/coord');
const base = require('astronomia/base');

const D = 180 / Math.PI;
const KM_PER_AU = 149597870.7;
const LIGHT_TIME = 0.0057755183; // days per AU

const v87 = {};
for (const name of ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune']) {
  v87[name] = new pp.Planet(require(`astronomia/data/vsop87B${name}`).default);
}

function helioToXYZ({ lon, lat, range }) {
  return {
    x: range * Math.cos(lat) * Math.cos(lon),
    y: range * Math.cos(lat) * Math.sin(lon),
    z: range * Math.sin(lat),
  };
}
function xyzToLonLat({ x, y, z }) {
  const r = Math.sqrt(x * x + y * y + z * z);
  return { lon: Math.atan2(y, x), lat: Math.asin(z / r), range: r };
}

// precess J2000 ecliptic -> of-date
function toOfDate(lon, lat, jde) {
  const from = new coord.Ecliptic(lon, lat);
  const to = precess.eclipticPosition(from, 2000.0, base.JDEToJulianYear(jde));
  return to;
}

function geocentricPlanet(planet, jde) {
  const earth = v87.earth.position(jde); // of-date helio
  let tau = 0;
  for (let i = 0; i < 2; i++) {
    const p = planet.position(jde - tau);
    const pv = helioToXYZ(p), ev = helioToXYZ(earth);
    const g = xyzToLonLat({ x: pv.x - ev.x, y: pv.y - ev.y, z: pv.z - ev.z });
    tau = g.range * LIGHT_TIME;
    if (i === 1) return g;
  }
}

function geocentricSun(jde) {
  const tau = 0.9833 * LIGHT_TIME; // ~1 AU light time, second pass below
  let e = v87.earth.position(jde - tau);
  let g = xyzToLonLat({ x: -helioToXYZ(e).x, y: -helioToXYZ(e).y, z: -helioToXYZ(e).z });
  e = v87.earth.position(jde - g.range * LIGHT_TIME);
  g = xyzToLonLat({ x: -helioToXYZ(e).x, y: -helioToXYZ(e).y, z: -helioToXYZ(e).z });
  return g;
}

function geocentricPluto(jde) {
  const earth = v87.earth.position(jde);
  let tau = 0;
  for (let i = 0; i < 2; i++) {
    const h = pluto.heliocentric(jde - tau); // J2000 frame
    const pd = toOfDate(h.lon, h.lat, jde);
    const pv = helioToXYZ({ lon: pd.lon, lat: pd.lat, range: h.range });
    const ev = helioToXYZ(earth);
    const g = xyzToLonLat({ x: pv.x - ev.x, y: pv.y - ev.y, z: pv.z - ev.z });
    tau = g.range * LIGHT_TIME;
    if (i === 1) return g;
  }
}

const norm = (deg) => ((deg % 360) + 360) % 360;
const angDiff = (degA, degB) => {
  const d = Math.abs(norm(degA) - norm(degB)) % 360;
  return d > 180 ? 360 - d : d;
};

const fixture = require('../src/tests/fixtures/swephReference.json');
const errors = {};
for (const s of fixture.samples) {
  const jd = s.julianDay;
  const ours = {
    SUN: geocentricSun(jd),
    MOON: (() => { const m = moonposition.position(jd); return { lon: m.lon, lat: m.lat, range: m.range / KM_PER_AU }; })(),
    MERCURY: geocentricPlanet(v87.mercury, jd),
    VENUS: geocentricPlanet(v87.venus, jd),
    MARS: geocentricPlanet(v87.mars, jd),
    JUPITER: geocentricPlanet(v87.jupiter, jd),
    SATURN: geocentricPlanet(v87.saturn, jd),
    URANUS: geocentricPlanet(v87.uranus, jd),
    NEPTUNE: geocentricPlanet(v87.neptune, jd),
    PLUTO: geocentricPluto(jd),
    MEAN_NODE: { lon: moonposition.node(jd), lat: 0, range: 0 },
  };
  for (const [name, ref] of Object.entries(s.planets)) {
    const err = angDiff(ours[name].lon * D, ref[0]);
    if (!errors[name] || err > errors[name].max) errors[name] = { ...(errors[name] || {}), max: err };
  }
}
console.log('max longitude error (deg) per body across 10 samples:');
for (const [k, v] of Object.entries(errors)) console.log(k.padEnd(10), v.max.toFixed(6));
