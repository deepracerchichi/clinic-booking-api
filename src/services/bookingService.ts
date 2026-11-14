import crypto from 'node:crypto';
import { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { ApiResult, HttpError } from '../errors';
import * as bookingsRepo from '../repositories/bookingsRepo';
import * as idempotencyRepo from '../repositories/idempotencyRepo';
import * as rateLimitRepo from '../repositories/rateLimitRepo';
import * as slotsRepo from '../repositories/slotsRepo';
import { Booking } from '../types';
import { hashBody } from '../utils/hash';
import { decodeCursor, encodeCursor } from '../utils/pagination';
import { emailOnlySchema, firstIssue, newBookingSchema } from '../validation/schemas';

function fail(status: number, message: string, headers?: Record<string, string>): ApiResult {
  return { status, body: { error: message }, headers };
}

/**
 * Creates a booking. Order of checks (each step can end the request):
 *   1. replay a stored response if this Idempotency-Key was seen   (level 4)
 *   2. a valid email, because the rate limiter is keyed on it      (level 2)
 *   3. the per-email rate limit, counting this attempt              (level 5)
 *   4. remaining fields, slot exists, slot not started              (level 2)
 *   5. atomic insert; a conflict means the slot is taken            (level 3)
 * Everything runs in one transaction so the attempt record, the booking and the stored
 * idempotent response are committed together or not at all.
 */
export async function createBooking(body: unknown, idempotencyKey?: string): Promise<ApiResult> {
  return withTransaction(async (tx) => {
    const bodyHash = hashBody(body);

    if (idempotencyKey) {
      await idempotencyRepo.lockKey(tx, idempotencyKey);
      const previous = await idempotencyRepo.find(tx, idempotencyKey);
      if (previous) {
        return previous.bodyHash === bodyHash
          ? { status: previous.status, body: previous.response }
          : fail(422, 'Idempotency-Key was already used with a different request body');
      }
    }

    const result = await attemptBooking(tx, body);

    // A 429 says nothing about the request itself, so it must not be pinned to the key:
    // the client should be able to retry the same key after waiting.
    if (idempotencyKey && result.status !== 429) {
      await idempotencyRepo.save(tx, idempotencyKey, { bodyHash, status: result.status, response: result.body });
    }
    return result;
  });
}

async function attemptBooking(tx: PoolClient, body: unknown): Promise<ApiResult> {
  try {
    const emailCheck = emailOnlySchema.safeParse(body);
    if (!emailCheck.success) throw new HttpError(400, firstIssue(emailCheck.error));

    const decision = await rateLimitRepo.consume(tx, emailCheck.data.email);
    if (!decision.allowed) {
      throw new HttpError(429, 'too many booking attempts, try again later', {
        'Retry-After': String(decision.retryAfterSeconds),
      });
    }

    const parsed = newBookingSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
    const { slot_id: slotId, name, email } = parsed.data;

    const startsAt = await slotsRepo.findStart(tx, slotId);
    if (!startsAt) throw new HttpError(404, 'slot not found');
    if (startsAt.getTime() <= Date.now()) throw new HttpError(400, 'slot has already started');

    const booking = await bookingsRepo.insertConfirmed(tx, { id: crypto.randomUUID(), slotId, name, email });
    if (!booking) throw new HttpError(409, 'slot is already booked');

    return { status: 201, body: booking };
  } catch (error) {
    // Turn expected failures into results (not exceptions) so the transaction still commits:
    // the attempt must stay counted by the rate limiter, and the outcome must be replayable.
    if (error instanceof HttpError) return fail(error.status, error.message, error.headers);
    throw error;
  }
}

export async function getBooking(id: string): Promise<Booking> {
  const booking = await bookingsRepo.findById(pool, id);
  if (!booking) throw new HttpError(404, 'booking not found');
  return booking;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const cancelled = await bookingsRepo.cancelConfirmed(pool, id);
  if (cancelled) return cancelled;
  const existing = await bookingsRepo.findById(pool, id);
  if (!existing) throw new HttpError(404, 'booking not found');
  throw new HttpError(409, 'booking is already cancelled');
}

export async function listBookings(email: string, limit: number, cursor?: string) {
  let afterSeq = 0;
  if (cursor !== undefined) {
    const decoded = decodeCursor(cursor);
    if (decoded === null) throw new HttpError(400, 'invalid cursor');
    afterSeq = decoded;
  }

  const rows = await bookingsRepo.listByEmail(pool, email, afterSeq, limit);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const hasMore = rows.length > limit && last !== undefined;

  return {
    bookings: page.map(({ seq: _seq, ...booking }) => booking),
    next_cursor: hasMore ? encodeCursor(last.seq) : null,
  };
}
