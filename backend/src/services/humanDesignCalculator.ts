/**
 * Human Design Chart Calculator
 *
 * Pure calculation logic on top of the Swiss Ephemeris service. Centers are
 * derived from complete CHANNELS (both gates active), not from individual
 * gate activations — a single hanging gate does not define a center.
 */

import {
  calculateJulianDay,
  calculateHDMoments,
  longitudeToGate,
  calculateHDDetails,
  type BirthData,
  type EphemerisProvider,
  type PlanetPosition,
} from './ephemeris';
import { CHANNELS } from './hdConstants';

export { CHANNELS };

// ============================================================================
// TYPES
// ============================================================================

export interface Gate {
  number: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  planet: string;
  isDesign: boolean;
}

export interface Channel {
  gate1: number;
  gate2: number;
}

export interface Variables {
  digestion: string;
  environment: string;
  awareness: string;
  motivation: string;
  sense: string;
  style: string;
}

export interface HumanDesignChart {
  energyType: string;
  authority: string;
  profile: string;
  profileLine1: number;
  profileLine2: number;
  incarnationCross: string;
  definedCenters: string[];
  undefinedCenters: string[];
  gates: Gate[];
  channels: Channel[];
  variables: Variables;
  /**
   * Bodies the ephemeris provider could not supply (PLANET_UNAVAILABLE),
   * e.g. ['CHIRON'] from the standard backend. Absent/empty when the chart
   * is complete.
   */
  missingBodies?: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_CENTERS = [
  'HEAD', 'AJNA', 'THROAT', 'G_CENTER', 'HEART',
  'SACRAL', 'ROOT', 'SPLEEN', 'SOLAR_PLEXUS',
] as const;

const MOTOR_CENTERS = new Set(['HEART', 'SOLAR_PLEXUS', 'ROOT', 'SACRAL']);

// Ported from the prior implementation, which was missing gates 8, 16, 17,
// 31, and 43 entirely (they fell through to 'UNKNOWN') — silently breaking
// center-attribution for channels 1-8, 7-31, 16-48, 17-62, and 23-43. This
// table covers all 64 gates across the 9 centers exactly once.
export function gateToCenter(gate: number): string {
  if ([61, 63, 64].includes(gate)) return 'HEAD';
  if ([4, 11, 17, 24, 43, 47].includes(gate)) return 'AJNA';
  if ([8, 12, 16, 20, 23, 31, 33, 35, 45, 56, 62].includes(gate)) return 'THROAT';
  if ([1, 2, 7, 10, 13, 15, 25, 46].includes(gate)) return 'G_CENTER';
  if ([21, 26, 40, 51].includes(gate)) return 'HEART';
  if ([3, 5, 9, 14, 27, 29, 34, 42, 59].includes(gate)) return 'SACRAL';
  if ([18, 28, 32, 44, 48, 50, 57].includes(gate)) return 'SPLEEN';
  if ([6, 22, 30, 36, 37, 49, 55].includes(gate)) return 'SOLAR_PLEXUS';
  if ([19, 38, 39, 41, 52, 53, 54, 58, 60].includes(gate)) return 'ROOT';
  return 'UNKNOWN';
}

// Planets to exclude from the standard 13-activation HD chart (excluded here
// rather than in ephemeris.calculateAllPlanets, which is shared with transit
// calculations that do want Chiron/outer planets).
const HD_EXCLUDED_PLANETS = new Set(['CHIRON']);

// The ephemeris service labels the lunar node "MEAN_NODE" (it's the mean,
// not true, node); the Prisma Planet enum only knows "NORTH_NODE". Map the
// label at the boundary so gate.planet always matches the DB enum.
function canonicalPlanetName(name: string): string {
  return name === 'MEAN_NODE' ? 'NORTH_NODE' : name;
}

// ============================================================================
// GATE / CHANNEL DERIVATION
// ============================================================================

function planetsToGates(planets: Map<string, PlanetPosition>, isDesign: boolean): Gate[] {
  const gates: Gate[] = [];

  for (const [name, pos] of planets) {
    if (HD_EXCLUDED_PLANETS.has(name)) continue;

    const gate = longitudeToGate(pos.longitude);
    const details = calculateHDDetails(pos.longitude);
    gates.push({
      number: gate,
      line: details.line,
      color: details.color,
      tone: details.tone,
      base: details.base,
      planet: canonicalPlanetName(name),
      isDesign,
    });

    // South Node is 180° opposite the (Mean) North Node and is a standard
    // part of the 13-activation HD chart alongside Earth (opposite Sun).
    if (name === 'MEAN_NODE') {
      const southLon = (pos.longitude + 180) % 360;
      const southDetails = calculateHDDetails(southLon);
      gates.push({
        number: longitudeToGate(southLon),
        line: southDetails.line,
        color: southDetails.color,
        tone: southDetails.tone,
        base: southDetails.base,
        planet: 'SOUTH_NODE',
        isDesign,
      });
    }
  }

  return gates;
}

function activeChannels(allGates: Gate[]): [number, number][] {
  const activeGateNumbers = new Set(allGates.map((g) => g.number));
  const channels: [number, number][] = [];
  for (const [g1, g2] of CHANNELS) {
    if (activeGateNumbers.has(g1) && activeGateNumbers.has(g2)) {
      channels.push([g1, g2]);
    }
  }
  return channels;
}

/**
 * A center is only defined when a complete channel (both gates active)
 * connects to it — a single activated gate ("hanging gate") does not
 * define a center.
 */
export function definedCentersFromChannels(channels: [number, number][]): Set<string> {
  const defined = new Set<string>();
  for (const [g1, g2] of channels) {
    defined.add(gateToCenter(g1));
    defined.add(gateToCenter(g2));
  }
  return defined;
}

/**
 * Whether the Throat is reachable from any Motor center (Heart, Solar
 * Plexus, Root, Sacral) by walking only through active-channel edges
 * (i.e. through defined centers). This correctly handles both a direct
 * motor-to-throat channel and an indirect connection through a chain of
 * other defined centers.
 */
export function isMotorConnectedToThroat(channels: [number, number][]): boolean {
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  for (const [g1, g2] of channels) {
    const c1 = gateToCenter(g1);
    const c2 = gateToCenter(g2);
    addEdge(c1, c2);
    addEdge(c2, c1);
  }

  if (!adjacency.has('THROAT')) return false;

  const visited = new Set<string>(['THROAT']);
  const queue = ['THROAT'];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (MOTOR_CENTERS.has(current) && current !== 'THROAT') return true;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export function determineEnergyType(definedCenters: Set<string>, channels: [number, number][]): string {
  const hasSacral = definedCenters.has('SACRAL');
  const hasThroat = definedCenters.has('THROAT');

  if (hasSacral) {
    return isMotorConnectedToThroat(channels) ? 'MANIFESTING_GENERATOR' : 'GENERATOR';
  }
  if (hasThroat && isMotorConnectedToThroat(channels)) {
    return 'MANIFESTOR';
  }
  if (definedCenters.size === 0) {
    return 'REFLECTOR';
  }
  return 'PROJECTOR';
}

function determineAuthority(definedCenters: Set<string>): string {
  if (definedCenters.has('SOLAR_PLEXUS')) return 'EMOTIONAL';
  if (definedCenters.has('SACRAL')) return 'SACRAL';
  if (definedCenters.has('SPLEEN')) return 'SPLENIC';
  if (definedCenters.has('HEART')) return 'EGO';
  if (definedCenters.has('G_CENTER')) return 'SELF_PROJECTED';
  if (definedCenters.has('AJNA')) return 'MENTAL';
  return 'LUNAR';
}

function crossTypeFromProfile(profile: string): string {
  if (['1/3', '1/4', '2/4', '2/5', '3/5', '3/6', '4/6'].includes(profile)) return 'Right Angle Cross';
  if (profile === '4/1') return 'Juxtaposition Cross';
  if (['5/1', '5/2', '6/2', '6/3'].includes(profile)) return 'Left Angle Cross';
  return 'Cross';
}

function determineIncarnationCross(sunGate: number, profile: string): string {
  // A full 112-name incarnation-cross lookup requires an authoritative
  // reference table (per Sun/Earth gate pair) we do not have verified data
  // for yet. Returning a fabricated name would be worse than an honest
  // placeholder, so we surface the cross type + gate instead.
  return `${crossTypeFromProfile(profile)} (Gate ${sunGate})`;
}

// ============================================================================
// PRIMARY HEALTH SYSTEM (PHS) VARIABLES
// ============================================================================

function determinationFromColor(color: number, line: number): string {
  const base = ['Appetite', 'Taste', 'Thirst', 'Touch', 'Sound', 'Light'][color - 1] ?? 'Appetite';
  const direction = line <= 3 ? 'Left' : 'Right';
  return `${base} (${direction})`;
}

function environmentFromColor(color: number): string {
  return ['Markets', 'Caves', 'Kitchens', 'Mountains', 'Valleys', 'Shores'][color - 1] ?? 'Markets';
}

function awarenessFromTone(tone: number): string {
  return ['Smell', 'Taste', 'Outer Vision', 'Inner Vision', 'Feeling', 'Touch'][tone - 1] ?? 'Smell';
}

function motivationFromColor(color: number): string {
  return ['Fear', 'Hope', 'Desire', 'Need', 'Guilt', 'Innocence'][color - 1] ?? 'Fear';
}

function styleFromTone(tone: number): string {
  if (tone <= 2) return 'Lunar';
  if (tone <= 4) return 'Passive';
  return 'Active';
}

function calculateVariables(gates: Gate[]): Variables {
  const designSun = gates.find((g) => g.planet === 'SUN' && g.isDesign);
  const designMoon = gates.find((g) => g.planet === 'MOON' && g.isDesign);
  const personalitySun = gates.find((g) => g.planet === 'SUN' && !g.isDesign);
  const northNode = gates.find((g) => g.planet === 'NORTH_NODE');

  return {
    digestion: designMoon ? determinationFromColor(designMoon.color, designMoon.line) : 'Appetite (Left)',
    environment: designSun ? environmentFromColor(designSun.color) : 'Markets',
    awareness: designMoon ? awarenessFromTone(designMoon.tone) : 'Smell',
    motivation: (personalitySun ?? designSun) ? motivationFromColor((personalitySun ?? designSun)!.color) : 'Fear',
    sense: designMoon ? awarenessFromTone(designMoon.tone) : 'Smell',
    style: northNode ? styleFromTone(northNode.tone) : 'Lunar',
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function calculateHumanDesignChart(birthData: BirthData, provider?: EphemerisProvider): HumanDesignChart {
  const jd = calculateJulianDay(birthData, provider);
  const { design, personality, missingBodies } = calculateHDMoments(jd, true, provider);

  const personalityGates = planetsToGates(personality, false);
  const designGates = planetsToGates(design, true);
  const allGates = [...personalityGates, ...designGates];

  const channels = activeChannels(allGates);
  const definedCentersSet = definedCentersFromChannels(channels);
  const undefinedCenters = ALL_CENTERS.filter((c) => !definedCentersSet.has(c));

  const sunGateInfo = personalityGates.find((g) => g.planet === 'SUN');
  const earthGateInfo = personalityGates.find((g) => g.planet === 'EARTH');
  if (!sunGateInfo || !earthGateInfo) {
    throw new Error('Sun/Earth gate calculation failed');
  }

  const profile = `${sunGateInfo.line}/${earthGateInfo.line}`;
  const energyType = determineEnergyType(definedCentersSet, channels);
  const authority = determineAuthority(definedCentersSet);
  const incarnationCross = determineIncarnationCross(sunGateInfo.number, profile);
  const variables = calculateVariables(allGates);

  return {
    energyType,
    authority,
    profile,
    profileLine1: sunGateInfo.line,
    profileLine2: earthGateInfo.line,
    incarnationCross,
    definedCenters: Array.from(definedCentersSet),
    undefinedCenters,
    gates: allGates,
    channels: channels.map(([gate1, gate2]) => ({ gate1, gate2 })),
    variables,
    missingBodies,
  };
}
