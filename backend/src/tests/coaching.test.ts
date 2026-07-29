/**
 * Daily Coaching Service Tests
 *
 * Uses the real ephemeris service (which falls back to the deterministic
 * sweph mock under NODE_ENV=test) and a mocked Prisma client. LLM calls are
 * intercepted via a mocked global fetch.
 */

import {
  getOrCreateDailyCoaching,
  buildFallbackImpulse,
  buildTransitSnapshot,
} from '../services/coaching';
import { calculateDailyTransit } from '../services/ephemeris';

jest.mock('../lib/prisma', () => ({
  prisma: {
    dailyCoaching: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../lib/prisma');

const findUniqueMock = prisma.dailyCoaching.findUnique as jest.Mock;
const createMock = prisma.dailyCoaching.create as jest.Mock;

// Deterministic gates produced by the sweph mock positions:
// Sun at 15.5° -> Gate 51, Moon at 120.3° -> Gate 31.
const EXPECTED_SUN_GATE = 51;
const EXPECTED_MOON_GATE = 31;

beforeEach(() => {
  jest.clearAllMocks();
  createMock.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: 'coaching-1', isRead: false, createdAt: new Date(), ...data })
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getOrCreateDailyCoaching', () => {
  test('returns the existing entry without generating a new one', async () => {
    const existing = {
      id: 'existing',
      userId: 'user-1',
      date: new Date(),
      transitData: { sunGate: 1 },
      impulseText: 'Bereits vorhanden',
      isRead: false,
    };
    findUniqueMock.mockResolvedValue(existing);

    const result = await getOrCreateDailyCoaching('user-1');

    expect(result).toBe(existing);
    expect(createMock).not.toHaveBeenCalled();
  });

  test('generates from REAL transit data (no placeholder gates 1/2)', async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await getOrCreateDailyCoaching('user-1');

    expect(createMock).toHaveBeenCalledTimes(1);
    const { data } = createMock.mock.calls[0][0];

    expect(data.transitData.sunGate).toBe(EXPECTED_SUN_GATE);
    expect(data.transitData.moonGate).toBe(EXPECTED_MOON_GATE);
    expect(data.transitData.activeGates.length).toBeGreaterThan(0);
    expect(data.transitData.dailyTheme).toBeTruthy();

    // Fallback impulse references the real theme, not a fixed sentence
    expect(data.impulseText).toContain(data.transitData.dailyTheme);
    expect(data.impulseText).toContain(`Tor ${EXPECTED_SUN_GATE}`);
    expect(result.impulseText).toBe(data.impulseText);
  });

  test('uses the LLM impulse when credentials are provided', async () => {
    findUniqueMock.mockResolvedValue(null);

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'Ein maßgeschneiderter KI-Impuls.' }] }),
    } as unknown as Response);

    const result = await getOrCreateDailyCoaching('user-1', {
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5',
    });

    expect(result.impulseText).toBe('Ein maßgeschneiderter KI-Impuls.');

    // Anthropic endpoint was called with the user's key
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-test');
  });

  test('falls back to the real-data template when the LLM call fails', async () => {
    findUniqueMock.mockResolvedValue(null);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await getOrCreateDailyCoaching('user-1', {
      provider: 'openai',
      apiKey: 'sk-test',
    });

    const transit = calculateDailyTransit(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate()
    );
    expect(result.impulseText).toBe(buildFallbackImpulse(transit));
  });
});

describe('buildTransitSnapshot / buildFallbackImpulse', () => {
  test('snapshot contains the core transit fields', () => {
    const transit = calculateDailyTransit(2026, 7, 29);
    const snapshot = buildTransitSnapshot(transit);

    expect(snapshot.date).toBe('2026-07-29');
    expect(snapshot.sunGate).toBe(EXPECTED_SUN_GATE);
    expect(snapshot.moonGate).toBe(EXPECTED_MOON_GATE);
    expect(snapshot.moonPhase).toBeTruthy();
    expect(snapshot.activeGates).toContain(EXPECTED_SUN_GATE);
  });

  test('fallback impulse is built from gate numbers and theme', () => {
    const transit = calculateDailyTransit(2026, 7, 29);
    const impulse = buildFallbackImpulse(transit);

    expect(impulse).toContain(`Tor ${EXPECTED_SUN_GATE}`);
    expect(impulse).toContain(`Tor ${EXPECTED_MOON_GATE}`);
    expect(impulse).toContain(transit.dailyTheme);
  });
});
