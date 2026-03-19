import { RegisterForm } from '@/components/auth';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#020202] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 p-6">
        <a href="/" className="inline-flex items-center gap-2 text-white hover:text-purple-400 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
            <span className="text-white font-serif font-bold text-sm">HD</span>
          </div>
          <span className="font-medium">Synthesis Engine</span>
        </a>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 min-h-[calc(100vh-100px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <RegisterForm />
        </div>
      </main>
    </div>
  );
}
