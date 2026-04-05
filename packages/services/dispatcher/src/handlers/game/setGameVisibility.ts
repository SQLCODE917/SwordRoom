import { setGameVisibility } from '@starter/engine';
import type { CommandHandler } from '../types.js';
import { assertExpectedGameVersion, requireActiveGame } from './shared.js';

export const setGameVisibilityHandler: CommandHandler<'SetGameVisibility'> = async (ctx, envelope) => {
  const game = await requireActiveGame(ctx.db, envelope.payload.gameId);
  assertExpectedGameVersion(game, envelope.payload.expectedVersion);

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
            lifecycleStatus: game.lifecycleStatus,
            archivedAt: game.archivedAt,
            archivedByPlayerId: game.archivedByPlayerId,
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
