import { afterEach, describe, expect, it } from 'vitest';
import {
  createDevAuthProvider,
  loginOrRegisterDevAccount,
  logoutDevSession,
  registerDevAccount,
  writeDevSession,
} from './DevAuthProvider';

describe('createDevAuthProvider', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('injects bypassActorId in dev mode only when a session exists', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    const auth = createDevAuthProvider({
      VITE_AUTH_MODE: 'dev',
    });
    const payload = auth.withActor({ envelope: { commandId: 'c1' } });
    const headers = await auth.withAuthHeaders();

    expect(payload.bypassActorId).toBe('player-aaa');
    expect(headers.get('Authorization')).toBeNull();
  });

  it('stays unauthenticated in dev mode without a session', () => {
    const auth = createDevAuthProvider({
      VITE_AUTH_MODE: 'dev',
    });
    const payload = auth.withActor({ envelope: { commandId: 'c1' } });

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.actorId).toBe('');
    expect(payload.bypassActorId).toBeUndefined();
  });

  it('reads the current dev session dynamically after provider creation', async () => {
    const auth = createDevAuthProvider({
      VITE_AUTH_MODE: 'dev',
    });

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.actorId).toBe('');

    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.actorId).toBe('player-aaa');
    expect((await auth.withAuthHeaders()).get('x-dev-actor-id')).toBe('player-aaa');
    expect(auth.withActor({ envelope: { commandId: 'c1' } }).bypassActorId).toBe('player-aaa');
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

  it('registers and logs in a new local dev account', async () => {
    const account = await registerDevAccount('new-user', 'secret');
    const auth = createDevAuthProvider({ VITE_AUTH_MODE: 'dev' });

    expect(account.actorId.startsWith('player-new-user-')).toBe(true);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.actorId).toBe(account.actorId);
  });

  it('login button creates an account when it does not exist', async () => {
    const account = await loginOrRegisterDevAccount('another-user', 'secret');
    const auth = createDevAuthProvider({ VITE_AUTH_MODE: 'dev' });

    expect(account.username).toBe('another-user');
    expect(auth.actorId).toBe(account.actorId);
    logoutDevSession();
    expect(createDevAuthProvider({ VITE_AUTH_MODE: 'dev' }).isAuthenticated).toBe(false);
  });
});
