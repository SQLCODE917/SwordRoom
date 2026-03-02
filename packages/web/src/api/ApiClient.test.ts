import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, getApiBaseUrl } from './ApiClient';
import { createDevAuthProvider } from '../auth/DevAuthProvider';

describe('getApiBaseUrl', () => {
  it('uses default local API base when env is unset', () => {
    expect(getApiBaseUrl()).toBe('/api');
  });
});

describe('createApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts one command with dev bypass actor id', async () => {
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
  });
});
