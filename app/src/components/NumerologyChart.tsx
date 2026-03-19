import { motion } from 'framer-motion';
import { Sparkles, Target, Heart, Briefcase, TrendingUp, AlertTriangle } from 'lucide-react';

interface Challenge {
  ageRange: string;
  challengeNumber: number;
}

interface Pinnacle {
  ageRange: string;
  pinnacleNumber: number;
}

interface NumerologyChartProps {
  lifePathString: string;
  destinyNumber: number;
  root1: number;
  root2: number;
  baseSum: number;
  hasMasterNumber: boolean;
  hasZeroEnhancer: boolean;
  soulUrgeString?: string;
  expressionString?: string;
  personalYear: number;
  challenges: Challenge[];
  pinnacles: Pinnacle[];
}

const numberColors: Record<number, string> = {
  1: 'from-red-500 to-orange-500',
  2: 'from-orange-400 to-amber-400',
  3: 'from-yellow-400 to-lime-400',
  4: 'from-green-500 to-emerald-500',
  5: 'from-cyan-500 to-blue-500',
  6: 'from-blue-500 to-indigo-500',
  7: 'from-indigo-500 to-violet-500',
  8: 'from-violet-500 to-purple-500',
  9: 'from-pink-500 to-rose-500',
  11: 'from-amber-400 to-yellow-400',
  22: 'from-purple-600 to-indigo-600',
};

const numberMeanings: Record<number, string> = {
  1: 'Der Anführer - Unabhängigkeit, Initiative, Originalität',
  2: 'Der Diplomat - Kooperation, Sensitivität, Balance',
  3: 'Der Kommunikator - Kreativität, Ausdruck, Optimismus',
  4: 'Der Baumeister - Stabilität, Disziplin, Praktikalität',
  5: 'Der Abenteurer - Freiheit, Veränderung, Anpassungsfähigkeit',
  6: 'Der Nurturer - Verantwortung, Fürsorge, Harmonie',
  7: 'Der Sucher - Spiritualität, Analyse, Introspektion',
  8: 'Der Macher - Macht, Erfolg, materieller Reichtum',
  9: 'Der Humanist - Mitgefühl, Weisheit, Universalliebe',
  11: 'Der Visionär - Intuition, Inspiration, spirituelle Erleuchtung',
  22: 'Der Meisterbaumeister - Manifestation, große Visionen, praktisches Genie',
};

export function NumerologyChart({
  lifePathString,
  destinyNumber,
  root1,
  root2,
  baseSum,
  hasMasterNumber,
  hasZeroEnhancer,
  soulUrgeString,
  expressionString,
  personalYear,
  challenges,
  pinnacles,
}: NumerologyChartProps) {
  const colorClass = numberColors[destinyNumber] || 'from-purple-500 to-blue-500';

  return (
    <div className="space-y-8">
      {/* Main Life Path Number */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="relative inline-block">
          {/* Glow Effect */}
          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-30 blur-3xl rounded-full scale-150`} />
          
          {/* Number Display */}
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className={`relative w-40 h-40 mx-auto rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-2xl`}
          >
            <span className="text-7xl font-serif font-bold text-white">
              {destinyNumber}
            </span>
            
            {/* Master Number Badge */}
            {hasMasterNumber && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -top-2 -right-2 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-5 h-5 text-black" />
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Life Path String */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-2xl font-serif text-white/80"
        >
          Lebenszahl <span className="text-purple-400">{lifePathString}</span>
        </motion.p>

        {/* Number Meaning */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-3 text-white/60 max-w-md mx-auto"
        >
          {numberMeanings[destinyNumber]}
        </motion.p>

        {/* Zero Enhancer Badge */}
        {hasZeroEnhancer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full"
          >
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-300">Null-Verstärker aktiv</span>
          </motion.div>
        )}
      </motion.div>

      {/* Calculation Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">
          Berechnung
        </h4>
        <div className="flex items-center justify-center gap-3 text-lg">
          <span className="text-purple-400 font-semibold">{root1}</span>
          <span className="text-white/30">+</span>
          <span className="text-purple-400 font-semibold">{root2}</span>
          <span className="text-white/30">=</span>
          <span className="text-2xl font-bold text-white">{baseSum}</span>
          <span className="text-white/30">→</span>
          <span className={`text-3xl font-bold bg-gradient-to-r ${colorClass} bg-clip-text text-transparent`}>
            {destinyNumber}
          </span>
        </div>
      </motion.div>

      {/* Secondary Numbers */}
      <div className="grid sm:grid-cols-2 gap-4">
        {soulUrgeString && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Seelenweg</p>
                <p className="text-xs text-white/30">Vokale aus dem Namen</p>
              </div>
            </div>
            <p className="text-3xl font-serif text-pink-400">{soulUrgeString}</p>
            <p className="text-white/40 text-sm mt-2">
              Deine innersten Wünsche und Sehnsüchte
            </p>
          </motion.div>
        )}

        {expressionString && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Berufsweg</p>
                <p className="text-xs text-white/30">Konsonanten aus dem Namen</p>
              </div>
            </div>
            <p className="text-3xl font-serif text-cyan-400">{expressionString}</p>
            <p className="text-white/40 text-sm mt-2">
              Deine Talente und Fähigkeiten
            </p>
          </motion.div>
        )}
      </div>

      {/* Personal Year */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-white/50 text-sm">Persönliches Jahr</p>
            <p className="text-xs text-white/30">Aktueller Zyklus</p>
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          <p className="text-4xl font-serif text-green-400">{personalYear}</p>
          <p className="text-white/40 text-sm">
            Ein Jahr der {numberMeanings[personalYear]?.split(' - ')[1]?.split(',')[0] || 'Veränderung'}
          </p>
        </div>
      </motion.div>

      {/* Challenges & Pinnacles */}
      <div className="grid sm:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-white/40" />
            <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider">
              Herausforderungen
            </h4>
          </div>
          <div className="space-y-3">
            {challenges.map((c, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-white/40 text-sm">{c.ageRange}</span>
                <span className="font-semibold text-lg">{c.challengeNumber}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-white/40" />
            <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider">
              Höhepunkte
            </h4>
          </div>
          <div className="space-y-3">
            {pinnacles.map((p, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-white/40 text-sm">{p.ageRange}</span>
                <span className="font-semibold text-lg">{p.pinnacleNumber}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
