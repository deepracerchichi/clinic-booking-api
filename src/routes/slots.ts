import { Router } from 'express';
import { HttpError } from '../errors';
import { asyncHandler } from '../middleware/asyncHandler';
import * as slotService from '../services/slotService';
import { firstIssue, resetSchema } from '../validation/schemas';

export const slotsRouter = Router();

slotsRouter.get(
  '/slots',
  asyncHandler(async (req, res) => {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
    res.json({ slots: await slotService.listSlots(provider) });
  }),
);

slotsRouter.post(
  '/reset',
  asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error));
    const { slots } = parsed.data;
    if (new Set(slots.map((s) => s.id)).size !== slots.length) throw new HttpError(400, 'slot ids must be unique');

    await slotService.resetSlots(slots);
    res.json({ ok: true, slots: slots.length });
  }),
);
