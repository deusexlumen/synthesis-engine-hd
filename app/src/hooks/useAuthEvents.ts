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
        try {
          const eventData = JSON.parse(e.newValue || '{}');
          callback(eventData.type, eventData.payload);
        } catch {
          // Ignore malformed storage events
        }
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
