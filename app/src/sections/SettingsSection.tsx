import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Bell, Shield, Palette, Globe, Database,
  ChevronRight, Moon, Sun, Monitor, Trash2,
  Download, Upload, Lock, Eye, EyeOff, Check,
  AlertTriangle, RefreshCw, Save
} from 'lucide-react';
import { useAIConfigStore, providerModels } from '@/stores/aiConfigStore';
import { useAppStore } from '@/stores/appStore';
import type { UserProfile, AppSettings } from '@/types/humanDesign';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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

type SettingsTab = 'profile' | 'appearance' | 'notifications' | 'privacy' | 'ai' | 'data';

export function SettingsSection(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const appStore = useAppStore();
  // Initialize once from the global Zustand store (single source of truth).
  const [profile, setProfileState] = useState<UserProfile>(() => appStore.profile ?? {
    fullName: '',
    email: '',
    birthDate: '',
    birthTime: '',
    birthLocation: '',
  });
  const [settings, setSettingsState] = useState<AppSettings>(() => appStore.settings ?? {
    theme: 'dark',
    language: 'de',
    notifications: true,
    dailyReminder: false,
    reminderTime: '09:00',
    transitAlerts: true,
    hapticFeedback: true,
    analytics: false,
  });
  const aiConfig = useAIConfigStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const saveSettings = () => {
    // Persist to global Zustand store (single source of truth)
    appStore.setProfile(profile);
    appStore.setSettings(settings);
    // AI settings are persisted via Zustand store automatically

    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setProfileState(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSettingChange = (field: keyof AppSettings, value: unknown) => {
    setSettingsState(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAIChange = (field: 'provider' | 'apiKey' | 'model' | 'temperature', value: unknown) => {
    switch (field) {
      case 'provider':
        aiConfig.setProvider(value as 'openai' | 'anthropic' | 'google' | 'custom' | 'disabled');
        break;
      case 'apiKey':
        aiConfig.setApiKey(value as string);
        break;
      case 'model':
        aiConfig.setModel(value as string);
        break;
      case 'temperature':
        aiConfig.setBaseUrl(value as string); // Temperature is not in store, using baseUrl as placeholder
        break;
    }
    setHasChanges(true);
  };

  const clearAllData = async () => {
    setShowClearDialog(false);
    // Clear global stores
    appStore.setProfile(null);
    appStore.setSettings(null);
    localStorage.removeItem('synthesis_journal_entries');
    window.location.reload();
  };

  const exportData = () => {
    const data = {
      profile,
      settings,
      aiSettings: {
        provider: aiConfig.provider,
        // API keys are never exported — a backup file must not leak credentials.
        model: aiConfig.model,
        temperature: aiConfig.temperature,
      },
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthesis-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.profile) setProfileState(data.profile);
        if (data.settings) setSettingsState(data.settings);
        if (data.aiSettings) {
          const imported = data.aiSettings as { provider?: string; apiKey?: string; model?: string; temperature?: number };
          if (imported.provider) {
            const mappedProvider = imported.provider === 'local' ? 'custom' : imported.provider;
            aiConfig.setProvider(mappedProvider as 'openai' | 'anthropic' | 'google' | 'custom' | 'disabled');
          }
          if (imported.apiKey) aiConfig.setApiKey(imported.apiKey);
          if (imported.model) aiConfig.setModel(imported.model);
          if (typeof imported.temperature === 'number') aiConfig.setTemperature(imported.temperature);
        }
        setHasChanges(true);
        appStore.setProfile(data.profile || null);
        appStore.setSettings(data.settings || null);
      } catch (error) {
        console.error('Import fehlgeschlagen', error);
      }
    };
    reader.readAsText(file);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'appearance', label: 'Erscheinungsbild', icon: Palette },
    { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
    { id: 'ai', label: 'KI-Einstellungen', icon: Globe },
    { id: 'privacy', label: 'Datenschutz', icon: Shield },
    { id: 'data', label: 'Daten', icon: Database },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold mb-2">Einstellungen</h2>
        <p className="text-slate-400">Passe deine App-Erfahrung an</p>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-64 flex-shrink-0"
        >
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full justify-start flex items-center gap-3 px-4 py-3 h-auto rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-violet-500 text-white hover:bg-violet-500 hover:text-white'
                      : 'hover:bg-white/5 text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </Button>
              );
            })}
          </nav>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1"
        >
          <div className="bg-slate-900/50 rounded-2xl border border-white/10 p-6">
            <AnimatePresence mode="wait">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-medium mb-4">Profil</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">Vollständiger Name</Label>
                      <Input
                        type="text"
                        value={profile.fullName}
                        onChange={(e) => handleProfileChange('fullName', e.target.value)}
                        className="mt-2 bg-white/5 border-white/10"
                        placeholder="Dein Name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">E-Mail</Label>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleProfileChange('email', e.target.value)}
                        className="mt-2 bg-white/5 border-white/10"
                        placeholder="email@beispiel.de"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">Geburtsdatum</Label>
                      <Input
                        type="date"
                        value={profile.birthDate}
                        onChange={(e) => handleProfileChange('birthDate', e.target.value)}
                        className="mt-2 bg-white/5 border-white/10"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Geburtszeit</Label>
                      <Input
                        type="time"
                        value={profile.birthTime}
                        onChange={(e) => handleProfileChange('birthTime', e.target.value)}
                        className="mt-2 bg-white/5 border-white/10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400">Geburtsort</Label>
                    <Input
                      type="text"
                      value={profile.birthLocation}
                      onChange={(e) => handleProfileChange('birthLocation', e.target.value)}
                      className="mt-2 bg-white/5 border-white/10"
                      placeholder="Stadt, Land"
                    />
                  </div>
                </motion.div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-medium mb-4">Erscheinungsbild</h3>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', label: 'Hell', icon: Sun },
                        { id: 'dark', label: 'Dunkel', icon: Moon },
                        { id: 'system', label: 'System', icon: Monitor },
                      ].map((theme) => {
                        const Icon = theme.icon;
                        return (
                          <Button
                            key={theme.id}
                            variant="ghost"
                            onClick={() => handleSettingChange('theme', theme.id)}
                            className={`flex flex-col items-center gap-2 p-4 h-auto rounded-xl border transition-all ${
                              settings.theme === theme.id
                                ? 'border-violet-500 bg-violet-500/10 hover:bg-violet-500/10'
                                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                            }`}
                          >
                            <Icon className="w-6 h-6" />
                            <span className="text-sm">{theme.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400">Sprache</Label>
                    <Select
                      value={settings.language}
                      onValueChange={(val) => handleSettingChange('language', val)}
                    >
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium">Haptisches Feedback</p>
                        <p className="text-sm text-slate-400">Vibration bei Interaktionen</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.hapticFeedback}
                      onCheckedChange={(val) => handleSettingChange('hapticFeedback', val)}
                    />
                  </div>
                </motion.div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-medium mb-4">Benachrichtigungen</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-medium">Benachrichtigungen aktivieren</p>
                        <p className="text-sm text-slate-400">Alle App-Benachrichtigungen</p>
                      </div>
                      <Switch
                        checked={settings.notifications}
                        onCheckedChange={(val) => handleSettingChange('notifications', val)}
                      />
                    </div>

                    {settings.notifications && (
                      <>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div>
                            <p className="font-medium">Tägliche Erinnerung</p>
                            <p className="text-sm text-slate-400">Erinnere mich an mein Journal</p>
                          </div>
                          <Switch
                            checked={settings.dailyReminder}
                            onCheckedChange={(val) => handleSettingChange('dailyReminder', val)}
                          />
                        </div>

                        {settings.dailyReminder && (
                          <div className="p-4 bg-white/5 rounded-xl">
                            <Label className="text-sm text-slate-400">Erinnerungszeit</Label>
                            <Input
                              type="time"
                              value={settings.reminderTime}
                              onChange={(e) => handleSettingChange('reminderTime', e.target.value)}
                              className="mt-2 w-auto bg-white/10 border-white/10"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div>
                            <p className="font-medium">Transit-Alerts</p>
                            <p className="text-sm text-slate-400">Benachrichtige mich bei wichtigen Transits</p>
                          </div>
                          <Switch
                            checked={settings.transitAlerts}
                            onCheckedChange={(val) => handleSettingChange('transitAlerts', val)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* AI Settings Tab */}
              {activeTab === 'ai' && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-medium mb-4">KI-Einstellungen</h3>
                  
                  <div>
                    <Label className="text-sm text-slate-400">KI-Provider</Label>
                    <Select
                      value={aiConfig.provider === 'custom' ? 'local' : aiConfig.provider}
                      onValueChange={(val) => {
                        const mapped = val === 'local' ? 'custom' : val;
                        handleAIChange('provider', mapped);
                      }}
                    >
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                        <SelectItem value="google">Google Gemini</SelectItem>
                        <SelectItem value="local">Lokales Modell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {aiConfig.provider !== 'disabled' && aiConfig.provider !== 'custom' && (
                    <div>
                      <Label className="text-sm text-slate-400">API Key</Label>
                      <div className="relative mt-2">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={aiConfig.apiKey}
                          onChange={(e) => handleAIChange('apiKey', e.target.value)}
                          className="bg-white/5 border-white/10 pr-10"
                          placeholder="sk-..."
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white h-8 w-8"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Dein API Key wird nicht persistiert und geht beim Neuladen verloren.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm text-slate-400">Modell</Label>
                    <Select
                      value={aiConfig.model}
                      onValueChange={(val) => handleAIChange('model', val)}
                    >
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aiConfig.provider !== 'disabled' &&
                          providerModels[aiConfig.provider]
                            .filter((m) => m.value)
                            .map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400">
                      Kreativität (Temperature): {aiConfig.temperature}
                    </Label>
                    <Slider
                      value={[aiConfig.temperature]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={([val]) => handleAIChange('temperature', val)}
                      className="mt-3"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Präzise</span>
                      <span>Kreativ</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-medium mb-4">Datenschutz</h3>
                  
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Lock className="w-5 h-5 text-slate-300" />
                      <p className="font-medium text-slate-200">Lokale Speicherung</p>
                    </div>
                    <p className="text-sm text-slate-400">
                      Profil, Einstellungen und Journal-Einträge werden unverschlüsselt im lokalen
                      Speicher deines Browsers auf diesem Gerät gehalten und nicht an unsere Server
                      übertragen. Dein Human-Design-Chart wird zur Berechnung einmalig an unser Backend
                      gesendet; KI-Coaching-Anfragen gehen direkt an den von dir gewählten KI-Anbieter
                      mit deinem eigenen API-Key.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium">Anonyme Analyse</p>
                      <p className="text-sm text-slate-400">Hilf uns, die App zu verbessern</p>
                    </div>
                    <Switch
                      checked={settings.analytics}
                      onCheckedChange={(val) => handleSettingChange('analytics', val)}
                    />
                  </div>

                  <div className="p-4 border border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <p className="font-medium text-red-400">Gefahrenzone</p>
                    </div>
                    <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          Alle Daten löschen
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#0a0a0a] border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Alle Daten löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Dies löscht alle lokalen Daten unwiderruflich, inklusive Profil, Einstellungen und Journal-Einträge.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={clearAllData}
                            className="bg-red-500 hover:bg-red-600 text-white"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </motion.div>
              )}

              {/* Data Tab */}
              {activeTab === 'data' && (
                <motion.div
                  key="data"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-xl font-medium mb-4">Datenverwaltung</h3>
                  
                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Download className="w-5 h-5 text-violet-400" />
                      <div>
                        <p className="font-medium">Daten exportieren</p>
                        <p className="text-sm text-slate-400">Erstelle ein Backup deiner Daten</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={exportData}
                      className="bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-300"
                    >
                      Backup erstellen
                    </Button>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Upload className="w-5 h-5 text-violet-400" />
                      <div>
                        <p className="font-medium">Daten importieren</p>
                        <p className="text-sm text-slate-400">Stelle Daten aus einem Backup wieder her</p>
                      </div>
                    </div>
                    <label className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors cursor-pointer inline-block">
                      Backup laden
                      <Input
                        type="file"
                        accept=".json"
                        onChange={importData}
                        className="hidden"
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={saveSettings}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                hasChanges
                  ? 'bg-violet-500 hover:bg-violet-600 text-white'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-5 h-5" />
                  Gespeichert!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsSection;
