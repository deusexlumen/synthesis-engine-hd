import { Router } from 'express';
import { z } from 'zod';
import type { EnergyType, Authority, CenterName, Planet, Prisma } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';
import { Request } from 'express';
import { prisma } from '../lib/prisma';
import * as ephemeris from '../services/ephemeris';
import { resolveProvider, getAvailableProviders } from '../services/ephemeris/resolver';
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
 * Calculates a Human Design chart. The ephemeris backend is chosen per
 * request from the caller's subscription tier (Phase C): PREMIUM/PRO get
 * Swiss Ephemeris professional accuracy (±0.0001°) when the
 * EPHEMERIS_PRO_ENABLED flag is on; FREE/BASIC and guests get the standard
 * astronomia/Meeus backend (≤ ~0.02°). The `accuracy` label and
 * `meta.ephemerisProvider` reflect the backend actually used.
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

  const tier = req.user?.tier ?? 'FREE';
  const provider = resolveProvider(tier);

  // Compute first: the SwephProvider initializes lazily on first calcUt,
  // so its status (usingFiles) is only meaningful after this call.
  const chart = calculateHumanDesignChart(birthData, provider);
  const julianDay = ephemeris.calculateJulianDay(birthData, provider);

  const status = ephemeris.getStatus(provider);
  const isProfessional = provider.name === 'swiss-professional' && status.usingFiles;

  res.json({
    success: true,
    accuracy: isProfessional ? 'PROFESSIONAL' : 'STANDARD',
    data: chart,
    meta: {
      calculatedAt: new Date().toISOString(),
      calculationTimeMs: Date.now() - startedAt,
      usingEphemeris: status.usingFiles,
      ephemerisProvider: provider.name,
      // sweph-specific detail — only present when the professional backend
      // actually served this request.
      ...(provider.name === 'swiss-professional' ? { swissephVersion: status.version } : {}),
      // Bodies the ephemeris backend could not supply (e.g. Chiron on the
      // standard tier); empty when the chart is complete.
      missingBodies: chart.missingBodies ?? [],
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

  // Same tier-based provider selection as /calculate: a persisted chart must
  // match the accuracy tier the user would get from a fresh calculation
  // (Phase D consistency fix — previously this always used the default
  // SwephProvider regardless of tier or feature flag).
  const chart = calculateHumanDesignChart(birthData, resolveProvider(req.user!.tier));

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

// Health check for ephemeris — also reports availability of BOTH backends
// (Phase C), independent of the default-provider status above.
router.get('/health', asyncHandler(async (req, res) => {
  const status = ephemeris.getStatus();
  const diagnostics = ephemeris.getDiagnostics();

  res.json({
    status: status.usingFiles ? 'ok' : 'warning',
    ephemeris: status,
    providers: getAvailableProviders(),
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
