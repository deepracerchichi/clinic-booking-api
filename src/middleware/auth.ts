import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { safeEqual } from '../utils/hash';

/** Level 2: every API request must carry the correct X-API-Key. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const given = req.get('X-API-Key');
  if (typeof given !== 'string' || !safeEqual(given, config.apiKey)) {
    res.status(401).json({ error: 'missing or invalid API key' });
    return;
  }
  next();
}
