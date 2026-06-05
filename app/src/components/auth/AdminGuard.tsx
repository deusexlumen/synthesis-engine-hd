import { useAuthStore } from '@/stores/authStore';
import { ReactNode } from 'react';

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requiredRole?: 'ADMIN' | 'SUPER_ADMIN';
  requiredPermission?: string;
}

/**
 * Component to conditionally render content based on admin permissions
 * 
 * Usage:
 * <AdminGuard>
 *   <AdminPanelButton />
 * </AdminGuard>
 * 
 * <AdminGuard requiredRole="SUPER_ADMIN">
 *   <SuperAdminSettings />
 * </AdminGuard>
 */
export function AdminGuard({ 
  children, 
  fallback = null,
  requiredRole,
  requiredPermission 
}: AdminGuardProps) {
  const { user, hasRole, hasPermission } = useAuthStore();

  if (!user) return fallback;

  // Check role requirement
  if (requiredRole) {
    const allowedRoles = requiredRole === 'SUPER_ADMIN' 
      ? ['SUPER_ADMIN'] 
      : ['ADMIN', 'SUPER_ADMIN'];
    
    if (!hasRole(allowedRoles)) {
      return fallback;
    }
  } else {
    // Default: any admin role
    if (!hasRole(['ADMIN', 'SUPER_ADMIN'])) {
      return fallback;
    }
  }

  // Check specific permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback;
  }

  return <>{children}</>;
}

interface FeatureGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  feature: string;
}

/**
 * Guard content based on subscription features
 * 
 * Usage:
 * <FeatureGuard feature="aiCoach">
 *   <AICoachButton />
 * </FeatureGuard>
 * 
 * <FeatureGuard feature="apiAccess" fallback={<UpgradePrompt />}>
 *   <APISettings />
 * </FeatureGuard>
 */
export function FeatureGuard({ 
  children, 
  fallback = null,
  feature 
}: FeatureGuardProps) {
  const { features } = useAuthStore();

  const hasFeature = () => {
    switch (feature) {
      case 'aiCoach':
        return features.aiCoach;
      case 'apiAccess':
        return features.apiAccess;
      case 'webhooks':
        return features.webhooks;
      case 'unlimitedCharts':
        return typeof features.maxCharts === 'number' && (features.maxCharts === -1 || features.maxCharts > 1);
      default:
        return false;
    }
  };

  if (!hasFeature()) {
    return fallback;
  }

  return <>{children}</>;
}

interface SubscriptionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  minTier: 'FREE' | 'BASIC' | 'PREMIUM' | 'PRO';
}

/**
 * Guard content based on subscription tier
 * 
 * Usage:
 * <SubscriptionGuard minTier="PREMIUM">
 *   <PremiumFeature />
 * </SubscriptionGuard>
 */
export function SubscriptionGuard({ 
  children, 
  fallback = null,
  minTier 
}: SubscriptionGuardProps) {
  const { hasTier } = useAuthStore();

  if (!hasTier(minTier)) {
    return fallback;
  }

  return <>{children}</>;
}
