import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredTier?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  requiredTier 
}: ProtectedRouteProps) {
  const location = useLocation();
  const { 
    isAuthenticated, 
    user, 
    isLoading, 
    checkAuth, 
    hasRole, 
    hasTier 
  } = useAuthStore();
  
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verify = async () => {
      await checkAuth();
      setIsChecking(false);
    };
    
    verify();
  }, [checkAuth]);

  // Show loading spinner while checking auth
  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-white/60">Lädt...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRoles && !hasRole(requiredRoles)) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-medium text-white mb-2">
            Zugriff verweigert
          </h1>
          <p className="text-white/60 mb-6">
            Du hast nicht die nötigen Berechtigungen, um auf diese Seite zuzugreifen.
          </p>
          <button
            onClick={() => window.history.back()}
            className="text-purple-400 hover:text-purple-300"
          >
            ← Zurück
          </button>
        </div>
      </div>
    );
  }

  // Check tier requirements
  if (requiredTier && !hasTier(requiredTier as 'FREE' | 'BASIC' | 'PREMIUM' | 'PRO')) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-medium text-white mb-2">
            Upgrade erforderlich
          </h1>
          <p className="text-white/60 mb-6">
            Diese Funktion ist in deinem aktuellen Paket nicht verfügbar.
            Upgrade auf <strong className="text-white">{requiredTier}</strong> für Zugriff.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-colors"
          >
            Upgrade jetzt
          </a>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}

// ============================================================================
// PRE-BUILT PROTECTED ROUTE VARIANTS
// ============================================================================

/** Route only accessible to authenticated users */
export function UserRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/** Route only accessible to admins */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>{children}</ProtectedRoute>;
}

/** Route only accessible to super admins */
export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>{children}</ProtectedRoute>;
}

/** Route requiring specific subscription tier */
export function TierRoute({ 
  tier, 
  children 
}: { 
  tier: string; 
  children: React.ReactNode 
}) {
  return <ProtectedRoute requiredTier={tier}>{children}</ProtectedRoute>;
}
