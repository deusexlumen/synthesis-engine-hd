import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { Request } from 'express';
import { prisma } from '../lib/prisma';
import * as ephemeris from '../services/ephemeris';

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

const saveHDSchema = z.object({
  energyType: z.enum(['MANIFESTOR', 'GENERATOR', 'MANIFESTING_GENERATOR', 'PROJECTOR', 'REFLECTOR']),
  authority: z.enum(['EMOTIONAL', 'SACRAL', 'SPLENIC', 'EGO', 'SELF_PROJECTED', 'MENTAL', 'LUNAR']),
  profileLine1: z.number().int().min(1).max(6),
  profileLine2: z.number().int().min(1).max(6),
  incarnationCross: z.string(),
  definedCenters: z.array(z.string()),
  undefinedCenters: z.array(z.string()),
  gates: z.array(z.object({
    gateNumber: z.number().int().min(1).max(64),
    line: z.number().int().min(1).max(6),
    color: z.number().int().min(1).max(6),
    tone: z.number().int().min(1).max(6),
    base: z.number().int().min(1).max(5),
    planet: z.string(),
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
// CONSTANTS
// ============================================================================

// All 36 Human Design channels
const CHANNELS: [number, number][] = [
  [1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59],
  [7, 31], [9, 52], [10, 20], [10, 34], [10, 57], [11, 56],
  [12, 22], [13, 33], [16, 48], [17, 62], [18, 58], [19, 49],
  [20, 34], [20, 57], [21, 45], [23, 43], [24, 61], [25, 51],
  [26, 44], [27, 50], [28, 38], [29, 46], [30, 41], [32, 54],
  [34, 57], [35, 36], [37, 40], [39, 55], [42, 53], [47, 64],
];

// Gate to center mapping
function gateToCenter(gate: number): string {
  if ([61, 63, 64].includes(gate)) return 'HEAD';
  if ([47, 24, 4, 11].includes(gate)) return 'AJNA';
  if ([62, 23, 56, 35, 12, 45, 33, 20].includes(gate)) return 'THROAT';
  if ([1, 2, 7, 10, 13, 15, 25, 46].includes(gate)) return 'G_CENTER';
  if ([21, 40, 51, 26].includes(gate)) return 'HEART';
  if ([5, 14, 29, 34, 27, 59, 42, 3, 9].includes(gate)) return 'SACRAL';
  if ([18, 48, 57, 32, 50, 28, 44].includes(gate)) return 'SPLEEN';
  if ([36, 37, 22, 6, 49, 55, 30].includes(gate)) return 'SOLAR_PLEXUS';
  if ([53, 54, 60, 38, 58, 52, 19, 39, 41].includes(gate)) return 'ROOT';
  return 'UNKNOWN';
}

// ============================================================================
// HD CALCULATION LOGIC
// ============================================================================

interface HDGate {
  number: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  planet: string;
  isDesign: boolean;
  longitude: number;
}

function determineEnergyType(definedCenters: string[], activeChannels: [number, number][]): string {
  const hasSacral = definedCenters.includes('SACRAL');
  const hasThroat = definedCenters.includes('THROAT');
  
  const hasMotorToThroat = activeChannels.some(([g1, g2]) => {
    const c1 = gateToCenter(g1);
    const c2 = gateToCenter(g2);
    const motorConnected = ['HEART', 'SOLAR_PLEXUS', 'ROOT', 'SACRAL'].includes(c1) ||
                          ['HEART', 'SOLAR_PLEXUS', 'ROOT', 'SACRAL'].includes(c2);
    const throatConnected = c1 === 'THROAT' || c2 === 'THROAT';
    return motorConnected && throatConnected;
  });
  
  if (hasSacral) {
    return hasMotorToThroat ? 'MANIFESTING_GENERATOR' : 'GENERATOR';
  } else if (definedCenters.includes('HEART') && hasThroat) {
    return 'MANIFESTOR';
  } else if (definedCenters.length === 0) {
    return 'REFLECTOR';
  }
  return 'PROJECTOR';
}

function determineAuthority(definedCenters: string[]): string {
  if (definedCenters.includes('SOLAR_PLEXUS')) return 'EMOTIONAL';
  if (definedCenters.includes('SACRAL')) return 'SACRAL';
  if (definedCenters.includes('SPLEEN')) return 'SPLENIC';
  if (definedCenters.includes('HEART')) return 'EGO';
  if (definedCenters.includes('G_CENTER')) return 'SELF_PROJECTED';
  if (definedCenters.includes('AJNA')) return 'MENTAL';
  return 'LUNAR';
}

// ============================================================================
// MAIN CALCULATION ENDPOINT
// ============================================================================

/**
 * POST /api/hd/calculate
 * 
 * Calculates a Human Design chart with PROFESSIONAL accuracy.
 * Uses NASA JPL Swiss Ephemeris data (±0.0001°)
 */
/**
 * POST /api/hd/calculate
 *
 * DEPRECATED: HD calculations are now performed locally on the client device
 * for privacy protection. Birth data never leaves the user's device.
 */
router.post('/calculate', authenticate, asyncHandler(async (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'GONE',
    message: 'HD calculations are now performed locally for privacy. Please update your app.',
  });
}));

// ============================================================================
// OTHER ENDPOINTS
// ============================================================================

// Save Human Design chart
router.post('/save', authenticate, asyncHandler(async (req: Request, res) => {
  const data = saveHDSchema.parse(req.body);
  const userId = req.user!.userId;

  await prisma.humanDesignProfile.deleteMany({ where: { userId } });

  const profile = await prisma.humanDesignProfile.create({
    data: {
      userId,
      energyType: data.energyType as any,
      authority: data.authority as any,
      profileLine1: data.profileLine1,
      profileLine2: data.profileLine2,
      incarnationCross: data.incarnationCross,
      variables: data.variables,
      centers: {
        create: data.definedCenters.map(name => ({
          name: name as any,
          isDefined: true,
        })),
      },
      gates: {
        create: data.gates.map(g => ({...g, planet: g.planet as any})),
      },
      channels: {
        create: data.channels,
      },
    },
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
