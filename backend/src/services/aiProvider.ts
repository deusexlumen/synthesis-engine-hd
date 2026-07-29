/**
 * AI Provider Service
 *
 * Shared server-side calls to OpenAI / Anthropic / Google / custom
 * OpenAI-compatible endpoints. Used by the /api/ai/proxy route and by
 * server-side features (e.g. daily coaching) so provider quirks (Anthropic
 * system-message shape, Google response normalization) live in exactly one
 * place.
 */

import { z } from 'zod';
import { APIError } from '../middleware/errorHandler';
import { assertSafeOutboundUrl } from '../lib/ssrfGuard';

export const proxyRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'custom']),
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(4000).optional().default(800),
  baseUrl: z.string().optional(),
});

export type AIProxyRequest = z.infer<typeof proxyRequestSchema>;

/**
 * Call the given provider with the user's API key and return the raw
 * provider response (Google is normalized to the OpenAI shape).
 */
export async function callAIProvider(apiKey: string, data: AIProxyRequest): Promise<any> {
  switch (data.provider) {
    case 'openai':
      return callOpenAI(apiKey, data);
    case 'anthropic':
      return callAnthropic(apiKey, data);
    case 'google':
      return callGoogle(apiKey, data);
    case 'custom':
      if (!data.baseUrl) {
        throw new APIError('Base URL required for custom provider', 400, 'BASE_URL_REQUIRED');
      }
      await assertSafeOutboundUrl(data.baseUrl);
      return callCustom(apiKey, data);
    default:
      throw new APIError('Unknown provider', 400, 'UNKNOWN_PROVIDER');
  }
}

/**
 * Extract the assistant's text from a (normalized) provider response.
 */
export function extractAIText(provider: AIProxyRequest['provider'], response: any): string {
  if (provider === 'anthropic') {
    return response?.content?.[0]?.text ?? '';
  }
  // openai, custom and (normalized) google share the OpenAI shape
  return response?.choices?.[0]?.message?.content ?? '';
}

async function callOpenAI(apiKey: string, data: AIProxyRequest) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: data.model,
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }

  return await response.json();
}

async function callAnthropic(apiKey: string, data: AIProxyRequest) {
  // The Anthropic Messages API rejects role:"system" entries inside the
  // messages array — system instructions go in a separate top-level
  // `system` string. Sending them inline (as the OpenAI/Google shapes do)
  // returns a 400 on every request that includes one.
  const systemText = data.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversationMessages = data.messages.filter((m) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: data.model,
      ...(systemText ? { system: systemText } : {}),
      messages: conversationMessages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${error}`);
  }

  return await response.json();
}

async function callGoogle(apiKey: string, data: AIProxyRequest) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent?key=${apiKey}`;

  // Gemini has a dedicated systemInstruction field — mapping system
  // messages into `contents` as a 'user' turn works but confuses them with
  // actual user input, weakening instruction-following.
  const systemText = data.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = data.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
      generationConfig: {
        temperature: data.temperature,
        maxOutputTokens: data.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google error: ${error}`);
  }

  const result: any = await response.json();

  // Convert Google response to OpenAI-style format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: result.candidates?.[0]?.content?.parts?.[0]?.text || '',
      },
    }],
    usage: {
      prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
      completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: result.usageMetadata?.totalTokenCount || 0,
    },
  };
}

async function callCustom(apiKey: string, data: AIProxyRequest) {
  const response = await fetch(`${data.baseUrl}/chat/completions`, {
    method: 'POST',
    // The SSRF check validates data.baseUrl's resolved address, not
    // wherever a redirect might point — auto-following one would bypass
    // that check entirely. Manual mode also loses "follows to another
    // trusted URL" convenience for legitimate custom endpoints, but that's
    // the right trade for a base URL the user supplies at runtime.
    redirect: 'manual',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: data.model,
      messages: data.messages,
      temperature: data.temperature,
      max_tokens: data.maxTokens,
    }),
  });

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new APIError('Custom provider attempted to redirect — refusing to follow', 502, 'CUSTOM_PROVIDER_REDIRECT');
  }

  if (!response.ok) {
    const error = await response.text();
    throw new APIError(`Custom provider error: ${error}`, 502, 'CUSTOM_PROVIDER_ERROR');
  }

  return await response.json();
}
