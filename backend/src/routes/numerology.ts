import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const saveNumerologySchema = z.object({
  lifePathString: z.string(),
  root1: z.number().int(),
  root2: z.number().int(),
  baseSum: z.number().int(),
  destinyNumber: z.number().int(),
  hasMasterNumber: z.boolean(),
  hasZeroEnhancer: z.boolean(),
  soulUrgeString: z.string().optional(),
  expressionString: z.string().optional(),
  personalYear: z.number().int(),
  challenges: z.array(z.object({
    ageRange: z.string(),
    challengeNumber: z.number().int(),
  })),
  pinnacles: z.array(z.object({
    ageRange: z.string(),
    pinnacleNumber: z.number().int(),
  })),
});

// Save Numerology profile
router.post('/save', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = saveNumerologySchema.parse(req.body);
  const userId = req.user!.id;

  // Delete existing profile if any
  await prisma.millmanProfile.deleteMany({
    where: { userId },
  });

  // Create new profile
  const profile = await prisma.millmanProfile.create({
    data: {
      userId,
      ...data,
    },
  });

  res.json({ success: true, profileId: profile.id });
}));

// Get user's Numerology profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const profile = await prisma.millmanProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(profile);
}));

// Get community stats by destiny number
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await prisma.communityStats.findMany({
    where: { statType: 'destiny_number' },
    orderBy: { percentage: 'desc' },
  });

  res.json(stats);
}));

// Get users with same life path
router.get('/soulmates', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const userProfile = await prisma.millmanProfile.findUnique({
    where: { userId },
  });

  if (!userProfile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // Find users with same destiny number (anonymized)
  const count = await prisma.millmanProfile.count({
    where: {
      destinyNumber: userProfile.destinyNumber,
      userId: { not: userId },
    },
  });

  res.json({
    destinyNumber: userProfile.destinyNumber,
    samePathCount: count,
    message: `${count} andere Menschen teilen deinen Lebensweg ${userProfile.destinyNumber}`,
  });
}));

export { router as numerologyRouter };
