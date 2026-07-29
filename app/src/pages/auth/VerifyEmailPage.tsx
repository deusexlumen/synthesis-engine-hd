import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token ? '' : 'Dieser Bestätigungslink ist unvollständig.'
  );
  // StrictMode mounts effects twice — the first POST consumes the token, so a
  // second one would always fail with "invalid token". Guard against that.
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;

    fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Der Bestätigungslink ist ungültig oder abgelaufen.');
        }
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'E-Mail konnte nicht bestätigt werden.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-medium text-white mb-2">
              E-Mail wird bestätigt...
            </h1>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-medium text-white mb-4">
              E-Mail bestätigt
            </h1>
            <p className="text-white/60 mb-6">
              Deine E-Mail-Adresse wurde erfolgreich bestätigt.
            </p>
            <Link to="/login">
              <Button className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium">
                Zur Anmeldung
              </Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-medium text-white mb-4">
              Bestätigung fehlgeschlagen
            </h1>
            <p className="text-white/60 mb-6">{message}</p>
            <Link to="/login" className="text-purple-400 hover:text-purple-300">
              Zur Anmeldung
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
