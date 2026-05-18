import { requireGameAccess } from '../../routeAuth.js';
import type { ApiRouteDefinition } from '../../httpRouteTypes.js';

export const gameRouteDefinitions: ApiRouteDefinition[] = [
  {
    method: 'GET',
    path: '/games/public',
    auth: 'required',
    handler: async (context) => {
      const games = await context.runtime.service.readApis.listPublicGames();
      context.logFlow('API_GET_PUBLIC_GAMES', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        count: games.length,
      });
      context.sendJson(200, games);
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const { game } = await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
      });
      context.logFlow('API_GET_GAME_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        visibility: game.visibility,
        gmPlayerId: game.gmPlayerId,
      });
      context.sendJson(200, game);
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}/me',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
      });
      const actorContext = await context.runtime.service.readApis.getGameActorContext(gameId, context.identity.actorId);
      context.logFlow('API_GET_GAME_ACTOR_CONTEXT', {
        requestId: context.requestId,
        gameId,
        actorId: context.identity.actorId,
        isGameMaster: actorContext.isGameMaster,
        roles: actorContext.roles,
        gmPlayerId: actorContext.gmPlayerId,
      });
      context.sendJson(200, actorContext);
    },
  },
  {
    method: 'GET',
    path: '/games/{gameId}/characters/{characterId}',
    auth: 'required',
    handler: async (context) => {
      const gameId = context.params.gameId!;
      const characterId = context.params.characterId!;
      await requireGameAccess({
        db: context.runtime.db,
        identity: context.identity,
        gameId,
        characterId,
      });
      const character = await context.runtime.service.readApis.getCharacter(gameId, characterId);
      if (!character) {
        context.logFlow('API_GET_CHARACTER_MISS', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          gameId,
          characterId,
        });
        context.sendJson(404, { error: 'character not found' });
        return;
      }
      context.logFlow('API_GET_CHARACTER_HIT', {
        requestId: context.requestId,
        actorId: context.identity.actorId,
        gameId,
        characterId,
        status: (character as { status?: unknown }).status ?? null,
        version: (character as { version?: unknown }).version ?? null,
      });
      context.sendJson(200, character);
    },
  },
  {
    method: 'GET',
    path: '/players/{playerId}/characters/{characterId}',
    auth: 'required',
    handler: async (context) => {
      const playerId = context.params.playerId!;
      const characterId = context.params.characterId!;
      if (context.identity.actorId !== playerId) {
        context.logFlow('API_GET_OWNED_CHARACTER_FORBIDDEN', {
          requestId: context.requestId,
          actorId: context.identity.actorId,
          playerId,
          characterId,
        });
        context.sendJson(403, { error: `player "${playerId}" does not match signed-in actor` });
        return;
      }
      const character = await context.runtime.service.readApis.getOwnedCharacter(playerId, characterId);
      if (!character) {
        context.logFlow('API_GET_OWNED_CHARACTER_MISS', {
          requestId: context.requestId,
          playerId,
          characterId,
        });
        context.sendJson(404, { error: 'character not found' });
        return;
      }
      context.logFlow('API_GET_OWNED_CHARACTER_HIT', {
        requestId: context.requestId,
        playerId,
        characterId,
        status: (character as { status?: unknown }).status ?? null,
        version: (character as { version?: unknown }).version ?? null,
      });
      context.sendJson(200, character);
    },
  },
];
