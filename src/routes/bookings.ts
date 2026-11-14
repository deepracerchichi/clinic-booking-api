import { Router } from 'express';
import { HttpError } from '../errors';
import { asyncHandler } from '../middleware/asyncHandler';
import * as bookingService from '../services/bookingService';
import { firstIssue, listBookingsQuerySchema } from '../validation/schemas';

export const bookingsRouter = Router();

bookingsRouter.post(
  '/bookings',
  asyncHandler(async (req, res) => {
    const key = req.get('Idempotency-Key')?.trim() || undefined;
    const result = await bookingService.createBooking(req.body, key);
    if (result.headers) res.set(result.headers);
    res.status(result.status).json(result.body);
  }),
);

bookingsRouter.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const parsed = listBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
    const { email, limit, cursor } = parsed.data;
    res.json(await bookingService.listBookings(email, limit, cursor));
  }),
);

bookingsRouter.get(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    res.json(await bookingService.getBooking(String(req.params.id)));
  }),
);

bookingsRouter.delete(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    res.json(await bookingService.cancelBooking(String(req.params.id)));
  }),
);
