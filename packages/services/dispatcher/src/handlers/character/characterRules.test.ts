import { describe, expect, it, vi } from 'vitest';
import type { CharacterItem } from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';
import { createDraftHandler } from './createDraft.js';
import { deleteCharacterHandler } from './deleteCharacter.js';
import { saveDraftHandler } from './saveWizardProgress.js';

const baseCharacter: CharacterItem = {
  pk: 'GAME#game-1',
  sk: 'CHAR#char-existing',
  type: 'Character',
  gameId: 'game-1',
  characterId: 'char-existing',
  ownerPlayerId: 'player-aaa',
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
    appearance: { imageKey: null, imageUrl: null, updatedAt: null },
    identity: { name: 'Existing Hero', age: null, gender: null },
    noteToGm: null,
    gmNote: null,
  },
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  version: 1,
};

function makeDb(overrides?: Partial<DbAccess>): DbAccess {
  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: {} as DbAccess['keyBuilders'],
    transactWrite: vi.fn(),
    characterRepository: {
      getCharacter: vi.fn(async () => null),
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

describe('character rules', () => {
  it('rejects creating a second character for the same player in one game', async () => {
    const db = makeDb({
      characterRepository: {
        ...makeDb().characterRepository,
        getCharacter: vi.fn(async () => null),
        findOwnedCharacterInGame: vi.fn(async () => baseCharacter),
      },
    });

    await expect(
      createDraftHandler(
        { db, nowIso: () => '2026-03-01T00:05:00.000Z' },
        {
          commandId: '29f61013-8f47-4f5f-9456-9f07a88e5893',
          gameId: 'game-1',
          actorId: 'player-aaa',
          type: 'CreateCharacterDraft',
          schemaVersion: 1,
          createdAt: '2026-03-01T00:00:00.000Z',
          payload: {
            characterId: 'char-new',
            race: 'HUMAN',
            raisedBy: null,
          },
        }
      )
    ).rejects.toMatchObject({
      code: 'PLAYER_ALREADY_HAS_CHARACTER_IN_GAME',
    });
  });

  it('rejects saving a brand-new draft when the player already has a character in that game', async () => {
    const base = makeDb();
    const db = makeDb({
      characterRepository: {
        ...base.characterRepository,
        getCharacter: vi.fn(async () => null),
        findOwnedCharacterInGame: vi.fn(async () => baseCharacter),
      },
    });

    await expect(
      saveDraftHandler(
        { db, nowIso: () => '2026-03-01T00:05:00.000Z' },
        {
          commandId: '29f61013-8f47-4f5f-9456-9f07a88e5894',
          gameId: 'game-1',
          actorId: 'player-aaa',
          type: 'SaveCharacterDraft',
          schemaVersion: 1,
          createdAt: '2026-03-01T00:00:00.000Z',
          payload: {
            characterId: 'char-new',
            expectedVersion: null,
            race: 'HUMAN',
            raisedBy: null,
            subAbility: { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1 },
            identity: {
              name: 'New Hero',
              age: null,
              gender: null,
            },
            purchases: [],
            cart: {},
          },
        }
      )
    ).rejects.toMatchObject({
      code: 'PLAYER_ALREADY_HAS_CHARACTER_IN_GAME',
    });
  });

  it('deletes the character, plain player membership, and pending GM inbox items together', async () => {
    const base = makeDb();
    const db = makeDb({
      characterRepository: {
        ...base.characterRepository,
        getCharacter: vi.fn(async () => ({
          ...baseCharacter,
          status: 'PENDING',
        })),
      },
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => ({
          pk: 'GAME#game-1',
          sk: 'MEMBER#player-aaa',
          type: 'GameMember',
          gameId: 'game-1',
          playerId: 'player-aaa',
          roles: ['PLAYER'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        })),
      },
      inboxRepository: {
        ...base.inboxRepository,
        queryGmInbox: vi.fn(async () => [
          {
            pk: 'GM#game-1',
            sk: 'INBOX#2026-03-01T00:00:00.000Z#prompt-1',
            type: 'GMInboxItem',
            promptId: 'prompt-1',
            gameId: 'game-1',
            kind: 'PENDING_CHARACTER',
            ref: { characterId: 'char-existing', playerId: 'player-aaa' },
            ownerPlayerId: 'player-aaa',
            message: 'Pending review',
            createdAt: '2026-03-01T00:00:00.000Z',
            submittedAt: '2026-03-01T00:00:00.000Z',
            readAt: null,
          },
        ]),
      },
    });

    const effects = await deleteCharacterHandler(
      { db, nowIso: () => '2026-03-01T00:05:00.000Z' },
      {
        commandId: '29f61013-8f47-4f5f-9456-9f07a88e5895',
        gameId: 'game-1',
        actorId: 'player-aaa',
        type: 'DeleteCharacter',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:05:00.000Z',
        payload: {
          characterId: 'char-existing',
        },
      }
    );

    expect(effects.writes).toEqual(
      expect.arrayContaining([
        {
          kind: 'DELETE_CHARACTER',
          input: {
            gameId: 'game-1',
            characterId: 'char-existing',
          },
        },
        {
          kind: 'DELETE_GAME_MEMBER',
          input: {
            gameId: 'game-1',
            playerId: 'player-aaa',
          },
        },
        {
          kind: 'DELETE_GM_INBOX_ITEM',
          input: {
            gameId: 'game-1',
            createdAt: '2026-03-01T00:00:00.000Z',
            promptId: 'prompt-1',
          },
        },
      ])
    );
  });
});
