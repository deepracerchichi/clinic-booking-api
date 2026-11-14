import express from 'express';
import { config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requireApiKey } from './middleware/auth';
import { bookingsRouter } from './routes/bookings';
import { slotsRouter } from './routes/slots';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Public: the host's health check and the web page (which asks the visitor for the API key).
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(express.static(config.publicDir));

  // Everything below needs the API key. Auth runs before body parsing so bad keys are rejected cheaply.
  app.use(requireApiKey);
  app.use(express.json({ limit: '1mb' }));
  app.use(slotsRouter);
  app.use(bookingsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
