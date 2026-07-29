/**
 * TypeScript types for Human Design & Numerology
 * ALIGNED with Backend API Response Format
 */

// ============================================================================
// API REQUEST TYPES
// ============================================================================

export interface BirthData {
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  latitude: number;
  longitude: number;
  timezone: string; // IANA timezone string
  city?: string;
  country?: string;
}

// Internal API format (transformed before sending)
export interface APICalculationRequest {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  latitude: number;
  longitude: number;
  timezone: number; // Offset in hours
}

// ============================================================================
// GEOCODING TYPES
// ============================================================================

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  timezone?: string;
}

export interface TimezoneResult {
  timezone: string;
  offset: number; // Hours from UTC
}

// ============================================================================
// GATE & CHANNEL TYPES
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

// ============================================================================
// VARIABLES TYPE
// ============================================================================

export interface Variables {
  digestion: string;
  environment: string;
  awareness: string;
  motivation: string;
  sense: string;
  style: string;
}

// ============================================================================
// HUMAN DESIGN CHART
// ============================================================================

export interface HumanDesignChart {
  energyType: EnergyType;
  authority: Authority;
  profile: string; // "1/3", "4/6", etc.
  profileLine1: number;
  profileLine2: number;
  incarnationCross: string;
  definedCenters: Center[];
  undefinedCenters: Center[];
  gates: Gate[];
  channels: Channel[];
  variables: Variables;
}

// ============================================================================
// NUMEROLOGY TYPES (Millman)
// ============================================================================

export interface Challenge {
  ageRange: string;
  challengeNumber: number;
}

export interface Pinnacle {
  ageRange: string;
  pinnacleNumber: number;
}

export interface MillmanProfile {
  lifePathString: string;
  root1: number;
  root2: number;
  baseSum: number;
  destinyNumber: number;
  hasMasterNumber: boolean;
  hasZeroEnhancer: boolean;
  soulUrgeString?: string;
  expressionString?: string;
  challenges: Challenge[];
  pinnacles: Pinnacle[];
  personalYear: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface HDChartResponse {
  success: boolean;
  accuracy: 'PROFESSIONAL' | 'FALLBACK';
  data: HumanDesignChart;
  meta: {
    calculatedAt: string;
    calculationTimeMs: number;
    usingEphemeris: boolean;
    swissephVersion: string;
    birthData: {
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      latitude: number;
      longitude: number;
      timezone: number;
      julianDay: number;
    };
  };
}

// ============================================================================
// TRANSIT TYPES
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

export interface DailyTransitResponse {
  success: boolean;
  data: DailyTransit;
}

export interface HealthCheckResponse {
  status: 'ok' | 'warning' | 'error';
  ephemeris: {
    usingFiles: boolean;
    version: string;
  };
  diagnostics: {
    path: string;
    filesFound: number;
    filesMissing: string[];
  };
  timestamp: string;
}

// ============================================================================
// STRING LITERAL TYPES
// ============================================================================

export type EnergyType =
  | 'GENERATOR'
  | 'MANIFESTING_GENERATOR'
  | 'PROJECTOR'
  | 'MANIFESTOR'
  | 'REFLECTOR';

export type Authority =
  | 'EMOTIONAL'
  | 'SACRAL'
  | 'SPLENIC'
  | 'EGO'
  | 'SELF_PROJECTED'
  | 'MENTAL'
  | 'LUNAR';

export type Center =
  | 'HEAD'
  | 'AJNA'
  | 'THROAT'
  | 'G_CENTER'
  | 'HEART'
  | 'SACRAL'
  | 'ROOT'
  | 'SPLEEN'
  | 'SOLAR_PLEXUS';

// ============================================================================
// USER DATA (Frontend State)
// ============================================================================

export interface UserData {
  fullName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

// ============================================================================
// APP STATE
// ============================================================================

export type AppStep = 'onboarding' | 'processing' | 'results';

export interface UserProfile {
  fullName: string;
  email: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  transitAlerts: boolean;
  hapticFeedback: boolean;
  analytics: boolean;
}

export interface AppState {
  userData: UserData | null;
  hdChart: HumanDesignChart | null;
  millmanProfile: MillmanProfile | null;
  profile: UserProfile | null;
  settings: AppSettings | null;
  isLoading: boolean;
  currentStep: AppStep;
}
