/**
 * Daily Coaching Service
 *
 * Generates the daily coaching impulse from REAL transit data
 * (calculateDailyTransit) instead of placeholders. If the caller supplies
 * AI credentials (BYOK headers), the impulse text is synthesized by the
 * user's LLM via the shared provider service; otherwise a deterministic
 * German fallback built from the actual gates/themes is used.
 */

import { calculateDailyTransit, DailyTransit, TransitPlanet } from './ephemeris';
import { callAIProvider, extractAIText, AIProxyRequest } from './aiProvider';
import { prisma } from '../lib/prisma';

export interface LLMCredentials {
  provider: AIProxyRequest['provider'];
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODELS: Record<LLMCredentials['provider'], string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  google: 'gemini-1.5-flash',
  custom: '',
};

const MOON_PHASE_LABELS: Record<string, string> = {
  new: 'Neumond',
  waxing_crescent: 'zunehmender Mond',
  first_quarter: 'erstes Viertel',
  waxing_gibbous: 'fast Vollmond',
  full: 'Vollmond',
  waning_gibbous: 'abnehmender Mond',
  last_quarter: 'letztes Viertel',
  waning_crescent: 'abnehmende Sichel',
};

function findPlanet(transit: DailyTransit, name: string): TransitPlanet | undefined {
  return transit.planets.find((p) => p.name === name);
}

/**
 * Compact, JSON-serializable snapshot of today's transit for storage in
 * DailyCoaching.transitData.
 */
export function buildTransitSnapshot(transit: DailyTransit) {
  const sun = findPlanet(transit, 'Sonne');
  const moon = findPlanet(transit, 'Mond');

  return {
    date: transit.date,
    sunGate: sun?.gate ?? null,
    sunLine: sun?.line ?? null,
    moonGate: moon?.gate ?? null,
    moonLine: moon?.line ?? null,
    moonPhase: transit.moonPhase,
    dailyTheme: transit.dailyTheme,
    activeGates: transit.activeGates,
  };
}

/**
 * Deterministic German fallback impulse built from the REAL transit data —
 * used when no LLM key is available or the LLM call fails.
 */
export function buildFallbackImpulse(transit: DailyTransit): string {
  const sun = findPlanet(transit, 'Sonne');
  const moon = findPlanet(transit, 'Mond');
  const phaseLabel = MOON_PHASE_LABELS[transit.moonPhase] ?? transit.moonPhase;

  const sunPart = sun
    ? `die Sonne in Tor ${sun.gate} (${transit.dailyTheme})`
    : `das Tagesthema „${transit.dailyTheme}"`;
  const moonPart = moon ? `, der Mond in Tor ${moon.gate}` : '';

  return (
    `Heute steht ${sunPart}${moonPart} — dazu ${phaseLabel}. ` +
    `Die Tagesenergie lädt dazu ein, das Thema „${transit.dailyTheme}" bewusst wahrzunehmen. ` +
    `Nimm dir einen Moment, innezuhalten und auf deine innere Autorität zu hören: ` +
    `Wo zeigt sich „${transit.dailyTheme}" heute in deinem Alltag?`
  );
}

/**
 * Synthesize the impulse text via the user's LLM. Returns null when the
 * call fails so the caller can fall back to buildFallbackImpulse.
 */
export async function synthesizeImpulseWithLLM(
  transit: DailyTransit,
  creds: LLMCredentials
): Promise<string | null> {
  const snapshot = buildTransitSnapshot(transit);

  const messages: AIProxyRequest['messages'] = [
    {
      role: 'system',
      content:
        'Du bist ein einfühlsamer Human-Design- und Gene-Keys-Coach. ' +
        'Du formulierst niemals absolute Wahrheiten, sondern reflektierende, ' +
        'einladende Impulse. Antworte auf Deutsch.',
    },
    {
      role: 'user',
      content:
        `Heutige Transit-Daten:\n` +
        `- Sonne: Tor ${snapshot.sunGate}, Linie ${snapshot.sunLine}\n` +
        `- Mond: Tor ${snapshot.moonGate}, Linie ${snapshot.moonLine}\n` +
        `- Mondphase: ${MOON_PHASE_LABELS[transit.moonPhase] ?? transit.moonPhase}\n` +
        `- Tagesthema: ${transit.dailyTheme}\n` +
        `- Aktive Tore: ${transit.activeGates.join(', ')}\n\n` +
        `Schreibe einen kurzen, inspirierenden Tagesimpuls (3-4 Sätze), der auf ` +
        `die reale Tageskonstellation eingeht, reflektierend und ermutigend ist ` +
        `und mit einer offenen Frage endet.`,
    },
  ];

  try {
    const response = await callAIProvider(creds.apiKey, {
      provider: creds.provider,
      model: creds.model || DEFAULT_MODELS[creds.provider],
      messages,
      temperature: 0.7,
      maxTokens: 400,
      baseUrl: creds.baseUrl,
    });

    const text = extractAIText(creds.provider, response).trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.error('LLM impulse synthesis failed, falling back to template:', error);
    return null;
  }
}

/**
 * Get today's coaching entry for the user, generating it from real transit
 * data on first access of the day.
 */
export async function getOrCreateDailyCoaching(userId: string, creds?: LLMCredentials) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.dailyCoaching.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) {
    return existing;
  }

  const transit = calculateDailyTransit(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );

  const impulseText = creds
    ? (await synthesizeImpulseWithLLM(transit, creds)) ?? buildFallbackImpulse(transit)
    : buildFallbackImpulse(transit);

  return prisma.dailyCoaching.create({
    data: {
      userId,
      date: today,
      transitData: buildTransitSnapshot(transit),
      impulseText,
    },
  });
}
