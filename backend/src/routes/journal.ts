/**
 * Journal Routes
 * Per-user CRUD for journal entries (previously localStorage-only).
 * Every entry is owned by exactly one user; single-entry operations go
 * through requireOwnership (admins bypass), so a foreign or missing id
 * yields 403 without revealing whether the entry exists.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest, requireOwnership } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router: Router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createEntrySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().max(50000),
  mood: z.string().trim().max(50).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
});

const updateEntrySchema = createEntrySchema.partial();

// ============================================================================
// OWNERSHIP
// ============================================================================

/**
 * Resolve the owning userId of the entry addressed by :id. Returns null for
 * unknown ids, which requireOwnership treats the same as a foreign entry.
 */
const entryOwnership = requireOwnership(async (req) => {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: req.params.id },
    select: { userId: true },
  });
  return entry?.userId ?? null;
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/journal
 * List all journal entries of the current user, newest first.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const entries = await prisma.journalEntry.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: entries });
  })
);

/**
 * GET /api/journal/:id
 * Get a single entry (owner or admin only).
 */
router.get(
  '/:id',
  authenticate,
  entryOwnership,
  asyncHandler(async (req, res) => {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: req.params.id },
    });

    res.json({ success: true, data: entry });
  })
);

/**
 * POST /api/journal
 * Create a new entry for the current user.
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = createEntrySchema.parse(req.body);

    const entry = await prisma.journalEntry.create({
      data: {
        userId: req.user!.userId,
        title: data.title,
        content: data.content,
        mood: data.mood,
        tags: data.tags,
      },
    });

    res.status(201).json({ success: true, data: entry });
  })
);

/**
 * PATCH /api/journal/:id
 * Update an entry (owner or admin only).
 */
router.patch(
  '/:id',
  authenticate,
  entryOwnership,
  asyncHandler(async (req, res) => {
    const data = updateEntrySchema.parse(req.body);

    const entry = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, data: entry });
  })
);

/**
 * DELETE /api/journal/:id
 * Delete an entry (owner or admin only).
 */
router.delete(
  '/:id',
  authenticate,
  entryOwnership,
  asyncHandler(async (req, res) => {
    await prisma.journalEntry.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Entry deleted' });
  })
);

export { router as journalRouter };
