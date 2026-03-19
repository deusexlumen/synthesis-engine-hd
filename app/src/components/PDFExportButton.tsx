import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, BookOpen, X, Check, Loader2 } from 'lucide-react';
import { exportElementToPDF, generateFullReport, quickExportChart } from '../services/pdfExport';

interface PDFExportButtonProps {
  variant?: 'button' | 'icon' | 'menu';
  elementId?: string;
  chartData?: any;
  journalEntries?: any[];
  filename?: string;
  className?: string;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({
  variant = 'button',
  elementId,
  chartData,
  journalEntries,
  filename,
  className = ''
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async (type: 'chart' | 'full' | 'journal') => {
    setExporting(true);
    setShowMenu(false);

    try {
      switch (type) {
        case 'chart':
          if (elementId) {
            await quickExportChart(elementId, filename);
          }
          break;
        case 'full':
          if (chartData) {
            await generateFullReport(chartData, {
              filename: filename || 'synthesis-report.pdf',
            });
          }
          break;
        case 'journal':
          if (journalEntries) {
            const { exportJournalToPDF } = await import('../services/pdfExport');
            await exportJournalToPDF(journalEntries);
          }
          break;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setExporting(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={() => elementId && handleExport('chart')}
        disabled={exporting}
        className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${className}`}
        title="Als PDF exportieren"
      >
        {exporting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : success ? (
          <Check className="w-5 h-5 text-green-400" />
        ) : (
          <Download className="w-5 h-5" />
        )}
      </button>
    );
  }

  if (variant === 'menu') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : success ? (
            <Check className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>Exportieren</span>
        </button>

        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute right-0 top-full mt-2 w-56 bg-slate-800 rounded-xl border border-white/10 shadow-xl z-50 overflow-hidden"
              >
                {elementId && (
                  <button
                    onClick={() => handleExport('chart')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm">Aktuelle Ansicht</p>
                      <p className="text-xs text-slate-500">Chart als Bild</p>
                    </div>
                  </button>
                )}
                
                {chartData && (
                  <button
                    onClick={() => handleExport('full')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm">Vollständiger Report</p>
                      <p className="text-xs text-slate-500">Alle Daten zusammengefasst</p>
                    </div>
                  </button>
                )}
                
                {journalEntries && (
                  <button
                    onClick={() => handleExport('journal')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm">Journal</p>
                      <p className="text-xs text-slate-500">Alle Einträge</p>
                    </div>
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default button variant
  return (
    <button
      onClick={() => elementId && handleExport('chart')}
      disabled={exporting}
      className={`flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg transition-colors ${className}`}
    >
      {exporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Exportiere...</span>
        </>
      ) : success ? (
        <>
          <Check className="w-4 h-4" />
          <span>Exportiert!</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>Als PDF exportieren</span>
        </>
      )}
    </button>
  );
};

export default PDFExportButton;
