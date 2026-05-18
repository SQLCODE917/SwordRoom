import { resolveActorIdentity } from '../../auth.js';
import type { ApiServiceDependencies } from '../../index.js';
import { resolveApiAuthEnv, withEffectiveProfileRoles, type ReadApisSubset } from '../../serviceSupport.js';

export function createMeReadApis(
  deps: ApiServiceDependencies,
  flowLogEnabled: boolean,
  logServiceFlowFn: typeof import('@starter/services-shared').logServiceFlow
): ReadApisSubset<'syncMyProfile' | 'getMyInbox' | 'getMyProfile' | 'listCharactersByOwner' | 'listGamesForPlayer'> {
  return {
    async syncMyProfile(input) {
      const authEnv = resolveApiAuthEnv(deps);
      const identity = await resolveActorIdentity({
        bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
        authorizationHeader: input.authHeader,
        bypassActorId: input.bypassActorId,
        env: authEnv,
      });
      const profile = await deps.db.playerRepository.upsertPlayerProfile({
        playerId: identity.actorId,
        displayName: identity.displayName,
        email: identity.email,
        emailNormalized: identity.emailNormalized,
        emailVerified: identity.emailVerified,
        updatedAt: new Date().toISOString(),
      });
      const response = await withEffectiveProfileRoles(deps.db, profile);
      logServiceFlowFn({
        enabled: flowLogEnabled,
        service: 'api',
        event: 'API_PROFILE_SYNCED',
        data: {
          actorId: identity.actorId,
          authMode: identity.authMode,
          roles: response.roles,
          emailNormalized: identity.emailNormalized,
        },
      });
      return response;
    },

    async listCharactersByOwner(playerId: string) {
      const characters = await deps.db.characterRepository.listCharactersByOwner(playerId);
      const { isActiveGame, isPlayerCharacterLibraryGameId } = await import('@starter/shared');
      const filtered = await Promise.all(
        characters.map(async (character) => {
          if (isPlayerCharacterLibraryGameId(character.gameId)) {
            return character;
          }
          const game = await deps.db.gameRepository.getGameMetadata(character.gameId);
          return game && isActiveGame(game) ? character : null;
        })
      );
      return filtered.filter((character): character is NonNullable<(typeof filtered)[number]> => character !== null);
    },

    async getMyInbox(playerId: string) {
      return deps.db.inboxRepository.queryPlayerInbox(playerId);
    },

    async getMyProfile(playerId: string) {
      const profile = await deps.db.playerRepository.getPlayerProfile(playerId);
      return profile ? withEffectiveProfileRoles(deps.db, profile) : null;
    },

    async listGamesForPlayer(playerId: string) {
      return deps.db.gameRepository.listGamesForPlayer(playerId);
    },
  };
}
