/**
 * Authenticated API Client
 * Automatically attaches tokens and handles refresh
 */

import { useAuthStore } from '@/stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getToken(): Promise<string | null> {
    const tokens = useAuthStore.getState().tokens;
    
    if (!tokens) return null;

    // Check if token is expired (with 60s buffer)
    if (Date.now() >= tokens.expiresAt - 60000) {
      // Token expired, try to refresh
      const refreshed = await useAuthStore.getState().refreshToken();
      if (!refreshed) return null;
      
      // Get new token after refresh
      return useAuthStore.getState().tokens?.accessToken || null;
    }

    return tokens.accessToken;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle 401 - Token expired and refresh failed
      if (response.status === 401) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Convenience methods
  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient(API_BASE);

// ============================================================================
// AUTH API
// ============================================================================

export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/api/auth/login', { email, password }),

  register: (email: string, password: string) =>
    apiClient.post('/api/auth/register', { email, password }),

  logout: () =>
    apiClient.post('/api/auth/logout', {}),

  me: () =>
    apiClient.get('/api/auth/me'),

  refresh: () =>
    apiClient.post('/api/auth/refresh', {}),

  changePassword: (oldPassword: string, newPassword: string) =>
    apiClient.post('/api/auth/change-password', { oldPassword, newPassword }),

  forgotPassword: (email: string) =>
    apiClient.post('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/api/auth/reset-password', { token, newPassword }),
};

// ============================================================================
// USER API
// ============================================================================

export const userAPI = {
  getProfile: () =>
    apiClient.get('/api/auth/me'),

  updateProfile: (data: unknown) =>
    apiClient.put('/api/user/profile', data),

  deleteAccount: () =>
    apiClient.delete('/api/user/account'),
};

// ============================================================================
// CHART API
// ============================================================================

export const chartAPI = {
  calculate: (data: unknown) =>
    apiClient.post('/api/hd/calculate', data),

  save: (data: unknown) =>
    apiClient.post('/api/hd/save', data),

  getProfile: () =>
    apiClient.get('/api/hd/profile'),
};
