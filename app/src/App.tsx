import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { OnboardingFlow } from '@/sections/OnboardingFlow';
import { ProcessingAnimation } from '@/sections/ProcessingAnimation';
import { ResultsDashboard } from '@/sections/ResultsDashboard';
import { AISettings } from '@/sections/AISettings';
import { ToastContainer } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Brain, Settings, Home, Sparkles, Activity, User, LogOut } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

type AppView = 'main' | 'settings' | 'ai-config';

// ============================================================================
// MAIN APP ROUTER
// ============================================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        } />
        
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================================
// PROTECTED MAIN APP
// ============================================================================

function MainApp() {
  const { currentStep } = useAppStore();
  const { user, logout } = useAuthStore();
  const [currentView, setCurrentView] = useState<AppView>('main');

  // Show onboarding if user hasn't completed it
  if (currentStep === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#020202] text-white font-sans antialiased">
        <BackgroundEffects />
        <main className="relative z-10">
          <OnboardingFlow />
        </main>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans antialiased">
      <BackgroundEffects />

      {/* Navigation */}
      {currentStep === 'results' && (
        <motion.nav
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/[0.06]"
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-serif font-medium text-lg hidden sm:inline">Synthesis</span>
            </div>

            <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1">
              <NavButton
                active={currentView === 'main'}
                onClick={() => setCurrentView('main')}
                icon={<Home className="w-4 h-4" />}
                label="Profil"
              />
              <NavButton
                active={currentView === 'ai-config'}
                onClick={() => setCurrentView('ai-config')}
                icon={<Brain className="w-4 h-4" />}
                label="KI"
              />
              <NavButton
                active={currentView === 'settings'}
                onClick={() => setCurrentView('settings')}
                icon={<Settings className="w-4 h-4" />}
                label="Einstellungen"
              />
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-medium">{user.email}</span>
                    <span className="text-xs text-white/50">{user.subscription?.tier}</span>
                  </div>
                  <button 
                    onClick={logout}
                    className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                    title="Abmelden"
                  >
                    <LogOut className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.nav>
      )}

      {/* Main content */}
      <main className={`relative z-10 ${currentStep === 'results' ? 'pt-20' : ''}`}>
        <AnimatePresence mode="wait">
          {currentStep === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProcessingAnimation />
            </motion.div>
          )}

          {currentStep === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnimatePresence mode="wait">
                {currentView === 'main' && (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <ResultsDashboard />
                  </motion.div>
                )}

                {currentView === 'ai-config' && (
                  <motion.div
                    key="ai-config"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-6"
                  >
                    <div className="max-w-2xl mx-auto">
                      <motion.h1 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-serif font-medium mb-8"
                      >
                        KI-Konfiguration
                      </motion.h1>
                      <AISettings />
                    </div>
                  </motion.div>
                )}

                {currentView === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-6"
                  >
                    <div className="max-w-2xl mx-auto">
                      <motion.h1 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-serif font-medium mb-8"
                      >
                        Einstellungen
                      </motion.h1>
                      <SettingsPlaceholder />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ToastContainer />
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function BackgroundEffects() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Gradient Orbs */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(270 60% 30% / 0.12) 0%, transparent 60%)',
          left: '-20%',
          top: '-10%',
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(220 80% 30% / 0.1) 0%, transparent 60%)',
          right: '-10%',
          bottom: '-5%',
        }}
        animate={{
          x: [0, -40, 0],
          y: [0, 40, 0],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />
    </div>
  );
}

function NavButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg transition-all ${
        active 
          ? 'bg-white/10 text-white' 
          : 'text-white/40 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="hidden sm:inline text-sm">{label}</span>
    </Button>
  );
}

function SettingsPlaceholder() {
  const { user, logout } = useAuthStore();
  const [health, setHealth] = useState<{
    status: 'ok' | 'warning' | 'error';
    ephemeris: { usingFiles: boolean };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    import('@/lib/api').then(({ api }) => {
      api.checkHealth()
        .then((data) => {
          if (!cancelled) {
            setHealth(data);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHealth(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    });
    
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-medium">{user?.email}</h3>
            <p className="text-white/50 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                {user?.subscription?.tier || 'FREE'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                {user?.subscription?.status || 'ACTIVE'}
              </span>
            </div>
          </div>
        </div>
        <Button 
          onClick={logout}
          variant="outline"
          className="w-full border-white/10 hover:bg-white/5"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Abmelden
        </Button>
      </div>

      {/* Health Status */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className={`w-5 h-5 ${
            health?.status === 'ok' ? 'text-emerald-400' : 
            health?.status === 'warning' ? 'text-amber-400' : 'text-red-400'
          }`} />
          <h3 className="font-medium">System Status</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            Status wird geladen...
          </div>
        ) : health ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Backend</span>
              <span className={health.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                {health.status === 'ok' ? 'Online' : health.status === 'warning' ? 'Eingeschränkt' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Ephemeris</span>
              <span className={health.ephemeris.usingFiles ? 'text-emerald-400' : 'text-amber-400'}>
                {health.ephemeris.usingFiles ? 'Professional' : 'Fallback'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-red-400 text-sm">Verbindung zum Backend fehlgeschlagen</p>
        )}
      </div>

      {/* General Settings */}
      <div className="glass rounded-3xl p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-white/30" />
        </div>
        <h3 className="text-lg font-medium mb-2">Einstellungen</h3>
        <p className="text-white/50">
          Weitere Einstellungen werden in zukünftigen Updates hinzugefügt.
        </p>
      </div>
    </div>
  );
}

export default App;
