import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requireTier } from '../middleware/auth';
import { coachingLimiter } from '../middleware/rateLimit';
import { prisma } from '../lib/prisma';
import { getOrCreateDailyCoaching, LLMCredentials } from '../services/coaching';
import { resolveProvider } from '../services/ephemeris/resolver';
import { AIProxyRequest } from '../services/aiProvider';

const router: Router = Router();

const AI_PROVIDERS: Array<AIProxyRequest['provider']> = ['openai', 'anthropic', 'google', 'custom'];

// Bounded pagination. Without an upper bound a single request can ask for the
// user's entire coaching history; without integer/lower bounds a value like
// "abc" reaches Prisma as NaN and a negative take silently reverses the page.
const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Extract optional BYOK credentials from the request headers. The frontend
 * sends the user's own AI key (X-AI-API-Key, plus optional provider/model/
 * base-url headers); without a key the deterministic fallback impulse is
 * used instead of an LLM call.
 */
function getLLMCredentials(req: AuthenticatedRequest): LLMCredentials | undefined {
  const apiKey = req.headers['x-ai-api-key'] as string | undefined;
  if (!apiKey) return undefined;

  const providerHeader = (req.headers['x-ai-provider'] as string | undefined) ?? 'openai';
  const provider = AI_PROVIDERS.includes(providerHeader as AIProxyRequest['provider'])
    ? (providerHeader as AIProxyRequest['provider'])
    : 'openai';

  return {
    provider,
    apiKey,
    model: req.headers['x-ai-model'] as string | undefined,
    baseUrl: req.headers['x-ai-base-url'] as string | undefined,
  };
}

// Get daily coaching impulse
router.get('/daily', authenticate, requireTier(['PREMIUM', 'PRO']), coachingLimiter, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;

  // Ephemeris backend per tier (Phase C): PREMIUM/PRO get Swiss Ephemeris
  // when EPHEMERIS_PRO_ENABLED is on, otherwise the standard provider.
  const coaching = await getOrCreateDailyCoaching(userId, getLLMCredentials(req), resolveProvider(req.user!.tier));

  res.json({
    date: coaching.date,
    impulse: coaching.impulseText,
    transit: coaching.transitData,
    isRead: coaching.isRead,
  });
}));

// Mark impulse as read
router.post('/daily/read', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyCoaching.update({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    data: {
      isRead: true,
    },
  });

  res.json({ success: true });
}));

// Get coaching history
router.get('/history', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const { limit, offset } = historySchema.parse(req.query);

  const history = await prisma.dailyCoaching.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
  });

  res.json(history);
}));

export { router as coachingRouter };
