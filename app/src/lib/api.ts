/**
 * API Client for Synthesis Engine
 * Handles all communication with the Node.js backend
 * OPTIMIZED: Proper error handling, data transformation, caching
 */

import type {
  BirthData,
  APICalculationRequest,
  HDChartResponse,
  HumanDesignChart,
  GeocodeResult,
  TimezoneResult,
  HealthCheckResponse,
} from '@/types/humanDesign';
import { calculateMillmanProfile } from '@/lib/millmanCalculations';
import type { MillmanProfile } from '@/types/humanDesign';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Request cache for deduplication
const requestCache = new Map<string, Promise<unknown>>();
const CACHE_DURATION = 30000; // 30 seconds

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Network error with retry info
export class NetworkError extends Error {
  constructor(
    message: string,
    public shouldRetry: boolean = true
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Transform BirthData to API format
 */
function transformBirthData(data: BirthData): APICalculationRequest {
  const [year, month, day] = data.birthDate.split('-').map(Number);
  const [hourStr, minuteStr] = data.birthTime.split(':');
  const hour = hourStr ? parseInt(hourStr, 10) : 12;
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;

  // Parse timezone offset from string (e.g., "Europe/Berlin" → 1 or 2)
  const now = new Date();
  const tzOffset = data.timezone
    ? parseFloat(data.timezone) || getTimezoneOffset(data.timezone, data.birthDate)
    : 1; // Default to CET

  return {
    year,
    month,
    day,
    hour,
    minute,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: tzOffset,
  };
}

/**
 * Get timezone offset from IANA timezone string
 */
function getTimezoneOffset(timezone: string, dateStr: string): number {
  try {
    const date = new Date(dateStr);
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch {
    return 1; // Fallback to CET
  }
}

/**
 * Generate cache key for request
 */
function getCacheKey(url: string, body?: unknown): string {
  return body ? `${url}:${JSON.stringify(body)}` : url;
}

/**
 * Request timeout wrapper with AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout - please try again', false);
      }
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new NetworkError('Network error - check your connection', true);
      }
    }
    throw error;
  }
}

/**
 * Parse API error response
 */
async function parseError(response: Response): Promise<APIError> {
  let errorData: { message?: string; code?: string; details?: unknown } = {};

  try {
    errorData = await response.json();
  } catch {
    // If JSON parsing fails, use status text
  }

  const message = errorData.message || response.statusText || 'An error occurred';
  const code = errorData.code || `HTTP_${response.status}`;

  return new APIError(message, response.status, code, errorData.details);
}

// ============================================================================
// API CLIENT
// ============================================================================

export const api = {
  /**
   * Calculate Human Design chart from birth data
   * Returns both HD Chart and Numerology Profile
   */
  async calculateHD(data: BirthData, accessToken?: string): Promise<{
    hdChart: HumanDesignChart;
    millmanProfile: MillmanProfile;
    meta: HDChartResponse['meta'];
  }> {
    const cacheKey = getCacheKey(`${API_BASE}/api/hd/calculate`, data);

    // Check cache
    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<{
        hdChart: HumanDesignChart;
        millmanProfile: MillmanProfile;
        meta: HDChartResponse['meta'];
      }>;
    }

    const requestPromise = (async () => {
      const apiData = transformBirthData(data);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetchWithTimeout(`${API_BASE}/api/hd/calculate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        throw await parseError(response);
      }

      const result: HDChartResponse = await response.json();

      if (!result.success || !result.data) {
        throw new APIError('Calculation returned invalid data', 500, 'INVALID_RESPONSE');
      }

      // Calculate Millman numerology profile locally
      const millmanProfile = calculateMillmanProfile({
        fullName: data.name,
        birthDate: data.birthDate,
      });

      return {
        hdChart: result.data,
        millmanProfile,
        meta: result.meta,
      };
    })();

    // Cache and auto-expire
    requestCache.set(cacheKey, requestPromise);
    setTimeout(() => requestCache.delete(cacheKey), CACHE_DURATION);

    return requestPromise;
  },

  /**
   * Check backend health and ephemeris status
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    const cacheKey = getCacheKey(`${API_BASE}/api/hd/health`);

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<HealthCheckResponse>;
    }

    const requestPromise = (async () => {
      const response = await fetchWithTimeout(
        `${API_BASE}/api/hd/health`,
        { method: 'GET' },
        5000
      );

      if (!response.ok) {
        throw await parseError(response);
      }

      return response.json();
    })();

    requestCache.set(cacheKey, requestPromise);
    setTimeout(() => requestCache.delete(cacheKey), CACHE_DURATION);

    return requestPromise;
  },

  /**
   * Search for locations (geocoding)
   * Uses OpenStreetMap Nominatim (free, rate-limited)
   */
  async searchLocation(query: string): Promise<GeocodeResult[]> {
    if (!query.trim() || query.length < 2) return [];

    const cacheKey = getCacheKey(`geocode:${query}`);

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<GeocodeResult[]>;
    }

    const requestPromise = (async () => {
      try {
        const response = await fetchWithTimeout(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=de,en`,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'SynthesisEngine/1.0 (https://synthesis.engine)',
            },
          },
          10000
        );

        if (!response.ok) {
          throw new NetworkError('Location search failed', false);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          return [];
        }

        return data.map((item: Record<string, unknown>) => ({
          name: String(item.display_name || ''),
          latitude: parseFloat(String(item.lat)) || 0,
          longitude: parseFloat(String(item.lon)) || 0,
          country: String((item.address as Record<string, string>)?.country || ''),
        }));
      } catch (error) {
        console.error('Geocoding error:', error);
        return []; // Return empty on error, don't crash
      }
    })();

    requestCache.set(cacheKey, requestPromise);
    setTimeout(() => requestCache.delete(cacheKey), CACHE_DURATION);

    return requestPromise;
  },

  /**
   * Get timezone for coordinates
   */
  async getTimezone(latitude: number, longitude: number): Promise<TimezoneResult> {
    const cacheKey = getCacheKey(`timezone:${latitude},${longitude}`);

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey) as Promise<TimezoneResult>;
    }

    const requestPromise = (async () => {
      try {
        const response = await fetchWithTimeout(
          `https://timeapi.io/api/timezone/coordinate?latitude=${latitude}&longitude=${longitude}`,
          { method: 'GET' },
          5000
        );

        if (!response.ok) {
          throw new NetworkError('Timezone lookup failed', false);
        }

        const data = await response.json();

        return {
          timezone: String(data.timeZone || 'UTC'),
          offset: data.currentUtcOffset?.hours || 0,
        };
      } catch (error) {
        // Fallback to browser timezone
        return {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          offset: -(new Date().getTimezoneOffset() / 60),
        };
      }
    })();

    requestCache.set(cacheKey, requestPromise);
    setTimeout(() => requestCache.delete(cacheKey), CACHE_DURATION * 2); // Longer cache for timezone

    return requestPromise;
  },
};

// ============================================================================
// RETRY UTILITIES
// ============================================================================

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (error instanceof APIError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
      }

      // Don't retry if NetworkError says not to
      if (error instanceof NetworkError && !error.shouldRetry) {
        throw error;
      }

      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Debounced API call for search inputs
 */
export function debouncedSearch<T>(
  fn: (query: string) => Promise<T>,
  delay = 300
): (query: string) => Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (query: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(query);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export function clearAPICache(): void {
  requestCache.clear();
}

export function getAPICacheSize(): number {
  return requestCache.size;
}
