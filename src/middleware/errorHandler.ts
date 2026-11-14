import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'not found' });
}

/** Single place that turns any thrown error into the spec's `{ "error": "..." }` shape. */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.set(error.headers).status(error.status).json({ error: error.message });
    return;
  }
  const type = (error as { type?: string }).type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'request body is not valid JSON' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'request body too large' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'internal server error' });
}
