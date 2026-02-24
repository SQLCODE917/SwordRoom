import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { createHelloResponse, validateHelloRequest } from '@starter/core';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/hello', (req: Request, res: Response) => {
    const name = String(req.query.name ?? 'World');
    const errors = validateHelloRequest({ name });

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid request', details: errors });
    }

    return res.json(createHelloResponse({ name }));
  });

  return app;
}

export default createApp;
