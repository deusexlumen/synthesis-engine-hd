import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requirePremium } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get daily coaching impulse
router.get('/daily', authenticate, requirePremium, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if today's impulse already exists
  let coaching = await prisma.dailyCoaching.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (!coaching) {
    // Generate new impulse (in production, this would call the AI service)
    // For now, return a placeholder
    coaching = await prisma.dailyCoaching.create({
      data: {
        userId,
        date: today,
        transitData: { sunGate: 1, moonGate: 2 }, // Placeholder
        impulseText: 'Heute ist ein guter Tag, um innezuhalten und auf deine innere Autorität zu hören.',
      },
    });
  }

  res.json({
    date: coaching.date,
    impulse: coaching.impulseText,
    transit: coaching.transitData,
    isRead: coaching.isRead,
  });
}));

// Mark impulse as read
router.post('/daily/read', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
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
  const userId = req.user!.id;
  const { limit = '30', offset = '0' } = req.query;

  const history = await prisma.dailyCoaching.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string),
  });

  res.json(history);
}));

export { router as coachingRouter };
