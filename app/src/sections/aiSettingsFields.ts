import type { AIProvider } from '@/stores/aiConfigStore';

/**
 * The setters the AI settings form is allowed to drive.
 *
 * setBaseUrl is deliberately absent: base URL is edited through its own input
 * in AISettings, and leaving it out of this contract makes it a type error to
 * wire another field to it by accident.
 */
export interface AIFieldSetters {
  setProvider: (provider: AIProvider) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setTemperature: (temperature: number) => void;
}

export type AIField = 'provider' | 'apiKey' | 'model' | 'temperature';

export function applyAISettingChange(
  setters: AIFieldSetters,
  field: AIField,
  value: unknown
): void {
  switch (field) {
    case 'provider':
      setters.setProvider(value as AIProvider);
      break;
    case 'apiKey':
      setters.setApiKey(value as string);
      break;
    case 'model':
      setters.setModel(value as string);
      break;
    case 'temperature':
      setters.setTemperature(value as number);
      break;
  }
}
