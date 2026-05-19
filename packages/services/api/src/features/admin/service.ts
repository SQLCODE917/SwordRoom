import { withEffectiveProfileRoles, type ReadApisSubset } from '../../serviceSupport.js';
import type { ApiServiceDependencies } from '../../index.js';

export function createAdminReadApis(deps: ApiServiceDependencies): ReadApisSubset<'listAllGames' | 'listUsers'> {
  return {
    async listAllGames() {
      return deps.db.gameRepository.listAllGames();
    },

    async listUsers() {
      const users = await deps.db.playerRepository.listUsers();
      return Promise.all(users.map((user) => withEffectiveProfileRoles(deps.db, user)));
    },
  };
}
