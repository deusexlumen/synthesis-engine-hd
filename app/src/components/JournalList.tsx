import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Calendar, Tag, Lock, Unlock,
  ChevronRight, Filter, BookOpen, Sparkles
} from 'lucide-react';

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  mood?: string;
  lastModified: string;
}

interface JournalListProps {
  onSelectEntry: (entry: JournalEntry) => void;
  onCreateEntry: () => void;
  selectedEntryId?: string;
  className?: string;
}

const moodEmojis: Record<string, string> = {
  'Glücklich': '😊',
  'Ruhe': '😌',
  'Nachdenklich': '🤔',
  'Stark': '💪',
  'Ängstlich': '😰',
  'Müde': '😴',
  'Inspiriert': '✨',
  'Dankbar': '❤️',
};

export const JournalList: React.FC<JournalListProps> = ({
  onSelectEntry,
  onCreateEntry,
  selectedEntryId,
  className = ''
}) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      
      // Get list of entry IDs
      const entryIds = await invoke<string[]>('list_journal_entries_command');
      
      // Load each entry
      const loadedEntries: JournalEntry[] = [];
      const tagsSet = new Set<string>();
      
      for (const id of entryIds) {
        try {
          const encrypted = await invoke<string>('load_journal_entry', {
            entryId: id,
          });
          
          const entry: JournalEntry = JSON.parse(encrypted);
          loadedEntries.push(entry);
          
          entry.tags.forEach(tag => tagsSet.add(tag));
        } catch (error) {
          console.error(`Failed to load entry ${id}:`, error);
        }
      }
      
      // Sort by date (newest first)
      loadedEntries.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setEntries(loadedEntries);
      setAllTags(Array.from(tagsSet).sort());
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = !selectedTag || entry.tags.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return a.title.localeCompare(b.title);
  });

  const getPreview = (content: string, maxLength = 100) => {
    const plainText = content.replace(/\n/g, ' ').trim();
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Heute, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Gestern, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-violet-500/30 border-t-violet-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Mein Journal</h2>
              <p className="text-xs text-slate-400">
                {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'} • AES-256 verschlüsselt
              </p>
            </div>
          </div>
          <button
            onClick={onCreateEntry}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Neuer Eintrag</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Einträge durchsuchen..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 rounded-lg text-sm placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'title')}
            className="bg-white/5 text-sm rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="date">Nach Datum</option>
            <option value="title">Nach Titel</option>
          </select>
          
          {selectedTag && (
            <span className="flex items-center gap-1 px-2 py-1 bg-violet-500/20 text-violet-400 text-xs rounded-full">
              {selectedTag}
              <button onClick={() => setSelectedTag(null)}>×</button>
            </span>
          )}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Tag className="w-3 h-3 text-slate-500" />
            {allTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-violet-500 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-auto">
        {sortedEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <Sparkles className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 mb-2">
              {searchQuery || selectedTag
                ? 'Keine Einträge gefunden'
                : 'Noch keine Journal-Einträge'}
            </p>
            <p className="text-sm text-slate-500">
              {searchQuery || selectedTag
                ? 'Versuche andere Suchbegriffe oder Filter'
                : 'Beginne deine Reise mit deinem ersten Eintrag'}
            </p>
            {!searchQuery && !selectedTag && (
              <button
                onClick={onCreateEntry}
                className="mt-4 px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg hover:bg-violet-500/30 transition-colors"
              >
                Ersten Eintrag erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {sortedEntries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectEntry(entry)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedEntryId === entry.id
                      ? 'bg-violet-500/10 border-l-2 border-violet-500'
                      : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{entry.title}</h3>
                        {entry.mood && (
                          <span className="text-sm">{moodEmojis[entry.mood]}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                        {getPreview(entry.content)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(entry.date)}
                        </span>
                        {entry.tags.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {entry.tags.slice(0, 2).join(', ')}
                            {entry.tags.length > 2 && ` +${entry.tags.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 ml-2" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalList;
