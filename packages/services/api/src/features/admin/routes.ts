import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const adminRouteDefinitions: ApiRouteDefinition[] = [
  {
    method: 'GET',
    path: '/admin/users',
    auth: 'admin_required',
    handler: async (context) => {
      const users = await context.runtime.service.readApis.listUsers();
      context.logFlow('API_GET_ADMIN_USERS', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: users.length,
      });
      context.sendJson(200, users);
    },
  },
  {
    method: 'GET',
    path: '/admin/games',
    auth: 'admin_required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listAllGames();
      context.logFlow('API_GET_ADMIN_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
];
