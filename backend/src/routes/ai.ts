import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requireTier } from '../middleware/auth';

const router: Router = Router();

// Proxy AI requests (optional - users can also call APIs directly)
const proxyRequestSchema = z.object({
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

// Proxy AI request (for users who don't want to call APIs directly from frontend)
router.post('/proxy', authenticate, requireTier(['PREMIUM', 'PRO']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = proxyRequestSchema.parse(req.body);
  
  // Get user's API key from request header (frontend sends it)
  const userApiKey = req.headers['x-ai-api-key'] as string;
  
  if (!userApiKey) {
    return res.status(400).json({ error: 'API key required in X-AI-API-Key header' });
  }

  let response;
  
  try {
    switch (data.provider) {
      case 'openai':
        response = await callOpenAI(userApiKey, data);
        break;
      case 'anthropic':
        response = await callAnthropic(userApiKey, data);
        break;
      case 'google':
        response = await callGoogle(userApiKey, data);
        break;
      case 'custom':
        if (!data.baseUrl) {
          return res.status(400).json({ error: 'Base URL required for custom provider' });
        }
        // SSRF protection: validate custom baseUrl
        try {
          const url = new URL(data.baseUrl);
          const hostname = url.hostname.toLowerCase();
          // Block private IPs and internal metadata endpoints
          const blockedPatterns = [
            /^localhost$/,
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,
            /^0\./,
            /^::1$/,
            /^fc00:/i,
            /^fe80:/i,
            /\.internal$/,
            /\.local$/,
            /metadata\.google\.internal$/,
            /169\.254\.169\.254/,
          ];
          if (blockedPatterns.some(pattern => pattern.test(hostname))) {
            return res.status(400).json({ error: 'Custom base URL points to a blocked/internal address' });
          }
          // Only allow http/https
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: 'Custom base URL must use HTTP or HTTPS' });
          }
        } catch {
          return res.status(400).json({ error: 'Invalid custom base URL' });
        }
        response = await callCustom(userApiKey, data);
        break;
      default:
        return res.status(400).json({ error: 'Unknown provider' });
    }

    res.json(response);
  } catch (error: any) {
    console.error('AI proxy error:', error);
    throw new Error(`AI provider error: ${error.message}`);
  }
}));

// Get available models for each provider
router.get('/models', authenticate, asyncHandler(async (req, res) => {
  const models = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Beste Qualität' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Gute Balance' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Schnell und günstig' },
    ],
    anthropic: [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Höchste Qualität' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Gute Balance' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Schnell und günstig' },
    ],
    google: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Googles bestes Modell' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Schnell und effizient' },
      { id: 'gemini-pro', name: 'Gemini Pro', description: 'Standard-Modell' },
    ],
  };

  res.json(models);
}));

// Estimate cost for a request
router.post('/estimate-cost', authenticate, asyncHandler(async (req, res) => {
  const { provider, model, estimatedTokens } = z.object({
    provider: z.enum(['openai', 'anthropic', 'google']),
    model: z.string(),
    estimatedTokens: z.number().min(1),
  }).parse(req.body);

  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 }, // per 1K tokens
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
    'gemini-1.5-flash': { input: 0.00035, output: 0.00105 },
    'gemini-pro': { input: 0.0005, output: 0.0015 },
  };

  const modelPricing = pricing[model];
  if (!modelPricing) {
    return res.status(400).json({ error: 'Unknown model' });
  }

  // Estimate: 70% input, 30% output
  const inputTokens = Math.floor(estimatedTokens * 0.7);
  const outputTokens = Math.floor(estimatedTokens * 0.3);
  
  const cost = (inputTokens / 1000) * modelPricing.input + 
               (outputTokens / 1000) * modelPricing.output;

  res.json({
    estimatedCost: cost,
    currency: 'USD',
    breakdown: {
      inputTokens,
      outputTokens,
      inputCost: (inputTokens / 1000) * modelPricing.input,
      outputCost: (outputTokens / 1000) * modelPricing.output,
    },
  });
}));

// Helper functions for calling AI providers
async function callOpenAI(apiKey: string, data: any) {
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

async function callAnthropic(apiKey: string, data: any) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
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
    throw new Error(`Anthropic error: ${error}`);
  }

  return await response.json();
}

async function callGoogle(apiKey: string, data: any) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent?key=${apiKey}`;
  
  // Convert OpenAI-style messages to Google format
  const contents = data.messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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

async function callCustom(apiKey: string, data: any) {
  const response = await fetch(`${data.baseUrl}/chat/completions`, {
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
    throw new Error(`Custom provider error: ${error}`);
  }

  return await response.json();
}

export { router as aiRouter };
