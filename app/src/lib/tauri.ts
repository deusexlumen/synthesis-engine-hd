/**
 * Platform abstraction layer for Tauri vs Web builds.
 *
 * In desktop builds (Tauri), this delegates to the Rust backend via `invoke`.
 * In web builds, it gracefully falls back to browser APIs or returns
 * sensible defaults so the UI never crashes.
 */

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI__;
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new PlatformError(`Tauri command "${cmd}" is not available in web mode.`);
  }
  return tauriInvoke<T>(cmd, args);
}

export async function invokeSafe<T>(
  cmd: string,
  args?: Record<string, unknown>,
  fallback?: T
): Promise<T | undefined> {
  if (!isTauri()) {
    return fallback;
  }
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[tauri] Command "${cmd}" failed:`, err);
    return fallback;
  }
}

export class PlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformError';
  }
}
