import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('tauri abstraction layer', () => {
  let originalTauri: unknown;

  beforeEach(() => {
    vi.resetModules();
    originalTauri = (globalThis as unknown as Record<string, unknown>).__TAURI__;
  });

  afterEach(() => {
    if (originalTauri === undefined) {
      delete (globalThis as unknown as Record<string, unknown>).__TAURI__;
    } else {
      (globalThis as unknown as Record<string, unknown>).__TAURI__ = originalTauri;
    }
  });

  it('detects non-Tauri environment', async () => {
    delete (globalThis as unknown as Record<string, unknown>).__TAURI__;
    // Dynamic import to pick up the new global state
    const { isTauri, invokeSafe } = await import('./tauri');

    expect(isTauri()).toBe(false);

    // invokeSafe should return fallback without throwing
    const result = await invokeSafe<string>('test_cmd', {}, 'fallback_value');
    expect(result).toBe('fallback_value');
  });

  it('detects Tauri environment', async () => {
    (globalThis as unknown as Record<string, unknown>).__TAURI__ = {};
    const { isTauri } = await import('./tauri');

    expect(isTauri()).toBe(true);
  });

  it('invoke throws in web mode when no fallback provided', async () => {
    delete (globalThis as unknown as Record<string, unknown>).__TAURI__;
    const { invoke } = await import('./tauri');

    await expect(invoke('test_cmd')).rejects.toThrow('not available in web mode');
  });
});
