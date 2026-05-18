import { isActiveGame, isPlayerCharacterLibraryGameId, toPlayerCharacterLibraryGameId } from '@starter/shared';
import { getGameActorContext } from '@starter/services-shared';
import type { ApiServiceDependencies } from '../../index.js';
import { type ReadApisSubset } from '../../serviceSupport.js';

export function createGameReadApis(
  deps: ApiServiceDependencies
): ReadApisSubset<'getGame' | 'getCharacter' | 'getOwnedCharacter' | 'listPublicGames' | 'getGameActorContext'> {
  return {
    async getGame(gameId: string) {
      const game = await deps.db.gameRepository.getGameMetadata(gameId);
      return game && isActiveGame(game) ? game : null;
    },

    async getCharacter(gameId: string, characterId: string) {
      if (!isPlayerCharacterLibraryGameId(gameId)) {
        const game = await deps.db.gameRepository.getGameMetadata(gameId);
        if (!game || !isActiveGame(game)) {
          return null;
        }
      }
      const character = await deps.db.characterRepository.getCharacter(gameId, characterId);
      if (!character) {
        return null;
      }

      const imageKey = character.draft.appearance?.imageKey ?? null;
      if (!imageKey) {
        return character;
      }

      return {
        ...character,
        draft: {
          ...character.draft,
          appearance: {
            imageKey,
            imageUrl: await deps.uploads.createSignedDownloadUrl({
              key: imageKey,
              expiresInSeconds: 900,
            }),
            updatedAt: character.draft.appearance?.updatedAt ?? null,
          },
        },
      };
    },

    async getOwnedCharacter(playerId: string, characterId: string) {
      const namespaceGameId = toPlayerCharacterLibraryGameId(playerId);
      const character = await deps.db.characterRepository.getCharacter(namespaceGameId, characterId);
      if (!character) {
        return null;
      }

      const imageKey = character.draft.appearance?.imageKey ?? null;
      if (!imageKey) {
        return character;
      }

      return {
        ...character,
        draft: {
          ...character.draft,
          appearance: {
            imageKey,
            imageUrl: await deps.uploads.createSignedDownloadUrl({
              key: imageKey,
              expiresInSeconds: 900,
            }),
            updatedAt: character.draft.appearance?.updatedAt ?? null,
          },
        },
      };
    },

    async listPublicGames() {
      return deps.db.gameRepository.listPublicGames();
    },

    async getGameActorContext(gameId: string, actorId: string) {
      const context = await getGameActorContext(deps.db, { gameId, actorId });
      return {
        actorId: context.actorId,
        displayName: context.displayName,
        roles: context.roles,
        gmPlayerId: context.gmPlayerId,
        isGameMaster: context.isGameMaster,
      };
    },
  };
}
