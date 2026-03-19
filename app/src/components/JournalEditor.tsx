import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Lock, Unlock, Trash2, Calendar, Clock,
  ChevronLeft, MoreVertical, Sparkles, Shield
} from 'lucide-react';

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  mood?: string;
  transitDate?: string;
  lastModified: string;
}

interface JournalEditorProps {
  entry?: JournalEntry;
  onSave: (entry: JournalEntry) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  className?: string;
}

const moods = [
  { emoji: '😊', label: 'Glücklich', color: 'bg-yellow-500/20 text-yellow-400' },
  { emoji: '😌', label: 'Ruhe', color: 'bg-blue-500/20 text-blue-400' },
  { emoji: '🤔', label: 'Nachdenklich', color: 'bg-purple-500/20 text-purple-400' },
  { emoji: '💪', label: 'Stark', color: 'bg-green-500/20 text-green-400' },
  { emoji: '😰', label: 'Ängstlich', color: 'bg-red-500/20 text-red-400' },
  { emoji: '😴', label: 'Müde', color: 'bg-slate-500/20 text-slate-400' },
  { emoji: '✨', label: 'Inspiriert', color: 'bg-amber-500/20 text-amber-400' },
  { emoji: '❤️', label: 'Dankbar', color: 'bg-rose-500/20 text-rose-400' },
];

const commonTags = [
  'Transit', 'Traum', 'Erkenntnis', 'Meditation', 'Beziehung',
  'Arbeit', 'Gesundheit', 'Spiritualität', 'Herausforderung', 'Durchbruch'
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onSave,
  onDelete,
  onCancel,
  className = ''
}) => {
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [mood, setMood] = useState(entry?.mood || '');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    setWordCount(words);
    setCharCount(content.length);
  }, [content]);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !content.trim()) {
      onCancel();
      return;
    }

    setIsSaving(true);

    try {
      const entryData: JournalEntry = {
        id: entry?.id || `entry_${Date.now()}`,
        date: entry?.date || new Date().toISOString(),
        title: title.trim() || 'Unbenannter Eintrag',
        content,
        tags,
        mood: mood || undefined,
        lastModified: new Date().toISOString(),
      };

      // Encrypt and save via Tauri
      await invoke('save_journal_entry', {
        entryId: entryData.id,
        content: JSON.stringify(entryData),
      });

      setLastSaved(new Date());
      onSave(entryData);
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert('Fehler beim Speichern. Bitte versuche es erneut.');
    } finally {
      setIsSaving(false);
    }
  }, [title, content, tags, mood, entry, onSave, onCancel]);

  const handleDelete = async () => {
    if (!entry?.id) return;
    
    if (confirm('Möchtest du diesen Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      try {
        await invoke('delete_journal_entry_command', {
          entryId: entry.id,
        });
        onDelete?.(entry.id);
      } catch (error) {
        console.error('Failed to delete entry:', error);
        alert('Fehler beim Löschen. Bitte versuche es erneut.');
      }
    }
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setNewTag('');
    setShowTagInput(false);
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (content.trim() && title.trim()) {
        handleSave();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [content, title, handleSave]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`flex flex-col h-full ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel deines Eintrags..."
              className="bg-transparent text-lg font-medium placeholder-slate-500 outline-none w-64"
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3 h-3" />
              <span>
                {entry?.date 
                  ? new Date(entry.date).toLocaleDateString('de-DE')
                  : new Date().toLocaleDateString('de-DE')
                }
              </span>
              {lastSaved && (
                <>
                  <span>•</span>
                  <span>Gespeichert {lastSaved.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-lg">
            <Lock className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400">AES-256 Verschlüsselt</span>
          </div>
          
          {entry?.id && onDelete && (
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Speichert...' : 'Speichern'}</span>
          </button>
        </div>
      </div>

      {/* Mood Selector */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-400 mr-2">Stimmung:</span>
          {moods.map((m) => (
            <button
              key={m.label}
              onClick={() => setMood(mood === m.label ? '' : m.label)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                mood === m.label ? m.color : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span>{m.emoji}</span>
              <span className={mood === m.label ? '' : 'text-slate-400'}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-slate-400" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-1 bg-violet-500/20 text-violet-400 text-xs rounded-full"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-violet-300"
              >
                ×
              </button>
            </span>
          ))}
          
          {showTagInput ? (
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag(newTag);
                if (e.key === 'Escape') setShowTagInput(false);
              }}
              onBlur={() => addTag(newTag)}
              placeholder="Neuer Tag..."
              autoFocus
              className="px-2 py-1 bg-white/10 rounded text-sm outline-none"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="px-2 py-1 text-sm text-slate-400 hover:text-white transition-colors"
            >
              + Tag hinzufügen
            </button>
          )}
        </div>
        
        {/* Common Tags */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-slate-500">Häufige Tags:</span>
          {commonTags.filter(t => !tags.includes(t)).slice(0, 5).map((tag) => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              className="px-2 py-0.5 text-xs bg-white/5 hover:bg-white/10 text-slate-400 rounded transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-4 overflow-auto">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Schreibe hier deine Gedanken, Beobachtungen und Erkenntnisse...

Dieser Eintrag wird mit AES-256-GCM verschlüsselt auf deinem Gerät gespeichert."
          className="w-full h-full bg-transparent resize-none outline-none text-slate-200 leading-relaxed"
          style={{ minHeight: '300px' }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>{wordCount} Wörter</span>
          <span>{charCount} Zeichen</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Lokale Verschlüsselung</span>
        </div>
      </div>
    </motion.div>
  );
};

export default JournalEditor;
