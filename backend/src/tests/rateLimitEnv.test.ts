/**
 * Rate-limit env parsing.
 *
 * A typo in RATE_LIMIT_WINDOW_MS used to reach express-rate-limit as NaN,
 * which disables the limit instead of failing loudly.
 */

import { parsePositiveIntEnv } from '../middleware/rateLimit';

describe('parsePositiveIntEnv', () => {
  test('parses a valid positive integer', () => {
    expect(parsePositiveIntEnv('5000', 60000)).toBe(5000);
  });

  test('falls back when the variable is unset', () => {
    expect(parsePositiveIntEnv(undefined, 60000)).toBe(60000);
  });

  test('falls back on an empty string', () => {
    expect(parsePositiveIntEnv('', 60000)).toBe(60000);
  });

  test('falls back on a non-numeric value instead of yielding NaN', () => {
    expect(parsePositiveIntEnv('abc', 60000)).toBe(60000);
    expect(Number.isNaN(parsePositiveIntEnv('abc', 60000))).toBe(false);
  });

  test('falls back on zero and negative values', () => {
    expect(parsePositiveIntEnv('0', 100)).toBe(100);
    expect(parsePositiveIntEnv('-10', 100)).toBe(100);
  });

  test('falls back on a fractional value', () => {
    expect(parsePositiveIntEnv('1.5', 100)).toBe(100);
  });

  test('does not silently truncate a trailing-garbage value the way parseInt does', () => {
    // parseInt('100abc') === 100 — accepting that hides a broken config.
    expect(parsePositiveIntEnv('100abc', 60000)).toBe(60000);
  });
});
