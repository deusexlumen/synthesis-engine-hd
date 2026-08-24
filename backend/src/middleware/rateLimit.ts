/**
 * Per-User Rate Limiting Middleware
 * Protects expensive endpoints from abuse
 */

import rateLimit from 'express-rate-limit';

/**
 * Strict positive-integer parse with a fallback.
 *
 * parseInt() is too permissive for configuration: 'abc' yields NaN (which
 * express-rate-limit treats as no limit at all) and '100abc' silently yields
 * 100, hiding a broken value. Anything that is not a whole number greater
 * than zero falls back to the documented default.
 */
export function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

// General API rate limiting (existing behavior)
export const generalLimiter = rateLimit({
  windowMs: parsePositiveIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  max: parsePositiveIntEnv(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth-specific rate limiting
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// AI / Synthesis rate limiting per user
export const synthesisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req: any) => req.user?.userId || req.ip,
  message: {
    error: 'AI synthesis limit reached. Please try again later.',
    limit: 20,
    window: '1h',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Coaching rate limiting per user
export const coachingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req: any) => req.user?.userId || req.ip,
  message: {
    error: 'Coaching request limit reached. Please try again later.',
    limit: 10,
    window: '1h',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Human Design calculation rate limiting. /api/hd/calculate is the most
// CPU-intensive endpoint (Newton-iteration ephemeris) and is reachable as a
// guest, so it gets a much tighter budget than the generic 100/min limiter.
export const hdCalculateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req: any) => req.user?.userId || req.ip,
  message: { error: 'Too many chart calculation requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Transit range rate limiting (prevents DoS via large date ranges)
export const transitRangeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req: any) => req.user?.userId || req.ip,
  message: { error: 'Too many transit range requests.' },
});
