import { Db } from '../db/pool';
import { Booking } from '../types';

interface BookingRow {
  seq: string; // bigserial arrives as a string from pg
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: 'confirmed' | 'cancelled';
  created_at: Date;
}

const COLUMNS = 'seq, id, slot_id, name, email, status, created_at';

function toBooking(r: BookingRow): Booking {
  return { id: r.id, slot_id: r.slot_id, name: r.name, email: r.email, status: r.status, created_at: r.created_at.toISOString() };
}

/**
 * Inserts a confirmed booking, or returns null if the slot already has one.
 * The partial unique index makes this atomic: when many requests race for one slot,
 * exactly one insert succeeds and the rest conflict.
 */
export async function insertConfirmed(
  db: Db,
  input: { id: string; slotId: string; name: string; email: string },
): Promise<Booking | null> {
  const { rows } = await db.query<BookingRow>(
    `INSERT INTO bookings (id, slot_id, name, email, status)
     VALUES ($1, $2, $3, $4, 'confirmed')
     ON CONFLICT (slot_id) WHERE status = 'confirmed' DO NOTHING
     RETURNING ${COLUMNS}`,
    [input.id, input.slotId, input.name, input.email],
  );
  return rows[0] ? toBooking(rows[0]) : null;
}

export async function findById(db: Db, id: string): Promise<Booking | null> {
  const { rows } = await db.query<BookingRow>(`SELECT ${COLUMNS} FROM bookings WHERE id = $1`, [id]);
  return rows[0] ? toBooking(rows[0]) : null;
}

/** Cancels only if currently confirmed (one atomic statement), so double-cancels can't both succeed. */
export async function cancelConfirmed(db: Db, id: string): Promise<Booking | null> {
  const { rows } = await db.query<BookingRow>(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'confirmed' RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? toBooking(rows[0]) : null;
}

/** One page of a person's bookings, oldest first, resuming after `afterSeq`. Returns up to `limit + 1` rows. */
export async function listByEmail(
  db: Db,
  email: string,
  afterSeq: number,
  limit: number,
): Promise<Array<Booking & { seq: string }>> {
  const { rows } = await db.query<BookingRow>(
    `SELECT ${COLUMNS} FROM bookings WHERE email = $1 AND seq > $2 ORDER BY seq LIMIT $3`,
    [email, afterSeq, limit + 1],
  );
  return rows.map((r) => ({ ...toBooking(r), seq: r.seq }));
}
