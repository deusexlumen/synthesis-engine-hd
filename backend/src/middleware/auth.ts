/**
 * Authentication & Authorization Middleware
 * JWT verification, RBAC checks
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, rbacService } from '../services/auth';

// ============================================================================
// TYPES
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        roles: string[];
        tier: string;
      };
    }
  }
}

// Export for routes that need typed requests
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    roles: string[];
    tier: string;
  };
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
      tier: payload.tier,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);

      req.user = {
        userId: payload.userId,
        email: payload.email,
        roles: payload.roles,
        tier: payload.tier,
      };
    }

    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Require specific role
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!req.user.roles.includes(role)) {
      res.status(403).json({
        success: false,
        error: `Required role: ${role}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require any of the specified roles
 */
export function requireAnyRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: `Required one of roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific permission
 */
export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const hasPermission = await rbacService.hasPermission(
      req.user.userId,
      resource,
      action
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: `Permission denied: ${resource}:${action}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require authentication (shorthand for authenticate)
 */
export { authenticate as requireAuth };

// ============================================================================
// SUBSCRIPTION MIDDLEWARE
// ============================================================================

/**
 * Require specific subscription tier
 */
export function requireTier(tiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!tiers.includes(req.user.tier)) {
      res.status(403).json({
        success: false,
        error: 'Subscription upgrade required',
        requiredTiers: tiers,
        currentTier: req.user.tier,
        upgradeRequired: true,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory for checking resource ownership
 * Use after authenticate middleware
 */
export function requireOwnership(getResourceUserId: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Admins can access any resource
    if (req.user.roles.includes('ADMIN') || req.user.roles.includes('SUPER_ADMIN')) {
      next();
      return;
    }

    const resourceUserId = await getResourceUserId(req);

    if (resourceUserId !== req.user.userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied: Not resource owner',
      });
      return;
    }

    next();
  };
}
