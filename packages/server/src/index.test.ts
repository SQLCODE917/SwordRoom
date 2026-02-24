import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './index.js';

describe('server hello API', () => {
  it('returns typed hello payload from core contract', async () => {
    const app = createApp();

    const response = await request(app).get('/api/hello').query({ name: 'Codex' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Hello, Codex!',
      source: 'core',
    });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('rejects invalid input using core validation', async () => {
    const app = createApp();

    const response = await request(app).get('/api/hello').query({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request');
    expect(response.body.details).toEqual([{ field: 'name', message: 'name is required' }]);
  });
});
