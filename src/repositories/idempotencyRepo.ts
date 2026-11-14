import { Db } from '../db/pool';

export interface StoredResponse {
  bodyHash: string;
  status: number;
  response: unknown;
}

/**
 * Serialises everything that shares one key until the surrounding transaction ends.
 * A simultaneous retry therefore waits for the first request to commit, then replays its result.
 */
export async function lockKey(db: Db, key: string): Promise<void> {
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`idem:${key}`]);
}

export async function find(db: Db, key: string): Promise<StoredResponse | null> {
  const { rows } = await db.query<{ body_hash: string; status: number; response: unknown }>(
    'SELECT body_hash, status, response FROM idempotency_keys WHERE key = $1',
    [key],
  );
  const row = rows[0];
  return row ? { bodyHash: row.body_hash, status: row.status, response: row.response } : null;
}

export async function save(db: Db, key: string, stored: StoredResponse): Promise<void> {
  await db.query('INSERT INTO idempotency_keys (key, body_hash, status, response) VALUES ($1, $2, $3, $4)', [
    key,
    stored.bodyHash,
    stored.status,
    JSON.stringify(stored.response),
  ]);
}
