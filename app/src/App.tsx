import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { OnboardingFlow } from '@/sections/OnboardingFlow';
import { ProcessingAnimation } from '@/sections/ProcessingAnimation';
import { ResultsDashboard } from '@/sections/ResultsDashboard';
import { ToastContainer } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Brain, CreditCard, Settings, Home, Sparkles, LogOut } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth';
import { Spinner } from '@/components/ui/spinner';

// Auth pages are dead weight for a signed-in user, and the settings views are
// only reached by an explicit click — none of them belong in the first paint.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const AISettings = lazy(() =>
  import('@/sections/AISettings').then((m) => ({ default: m.AISettings }))
);
const SettingsSection = lazy(() =>
  import('@/sections/SettingsSection').then((m) => ({ default: m.SettingsSection }))
);
const BillingSection = lazy(() =>
  import('@/sections/BillingSection').then((m) => ({ default: m.BillingSection }))
);
const BillingSuccessPage = lazy(() => import('@/pages/billing/BillingSuccessPage'));
const BillingCancelledPage = lazy(() => import('@/pages/billing/BillingCancelledPage'));

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" className="text-purple-500" />
    </div>
  );
}

type AppView = 'main' | 'settings' | 'ai-config' | 'billing';

// ============================================================================
// MAIN APP ROUTER
// ============================================================================

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<ViewFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

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

          {/* Stripe Checkout redirects back to these */}
          <Route path="/billing/success" element={
            <ProtectedRoute>
              <BillingSuccessPage />
            </ProtectedRoute>
          } />
          <Route path="/billing/cancelled" element={
            <ProtectedRoute>
              <BillingCancelledPage />
            </ProtectedRoute>
          } />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
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
                active={currentView === 'billing'}
                onClick={() => setCurrentView('billing')}
                icon={<CreditCard className="w-4 h-4" />}
                label="Plan"
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
                      <Suspense fallback={<ViewFallback />}>
                        <AISettings />
                      </Suspense>
                    </div>
                  </motion.div>
                )}

                {currentView === 'billing' && (
                  <motion.div
                    key="billing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-6"
                  >
                    <div className="max-w-4xl mx-auto">
                      <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-serif font-medium mb-8"
                      >
                        Plan & Abrechnung
                      </motion.h1>
                      <Suspense fallback={<ViewFallback />}>
                        <BillingSection />
                      </Suspense>
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
                      <Suspense fallback={<ViewFallback />}>
                        <SettingsSection />
                      </Suspense>
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

export default App;
