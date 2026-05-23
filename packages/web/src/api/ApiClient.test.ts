import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, getApiBaseUrl } from './ApiClient';
import { createDevAuthProvider, writeDevSession } from '../auth/DevAuthProvider';
import { activatePregameObservationContext, deactivatePregameObservationContext } from '../logging/pregameObservationContext';

describe('getApiBaseUrl', () => {
  it('uses default local API base when env is unset', () => {
    expect(getApiBaseUrl()).toBe('/api');
  });
});

describe('createApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    deactivatePregameObservationContext('creator-session-1');
  });

  it('posts one command with dev bypass actor id', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ accepted: true, commandId: 'cmd-1', status: 'ACCEPTED' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000',
      auth: createDevAuthProvider({ VITE_AUTH_MODE: 'dev', VITE_DEV_ACTOR_ID: 'player-aaa' }),
    });

    await api.postCommand({
      envelope: {
        commandId: '29f61013-8f47-4f5f-9456-9f07a88e5893',
        gameId: 'game-1',
        type: 'CreateCharacterDraft',
        schemaVersion: 1,
        createdAt: '2026-03-02T00:00:00.000Z',
        payload: { characterId: 'char-1', race: 'HUMAN', raisedBy: null },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = (fetchMock.mock.calls as unknown[][])[0];
    const request = firstCall?.[1] as RequestInit | undefined;
    const parsedBody = JSON.parse(String(request?.body)) as { bypassActorId?: string };
    expect(parsedBody.bypassActorId).toBe('player-aaa');
  });

  it('adds Authorization header only in oidc mode', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ commandId: 'cmd-2', status: 'ACCEPTED', errorCode: null, errorMessage: null }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000',
      auth: createDevAuthProvider({ VITE_AUTH_MODE: 'oidc', VITE_OIDC_BEARER_TOKEN: 'oidc-token' }),
    });

    await api.getCommandStatus('cmd-2');

    const firstCall = (fetchMock.mock.calls as unknown[][])[0];
    const request = firstCall?.[1] as RequestInit | undefined;
    const headers = new Headers(request?.headers);
    expect(headers.get('Authorization')).toBe('Bearer oidc-token');
    expect(headers.get('x-amzn-trace-id')).toMatch(/^Root=1-[0-9a-f]{8}-[0-9a-f]{24};Parent=[0-9a-f]{16};Sampled=1$/);
    expect(headers.get('x-swordworld-client-session-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(headers.get('x-swordworld-client-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('posts profile sync with dev bypass actor id', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ playerId: 'player-aaa', roles: ['PLAYER'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000',
      auth: createDevAuthProvider({ VITE_AUTH_MODE: 'dev', VITE_DEV_ACTOR_ID: 'player-aaa' }),
    });

    await api.syncMyProfile();

    const firstCall = (fetchMock.mock.calls as unknown[][])[0];
    expect(firstCall?.[0]).toBe('http://localhost:3000/me/profile/sync');
    const request = firstCall?.[1] as RequestInit | undefined;
    const parsedBody = JSON.parse(String(request?.body)) as { bypassActorId?: string };
    expect(parsedBody.bypassActorId).toBe('player-aaa');
  });

  it('adds semantic creator observation headers to existing requests without an extra network call', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    activatePregameObservationContext({
      surface: 'creator',
      sessionId: 'creator-session-1',
      sessionStartedAt: '2026-05-21T18:00:00.000Z',
      entrySource: 'digest',
      entryFocus: 'resume',
      wizardMode: 'apply',
      draftMode: 'existing',
      gameId: 'game-1',
      characterId: 'char-1',
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000',
      auth: createDevAuthProvider({ VITE_AUTH_MODE: 'dev', VITE_DEV_ACTOR_ID: 'player-aaa' }),
    });

    await api.getMyCharacters();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = (fetchMock.mock.calls as unknown[][])[0];
    const request = firstCall?.[1] as RequestInit | undefined;
    const headers = new Headers(request?.headers);
    expect(headers.get('x-swordworld-pregame-surface')).toBe('creator');
    expect(headers.get('x-swordworld-pregame-session-id')).toBe('creator-session-1');
    expect(headers.get('x-swordworld-pregame-session-start')).toBe('1');
    expect(headers.get('x-swordworld-pregame-entry-source')).toBe('digest');
    expect(headers.get('x-swordworld-pregame-draft-mode')).toBe('existing');
  });

  it('reads gameplay lifecycle from the game state route', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        gameId: 'game-1',
        phase: 'PREGAME',
        hasGameplaySession: false,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000',
      auth: createDevAuthProvider({ VITE_AUTH_MODE: 'dev', VITE_DEV_ACTOR_ID: 'player-aaa' }),
    });

    const lifecycle = await api.getGameplayLifecycle('game-1');

    const firstCall = (fetchMock.mock.calls as unknown[][])[0];
    expect(firstCall?.[0]).toBe('http://localhost:3000/games/game-1/state');
    expect(lifecycle).toEqual({
      gameId: 'game-1',
      phase: 'PREGAME',
      hasGameplaySession: false,
    });
  });

  it('posts a creator session summary through the semantic pregame session route', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ accepted: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000',
      auth: createDevAuthProvider({ VITE_AUTH_MODE: 'dev', VITE_DEV_ACTOR_ID: 'player-aaa' }),
    });

    await api.postPregameObservationSession({
      keepalive: true,
      session: {
        surface: 'creator',
        sessionId: 'creator-session-1',
        sessionStartedAt: '2026-05-21T18:00:00.000Z',
        entrySource: 'chat',
        entryFocus: 'prompt',
        wizardMode: 'apply',
        draftMode: 'existing',
        gameId: 'game-1',
        characterId: 'char-1',
        completedAt: '2026-05-21T18:02:00.000Z',
        activeDurationMs: 45000,
        elapsedDurationMs: 120000,
        completionReason: 'pagehide',
      },
    });

    const firstCall = (fetchMock.mock.calls as unknown[][])[0];
    expect(firstCall?.[0]).toBe('http://localhost:3000/me/pregame/session');
    const request = firstCall?.[1] as RequestInit | undefined;
    expect(request?.keepalive).toBe(true);
    const parsedBody = JSON.parse(String(request?.body)) as { bypassActorId?: string; session?: { entrySource?: string } };
    expect(parsedBody.bypassActorId).toBe('player-aaa');
    expect(parsedBody.session?.entrySource).toBe('chat');
  });
});
