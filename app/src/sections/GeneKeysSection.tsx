import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GeneKeysDisplay } from '../components/GeneKeysDisplay';
import { Sparkles, BookOpen, Dna, Quote } from 'lucide-react';
import { GeneKeyProfile, calculateGeneKeyProfile } from '../lib/geneKeys';

interface HumanDesignChart {
  energy_type: string;
  authority: string;
  profile: string;
  gates: Array<{
    number: number;
    line: number;
    color: number;
    tone: number;
    base: number;
    planet: string;
    is_design: boolean;
  }>;
}

export const GeneKeysSection: React.FC = () => {
  const [profile, setProfile] = useState<GeneKeyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasBirthData, setHasBirthData] = useState(false);

  useEffect(() => {
    loadGeneKeyProfile();
  }, []);

  const loadGeneKeyProfile = async () => {
    try {
      setLoading(true);
      
      // Check for stored profile
      const stored = localStorage.getItem('synthesis_profile');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.humanDesign?.gates) {
          const hdChart: HumanDesignChart = data.humanDesign;
          
          // Extract gates by planet
          const getGateByPlanet = (planet: string) => {
            const gate = hdChart.gates.find(g => g.planet === planet && !g.is_design);
            return gate?.number || 1;
          };

          const geneKeyProfile = calculateGeneKeyProfile(
            getGateByPlanet('SUN'),
            getGateByPlanet('EARTH'),
            getGateByPlanet('MOON'),
            getGateByPlanet('MERCURY'),
            getGateByPlanet('VENUS'),
            getGateByPlanet('MARS'),
            getGateByPlanet('JUPITER'),
            getGateByPlanet('SATURN'),
            getGateByPlanet('URANUS'),
            getGateByPlanet('NEPTUNE'),
            getGateByPlanet('PLUTO'),
            getGateByPlanet('NORTH_NODE')
          );

          setProfile(geneKeyProfile);
          setHasBirthData(true);
          setLoading(false);
          return;
        }
      }

      // Check for birth data
      const birthData = localStorage.getItem('synthesis_birth_data');
      setHasBirthData(!!birthData);
      
    } catch (error) {
      console.error('Error loading Gene Key profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Dna className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold">Gene Keys</h2>
        </div>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Entdecke die 64 Gene Keys nach Richard Rudd - eine transformative Reise 
          von deinen Schatten zu deinen Gaben und höchsten Potenzialen (Siddhis).
        </p>
      </motion.div>

      {/* Info Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <h3 className="font-medium text-red-400 mb-2">Der Schatten</h3>
          <p className="text-sm text-slate-400">
            Die unterdrückte, reactive Seite unserer Natur. Wenn wir den Schatten 
            bewusst machen, beginnt er sich zu transformieren.
          </p>
        </div>
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <h3 className="font-medium text-amber-400 mb-2">Die Gabe</h3>
          <p className="text-sm text-slate-400">
            Die transformierte Energie des Schattens. Die Gabe ist unsere 
            authentische Kraft, die wir in die Welt bringen.
          </p>
        </div>
        <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <h3 className="font-medium text-violet-400 mb-2">Die Siddhi</h3>
          <p className="text-sm text-slate-400">
            Das höchste Potenzial, das durch vollständige Transformation erreicht wird. 
            Ein Zustand göttlicher Gnade.
          </p>
        </div>
      </motion.div>

      {/* Main Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900/50 rounded-2xl border border-white/10 p-6"
      >
        <GeneKeysDisplay profile={profile || undefined} />
      </motion.div>

      {/* Daily Contemplation */}
      {profile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-2xl border border-violet-500/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <Quote className="w-6 h-6 text-violet-400" />
            <h3 className="text-lg font-medium">Tägliche Kontemplation</h3>
          </div>
          <p className="text-slate-300 italic mb-4">
            "{profile.lifeTheme.contemplation}"
          </p>
          <p className="text-sm text-slate-400">
            Gene Key {profile.lifeTheme.number} - {profile.lifeTheme.gift}
          </p>
        </motion.div>
      )}

      {/* About Gene Keys */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-6 bg-slate-800/50 rounded-2xl border border-white/10"
      >
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-slate-400" />
          <h3 className="font-medium">Über die Gene Keys</h3>
        </div>
        <div className="space-y-4 text-sm text-slate-400">
          <p>
            Die Gene Keys sind ein System spiritueller Weisheit, das von Richard Rudd entwickelt wurde. 
            Sie basieren auf den 64 Hexagrammen des I Ging und bilden eine Brücke zwischen Human Design, 
            Genetik und spiritueller Transformation.
          </p>
          <p>
            Jeder der 64 Gene Keys repräsentiert ein spezifisches Muster von Energie in uns. 
            Jedes Pattern existiert in drei Ebenen:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong className="text-slate-300">Schatten:</strong> Die reaktive, unbewusste Ausdrucksweise</li>
            <li><strong className="text-slate-300">Gabe:</strong> Die transformierte, authentische Ausdrucksweise</li>
            <li><strong className="text-siddhi text-violet-300">Siddhi:</strong> Das höchste, erleuchtete Potenzial</li>
          </ul>
          <p>
            Durch Kontemplation und Selbstbeobachtung können wir unsere Schatten transformieren 
            und unsere höchsten Gaben und Siddhis zum Ausdruck bringen.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default GeneKeysSection;
