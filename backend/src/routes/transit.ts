import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { calculateDailyTransit, compareTransitToNatal } from '../services/ephemeris';
import { prisma } from '../lib/prisma';

const router = Router();

// Get daily transit data
router.get('/daily', async (req, res, next) => {
  try {
    const { year, month, day } = req.query;
    
    if (!year || !month || !day) {
      return res.status(400).json({ 
        error: 'Missing required parameters: year, month, day' 
      });
    }

    const transitData = await calculateDailyTransit(
      parseInt(year as string),
      parseInt(month as string),
      parseInt(day as string)
    );

    res.json({
      success: true,
      data: transitData,
    });
  } catch (error) {
    next(error);
  }
});

// Get today's transit
router.get('/today', async (req, res, next) => {
  try {
    const now = new Date();
    const transitData = await calculateDailyTransit(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
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
router.get('/compare', authenticateToken, async (req, res, next) => {
  try {
    const { year, month, day } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's natal chart
    const userProfile = await prisma.profile.findFirst({
      where: { userId },
      include: { humanDesign: true },
    });

    if (!userProfile?.humanDesign) {
      return res.status(404).json({ 
        error: 'Natal chart not found. Please complete your profile first.' 
      });
    }

    const natalGates = (userProfile.humanDesign as any).gates.map((g: any) => g.number);

    const comparison = await compareTransitToNatal(
      parseInt(year as string) || new Date().getFullYear(),
      parseInt(month as string) || new Date().getMonth() + 1,
      parseInt(day as string) || new Date().getDate(),
      natalGates
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
router.get('/range', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters: startDate, endDate' 
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' 
      });
    }

    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 30) {
      return res.status(400).json({ 
        error: 'Date range too large. Maximum 30 days allowed.' 
      });
    }

    const transits = [];
    const current = new Date(start);

    while (current <= end) {
      const transit = await calculateDailyTransit(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate()
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
router.get('/moon-phases', async (req, res, next) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ 
        error: 'Missing required parameters: year, month' 
      });
    }

    const y = parseInt(year as string);
    const m = parseInt(month as string);
    const daysInMonth = new Date(y, m, 0).getDate();

    const moonPhases = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const transit = await calculateDailyTransit(y, m, day);
      moonPhases.push({
        date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        phase: transit.moon_phase,
        moonGate: transit.planets.find(p => p.name === 'Mond')?.gate,
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
