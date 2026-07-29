import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

// happy-dom provides a real localStorage; zustand persist captures
// window.localStorage eagerly at store creation, so replacing the global
// afterwards would not intercept writes — assert against the real one.
describe('authStore security', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      features: {},
    });
  });

  it('must NOT persist tokens to localStorage', () => {
    // Simulate login by setting tokens directly
    useAuthStore.setState({
      tokens: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake',
        expiresIn: 900,
        expiresAt: Date.now() + 900000,
      },
      isAuthenticated: true,
    });

    const stored = localStorage.getItem('auth-storage');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.state).toBeDefined();

    // CRITICAL: tokens must NEVER be in localStorage
    expect(parsed.state.tokens).toBeUndefined();
    expect(parsed.state.accessToken).toBeUndefined();

    // User data and auth status ARE persisted
    expect(parsed.state.isAuthenticated).toBe(true);
  });

  it('must persist user profile and auth status', () => {
    useAuthStore.setState({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        roles: ['USER'],
        subscription: { tier: 'PREMIUM' as const, status: 'active' },
      },
      isAuthenticated: true,
    });

    const stored = localStorage.getItem('auth-storage');
    const parsed = JSON.parse(stored!);

    expect(parsed.state.user).toBeDefined();
    expect(parsed.state.user.email).toBe('test@example.com');
    expect(parsed.state.isAuthenticated).toBe(true);
  });
});
