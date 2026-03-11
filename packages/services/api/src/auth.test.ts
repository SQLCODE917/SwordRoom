import { describe, expect, it } from 'vitest';
import { resolveActorIdentity } from './auth.js';

describe('resolveActorIdentity', () => {
  it('accepts the dev actor header in dev mode', async () => {
    await expect(
      resolveActorIdentity({
        env: { AUTH_MODE: 'dev' },
        bypassAllowed: false,
        devActorIdHeader: 'player-aaa',
      })
    ).resolves.toMatchObject({
      actorId: 'player-aaa',
      authMode: 'dev',
      roles: ['PLAYER'],
    });
  });

  it('prefers bypassActorId over the dev actor header when both are present', async () => {
    await expect(
      resolveActorIdentity({
        env: { AUTH_MODE: 'dev' },
        bypassAllowed: true,
        bypassActorId: 'gm-zzz',
        devActorIdHeader: 'player-aaa',
      })
    ).resolves.toMatchObject({
      actorId: 'gm-zzz',
      authMode: 'dev',
      roles: expect.arrayContaining(['PLAYER', 'GM']),
    });
  });
});
