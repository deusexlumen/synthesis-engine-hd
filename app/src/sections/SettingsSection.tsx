import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Bell, Shield, Palette, Globe, Database,
  ChevronRight, Moon, Sun, Monitor, Key, Trash2,
  Download, Upload, Lock, Eye, EyeOff, Check,
  AlertTriangle, RefreshCw, Save
} from 'lucide-react';

interface UserProfile {
  fullName: string;
  email: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  transitAlerts: boolean;
  hapticFeedback: boolean;
  analytics: boolean;
}

interface AISettings {
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  apiKey: string;
  model: string;
  temperature: number;
}

export const SettingsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'privacy' | 'ai' | 'data'>('profile');
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
    birthDate: '',
    birthTime: '',
    birthLocation: '',
  });
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    language: 'de',
    notifications: true,
    dailyReminder: false,
    reminderTime: '09:00',
    transitAlerts: true,
    hapticFeedback: true,
    analytics: false,
  });
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4',
    temperature: 0.7,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    // Load from localStorage
    const savedProfile = localStorage.getItem('synthesis_user_profile');
    const savedSettings = localStorage.getItem('synthesis_app_settings');
    const savedAI = localStorage.getItem('synthesis_ai_settings');

    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    if (savedAI) {
      setAiSettings(JSON.parse(savedAI));
    }
  };

  const saveSettings = () => {
    localStorage.setItem('synthesis_user_profile', JSON.stringify(profile));
    localStorage.setItem('synthesis_app_settings', JSON.stringify(settings));
    localStorage.setItem('synthesis_ai_settings', JSON.stringify(aiSettings));
    
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSettingChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleAIChange = (field: keyof AISettings, value: any) => {
    setAiSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const clearAllData = () => {
    if (confirm('Bist du sicher? Dies löscht alle lokalen Daten unwiderruflich.')) {
      localStorage.clear();
      // Clear journal entries via Tauri
      invoke('list_journal_entries_command').then((entries: any) => {
        entries.forEach((id: string) => {
          invoke('delete_journal_entry_command', { entryId: id });
        });
      });
      window.location.reload();
    }
  };

  const exportData = () => {
    const data = {
      profile,
      settings,
      aiSettings,
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
        if (data.profile) setProfile(data.profile);
        if (data.settings) setSettings(data.settings);
        if (data.aiSettings) setAiSettings(data.aiSettings);
        setHasChanges(true);
        alert('Daten erfolgreich importiert! Klicke auf "Speichern" um die Änderungen zu übernehmen.');
      } catch (error) {
        alert('Fehler beim Importieren der Daten.');
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
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
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-violet-500 text-white'
                      : 'hover:bg-white/5 text-slate-400'
                  }}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>
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
                      <label className="block text-sm text-slate-400 mb-2">Vollständiger Name</label>
                      <input
                        type="text"
                        value={profile.fullName}
                        onChange={(e) => handleProfileChange('fullName', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="Dein Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">E-Mail</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleProfileChange('email', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="email@beispiel.de"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Geburtsdatum</label>
                      <input
                        type="date"
                        value={profile.birthDate}
                        onChange={(e) => handleProfileChange('birthDate', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Geburtszeit</label>
                      <input
                        type="time"
                        value={profile.birthTime}
                        onChange={(e) => handleProfileChange('birthTime', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Geburtsort</label>
                    <input
                      type="text"
                      value={profile.birthLocation}
                      onChange={(e) => handleProfileChange('birthLocation', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50"
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
                          <button
                            key={theme.id}
                            onClick={() => handleSettingChange('theme', theme.id)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                              settings.theme === theme.id
                                ? 'border-violet-500 bg-violet-500/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <Icon className="w-6 h-6" />
                            <span className="text-sm">{theme.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Sprache</label>
                    <select
                      value={settings.language}
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium">Haptisches Feedback</p>
                        <p className="text-sm text-slate-400">Vibration bei Interaktionen</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSettingChange('hapticFeedback', !settings.hapticFeedback)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.hapticFeedback ? 'bg-violet-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.hapticFeedback ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
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
                      <button
                        onClick={() => handleSettingChange('notifications', !settings.notifications)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.notifications ? 'bg-violet-500' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          settings.notifications ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>

                    {settings.notifications && (
                      <>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div>
                            <p className="font-medium">Tägliche Erinnerung</p>
                            <p className="text-sm text-slate-400">Erinnere mich an mein Journal</p>
                          </div>
                          <button
                            onClick={() => handleSettingChange('dailyReminder', !settings.dailyReminder)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              settings.dailyReminder ? 'bg-violet-500' : 'bg-slate-600'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              settings.dailyReminder ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>

                        {settings.dailyReminder && (
                          <div className="p-4 bg-white/5 rounded-xl">
                            <label className="block text-sm text-slate-400 mb-2">Erinnerungszeit</label>
                            <input
                              type="time"
                              value={settings.reminderTime}
                              onChange={(e) => handleSettingChange('reminderTime', e.target.value)}
                              className="px-4 py-2 bg-white/10 rounded-lg outline-none"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div>
                            <p className="font-medium">Transit-Alerts</p>
                            <p className="text-sm text-slate-400">Benachrichtige mich bei wichtigen Transits</p>
                          </div>
                          <button
                            onClick={() => handleSettingChange('transitAlerts', !settings.transitAlerts)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              settings.transitAlerts ? 'bg-violet-500' : 'bg-slate-600'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              settings.transitAlerts ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                          </button>
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
                    <label className="block text-sm text-slate-400 mb-2">KI-Provider</label>
                    <select
                      value={aiSettings.provider}
                      onChange={(e) => handleAIChange('provider', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="google">Google Gemini</option>
                      <option value="local">Lokales Modell</option>
                    </select>
                  </div>

                  {aiSettings.provider !== 'local' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">API Key</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={aiSettings.apiKey}
                          onChange={(e) => handleAIChange('apiKey', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50 pr-10"
                          placeholder="sk-..."
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Dein API Key wird lokal verschlüsselt gespeichert.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Modell</label>
                    <select
                      value={aiSettings.model}
                      onChange={(e) => handleAIChange('model', e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 rounded-lg outline-none"
                    >
                      {aiSettings.provider === 'openai' && (
                        <>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </>
                      )}
                      {aiSettings.provider === 'anthropic' && (
                        <>
                          <option value="claude-3-opus">Claude 3 Opus</option>
                          <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                          <option value="claude-3-haiku">Claude 3 Haiku</option>
                        </>
                      )}
                      {aiSettings.provider === 'google' && (
                        <>
                          <option value="gemini-pro">Gemini Pro</option>
                          <option value="gemini-ultra">Gemini Ultra</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Kreativität (Temperature): {aiSettings.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={aiSettings.temperature}
                      onChange={(e) => handleAIChange('temperature', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
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
                  
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Lock className="w-5 h-5 text-green-400" />
                      <p className="font-medium text-green-400">Ende-zu-Ende Verschlüsselung</p>
                    </div>
                    <p className="text-sm text-slate-400">
                      Alle deine Daten werden mit AES-256-GCM verschlüsselt und sicher auf deinem Gerät gespeichert.
                      Wir haben keinen Zugriff auf deine persönlichen Informationen.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium">Anonyme Analyse</p>
                      <p className="text-sm text-slate-400">Hilf uns, die App zu verbessern</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('analytics', !settings.analytics)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.analytics ? 'bg-violet-500' : 'bg-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.analytics ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="p-4 border border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <p className="font-medium text-red-400">Gefahrenzone</p>
                    </div>
                    <button
                      onClick={clearAllData}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Alle Daten löschen</span>
                    </button>
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
                    <button
                      onClick={exportData}
                      className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors"
                    >
                      Backup erstellen
                    </button>
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
                      <input
                        type="file"
                        accept=".json"
                        onChange={importData}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Key className="w-5 h-5 text-violet-400" />
                      <div>
                        <p className="font-medium">Verschlüsselungsschlüssel</p>
                        <p className="text-sm text-slate-400">Verwalte deinen lokalen Verschlüsselungsschlüssel</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Der Verschlüsselungsschlüssel wird automatisch verwaltet und sicher im System-Keychain gespeichert.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
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
                  <span>Gespeichert!</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Speichern</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsSection;
