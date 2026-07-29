import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { DailyTransit as TransitData } from '@/types/humanDesign';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Moon, Star, ArrowUpRight, ArrowDownRight,
  Calendar, ChevronLeft, ChevronRight, Sparkles,
  Circle, Zap, Globe, Clock
} from 'lucide-react';

interface PlanetTransit {
  planet: string;
  transitGate: number;
  natalGate?: number;
  aspect: string;
  influence: string;
}

interface TransitComparison {
  transits: PlanetTransit[];
  themes: string[];
}

/**
 * Derives which of today's transiting planets activate the user's natal
 * gates. Computed client-side from data the component already has
 * (natalGates prop + the public daily-transit fetch) rather than calling
 * the backend's authenticated /api/transit/compare, which reads from a
 * *saved* HumanDesignProfile — a requirement guests and not-yet-saved
 * charts don't meet.
 */
function compareToNatal(transit: TransitData, natalGates: number[]): TransitComparison {
  const natalSet = new Set(natalGates);
  const transits: PlanetTransit[] = [];
  const themes = new Set<string>();

  for (const planet of transit.planets) {
    if (natalSet.has(planet.gate)) {
      transits.push({
        planet: planet.name,
        transitGate: planet.gate,
        natalGate: planet.gate,
        aspect: `${planet.name} transitiert Tor ${planet.gate}`,
        influence: `${planet.name} aktiviert dein natales Tor ${planet.gate}`,
      });
      themes.add(`${planet.name}-Energie aktiviert`);
    }
  }

  return { transits, themes: Array.from(themes).sort() };
}

interface TransitDisplayProps {
  natalGates?: number[];
  className?: string;
}

const planetIcons: Record<string, React.ReactNode> = {
  'Sonne': <Sun className="w-5 h-5" />,
  'Mond': <Moon className="w-5 h-5" />,
  'Merkur': <Sparkles className="w-5 h-5" />,
  'Venus': <Star className="w-5 h-5" />,
  'Mars': <Zap className="w-5 h-5" />,
  'Jupiter': <Globe className="w-5 h-5" />,
  'Saturn': <Circle className="w-5 h-5" />,
  'Uranus': <ArrowUpRight className="w-5 h-5" />,
  'Neptun': <ArrowDownRight className="w-5 h-5" />,
  'Pluto': <Clock className="w-5 h-5" />,
  'Nordknoten': <Calendar className="w-5 h-5" />,
};

const planetColors: Record<string, string> = {
  'Sonne': 'text-amber-400',
  'Mond': 'text-slate-300',
  'Merkur': 'text-emerald-400',
  'Venus': 'text-rose-400',
  'Mars': 'text-red-500',
  'Jupiter': 'text-amber-500',
  'Saturn': 'text-blue-400',
  'Uranus': 'text-cyan-400',
  'Neptun': 'text-indigo-400',
  'Pluto': 'text-purple-500',
  'Nordknoten': 'text-teal-400',
};

const zodiacSymbols: Record<string, string> = {
  'Widder': '♈',
  'Stier': '♉',
  'Zwillinge': '♊',
  'Krebs': '♋',
  'Löwe': '♌',
  'Jungfrau': '♍',
  'Waage': '♎',
  'Skorpion': '♏',
  'Schütze': '♐',
  'Steinbock': '♑',
  'Wassermann': '♒',
  'Fische': '♓',
};

export const TransitDisplay: React.FC<TransitDisplayProps> = ({ 
  natalGates = [],
  className = '' 
}) => {
  const [transitData, setTransitData] = useState<TransitData | null>(null);
  const [comparison, setComparison] = useState<TransitComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'daily' | 'personal'>('daily');
  const [error, setError] = useState<string | null>(null);

  const fetchTransitData = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getDailyTransit(date);
      setTransitData(data);

      if (natalGates.length > 0) {
        setComparison(compareToNatal(data, natalGates));
      } else {
        setComparison(null);
      }
    } catch (err) {
      console.error('Transit fetch error:', err);
      setError('Fehler beim Laden der Transit-Daten');
    } finally {
      setLoading(false);
    }
  }, [natalGates]);

  useEffect(() => {
    let cancelled = false;
    // Defer so no setState runs synchronously in the effect body.
    queueMicrotask(() => {
      if (!cancelled) void fetchTransitData(selectedDate);
    });
    return () => { cancelled = true; };
  }, [selectedDate, fetchTransitData]);

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading && !transitData) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-red-500/10 border border-red-500/30 rounded-xl ${className}`}>
        <p className="text-red-400 text-center">{error}</p>
        <button
          onClick={() => fetchTransitData(selectedDate)}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 mx-auto block transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!transitData) return null;

  const sunPlanet = transitData.planets.find(p => p.name === 'Sonne');
  const moonPlanet = transitData.planets.find(p => p.name === 'Mond');

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header mit Datumsnavigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateDay('prev')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h3 className="text-lg font-medium">
              {formatDate(selectedDate)}
            </h3>
            {isToday(selectedDate) && (
              <span className="text-xs text-violet-400">Heute</span>
            )}
          </div>
          <button
            onClick={() => navigateDay('next')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        {!isToday(selectedDate) && (
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 rounded-lg text-violet-400 text-sm transition-colors"
          >
            Heute
          </button>
        )}
      </div>

      {/* View Mode Toggle */}
      {natalGates.length > 0 && (
        <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setViewMode('daily')}
            className={`flex-1 px-4 py-2 rounded-md text-sm transition-all ${
              viewMode === 'daily' 
                ? 'bg-violet-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tägliche Transits
          </button>
          <button
            onClick={() => setViewMode('personal')}
            className={`flex-1 px-4 py-2 rounded-md text-sm transition-all ${
              viewMode === 'personal' 
                ? 'bg-violet-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Persönliche Aktivierung
          </button>
        </div>
      )}

      {/* Daily Theme */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-xl border border-violet-500/20"
      >
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h4 className="font-medium text-violet-300">Tägliches Theme</h4>
        </div>
        <p className="text-lg">{transitData.dailyTheme}</p>
        {sunPlanet && (
          <p className="mt-2 text-sm text-slate-400">
            Sonne in Gate {sunPlanet.gate} · Linie {sunPlanet.line}
          </p>
        )}
      </motion.div>

      {/* Moon Phase */}
      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
          <Moon className="w-6 h-6 text-slate-300" />
        </div>
        <div>
          <p className="text-sm text-slate-400">Mondphase</p>
          <p className="font-medium">{transitData.moonPhase}</p>
        </div>
        {moonPlanet && (
          <div className="ml-auto text-right">
            <p className="text-sm text-slate-400">Mond in</p>
            <p className="font-medium">
              {zodiacSymbols[moonPlanet.zodiacSign]} {moonPlanet.zodiacSign}
            </p>
          </div>
        )}
      </div>

      {/* Planet Positions */}
      <AnimatePresence mode="wait">
        {viewMode === 'daily' ? (
          <motion.div
            key="daily"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <h4 className="font-medium text-slate-300">Planetenpositionen</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {transitData.planets.map((planet, index) => (
                <motion.div
                  key={planet.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all ${
                    natalGates.includes(planet.gate) ? 'ring-1 ring-violet-500/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={planetColors[planet.name] || 'text-slate-400'}>
                        {planetIcons[planet.name] || <Star className="w-5 h-5" />}
                      </span>
                      <div>
                        <p className="font-medium">{planet.name}</p>
                        <p className="text-xs text-slate-400">
                          {zodiacSymbols[planet.zodiacSign]} {planet.zodiacSign} {planet.zodiacDegree.toFixed(1)}°
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-violet-400">Tor {planet.gate}</p>
                      <p className="text-xs text-slate-400">
                        Linie {planet.line} · Farbe {planet.color}
                      </p>
                    </div>
                  </div>
                  {planet.retrograde && (
                    <span className="mt-2 inline-block px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                      ℞ Rückläufig
                    </span>
                  )}
                  {natalGates.includes(planet.gate) && (
                    <span className="mt-2 inline-block px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded ml-2">
                      Aktiviert dein Natal-Chart
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="personal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <h4 className="font-medium text-slate-300">Persönliche Transit-Aktivierungen</h4>
            
            {comparison && comparison.transits.length > 0 ? (
              <>
                <div className="space-y-3">
                  {comparison.transits.map((transit, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-gradient-to-r from-violet-500/10 to-transparent rounded-xl border border-violet-500/20"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className={planetColors[transit.planet] || 'text-slate-400'}>
                          {planetIcons[transit.planet] || <Star className="w-5 h-5" />}
                        </span>
                        <p className="font-medium">{transit.aspect}</p>
                      </div>
                      <p className="text-sm text-slate-300">{transit.influence}</p>
                    </motion.div>
                  ))}
                </div>

                {comparison.themes.length > 0 && (
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-sm text-slate-400 mb-2">Heutige Themen</p>
                    <div className="flex flex-wrap gap-2">
                      {comparison.themes.map((theme, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-violet-500/20 text-violet-400 text-sm rounded-full"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center bg-white/5 rounded-xl">
                <p className="text-slate-400">
                  Heute keine direkten Transit-Aktivierungen deines Natal-Charts
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Die aktuellen Planetenpositionen berühren keine deiner natalen Gates
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Gates Summary */}
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-sm text-slate-400 mb-3">Aktive Gates heute</p>
        <div className="flex flex-wrap gap-2">
          {transitData.activeGates.map((gate) => (
            <span
              key={gate}
              className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-all ${
                natalGates.includes(gate)
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {gate}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TransitDisplay;
