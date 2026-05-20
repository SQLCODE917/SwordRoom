import { requireGameAccess } from '../../routeAuth.js';
import { requireActiveGameMetadata } from '../../serviceSupport.js';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const pregameRouteDefinitions: ApiRouteDefinition[] = [
  {
    method: 'GET',
    path: '/games/{gameId}/pregame',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const game = await requireActiveGameMetadata(context.runtime.db, gameId);

      if (game.visibility !== 'PUBLIC') {
        await requireGameAccess({
          db: context.runtime.db,
          identity: context.identity,
          gameId,
        });
      }

      const planning = await context.runtime.service.readApis.getPregamePlanning(gameId, context.identity.actorId);
      context.logFlow('API_GET_PREGAME_PLANNING', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        isMember: planning.viewer.isMember,
        isGameMaster: planning.viewer.isGameMaster,
        hasActivePrompt: planning.activePrompt !== null,
        claimCount: planning.recentClaims.length,
      });
      context.sendJson(200, planning);
    },
  },
];
