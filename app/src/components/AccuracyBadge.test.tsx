/**
 * AccuracyBadge render tests (Phase C).
 *
 * Rendered with react-dom/server. useUserTier is mocked instead of driving
 * the real auth store because zustand v5 serves its INITIAL state as the
 * useSyncExternalStore server snapshot — setState() has no effect inside
 * renderToStaticMarkup. Covers the badge variants (PROFESSIONAL / STANDARD),
 * the FREE/guest upsell hint and the Chiron missing-bodies hint.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccuracyBadge } from './AccuracyBadge';

let mockTier: 'FREE' | 'BASIC' | 'PREMIUM' | 'PRO' = 'FREE';

vi.mock('@/stores/authStore', () => ({
  useUserTier: () => mockTier,
}));

describe('AccuracyBadge', () => {
  beforeEach(() => {
    mockTier = 'FREE'; // guests resolve to FREE as well
  });

  test('renders nothing without accuracy data', () => {
    const html = renderToStaticMarkup(<AccuracyBadge accuracy={null} />);
    expect(html).toBe('');
  });

  test('PROFESSIONAL shows the Swiss Ephemeris badge and no upsell', () => {
    const html = renderToStaticMarkup(<AccuracyBadge accuracy="PROFESSIONAL" />);
    expect(html).toContain('Swiss Ephemeris');
    expect(html).toContain('Professional');
    expect(html).not.toContain('Präzisions-Upgrade');
  });

  test('STANDARD shows the neutral badge', () => {
    mockTier = 'PREMIUM';
    const html = renderToStaticMarkup(<AccuracyBadge accuracy="STANDARD" />);
    expect(html).toContain('Standard');
    expect(html).not.toContain('Swiss Ephemeris');
  });

  test('guest (FREE) on STANDARD sees the upsell hint', () => {
    const html = renderToStaticMarkup(<AccuracyBadge accuracy="STANDARD" />);
    expect(html).toContain('Präzisions-Upgrade');
  });

  test('BASIC user on STANDARD sees no upsell hint', () => {
    mockTier = 'BASIC';
    const html = renderToStaticMarkup(<AccuracyBadge accuracy="STANDARD" />);
    expect(html).not.toContain('Präzisions-Upgrade');
  });

  test('PREMIUM user on STANDARD sees no upsell hint', () => {
    mockTier = 'PREMIUM';
    const html = renderToStaticMarkup(<AccuracyBadge accuracy="STANDARD" />);
    expect(html).not.toContain('Präzisions-Upgrade');
  });

  test('missing CHIRON body renders the explanation hint', () => {
    const html = renderToStaticMarkup(
      <AccuracyBadge accuracy="STANDARD" missingBodies={['CHIRON']} />
    );
    expect(html).toContain('Chiron');
  });

  test('no missing bodies renders no hint', () => {
    const html = renderToStaticMarkup(<AccuracyBadge accuracy="STANDARD" missingBodies={[]} />);
    expect(html).not.toContain('Chiron');
  });
});
