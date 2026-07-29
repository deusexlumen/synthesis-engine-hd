/**
 * Authentication Service
 * JWT-based auth with refresh tokens, RBAC, and audit logging
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { APIError } from '../middleware/errorHandler';
import type { Request } from 'express';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Validate required secrets at startup
const accessTokenSecret = process.env.JWT_SECRET;
const refreshTokenSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (!accessTokenSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (!refreshTokenSecret) {
  throw new Error('JWT_REFRESH_SECRET or JWT_SECRET environment variable is required');
}
if (accessTokenSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
if (refreshTokenSecret.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
}

const JWT_CONFIG = {
  accessTokenSecret,
  refreshTokenSecret,
  accessTokenExpiry: '15m' as const,
  refreshTokenExpiry: '7d' as const,
};

const SALT_ROUNDS = 12;

// ============================================================================
// TYPES
// ============================================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  tier: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// ONE-TIME TOKEN HASHING
// ============================================================================

/**
 * Hash a one-time token (email verification, password reset) for storage.
 * The plaintext token only ever travels inside the email link; the DB keeps
 * just its SHA-256 digest, so a database leak doesn't hand out usable
 * reset/verify tokens. SHA-256 (not bcrypt) is right here: the tokens are
 * high-entropy UUIDs, so brute force is infeasible and lookup-by-hash must
 * stay deterministic for the `findFirst({ where: { token } })` queries.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_CONFIG.accessTokenSecret, {
    expiresIn: JWT_CONFIG.accessTokenExpiry,
    issuer: 'synthesis-engine',
    audience: 'synthesis-engine-api',
  });
}

export function generateRefreshToken(userId: string): { token: string; expiresAt: Date } {
  // Refresh tokens are signed with a SEPARATE secret than access tokens, so
  // a leaked access-token secret can't mint refresh tokens (and vice versa).
  // The token is still looked up in the DB (revocation, rotation tracking) —
  // the JWT layer adds tamper-evidence and an independent expiry on top.
  const token = jwt.sign(
    { userId, jti: uuidv4(), type: 'refresh' },
    JWT_CONFIG.refreshTokenSecret,
    {
      expiresIn: JWT_CONFIG.refreshTokenExpiry,
      issuer: 'synthesis-engine',
      audience: 'synthesis-engine-api',
    }
  );
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  return { token, expiresAt };
}

/**
 * Verify a refresh token's signature and shape (DB lookup happens separately)
 */
export function verifyRefreshToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_CONFIG.refreshTokenSecret, {
    algorithms: ['HS256'],
    issuer: 'synthesis-engine',
    audience: 'synthesis-engine-api',
  }) as jwt.JwtPayload;

  if (payload.type !== 'refresh' || typeof payload.userId !== 'string') {
    throw new APIError('Invalid refresh token', 401, 'REFRESH_INVALID');
  }

  return { userId: payload.userId };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_CONFIG.accessTokenSecret, {
    algorithms: ['HS256'],
    issuer: 'synthesis-engine',
    audience: 'synthesis-engine-api',
  }) as TokenPayload;
}

// ============================================================================
// AUTH SERVICE
// ============================================================================

export const authService = {
  /**
   * Register a new user
   */
  async register(input: RegisterInput, req?: Request): Promise<{ user: any; tokens: AuthTokens; emailVerifyToken: string }> {
    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create verification token — the PLAINTEXT goes into the verification
    // email, only its SHA-256 digest is stored (see hashToken).
    const emailVerifyToken = uuidv4();

    // Get default role (USER)
    const defaultRole = await prisma.role.findUnique({
      where: { name: 'USER' },
    });

    if (!defaultRole) {
      throw new APIError('Default role not found', 500, 'ROLE_CONFIG_MISSING');
    }

    // Create user with transaction. No pre-check for an existing email —
    // that read-then-write has a race window where two concurrent
    // registrations both pass the check and one throws an unhandled
    // Prisma P2002 error at the create() below. Let the unique constraint
    // do the check atomically and translate its failure below instead.
    let user;
    try {
      user = await prisma.$transaction(async (tx: any) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            email: input.email.toLowerCase(),
            passwordHash,
            emailVerifyToken: hashToken(emailVerifyToken),
            roles: {
              create: {
                roleId: defaultRole.id,
              },
            },
            subscription: {
              create: {
                tier: 'FREE',
                status: 'INACTIVE',
              },
            },
          },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            subscription: true,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: newUser.id,
            action: 'USER_REGISTERED',
            resource: 'user',
            resourceId: newUser.id,
            details: { email: input.email },
            ipAddress: req?.ip,
            userAgent: req?.headers['user-agent'],
          },
        });

        return newUser;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new APIError('Email already registered', 409, 'EMAIL_TAKEN');
      }
      throw error;
    }

    // Generate tokens
    const tokens = await this.createSession(user, req);

    // Return the PLAINTEXT verify token alongside — the caller (route layer)
    // needs it to build the verification email link. It is never persisted.
    return { user, tokens, emailVerifyToken };
  },

  /**
   * Login user
   */
  async login(input: LoginInput, req?: Request): Promise<{ user: any; tokens: AuthTokens }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        subscription: true,
      },
    });

    // Always run one bcrypt comparison, even when the account doesn't
    // exist — otherwise the response time differs measurably between
    // "unknown email" (fast, no hashing) and "wrong password" (slow),
    // which lets attackers enumerate registered emails. The dummy hash is
    // a valid bcrypt hash of a random string; the result is discarded.
    const DUMMY_PASSWORD_HASH = '$2a$12$LJ3m4y1xGgHfZqC0cK6UuOZQy0m9u6y0v2Q0Yq9pQzF0hK1oF0hK1';
    const hashToCheck = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isValid = await verifyPassword(input.password, hashToCheck);

    if (!user || !user.passwordHash) {
      throw new APIError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new APIError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (!isValid) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          details: { reason: 'invalid_password' },
          ipAddress: req?.ip,
          userAgent: req?.headers['user-agent'],
        },
      });
      throw new APIError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.createSession(user, req);

    // Log successful login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        ipAddress: req?.ip,
        userAgent: req?.headers['user-agent'],
      },
    });

    return { user, tokens };
  },

  /**
   * Create session (generate tokens)
   */
  async createSession(user: any, req?: Request): Promise<AuthTokens> {
    // Create access token payload
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((ur: any) => ur.role.name),
      tier: user.subscription?.tier || 'FREE',
    };

    // Generate tokens
    const accessToken = generateAccessToken(payload);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user.id);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Create session record
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken.slice(-32), // Store last 32 chars for reference
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        ipAddress: req?.ip,
        userAgent: req?.headers['user-agent'],
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, req?: Request): Promise<AuthTokens> {
    // Verify signature/expiry against the dedicated refresh secret BEFORE
    // hitting the DB — unsigned or expired tokens are rejected cheaply and
    // never reach the lookup.
    try {
      verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof APIError) throw error;
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new APIError('Refresh token expired', 401, 'REFRESH_EXPIRED');
      }
      throw new APIError('Invalid refresh token', 401, 'REFRESH_INVALID');
    }

    // Find refresh token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            subscription: true,
          },
        },
      },
    });

    if (!storedToken || storedToken.revoked) {
      throw new APIError('Invalid refresh token', 401, 'REFRESH_INVALID');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new APIError('Refresh token expired', 401, 'REFRESH_EXPIRED');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Create new session
    const tokens = await this.createSession(storedToken.user, req);

    // Update with replacement reference
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { replacedByToken: tokens.refreshToken },
    });

    // Log token refresh
    await prisma.auditLog.create({
      data: {
        userId: storedToken.user.id,
        action: 'TOKEN_REFRESHED',
        ipAddress: req?.ip,
        userAgent: req?.headers['user-agent'],
      },
    });

    return tokens;
  },

  /**
   * Logout user
   */
  async logout(userId: string, refreshToken?: string, req?: Request): Promise<void> {
    await prisma.$transaction(async (tx: any) => {
      // Revoke refresh token if provided
      if (refreshToken) {
        await tx.refreshToken.updateMany({
          where: {
            userId,
            token: refreshToken,
          },
          data: { revoked: true },
        });
      }

      // Revoke all user sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // Log logout
      await tx.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT',
          ipAddress: req?.ip,
          userAgent: req?.headers['user-agent'],
        },
      });
    });
  },

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new APIError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new APIError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update password. passwordResetToken is explicitly cleared here (not
    // just left alone): resetPassword() below only checks the token value
    // plus a recency window on passwordResetAt, not whether the token was
    // ever consumed. Without this, a stale forgot-password token that was
    // never used could be "reactivated" by this unrelated, legitimate
    // password change bumping passwordResetAt to now.
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordResetAt: new Date(),
        passwordResetToken: null,
      },
    });

    // Log password change
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
      },
    });

    // Revoke all refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists
      return null;
    }

    // Generate reset token — the PLAINTEXT is returned for the email link,
    // only its SHA-256 digest is stored (see hashToken).
    const resetToken = uuidv4();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashToken(resetToken),
        passwordResetAt: new Date(),
      },
    });

    return resetToken;
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashToken(token),
        passwordResetAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour expiry
        },
      },
    });

    if (!user) {
      throw new APIError('Invalid or expired reset token', 400, 'RESET_TOKEN_INVALID');
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordResetToken: null,
        passwordResetAt: null,
      },
    });

    // Log password reset
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET',
      },
    });

    // Revoke all tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revoked: true },
    });

    await prisma.session.deleteMany({
      where: { userId: user.id },
    });
  },
};

// ============================================================================
// RBAC UTILITIES
// ============================================================================

export const rbacService = {
  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return false;

    // Check if user has the permission through any role
    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        const perm = rolePermission.permission;
        if (perm.resource === resource && perm.action === action) {
          return true;
        }
        // Wildcard permission (e.g., admin with resource: '*', action: '*')
        if (perm.resource === '*' && (perm.action === action || perm.action === '*')) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Get all permissions for user
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return [];

    const permissions = new Set<string>();
    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        const perm = rolePermission.permission;
        permissions.add(`${perm.resource}:${perm.action}`);
      }
    }

    return Array.from(permissions);
  },

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleName: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { name: roleName as any },
    });

    if (!role) {
      throw new APIError('Role not found', 404, 'ROLE_NOT_FOUND');
    }

    await prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
      },
    });
  },
};

// ============================================================================
// SUBSCRIPTION UTILITIES
// ============================================================================

export const subscriptionService = {
  /**
   * Check if user has access to feature
   */
  async hasFeature(userId: string, feature: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) return false;

    const features = (subscription.features as Record<string, boolean>) || {};
    return features[feature] === true;
  },

  /**
   * Get user's subscription tier
   */
  async getTier(userId: string): Promise<string> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    return subscription?.tier || 'FREE';
  },

  /**
   * Update subscription features (cached)
   */
  async updateFeatures(userId: string, features: Record<string, boolean>): Promise<void> {
    await prisma.subscription.update({
      where: { userId },
      data: { features },
    });
  },
};
