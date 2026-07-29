import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Sparkles } from 'lucide-react';

const phases = [
  { id: 'void', text: '', duration: 0 },
  { id: 'cosmic', text: 'Verbinde mit dem Kosmos...', duration: 800 },
  { id: 'ephemeris', text: 'Berechne Planetenpositionen...', duration: 1200 },
  { id: 'numerology', text: 'Analysiere numerologische Muster...', duration: 1000 },
  { id: 'synthesis', text: 'Synthetisiere dein einzigartiges Profil...', duration: 800 },
];

export function ProcessingAnimation() {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showReveal, setShowReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userData, setHDChart, setMillmanProfile, setStep } = useAppStore();
  const accessToken = useAuthStore((state) => state.tokens?.accessToken);

  useEffect(() => {
    if (!userData) return;

    const runCalculations = async () => {
      try {
        const { hdChart, millmanProfile } = await api.calculateHD(
          {
            name: userData.fullName,
            birthDate: userData.birthDate,
            birthTime: userData.birthTime,
            latitude: userData.latitude,
            longitude: userData.longitude,
            timezone: userData.timezone,
          },
          accessToken
        );

        setHDChart(hdChart);
        setMillmanProfile(millmanProfile);
        setProgress(100);
        setShowReveal(true);
        setTimeout(() => setStep('results'), 1800);
      } catch (err: any) {
        console.error('Calculation error:', err);
        setError(err?.message || 'Ein unerwarteter Fehler ist aufgetreten.');
      }
    };

    let phaseIndex = 0;
    const totalPhases = phases.length - 1;
    const phaseInterval = setInterval(() => {
      phaseIndex++;
      if (phaseIndex <= totalPhases) {
        setCurrentPhase(phaseIndex);
        setProgress((phaseIndex / totalPhases) * 100);
      }
      if (phaseIndex >= totalPhases) {
        clearInterval(phaseInterval);
      }
    }, 900);

    runCalculations();

    return () => clearInterval(phaseInterval);
  }, [userData, setHDChart, setMillmanProfile, setStep]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-6"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Berechnung fehlgeschlagen</h2>
            <p className="text-white/50">{error}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => setStep('onboarding')}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Zurück und neu versuchen
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: showReveal
              ? 'radial-gradient(circle at center, hsl(270 60% 30% / 0.3) 0%, transparent 60%)'
              : 'radial-gradient(circle at center, hsl(270 60% 20% / 0.1) 0%, transparent 50%)'
          }}
          transition={{ duration: 1 }}
        />
      </div>

      <AnimatePresence mode="wait">
        {!showReveal ? (
          <motion.div
            key="processing"
            className="relative z-10 w-full max-w-sm"
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
          >
            {/* Mandala */}
            <div className="relative w-48 h-48 mx-auto mb-10">
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              >
                {[...Array(64)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-0.5 h-2 bg-gradient-to-b from-purple-400/40 to-transparent rounded-full"
                    style={{
                      top: '0%',
                      left: '50%',
                      transformOrigin: '50% 96px',
                      transform: `rotate(${i * 5.625}deg) translateX(-50%)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.008 }}
                  />
                ))}
              </motion.div>
              <motion.div
                className="absolute inset-6 rounded-full border border-purple-500/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-blue-400/30 rounded-full"
                    style={{
                      top: '0%', left: '50%',
                      transformOrigin: '50% 60px',
                      transform: `rotate(${i * 30}deg) translateX(-50%)`,
                    }}
                  />
                ))}
              </motion.div>
              <motion.div
                className="absolute inset-12 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(270 60% 50% / 0.3) 0%, transparent 70%)' }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"
                animate={{
                  boxShadow: [
                    '0 0 20px hsl(270 60% 50% / 0.5)',
                    '0 0 60px hsl(270 60% 50% / 0.8)',
                    '0 0 20px hsl(270 60% 50% / 0.5)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-center text-xs text-white/30 mt-2">{Math.round(progress)}%</p>
            </div>

            {/* Phase Text */}
            <AnimatePresence mode="wait">
              {phases[currentPhase].text && (
                <motion.p
                  key={phases[currentPhase].id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-center text-white/50 text-sm"
                >
                  {phases[currentPhase].text}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 text-center"
          >
            <motion.div
              className="fixed inset-0 bg-white"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-3xl font-serif gradient-text mb-3">Dein Profil ist bereit</h2>
              <p className="text-white/50">Entdecke deine einzigartige Synthese</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
