import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import OpenAI from 'openai';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, requirePremium } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateSynthesisSchema = z.object({
  contextKey: z.string(),
  section: z.enum(['overview', 'career', 'relationships', 'spirituality', 'daily_transit']),
  hdData: z.object({
    energyType: z.string(),
    authority: z.string(),
    profile: z.string(),
    definedCenters: z.array(z.string()),
  }),
  numerologyData: z.object({
    lifePathString: z.string(),
    destinyNumber: z.number(),
    hasMasterNumber: z.boolean(),
  }),
  transitData: z.object({
    sunGate: z.number().optional(),
    moonGate: z.number().optional(),
  }).optional(),
});

// Generate or retrieve cached synthesis
router.post('/generate', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = generateSynthesisSchema.parse(req.body);
  const userId = req.user!.id;

  // Check cache first
  const cached = await prisma.synthesisCache.findUnique({
    where: {
      userId_contextKey_section: {
        userId,
        contextKey: data.contextKey,
        section: data.section,
      },
    },
  });

  if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
    return res.json({
      text: cached.generatedText,
      cached: true,
      generatedAt: cached.createdAt,
    });
  }

  // Generate new synthesis with OpenAI
  const prompt = buildSynthesisPrompt(data);
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Use mini for cost efficiency
    messages: [
      {
        role: 'system',
        content: `Du bist ein weiser, sokratischer Begleiter in der Tradition von Dan Millman. 
        Du kombinierst Human Design, Gene Keys und Numerologie zu einer holistischen Perspektive.
        
        WICHTIGE REGELN:
        - Formuliere NIEMALS absolute Wahrheiten ("Du bist so und so")
        - Verwende reflektierende, einladende Sprache ("Menschen mit dieser Konstellation erfahren oft...")
        - Stelle nachdenkliche Fragen ("Wie zeigt sich das aktuell bei dir?")
        - Sei ermutigend aber nicht belehrend
        - Fokussiere auf Potenziale statt Limitationen`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  const generatedText = completion.choices[0].message.content || '';

  // Cache the result
  await prisma.synthesisCache.upsert({
    where: {
      userId_contextKey_section: {
        userId,
        contextKey: data.contextKey,
        section: data.section,
      },
    },
    update: {
      generatedText,
      updatedAt: new Date(),
    },
    create: {
      userId,
      contextKey: data.contextKey,
      section: data.section,
      generatedText,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  res.json({
    text: generatedText,
    cached: false,
    generatedAt: new Date(),
  });
}));

// Get cached synthesis
router.get('/cache/:contextKey', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { contextKey } = req.params;
  const { section = 'overview' } = req.query;
  const userId = req.user!.id;

  const cached = await prisma.synthesisCache.findUnique({
    where: {
      userId_contextKey_section: {
        userId,
        contextKey,
        section: section as string,
      },
    },
  });

  if (!cached) {
    return res.status(404).json({ error: 'Cache not found' });
  }

  res.json({
    text: cached.generatedText,
    generatedAt: cached.createdAt,
    expiresAt: cached.expiresAt,
  });
}));

// Build synthesis prompt
function buildSynthesisPrompt(data: z.infer<typeof generateSynthesisSchema>): string {
  const { section, hdData, numerologyData, transitData } = data;
  
  let sectionPrompt = '';
  switch (section) {
    case 'overview':
      sectionPrompt = 'Gib einen allgemeinen Überblick über diese einzigartige Kombination.';
      break;
    case 'career':
      sectionPrompt = 'Fokussiere auf berufliche Potenziale und Arbeitsstil.';
      break;
    case 'relationships':
      sectionPrompt = 'Beschreibe Beziehungsdynamiken und Kommunikationsstil.';
      break;
    case 'spirituality':
      sectionPrompt = 'Gehe auf spirituelles Wachstum und innere Entwicklung ein.';
      break;
    case 'daily_transit':
      sectionPrompt = 'Verbinde die aktuellen Transite mit dem persönlichen Profil für einen täglichen Impuls.';
      break;
  }

  return `
Kontext: Synthese von Human Design und Numerologie

Human Design Profil:
- Energie-Typ: ${hdData.energyType}
- Autorität: ${hdData.authority}
- Profil: ${hdData.profile}
- Definierte Zentren: ${hdData.definedCenters.join(', ')}

Numerologie Profil:
- Lebensweg: ${numerologyData.lifePathString}
- Schicksalszahl: ${numerologyData.destinyNumber}
- ${numerologyData.hasMasterNumber ? 'Enthält Meisterzahl' : ''}

${transitData ? `
Aktuelle Transite:
- Sonne in Tor: ${transitData.sunGate || 'N/A'}
- Mond in Tor: ${transitData.moonGate || 'N/A'}
` : ''}

Aufgabe: ${sectionPrompt}

Antworte in 2-3 Absätzen mit reflektierender, sokratischer Sprache.
  `.trim();
}

export { router as synthesisRouter };
