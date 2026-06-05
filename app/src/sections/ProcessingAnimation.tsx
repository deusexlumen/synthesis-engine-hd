import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { invokeSafe, isTauri } from '@/lib/tauri';

const phases = [
  { id: 'void', text: '', duration: 400 },
  { id: 'cosmic', text: 'Verbinde mit dem Kosmos...', duration: 800 },
  { id: 'ephemeris', text: 'Berechne Planetenpositionen...', duration: 800 },
  { id: 'numerology', text: 'Analysiere numerologische Muster...', duration: 800 },
  { id: 'synthesis', text: 'Synthetisiere dein einzigartiges Profil...', duration: 600 },
];

export function ProcessingAnimation() {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [showReveal, setShowReveal] = useState(false);
  const { userData, setHDChart, setMillmanProfile, setStep } = useAppStore();

  useEffect(() => {
    if (!userData) return;

    const runCalculations = async () => {
      try {
        if (!isTauri()) {
          console.warn('[ProcessingAnimation] Local calculations require Tauri desktop build. In web mode, calculations should be performed via backend API.');
          // In web mode, skip to results if cached data exists
          const cached = localStorage.getItem('synthesis_profile');
          if (cached) {
            const data = JSON.parse(cached);
            if (data.humanDesign) setHDChart(data.humanDesign);
            if (data.millman) setMillmanProfile(data.millman);
          }
          setShowReveal(true);
          setTimeout(() => setStep('results'), 1500);
          return;
        }

        // Parse birth data (YYYY-MM-DD format from OnboardingFlow)
        const [year, month, day] = userData.birthDate.split('-').map(Number);
        const [hour, minute] = userData.birthTime.split(':').map(Number);

        // Convert IANA timezone to numeric offset for Tauri
        const getTzOffset = (ianaTz: string, dateStr: string): number => {
          try {
            const d = new Date(dateStr + 'T12:00:00');
            const fmt = new Intl.DateTimeFormat('en-US', {
              timeZone: ianaTz,
              timeZoneName: 'shortOffset',
            });
            const parts = fmt.formatToParts(d);
            const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || '';
            const match = tzPart.match(/GMT([+-]\d+)/);
            return match ? parseInt(match[1], 10) : 1;
          } catch {
            return 1; // Default to CET
          }
        };
        const tzOffset = getTzOffset(userData.timezone, userData.birthDate);

        // Calculate Human Design via Tauri (desktop only)
        const hdResult = await invokeSafe<HumanDesignChart>('calculate_human_design', {
          year,
          month,
          day,
          hour,
          minute,
          latitude: userData.latitude,
          longitude: userData.longitude,
          timezone: tzOffset,
        });

        // Calculate Numerology via Tauri (desktop only)
        const millmanResult = await invokeSafe<MillmanProfile>('calculate_numerology', {
          birthDate: userData.birthDate,
          fullName: userData.fullName,
        });

        if (!hdResult || !millmanResult) {
          throw new Error(
            isTauri()
              ? 'Tauri calculation returned empty result'
              : 'Desktop app required for full calculations. Please download the desktop version.'
          );
        }

        setHDChart(hdResult as any);
        setMillmanProfile(millmanResult);

        // Trigger reveal
        setShowReveal(true);

        // Move to results after reveal animation
        setTimeout(() => {
          setStep('results');
        }, 1500);
      } catch (error) {
        console.error('Calculation error:', error);
        // If not in Tauri, show a message and redirect back
        if (!isTauri()) {
          setShowReveal(true);
          setTimeout(() => setStep('results'), 1500);
        }
      }
    };

    // Phase transitions
    let phaseIndex = 0;
    const phaseInterval = setInterval(() => {
      phaseIndex++;
      if (phaseIndex < phases.length) {
        setCurrentPhase(phaseIndex);
      } else {
        clearInterval(phaseInterval);
      }
    }, 700);

    runCalculations();

    return () => clearInterval(phaseInterval);
  }, [userData, setHDChart, setMillmanProfile, setStep]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
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
            className="relative z-10"
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
          >
            {/* Central Mandala */}
            <div className="relative w-64 h-64">
              {/* Outer Ring with Gates */}
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              >
                {[...Array(64)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-3 bg-gradient-to-b from-purple-400/40 to-transparent rounded-full"
                    style={{
                      top: '0%',
                      left: '50%',
                      transformOrigin: '50% 128px',
                      transform: `rotate(${i * 5.625}deg) translateX(-50%)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                  />
                ))}
              </motion.div>

              {/* Middle Ring */}
              <motion.div
                className="absolute inset-8 rounded-full border border-purple-500/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-blue-400/30 rounded-full"
                    style={{
                      top: '0%',
                      left: '50%',
                      transformOrigin: '50% 80px',
                      transform: `rotate(${i * 30}deg) translateX(-50%)`,
                    }}
                  />
                ))}
              </motion.div>

              {/* Inner Glow */}
              <motion.div
                className="absolute inset-16 rounded-full"
                style={{
                  background: 'radial-gradient(circle, hsl(270 60% 50% / 0.3) 0%, transparent 70%)',
                }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Center Core */}
              <motion.div
                className="absolute inset-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"
                animate={{ 
                  boxShadow: [
                    '0 0 20px hsl(270 60% 50% / 0.5)',
                    '0 0 60px hsl(270 60% 50% / 0.8)',
                    '0 0 20px hsl(270 60% 50% / 0.5)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-3xl font-serif text-white">✦</span>
              </motion.div>
            </div>

            {/* Phase Text */}
            <AnimatePresence mode="wait">
              {phases[currentPhase].text && (
                <motion.p
                  key={phases[currentPhase].id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center mt-12 text-white/60 text-lg"
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
            {/* Flash Effect */}
            <motion.div
              className="fixed inset-0 bg-white"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />

            {/* Reveal Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-headline font-serif gradient-text mb-4">
                Dein Profil ist bereit
              </h2>
              <p className="text-white/60">
                Entdecke deine einzigartige Synthese
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Type definitions for Tauri invocations
interface HumanDesignChart {
  energyType: string;
  authority: string;
  profile: string;
  profileLine1: number;
  profileLine2: number;
  incarnationCross: string;
  definedCenters: string[];
  undefinedCenters: string[];
  gates: Array<{
    number: number;
    line: number;
    color: number;
    tone: number;
    base: number;
    planet: string;
    isDesign: boolean;
  }>;
  channels: Array<{
    gate1: number;
    gate2: number;
  }>;
  variables: {
    digestion: string;
    environment: string;
    awareness: string;
    motivation: string;
    sense: string;
    style: string;
  };
}

interface MillmanProfile {
  lifePathString: string;
  root1: number;
  root2: number;
  baseSum: number;
  destinyNumber: number;
  hasMasterNumber: boolean;
  hasZeroEnhancer: boolean;
  soulUrgeString?: string;
  expressionString?: string;
  challenges: Array<{
    ageRange: string;
    challengeNumber: number;
  }>;
  pinnacles: Array<{
    ageRange: string;
    pinnacleNumber: number;
  }>;
  personalYear: number;
}
