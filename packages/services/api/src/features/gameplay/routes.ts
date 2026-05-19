import { assertGameMasterActor } from '@starter/services-shared';
import { requireGameAccess } from '../../routeAuth.js';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const gameplayRouteDefinitions: ApiRouteDefinition[] = [
  {
    method: 'GET',
    path: '/games/{gameId}/play',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
      });
      const gameplay = await context.runtime.service.readApis.getPlayerGameplayView(gameId);
      if (!gameplay) {
        context.logFlow('API_GET_GAMEPLAY_VIEW_MISS', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          gameId,
          view: 'PLAYER',
        });
        context.sendJson(404, { error: 'gameplay session not found' });
        return;
      }
      context.logFlow('API_GET_GAMEPLAY_VIEW_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        view: 'PLAYER',
        publicEventCount: gameplay.publicEvents.length,
      });
      context.sendJson(200, gameplay);
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}/chat',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
      });
      const chat = await context.runtime.service.readApis.getGameChat(gameId);
      context.logFlow('API_GET_GAME_CHAT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        participantCount: chat.participants.length,
        messageCount: chat.messages.length,
      });
      context.sendJson(200, chat);
    },
  },
  {
    method: 'GET',
    path: '/gm/{gameId}/play',
    auth: 'gm_required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      await assertGameMasterActor(context.runtime.db, { gameId, actorId: context.identity.actorId });
      const gameplay = await context.runtime.service.readApis.getGmGameplayView(gameId);
      if (!gameplay) {
        context.logFlow('API_GET_GAMEPLAY_VIEW_MISS', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          gameId,
          view: 'GM',
        });
        context.sendJson(404, { error: 'gameplay session not found' });
        return;
      }
      context.logFlow('API_GET_GAMEPLAY_VIEW_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        view: 'GM',
        publicEventCount: gameplay.publicEvents.length,
        gmEventCount: gameplay.gmOnlyEvents?.length ?? 0,
      });
      context.sendJson(200, gameplay);
    },
  },
];
