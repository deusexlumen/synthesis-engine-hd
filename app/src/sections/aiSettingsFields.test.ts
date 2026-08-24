/**
 * AI settings field dispatch.
 *
 * Regression guard: the temperature slider used to call setBaseUrl, which
 * wrote a number like 0.8 into the provider base URL — persisted, and enough
 * for isConfigured() to accept a custom provider pointing at "0.8" — while
 * the temperature itself never changed.
 */

import { describe, test, expect, vi } from 'vitest';
import { applyAISettingChange, type AIFieldSetters } from './aiSettingsFields';

function spySetters() {
  return {
    setProvider: vi.fn(),
    setApiKey: vi.fn(),
    setModel: vi.fn(),
    setTemperature: vi.fn(),
  } satisfies AIFieldSetters;
}

describe('applyAISettingChange', () => {
  test('temperature updates the temperature, as a number', () => {
    const setters = spySetters();
    applyAISettingChange(setters, 'temperature', 0.8);

    expect(setters.setTemperature).toHaveBeenCalledWith(0.8);
    expect(typeof setters.setTemperature.mock.calls[0][0]).toBe('number');
  });

  test('temperature touches no other field', () => {
    const setters = spySetters();
    applyAISettingChange(setters, 'temperature', 0.8);

    expect(setters.setProvider).not.toHaveBeenCalled();
    expect(setters.setApiKey).not.toHaveBeenCalled();
    expect(setters.setModel).not.toHaveBeenCalled();
  });

  test('provider updates the provider', () => {
    const setters = spySetters();
    applyAISettingChange(setters, 'provider', 'anthropic');

    expect(setters.setProvider).toHaveBeenCalledWith('anthropic');
    expect(setters.setTemperature).not.toHaveBeenCalled();
  });

  test('apiKey updates the key', () => {
    const setters = spySetters();
    applyAISettingChange(setters, 'apiKey', 'sk-test');

    expect(setters.setApiKey).toHaveBeenCalledWith('sk-test');
  });

  test('model updates the model', () => {
    const setters = spySetters();
    applyAISettingChange(setters, 'model', 'gpt-4o');

    expect(setters.setModel).toHaveBeenCalledWith('gpt-4o');
  });
});
