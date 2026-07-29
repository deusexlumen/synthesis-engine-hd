import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIConfigStore, providerModels, providerInfo, type AIProvider } from '@/stores/aiConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Brain, 
  Key, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff,
  RefreshCw,
  Sparkles,
  Shield,
  Wallet,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export function AISettings() {
  const { 
    provider, 
    apiKey, 
    model, 
    baseUrl, 
    setProvider, 
    setApiKey, 
    setModel, 
    setBaseUrl,
    reset,
    isConfigured,
  } = useAIConfigStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleTestConnection = async () => {
    if (!isConfigured()) {
      toast.error('Bitte konfiguriere zuerst einen gültigen API-Key');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testAIConnection({
        provider,
        apiKey,
        model,
        baseUrl,
      });

      if (result.success) {
        setTestResult('success');
        toast.success('Verbindung erfolgreich! KI ist bereit.');
      } else {
        setTestResult('error');
        toast.error(`Verbindungsfehler: ${result.error}`);
      }
    } catch {
      setTestResult('error');
      toast.error('Verbindungstest fehlgeschlagen');
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    setShowResetDialog(false);
    reset();
    toast.info('KI-Einstellungen zurückgesetzt');
  };

  return (
    <div className="space-y-6">
      {/* Provider Selection Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass rounded-3xl overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-medium">KI-Provider</CardTitle>
                <p className="text-white/50 text-sm">Wähle deinen bevorzugten KI-Dienst</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
              <SelectTrigger className="bg-white/[0.03] border-white/10 rounded-xl h-12">
                <SelectValue placeholder="Wähle einen Provider" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-xl">
                <SelectItem value="openai" className="rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">OpenAI</p>
                      <p className="text-xs text-white/40">GPT-4o, GPT-4o Mini, GPT-3.5</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="anthropic" className="rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium">Anthropic</p>
                      <p className="text-xs text-white/40">Claude 3 Opus, Sonnet, Haiku</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="google" className="rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Google AI</p>
                      <p className="text-xs text-white/40">Gemini 1.5 Pro, Flash</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="custom" className="rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">Benutzerdefiniert</p>
                      <p className="text-xs text-white/40">OpenAI-kompatible API</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="disabled" className="rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-white/40" />
                    </div>
                    <div>
                      <p className="font-medium">Deaktiviert</p>
                      <p className="text-xs text-white/40">Nur lokale Berechnungen</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <AnimatePresence>
              {provider !== 'disabled' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6"
                >
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-white/70">Modell</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="bg-white/[0.03] border-white/10 rounded-xl h-12">
                        <SelectValue placeholder="Wähle ein Modell" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a0a] border-white/10 rounded-xl">
                        {providerModels[provider]?.map((m) => (
                          <SelectItem key={m.value} value={m.value} className="rounded-lg">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{m.label}</span>
                              {m.description && (
                                <span className="text-xs text-white/40">{m.description}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Base URL */}
                  <AnimatePresence>
                    {provider === 'custom' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <Label className="text-white/70">Base URL</Label>
                        <Input
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder="https://api.openrouter.ai/v1"
                          className="bg-white/[0.03] border-white/10 rounded-xl h-12"
                        />
                        <p className="text-xs text-white/40">
                          Die Base URL für OpenAI-kompatible APIs
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label className="text-white/70 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      API-Key
                    </Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider === 'openai' ? 'sk-...' : 'Dein API-Key'}
                        className="bg-white/[0.03] border-white/10 rounded-xl h-12 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {providerInfo[provider as AIProvider]?.docsUrl && (
                      <a 
                        href={providerInfo[provider as AIProvider].docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        API-Key erstellen
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Test Connection */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleTestConnection}
                      disabled={!isConfigured() || isTesting}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-30 h-12 rounded-xl"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Teste Verbindung...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Verbindung testen
                        </>
                      )}
                    </Button>
                    <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="border-white/10 hover:bg-white/5 h-12 rounded-xl px-4"
                        >
                          Zurücksetzen
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#0a0a0a] border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle>KI-Einstellungen zurücksetzen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Möchtest du wirklich alle KI-Einstellungen zurücksetzen? Dein API-Key und alle Konfigurationen werden gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleReset}
                            className="bg-red-500 hover:bg-red-600 text-white"
                          >
                            Zurücksetzen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Test Result */}
                  <AnimatePresence>
                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Alert className={`rounded-xl border-0 ${
                          testResult === 'success' 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          <AlertDescription className="flex items-center gap-2">
                            {testResult === 'success' ? (
                              <>
                                <Check className="w-4 h-4" />
                                Verbindung erfolgreich! KI ist bereit.
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4" />
                                Verbindung fehlgeschlagen. Überprüfe deinen API-Key.
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { 
            icon: Lock, 
            title: 'Nur diese Sitzung', 
            desc: 'Dein API-Key wird nur im Speicher dieser Browser-Sitzung gehalten und beim Neuladen verworfen.' 
          },
          { 
            icon: Shield, 
            title: 'Direkte Verbindung', 
            desc: 'Anfragen gehen direkt an den Provider. Keine Zwischenserver.' 
          },
          { 
            icon: Wallet, 
            title: 'Kostenkontrolle', 
            desc: 'Du behältst volle Kontrolle über deine KI-Kosten.' 
          },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (i + 1) }}
          >
            <Card className="glass rounded-2xl h-full">
              <CardContent className="p-5">
                <item.icon className="w-5 h-5 text-purple-400 mb-3" />
                <h4 className="font-medium text-sm mb-1">{item.title}</h4>
                <p className="text-white/40 text-xs leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Disabled State */}
      {provider === 'disabled' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Alert className="rounded-xl bg-white/[0.03] border-white/10">
            <AlertDescription className="text-white/50">
              KI-Features sind deaktiviert. Die App funktioniert mit lokalen Berechnungen, 
              aber ohne personalisierte KI-Synthese und Coaching-Impulse.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    </div>
  );
}

// Test AI connection
async function testAIConnection(config: {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, unknown>;

    switch (config.provider) {
      case 'openai':
        url = 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        };
        body = {
          model: config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        };
        break;

      case 'anthropic':
        url = 'https://api.anthropic.com/v1/messages';
        headers = {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        };
        body = {
          model: config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        };
        break;

      case 'google':
        url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = { contents: [{ parts: [{ text: 'Hello' }] }] };
        break;

      case 'custom':
        if (!config.baseUrl) {
          return { success: false, error: 'Base URL required for custom provider' };
        }
        url = `${config.baseUrl}/chat/completions`;
        headers = {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        };
        body = {
          model: config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        };
        break;

      default:
        return { success: false, error: 'Unknown provider' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false, error: `API Error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
