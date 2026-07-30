import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/spinner';

interface AuthProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Authentication Provider
 * 
 * Handles initial authentication check on app load.
 * Validates stored tokens and initializes user session.
 */
export function AuthProvider({ 
  children, 
  fallback = <AuthLoadingScreen /> 
}: AuthProviderProps) {
  const { checkAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    init();
  }, [checkAuth]);

  // Nur die initiale Auth-Prüfung blockiert den Render. Ein späteres
  // isLoading (z. B. während des Logins) darf den Router nicht unmounten,
  // sonst läuft navigate() nach dem Login gegen eine veraltete History.
  if (!isInitialized) {
    return fallback;
  }

  return <>{children}</>;
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          {/* Outer ring */}
          <div className="absolute inset-0 w-16 h-16 -m-2 border-2 border-purple-500/20 rounded-full" />
          {/* Middle ring */}
          <div className="absolute inset-0 w-20 h-20 -m-4 border border-indigo-500/20 rounded-full" />
          
          {/* Spinner */}
          <Spinner size="lg" className="text-purple-500" />
        </div>
        
        <p className="mt-6 text-white/60 animate-pulse">Initialisiere...</p>
      </div>
    </div>
  );
}
