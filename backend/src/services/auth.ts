/**
 * Authentication Service
 * JWT-based auth with refresh tokens, RBAC, and audit logging
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
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
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  return { token, expiresAt };
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
  async register(input: RegisterInput, req?: Request): Promise<{ user: any; tokens: AuthTokens }> {
    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create verification token
    const emailVerifyToken = uuidv4();

    // Get default role (USER)
    const defaultRole = await prisma.role.findUnique({
      where: { name: 'USER' },
    });

    if (!defaultRole) {
      throw new Error('Default role not found');
    }

    // Create user with transaction
    const user = await prisma.$transaction(async (tx: any) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          emailVerifyToken,
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

    // Generate tokens
    const tokens = await this.createSession(user, req);

    return { user, tokens };
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

    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new Error('Account is not active');
    }

    // Verify password
    const isValid = await verifyPassword(input.password, user.passwordHash);

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
      throw new Error('Invalid credentials');
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
      throw new Error('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token expired');
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
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordResetAt: new Date(),
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

    // Generate reset token
    const resetToken = uuidv4();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
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
        passwordResetToken: token,
        passwordResetAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour expiry
        },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
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
      throw new Error('Role not found');
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
