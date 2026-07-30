/**
 * Onboarding Flow — Radikal vereinfacht
 * 3 Schritte: Willkommen → Daten eingeben → Bestätigen
 * Open-Meteo Geocoding direkt aus dem Frontend (kein Backend nötig)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { validateBirthDate, validateName } from '@/lib/millmanCalculations';
import type { GeocodeResult } from '@/types/humanDesign';
import {
  CalendarIcon,
  MapPin,
  User,
  ChevronRight,
  Check,
  AlertCircle,
  Search,
  Sparkles,
} from 'lucide-react';

type Step = 'welcome' | 'data' | 'confirm';

// Open-Meteo Geocoding API — kostenlos, kein API-Key, kein Backend nötig
interface OpenMeteoResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

async function searchLocationOpenMeteo(query: string): Promise<GeocodeResult[]> {
  if (query.length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=de&format=json`
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.results) return [];
  return (data.results as OpenMeteoResult[]).map((r) => ({
    name: r.name + (r.admin1 ? `, ${r.admin1}` : '') + (r.country ? `, ${r.country}` : ''),
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country || '',
    timezone: r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
}

export function OnboardingFlow() {
  const setUserData = useAppStore((s) => s.setUserData);
  const setStep = useAppStore((s) => s.setStep);

  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [birthTime, setBirthTime] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodeResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodeResult | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Validation
  const nameOk = validateName(name).valid;
  const dateOk = birthDate ? validateBirthDate(format(birthDate, 'yyyy-MM-dd')).valid : false;
  const timeOk = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(birthTime);
  const locOk = !!selectedLocation;

  const dataComplete = nameOk && dateOk && timeOk && locOk;

  // Location search via Open-Meteo
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (locationQuery.length < 2) {
        setLocationResults([]);
        return;
      }
      if (searchAbortRef.current) searchAbortRef.current.abort();
      searchAbortRef.current = new AbortController();
      setIsSearching(true);
      try {
        const results = await searchLocationOpenMeteo(locationQuery);
        if (!searchAbortRef.current.signal.aborted) {
          setLocationResults(results);
        }
      } catch {
        setLocationResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timeoutId);
      searchAbortRef.current?.abort();
    };
  }, [locationQuery]);

  const handleSubmit = useCallback(() => {
    if (!birthDate || !selectedLocation) return;
    setIsSubmitting(true);
    setUserData({
      fullName: name.trim(),
      birthDate: format(birthDate, 'yyyy-MM-dd'),
      birthTime: birthTime || '12:00',
      birthPlace: selectedLocation.name,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      timezone: selectedLocation.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setIsSubmitting(false);
    setStep('processing');
  }, [birthDate, selectedLocation, name, birthTime, setUserData, setStep]);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (isSubmitting) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-white/60">Dein Chart wird berechnet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {currentStep === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-500/20">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-3">Synthesis Engine</h1>
              <p className="text-white/60 max-w-sm mx-auto leading-relaxed">
                Entdecke dein einzigartiges Human Design auf Basis präziser
                astronomischer Ephemeriden-Berechnungen.
                Deine Daten bleiben zu 100% auf deinem Gerät.
              </p>
            </div>
            <div className="flex justify-center gap-8 text-sm text-white/40">
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />Präzise Ephemeriden</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />100% Privat</span>
            </div>
            <Button
              onClick={() => setCurrentStep('data')}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-8 py-6 text-lg"
            >
              Loslegen
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}

        {currentStep === 'data' && (
          <motion.div
            key="data"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="space-y-6"
          >
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-white mb-1">Deine Daten</h2>
              <p className="text-white/50 text-sm">Fülle die Felder aus — dein Chart wird sofort berechnet</p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Wie heißt du?</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nameOk) {
                      e.preventDefault();
                      document.getElementById('birthdate-trigger')?.focus();
                    }
                  }}
                  placeholder="z.B. Max Mustermann"
                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-purple-500/50"
                  maxLength={50}
                />
              </div>
              {!nameOk && name.length > 0 && (
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Mindestens 2 Zeichen</p>
              )}
            </div>

            {/* Geburtsdatum */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Wann bist du geboren?</label>
              <div className="flex gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 h-12 justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10 text-white',
                        !birthDate && 'text-white/30'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-white/30" />
                      {birthDate ? format(birthDate, 'dd.MM.yyyy') : 'Datum wählen...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                    <Calendar
                      mode="single"
                      selected={birthDate}
                      onSelect={setBirthDate}
                      initialFocus
                      defaultMonth={new Date(1990, 0)}
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                      locale={de}
                      className="bg-transparent"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && timeOk) {
                      e.preventDefault();
                      document.getElementById('location-input')?.focus();
                    }
                  }}
                  className="w-28 h-12 bg-white/5 border-white/10 text-white [color-scheme:dark] focus:border-purple-500/50 text-center"
                />
              </div>
              {birthDate && !dateOk && (
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Ungültiges Datum</p>
              )}
            </div>

            {/* Geburtsort */}
            <div className="space-y-2">
              <label className="text-sm text-white/70 font-medium">Wo bist du geboren?</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <Input
                  id="location-input"
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    setSelectedLocation(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dataComplete) {
                      e.preventDefault();
                      setCurrentStep('confirm');
                    }
                  }}
                  placeholder="z.B. Berlin, Deutschland"
                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-purple-500/50"
                  autoComplete="off"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                )}
                {!isSearching && locationQuery && <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />}
              </div>

              {/* Results */}
              {locationResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1 rounded-lg bg-white/5 border border-white/10 p-2"
                >
                  {locationResults.map((loc, i) => (
                    <button
                      key={`${loc.name}-${i}`}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setLocationQuery(loc.name);
                        setLocationResults([]);
                      }}
                      className={cn(
                        'w-full p-2.5 rounded-md text-left text-sm transition-colors',
                        selectedLocation?.name === loc.name
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'hover:bg-white/5 text-white'
                      )}
                    >
                      <div className="font-medium">{loc.name}</div>
                      <div className="text-xs text-white/40">
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        {loc.timezone ? ` · ${loc.timezone}` : ''}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}

              {selectedLocation && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-emerald-400">
                  ✓ {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)} · {selectedLocation.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                </motion.p>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={() => setCurrentStep('confirm')}
              disabled={!dataComplete}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dataComplete ? (
                <>Weiter zur Bestätigung <ChevronRight className="w-4 h-4 ml-2" /></>
              ) : (
                <>Bitte alle Felder ausfüllen</>
              )}
            </Button>
          </motion.div>
        )}

        {currentStep === 'confirm' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-1">Alles korrekt?</h2>
              <p className="text-white/50 text-sm">Überprüfe deine Daten vor der Berechnung</p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-3">
              <Row label="Name" value={name} />
              <Row label="Geburtsdatum" value={birthDate ? format(birthDate, 'dd.MM.yyyy') : '-'} />
              <Row label="Uhrzeit" value={birthTime || '12:00'} />
              <Row label="Ort" value={selectedLocation?.name || '-'} />
              <Row label="Koordinaten" value={selectedLocation ? `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}` : '-'} />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('data')}
                className="flex-1 h-12 bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Zurück
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
              >
                Chart erstellen
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="text-white font-medium text-sm text-right truncate">{value}</span>
    </div>
  );
}
