import { isArchivedGame, type GameMetadataItem } from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';

export async function requireActiveGame(db: DbAccess, gameId: string): Promise<GameMetadataItem> {
  const game = await db.gameRepository.getGameMetadata(gameId);
  if (!game) {
    const error = new Error(`game not found: ${gameId}`);
    (error as Error & { code?: string }).code = 'GAME_NOT_FOUND';
    throw error;
  }
  if (isArchivedGame(game)) {
    const error = new Error(`game archived: ${gameId}`);
    (error as Error & { code?: string }).code = 'GAME_ARCHIVED';
    throw error;
  }
  return game;
}

export function assertExpectedGameVersion(game: GameMetadataItem, expectedVersion: number): void {
  if (game.version !== expectedVersion) {
    const error = new Error(
      `stale game version for "${game.gameId}": expected ${expectedVersion}, actual ${game.version}`
    );
    (error as Error & { code?: string }).code = 'STALE_GAME_VERSION';
    throw error;
  }
}
