/**
 * Auth Store with Zustand
 * Manages authentication state, tokens, and user data
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
  subscription: {
    tier: 'FREE' | 'BASIC' | 'PREMIUM' | 'PRO';
    status: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  expiresAt: number; // Timestamp
}

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

// ============================================================================
// API CONFIG
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================================================
// STORE
// ============================================================================

export const useAuthStore = create<AuthState>()(
  immer(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Setters
        setUser: (user) =>
          set((state) => {
            state.user = user;
            state.isAuthenticated = !!user;
          }),

        setTokens: (tokens) =>
          set((state) => {
            state.tokens = tokens;
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        clearError: () =>
          set((state) => {
            state.error = null;
          }),

        // Login
        login: async (email, password) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include', // For httpOnly cookies
              body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Login failed');
            }

            const expiresAt = Date.now() + data.data.tokens.expiresIn * 1000;

            set((state) => {
              state.user = data.data.user;
              state.tokens = {
                ...data.data.tokens,
                expiresAt,
              };
              state.isAuthenticated = true;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Login failed';
              state.isLoading = false;
              state.isAuthenticated = false;
            });
            throw error;
          }
        },

        // Register
        register: async (email, password) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`${API_BASE}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Registration failed');
            }

            const expiresAt = Date.now() + data.data.tokens.expiresIn * 1000;

            set((state) => {
              state.user = data.data.user;
              state.tokens = {
                ...data.data.tokens,
                expiresAt,
              };
              state.isAuthenticated = true;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Registration failed';
              state.isLoading = false;
            });
            throw error;
          }
        },

        // Logout
        logout: async () => {
          try {
            await fetch(`${API_BASE}/api/auth/logout`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                Authorization: `Bearer ${get().tokens?.accessToken || ''}`,
              },
            });
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            set((state) => {
              state.user = null;
              state.tokens = null;
              state.isAuthenticated = false;
              state.error = null;
            });
          }
        },

        // Refresh token
        refreshToken: async () => {
          try {
            const response = await fetch(`${API_BASE}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              throw new Error('Token refresh failed');
            }

            const data = await response.json();
            const expiresAt = Date.now() + data.data.expiresIn * 1000;

            set((state) => {
              state.tokens = {
                ...data.data,
                expiresAt,
              };
            });

            return true;
          } catch (error) {
            // Refresh failed, logout user
            set((state) => {
              state.user = null;
              state.tokens = null;
              state.isAuthenticated = false;
            });
            return false;
          }
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export function useUser() {
  return useAuthStore((state) => state.user);
}

export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated);
}

export function useAuthLoading() {
  return useAuthStore((state) => state.isLoading);
}

export function useAuthError() {
  return useAuthStore((state) => state.error);
}

export function useUserTier() {
  return useAuthStore((state) => state.user?.subscription.tier || 'FREE');
}

export function useHasRole(role: string) {
  return useAuthStore((state) => state.user?.roles.includes(role) || false);
}
