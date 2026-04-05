import { describe, expect, it, vi } from 'vitest';
import type { DbAccess } from '@starter/services-shared';
import { archiveGameHandler } from './archiveGame.js';

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

describe('archiveGameHandler', () => {
  it('archives the game, cancels pending invites, rejects pending applicants, and notifies affected players', async () => {
    const base = makeDb();
    const db = makeDb({
      gameRepository: {
        ...base.gameRepository,
        getGameMetadata: vi.fn(async () => ({
          pk: 'GAME#game-1',
          sk: 'METADATA',
          type: 'GameMetadata',
          gameId: 'game-1',
          name: 'Frost Marches',
          visibility: 'PUBLIC',
          lifecycleStatus: 'ACTIVE',
          archivedAt: null,
          archivedByPlayerId: null,
          createdByPlayerId: 'gm-1',
          gmPlayerId: 'gm-1',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          version: 4,
        })),
      },
      membershipRepository: {
        ...base.membershipRepository,
        listMembershipsForGame: vi.fn(async () => [
          {
            pk: 'GAME#game-1',
            sk: 'MEMBER#gm-1',
            type: 'GameMember',
            gameId: 'game-1',
            playerId: 'gm-1',
            roles: ['GM'],
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          {
            pk: 'GAME#game-1',
            sk: 'MEMBER#player-member',
            type: 'GameMember',
            gameId: 'game-1',
            playerId: 'player-member',
            roles: ['PLAYER'],
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ]),
      },
      inviteRepository: {
        ...base.inviteRepository,
        listInvitesForGame: vi.fn(async () => [
          {
            pk: 'GAME#game-1',
            sk: 'INVITE#invite-1',
            type: 'GameInvite',
            inviteId: 'invite-1',
            gameId: 'game-1',
            invitedPlayerId: 'player-invite',
            invitedEmailNormalized: 'invite@example.com',
            invitedByPlayerId: 'gm-1',
            status: 'PENDING',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
            respondedAt: null,
            version: 2,
          },
        ]),
      },
      characterRepository: {
        ...base.characterRepository,
        listCharactersForGame: vi.fn(async () => [
          {
            pk: 'GAME#game-1',
            sk: 'CHAR#char-pending',
            type: 'Character',
            gameId: 'game-1',
            characterId: 'char-pending',
            ownerPlayerId: 'player-applicant',
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
              identity: { name: 'Dain', age: null, gender: null },
              noteToGm: null,
              gmNote: null,
            },
            submittedAt: '2026-04-02T00:00:00.000Z',
            submittedDraftVersion: 3,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
            version: 3,
          },
          {
            pk: 'GAME#game-1',
            sk: 'CHAR#char-approved',
            type: 'Character',
            gameId: 'game-1',
            characterId: 'char-approved',
            ownerPlayerId: 'player-member',
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
              identity: { name: 'Vera', age: null, gender: null },
              noteToGm: null,
              gmNote: null,
            },
            submittedAt: '2026-04-02T00:00:00.000Z',
            submittedDraftVersion: 1,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
            version: 1,
          },
        ]),
      },
      inboxRepository: {
        ...base.inboxRepository,
        queryGmInbox: vi.fn(async () => [
          {
            pk: 'GM#game-1',
            sk: 'INBOX#2026-04-02T00:00:00.000Z#pending-char',
            type: 'GMInboxItem',
            promptId: 'pending-char',
            gameId: 'game-1',
            kind: 'PENDING_CHARACTER',
            ref: { characterId: 'char-pending', playerId: 'player-applicant' },
            ownerPlayerId: 'player-applicant',
            message: 'Character char-pending submitted for review',
            createdAt: '2026-04-02T00:00:00.000Z',
            submittedAt: '2026-04-02T00:00:00.000Z',
            readAt: null,
          },
        ]),
        queryPlayerInbox: vi.fn(async (playerId: string) =>
          playerId === 'player-invite'
            ? [
                {
                  pk: 'PLAYER#player-invite',
                  sk: 'INBOX#2026-04-02T00:00:00.000Z#invite-1',
                  type: 'PlayerInboxItem',
                  promptId: 'invite-1',
                  gameId: 'game-1',
                  kind: 'GAME_INVITE',
                  ref: { inviteId: 'invite-1', playerId: 'player-invite' },
                  message: 'Invitation to join Frost Marches',
                  createdAt: '2026-04-02T00:00:00.000Z',
                  readAt: null,
                },
              ]
            : []
        ),
      },
    });

    const result = await archiveGameHandler(
      { db, nowIso: () => '2026-04-05T12:15:00.000Z' },
      {
        commandId: 'cmd-archive-1',
        gameId: 'game-1',
        actorId: 'gm-1',
        type: 'ArchiveGame',
        schemaVersion: 1,
        createdAt: '2026-04-05T12:15:00.000Z',
        payload: {
          gameId: 'game-1',
          expectedVersion: 4,
        },
      }
    );

    expect(result.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'UPDATE_GAME_METADATA_WITH_VERSION',
          input: expect.objectContaining({
            gameId: 'game-1',
            expectedVersion: 4,
            next: expect.objectContaining({
              lifecycleStatus: 'ARCHIVED',
              archivedAt: '2026-04-05T12:15:00.000Z',
              archivedByPlayerId: 'gm-1',
            }),
          }),
        }),
        expect.objectContaining({
          kind: 'UPDATE_GAME_INVITE_WITH_VERSION',
          input: expect.objectContaining({
            inviteId: 'invite-1',
            next: expect.objectContaining({
              status: 'CANCELLED',
            }),
          }),
        }),
        expect.objectContaining({
          kind: 'UPDATE_CHARACTER_WITH_VERSION',
          input: expect.objectContaining({
            characterId: 'char-pending',
            next: expect.objectContaining({
              status: 'REJECTED',
              draft: expect.objectContaining({
                gmNote: 'This game was deleted before your application was reviewed.',
              }),
            }),
          }),
        }),
        {
          kind: 'DELETE_GM_INBOX_ITEM',
          input: {
            gameId: 'game-1',
            createdAt: '2026-04-02T00:00:00.000Z',
            promptId: 'pending-char',
          },
        },
        {
          kind: 'DELETE_PLAYER_INBOX_ITEM',
          input: {
            playerId: 'player-invite',
            createdAt: '2026-04-02T00:00:00.000Z',
            promptId: 'invite-1',
          },
        },
      ])
    );
    expect(result.inbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'PLAYER_INBOX_ITEM',
          input: expect.objectContaining({
            playerId: 'player-member',
            kind: 'ACTION_REQUIRED',
            message: 'Game "Frost Marches" was deleted by the GM.',
          }),
        }),
        expect.objectContaining({
          kind: 'PLAYER_INBOX_ITEM',
          input: expect.objectContaining({
            playerId: 'player-invite',
            kind: 'ACTION_REQUIRED',
            message: 'Invitation to Frost Marches was cancelled because the game was deleted.',
          }),
        }),
        expect.objectContaining({
          kind: 'PLAYER_INBOX_ITEM',
          input: expect.objectContaining({
            playerId: 'player-applicant',
            kind: 'CHAR_REJECTED',
            message: 'Application closed because the game was deleted.',
          }),
        }),
      ])
    );
  });

  it('rejects stale archive requests', async () => {
    const base = makeDb();
    const db = makeDb({
      gameRepository: {
        ...base.gameRepository,
        getGameMetadata: vi.fn(async () => ({
          pk: 'GAME#game-1',
          sk: 'METADATA',
          type: 'GameMetadata',
          gameId: 'game-1',
          name: 'Frost Marches',
          visibility: 'PUBLIC',
          lifecycleStatus: 'ACTIVE',
          archivedAt: null,
          archivedByPlayerId: null,
          createdByPlayerId: 'gm-1',
          gmPlayerId: 'gm-1',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          version: 5,
        })),
      },
    });

    await expect(
      archiveGameHandler(
        { db, nowIso: () => '2026-04-05T12:15:00.000Z' },
        {
          commandId: 'cmd-archive-2',
          gameId: 'game-1',
          actorId: 'gm-1',
          type: 'ArchiveGame',
          schemaVersion: 1,
          createdAt: '2026-04-05T12:15:00.000Z',
          payload: {
            gameId: 'game-1',
            expectedVersion: 4,
          },
        }
      )
    ).rejects.toMatchObject({
      code: 'STALE_GAME_VERSION',
    });
  });
});
