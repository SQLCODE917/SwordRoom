import { createGame } from '@starter/engine';
import type { CommandHandler } from '../types.js';

export const createGameHandler: CommandHandler<'CreateGame'> = async (ctx, envelope) => {
  const existing = await ctx.db.gameRepository.getGameMetadata(envelope.gameId);
  if (existing) {
    const error = new Error(`game already exists: ${envelope.gameId}`);
    (error as Error & { code?: string }).code = 'GAME_ALREADY_EXISTS';
    throw error;
  }

  const created = createGame({
    gameId: envelope.gameId,
    name: envelope.payload.name,
    gmPlayerId: envelope.actorId,
  });
  if (created.errors.length > 0 || !created.state) {
    const first = created.errors[0] ?? { code: 'GAME_CREATE_FAILED', message: 'failed to create game' };
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }

  return {
    writes: [
      {
        kind: 'PUT_GAME_METADATA',
        input: {
          gameId: created.state.gameId,
          name: created.state.name,
          visibility: created.state.visibility,
          lifecycleStatus: 'ACTIVE',
          archivedAt: null,
          archivedByPlayerId: null,
          createdByPlayerId: envelope.actorId,
          gmPlayerId: envelope.actorId,
          createdAt: envelope.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      {
        kind: 'PUT_GAME_MEMBER',
        input: {
          gameId: created.state.gameId,
          playerId: envelope.actorId,
          roles: ['GM'],
          createdAt: envelope.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};
