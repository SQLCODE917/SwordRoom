import { setGameVisibility } from '@starter/engine';
import type { CommandHandler } from '../types.js';

export const setGameVisibilityHandler: CommandHandler<'SetGameVisibility'> = async (ctx, envelope) => {
  const game = await ctx.db.gameRepository.getGameMetadata(envelope.payload.gameId);
  if (!game) {
    const error = new Error(`game not found: ${envelope.payload.gameId}`);
    (error as Error & { code?: string }).code = 'GAME_NOT_FOUND';
    throw error;
  }
  if (game.version !== envelope.payload.expectedVersion) {
    const error = new Error(
      `stale game version for "${game.gameId}": expected ${envelope.payload.expectedVersion}, actual ${game.version}`
    );
    (error as Error & { code?: string }).code = 'STALE_GAME_VERSION';
    throw error;
  }

  const updated = setGameVisibility(
    {
      gameId: game.gameId,
      name: game.name,
      visibility: game.visibility,
      gmPlayerId: game.gmPlayerId,
      version: game.version,
    },
    envelope.payload.visibility
  );

  return {
    writes: [
      {
        kind: 'UPDATE_GAME_METADATA_WITH_VERSION',
        input: {
          gameId: game.gameId,
          expectedVersion: game.version,
          next: {
            name: updated.state.name,
            visibility: updated.state.visibility,
            createdByPlayerId: game.createdByPlayerId,
            gmPlayerId: game.gmPlayerId,
            updatedAt: ctx.nowIso(),
          },
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};
