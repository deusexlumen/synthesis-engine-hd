/**
 * Journal Routes API Contract Tests (supertest)
 *
 * Exercises the real journalRouter through a minimal express app with the
 * real authenticate/requireOwnership middleware and Zod validation. Prisma
 * is replaced by an in-memory fake, and verifyAccessToken is mocked so
 * bearer tokens map to deterministic user identities.
 */

import express from 'express';
import request from 'supertest';

interface FakeEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

let entries: FakeEntry[];
let idCounter: number;

jest.mock('../lib/prisma', () => ({
  prisma: {
    journalEntry: {
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        const result = entries.filter((e) => e.userId === where.userId);
        if (orderBy?.createdAt === 'desc') {
          result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return result;
      }),
      findUnique: jest.fn(async ({ where, select }: any) => {
        const entry = entries.find((e) => e.id === where.id) ?? null;
        if (!entry || !select) return entry;
        const picked: Record<string, unknown> = {};
        for (const key of Object.keys(select)) {
          picked[key] = (entry as any)[key];
        }
        return picked;
      }),
      create: jest.fn(async ({ data }: any) => {
        const now = new Date(Date.now() + idCounter); // keep createdAt distinct
        const entry: FakeEntry = {
          id: `entry-${++idCounter}`,
          userId: data.userId,
          title: data.title,
          content: data.content,
          mood: data.mood ?? null,
          tags: data.tags ?? [],
          createdAt: now,
          updatedAt: now,
        };
        entries.push(entry);
        return entry;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const entry = entries.find((e) => e.id === where.id);
        if (!entry) {
          const err = new Error('Record not found');
          (err as any).code = 'P2025';
          throw err;
        }
        Object.assign(entry, data, { updatedAt: new Date() });
        return entry;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const idx = entries.findIndex((e) => e.id === where.id);
        if (idx < 0) {
          const err = new Error('Record not found');
          (err as any).code = 'P2025';
          throw err;
        }
        const [removed] = entries.splice(idx, 1);
        return removed;
      }),
    },
  },
}));

jest.mock('../services/auth', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'token-user-1') {
      return { userId: 'user-1', email: 'one@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    if (token === 'token-user-2') {
      return { userId: 'user-2', email: 'two@test.dev', roles: ['USER'], tier: 'FREE' };
    }
    const err = new Error('invalid token');
    err.name = 'JsonWebTokenError';
    throw err;
  }),
}));

import { journalRouter } from '../routes/journal';
import { errorHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/journal', journalRouter);
  app.use(errorHandler);
  return app;
}

const asUser1 = { Authorization: 'Bearer token-user-1' };
const asUser2 = { Authorization: 'Bearer token-user-2' };

async function createEntry(app: express.Express, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/journal')
    .set(asUser1)
    .send({ title: 'Mein Eintrag', content: 'Inhalt', tags: ['Traum'], ...overrides });
}

beforeEach(() => {
  entries = [];
  idCounter = 0;
});

describe('journal routes', () => {
  describe('authentication', () => {
    test('401 without Authorization header', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/journal');
      expect(res.status).toBe(401);
    });

    test('401 with invalid token', async () => {
      const app = buildApp();
      const res = await request(app)
        .get('/api/journal')
        .set('Authorization', 'Bearer nope');
      expect(res.status).toBe(401);
    });
  });

  describe('CRUD happy path', () => {
    test('POST creates an entry and GET lists it', async () => {
      const app = buildApp();

      const created = await createEntry(app, { mood: 'Dankbar' });
      expect(created.status).toBe(201);
      expect(created.body.success).toBe(true);
      expect(created.body.data).toMatchObject({
        userId: 'user-1',
        title: 'Mein Eintrag',
        content: 'Inhalt',
        mood: 'Dankbar',
        tags: ['Traum'],
      });

      const list = await request(app).get('/api/journal').set(asUser1);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].id).toBe(created.body.data.id);
    });

    test('GET /:id returns the entry', async () => {
      const app = buildApp();
      const created = await createEntry(app);
      const id = created.body.data.id;

      const res = await request(app).get(`/api/journal/${id}`).set(asUser1);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Mein Eintrag');
    });

    test('PATCH updates title/content/tags', async () => {
      const app = buildApp();
      const created = await createEntry(app);
      const id = created.body.data.id;

      const res = await request(app)
        .patch(`/api/journal/${id}`)
        .set(asUser1)
        .send({ title: 'Neuer Titel', tags: ['Erkenntnis', 'Transit'] });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        title: 'Neuer Titel',
        content: 'Inhalt', // unchanged
        tags: ['Erkenntnis', 'Transit'],
      });
    });

    test('DELETE removes the entry', async () => {
      const app = buildApp();
      const created = await createEntry(app);
      const id = created.body.data.id;

      const del = await request(app).delete(`/api/journal/${id}`).set(asUser1);
      expect(del.status).toBe(200);

      const list = await request(app).get('/api/journal').set(asUser1);
      expect(list.body.data).toHaveLength(0);
    });
  });

  describe('ownership', () => {
    test('list only contains own entries', async () => {
      const app = buildApp();
      await createEntry(app, { title: 'Von User 1' });
      await request(app)
        .post('/api/journal')
        .set(asUser2)
        .send({ title: 'Von User 2', content: 'fremd' });

      const list = await request(app).get('/api/journal').set(asUser1);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].title).toBe('Von User 1');
    });

    test('403 when reading a foreign entry', async () => {
      const app = buildApp();
      const created = await createEntry(app);
      const id = created.body.data.id;

      const res = await request(app).get(`/api/journal/${id}`).set(asUser2);
      expect(res.status).toBe(403);
    });

    test('403 when updating or deleting a foreign entry', async () => {
      const app = buildApp();
      const created = await createEntry(app);
      const id = created.body.data.id;

      const patch = await request(app)
        .patch(`/api/journal/${id}`)
        .set(asUser2)
        .send({ title: 'gekapert' });
      expect(patch.status).toBe(403);

      const del = await request(app).delete(`/api/journal/${id}`).set(asUser2);
      expect(del.status).toBe(403);
    });

    test('unknown id is indistinguishable from a foreign entry (403)', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/journal/entry-999').set(asUser1);
      expect(res.status).toBe(403);
    });
  });

  describe('validation', () => {
    test('400 when title is missing or too long', async () => {
      const app = buildApp();

      const missing = await request(app)
        .post('/api/journal')
        .set(asUser1)
        .send({ content: 'ohne Titel' });
      expect(missing.status).toBe(400);

      const tooLong = await createEntry(app, { title: 'x'.repeat(201) });
      expect(tooLong.status).toBe(400);
    });

    test('400 when content exceeds 50k characters', async () => {
      const app = buildApp();
      const res = await createEntry(app, { content: 'y'.repeat(50001) });
      expect(res.status).toBe(400);
    });

    test('tags default to an empty array', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/journal')
        .set(asUser1)
        .send({ title: 'Ohne Tags', content: '...' });
      expect(res.status).toBe(201);
      expect(res.body.data.tags).toEqual([]);
    });
  });
});
