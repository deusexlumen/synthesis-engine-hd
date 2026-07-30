# StandardProvider — Standard-Tier Ephemeris (astronomia)

Phase B of the precision-ephemeris feature. The `StandardProvider`
(`backend/src/services/ephemeris/standardProvider.ts`) is the FREE/BASIC/guest
ephemeris backend behind the `EphemerisProvider` interface from Phase A.

## Library decision

| Candidate | License | Verdict |
|---|---|---|
| `astronomia` 4.2.0 (Meeus: VSOP87, ELP2000-82) | MIT | **chosen** |
| `ephemeris` 2.2.0 (Moshier) | GPL-3.0 | rejected — copyleft, not allowed for a commercial tier |

`astronomia` is actively maintained (last release 2025-08), declares
`node >= 12` (runs fine on Node 20/22), ships no native code, and covers
Sun, Moon, Mercury–Neptune (VSOP87 full series), Pluto (Meeus ch. 37), and
the mean/true lunar node. `pnpm audit` after adding it: no high/critical
vulnerabilities (1 low, pre-existing transitive).

## Accuracy (measured)

Benchmark: `backend/src/tests/standardProvider.accuracy.test.ts` against
`src/tests/fixtures/swephReference.json` — 10 dates 1950–2030 generated with
the real Swiss Ephemeris 2.10.03 + `sepl_18`/`semo_18` files
(`scripts/generate-sweph-reference.mjs`). Max longitude error across all
samples:

| Body | Max error | Tolerance (asserted) |
|---|---|---|
| Sun | 0.0059° | 0.1° |
| Moon | 0.0152° | 0.5° |
| Mercury | 0.0085° | 0.1° |
| Venus | 0.0078° | 0.1° |
| Mars | 0.0078° | 0.1° |
| Jupiter | 0.0091° | 0.1° |
| Saturn | 0.0093° | 0.1° |
| Uranus | 0.0087° | 0.1° |
| Neptune | 0.0094° | 0.1° |
| Pluto | 0.0090° | 0.1° |
| Mean Node | 0.0051° | 0.1° |

The residual error is dominated by aberration and nutation (the provider
returns mean equinox of date, sweph returns apparent positions) and by
treating UT ≈ TT (ΔT ignored). Both are far below the tier tolerances, and
longitude speeds agree with sweph in sign for every non-stationary sample
(retrograde detection is exact).

## Known limitations

- **Chiron is not available.** `calcUt` throws `PlanetUnavailableError`
  (`code: 'PLANET_UNAVAILABLE'`). `calculateAllPlanets` skips such bodies and
  `calculateHumanDesignChart` reports them as `missingBodies: ['CHIRON']`;
  the `/api/hd/calculate` route exposes this as `meta.missingBodies`.
  (Chiron is excluded from the 13-activation HD chart regardless.)
- Positions are mean equinox of date (no nutation/aberration) — see above.
- Pluto uses the low-order Meeus ch. 37 series; fine for 1950–2030
  (max 0.009° measured) but not validated far outside that range.
