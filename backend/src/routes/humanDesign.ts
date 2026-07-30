import { Router } from 'express';
import { z } from 'zod';
import type { EnergyType, Authority, CenterName, Planet, Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';
import { Request } from 'express';
import { prisma } from '../lib/prisma';
import * as ephemeris from '../services/ephemeris';
import { calculateHumanDesignChart } from '../services/humanDesignCalculator';
import { hdCalculateLimiter } from '../middleware/rateLimit';

const router: Router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const calculateSchema = z.object({
  year: z.number().int().min(1800).max(2400),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.number().min(-14).max(14),
});

// Save requests carry only the birth data; the chart is recomputed
// server-side (same code path as /calculate) and the server values are
// persisted — client-computed charts are never trusted (M13).
const saveHDSchema = z.object({
  birthData: calculateSchema,
});

// ============================================================================
// MAIN CALCULATION ENDPOINT
// ============================================================================

/**
 * POST /api/hd/calculate
 *
 * Calculates a Human Design chart with PROFESSIONAL accuracy.
 * Uses NASA JPL Swiss Ephemeris data (±0.0001°).
 *
 * No authentication required — the guest flow (see authStore.loginAsGuest)
 * lets people try the app before creating an account, and this endpoint
 * only computes from the supplied birth data; it doesn't touch stored
 * user records. Abuse is bounded by hdCalculateLimiter (10/min — this is
 * the most CPU-intensive endpoint) on top of the generalLimiter in index.ts.
 */
router.post('/calculate', hdCalculateLimiter, optionalAuth, asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const birthData = calculateSchema.parse(req.body);

  const chart = calculateHumanDesignChart(birthData);
  const julianDay = ephemeris.calculateJulianDay(birthData);
  const status = ephemeris.getStatus();

  res.json({
    success: true,
    accuracy: status.usingFiles ? 'PROFESSIONAL' : 'STANDARD',
    data: chart,
    meta: {
      calculatedAt: new Date().toISOString(),
      calculationTimeMs: Date.now() - startedAt,
      usingEphemeris: status.usingFiles,
      swissephVersion: status.version,
      birthData: { ...birthData, julianDay },
    },
  });
}));

// ============================================================================
// OTHER ENDPOINTS
// ============================================================================

// Save Human Design chart. Only birth data is accepted; the chart itself is
// computed server-side so a client can't persist arbitrary, inconsistent
// profile values (M13).
router.post('/save', authenticate, asyncHandler(async (req: Request, res) => {
  const { birthData } = saveHDSchema.parse(req.body);
  const userId = req.user!.userId;

  const chart = calculateHumanDesignChart(birthData);

  // Wrapped in a transaction: if `create` fails validation or hits a
  // constraint, the prior profile (just deleted) is rolled back instead
  // of being permanently lost.
  const profile = await prisma.$transaction(async (tx) => {
    await tx.humanDesignProfile.deleteMany({ where: { userId } });

    return tx.humanDesignProfile.create({
      data: {
        userId,
        energyType: chart.energyType as EnergyType,
        authority: chart.authority as Authority,
        profileLine1: chart.profileLine1,
        profileLine2: chart.profileLine2,
        incarnationCross: chart.incarnationCross,
        variables: chart.variables as unknown as Prisma.InputJsonValue,
        centers: {
          create: chart.definedCenters.map(name => ({
            name: name as CenterName,
            isDefined: true,
          })),
        },
        gates: {
          create: chart.gates.map(g => ({
            gateNumber: g.number,
            line: g.line,
            color: g.color,
            tone: g.tone,
            base: g.base,
            planet: g.planet as Planet,
            isDesign: g.isDesign,
          })),
        },
        channels: {
          create: chart.channels,
        },
      },
    });
  });

  res.json({ success: true, profileId: profile.id });
}));

// Get user's Human Design chart
router.get('/profile', authenticate, asyncHandler(async (req: Request, res) => {
  const userId = req.user!.userId;

  const profile = await prisma.humanDesignProfile.findUnique({
    where: { userId },
    include: {
      centers: true,
      gates: true,
      channels: true,
    },
  });

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(profile);
}));

// Get community stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await prisma.communityStats.findMany({
    where: { statType: 'energy_type' },
    orderBy: { percentage: 'desc' },
  });

  res.json(stats);
}));

// Health check for ephemeris
router.get('/health', asyncHandler(async (req, res) => {
  const status = ephemeris.getStatus();
  const diagnostics = ephemeris.getDiagnostics();
  
  res.json({
    status: status.usingFiles ? 'ok' : 'warning',
    ephemeris: status,
    diagnostics: {
      path: diagnostics.ephePath,
      filesFound: diagnostics.files.found.length,
      filesMissing: diagnostics.files.missing,
    },
    timestamp: new Date().toISOString(),
  });
}));

// Diagnostics endpoint (admin only)
router.get('/diagnostics', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const diagnostics = ephemeris.getDiagnostics();
  
  res.json({
    ephePath: diagnostics.ephePath,
    files: diagnostics.files,
    status: diagnostics.status,
    instructions: {
      download: 'Run: cd scripts && ./download-ephemeris.sh (or .ps1 on Windows)',
      source: 'https://github.com/aloistr/swisseph/tree/master/ephe',
    },
  });
}));

export { router as hdRouter };
