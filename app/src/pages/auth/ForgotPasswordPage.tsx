import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MailCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // The backend always answers 200 (never reveals whether the email
      // exists), so any completed request means "show the confirmation".
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      // Network failure — still show the uniform confirmation to avoid
      // probing; the user can simply retry if no mail arrives.
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {sent ? (
          <div className="text-center">
            <MailCheck className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-medium text-white mb-4">
              E-Mail unterwegs
            </h1>
            <p className="text-white/60 mb-6">
              Falls ein Konto mit dieser Adresse existiert, haben wir dir einen
              Link zum Zurücksetzen deines Passworts geschickt.
            </p>
            <Link to="/login" className="text-purple-400 hover:text-purple-300">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif font-medium text-white mb-2">
                Passwort vergessen
              </h1>
              <p className="text-white/60">
                Wir schicken dir einen Link zum Zurücksetzen
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">
                  E-Mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="deine@email.com"
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? 'Senden...' : 'Link anfordern'}
              </Button>
            </form>

            <p className="text-center text-white/60 mt-6">
              <Link to="/login" className="text-purple-400 hover:text-purple-300">
                Zurück zur Anmeldung
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
