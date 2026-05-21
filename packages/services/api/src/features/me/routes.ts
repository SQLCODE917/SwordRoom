import { parsePregameObservationSessionSummary } from '@starter/shared';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const meRouteDefinitions: ApiRouteDefinition[] = [
  {
    method: 'POST',
    path: '/me/profile/sync',
    auth: 'required',
    handler: async (context) => {
      const profile = await context.runtime.service.readApis.syncMyProfile({
        authHeader: context.req.headers.authorization,
        bypassActorId: context.identity.authMode === 'dev' ? context.identity.actorId : undefined,
      });
      context.logFlow('API_POST_ME_PROFILE_SYNC', {
        requestId: context.requestId,
        actorId: profile.playerId,
        roles: profile.roles,
        emailNormalized: profile.emailNormalized,
      });
      context.sendJson(200, profile);
    },
  },
  {
    method: 'GET',
    path: '/me',
    auth: 'required',
    handler: async (context) => {
      const existingProfile = await context.runtime.service.readApis.getMyProfile(context.identity.actorId);
      const profile =
        existingProfile ??
        (await context.runtime.service.readApis.syncMyProfile({
          authHeader: context.req.headers.authorization,
          bypassActorId: context.identity.authMode === 'dev' ? context.identity.actorId : undefined,
        }));
      context.logFlow('API_GET_ME', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        found: Boolean(profile),
      });
      context.sendJson(200, profile ?? { playerId: context.identity.actorId });
    },
  },
  {
    method: 'GET',
    path: '/me/characters',
    auth: 'required',
    handler: async (context) => {
      const characters = await context.runtime.service.readApis.listCharactersByOwner(context.identity.actorId);
      context.logFlow('API_GET_MY_CHARACTERS', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: characters.length,
      });
      context.sendJson(200, characters);
    },
  },
  {
    method: 'GET',
    path: '/me/games',
    auth: 'required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listGamesForPlayer(context.identity.actorId);
      context.logFlow('API_GET_MY_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
  {
    method: 'GET',
    path: '/me/inbox',
    auth: 'required',
    handler: async (context) => {
      const inbox = await context.runtime.service.readApis.getMyInbox(context.identity.actorId);
      context.logFlow('API_GET_PLAYER_INBOX', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: inbox.length,
      });
      context.sendJson(200, inbox);
    },
  },
  {
    method: 'GET',
    path: '/me/pregame',
    auth: 'required',
    handler: async (context) => {
      const digest = await context.runtime.service.readApis.getMyPregameDigest(context.identity.actorId);
      context.logFlow('API_GET_PREGAME_DIGEST', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: digest.length,
      });
      context.sendJson(200, digest);
    },
  },
  {
    method: 'POST',
    path: '/me/pregame/session',
    auth: 'required',
    handler: async (context) => {
      const payload = (await context.readJsonBody()) as { session?: unknown; bypassActorId?: string };
      const summary = parsePregameObservationSessionSummary(payload.session);
      if (!summary) {
        context.logFlow('API_POST_PREGAME_SESSION_REJECTED', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          reason: 'INVALID_SESSION_SUMMARY',
        });
        context.sendJson(400, { error: 'request body must include a valid pregame session summary' });
        return;
      }
      const metrics = await context.runtime.service.readApis.recordPregameObservationSession({
        actorId: context.identity.actorId,
        requestId: context.requestId,
        summary,
      });
      for (const metric of metrics) {
        context.logFlow('PREGAME_METRIC', metric as unknown as Record<string, unknown>);
      }
      context.logFlow('API_POST_PREGAME_SESSION', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        creatorSessionId: summary.sessionId,
        entrySource: summary.entrySource,
        activeDurationMs: summary.activeDurationMs,
        elapsedDurationMs: summary.elapsedDurationMs,
      });
      context.sendJson(202, { accepted: true });
    },
  },
];
