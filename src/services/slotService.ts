import { pool, withTransaction } from '../db/pool';
import * as slotsRepo from '../repositories/slotsRepo';
import { Slot } from '../types';

export function listSlots(provider?: string) {
  return slotsRepo.list(pool, provider);
}

export async function resetSlots(slots: Slot[]): Promise<void> {
  await withTransaction((tx) => slotsRepo.replaceAll(tx, slots));
}

/** Demo data so the web page has something to show on a fresh database. `/reset` replaces it. */
export async function seedIfEmpty(): Promise<void> {
  if ((await slotsRepo.count(pool)) > 0) return;

  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const slots: Slot[] = [];
  let n = 1;
  for (let day = 1; day <= 7; day++) {
    for (const provider of ['Dr Ade', 'Dr Bisi']) {
      for (const hour of [9, 10, 11, 14]) {
        const start = new Date(midnight.getTime() + day * 86_400_000 + hour * 3_600_000);
        const end = new Date(start.getTime() + 30 * 60_000);
        slots.push({ id: `s${n++}`, provider, start: start.toISOString(), end: end.toISOString() });
      }
    }
  }
  await resetSlots(slots);
}
