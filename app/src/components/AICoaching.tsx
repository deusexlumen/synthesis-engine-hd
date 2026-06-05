import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIConfigStore } from '@/stores/aiConfigStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, MessageCircle, RefreshCw, Brain, Lock, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AICoachingProps {
  hdData: {
    energyType: string;
    authority: string;
    profile: string;
    definedCenters: string[];
    incarnationCross: string;
  };
  numerologyData: {
    lifePathString: string;
    destinyNumber: number;
    hasMasterNumber: boolean;
    personalYear: number;
  };
}

const coachingPrompts = [
  {
    id: 'daily',
    title: 'Täglicher Impuls',
    description: 'Ein kurzer, personalisierter Gedanke für heute',
    icon: Sparkles,
  },
  {
    id: 'career',
    title: 'Berufliche Orientierung',
    description: 'Wie dein Profil deine Karriere beeinflusst',
    icon: Brain,
  },
  {
    id: 'relationships',
    title: 'Beziehungen',
    description: 'Deine Beziehungsdynamik verstehen',
    icon: MessageCircle,
  },
  {
    id: 'decision',
    title: 'Entscheidungshilfe',
    description: 'Nutze deine Autorität für kluge Entscheidungen',
    icon: ChevronRight,
  },
];

export function AICoaching({ hdData, numerologyData }: AICoachingProps) {
  const { provider, apiKey, model, isConfigured } = useAIConfigStore();
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);

  const handleGenerate = async (promptId: string) => {
    if (!isConfigured()) {
      toast.error('Bitte konfiguriere zuerst einen KI-Provider in den Einstellungen');
      return;
    }

    setSelectedPrompt(promptId);
    setIsGenerating(true);
    setGeneratedText(null);

    try {
      const prompt = buildPrompt(promptId, hdData, numerologyData);
      const result = await callAI(provider, apiKey, model, prompt);
      
      setGeneratedText(result);
    } catch (error) {
      toast.error('Fehler bei der KI-Generierung: ' + String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isConfigured()) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-8 text-center"
      >
        <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-white/30" />
        </div>
        <h3 className="text-xl font-serif font-medium mb-2">KI-Coaching</h3>
        <p className="text-white/50 mb-6 max-w-sm mx-auto">
          Aktiviere KI-Coaching, indem du deinen eigenen API-Key in den Einstellungen hinzufügst.
        </p>
        <Button 
          variant="outline" 
          className="border-white/20 hover:bg-white/5"
          onClick={() => {/* Navigate to AI settings */}}
        >
          Zu den Einstellungen
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generated Content */}
      <AnimatePresence mode="wait">
        {generatedText && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass rounded-3xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {coachingPrompts.find(p => p.id === selectedPrompt)?.title}
                      </p>
                      <p className="text-white/40 text-sm">KI-generiert</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGeneratedText(null)}
                    className="text-white/40 hover:text-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                    {generatedText}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt Selection */}
      {!generatedText && (
        <motion.div
          key="prompts"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid sm:grid-cols-2 gap-4"
        >
          {coachingPrompts.map((prompt, index) => (
            <motion.div
              key={prompt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => handleGenerate(prompt.id)}
                disabled={isGenerating}
                className="w-full glass rounded-2xl p-5 text-left transition-all hover:bg-white/[0.05] disabled:opacity-50 group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    {isGenerating && selectedPrompt === prompt.id ? (
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                    ) : (
                      <prompt.icon className="w-6 h-6 text-white/50 group-hover:text-purple-400 transition-colors" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">{prompt.title}</h4>
                    <p className="text-white/40 text-sm">{prompt.description}</p>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-purple-400" />
          <p className="text-white/50 text-sm">
            KI-Coaching nutzt deinen eigenen API-Key. 
            Deine Daten werden direkt an {provider} gesendet.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function buildPrompt(
  promptId: string,
  hdData: AICoachingProps['hdData'],
  numerologyData: AICoachingProps['numerologyData']
): string {
  const baseContext = `
Du bist ein weiser, sokratischer Begleiter in der Tradition von Dan Millman.
Du kombinierst Human Design und Numerologie zu einer holistischen Perspektive.

WICHTIGE REGELN:
- Formuliere NIEMALS absolute Wahrheiten ("Du bist so und so")
- Verwende reflektierende, einladende Sprache ("Menschen mit dieser Konstellation erfahren oft...")
- Stelle nachdenkliche Fragen ("Wie zeigt sich das aktuell bei dir?")
- Sei ermutigend aber nicht belehrend
- Fokussiere auf Potenziale statt Limitationen

PROFIL DES NUTZERS:
- Human Design Energie-Typ: ${hdData.energyType}
- Autorität: ${hdData.authority}
- Profil: ${hdData.profile}
- Inkarnationskreuz: ${hdData.incarnationCross}
- Definierte Zentren: ${hdData.definedCenters.join(', ')}
- Numerologie Lebenszahl: ${numerologyData.lifePathString}
- Schicksalszahl: ${numerologyData.destinyNumber}
- Persönliches Jahr: ${numerologyData.personalYear}
${numerologyData.hasMasterNumber ? '- Enthält Meisterzahl' : ''}
`;

  const prompts: Record<string, string> = {
    daily: `${baseContext}

AUFGABE: Schreibe einen kurzen, inspirierenden Tagesimpuls (3-4 Sätze) für diese Person.
Der Impuls soll:
- Auf ihre einzigartige Kombination aus HD und Numerologie eingehen
- Einen praktischen Gedanken für den Tag bieten
- Reflektierend und ermutigend sein
- Mit einer offenen Frage enden`,

    career: `${baseContext}

AUFGABE: Gib berufliche Orientierung (2-3 Absätze) basierend auf diesem Profil.
Gehe ein auf:
- Welche Arbeitsumgebungen passen gut
- Wie sie Entscheidungen treffen sollten
- Potenzielle Stärken im Beruf
- Tipps für berufliche Erfüllung`,

    relationships: `${baseContext}

AUFGABE: Beschreibe die Beziehungsdynamik (2-3 Absätze) dieses Profils.
Gehe ein auf:
- Kommunikationsstil
- Bedürfnisse in Beziehungen
- Wie sie mit anderen am besten interagieren
- Potenzielle Herausforderungen und Chancen`,

    decision: `${baseContext}

AUFGABE: Erkläre, wie diese Person mit ihrer Autorität "${hdData.authority}" zuverlässige Entscheidungen trifft (2-3 Absätze).
Gebe konkrete, anwendbare Tipps.`,
  };

  return prompts[promptId] || prompts.daily;
}

async function callAI(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;

  switch (provider) {
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      body = {
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du bist ein weiser Begleiter für Human Design und Numerologie.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      };
      break;

    case 'anthropic':
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      body = {
        model: model || 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      };
      break;

    case 'google':
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      };
      break;

    default:
      throw new Error('Unknown provider');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  
  if (provider === 'openai') {
    return data.choices[0].message.content;
  } else if (provider === 'anthropic') {
    return data.content[0].text;
  } else if (provider === 'google') {
    return data.candidates[0].content.parts[0].text;
  }
  
  return 'Keine Antwort erhalten';
}
