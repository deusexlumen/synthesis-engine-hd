import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/Toast';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check } from 'lucide-react';

export function RegisterForm() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength
  const passwordStrength = (password: string): { score: number; label: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    const labels = ['Sehr schwach', 'Schwach', 'Mittel', 'Gut', 'Stark', 'Sehr stark'];
    return { score, label: labels[score] };
  };

  const strength = passwordStrength(formData.password);
  const strengthColor = [
    'bg-red-500',
    'bg-red-400',
    'bg-yellow-500',
    'bg-yellow-400',
    'bg-green-400',
    'bg-green-500',
  ][strength.score];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwörter stimmen nicht überein', 'Bitte überprüfe deine Eingaben');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Passwort zu kurz', 'Mindestens 8 Zeichen erforderlich');
      return;
    }

    if (!formData.acceptTerms) {
      toast.error('AGB akzeptieren', 'Bitte akzeptiere die AGB und Datenschutzerklärung');
      return;
    }

    try {
      await register(formData.email, formData.password, formData.name);
      toast.success('Konto erstellt!', 'Willkommen bei deinem Human Design Journey');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Registrierung fehlgeschlagen', error || 'Bitte überprüfe deine Eingaben');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-serif font-medium text-white mb-2">
          Konto erstellen
        </h1>
        <p className="text-white/60">
          Starte deine Reise ins Human Design
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name Field (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-white/80">
            Name <span className="text-white/40">(optional)</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Wie heißt du?"
              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">
            E-Mail <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="deine@email.com"
              className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/80">
            Passwort <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mindestens 8 Zeichen"
              className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
              disabled={isLoading}
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Password Strength */}
          {formData.password && (
            <div className="space-y-1">
              <div className="flex gap-1 h-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors ${
                      i < strength.score ? strengthColor : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-white/50">Stärke: {strength.label}</p>
            </div>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-white/80">
            Passwort bestätigen <span className="text-red-400">*</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Passwort wiederholen"
              className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <p className="text-xs text-red-400">Passwörter stimmen nicht überein</p>
          )}
          {formData.confirmPassword && formData.password === formData.confirmPassword && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Passwörter stimmen überein
            </p>
          )}
        </div>

        {/* Terms Checkbox */}
        <div className="flex items-start space-x-3">
          <Checkbox
            id="terms"
            checked={formData.acceptTerms}
            onCheckedChange={(checked) => 
              setFormData({ ...formData, acceptTerms: checked as boolean })
            }
            className="mt-1"
          />
          <Label htmlFor="terms" className="text-sm text-white/60 leading-relaxed cursor-pointer">
            Ich akzeptiere die{' '}
            <a href="/terms" className="text-purple-400 hover:text-purple-300">
              AGB
            </a>{' '}
            und{' '}
            <a href="/privacy" className="text-purple-400 hover:text-purple-300">
              Datenschutzerklärung
            </a>
          </Label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Konto wird erstellt...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              Konto erstellen
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#020202] px-2 text-white/40">oder</span>
        </div>
      </div>

      {/* Login Link */}
      <p className="text-center text-white/60">
        Bereits ein Konto?{' '}
        <a
          href="/login"
          className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
        >
          Hier anmelden
        </a>
      </p>
    </motion.div>
  );
}
