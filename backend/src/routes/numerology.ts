import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { calculateMillmanProfile } from '../services/millmanCalculator';

const router: Router = Router();

// The client sends only the raw inputs; the profile is computed server-side
// (same algorithm as the frontend's millmanCalculations.ts) and the server
// values are persisted — client-computed profiles are never trusted (M13).
const saveNumerologySchema = z.object({
  fullName: z.string().min(1).max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be YYYY-MM-DD'),
});

// Save Numerology profile
router.post('/save', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const input = saveNumerologySchema.parse(req.body);
  const userId = req.user!.userId;

  const data = calculateMillmanProfile(input);

  // Delete existing profile if any
  await prisma.millmanProfile.deleteMany({
    where: { userId },
  });

  // Create new profile
  const profile = await prisma.millmanProfile.create({
    data: {
      userId,
      ...data,
      challenges: data.challenges as unknown as Prisma.InputJsonValue,
      pinnacles: data.pinnacles as unknown as Prisma.InputJsonValue,
    },
  });

  res.json({ success: true, profileId: profile.id });
}));

// Get user's Numerology profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;

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
  const userId = req.user!.userId;

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
