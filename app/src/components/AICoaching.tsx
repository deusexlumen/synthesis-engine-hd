import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIConfigStore } from '@/stores/aiConfigStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, MessageCircle, RefreshCw, Brain, Lock, ChevronRight, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
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
  const { provider, apiKey, model, baseUrl, isConfigured } = useAIConfigStore();
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);

  const handleGenerate = async (promptId: string) => {
    if (!isConfigured()) {
      toast.error('Bitte konfiguriere zuerst einen KI-Provider in den Einstellungen');
      return;
    }

    const accessToken = useAuthStore.getState().tokens?.accessToken;
    if (!accessToken) {
      toast.error('Bitte melde dich an, um das KI-Coaching über den Server-Proxy zu nutzen');
      return;
    }

    setSelectedPrompt(promptId);
    setIsGenerating(true);
    setGeneratedText(null);

    try {
      const prompt = buildPrompt(promptId, hdData, numerologyData);
      // Calls go through the backend proxy — the API key never leaves our
      // server towards the provider, and never directly from the browser.
      const result = await api.proxyAI({
        provider: provider as 'openai' | 'anthropic' | 'google' | 'custom',
        model,
        messages: [
          { role: 'system', content: 'Du bist ein weiser Begleiter für Human Design und Numerologie.' },
          { role: 'user', content: prompt },
        ],
        apiKey,
        baseUrl,
        accessToken,
        maxTokens: 500,
      });

      setGeneratedText(result || 'Keine Antwort erhalten');
    } catch (error) {
      toast.error('Fehler bei der KI-Generierung: ' + String(error));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isConfigured()) {
    return (
      <div className="glass rounded-3xl">
        <EmptyState
          title="KI-Coaching"
          description="Aktiviere KI-Coaching, indem du deinen eigenen API-Key in den Einstellungen hinzufügst."
          icon={<Lock className="w-8 h-8 text-white/30" />}
        />
        <div className="flex justify-center pb-8">
          <Button
            variant="outline"
            className="border-white/20 hover:bg-white/5"
            onClick={() => {/* Navigate to AI settings */}}
          >
            Zu den Einstellungen
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
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
            Anfragen laufen über den Synthesis-Server (Proxy) an {provider} — dein Key wird nicht gespeichert.
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

