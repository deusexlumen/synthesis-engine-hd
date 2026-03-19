import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Sun, Moon, Star, Heart, Brain,
  Zap, Globe, Compass, Gem, ChevronDown, ChevronUp,
  Lightbulb, Quote, RotateCcw
} from 'lucide-react';
import { GeneKey, GeneKeyProfile, getGeneKey, getPearlSequence } from '../lib/geneKeys';

interface GeneKeysDisplayProps {
  profile?: GeneKeyProfile;
  highlightedGate?: number;
  className?: string;
}

interface GeneKeyCardProps {
  title: string;
  subtitle: string;
  geneKey: GeneKey;
  icon: React.ReactNode;
  color: string;
  expanded?: boolean;
}

const GeneKeyCard: React.FC<GeneKeyCardProps> = ({ 
  title, subtitle, geneKey, icon, color, expanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  return (
    <motion.div
      layout
      className={`bg-white/5 rounded-xl border border-white/10 overflow-hidden ${color}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color.replace('border-', 'bg-').replace('/20', '/20')}`}>
            {icon}
          </div>
          <div className="text-left">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{geneKey.number}</span>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10"
          >
            <div className="p-4 space-y-4">
              {/* Shadow */}
              <div className="p-3 bg-red-500/10 rounded-lg">
                <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Schatten</p>
                <p className="text-sm">{geneKey.shadow}</p>
              </div>

              {/* Gift */}
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <p className="text-xs text-amber-400 uppercase tracking-wider mb-1">Gabe</p>
                <p className="text-sm font-medium">{geneKey.gift}</p>
              </div>

              {/* Siddhi */}
              <div className="p-3 bg-violet-500/10 rounded-lg">
                <p className="text-xs text-violet-400 uppercase tracking-wider mb-1">Siddhi</p>
                <p className="text-sm font-medium">{geneKey.siddhi}</p>
              </div>

              {/* Question */}
              <div className="flex items-start gap-2 p-3 bg-white/5 rounded-lg">
                <Lightbulb className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 mb-1">Kontemplations-Frage</p>
                  <p className="text-sm italic">{geneKey.question}</p>
                </div>
              </div>

              {/* Affirmation */}
              <div className="flex items-start gap-2 p-3 bg-white/5 rounded-lg">
                <Quote className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 mb-1">Affirmation</p>
                  <p className="text-sm italic text-violet-300">"{geneKey.affirmation}"</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const GeneKeysDisplay: React.FC<GeneKeysDisplayProps> = ({ 
  profile,
  highlightedGate,
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'pearl' | 'explorer'>('profile');
  const [selectedGate, setSelectedGate] = useState(highlightedGate || 1);
  const [showShadow, setShowShadow] = useState(true);

  const geneKey = getGeneKey(selectedGate);
  const pearlSequence = getPearlSequence(selectedGate);

  if (!profile && activeTab === 'profile') {
    return (
      <div className={`p-8 text-center bg-white/5 rounded-xl ${className}`}>
        <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">Kein Gene Keys Profil verfügbar</p>
        <p className="text-sm text-slate-500 mt-2">
          Berechne zuerst dein Human Design Chart um dein Gene Keys Profil zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 px-4 py-2 rounded-md text-sm transition-all ${
            activeTab === 'profile' 
              ? 'bg-violet-500 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Mein Profil
        </button>
        <button
          onClick={() => setActiveTab('pearl')}
          className={`flex-1 px-4 py-2 rounded-md text-sm transition-all ${
            activeTab === 'pearl' 
              ? 'bg-violet-500 text-white' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Perlen-Sequenz
        </button>
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex-1 px-4 py-2 rounded-md text-sm transition-all ${
            activeTab === 'explorer' 
              ? 'bg-violet-500 text-white' 
              : 'text-slate-400 hover:text-white'
          }}`}
        >
          Explorer
        </button>
      </div>

      {/* Profile View */}
      {activeTab === 'profile' && profile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GeneKeyCard
              title="Lebensthema"
              subtitle="Sonne - Deine größte Gabe"
              geneKey={profile.lifeTheme}
              icon={<Sun className="w-5 h-5 text-amber-400" />}
              color="border-amber-500/20"
            />
            <GeneKeyCard
              title="Radiance"
              subtitle="Erde - Deine höchste Potenzial"
              geneKey={profile.radiance}
              icon={<Star className="w-5 h-5 text-emerald-400" />}
              color="border-emerald-500/20"
            />
            <GeneKeyCard
              title="Lebenszweck"
              subtitle="Jupiter - Deine Mission"
              geneKey={profile.purpose}
              icon={<Compass className="w-5 h-5 text-blue-400" />}
              color="border-blue-500/20"
            />
            <GeneKeyCard
              title="Attraktion"
              subtitle="Venus - Was du anziehst"
              geneKey={profile.attraction}
              icon={<Heart className="w-5 h-5 text-rose-400" />}
              color="border-rose-500/20"
            />
            <GeneKeyCard
              title="IQ (Intelligenz)"
              subtitle="Merkur - Dein Denken"
              geneKey={profile.iq}
              icon={<Brain className="w-5 h-5 text-cyan-400" />}
              color="border-cyan-500/20"
            />
            <GeneKeyCard
              title="EQ (Emotionen)"
              subtitle="Mond - Deine Gefühle"
              geneKey={profile.eq}
              icon={<Moon className="w-5 h-5 text-slate-400" />}
              color="border-slate-500/20"
            />
            <GeneKeyCard
              title="SQ (Spiritualität)"
              subtitle="Saturn - Deine Weisheit"
              geneKey={profile.sq}
              icon={<Gem className="w-5 h-5 text-purple-400" />}
              color="border-purple-500/20"
            />
            <GeneKeyCard
              title="Kern-Stabilität"
              subtitle="Mars - Deine Kraft"
              geneKey={profile.coreStability}
              icon={<Zap className="w-5 h-5 text-red-400" />}
              color="border-red-500/20"
            />
          </div>

          {/* Pearl Sequence Preview */}
          <div className="p-4 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-xl border border-violet-500/20">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h4 className="font-medium">Deine Perle: {profile.pearl.pearlName}</h4>
            </div>
            <p className="text-sm text-slate-400 mb-3">{profile.pearl.description}</p>
            <div className="flex flex-wrap gap-2">
              {profile.pearl.sequence.slice(0, 7).map((gk, i) => (
                <span
                  key={i}
                  className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg text-sm"
                >
                  {gk.number}
                </span>
              ))}
              <span className="w-8 h-8 flex items-center justify-center text-slate-500">...</span>
            </div>
            <button
              onClick={() => setActiveTab('pearl')}
              className="mt-3 text-sm text-violet-400 hover:text-violet-300"
            >
              Vollständige Sequenz anzeigen →
            </button>
          </div>
        </motion.div>
      )}

      {/* Pearl Sequence View */}
      {activeTab === 'pearl' && pearlSequence && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-4 bg-violet-500/10 rounded-xl">
            <h3 className="text-lg font-medium mb-2">{pearlSequence.pearlName}</h3>
            <p className="text-slate-400">{pearlSequence.description}</p>
          </div>

          <div className="space-y-3">
            {pearlSequence.sequence.map((gk, index) => (
              <motion.div
                key={gk.number}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-3 bg-white/5 rounded-lg"
              >
                <span className="w-8 h-8 flex items-center justify-center bg-violet-500/20 text-violet-400 rounded-lg font-medium">
                  {index + 1}
                </span>
                <span className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-lg font-bold">
                  {gk.number}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{gk.gift}</p>
                  <p className="text-sm text-slate-400">{gk.siddhi}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Explorer View */}
      {activeTab === 'explorer' && geneKey && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Gate Selector */}
          <div className="p-4 bg-white/5 rounded-xl">
            <label className="block text-sm text-slate-400 mb-3">Gene Key erkunden</label>
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 64 }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setSelectedGate(num)}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${
                    selectedGate === num
                      ? 'bg-violet-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Gene Key Detail */}
          <div className="p-6 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-xl border border-violet-500/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-5xl font-bold">{geneKey.number}</span>
                <p className="text-violet-400 mt-1">Gene Key {geneKey.number}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Schatten anzeigen</span>
                <button
                  onClick={() => setShowShadow(!showShadow)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    showShadow ? 'bg-violet-500' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    showShadow ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {showShadow && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-400 uppercase tracking-wider mb-2">Schatten</p>
                  <p className="text-xl font-medium text-red-300">{geneKey.shadow}</p>
                </div>
              )}

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">Gabe</p>
                <p className="text-xl font-medium text-amber-300">{geneKey.gift}</p>
              </div>

              <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <p className="text-xs text-violet-400 uppercase tracking-wider mb-2">Siddhi</p>
                <p className="text-xl font-medium text-violet-300">{geneKey.siddhi}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Kontemplations-Frage</p>
                <p className="text-lg italic">{geneKey.question}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Affirmation</p>
                <p className="text-lg text-violet-300">"{geneKey.affirmation}"</p>
              </div>

              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Kontemplation</p>
                <p className="text-slate-300">{geneKey.contemplation}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GeneKeysDisplay;
