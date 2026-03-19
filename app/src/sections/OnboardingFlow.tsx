/**
 * Onboarding Flow with API Integration
 * OPTIMIZED: Performance, error handling, accessibility
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { api, withRetry, APIError, NetworkError } from '@/lib/api';
import { toast } from '@/components/Toast';
import { OnboardingStepSkeleton } from '@/components/Skeleton';
import { useAppStore } from '@/stores/appStore';
import { validateBirthDate, validateName } from '@/lib/millmanCalculations';
import type { GeocodeResult, BirthData } from '@/types/humanDesign';
import {
  CalendarIcon,
  Clock,
  MapPin,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Search,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'welcome' | 'name' | 'birthdate' | 'birthtime' | 'birthplace' | 'confirm';

const STEPS: Step[] = ['welcome', 'name', 'birthdate', 'birthtime', 'birthplace', 'confirm'];

// ============================================================================
// COMPONENT
// ============================================================================

export function OnboardingFlow() {
  // Store actions
  const setBirthData = useAppStore((state) => state.setBirthData);
  const setLoading = useAppStore((state) => state.setLoading);
  const setStep = useAppStore((state) => state.setStep);

  // Local state
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [birthTime, setBirthTime] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodeResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodeResult | undefined>(undefined);
  const [timezone, setTimezone] = useState('');

  // Refs
  const searchAbortRef = useRef<AbortController | null>(null);

  // Memoized values
  const stepIndex = useMemo(() => STEPS.indexOf(currentStep), [currentStep]);
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  // Validation
  const nameValidation = useMemo(() => validateName(name), [name]);
  const dateValidation = useMemo(
    () => (birthDate ? validateBirthDate(format(birthDate, 'yyyy-MM-dd')) : { valid: false }),
    [birthDate]
  );
  const timeValidation = useMemo(
    () => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(birthTime),
    [birthTime]
  );

  const isStepValid = useCallback(() => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'name':
        return nameValidation.valid;
      case 'birthdate':
        return dateValidation.valid;
      case 'birthtime':
        return timeValidation;
      case 'birthplace':
        return !!selectedLocation;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, nameValidation.valid, dateValidation.valid, timeValidation, selectedLocation]);

  // Location search with debounce and cleanup
  useEffect(() => {
    if (locationQuery.length < 2) {
      setLocationResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      // Cancel previous search
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      searchAbortRef.current = new AbortController();

      setIsSearching(true);
      try {
        const results = await api.searchLocation(locationQuery);
        if (!searchAbortRef.current.signal.aborted) {
          setLocationResults(results);
        }
      } catch (error) {
        console.error('Location search failed:', error);
        if (!searchAbortRef.current.signal.aborted) {
          setLocationResults([]);
        }
      } finally {
        if (!searchAbortRef.current.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      searchAbortRef.current?.abort();
    };
  }, [locationQuery]);

  // Timezone fetch
  useEffect(() => {
    if (!selectedLocation) {
      setTimezone('');
      return;
    }

    let cancelled = false;

    const fetchTimezone = async () => {
      try {
        const result = await api.getTimezone(selectedLocation.latitude, selectedLocation.longitude);
        if (!cancelled) {
          setTimezone(result.timezone);
        }
      } catch {
        if (!cancelled) {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
      }
    };

    fetchTimezone();

    return () => {
      cancelled = true;
    };
  }, [selectedLocation]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  }, [currentStep]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!birthDate || !selectedLocation) return;

    setIsSubmitting(true);
    setLoading(true);

    const birthData: BirthData = {
      name: name.trim(),
      birthDate: format(birthDate, 'yyyy-MM-dd'),
      birthTime: birthTime || '12:00',
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      timezone,
      city: selectedLocation.name.split(',')[0],
      country: selectedLocation.country,
    };

    try {
      const result = await withRetry(() => api.calculateHD(birthData), 3, 1000);

      // Transform to store format
      const userData = {
        fullName: birthData.name,
        birthDate: birthData.birthDate,
        birthTime: birthData.birthTime,
        birthPlace: selectedLocation.name,
        latitude: birthData.latitude,
        longitude: birthData.longitude,
        timezone: parseFloat(timezone) || 1,
      };

      setBirthData({
        userData,
        hdChart: result.hdChart,
        millmanProfile: result.millmanProfile,
      });

      toast.success(
        'Berechnung erfolgreich',
        `Typ: ${result.hdChart.energyType.replace('_', ' ')} | Lebenszahl: ${result.millmanProfile.destinyNumber}`
      );

      setStep('results');
    } catch (error) {
      console.error('Calculation failed:', error);

      if (error instanceof APIError) {
        toast.error('Berechnung fehlgeschlagen', error.message);
      } else if (error instanceof NetworkError) {
        toast.error('Netzwerkfehler', 'Bitte überprüfe deine Internetverbindung');
      } else {
        toast.error('Fehler', 'Ein unerwarteter Fehler ist aufgetreten');
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  }, [birthDate, selectedLocation, name, birthTime, timezone, setBirthData, setLoading, setStep]);

  // ============================================================================
  // STEP COMPONENTS
  // ============================================================================

  const WelcomeStep = () => (
    <div className="text-center space-y-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20"
      >
        <span className="text-4xl">✨</span>
      </motion.div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Willkommen bei Synthesis Engine</h2>
        <p className="text-white/60 max-w-md mx-auto">
          Entdecke dein einzigartiges Human Design mit professioneller Präzision. Wir nutzen NASA
          JPL Ephemeris-Daten für höchste Genauigkeit.
        </p>
      </div>
      <div className="flex justify-center gap-6 text-sm text-white/40">
        <span className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />±0.0001° Genauigkeit
        </span>
        <span className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          100% Privat
        </span>
      </div>
    </div>
  );

  const NameStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Wie heißt du?</h2>
        <p className="text-white/60">Dein Name wird in deinem persönlichen Chart angezeigt</p>
      </div>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dein Name"
          className="pl-10 h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
          maxLength={50}
          autoFocus
          aria-invalid={!nameValidation.valid && name.length > 0}
          aria-describedby={!nameValidation.valid && name.length > 0 ? 'name-error' : undefined}
        />
      </div>
      {!nameValidation.valid && name.length > 0 && (
        <p id="name-error" className="text-sm text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle className="w-4 h-4" />
          {nameValidation.error}
        </p>
      )}
    </div>
  );

  const BirthdateStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Wann bist du geboren?</h2>
        <p className="text-white/60">Wähle dein Geburtsdatum</p>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full h-14 justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10',
              !birthDate && 'text-white/40'
            )}
          >
            <CalendarIcon className="mr-3 h-5 w-5 text-white/40" />
            {birthDate ? format(birthDate, 'PPP', { locale: de }) : <span>Datum wählen</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="center">
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
      {!dateValidation.valid && birthDate && (
        <p className="text-sm text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle className="w-4 h-4" />
          {dateValidation.error}
        </p>
      )}
    </div>
  );

  const BirthtimeStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Um welche Uhrzeit?</h2>
        <p className="text-white/60">Die genaue Uhrzeit ist wichtig für dein Design</p>
      </div>
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <Input
          type="time"
          value={birthTime}
          onChange={(e) => setBirthTime(e.target.value)}
          className="pl-10 h-14 bg-white/5 border-white/10 text-white [color-scheme:dark] focus:border-purple-500/50"
        />
      </div>
      <p className="text-sm text-white/40 text-center">
        Tipp: Schätzungen sind okay, aber je genauer desto besser
      </p>
    </div>
  );

  const BirthplaceStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Wo bist du geboren?</h2>
        <p className="text-white/60">Suche nach deinem Geburtsort</p>
      </div>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <Input
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
          placeholder="z.B. Berlin, Deutschland"
          className="pl-10 h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
          autoComplete="off"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
        {!isSearching && locationQuery && (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
        )}
      </div>

      {/* Location Results */}
      {locationResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 max-h-48 overflow-y-auto rounded-xl bg-white/5 border border-white/10 p-2"
        >
          {locationResults.map((location, i) => (
            <button
              key={`${location.name}-${i}`}
              onClick={() => {
                setSelectedLocation(location);
                setLocationQuery(location.name);
                setLocationResults([]);
              }}
              className={cn(
                'w-full p-3 rounded-lg text-left transition-all',
                selectedLocation?.name === location.name
                  ? 'bg-purple-500/20 border border-purple-500/30'
                  : 'hover:bg-white/5'
              )}
            >
              <p className="text-sm text-white truncate">{location.name}</p>
              <p className="text-xs text-white/40">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </p>
            </button>
          ))}
        </motion.div>
      )}

      {timezone && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-emerald-400 text-center"
        >
          Zeitzone erkannt: {timezone}
        </motion.p>
      )}
    </div>
  );

  const ConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Überprüfe deine Daten</h2>
        <p className="text-white/60">Stimmen diese Informationen?</p>
      </div>
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <DataRow label="Name" value={name} />
        <DataRow
          label="Geburtsdatum"
          value={birthDate ? format(birthDate, 'PPP', { locale: de }) : '-'}
        />
        <DataRow label="Uhrzeit" value={birthTime || '12:00'} />
        <DataRow
          label="Ort"
          value={selectedLocation?.name || '-'}
          truncate
        />
        <DataRow
          label="Koordinaten"
          value={
            selectedLocation
              ? `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`
              : '-'
          }
        />
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isSubmitting) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <OnboardingStepSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>
            Schritt {stepIndex + 1} von {STEPS.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {currentStep === 'welcome' && <WelcomeStep />}
          {currentStep === 'name' && <NameStep />}
          {currentStep === 'birthdate' && <BirthdateStep />}
          {currentStep === 'birthtime' && <BirthtimeStep />}
          {currentStep === 'birthplace' && <BirthplaceStep />}
          {currentStep === 'confirm' && <ConfirmStep />}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={stepIndex === 0}
          className="text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-0"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Zurück
        </Button>

        {currentStep === 'confirm' ? (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Berechne...
              </>
            ) : (
              <>
                Chart erstellen
                <Check className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
          >
            Weiter
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function DataRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-white/50 whitespace-nowrap">{label}</span>
      <span className={cn('text-white font-medium text-right', truncate && 'truncate')}>{value}</span>
    </div>
  );
}
