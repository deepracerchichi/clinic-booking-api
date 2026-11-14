import { z } from 'zod';

// Spec: trim name and email, store email in lower case, reject missing/empty/invalid values.
export const emailSchema = z.string().trim().toLowerCase().max(254).email();

/** Checked first, because the rate limiter is keyed by email. */
export const emailOnlySchema = z.object({ email: emailSchema });

export const newBookingSchema = z.object({
  slot_id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  email: emailSchema,
});

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date-time');

export const resetSchema = z.object({
  slots: z.array(
    z.object({
      id: z.string().min(1),
      provider: z.string().min(1),
      start: isoDate,
      end: isoDate,
    }),
  ),
});

export const listBookingsQuerySchema = z.object({
  email: emailSchema,
  // Query values arrive as strings. Only plain integers 1..50 are accepted.
  limit: z
    .string()
    .regex(/^\d+$/, 'limit must be an integer from 1 to 50')
    .transform(Number)
    .pipe(z.number().min(1).max(50))
    .default('10'),
  cursor: z.string().min(1).optional(),
});

/** First human-readable message from a failed parse, for the `{ "error": ... }` body. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid request';
  const field = issue.path.join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}
