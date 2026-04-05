import { describe, expect, it, vi } from 'vitest';
import type { CharacterItem, GMInboxItem, GameMemberItem } from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';
import { gmReviewHandler } from './gmReview.js';

const baseCharacter: CharacterItem = {
  pk: 'GAME#game-1',
  sk: 'CHAR#char-1',
  type: 'Character',
  gameId: 'game-1',
  characterId: 'char-1',
  ownerPlayerId: 'player-aaa',
  status: 'PENDING',
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
    identity: { name: 'Pending Hero', age: null, gender: null },
    noteToGm: 'Please approve',
    gmNote: null,
  },
  submittedAt: '2026-03-01T00:03:00.000Z',
  submittedDraftVersion: 2,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:03:00.000Z',
  version: 2,
};

const pendingInboxItem: GMInboxItem = {
  pk: 'GM#game-1',
  sk: 'INBOX#2026-03-01T00:03:00.000Z#prompt-1',
  type: 'GMInboxItem',
  promptId: 'prompt-1',
  gameId: 'game-1',
  kind: 'PENDING_CHARACTER',
  ref: { characterId: 'char-1', playerId: 'player-aaa' },
  ownerPlayerId: 'player-aaa',
  message: 'Pending character review',
  createdAt: '2026-03-01T00:03:00.000Z',
  submittedAt: '2026-03-01T00:03:00.000Z',
  readAt: null,
};

function makeDb(overrides?: Partial<DbAccess>): DbAccess {
  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: {} as DbAccess['keyBuilders'],
    transactWrite: vi.fn(),
    characterRepository: {
      getCharacter: vi.fn(async () => baseCharacter),
      findOwnedCharacterInGame: vi.fn(async () => null),
      listCharactersByOwner: vi.fn(async () => []),
      putCharacterDraft: vi.fn(),
      updateCharacterWithVersion: vi.fn(),
    },
    gameRepository: {
      getGameMetadata: vi.fn(async () => null),
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
    inviteRepository: {
      getInvite: vi.fn(async () => null),
      putInvite: vi.fn(),
      updateInviteWithVersion: vi.fn(),
    },
    inboxRepository: {
      addGmInboxItem: vi.fn(),
      addPlayerInboxItem: vi.fn(),
      queryGmInbox: vi.fn(async () => [pendingInboxItem]),
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

describe('gmReviewHandler', () => {
  it('adds plain player membership when a character is approved', async () => {
    const db = makeDb();

    const effects = await gmReviewHandler(
      { db, nowIso: () => '2026-03-01T00:05:00.000Z' },
      {
        commandId: '29f61013-8f47-4f5f-9456-9f07a88e5801',
        gameId: 'game-1',
        actorId: 'gm-aaa',
        type: 'GMReviewCharacter',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:05:00.000Z',
        payload: {
          characterId: 'char-1',
          decision: 'APPROVE',
          gmNote: 'Looks good',
        },
      }
    );

    expect(effects.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'PUT_GAME_MEMBER',
          input: {
            gameId: 'game-1',
            playerId: 'player-aaa',
            roles: ['PLAYER'],
            createdAt: '2026-03-01T00:05:00.000Z',
            updatedAt: '2026-03-01T00:05:00.000Z',
          },
        }),
      ])
    );
  });

  it('preserves existing membership roles and createdAt when approving', async () => {
    const existingMembership: GameMemberItem = {
      pk: 'GAME#game-1',
      sk: 'MEMBER#player-aaa',
      type: 'GameMember',
      gameId: 'game-1',
      playerId: 'player-aaa',
      roles: ['GM'],
      createdAt: '2026-03-01T00:01:00.000Z',
      updatedAt: '2026-03-01T00:01:00.000Z',
    };
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => existingMembership),
      },
    });

    const effects = await gmReviewHandler(
      { db, nowIso: () => '2026-03-01T00:05:00.000Z' },
      {
        commandId: '29f61013-8f47-4f5f-9456-9f07a88e5802',
        gameId: 'game-1',
        actorId: 'gm-aaa',
        type: 'GMReviewCharacter',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:05:00.000Z',
        payload: {
          characterId: 'char-1',
          decision: 'APPROVE',
        },
      }
    );

    expect(effects.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'PUT_GAME_MEMBER',
          input: {
            gameId: 'game-1',
            playerId: 'player-aaa',
            roles: ['GM', 'PLAYER'],
            createdAt: '2026-03-01T00:01:00.000Z',
            updatedAt: '2026-03-01T00:05:00.000Z',
          },
        }),
      ])
    );
  });
});
