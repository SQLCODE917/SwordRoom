import { describe, expect, it } from 'vitest';
import type { DbAccess } from '@starter/services-shared';
import type { ResolvedActorIdentity } from './auth.js';
import { requireCommandAccess, requireGameAccess, requireRole } from './routeAuth.js';

describe('routeAuth', () => {
  it('allows game members to read private game metadata', async () => {
    const db = makeDb({
      membership: {
        gameId: 'game-1',
        playerId: 'player-1',
        roles: ['PLAYER'],
      },
    });

    const result = await requireGameAccess({
      db,
      identity: makeIdentity('player-1', ['PLAYER']),
      gameId: 'game-1',
    });

    expect(result.game.gameId).toBe('game-1');
    expect(result.character).toBeNull();
  });

  it('allows character owners to read private game characters', async () => {
    const db = makeDb();

    const result = await requireGameAccess({
      db,
      identity: makeIdentity('player-1', ['PLAYER']),
      gameId: 'game-1',
      characterId: 'char-1',
    });

    expect(result.character?.characterId).toBe('char-1');
  });

  it('rejects non-owners from private game character access', async () => {
    const db = makeDb();

    await expect(
      requireGameAccess({
        db,
        identity: makeIdentity('player-2', ['PLAYER']),
        gameId: 'game-1',
        characterId: 'char-1',
      })
    ).rejects.toMatchObject({ code: 'CHARACTER_ACCESS_REQUIRED', statusCode: 403 });
  });

  it('rejects access to archived games even for members', async () => {
    const db = makeDb({
      membership: {
        gameId: 'game-1',
        playerId: 'player-1',
        roles: ['PLAYER'],
      },
      archived: true,
    });

    await expect(
      requireGameAccess({
        db,
        identity: makeIdentity('player-1', ['PLAYER']),
        gameId: 'game-1',
      })
    ).rejects.toMatchObject({ code: 'GAME_ARCHIVED', statusCode: 404 });
  });

  it('rejects raw token admin roles when no platform entitlement exists', async () => {
    const db = makeDb();

    await expect(
      requireCommandAccess({
        db,
        identity: makeIdentity('admin-1', ['PLAYER', 'ADMIN']),
        commandId: 'cmd-1',
      })
    ).rejects.toMatchObject({ code: 'COMMAND_ACCESS_REQUIRED', statusCode: 403 });
  });

  it('allows admin-entitled actors to read command logs they do not own', async () => {
    const db = makeDb({
      entitlement: {
        playerId: 'admin-1',
        roles: ['ADMIN'],
      },
    });

    const entry = await requireCommandAccess({
      db,
      identity: makeIdentity('admin-1', ['PLAYER']),
      commandId: 'cmd-1',
    });

    expect(entry.commandId).toBe('cmd-1');
  });

  it('requires admin entitlement when admin role is requested explicitly', async () => {
    const db = makeDb();

    await expect(
      requireRole({
        db,
        identity: makeIdentity('player-1', ['PLAYER', 'ADMIN']),
        role: 'ADMIN',
      })
    ).rejects.toMatchObject({ code: 'ROLE_REQUIRED', statusCode: 403 });
  });
});

function makeIdentity(actorId: string, roles: Array<'PLAYER' | 'GM' | 'ADMIN'>): ResolvedActorIdentity {
  return {
    actorId,
    authMode: 'dev',
    displayName: actorId,
    email: null,
    emailNormalized: null,
    emailVerified: false,
    roles,
  };
}

function makeDb(input?: {
  membership?: { gameId: string; playerId: string; roles: Array<'PLAYER' | 'GM'> } | null;
  entitlement?: { playerId: string; roles: Array<'ADMIN'> } | null;
  archived?: boolean;
}): DbAccess {
  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: {} as DbAccess['keyBuilders'],
    async transactWrite() {
      throw new Error('not implemented');
    },
    characterRepository: {
      async getCharacter(gameId, characterId) {
        if (gameId === 'game-1' && characterId === 'char-1') {
          return {
            pk: 'GAME#game-1',
            sk: 'CHAR#char-1',
            type: 'Character',
            gameId: 'game-1',
            characterId: 'char-1',
            ownerPlayerId: 'player-1',
            status: 'DRAFT',
            draft: {
              race: 'HUMAN',
              raisedBy: null,
              subAbility: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 },
              ability: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
              bonus: { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 },
              background: { kind: null, roll2d: null },
              starting: { expTotal: 0, expUnspent: 0, moneyGamels: 0, moneyRoll2d: null, startingSkills: [] },
              skills: [],
              purchases: { weapons: [], armor: [], shields: [], gear: [] },
              identity: { name: 'Test', age: null, gender: null },
              gmNote: null,
            },
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
            version: 1,
          } as Awaited<ReturnType<DbAccess['characterRepository']['getCharacter']>>;
        }
        return null;
      },
      async findOwnedCharacterInGame() {
        return null;
      },
      async listCharactersForGame() {
        return [];
      },
      async listCharactersByOwner() {
        return [];
      },
      async putCharacterDraft() {
        throw new Error('not implemented');
      },
      async updateCharacterWithVersion() {
        throw new Error('not implemented');
      },
    },
    gameRepository: {
      async getGameMetadata(gameId) {
        if (gameId === 'game-1') {
          return {
            pk: 'GAME#game-1',
            sk: 'METADATA',
            type: 'GameMetadata',
            gameId: 'game-1',
            name: 'Game One',
            visibility: 'PRIVATE',
            lifecycleStatus: input?.archived ? 'ARCHIVED' : 'ACTIVE',
            archivedAt: input?.archived ? '2026-03-02T00:00:00.000Z' : null,
            archivedByPlayerId: input?.archived ? 'gm-1' : null,
            createdByPlayerId: 'gm-1',
            gmPlayerId: 'gm-1',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
            version: 1,
          } as Awaited<ReturnType<DbAccess['gameRepository']['getGameMetadata']>>;
        }
        return null;
      },
      async putGameMetadata() {
        throw new Error('not implemented');
      },
      async updateGameMetadataWithVersion() {
        throw new Error('not implemented');
      },
      async listPublicGames() {
        return [];
      },
      async listAllGames() {
        return [];
      },
      async listGamesForPlayer() {
        return [];
      },
      async listGamesForGm(playerId) {
        if (input?.membership?.playerId === playerId && input.membership.roles.includes('GM')) {
          return [
            {
              pk: 'GAME#game-1',
              sk: 'METADATA',
              type: 'GameMetadata',
              gameId: 'game-1',
              name: 'Game One',
              visibility: 'PRIVATE',
              lifecycleStatus: input?.archived ? 'ARCHIVED' : 'ACTIVE',
              archivedAt: input?.archived ? '2026-03-02T00:00:00.000Z' : null,
              archivedByPlayerId: input?.archived ? 'gm-1' : null,
              createdByPlayerId: 'gm-1',
              gmPlayerId: 'gm-1',
              createdAt: '2026-03-01T00:00:00.000Z',
              updatedAt: '2026-03-01T00:00:00.000Z',
              version: 1,
            } as Awaited<ReturnType<DbAccess['gameRepository']['getGameMetadata']>>,
          ];
        }
        return [];
      },
    },
    playerRepository: {
      async getPlayerProfile() {
        return null;
      },
      async getPlayerProfileByEmail() {
        return null;
      },
      async upsertPlayerProfile() {
        throw new Error('not implemented');
      },
      async listUsers() {
        return [];
      },
    },
    entitlementRepository: {
      async getPlatformEntitlement(playerId) {
        if (input?.entitlement && input.entitlement.playerId === playerId) {
          return {
            pk: `PLAYER#${playerId}`,
            sk: 'ENTITLEMENTS#PLATFORM',
            type: 'PlatformEntitlement',
            playerId,
            roles: input.entitlement.roles,
            grantedByPlayerId: 'bootstrap-admin',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          } as Awaited<ReturnType<DbAccess['entitlementRepository']['getPlatformEntitlement']>>;
        }
        return null;
      },
      async upsertPlatformEntitlement() {
        throw new Error('not implemented');
      },
      async deletePlatformEntitlement() {
        throw new Error('not implemented');
      },
      async listPlatformEntitlements() {
        return [];
      },
    },
    membershipRepository: {
      async getMembership(gameId, playerId) {
        if (input?.membership && input.membership.gameId === gameId && input.membership.playerId === playerId) {
          return {
            pk: `GAME#${gameId}`,
            sk: `MEMBER#${playerId}`,
            type: 'GameMember',
            gameId,
            playerId,
            roles: input.membership.roles,
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          } as Awaited<ReturnType<DbAccess['membershipRepository']['getMembership']>>;
        }
        return null;
      },
      async listMembershipsForGame() {
        return [];
      },
      async putMembership() {
        throw new Error('not implemented');
      },
      async deleteMembership() {
        throw new Error('not implemented');
      },
    },
    chatRepository: {
      async queryMessages() {
        return [];
      },
    },
    inviteRepository: {
      async getInvite() {
        return null;
      },
      async listInvitesForGame() {
        return [];
      },
      async putInvite() {
        throw new Error('not implemented');
      },
      async updateInviteWithVersion() {
        throw new Error('not implemented');
      },
    },
    inboxRepository: {
      async addGmInboxItem() {
        throw new Error('not implemented');
      },
      async addPlayerInboxItem() {
        throw new Error('not implemented');
      },
      async queryGmInbox() {
        return [];
      },
      async queryPlayerInbox() {
        return [];
      },
      async deleteGmInboxItem() {
        return;
      },
      async deletePlayerInboxItem() {
        return;
      },
    },
    commandLogRepository: {
      async createAccepted() {
        throw new Error('not implemented');
      },
      async markProcessing() {
        throw new Error('not implemented');
      },
      async markProcessed() {
        throw new Error('not implemented');
      },
      async markFailed() {
        throw new Error('not implemented');
      },
      async get(commandId) {
        if (commandId === 'cmd-1') {
          return {
            pk: 'COMMAND#cmd-1',
            sk: 'METADATA',
            type: 'Command',
            commandType: 'CreateCharacterDraft',
            commandId: 'cmd-1',
            gameId: 'game-1',
            actorId: 'player-1',
            status: 'ACCEPTED',
            errorCode: null,
            errorMessage: null,
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
            idempotencyKey: 'cmd-1',
            resultRef: { characterId: null },
          } as Awaited<ReturnType<DbAccess['commandLogRepository']['get']>>;
        }
        return null;
      },
    },
  };
}
