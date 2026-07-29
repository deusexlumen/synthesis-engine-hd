/**
 * Journal API Client
 *
 * Talks to /api/journal on the backend. Entries used to live in
 * localStorage ('synthesis_journal_entries') — migrateLocalEntries() moves
 * them server-side exactly once (marker flag in localStorage), so existing
 * users keep their entries after the switch.
 *
 * Guests (no access token) are handled by the components falling back to
 * the old localStorage path; every function here requires a token.
 */

import { APIError } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LOCAL_KEY = 'synthesis_journal_entries';
const MIGRATED_KEY = 'synthesis_journal_migrated';

// ============================================================================
// TYPES
// ============================================================================

/** UI shape used by the journal components (date/lastModified naming). */
export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  mood?: string;
  lastModified: string;
}

export interface JournalEntryInput {
  title: string;
  content: string;
  mood?: string;
  tags: string[];
}

/** Shape the backend returns (Prisma model). */
interface ServerJournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function toUiEntry(server: ServerJournalEntry): JournalEntry {
  return {
    id: server.id,
    date: server.createdAt,
    title: server.title,
    content: server.content,
    tags: server.tags,
    mood: server.mood ?? undefined,
    lastModified: server.updatedAt,
  };
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

async function request<T>(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/journal${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new APIError(message, response.status, `HTTP_${response.status}`);
  }

  const body = await response.json();
  return body.data as T;
}

// ============================================================================
// CRUD
// ============================================================================

export async function listEntries(token: string): Promise<JournalEntry[]> {
  const entries = await request<ServerJournalEntry[]>(token, '');
  return entries.map(toUiEntry);
}

export async function createEntry(
  token: string,
  input: JournalEntryInput
): Promise<JournalEntry> {
  const entry = await request<ServerJournalEntry>(token, '', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toUiEntry(entry);
}

export async function updateEntry(
  token: string,
  id: string,
  input: Partial<JournalEntryInput>
): Promise<JournalEntry> {
  const entry = await request<ServerJournalEntry>(token, `/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return toUiEntry(entry);
}

export async function deleteEntry(token: string, id: string): Promise<void> {
  await request<unknown>(token, `/${id}`, { method: 'DELETE' });
}

// ============================================================================
// LOCALSTORAGE MIGRATION (one-time)
// ============================================================================

interface LocalEntry {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  mood?: string;
}

/** True while unmigrated local entries may still exist. */
export function hasPendingLocalEntries(): boolean {
  if (localStorage.getItem(MIGRATED_KEY)) return false;
  const stored = localStorage.getItem(LOCAL_KEY);
  if (!stored) return false;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * Import pre-API localStorage entries into the account. Runs at most once:
 * on full success the local key is removed and a marker flag is set, so
 * later loads skip the import. On failure nothing is marked, so the next
 * load retries. Returns the number of imported entries.
 */
export async function migrateLocalEntries(token: string): Promise<number> {
  if (!hasPendingLocalEntries()) return 0;

  const local: LocalEntry[] = JSON.parse(localStorage.getItem(LOCAL_KEY)!);

  for (const entry of local) {
    await createEntry(token, {
      title: (entry.title ?? '').trim() || 'Unbenannter Eintrag',
      content: entry.content ?? '',
      mood: entry.mood,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
    });
  }

  localStorage.setItem(MIGRATED_KEY, '1');
  localStorage.removeItem(LOCAL_KEY);
  return local.length;
}
