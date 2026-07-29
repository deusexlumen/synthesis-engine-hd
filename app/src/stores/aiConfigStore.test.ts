import { describe, it, expect, beforeEach } from 'vitest';
import { useAIConfigStore } from './aiConfigStore';

// happy-dom provides a real localStorage; zustand persist captures
// window.localStorage eagerly at store creation, so replacing the global
// afterwards would not intercept writes — assert against the real one.
describe('aiConfigStore security', () => {
  beforeEach(() => {
    localStorage.clear();
    useAIConfigStore.setState({
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
      baseUrl: '',
      temperature: 0.7,
      enabled: true,
    });
  });

  it('must NOT persist apiKey to localStorage', () => {
    useAIConfigStore.setState({
      apiKey: 'sk-test-secret-key-12345',
      provider: 'openai',
      model: 'gpt-4o',
    });

    const stored = localStorage.getItem('synthesis-ai-config');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);

    // CRITICAL: apiKey must NEVER be in localStorage
    expect(parsed.state.apiKey).toBeUndefined();

    // Other settings ARE persisted
    expect(parsed.state.provider).toBe('openai');
    expect(parsed.state.model).toBe('gpt-4o');
    expect(parsed.state.temperature).toBe(0.7);
  });

  it('must persist provider, model and settings without apiKey', () => {
    useAIConfigStore.setState({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      temperature: 0.5,
      enabled: false,
    });

    const stored = localStorage.getItem('synthesis-ai-config');
    const parsed = JSON.parse(stored!);

    expect(parsed.state.provider).toBe('anthropic');
    expect(parsed.state.model).toBe('claude-sonnet-5');
    expect(parsed.state.temperature).toBe(0.5);
    expect(parsed.state.enabled).toBe(false);
    expect(parsed.state.apiKey).toBeUndefined();
  });
});
