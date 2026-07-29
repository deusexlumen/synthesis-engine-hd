/**
 * Smoke E2E: Login → Chart berechnen → alle 8 Tabs → Journal-Eintrag.
 *
 * Alle Backend- und Fremd-APIs werden per page.route gemockt:
 * - POST /api/auth/login (Login), /api/auth/me + /api/auth/refresh (401)
 * - POST /api/hd/calculate (Chart-Berechnung)
 * - GET  /api/transit/daily (Transite-Tab)
 * - GET/POST /api/journal (Journal-Tab, in-Memory-Store im Test)
 * - Open-Meteo Geocoding (Ortssuche im Onboarding)
 */
import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const API = 'http://localhost:3000';

const TEST_USER = {
  id: 'e2e-user-1',
  email: 'e2e@test.dev',
  emailVerified: true,
  roles: ['USER'],
  subscription: { tier: 'PREMIUM', status: 'active' },
};

const HD_CHART = {
  energyType: 'GENERATOR',
  authority: 'SACRAL',
  profile: '3/5',
  profileLine1: 3,
  profileLine2: 5,
  incarnationCross: 'Right Angle Cross (Gate 15)',
  definedCenters: ['SACRAL', 'THROAT', 'G_CENTER'],
  undefinedCenters: ['HEAD', 'AJNA', 'HEART', 'ROOT', 'SPLEEN', 'SOLAR_PLEXUS'],
  gates: [
    { number: 15, line: 3, color: 2, tone: 1, base: 1, planet: 'SUN', isDesign: false },
    { number: 10, line: 5, color: 1, tone: 2, base: 2, planet: 'EARTH', isDesign: false },
    { number: 31, line: 2, color: 3, tone: 3, base: 1, planet: 'MOON', isDesign: false },
    { number: 25, line: 6, color: 4, tone: 1, base: 3, planet: 'NORTH_NODE', isDesign: false },
    { number: 46, line: 6, color: 4, tone: 1, base: 3, planet: 'SOUTH_NODE', isDesign: false },
    { number: 20, line: 1, color: 2, tone: 2, base: 4, planet: 'MERCURY', isDesign: false },
    { number: 15, line: 4, color: 1, tone: 1, base: 5, planet: 'VENUS', isDesign: false },
    { number: 34, line: 3, color: 5, tone: 3, base: 1, planet: 'MARS', isDesign: false },
    { number: 5, line: 2, color: 2, tone: 4, base: 2, planet: 'SUN', isDesign: true },
    { number: 15, line: 1, color: 3, tone: 5, base: 3, planet: 'EARTH', isDesign: true },
    { number: 27, line: 5, color: 6, tone: 6, base: 4, planet: 'MOON', isDesign: true },
    { number: 3, line: 3, color: 1, tone: 1, base: 5, planet: 'SATURN', isDesign: true },
  ],
  channels: [{ gate1: 34, gate2: 20 }],
  variables: {
    digestion: 'Taste (Left)',
    environment: 'Markets',
    awareness: 'Smell',
    motivation: 'Hope',
    sense: 'Smell',
    style: 'Lunar',
  },
};

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockApis(page: Page) {
  // Auth: login succeeds; session probes succeed only with the issued token
  // (a fresh context 401s, after login the re-check must pass or the app
  // logs the user straight back out).
  await page.route(`${API}/api/auth/login`, (route) =>
    fulfillJson(route, {
      success: true,
      data: {
        user: TEST_USER,
        tokens: { accessToken: 'e2e-access-token', expiresIn: 900 },
      },
    })
  );
  await page.route(`${API}/api/auth/me`, (route) => {
    const auth = route.request().headers()['authorization'];
    if (auth === 'Bearer e2e-access-token') {
      return fulfillJson(route, {
        success: true,
        data: { user: TEST_USER, permissions: [], tier: 'PREMIUM' },
      });
    }
    return fulfillJson(route, { success: false, error: 'Invalid token' }, 401);
  });
  await page.route(`${API}/api/auth/refresh`, (route) =>
    // Wie das httpOnly-Refresh-Cookie in Produktion: nach einem Reload (der
    // Access-Token wird nie persistiert) holt sich die App hier ein frisches.
    fulfillJson(route, {
      success: true,
      data: { accessToken: 'e2e-access-token', expiresIn: 900 },
    })
  );

  // Chart-Berechnung
  await page.route(`${API}/api/hd/calculate`, (route) =>
    fulfillJson(route, {
      success: true,
      accuracy: 'PROFESSIONAL',
      data: HD_CHART,
      meta: {
        calculatedAt: new Date().toISOString(),
        calculationTimeMs: 42,
        usingEphemeris: true,
        swissephVersion: '2.10.3',
        birthData: {
          year: 1990, month: 1, day: 15, hour: 14, minute: 30,
          latitude: 52.52, longitude: 13.405, timezone: 1, julianDay: 2447901.1,
        },
      },
    })
  );

  // Transite
  await page.route(`${API}/api/transit/daily*`, (route) =>
    fulfillJson(route, {
      success: true,
      data: {
        date: new Date().toISOString(),
        planets: [
          { name: 'Sonne', longitude: 280.1, gate: 58, line: 3, color: 2, tone: 1, base: 1, retrograde: false, zodiacSign: 'Steinbock', zodiacDegree: 10.1 },
          { name: 'Mond', longitude: 120.3, gate: 31, line: 2, color: 3, tone: 3, base: 1, retrograde: false, zodiacSign: 'Löwe', zodiacDegree: 0.3 },
        ],
        moonPhase: 'full',
        activeGates: [58, 31],
        dailyTheme: 'Lebensfreude',
      },
    })
  );

  // Journal (in-Memory-Store)
  const journalEntries: unknown[] = [];
  await page.route(`${API}/api/journal`, (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, { success: true, data: journalEntries });
    }
    const body = route.request().postDataJSON();
    const now = new Date().toISOString();
    const entry = {
      id: 'e2e-entry-1',
      userId: TEST_USER.id,
      title: body.title,
      content: body.content,
      mood: body.mood ?? null,
      tags: body.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    journalEntries.push(entry);
    return fulfillJson(route, { success: true, data: entry }, 201);
  });

  // Open-Meteo Geocoding (Ortssuche)
  await page.route('https://geocoding-api.open-meteo.com/v1/search*', (route) =>
    fulfillJson(route, {
      results: [
        {
          name: 'Berlin',
          admin1: 'Berlin',
          country: 'Deutschland',
          latitude: 52.52,
          longitude: 13.405,
          timezone: 'Europe/Berlin',
        },
      ],
    })
  );
}

test('Smoke: Login → Chart → 8 Tabs → Journal-Eintrag', async ({ page }) => {
  await mockApis(page);

  // --- Login ---
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
  await page.locator('#email').fill('e2e@test.dev');
  await page.locator('#password').fill('supersecret1');
  await page.getByRole('button', { name: 'Anmelden' }).click();

  // Der AuthProvider unmountet während isLoading den kompletten Router-Baum;
  // das navigate('/dashboard') nach dem Login kann dadurch an einer
  // veralteten History-Instanz hängen bleiben (URL wechselt, Router zeigt
  // weiter /login). Dann client-seitig über den Logo-Link auf '/' gehen —
  // der neu gemountete Router rendert die ProtectedRoute korrekt.
  const loslegen = page.getByRole('button', { name: /Loslegen/ });
  const logoLink = page.getByRole('link', { name: /Synthesis Engine/ });
  await expect(loslegen.or(logoLink)).toBeVisible({ timeout: 10_000 });
  if (await logoLink.isVisible().catch(() => false)) {
    await logoLink.click();
  }

  // --- Onboarding: Willkommen ---
  await expect(loslegen).toBeVisible();
  await loslegen.click();

  // --- Onboarding: Daten ---
  await page.getByPlaceholder('z.B. Max Mustermann').fill('E2E Testuser');

  await page.getByRole('button', { name: /Datum wählen/ }).click();
  // react-day-picker öffnet im Januar 1990 (defaultMonth) → Tag 15 wählen
  await page.getByRole('button', { name: /15\. Januar 1990/ }).click();

  await page.locator('input[type="time"]').fill('14:30');

  await page.locator('#location-input').fill('Berlin');
  await page.getByRole('button', { name: /Berlin, Berlin, Deutschland/ }).click();

  await page.getByRole('button', { name: /Weiter zur Bestätigung/ }).click();

  // --- Onboarding: Bestätigen → Berechnung (gemockt) ---
  await page.getByRole('button', { name: /Chart erstellen/ }).click();

  // --- ResultsDashboard: alle 8 Tabs rendern ---
  const tabs: Array<{ label: string; expected: RegExp }> = [
    { label: 'Übersicht', expected: /Definierte Zentren/ },
    { label: 'BodyGraph', expected: /Kopf/ },
    { label: 'Numerologie', expected: /6-1-8/ },
    { label: 'Details', expected: /Kompakte Übersicht/ },
    { label: 'Journal', expected: /Neuer Eintrag/ },
    { label: 'Gene Keys', expected: /Richard Rudd/ },
    { label: 'Transite', expected: /Mondphase/ },
    { label: 'KI-Coaching', expected: /Aktiviere KI-Coaching/ },
  ];

  // Der erste Tab ist nach der Berechnung bereits aktiv.
  await expect(page.getByRole('tab', { name: 'Übersicht' })).toBeVisible({ timeout: 20_000 });

  for (const tab of tabs) {
    await page.getByRole('tab', { name: tab.label }).click();
    await expect(page.getByText(tab.expected).first()).toBeVisible();
  }

  // --- Journal: Eintrag anlegen (POST /api/journal gemockt) ---
  await page.getByRole('tab', { name: 'Journal' }).click();
  await page.getByRole('button', { name: /Neuer Eintrag/ }).click();
  await page.getByPlaceholder('Titel deines Eintrags...').fill('E2E Eintrag');
  await page.getByPlaceholder(/Schreibe hier deine Gedanken/).fill('Angelegt via Playwright.');
  await page.getByRole('button', { name: 'Speichern' }).click();

  // Zurück in der Liste: der gemockte Server liefert den neuen Eintrag.
  await expect(page.getByText('E2E Eintrag').first()).toBeVisible();
});
