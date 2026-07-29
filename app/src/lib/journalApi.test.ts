import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  migrateLocalEntries,
  hasPendingLocalEntries,
} from './journalApi';
import { APIError } from '@/lib/api';

const TOKEN = 'test-token';

const serverEntry = {
  id: 'srv-1',
  userId: 'user-1',
  title: 'Mein Tag',
  content: 'Viel passiert.',
  mood: null,
  tags: ['Traum'],
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-02T10:00:00.000Z',
};

function fetchMockReturning(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('journalApi CRUD', () => {
  it('listEntries sends the bearer token and maps the server shape', async () => {
    const fetchMock = fetchMockReturning({ success: true, data: [serverEntry] });
    vi.stubGlobal('fetch', fetchMock);

    const entries = await listEntries(TOKEN);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/journal');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: 'srv-1',
      date: serverEntry.createdAt,
      title: 'Mein Tag',
      content: 'Viel passiert.',
      tags: ['Traum'],
      mood: undefined, // null is normalized away
      lastModified: serverEntry.updatedAt,
    });
  });

  it('createEntry POSTs the input and returns the mapped entry', async () => {
    const fetchMock = fetchMockReturning({ success: true, data: serverEntry });
    vi.stubGlobal('fetch', fetchMock);

    const input = { title: 'Mein Tag', content: 'Viel passiert.', tags: ['Traum'] };
    const created = await createEntry(TOKEN, input);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(created.id).toBe('srv-1');
    expect(url).toMatch(/\/api\/journal$/);
  });

  it('updateEntry PATCHes the entry id', async () => {
    const fetchMock = fetchMockReturning({ success: true, data: serverEntry });
    vi.stubGlobal('fetch', fetchMock);

    await updateEntry(TOKEN, 'srv-1', { title: 'Neu' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/journal/srv-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Neu' });
  });

  it('deleteEntry issues DELETE against the entry id', async () => {
    const fetchMock = fetchMockReturning({ success: true, data: null });
    vi.stubGlobal('fetch', fetchMock);

    await deleteEntry(TOKEN, 'srv-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/journal/srv-1');
    expect(init.method).toBe('DELETE');
  });

  it('throws APIError with the backend message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      fetchMockReturning({ success: false, error: 'Access denied: Not resource owner' }, false, 403)
    );

    const err = await listEntries(TOKEN).catch((e) => e);
    expect(err).toBeInstanceOf(APIError);
    expect(err.status).toBe(403);
    expect(err.message).toBe('Access denied: Not resource owner');
  });
});

describe('localStorage migration', () => {
  const localEntries = [
    { id: 'entry_1', title: 'Alt 1', content: 'lokal', tags: ['Traum'], mood: 'Ruhe' },
    { id: 'entry_2', title: 'Alt 2', content: 'auch lokal', tags: [] },
  ];

  it('imports local entries once, then marks migration as done', async () => {
    localStorage.setItem('synthesis_journal_entries', JSON.stringify(localEntries));
    const fetchMock = fetchMockReturning({ success: true, data: serverEntry });
    vi.stubGlobal('fetch', fetchMock);

    const imported = await migrateLocalEntries(TOKEN);
    expect(imported).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(firstBody).toEqual({
      title: 'Alt 1',
      content: 'lokal',
      mood: 'Ruhe',
      tags: ['Traum'],
    });

    // Local copy removed, marker set
    expect(localStorage.getItem('synthesis_journal_entries')).toBeNull();
    expect(localStorage.getItem('synthesis_journal_migrated')).toBe('1');

    // Second run is a no-op
    const again = await migrateLocalEntries(TOKEN);
    expect(again).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not mark migration when the import fails (retry next load)', async () => {
    localStorage.setItem('synthesis_journal_entries', JSON.stringify(localEntries));
    vi.stubGlobal(
      'fetch',
      fetchMockReturning({ success: false, error: 'boom' }, false, 500)
    );

    await expect(migrateLocalEntries(TOKEN)).rejects.toBeInstanceOf(APIError);

    expect(localStorage.getItem('synthesis_journal_migrated')).toBeNull();
    expect(localStorage.getItem('synthesis_journal_entries')).not.toBeNull();
    expect(hasPendingLocalEntries()).toBe(true);
  });

  it('hasPendingLocalEntries is false without local entries or after migration', () => {
    expect(hasPendingLocalEntries()).toBe(false);

    localStorage.setItem('synthesis_journal_entries', JSON.stringify(localEntries));
    expect(hasPendingLocalEntries()).toBe(true);

    localStorage.setItem('synthesis_journal_migrated', '1');
    expect(hasPendingLocalEntries()).toBe(false);
  });
});
