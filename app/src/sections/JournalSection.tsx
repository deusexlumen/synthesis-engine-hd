import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { JournalList } from '../components/JournalList';
import { JournalEditor } from '../components/JournalEditor';
import { BookOpen, Shield, Lock } from 'lucide-react';

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  mood?: string;
  lastModified: string;
}

interface JournalSectionProps {
  className?: string;
}

export const JournalSection: React.FC<JournalSectionProps> = ({ className = '' }) => {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry);
    setView('edit');
  }, []);

  const handleCreateEntry = useCallback(() => {
    setSelectedEntry(undefined);
    setView('edit');
  }, []);

  const handleSave = useCallback((entry: JournalEntry) => {
    setRefreshKey(prev => prev + 1);
    setView('list');
    setSelectedEntry(undefined);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setRefreshKey(prev => prev + 1);
    setView('list');
    setSelectedEntry(undefined);
  }, []);

  const handleCancel = useCallback(() => {
    setView('list');
    setSelectedEntry(undefined);
  }, []);

  return (
    <div className={`h-full ${className}`}>
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div
            key={`list-${refreshKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <JournalList
              onSelectEntry={handleSelectEntry}
              onCreateEntry={handleCreateEntry}
              selectedEntryId={selectedEntry?.id}
            />
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <JournalEditor
              entry={selectedEntry}
              onSave={handleSave}
              onDelete={selectedEntry ? handleDelete : undefined}
              onCancel={handleCancel}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Info - Only show in list view */}
      {view === 'list' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-t border-white/10"
        >
          <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-400" />
              <span>Nur lokal in deinem Browser gespeichert</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Lokale Speicherung</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span>Privat & Sicher</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default JournalSection;
