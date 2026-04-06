import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDispatcher, listRegisteredCommandTypes } from './index.js';
import type { DbAccess } from '@starter/services-shared';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ASYNC_DOC_PATH = resolve(
  HERE,
  '../../../..',
  'docs/vertical-slice.character-creation.async-layer.yaml'
);
const GAMEPLAY_ASYNC_DOC_PATH = resolve(
  HERE,
  '../../../..',
  'docs/vertical-slice.gameplay-loop.async-layer.yaml'
);

function makeDbMock(status: 'PROCESSED' | 'ACCEPTED'): DbAccess {
  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: { gameState: {} as any, commandLog: {} as any },
    async transactWrite() {
      throw new Error('should not be called');
    },
    characterRepository: {
      async getCharacter() {
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
        throw new Error('should not be called');
      },
      async updateCharacterWithVersion() {
        throw new Error('should not be called');
      },
    },
    gameRepository: {
      async getGameMetadata() {
        return {
          pk: 'GAME#g',
          sk: 'METADATA',
          type: 'GameMetadata',
          gameId: 'g',
          name: 'Game',
          visibility: 'PRIVATE',
          lifecycleStatus: 'ACTIVE',
          archivedAt: null,
          archivedByPlayerId: null,
          createdByPlayerId: 'actor-1',
          gmPlayerId: 'actor-1',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          version: 1,
        } as any;
      },
      async putGameMetadata() {
        throw new Error('should not be called');
      },
      async updateGameMetadataWithVersion() {
        throw new Error('should not be called');
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
      async listGamesForGm() {
        return [];
      },
    },
    playerRepository: {
      async getPlayerProfile() {
        return {
          pk: 'PLAYER#actor-1',
          sk: 'PROFILE',
          type: 'PlayerProfile',
          playerId: 'actor-1',
          displayName: 'GM',
          email: 'gm@example.com',
          emailNormalized: 'gm@example.com',
          emailVerified: true,
          roles: ['PLAYER', 'GM'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        } as any;
      },
      async getPlayerProfileByEmail() {
        return null;
      },
      async upsertPlayerProfile() {
        throw new Error('should not be called');
      },
      async listUsers() {
        return [];
      },
    },
    entitlementRepository: {
      async getPlatformEntitlement() {
        return null;
      },
      async upsertPlatformEntitlement() {
        throw new Error("should not be called");
      },
      async deletePlatformEntitlement() {
        throw new Error("should not be called");
      },
      async listPlatformEntitlements() {
        return [];
      },
    },
    membershipRepository: {
      async getMembership() {
        return null;
      },
      async listMembershipsForGame() {
        return [];
      },
      async putMembership() {
        throw new Error('should not be called');
      },
      async deleteMembership() {
        throw new Error('should not be called');
      },
    },
    chatRepository: {
      async queryMessages() {
        return [];
      },
    },
    gameplayRepository: {
      async getSession() {
        return null;
      },
      async putSession() {
        throw new Error('not implemented in dispatcher test mock');
      },
      async addEvent() {
        throw new Error('not implemented in dispatcher test mock');
      },
      async queryEvents() {
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
        throw new Error('should not be called');
      },
      async updateInviteWithVersion() {
        throw new Error('should not be called');
      },
    },
    inboxRepository: {
      async addGmInboxItem() {
        throw new Error('should not be called');
      },
      async addPlayerInboxItem() {
        throw new Error('should not be called');
      },
      async deleteGmInboxItem() {
        throw new Error('should not be called');
      },
      async deletePlayerInboxItem() {
        throw new Error('should not be called');
      },
      async queryGmInbox() {
        return [];
      },
      async queryPlayerInbox() {
        return [];
      },
    },
    commandLogRepository: {
      async createAccepted() {
        throw new Error('should not be called');
      },
      async markProcessing() {
        throw new Error('should not be called');
      },
      async markProcessed() {
        throw new Error('should not be called');
      },
      async markFailed() {
        throw new Error('should not be called');
      },
      async get() {
        return {
          pk: 'COMMAND#x',
          sk: 'METADATA',
          type: 'Command',
          commandType: 'CreateCharacterDraft',
          commandId: 'x',
          gameId: 'g',
          actorId: 'a',
          status,
          errorCode: null,
          errorMessage: null,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          idempotencyKey: 'x',
          resultRef: { characterId: null },
        } as any;
      },
    },
  };
}

describe('services/dispatcher command registry', () => {
  it('registers only command types defined by async-layer contract', () => {
    expect(listRegisteredCommandTypes()).toEqual([
      'CreateGame',
      'ArchiveGame',
      'SetGameVisibility',
      'InvitePlayerToGameByEmail',
      'AcceptGameInvite',
      'RejectGameInvite',
      'SaveCharacterDraft',
      'CreateCharacterDraft',
      'SetCharacterSubAbilities',
      'ApplyStartingPackage',
      'SpendStartingExp',
      'PurchaseStarterEquipment',
      'ConfirmCharacterAppearanceUpload',
      'DeleteCharacter',
      'SendGameChatMessage',
      'SubmitCharacterForApproval',
      'GMReviewCharacter',
      'GMFrameGameplayScene',
      'SubmitGameplayIntent',
      'GMSelectGameplayProcedure',
      'GMResolveGameplayCheck',
      'GMOpenCombatRound',
      'SubmitCombatAction',
      'GMResolveCombatTurn',
      'GMCloseCombat',
    ]);
  });

  it('verifies command types exist in source contract text', () => {
    const asyncDoc = `${readFileSync(ASYNC_DOC_PATH, 'utf8')}\n${readFileSync(GAMEPLAY_ASYNC_DOC_PATH, 'utf8')}`;
    for (const type of listRegisteredCommandTypes()) {
      expect(asyncDoc).toContain(`type: ${type}`);
    }
  });
});

describe('idempotency', () => {
  it('returns no-op when command log status is PROCESSED', async () => {
    const dispatcher = createDispatcher({ db: makeDbMock('PROCESSED') });

    const result = await dispatcher.dispatch({
      commandId: '29f61013-8f47-4f5f-9456-9f07a88e5893',
      gameId: 'game-1',
      actorId: 'actor-1',
      type: 'CreateCharacterDraft',
      schemaVersion: 1,
      payload: { characterId: 'char-1', race: 'HUMAN', raisedBy: null },
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    expect(result.outcome).toBe('NOOP_ALREADY_PROCESSED');
  });
});
