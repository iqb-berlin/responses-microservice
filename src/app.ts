import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createRouter } from './routes';

const parseCorsOrigin = (value: string): boolean | string | string[] => {
  if (value === '*') {
    return true;
  }
  return value.split(',').map(origin => origin.trim()).filter(Boolean);
};

export const createApp = (): express.Express => {
  const app = express();
  app.disable('x-powered-by');

  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.use(cors({ origin: parseCorsOrigin(corsOrigin) }));
  }

  app.use(express.json({ limit: process.env.BODY_LIMIT ?? '10mb' }));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number.parseInt(process.env.RATE_LIMIT_MAX ?? '300', 10),
    standardHeaders: 'draft-8',
    legacyHeaders: false
  }));
  app.use(createRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
};
