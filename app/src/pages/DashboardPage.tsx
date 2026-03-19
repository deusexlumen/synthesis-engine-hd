import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles, User, Settings, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#020202] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif font-medium text-xl">Synthesis</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60">{user.email}</span>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-serif font-medium mb-2">
            Willkommen zurück
          </h1>
          <p className="text-white/60 mb-8">
            Dein Human Design Dashboard
          </p>

          {/* Subscription Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium">Profil</h3>
                  <p className="text-sm text-white/50">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Abo-Status</h3>
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                  {user.subscription?.tier || 'FREE'}
                </span>
              </div>
              <p className="text-sm text-white/50">
                Status: {user.subscription?.status || 'ACTIVE'}
              </p>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Charts</h3>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </div>
              <p className="text-sm text-white/50">
                Erstelle deine ersten Charts
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-serif mb-4">Neue Berechnung starten</h2>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              Entdecke dein einzigartiges Human Design und beginne deine Reise zur Selbsterkenntnis.
            </p>
            <Button 
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              onClick={() => navigate('/chart/new')}
            >
              Chart berechnen
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
