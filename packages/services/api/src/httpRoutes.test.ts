import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { dispatchApiRoute } from './httpRoutes.js';

describe('dispatchApiRoute', () => {
  it('returns 204 for preflight OPTIONS requests without requiring auth', async () => {
    const end = vi.fn();
    const readJson = vi.fn();
    const sendJson = vi.fn();
    const logFlow = vi.fn();

    const handled = await dispatchApiRoute({
      req: {
        method: 'OPTIONS',
        headers: {},
      } as IncomingMessage,
      res: {
        statusCode: 200,
        end,
      } as unknown as ServerResponse,
      url: new URL('https://api.swordroom.online/me'),
      requestId: 'req-1',
      runtime: {
        db: {} as never,
        uploads: {} as never,
        service: {} as never,
        authBypassAllowed: false,
        maxUploadBytes: 5 * 1024 * 1024,
        allowedContentTypes: new Set(),
      },
      readJson,
      sendJson,
      logFlow,
      readDevActorIdHeader: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(end).toHaveBeenCalledOnce();
    expect(readJson).not.toHaveBeenCalled();
    expect(sendJson).not.toHaveBeenCalled();
    expect(logFlow).toHaveBeenCalledWith('API_OPTIONS_PREFLIGHT', {
      requestId: 'req-1',
      path: '/me',
    });
  });

  it('uses the Authorization token instead of dev bypass for trusted oidc profile sync', async () => {
    const syncMyProfile = vi.fn().mockResolvedValue({
      playerId: 'player-oidc',
      displayName: 'Player Oidc',
      email: 'player@example.com',
      emailNormalized: 'player@example.com',
      emailVerified: true,
      roles: ['PLAYER'],
    });
    const sendJson = vi.fn();

    const handled = await dispatchApiRoute({
      req: {
        method: 'POST',
        headers: {
          authorization: 'Bearer oidc-id-token',
        },
      } as IncomingMessage,
      res: {
        statusCode: 200,
        end: vi.fn(),
      } as unknown as ServerResponse,
      url: new URL('https://api.swordroom.online/me/profile/sync'),
      requestId: 'req-2',
      runtime: {
        db: {} as never,
        uploads: {} as never,
        service: {
          readApis: {
            syncMyProfile,
          },
        } as never,
        authBypassAllowed: false,
        maxUploadBytes: 5 * 1024 * 1024,
        allowedContentTypes: new Set(),
      },
      trustedIdentity: {
        actorId: 'player-oidc',
        authMode: 'oidc',
        displayName: 'Player Oidc',
        email: 'player@example.com',
        emailNormalized: 'player@example.com',
        emailVerified: true,
        roles: ['PLAYER'],
      },
      readJson: vi.fn().mockResolvedValue({}),
      sendJson,
      logFlow: vi.fn(),
      readDevActorIdHeader: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(syncMyProfile).toHaveBeenCalledWith({
      authHeader: 'Bearer oidc-id-token',
      bypassActorId: undefined,
    });
    expect(sendJson).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({ playerId: 'player-oidc' }));
  });

  it('keeps dev bypass for local dev command posting', async () => {
    const postCommands = vi.fn().mockResolvedValue({
      accepted: true,
      commandId: 'cmd-1',
      status: 'ACCEPTED',
    });

    const handled = await dispatchApiRoute({
      req: {
        method: 'POST',
        headers: {
          authorization: 'Bearer ignored-in-dev',
        },
      } as IncomingMessage,
      res: {
        statusCode: 200,
        end: vi.fn(),
      } as unknown as ServerResponse,
      url: new URL('https://api.swordroom.online/commands'),
      requestId: 'req-3',
      runtime: {
        db: {} as never,
        uploads: {} as never,
        service: {
          postCommands,
        } as never,
        authBypassAllowed: true,
        maxUploadBytes: 5 * 1024 * 1024,
        allowedContentTypes: new Set(),
      },
      trustedIdentity: {
        actorId: 'player-dev',
        authMode: 'dev',
        displayName: 'player-dev',
        email: null,
        emailNormalized: null,
        emailVerified: false,
        roles: ['PLAYER'],
      },
      readJson: vi.fn().mockResolvedValue({
        envelope: {
          commandId: 'cmd-1',
          type: 'CreateGame',
          schemaVersion: 1,
          createdAt: '2026-04-02T00:00:00.000Z',
          payload: { name: 'Demo Game' },
        },
      }),
      sendJson: vi.fn(),
      logFlow: vi.fn(),
      readDevActorIdHeader: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(postCommands).toHaveBeenCalledWith({
      envelope: {
        commandId: 'cmd-1',
        type: 'CreateGame',
        schemaVersion: 1,
        createdAt: '2026-04-02T00:00:00.000Z',
        payload: { name: 'Demo Game' },
      },
      authHeader: 'Bearer ignored-in-dev',
      bypassActorId: 'player-dev',
    });
  });

  it('emits a creator session metric when a creator session start header is present', async () => {
    const logFlow = vi.fn();
    const listCharactersByOwner = vi.fn().mockResolvedValue([]);

    const handled = await dispatchApiRoute({
      req: {
        method: 'GET',
        headers: {
          'x-swordworld-pregame-surface': 'creator',
          'x-swordworld-pregame-session-id': 'creator-session-1',
          'x-swordworld-pregame-session-started-at': '2026-05-21T18:00:00.000Z',
          'x-swordworld-pregame-session-start': '1',
          'x-swordworld-pregame-entry-source': 'digest',
          'x-swordworld-pregame-entry-focus': 'resume',
          'x-swordworld-pregame-wizard-mode': 'apply',
          'x-swordworld-pregame-draft-mode': 'existing',
          'x-swordworld-pregame-game-id': 'game-1',
          'x-swordworld-pregame-character-id': 'char-1',
        },
      } as IncomingMessage,
      res: {
        statusCode: 200,
        end: vi.fn(),
      } as unknown as ServerResponse,
      url: new URL('https://api.swordroom.online/me/characters'),
      requestId: 'req-4',
      runtime: {
        db: {} as never,
        uploads: {} as never,
        service: {
          readApis: {
            listCharactersByOwner,
          },
        } as never,
        authBypassAllowed: false,
        maxUploadBytes: 5 * 1024 * 1024,
        allowedContentTypes: new Set(),
      },
      trustedIdentity: {
        actorId: 'player-1',
        authMode: 'dev',
        displayName: 'player-1',
        email: null,
        emailNormalized: null,
        emailVerified: false,
        roles: ['PLAYER'],
      },
      readJson: vi.fn(),
      sendJson: vi.fn(),
      logFlow,
      readDevActorIdHeader: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(logFlow).toHaveBeenCalledWith(
      'PREGAME_METRIC',
      expect.objectContaining({
        metricName: 'CREATOR_SESSION_STARTED',
        metricDimensions: expect.objectContaining({
          entrySource: 'digest',
          entryFocus: 'resume',
        }),
        metricContext: expect.objectContaining({
          actorId: 'player-1',
          gameId: 'game-1',
          characterId: 'char-1',
          creatorSessionId: 'creator-session-1',
        }),
        metricTrace: {
          requestId: 'req-4',
          commandId: null,
        },
      })
    );
  });

  it('accepts a creator session summary and emits completion metrics', async () => {
    const logFlow = vi.fn();
    const recordPregameObservationSession = vi.fn().mockResolvedValue([
      {
        metricSchema: 'pregame.v1',
        metricKind: 'counter',
        metricName: 'CREATOR_SESSION_COMPLETED',
        metricValue: 1,
        metricUnit: 'Count',
        metricDimensions: { surface: 'creator', entrySource: 'digest' },
        metricContext: { actorId: 'player-1', creatorSessionId: 'creator-session-1' },
        metricTrace: { requestId: 'req-5', commandId: null },
      },
    ]);
    const sendJson = vi.fn();

    const handled = await dispatchApiRoute({
      req: {
        method: 'POST',
        headers: {},
      } as IncomingMessage,
      res: {
        statusCode: 200,
        end: vi.fn(),
      } as unknown as ServerResponse,
      url: new URL('https://api.swordroom.online/me/pregame/session'),
      requestId: 'req-5',
      runtime: {
        db: {} as never,
        uploads: {} as never,
        service: {
          readApis: {
            recordPregameObservationSession,
          },
        } as never,
        authBypassAllowed: false,
        maxUploadBytes: 5 * 1024 * 1024,
        allowedContentTypes: new Set(),
      },
      trustedIdentity: {
        actorId: 'player-1',
        authMode: 'dev',
        displayName: 'player-1',
        email: null,
        emailNormalized: null,
        emailVerified: false,
        roles: ['PLAYER'],
      },
      readJson: vi.fn().mockResolvedValue({
        session: {
          surface: 'creator',
          sessionId: 'creator-session-1',
          sessionStartedAt: '2026-05-21T18:00:00.000Z',
          entrySource: 'digest',
          entryFocus: 'resume',
          wizardMode: 'apply',
          draftMode: 'existing',
          gameId: 'game-1',
          characterId: 'char-1',
          completedAt: '2026-05-21T18:05:00.000Z',
          activeDurationMs: 90000,
          elapsedDurationMs: 300000,
          completionReason: 'unmount',
        },
      }),
      sendJson,
      logFlow,
      readDevActorIdHeader: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(recordPregameObservationSession).toHaveBeenCalledWith({
      actorId: 'player-1',
      requestId: 'req-5',
      summary: expect.objectContaining({
        sessionId: 'creator-session-1',
        entrySource: 'digest',
        activeDurationMs: 90000,
      }),
    });
    expect(logFlow).toHaveBeenCalledWith(
      'PREGAME_METRIC',
      expect.objectContaining({
        metricName: 'CREATOR_SESSION_COMPLETED',
      })
    );
    expect(sendJson).toHaveBeenCalledWith(expect.anything(), 202, { accepted: true });
  });
});
