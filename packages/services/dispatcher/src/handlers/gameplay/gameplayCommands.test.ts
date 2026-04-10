import { describe, expect, it, vi } from 'vitest';
import {
  deriveCombatantFromCharacter,
  openCombatRound,
  seedGameplaySession,
} from '@starter/engine';
import type { DbAccess } from '@starter/services-shared';
import type { CharacterItem, GameplaySessionItem } from '@starter/shared';
import { getGameplayLoopFixture } from '@starter/shared/fixtures';
import {
  submitCombatActionHandler,
  submitGameplayIntentHandler,
} from './gameplayCommands.js';

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

describe('gameplay command authorization', () => {
  it('rejects intent submission from members who do not have an approved character', async () => {
    const session = createSeededSession([]);
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => createMembership('game-1', 'gm-1', ['GM'])),
      },
      gameplayRepository: {
        ...base.gameplayRepository,
        getSession: vi.fn(async () => session),
      },
      playerRepository: {
        ...base.playerRepository,
        getPlayerProfile: vi.fn(async () => ({
          pk: 'PLAYER#gm-1',
          sk: 'PROFILE',
          type: 'PlayerProfile',
          playerId: 'gm-1',
          displayName: 'Local GM',
          email: 'gm@example.com',
          emailNormalized: 'gm@example.com',
          emailVerified: true,
          roles: ['PLAYER', 'GM'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        })),
      },
    });

    await expect(
      submitGameplayIntentHandler(
        { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
        {
          commandId: 'cmd-intent-no-char',
          gameId: 'game-1',
          actorId: 'gm-1',
          type: 'SubmitGameplayIntent',
          schemaVersion: 1,
          createdAt: '2026-03-01T09:15:00.000Z',
          payload: {
            body: 'Step between the thugs and the poster girl',
            characterId: null,
          },
        }
      )
    ).rejects.toMatchObject({ code: 'GAMEPLAY_CHARACTER_REQUIRED' });
  });

  it('rejects intent submission when the payload names another actor’s character', async () => {
    const hero = createCharacter({
      actorId: 'player-1',
      characterId: 'char-hero',
      name: 'Asha',
    });
    const session = createSeededSession([hero]);
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => createMembership('game-1', 'gm-1', ['GM'])),
      },
      characterRepository: {
        ...base.characterRepository,
        getCharacter: vi.fn(async (gameId: string, characterId: string) =>
          gameId === 'game-1' && characterId === hero.characterId ? hero : null
        ),
      },
      gameplayRepository: {
        ...base.gameplayRepository,
        getSession: vi.fn(async () => session),
      },
    });

    await expect(
      submitGameplayIntentHandler(
        { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
        {
          commandId: 'cmd-intent-foreign-char',
          gameId: 'game-1',
          actorId: 'gm-1',
          type: 'SubmitGameplayIntent',
          schemaVersion: 1,
          createdAt: '2026-03-01T09:15:00.000Z',
          payload: {
            body: 'Pretend to be the hero',
            characterId: hero.characterId,
          },
        }
      )
    ).rejects.toMatchObject({ code: 'GAMEPLAY_CHARACTER_OWNER_REQUIRED' });
  });

  it('allows an approved player character to submit an intent', async () => {
    const hero = createCharacter({
      actorId: 'player-1',
      characterId: 'char-hero',
      name: 'Asha',
    });
    const session = createSeededSession([hero]);
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => createMembership('game-1', 'player-1', ['PLAYER'])),
      },
      characterRepository: {
        ...base.characterRepository,
        findOwnedCharacterInGame: vi.fn(async () => hero),
      },
      gameplayRepository: {
        ...base.gameplayRepository,
        getSession: vi.fn(async () => session),
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

    const result = await submitGameplayIntentHandler(
      { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
      {
        commandId: 'cmd-intent-ok',
        gameId: 'game-1',
        actorId: 'player-1',
        type: 'SubmitGameplayIntent',
        schemaVersion: 1,
        createdAt: '2026-03-01T09:15:00.000Z',
        payload: {
          body: 'Asha steps forward and calls for calm.',
          characterId: null,
        },
      }
    );

    expect(result.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'PUT_GAMEPLAY_EVENT',
          input: expect.objectContaining({
            actorId: 'player-1',
            title: 'Asha declares an intent',
            detail: { characterId: 'char-hero' },
          }),
        }),
      ])
    );
  });

  it('rejects GM combat declarations that try to act through a player combatant they do not own', async () => {
    const hero = createCharacter({
      actorId: 'player-1',
      characterId: 'char-hero',
      name: 'Asha',
    });
    const session = createOpenCombatSession([hero]);
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => createMembership('game-1', 'gm-1', ['GM'])),
      },
      gameplayRepository: {
        ...base.gameplayRepository,
        getSession: vi.fn(async () => session),
      },
      characterRepository: {
        ...base.characterRepository,
        getCharacter: vi.fn(async (gameId: string, characterId: string) =>
          gameId === 'game-1' && characterId === hero.characterId ? hero : null
        ),
        findOwnedCharacterInGame: vi.fn(async () => null),
      },
    });

    await expect(
      submitCombatActionHandler(
        { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
        {
          commandId: 'cmd-combat-player-spoof',
          gameId: 'game-1',
          actorId: 'gm-1',
          type: 'SubmitCombatAction',
          schemaVersion: 1,
          createdAt: '2026-03-01T09:15:00.000Z',
          payload: {
            roundNumber: 1,
            actorCombatantId: hero.characterId,
            targetCombatantId: 'brando-boss',
            actionType: 'ATTACK',
            movementMode: 'NORMAL',
            delayToOrderZero: false,
            summary: 'GM tries to take over a player combatant.',
          },
        }
      )
    ).rejects.toMatchObject({ code: 'GAMEPLAY_CHARACTER_OWNER_REQUIRED' });
  });

  it('allows GMs to declare NPC combat actions', async () => {
    const hero = createCharacter({
      actorId: 'player-1',
      characterId: 'char-hero',
      name: 'Asha',
    });
    const session = createOpenCombatSession([hero]);
    const enemyId = 'brando-boss';
    const base = makeDb();
    const db = makeDb({
      membershipRepository: {
        ...base.membershipRepository,
        getMembership: vi.fn(async () => createMembership('game-1', 'gm-1', ['GM'])),
      },
      gameplayRepository: {
        ...base.gameplayRepository,
        getSession: vi.fn(async () => session),
      },
    });

    const result = await submitCombatActionHandler(
      { db, nowIso: () => '2026-03-01T09:15:00.000Z' },
      {
        commandId: 'cmd-combat-npc-ok',
        gameId: 'game-1',
        actorId: 'gm-1',
        type: 'SubmitCombatAction',
        schemaVersion: 1,
        createdAt: '2026-03-01T09:15:00.000Z',
        payload: {
          roundNumber: 1,
          actorCombatantId: enemyId,
          targetCombatantId: hero.characterId,
          actionType: 'ATTACK',
          movementMode: 'NORMAL',
          delayToOrderZero: false,
          summary: 'Brando Boss swings a heavy club.',
        },
      }
    );

    expect(result.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'PUT_GAMEPLAY_EVENT',
          input: expect.objectContaining({
            actorId: 'gm-1',
            detail: expect.objectContaining({
              actorCombatantId: enemyId,
              targetCombatantId: hero.characterId,
            }),
          }),
        }),
      ])
    );
  });
});

function createMembership(gameId: string, playerId: string, roles: Array<'PLAYER' | 'GM'>) {
  return {
    pk: `GAME#${gameId}`,
    sk: `MEMBER#${playerId}`,
    type: 'GameMember' as const,
    gameId,
    playerId,
    roles,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
}

function createCharacter(input: {
  actorId: string;
  characterId: string;
  name: string;
  status?: CharacterItem['status'];
}): CharacterItem {
  return {
    pk: 'GAME#game-1',
    sk: `CHAR#${input.characterId}`,
    type: 'Character',
    gameId: 'game-1',
    characterId: input.characterId,
    ownerPlayerId: input.actorId,
    status: input.status ?? 'APPROVED',
    draft: {
      race: 'HUMAN',
      raisedBy: null,
      subAbility: { A: 6, B: 5, C: 6, D: 5, E: 5, F: 6, G: 5, H: 5 },
      ability: { dex: 10, agi: 11, int: 9, str: 10, lf: 18, mp: 4 },
      bonus: { dex: 2, agi: 2, int: 1, str: 2, lf: 3, mp: 0 },
      background: { kind: 'CITY_GUARD', roll2d: 7 },
      starting: {
        expTotal: 3000,
        expUnspent: 0,
        moneyGamels: 1200,
        moneyRoll2d: 8,
        startingSkills: ['Fighter'],
      },
      skills: [
        { skill: 'Fighter', level: 2 },
        { skill: 'Scout', level: 1 },
      ],
      purchases: { weapons: [], armor: [], shields: [], gear: [] },
      appearance: { imageKey: null, imageUrl: null, updatedAt: null },
      identity: { name: input.name, age: null, gender: null },
      noteToGm: null,
      gmNote: null,
    },
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 1,
  };
}

function createSeededSession(characters: CharacterItem[]): GameplaySessionItem {
  const fixture = getGameplayLoopFixture('rpg_sample_tavern');
  const seeded = seedGameplaySession({
    fixture,
    createdAt: '2026-03-01T09:00:00.000Z',
    playerCombatants: characters.map((character) =>
      deriveCombatantFromCharacter({
        actorId: character.ownerPlayerId,
        character,
      })
    ),
  });

  return {
    pk: 'GAME#game-1',
    sk: 'GAMEPLAY#SESSION',
    type: 'GameplaySession',
    gameId: 'game-1',
    state: seeded.state,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
  };
}

function createOpenCombatSession(characters: CharacterItem[]): GameplaySessionItem {
  const seeded = createSeededSession(characters);
  const opened = openCombatRound(seeded.state, {
    updatedAt: '2026-03-01T09:05:00.000Z',
  });

  return {
    ...seeded,
    state: opened.state,
    updatedAt: '2026-03-01T09:05:00.000Z',
  };
}
