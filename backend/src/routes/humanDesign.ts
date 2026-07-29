import { Router } from 'express';
import { z } from 'zod';
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

// Mirrors the Prisma enums exactly — a value outside this set now fails
// validation with a 400 instead of reaching Prisma and throwing a 500.
const PLANET_ENUM = z.enum([
  'SUN', 'EARTH', 'NORTH_NODE', 'SOUTH_NODE', 'MOON', 'MERCURY', 'VENUS',
  'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO',
]);
const CENTER_NAME_ENUM = z.enum([
  'HEAD', 'AJNA', 'THROAT', 'G_CENTER', 'HEART', 'SACRAL', 'ROOT', 'SPLEEN', 'SOLAR_PLEXUS',
]);

const saveHDSchema = z.object({
  energyType: z.enum(['MANIFESTOR', 'GENERATOR', 'MANIFESTING_GENERATOR', 'PROJECTOR', 'REFLECTOR']),
  authority: z.enum(['EMOTIONAL', 'SACRAL', 'SPLENIC', 'EGO', 'SELF_PROJECTED', 'MENTAL', 'LUNAR']),
  profileLine1: z.number().int().min(1).max(6),
  profileLine2: z.number().int().min(1).max(6),
  incarnationCross: z.string(),
  definedCenters: z.array(CENTER_NAME_ENUM),
  undefinedCenters: z.array(CENTER_NAME_ENUM),
  gates: z.array(z.object({
    number: z.number().int().min(1).max(64),
    line: z.number().int().min(1).max(6),
    color: z.number().int().min(1).max(6),
    tone: z.number().int().min(1).max(6),
    base: z.number().int().min(1).max(5),
    planet: PLANET_ENUM,
    isDesign: z.boolean(),
  })),
  channels: z.array(z.object({
    gate1: z.number().int().min(1).max(64),
    gate2: z.number().int().min(1).max(64),
  })),
  variables: z.object({
    digestion: z.string(),
    environment: z.string(),
    awareness: z.string(),
    motivation: z.string(),
    sense: z.string(),
    style: z.string(),
  }),
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
    accuracy: status.usingFiles ? 'PROFESSIONAL' : 'FALLBACK',
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

// Save Human Design chart
router.post('/save', authenticate, asyncHandler(async (req: Request, res) => {
  const data = saveHDSchema.parse(req.body);
  const userId = req.user!.userId;

  // Wrapped in a transaction: if `create` fails validation or hits a
  // constraint, the prior profile (just deleted) is rolled back instead
  // of being permanently lost.
  const profile = await prisma.$transaction(async (tx) => {
    await tx.humanDesignProfile.deleteMany({ where: { userId } });

    return tx.humanDesignProfile.create({
      data: {
        userId,
        energyType: data.energyType,
        authority: data.authority,
        profileLine1: data.profileLine1,
        profileLine2: data.profileLine2,
        incarnationCross: data.incarnationCross,
        variables: data.variables,
        centers: {
          create: data.definedCenters.map(name => ({
            name,
            isDefined: true,
          })),
        },
        gates: {
          create: data.gates.map(g => ({
            gateNumber: g.number,
            line: g.line,
            color: g.color,
            tone: g.tone,
            base: g.base,
            planet: g.planet,
            isDesign: g.isDesign,
          })),
        },
        channels: {
          create: data.channels,
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
