import { describe, expect, it } from 'vitest';
import { createDevAuthProvider } from './DevAuthProvider';

describe('createDevAuthProvider', () => {
  it('injects bypassActorId in dev mode and skips Authorization header', async () => {
    const auth = createDevAuthProvider({
      VITE_AUTH_MODE: 'dev',
      VITE_DEV_ACTOR_ID: 'player-aaa',
    });
    const payload = auth.withActor({ envelope: { commandId: 'c1' } });
    const headers = await auth.withAuthHeaders();

    expect(payload.bypassActorId).toBe('player-aaa');
    expect(headers.get('Authorization')).toBeNull();
  });

  it('adds Authorization header only in oidc mode when token exists', async () => {
    const auth = createDevAuthProvider({
      VITE_AUTH_MODE: 'oidc',
      VITE_OIDC_BEARER_TOKEN: 'token-1',
    });
    const headers = await auth.withAuthHeaders();
    const payload = auth.withActor({ envelope: { commandId: 'c2' } });

    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(payload.bypassActorId).toBeUndefined();
  });
});
