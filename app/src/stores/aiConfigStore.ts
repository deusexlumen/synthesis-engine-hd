import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'custom' | 'disabled';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  enabled: boolean;
}

interface AIConfigState extends AIConfig {
  setProvider: (provider: AIProvider) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;
  isConfigured: () => boolean;
}

const defaultModels: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-pro',
  custom: '',
  disabled: '',
};

const initialState: AIConfig = {
  provider: 'disabled',
  apiKey: '',
  model: '',
  baseUrl: '',
  enabled: false,
};

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProvider: (provider) => {
        const model = defaultModels[provider] || '';
        set({ provider, model, enabled: provider !== 'disabled' });
      },

      setApiKey: (apiKey) => set({ apiKey }),

      setModel: (model) => set({ model }),

      setBaseUrl: (baseUrl) => set({ baseUrl }),

      setEnabled: (enabled) => set({ enabled }),

      reset: () => set(initialState),

      isConfigured: () => {
        const state = get();
        if (state.provider === 'disabled') return false;
        if (!state.apiKey || state.apiKey.length < 10) return false;
        if (state.provider === 'custom' && !state.baseUrl) return false;
        return true;
      },
    }),
    {
      name: 'synthesis-ai-config',
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        model: state.model,
        baseUrl: state.baseUrl,
        enabled: state.enabled,
      }),
    }
  )
);

// Available models per provider
export const providerModels: Record<AIProvider, { value: string; label: string; description?: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Beste Qualität, höhere Kosten' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Gute Balance aus Qualität und Kosten' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Schnell und günstig' },
  ],
  anthropic: [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'Höchste Qualität' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', description: 'Gute Balance' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Schnell und günstig' },
  ],
  google: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Googles bestes Modell' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Schnell und effizient' },
    { value: 'gemini-pro', label: 'Gemini Pro', description: 'Standard-Modell' },
  ],
  custom: [
    { value: 'custom', label: 'Benutzerdefiniert', description: 'Eigenes Modell angeben' },
  ],
  disabled: [
    { value: '', label: 'KI deaktiviert', description: 'Nur lokale Berechnungen' },
  ],
};

// Provider info
export const providerInfo: Record<AIProvider, { name: string; description: string; docsUrl: string }> = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o Mini, GPT-3.5 Turbo',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude 3 Opus, Sonnet, Haiku',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    name: 'Google AI',
    description: 'Gemini 1.5 Pro, Flash',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  custom: {
    name: 'Benutzerdefiniert',
    description: 'OpenAI-kompatible API (z.B. OpenRouter, Together AI)',
    docsUrl: '',
  },
  disabled: {
    name: 'Deaktiviert',
    description: 'Keine KI-Features',
    docsUrl: '',
  },
};
