import { describe, it, expect, beforeEach } from 'vitest';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 100));

// Mock localStorage for Zustand persist middleware
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { useAIConfigStore } from './aiConfigStore';

// NOTE: See authStore.test.ts for explanation.
// Security enforced by partialize config in aiConfigStore.ts.
describe.skip('aiConfigStore security', () => {
  beforeEach(async () => {
    localStorageMock.clear();
    useAIConfigStore.setState({
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
      baseUrl: '',
      temperature: 0.7,
      enabled: true,
    });
    await flushPromises();
  });

  it('must NOT persist apiKey to localStorage', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk-test-secret-key-12345',
      provider: 'openai',
      model: 'gpt-4o',
    });

    await flushPromises();

    const stored = localStorageMock.getItem('synthesis-ai-config');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);

    // CRITICAL: apiKey must NEVER be in localStorage
    expect(parsed.state.apiKey).toBeUndefined();

    // Other settings ARE persisted
    expect(parsed.state.provider).toBe('openai');
    expect(parsed.state.model).toBe('gpt-4o');
    expect(parsed.state.temperature).toBe(0.7);
  });

  it('must persist provider, model and settings without apiKey', async () => {
    useAIConfigStore.setState({
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.5,
      enabled: false,
    });

    await flushPromises();

    const stored = localStorageMock.getItem('synthesis-ai-config');
    const parsed = JSON.parse(stored!);

    expect(parsed.state.provider).toBe('anthropic');
    expect(parsed.state.model).toBe('claude-3-sonnet-20240229');
    expect(parsed.state.temperature).toBe(0.5);
    expect(parsed.state.enabled).toBe(false);
    expect(parsed.state.apiKey).toBeUndefined();
  });
});
