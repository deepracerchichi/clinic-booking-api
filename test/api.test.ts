import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { closePool, runMigrations } from '../src/db/migrate';

const app = createApp();
const KEY = { 'X-API-Key': 'test-key' };

const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const past = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const SLOTS = [
  { id: 's1', provider: 'Dr Ade', start: future(24), end: future(24.5) },
  { id: 's2', provider: 'Dr Ade', start: future(26), end: future(26.5) },
  { id: 's3', provider: 'Dr Bisi', start: future(25), end: future(25.5) },
  { id: 'past', provider: 'Dr Ade', start: past(2), end: past(1.5) },
];

let emailCounter = 0;
const uniqueEmail = () => `person${++emailCounter}@example.com`;

const api = {
  get: (path: string) => request(app).get(path).set(KEY),
  del: (path: string) => request(app).delete(path).set(KEY),
  post: (path: string, body: unknown, headers: Record<string, string> = {}) =>
    request(app).post(path).set(KEY).set(headers).send(body as object),
};

const book = (slot_id: string, email = uniqueEmail(), extra: Record<string, string> = {}) =>
  api.post('/bookings', { slot_id, name: 'Ada Obi', email }, extra);

beforeAll(async () => {
  await runMigrations();
});
beforeEach(async () => {
  await api.post('/reset', { slots: SLOTS });
});
afterAll(async () => {
  await closePool();
});

describe('level 1: slots and bookings', () => {
  it('lists slots earliest first, with availability', async () => {
    const res = await api.get('/slots');
    expect(res.status).toBe(200);
    expect(res.body.slots.map((s: { id: string }) => s.id)).toEqual(['past', 's1', 's3', 's2']);
    expect(res.body.slots.every((s: { available: boolean }) => s.available)).toBe(true);
  });

  it('filters slots by provider (exact match)', async () => {
    const res = await api.get('/slots?provider=Dr%20Bisi');
    expect(res.body.slots.map((s: { id: string }) => s.id)).toEqual(['s3']);
  });

  it('books a slot, marks it unavailable, and looks the booking up', async () => {
    const created = await book('s1', 'ada@example.com');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slot_id: 's1', name: 'Ada Obi', email: 'ada@example.com', status: 'confirmed' });

    const slots = await api.get('/slots');
    expect(slots.body.slots.find((s: { id: string }) => s.id === 's1').available).toBe(false);

    const fetched = await api.get(`/bookings/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);
  });

  it('returns 404 for an unknown booking', async () => {
    expect((await api.get('/bookings/nope')).status).toBe(404);
  });
});

describe('level 2: auth and validation', () => {
  it('rejects a missing or wrong API key with 401', async () => {
    expect((await request(app).get('/slots')).status).toBe(401);
    expect((await request(app).get('/slots').set('X-API-Key', 'wrong')).status).toBe(401);
    const res = await request(app).post('/bookings').send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it.each([
    ['missing slot_id', { name: 'A', email: 'a@example.com' }],
    ['empty name', { slot_id: 's1', name: '   ', email: 'a@example.com' }],
    ['missing email', { slot_id: 's1', name: 'A' }],
    ['invalid email', { slot_id: 's1', name: 'A', email: 'not-an-email' }],
    ['non-string name', { slot_id: 's1', name: 5, email: 'a@example.com' }],
  ])('400 for %s', async (_label, body) => {
    const res = await api.post('/bookings', body);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('400 for malformed JSON', async () => {
    const res = await request(app).post('/bookings').set(KEY).set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('404 for an unknown slot and 400 for a slot that already started', async () => {
    expect((await book('missing')).status).toBe(404);
    expect((await book('past')).status).toBe(400);
  });

  it('trims name and email and lower-cases the email', async () => {
    const res = await api.post('/bookings', { slot_id: 's1', name: '  Ada Obi  ', email: '  ADA@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Ada Obi', email: 'ada@example.com' });
  });
});

describe('level 3: no double booking, cancellation', () => {
  it('returns 409 when the slot is already booked', async () => {
    expect((await book('s1')).status).toBe(201);
    expect((await book('s1')).status).toBe(409);
  });

  it('lets exactly one of many simultaneous requests win', async () => {
    const responses = await Promise.all(Array.from({ length: 25 }, (_, i) => book('s2', `racer${i}@example.com`)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(24);
  });

  it('cancels a booking, frees the slot, and allows rebooking', async () => {
    const created = await book('s1');
    const cancelled = await api.del(`/bookings/${created.body.id}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');

    const slots = await api.get('/slots');
    expect(slots.body.slots.find((s: { id: string }) => s.id === 's1').available).toBe(true);
    expect((await book('s1')).status).toBe(201);
  });

  it('409 when cancelling twice, 404 for an unknown booking', async () => {
    const created = await book('s1');
    expect((await api.del(`/bookings/${created.body.id}`)).status).toBe(200);
    expect((await api.del(`/bookings/${created.body.id}`)).status).toBe(409);
    expect((await api.del('/bookings/nope')).status).toBe(404);
  });
});

describe('level 4: idempotency and pagination', () => {
  it('replays the same response for the same key and body, creating one booking', async () => {
    const email = uniqueEmail();
    const first = await book('s1', email, { 'Idempotency-Key': 'k1' });
    const second = await book('s1', email, { 'Idempotency-Key': 'k1' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const list = await api.get(`/bookings?email=${email}`);
    expect(list.body.bookings).toHaveLength(1);
  });

  it('replays a failure too (same status as the original)', async () => {
    await book('s1');
    const email = uniqueEmail();
    const first = await book('s1', email, { 'Idempotency-Key': 'k-conflict' });
    const second = await book('s1', email, { 'Idempotency-Key': 'k-conflict' });
    expect([first.status, second.status]).toEqual([409, 409]);
  });

  it('returns 422 when the key is reused with a different body', async () => {
    const email = uniqueEmail();
    await book('s1', email, { 'Idempotency-Key': 'k2' });
    const res = await book('s3', email, { 'Idempotency-Key': 'k2' });
    expect(res.status).toBe(422);
  });

  it('does not double-book when the same key arrives simultaneously', async () => {
    const email = uniqueEmail();
    const responses = await Promise.all(Array.from({ length: 10 }, () => book('s1', email, { 'Idempotency-Key': 'k3' })));
    expect(new Set(responses.map((r) => r.status))).toEqual(new Set([201]));
    expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
  });

  it('pages through bookings oldest first with a cursor, ignoring email case', async () => {
    const email = 'pager@example.com';
    const slots = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, provider: 'Dr Ade', start: future(40 + i), end: future(40.5 + i),
    }));
    await api.post('/reset', { slots });
    const ids: string[] = [];
    for (const s of slots) ids.push((await book(s.id, email, { 'Idempotency-Key': `pg-${s.id}` })).body.id);
    // 5 is the most one email may book per minute; listing (GET) is not rate limited.

    const collected: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: request.Response = await api.get(`/bookings?email=PAGER@example.com&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      expect(res.status).toBe(200);
      collected.push(...res.body.bookings.map((b: { id: string }) => b.id));
      cursor = res.body.next_cursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(collected).toEqual(ids.slice(0, collected.length));
  });

  it.each(['0', '51', 'abc', '-1', '2.5'])('400 for limit=%s', async (limit) => {
    expect((await api.get(`/bookings?email=a@example.com&limit=${limit}`)).status).toBe(400);
  });

  it('400 for a garbage cursor and a missing email', async () => {
    expect((await api.get('/bookings?email=a@example.com&cursor=!!!')).status).toBe(400);
    expect((await api.get('/bookings')).status).toBe(400);
  });
});

describe('level 5: rate limiting', () => {
  it('allows 5 attempts per email per minute, failures included, then 429 with Retry-After', async () => {
    const email = uniqueEmail();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await book('missing', email)).status); // 404s still count
    expect(statuses).toEqual([404, 404, 404, 404, 404]);

    const sixth = await book('s1', email);
    expect(sixth.status).toBe(429);
    const retryAfter = Number(sixth.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('does not affect other emails', async () => {
    const spammer = uniqueEmail();
    for (let i = 0; i < 6; i++) await book('missing', spammer);
    expect((await book('s1', uniqueEmail())).status).toBe(201);
  });

  it('counts simultaneous attempts correctly', async () => {
    const email = uniqueEmail();
    const responses = await Promise.all(Array.from({ length: 12 }, () => book('missing', email)));
    expect(responses.filter((r) => r.status === 429)).toHaveLength(7);
  });
});
