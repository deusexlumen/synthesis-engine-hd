import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, APIError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requireTier } from '../middleware/auth';
import { callAIProvider, proxyRequestSchema } from '../services/aiProvider';

const router: Router = Router();

// Proxy AI request (for users who don't want to call APIs directly from frontend)
router.post('/proxy', authenticate, requireTier(['PREMIUM', 'PRO']), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = proxyRequestSchema.parse(req.body);

  // Get user's API key from request header (frontend sends it)
  const userApiKey = req.headers['x-ai-api-key'] as string;

  if (!userApiKey) {
    return res.status(400).json({ error: 'API key required in X-AI-API-Key header' });
  }

  try {
    const response = await callAIProvider(userApiKey, data);
    res.json(response);
  } catch (error: any) {
    // Preserve APIError's status/code (e.g. the SSRF check's 400) instead
    // of flattening every failure into a 500 "AI provider error".
    if (error instanceof APIError) {
      throw error;
    }
    console.error('AI proxy error:', error);
    throw new APIError(`AI provider error: ${error.message}`, 502, 'AI_PROVIDER_ERROR');
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
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', description: 'Höchste Qualität' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', description: 'Gute Balance' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Schnell und günstig' },
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
    'claude-opus-4-8': { input: 0.005, output: 0.025 },
    'claude-sonnet-5': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5': { input: 0.001, output: 0.005 },
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

export { router as aiRouter };
