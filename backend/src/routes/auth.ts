/**
 * Authentication Routes
 * Registration, Login, Token Refresh, Logout
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authService, rbacService, subscriptionService, hashToken } from '../services/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { authLimiter } from '../middleware/rateLimit';

const router: Router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    
    const { user, tokens, emailVerifyToken } = await authService.register(data, req);

    // Send the verification email. Failure must not abort registration —
    // the user can request a new verification mail later.
    try {
      await sendVerificationEmail(user.email, emailVerifyToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      },
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    
    const { user, tokens } = await authService.login(data, req);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          roles: user.roles.map((ur: any) => ur.role.name),
          subscription: user.subscription,
        },
        tokens: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      },
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    const tokens = await authService.refreshToken(refreshToken, req);

    // Update cookie with new refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    
    await authService.logout(req.user!.userId, refreshToken, req);

    // Clear cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const permissions = await rbacService.getUserPermissions(req.user!.userId);
    const tier = await subscriptionService.getTier(req.user!.userId);

    res.json({
      success: true,
      data: {
        user: req.user,
        permissions,
        tier,
      },
    });
  })
);

/**
 * POST /api/auth/change-password
 * Change password
 */
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    
    await authService.changePassword(
      req.user!.userId,
      data.oldPassword,
      data.newPassword
    );

    // Clear cookie (force re-login)
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    
    const resetToken = await authService.requestPasswordReset(email);

    // Send the reset link via the email service (Resend, or console
    // fallback in dev). Failures are logged but never surfaced — the
    // response must stay uniform so registered emails can't be probed.
    if (resetToken) {
      try {
        await sendPasswordResetEmail(email.toLowerCase(), resetToken);
      } catch (error) {
        console.error('Failed to send password reset email:', error);
      }
    }

    // Always return success (don't reveal if email exists)
    // NEVER return reset tokens in the HTTP response
    res.json({
      success: true,
      message: 'If an account exists, a password reset email has been sent.',
    });
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = resetPasswordSchema.parse(req.body);
    
    await authService.resetPassword(data.token, data.newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  })
);

/**
 * POST /api/auth/verify-email
 * Verify email address
 */
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);

    // Tokens are stored as SHA-256 digests (see hashToken) — hash the
    // presented plaintext token before looking it up.
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: hashToken(token) },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
      },
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  })
);

export { router as authRouter };
