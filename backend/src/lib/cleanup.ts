/**
 * Periodic cleanup of expired/stale rows.
 *
 * Without this, RefreshToken, Session, SynthesisCache, and AuditLog grow
 * unbounded — every login/refresh/AI-synthesis call writes a new row and
 * nothing ever deletes the ones that are no longer useful.
 */

import { prisma } from './prisma';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIT_LOG_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export async function runCleanup(): Promise<void> {
  const now = new Date();

  const [synthesisCache, refreshTokens, sessions, auditLogs] = await Promise.all([
    prisma.synthesisCache.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - THIRTY_DAYS_MS) } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - AUDIT_LOG_RETENTION_MS) } } }),
  ]);

  const total = synthesisCache.count + refreshTokens.count + sessions.count + auditLogs.count;
  if (total > 0) {
    console.log(
      `[cleanup] removed ${synthesisCache.count} expired cache entries, ` +
      `${refreshTokens.count} old refresh tokens, ${sessions.count} expired sessions, ` +
      `${auditLogs.count} audit logs past retention`
    );
  }
}

/**
 * Runs cleanup once immediately, then on a fixed interval. Returns the
 * interval handle so callers can clearInterval() it (e.g. in tests or a
 * graceful shutdown path).
 */
export function scheduleCleanup(intervalMs = 24 * 60 * 60 * 1000): ReturnType<typeof setInterval> {
  runCleanup().catch((error) => console.error('[cleanup] initial run failed:', error));
  return setInterval(() => {
    runCleanup().catch((error) => console.error('[cleanup] scheduled run failed:', error));
  }, intervalMs);
}
