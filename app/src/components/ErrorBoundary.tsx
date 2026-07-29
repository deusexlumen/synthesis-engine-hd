/**
 * Error Boundary Component
 * Catches and handles React errors gracefully
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/stores/toastStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to analytics in production
    if (import.meta.env.PROD) {
      // analytics.trackError(error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-[#020202] flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
            >
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-white mb-2"
            >
              Etwas ist schiefgelaufen
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/60 mb-6"
            >
              Ein unerwarteter Fehler ist aufgetreten. Wir entschuldigen uns für die Unannehmlichkeiten.
            </motion.p>

            {this.state.error && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6 text-left overflow-auto"
              >
                <code className="text-xs text-red-400 font-mono">
                  {this.state.error.message}
                </code>
              </motion.div>
            )}

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button
                onClick={this.handleReset}
                className="bg-white/10 hover:bg-white/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Seite neu laden
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="border-white/20"
              >
                <Home className="w-4 h-4 mr-2" />
                Zur Startseite
              </Button>
            </motion.div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

// Hook for async error handling
export function useErrorHandler() {
  return (error: unknown, context?: string) => {
    console.error(context || 'Error:', error);
    
    const message = error instanceof Error 
      ? error.message 
      : 'Ein unbekannter Fehler ist aufgetreten';
    
    toast.error(context || 'Fehler', message);
  };
}
