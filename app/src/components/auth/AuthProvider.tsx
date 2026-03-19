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
  const { checkAuth, isLoading } = useAuthStore();
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

  if (!isInitialized || isLoading) {
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

/**
 * Hook for tracking authentication state changes
 * 
 * Usage:
 * const { onAuthChange } = useAuthEvents();
 * 
 * useEffect(() => {
 *   return onAuthChange((event, data) => {
 *     if (event === 'LOGIN') {
 *       analytics.track('User Login', data);
 *     }
 *   });
 * }, []);
 */
export function useAuthEvents() {
  const subscribe = (callback: (event: string, data?: unknown) => void) => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'auth_event') {
        const eventData = JSON.parse(e.newValue || '{}');
        callback(eventData.type, eventData.payload);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  };

  const emit = (event: string, data?: unknown) => {
    localStorage.setItem('auth_event', JSON.stringify({
      type: event,
      payload: data,
      timestamp: Date.now(),
    }));
    // Clean up after emitting
    setTimeout(() => localStorage.removeItem('auth_event'), 100);
  };

  return { subscribe, emit };
}
