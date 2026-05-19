import type { ApiServiceDependencies } from '../../index.js';
import { type ReadApisSubset } from '../../serviceSupport.js';

export function createGmReadApis(deps: ApiServiceDependencies): ReadApisSubset<'listGamesForGm' | 'getGmInbox'> {
  return {
    async listGamesForGm(playerId: string) {
      return deps.db.gameRepository.listGamesForGm(playerId);
    },

    async getGmInbox(gameId: string) {
      return deps.db.inboxRepository.queryGmInbox(gameId);
    },
  };
}
