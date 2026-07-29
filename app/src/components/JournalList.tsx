import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Calendar, Tag,
  ChevronRight, Filter, BookOpen, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import {
  listEntries,
  hasPendingLocalEntries,
  migrateLocalEntries,
  type JournalEntry,
} from '@/lib/journalApi';

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
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  const loadEntries = async () => {
    try {
      setLoading(true);

      if (accessToken) {
        // One-time import of pre-API localStorage entries into the account
        if (hasPendingLocalEntries()) {
          try {
            const imported = await migrateLocalEntries(accessToken);
            if (imported > 0) {
              toast.success(
                `${imported} ${imported === 1 ? 'lokaler Eintrag' : 'lokale Einträge'} in dein Konto importiert.`
              );
            }
          } catch (error) {
            console.error('Journal migration failed:', error);
            toast.error('Lokale Einträge konnten nicht importiert werden. Es wird später erneut versucht.');
          }
        }

        const parsed = await listEntries(accessToken);
        setEntries(parsed);
        const tagsSet = new Set<string>();
        parsed.forEach(e => e.tags.forEach(tag => tagsSet.add(tag)));
        setAllTags(Array.from(tagsSet).sort());
        return;
      }

      // Guest mode: local-only
      const stored = localStorage.getItem('synthesis_journal_entries');
      if (stored) {
        const parsed: JournalEntry[] = JSON.parse(stored);
        parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(parsed);
        const tagsSet = new Set<string>();
        parsed.forEach(e => e.tags.forEach(tag => tagsSet.add(tag)));
        setAllTags(Array.from(tagsSet).sort());
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast.error('Journal-Einträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Defer so no setState runs synchronously in the effect body.
    queueMicrotask(() => {
      void loadEntries();
    });
    // Reload once the access token becomes available (e.g. after refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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
                {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'}
                {accessToken ? ' • mit deinem Konto verknüpft' : ' • nur lokal gespeichert'}
              </p>
            </div>
          </div>
          <Button
            onClick={onCreateEntry}
            className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600"
          >
            <Plus className="w-4 h-4" />
            Neuer Eintrag
          </Button>
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
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'date' | 'title')}>
            <SelectTrigger className="w-auto h-8 bg-white/5 border-white/10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Nach Datum</SelectItem>
              <SelectItem value="title">Nach Titel</SelectItem>
            </SelectContent>
          </Select>

          {selectedTag && (
            <span className="flex items-center gap-1 px-2 py-1 bg-violet-500/20 text-violet-400 text-xs rounded-full">
              {selectedTag}
              <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-violet-400 hover:text-white hover:bg-transparent" onClick={() => setSelectedTag(null)}>×</Button>
            </span>
          )}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Tag className="w-3 h-3 text-slate-500" />
            {allTags.slice(0, 8).map((tag) => (
              <Button
                key={tag}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 h-auto text-xs rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-violet-500 text-white hover:bg-violet-500 hover:text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                {tag}
              </Button>
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
              <Button
                variant="outline"
                onClick={onCreateEntry}
                className="mt-4 bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30 hover:text-violet-300"
              >
                Ersten Eintrag erstellen
              </Button>
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
