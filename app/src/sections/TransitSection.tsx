import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TransitDisplay } from '../components/TransitDisplay';
import { useHDChart } from '@/stores/appStore';
import { Orbit, Calendar, Sparkles } from 'lucide-react';

interface TransitSectionProps {
  className?: string;
}

export function TransitSection({ className = '' }: TransitSectionProps): React.ReactElement {
  // Single source of truth: the chart already computed during onboarding
  // (ProcessingAnimation → api.calculateHD) and held in the shared Zustand
  // store. No separate localStorage copy or re-calculation here.
  const hdChart = useHDChart();
  const hasProfile = hdChart !== null;
  const natalGates = useMemo(
    () => (hdChart ? hdChart.gates.map((g) => g.number) : []),
    [hdChart]
  );

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Orbit className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold">Planetare Transits</h2>
        </div>
        <p className="text-slate-400 max-w-xl mx-auto">
          Verfolge die täglichen Bewegungen der Planeten und ihre Aktivierungen 
          in deinem Human Design Chart.
        </p>
      </motion.div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-white/5 rounded-xl border border-white/10"
        >
          <Calendar className="w-8 h-8 text-violet-400 mb-3" />
          <h3 className="font-medium mb-1">Tägliche Transits</h3>
          <p className="text-sm text-slate-400">
            Siehe welche Gates durch die aktuellen Planetenpositionen aktiviert werden.
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-white/5 rounded-xl border border-white/10"
        >
          <Sparkles className="w-8 h-8 text-amber-400 mb-3" />
          <h3 className="font-medium mb-1">Persönliche Aktivierung</h3>
          <p className="text-sm text-slate-400">
            {hasProfile 
              ? 'Siehe welche Transits deine natalen Gates aktivieren.'
              : 'Erstelle ein Profil um persönliche Transit-Aktivierungen zu sehen.'}
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 bg-white/5 rounded-xl border border-white/10"
        >
          <Orbit className="w-8 h-8 text-cyan-400 mb-3" />
          <h3 className="font-medium mb-1">Mondphasen</h3>
          <p className="text-sm text-slate-400">
            Verfolge den Mondzyklus und seine Einflüsse auf dein Design.
          </p>
        </motion.div>
      </div>

      {/* Main Transit Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="p-6 bg-slate-900/50 rounded-2xl border border-white/10"
      >
        <TransitDisplay natalGates={natalGates} />
      </motion.div>

      {/* Educational Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-white/10"
      >
        <h3 className="text-lg font-medium mb-4">Wie Transits funktionieren</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-400">
          <div>
            <h4 className="text-slate-300 font-medium mb-2">Die 64 Gates</h4>
            <p>
              Human Design basiert auf 64 Gates, die den 64 Hexagrammen des I Ging entsprechen. 
              Jedes Gate repräsentiert eine bestimmte Energie oder Eigenschaft.
            </p>
          </div>
          <div>
            <h4 className="text-slate-300 font-medium mb-2">Planetare Aktivierung</h4>
            <p>
              Wenn ein Planet durch ein Gate transitiert, wird dessen Energie temporär für alle 
              verfügbar. Wenn dieses Gate in deinem Natal-Chart definiert ist, wird es besonders 
              stark aktiviert.
            </p>
          </div>
          <div>
            <h4 className="text-slate-300 font-medium mb-2">Sonne & Mond</h4>
            <p>
              Die Sonne aktiviert täglich ein neues Gate und prägt das kollektive Theme. 
              Der Mond wechselt alle 1-2 Tage und beeinflusst unsere Emotionen und Stimmungen.
            </p>
          </div>
          <div>
            <h4 className="text-slate-300 font-medium mb-2">Äußere Planeten</h4>
            <p>
              Jupiter, Saturn, Uranus, Neptun und Pluto bewegen sich langsamer und ihre 
              Transits haben länger andauernde Einflüsse auf unsere Entwicklung und Wachstum.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TransitSection;
