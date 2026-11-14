import type { Booking, NewBooking, Slot } from '../types';

/** A non-2xx answer from the API, carrying what the UI needs to react to it. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

async function request<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.');
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? 'Something went wrong.';
    const retry = Number(res.headers.get('Retry-After'));
    throw new ApiError(res.status, message, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  return data as T;
}

export const api = {
  listSlots: (apiKey: string) => request<{ slots: Slot[] }>(apiKey, '/slots').then((r) => r.slots),

  /** The Idempotency-Key makes a retry of the same request safe: it can never book twice. */
  createBooking: (apiKey: string, body: NewBooking, idempotencyKey: string) =>
    request<Booking>(apiKey, '/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    }),

  cancelBooking: (apiKey: string, id: string) =>
    request<Booking>(apiKey, `/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
