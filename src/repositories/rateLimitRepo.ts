import { config } from '../config';
import { Db } from '../db/pool';

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding-window limit: at most `maxAttempts` per email in the last `windowSeconds`.
 * Every allowed call is recorded, whatever the booking later does (success, 409, 400...),
 * because "failed attempts included". The advisory lock serialises concurrent calls for the
 * same email, so the count-then-insert below cannot be raced past the limit.
 * Must run inside a transaction (the lock is released at commit).
 */
export async function consume(db: Db, email: string): Promise<RateLimitDecision> {
  const { maxAttempts, windowSeconds } = config.rateLimit;
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`rate:${email}`]);

  await db.query(`DELETE FROM booking_attempts WHERE email = $1 AND ts < clock_timestamp() - make_interval(secs => $2)`, [
    email,
    windowSeconds,
  ]);

  const { rows } = await db.query<{ n: number; wait: string | null }>(
    `SELECT count(*)::int AS n,
            EXTRACT(EPOCH FROM (min(ts) + make_interval(secs => $2) - clock_timestamp())) AS wait
       FROM booking_attempts WHERE email = $1`,
    [email, windowSeconds],
  );
  const row = rows[0];
  if (row && row.n >= maxAttempts) {
    // Time until the oldest attempt in the window expires and frees a place.
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(Number(row.wait))) };
  }

  await db.query('INSERT INTO booking_attempts (email) VALUES ($1)', [email]);
  return { allowed: true };
}
