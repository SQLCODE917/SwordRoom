import { assertGameMasterActor } from '@starter/services-shared';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const gmRouteDefinitions: ApiRouteDefinition[] = [
  {
    method: 'GET',
    path: '/gm/games',
    auth: 'required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listGamesForGm(context.identity.actorId);
      context.logFlow('API_GET_GM_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
  {
    method: 'GET',
    path: '/gm/{gameId}/inbox',
    auth: 'gm_required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      await assertGameMasterActor(context.runtime.db, { gameId, actorId: context.identity.actorId });
      const inbox = await context.runtime.service.readApis.getGmInbox(gameId);
      context.logFlow('API_GET_GM_INBOX', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        count: inbox.length,
      });
      context.sendJson(200, inbox);
    },
  },
];
