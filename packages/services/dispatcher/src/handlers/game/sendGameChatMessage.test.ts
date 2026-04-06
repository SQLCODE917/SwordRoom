import { describe, expect, it, vi } from 'vitest';
import type { DbAccess } from '@starter/services-shared';
import { sendGameChatMessageHandler } from './sendGameChatMessage.js';

function makeDb(overrides?: Partial<DbAccess>): DbAccess {
  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: {} as DbAccess['keyBuilders'],
    transactWrite: vi.fn(),
    characterRepository: {
      getCharacter: vi.fn(async () => null),
      findOwnedCharacterInGame: vi.fn(async () => null),
      listCharactersForGame: vi.fn(async () => []),
      listCharactersByOwner: vi.fn(async () => []),
      putCharacterDraft: vi.fn(),
      updateCharacterWithVersion: vi.fn(),
    },
    gameRepository: {
      getGameMetadata: vi.fn(async () => ({
        pk: 'GAME#game-1',
        sk: 'METADATA',
        type: 'GameMetadata',
        gameId: 'game-1',
        name: 'Game One',
        visibility: 'PUBLIC',
        lifecycleStatus: 'ACTIVE',
        archivedAt: null,
        archivedByPlayerId: null,
        createdByPlayerId: 'gm-1',
        gmPlayerId: 'gm-1',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        version: 1,
      })),
      putGameMetadata: vi.fn(),
      updateGameMetadataWithVersion: vi.fn(),
      listPublicGames: vi.fn(async () => []),
      listAllGames: vi.fn(async () => []),
      listGamesForPlayer: vi.fn(async () => []),
      listGamesForGm: vi.fn(async () => []),
    },
    playerRepository: {
      getPlayerProfile: vi.fn(async () => null),
      getPlayerProfileByEmail: vi.fn(async () => null),
      upsertPlayerProfile: vi.fn(),
      listUsers: vi.fn(async () => []),
    },
    entitlementRepository: {
      getPlatformEntitlement: vi.fn(async () => null),
      upsertPlatformEntitlement: vi.fn(),
      deletePlatformEntitlement: vi.fn(),
      listPlatformEntitlements: vi.fn(async () => []),
    },
    membershipRepository: {
      getMembership: vi.fn(async () => null),
      listMembershipsForGame: vi.fn(async () => []),
      putMembership: vi.fn(),
      deleteMembership: vi.fn(),
    },
    chatRepository: {
      queryMessages: vi.fn(async () => []),
    },
    gameplayRepository: {
      getSession: vi.fn(async () => null),
      putSession: vi.fn(),
      addEvent: vi.fn(),
      queryEvents: vi.fn(async () => []),
    },
    inviteRepository: {
      getInvite: vi.fn(async () => null),
      listInvitesForGame: vi.fn(async () => []),
      putInvite: vi.fn(),
      updateInviteWithVersion: vi.fn(),
    },
    inboxRepository: {
      addGmInboxItem: vi.fn(),
      addPlayerInboxItem: vi.fn(),
      queryGmInbox: vi.fn(async () => []),
      queryPlayerInbox: vi.fn(async () => []),
      deleteGmInboxItem: vi.fn(),
      deletePlayerInboxItem: vi.fn(),
    },
    commandLogRepository: {
      createAccepted: vi.fn(),
      markProcessing: vi.fn(),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
      get: vi.fn(async () => null),
    },
    ...overrides,
  } as DbAccess;
}

describe('sendGameChatMessageHandler', () => {
  it('uses the sender character name when the member has a character in the game', async () => {
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => ({
          pk: 'GAME#game-1',
          sk: 'MEMBER#player-1',
          type: 'GameMember',
          gameId: 'game-1',
          playerId: 'player-1',
          roles: ['PLAYER'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        })),
      },
      characterRepository: {
        ...base.characterRepository,
        findOwnedCharacterInGame: vi.fn(async () => ({
          pk: 'GAME#game-1',
          sk: 'CHAR#char-1',
          type: 'Character',
          gameId: 'game-1',
          characterId: 'char-1',
          ownerPlayerId: 'player-1',
          status: 'APPROVED',
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
            appearance: { imageKey: null, imageUrl: null, updatedAt: null },
            identity: { name: 'Borin', age: null, gender: null },
            noteToGm: null,
            gmNote: null,
          },
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          version: 1,
        })),
      },
      playerRepository: {
        ...base.playerRepository,
        getPlayerProfile: vi.fn(async () => ({
          pk: 'PLAYER#player-1',
          sk: 'PROFILE',
          type: 'PlayerProfile',
          playerId: 'player-1',
          displayName: 'Player One',
          email: 'player1@example.com',
          emailNormalized: 'player1@example.com',
          emailVerified: true,
          roles: ['PLAYER'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        })),
      },
    });

    const result = await sendGameChatMessageHandler(
      { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
      {
        commandId: 'cmd-chat-1',
        gameId: 'game-1',
        actorId: 'player-1',
        type: 'SendGameChatMessage',
        schemaVersion: 1,
        createdAt: '2026-03-01T09:15:00.000Z',
        payload: {
          body: 'Ready.',
        },
      }
    );

    expect(result.writes).toEqual([
      {
        kind: 'PUT_GAME_CHAT_MESSAGE',
        input: {
          gameId: 'game-1',
          messageId: 'cmd-chat-1',
          senderPlayerId: 'player-1',
          senderRole: 'PLAYER',
          senderCharacterId: 'char-1',
          senderNameSnapshot: 'Borin',
          body: 'Ready.',
          createdAt: '2026-03-01T09:15:00.000Z',
        },
      },
    ]);
  });

  it('falls back to the profile name for members who do not have a character', async () => {
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => ({
          pk: 'GAME#game-1',
          sk: 'MEMBER#gm-1',
          type: 'GameMember',
          gameId: 'game-1',
          playerId: 'gm-1',
          roles: ['GM'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        })),
      },
      playerRepository: {
        ...base.playerRepository,
        getPlayerProfile: vi.fn(async () => ({
          pk: 'PLAYER#gm-1',
          sk: 'PROFILE',
          type: 'PlayerProfile',
          playerId: 'gm-1',
          displayName: 'Zed GM',
          email: 'gm@example.com',
          emailNormalized: 'gm@example.com',
          emailVerified: true,
          roles: ['PLAYER', 'GM'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        })),
      },
    });

    const result = await sendGameChatMessageHandler(
      { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
      {
        commandId: 'cmd-chat-2',
        gameId: 'game-1',
        actorId: 'gm-1',
        type: 'SendGameChatMessage',
        schemaVersion: 1,
        createdAt: '2026-03-01T09:15:00.000Z',
        payload: {
          body: 'Session starts soon.',
        },
      }
    );

    expect(result.writes).toEqual([
      {
        kind: 'PUT_GAME_CHAT_MESSAGE',
        input: expect.objectContaining({
          senderRole: 'GM',
          senderCharacterId: null,
          senderNameSnapshot: 'Zed GM',
          body: 'Session starts soon.',
        }),
      },
    ]);
  });

  it('rejects send attempts from non-members', async () => {
    await expect(
      sendGameChatMessageHandler(
        { db: makeDb(), nowIso: () => '2026-03-01T09:15:00.000Z' },
        {
          commandId: 'cmd-chat-3',
          gameId: 'game-1',
          actorId: 'outsider',
          type: 'SendGameChatMessage',
          schemaVersion: 1,
          createdAt: '2026-03-01T09:15:00.000Z',
          payload: {
            body: 'Hello.',
          },
        }
      )
    ).rejects.toMatchObject({
      code: 'GAME_CHAT_MEMBER_REQUIRED',
    });
  });
});
