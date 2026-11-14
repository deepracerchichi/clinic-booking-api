import { Db } from '../db/pool';
import { Slot, SlotWithAvailability } from '../types';

interface SlotRow {
  id: string;
  provider: string;
  start_raw: string;
  end_raw: string;
  start_ts: Date;
}

export async function list(db: Db, provider?: string): Promise<SlotWithAvailability[]> {
  const { rows } = await db.query<SlotRow & { available: boolean }>(
    `SELECT s.id, s.provider, s.start_raw, s.end_raw,
            NOT EXISTS (
              SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed'
            ) AS available
       FROM slots s
      WHERE ($1::text IS NULL OR s.provider = $1)
      ORDER BY s.start_ts, s.id`,
    [provider ?? null],
  );
  return rows.map((r) => ({ id: r.id, provider: r.provider, start: r.start_raw, end: r.end_raw, available: r.available }));
}

export async function findStart(db: Db, id: string): Promise<Date | null> {
  const { rows } = await db.query<{ start_ts: Date }>('SELECT start_ts FROM slots WHERE id = $1', [id]);
  return rows[0]?.start_ts ?? null;
}

export async function count(db: Db): Promise<number> {
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM slots');
  return rows[0]?.n ?? 0;
}

/** Wipes bookings and everything derived from them, then loads the given slots. */
export async function replaceAll(db: Db, slots: Slot[]): Promise<void> {
  await db.query('TRUNCATE bookings, idempotency_keys, booking_attempts, slots RESTART IDENTITY CASCADE');
  for (const s of slots) {
    await db.query(
      'INSERT INTO slots (id, provider, start_raw, end_raw, start_ts) VALUES ($1, $2, $3, $4, $5)',
      [s.id, s.provider, s.start, s.end, new Date(s.start)],
    );
  }
}
