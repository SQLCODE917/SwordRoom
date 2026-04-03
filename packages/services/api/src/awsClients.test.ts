import { afterEach, describe, expect, it } from 'vitest';
import { createApiAwsClients } from './awsClients.js';

const TEST_ENV_KEYS = [
  'AWS_REGION',
  'COMMANDS_QUEUE_URL',
  'UPLOADS_BUCKET',
  'S3_ENDPOINT',
  'S3_PUBLIC_ENDPOINT',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const;

const originalEnv = Object.fromEntries(TEST_ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  (typeof TEST_ENV_KEYS)[number],
  string | undefined
>;

afterEach(() => {
  for (const key of TEST_ENV_KEYS) {
    const value = originalEnv[key];
    if (typeof value === 'string') {
      process.env[key] = value;
      continue;
    }
    delete process.env[key];
  }
});

describe('createApiAwsClients', () => {
  it('omits optional checksum query params from presigned upload urls for endpoint overrides', async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.COMMANDS_QUEUE_URL = 'commands.fifo';
    process.env.UPLOADS_BUCKET = 'swordworld-uploads';
    process.env.S3_ENDPOINT = 'http://host.docker.internal:4566';
    process.env.S3_PUBLIC_ENDPOINT = 'http://host.docker.internal:4566';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';

    const { uploads } = createApiAwsClients();
    const putUrl = await uploads.createSignedUploadUrl({
      key: 'games/game-1/characters/char-1/appearance/portrait.jpg',
      contentType: 'image/jpeg',
      expiresInSeconds: 900,
    });

    const parsed = new URL(putUrl);
    expect(parsed.origin).toBe('http://host.docker.internal:4566');
    expect(parsed.pathname).toBe('/swordworld-uploads/games/game-1/characters/char-1/appearance/portrait.jpg');
    expect(parsed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(parsed.searchParams.has('x-amz-sdk-checksum-algorithm')).toBe(false);
    expect(parsed.searchParams.has('x-amz-checksum-crc32')).toBe(false);
  });
});
