import { Router } from 'express';
import { z } from 'zod';
import { authenticate, optionalAuth } from '../middleware/auth';
import { transitRangeLimiter } from '../middleware/rateLimit';
import { calculateDailyTransit, compareTransitToNatal } from '../services/ephemeris';
import { resolveProvider } from '../services/ephemeris/resolver';
import { prisma } from '../lib/prisma';

const router: Router = Router();

// Ephemeris backend for this request, selected by subscription tier
// (Phase C). Guests and unauthenticated callers resolve to the standard
// provider; PREMIUM/PRO resolve to Swiss Ephemeris when enabled.
function providerFor(req: { user?: { tier: string } }) {
  return resolveProvider(req.user?.tier ?? 'FREE');
}

// Zod schemas for query validation
const dailyTransitSchema = z.object({
  year: z.coerce.number().int().min(1800).max(2400),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
});

const compareSchema = z.object({
  year: z.coerce.number().int().min(1800).max(2400).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
});

const rangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const moonPhasesSchema = z.object({
  year: z.coerce.number().int().min(1800).max(2400),
  month: z.coerce.number().int().min(1).max(12),
});

// Get daily transit data
router.get('/daily', optionalAuth, async (req, res, next) => {
  try {
    const { year, month, day } = dailyTransitSchema.parse(req.query);

    const transitData = await calculateDailyTransit(year, month, day, providerFor(req));

    res.json({
      success: true,
      data: transitData,
    });
  } catch (error) {
    next(error);
  }
});

// Get today's transit
router.get('/today', optionalAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const transitData = await calculateDailyTransit(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      providerFor(req)
    );

    res.json({
      success: true,
      data: transitData,
    });
  } catch (error) {
    next(error);
  }
});

// Get transit comparison with user's natal chart
router.get('/compare', authenticate, async (req, res, next) => {
  try {
    const query = compareSchema.parse(req.query);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's natal chart
    const userProfile = await prisma.humanDesignProfile.findFirst({
      where: { userId },
      include: { gates: true },
    });

    if (!userProfile?.gates?.length) {
      return res.status(404).json({ 
        error: 'Natal chart not found. Please complete your profile first.' 
      });
    }

    const natalGates = userProfile.gates.map((g: { gateNumber: number }) => g.gateNumber);

    const comparison = await compareTransitToNatal(
      query.year || new Date().getFullYear(),
      query.month || new Date().getMonth() + 1,
      query.day || new Date().getDate(),
      natalGates,
      providerFor(req)
    );

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
});

// Get transit range
router.get('/range', authenticate, transitRangeLimiter, async (req, res, next) => {
  try {
    const { startDate, endDate } = rangeSchema.parse(req.query);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 30 || daysDiff < 0) {
      return res.status(400).json({ 
        error: 'Date range too large or invalid. Maximum 30 days allowed.' 
      });
    }

    const transits = [];
    const current = new Date(start);
    const provider = providerFor(req);

    while (current <= end) {
      const transit = await calculateDailyTransit(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate(),
        provider
      );
      transits.push(transit);
      current.setDate(current.getDate() + 1);
    }

    res.json({
      success: true,
      data: transits,
    });
  } catch (error) {
    next(error);
  }
});

// Get moon phases for a month
router.get('/moon-phases', authenticate, async (req, res, next) => {
  try {
    const { year, month } = moonPhasesSchema.parse(req.query);

    const daysInMonth = new Date(year, month, 0).getDate();
    const provider = providerFor(req);

    const moonPhases = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const transit = await calculateDailyTransit(year, month, day, provider);
      moonPhases.push({
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        phase: transit.moonPhase,
        moonGate: transit.planets.find((p: { name: string; gate: number }) => p.name === 'Mond')?.gate,
      });
    }

    res.json({
      success: true,
      data: moonPhases,
    });
  } catch (error) {
    next(error);
  }
});

export { router as transitRouter };
