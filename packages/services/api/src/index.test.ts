import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPlayerCharacterLibraryGameId } from '@starter/shared';
import { describe, expect, it, vi } from 'vitest';
import { createApiService, listContractRoutes } from './index.js';
import { InMemoryFifoQueue, type DbAccess } from '@starter/services-shared';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ASYNC_DOC_PATH = resolve(
  HERE,
  '../../../..',
  'docs/vertical-slice.character-creation.async-layer.yaml'
);

function makeDbMock(): DbAccess {
  const log = new Map<string, any>();
  const character = {
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
      appearance: { imageKey: null, imageUrl: null, updatedAt: null },
      identity: { name: 'Unnamed', age: null, gender: null },
      noteToGm: null,
      gmNote: null,
    },
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 1,
  };

  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: { gameState: {} as any, commandLog: {} as any },
    async transactWrite() {
      throw new Error('not implemented in api test mock');
    },
    characterRepository: {
      async getCharacter(gameId, characterId) {
        if (gameId === 'game-1' && characterId === 'char-1') {
          return character as any;
        }
        return null;
      },
      async findOwnedCharacterInGame() {
        return null;
      },
      async listCharactersByOwner() {
        return [character as any];
      },
      async putCharacterDraft() {
        throw new Error('not implemented in api test mock');
      },
      async updateCharacterWithVersion() {
        throw new Error('not implemented in api test mock');
      },
    },
    gameRepository: {
      async getGameMetadata() {
        return {
          pk: 'GAME#game-1',
          sk: 'METADATA',
          type: 'GameMetadata',
          gameId: 'game-1',
          name: 'Game One',
          visibility: 'PUBLIC',
          createdByPlayerId: 'gm-1',
          gmPlayerId: 'gm-1',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          version: 1,
        } as any;
      },
      async putGameMetadata() {
        throw new Error('not implemented in api test mock');
      },
      async updateGameMetadataWithVersion() {
        throw new Error('not implemented in api test mock');
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
          pk: 'PLAYER#player-1',
          sk: 'PROFILE',
          type: 'PlayerProfile',
          playerId: 'player-1',
          displayName: 'Player One',
          email: 'player@example.com',
          emailNormalized: 'player@example.com',
          emailVerified: true,
          roles: ['PLAYER'],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        } as any;
      },
      async getPlayerProfileByEmail() {
        return null;
      },
      async upsertPlayerProfile() {
        throw new Error('not implemented in api test mock');
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
        throw new Error("not implemented in api test mock");
      },
      async deletePlatformEntitlement() {
        throw new Error("not implemented in api test mock");
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
        throw new Error('not implemented in api test mock');
      },
      async deleteMembership() {
        throw new Error('not implemented in api test mock');
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
      async putInvite() {
        throw new Error('not implemented in api test mock');
      },
      async updateInviteWithVersion() {
        throw new Error('not implemented in api test mock');
      },
    },
    inboxRepository: {
      async addGmInboxItem() {
        throw new Error('not implemented in api test mock');
      },
      async addPlayerInboxItem() {
        throw new Error('not implemented in api test mock');
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
      async createAccepted(input) {
        if (log.has(input.commandId)) {
          const error = new Error(`duplicate commandId: ${input.commandId}`) as Error & { name: string };
          error.name = 'ConditionalCheckFailedException';
          throw error;
        }
        const item = {
          pk: `COMMAND#${input.commandId}`,
          sk: 'METADATA',
          type: 'Command',
          commandType: input.type,
          commandId: input.commandId,
          gameId: input.gameId,
          actorId: input.actorId,
          status: 'ACCEPTED',
          errorCode: null,
          errorMessage: null,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
          idempotencyKey: input.commandId,
          resultRef: { characterId: null },
        };
        log.set(input.commandId, item);
        return item as any;
      },
      async markProcessing() {
        throw new Error('not implemented in api test mock');
      },
      async markProcessed() {
        throw new Error('not implemented in api test mock');
      },
      async markFailed() {
        throw new Error('not implemented in api test mock');
      },
      async get(commandId) {
        return log.get(commandId) ?? null;
      },
    },
  };
}

function makeUploadsMock() {
  return {
    async headObject() {
      return true;
    },
    async createSignedDownloadUrl(input: { key: string; expiresInSeconds: number }) {
      return `https://uploads.test/${encodeURIComponent(input.key)}?exp=${input.expiresInSeconds}`;
    },
  };
}

describe('services/api contract route map', () => {
  it('matches the vertical-slice async-layer endpoint contract', () => {
    const routes = listContractRoutes();
    expect(routes).toEqual(
      expect.arrayContaining([
        { method: 'POST', path: '/commands', auth: 'required' },
        { method: 'POST', path: '/me/profile/sync', auth: 'required' },
        { method: 'GET', path: '/commands/{commandId}', auth: 'required' },
        { method: 'GET', path: '/me', auth: 'required' },
        { method: 'GET', path: '/me/characters', auth: 'required' },
        { method: 'GET', path: '/me/games', auth: 'required' },
        { method: 'GET', path: '/games/{gameId}', auth: 'required' },
        { method: 'GET', path: '/games/public', auth: 'required' },
        { method: 'GET', path: '/games/{gameId}/me', auth: 'required' },
        { method: 'GET', path: '/me/inbox', auth: 'required' },
        { method: 'GET', path: '/games/{gameId}/characters/{characterId}', auth: 'required' },
        { method: 'GET', path: '/games/{gameId}/chat', auth: 'required' },
        { method: 'POST', path: '/games/{gameId}/characters/{characterId}/appearance/upload-url', auth: 'required' },
        { method: 'GET', path: '/players/{playerId}/characters/{characterId}', auth: 'required' },
        { method: 'GET', path: '/gm/games', auth: 'required' },
        { method: 'GET', path: '/gm/{gameId}/inbox', auth: 'gm_required' },
        { method: 'GET', path: '/admin/users', auth: 'admin_required' },
        { method: 'GET', path: '/admin/games', auth: 'admin_required' },
      ])
    );
  });

  it('source contract document contains every mapped route', () => {
    const asyncDoc = readFileSync(ASYNC_DOC_PATH, 'utf8');
    for (const route of listContractRoutes()) {
      expect(asyncDoc).toContain(`method: ${route.method}`);
      expect(asyncDoc).toContain(`path: ${route.path}`);
    }
  });
});

describe('POST /commands', () => {
  it('validates envelope, injects actorId from bypass, creates ACCEPTED log, and enqueues FIFO payload', async () => {
    const queue = new InMemoryFifoQueue();
    const api = createApiService({
      db: makeDbMock(),
      uploads: makeUploadsMock(),
      queue,
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    const response = await api.postCommands({
      bypassActorId: 'player-1',
      envelope: {
        commandId: '29f61013-8f47-4f5f-9456-9f07a88e5893',
        gameId: 'game-1',
        type: 'CreateCharacterDraft',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        payload: { characterId: 'char-1', race: 'HUMAN', raisedBy: null },
      },
    });

    expect(response).toEqual({ accepted: true, commandId: '29f61013-8f47-4f5f-9456-9f07a88e5893', status: 'ACCEPTED' });

    const messages = await queue.receiveMessages('commands.fifo', 10);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageGroupId).toBe('game-1');
    expect(messages[0]?.messageDeduplicationId).toBe('29f61013-8f47-4f5f-9456-9f07a88e5893');
  });

  it('treats duplicate commandId as an idempotent replay while the command is still ACCEPTED', async () => {
    const queue = {
      sendMessage: vi.fn(async () => undefined),
    };
    const api = createApiService({
      db: makeDbMock(),
      uploads: makeUploadsMock(),
      queue,
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    const request = {
      bypassActorId: 'player-1',
      envelope: {
        commandId: '11111111-1111-4111-8111-111111111111',
        gameId: 'game-1',
        type: 'CreateCharacterDraft' as const,
        schemaVersion: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        payload: { characterId: 'char-1', race: 'HUMAN', raisedBy: null },
      },
    };

    await api.postCommands(request);
    const replay = await api.postCommands(request);

    expect(replay).toEqual({
      accepted: true,
      commandId: '11111111-1111-4111-8111-111111111111',
      status: 'ACCEPTED',
    });
    expect(queue.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('generates the gameId for CreateGame on the backend', async () => {
    const queue = new InMemoryFifoQueue();
    const api = createApiService({
      db: makeDbMock(),
      uploads: makeUploadsMock(),
      queue,
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    const response = await api.postCommands({
      bypassActorId: 'player-1',
      envelope: {
        commandId: '22222222-2222-4222-8222-222222222222',
        type: 'CreateGame',
        schemaVersion: 1,
        createdAt: '2026-03-01T00:00:00.000Z',
        payload: { name: 'Backend Id Game' },
      } as any,
    });

    expect(response).toEqual({
      accepted: true,
      commandId: '22222222-2222-4222-8222-222222222222',
      status: 'ACCEPTED',
    });

    const messages = await queue.receiveMessages('commands.fifo', 10);
    expect(messages).toHaveLength(1);
    const queued = JSON.parse(messages[0]!.messageBody) as { gameId?: string; payload?: { name?: string } };
    expect(typeof queued.gameId).toBe('string');
    expect(queued.gameId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(queued.payload?.name).toBe('Backend Id Game');
  });

  it('rejects appearance confirmation when the uploaded object does not exist', async () => {
    const api = createApiService({
      db: makeDbMock(),
      uploads: {
        async headObject() {
          return false;
        },
        async createSignedDownloadUrl() {
          return 'https://uploads.test/unused';
        },
      },
      queue: new InMemoryFifoQueue(),
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    await expect(
      api.postCommands({
        bypassActorId: 'player-1',
        envelope: {
          commandId: '22222222-2222-4222-8222-222222222222',
          gameId: 'game-1',
          type: 'ConfirmCharacterAppearanceUpload',
          schemaVersion: 1,
          createdAt: '2026-03-01T00:00:00.000Z',
          payload: {
            characterId: 'char-1',
            s3Key: 'games/game-1/characters/char-1/appearance/portrait.png',
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'APPEARANCE_UPLOAD_NOT_FOUND',
      statusCode: 400,
    });
  });

  it('rejects a new game-scoped draft save when the target game is not public', async () => {
    const db = makeDbMock();
    db.gameRepository.getGameMetadata = async () =>
      ({
        pk: 'GAME#game-1',
        sk: 'METADATA',
        type: 'GameMetadata',
        gameId: 'game-1',
        name: 'Private Game',
        visibility: 'PRIVATE',
        createdByPlayerId: 'gm-1',
        gmPlayerId: 'gm-1',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        version: 1,
      }) as any;
    db.characterRepository.getCharacter = async () => null;

    const api = createApiService({
      db,
      uploads: makeUploadsMock(),
      queue: new InMemoryFifoQueue(),
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    await expect(
      api.postCommands({
        bypassActorId: 'player-1',
        envelope: {
          commandId: '33333333-3333-4333-8333-333333333333',
          gameId: 'game-1',
          type: 'SaveCharacterDraft',
          schemaVersion: 1,
          createdAt: '2026-03-01T00:00:00.000Z',
          payload: {
            characterId: 'char-new',
            race: 'HUMAN',
            raisedBy: 'HUMANS',
            subAbility: { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1 },
            identity: { name: 'Private Draft', age: null, gender: null },
            purchases: [],
            cart: {},
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'GAME_NOT_PUBLIC',
      statusCode: 403,
    });
  });

  it('rejects a player-library draft save when the namespace player does not match the actor', async () => {
    const api = createApiService({
      db: makeDbMock(),
      uploads: makeUploadsMock(),
      queue: new InMemoryFifoQueue(),
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    await expect(
      api.postCommands({
        bypassActorId: 'player-1',
        envelope: {
          commandId: '44444444-4444-4444-8444-444444444444',
          gameId: toPlayerCharacterLibraryGameId('player-2'),
          type: 'SaveCharacterDraft',
          schemaVersion: 1,
          createdAt: '2026-03-01T00:00:00.000Z',
          payload: {
            characterId: 'char-personal',
            race: 'HUMAN',
            raisedBy: 'HUMANS',
            subAbility: { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1 },
            identity: { name: 'Wrong Owner', age: null, gender: null },
            purchases: [],
            cart: {},
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'PLAYER_CHARACTER_OWNER_REQUIRED',
      statusCode: 403,
    });
  });

  it('rejects sending a game chat message when the actor is not a member of the game', async () => {
    const db = makeDbMock();
    db.membershipRepository.getMembership = vi.fn(async () => null);

    const api = createApiService({
      db,
      uploads: makeUploadsMock(),
      queue: new InMemoryFifoQueue(),
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    await expect(
      api.postCommands({
        bypassActorId: 'player-outsider',
        envelope: {
          commandId: '55555555-5555-4555-8555-555555555555',
          gameId: 'game-1',
          type: 'SendGameChatMessage',
          schemaVersion: 1,
          createdAt: '2026-03-01T00:00:00.000Z',
          payload: {
            body: 'Hello from outside.',
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'GAME_ACCESS_REQUIRED',
      statusCode: 403,
    });
  });
});

describe('profile sync', () => {
  it('upserts a dev actor profile from resolved auth identity', async () => {
    const upsertPlayerProfile = vi.fn(async (input) => ({
      pk: `PLAYER#${input.playerId}`,
      sk: 'PROFILE',
      type: 'PlayerProfile',
      ...input,
      createdAt: input.updatedAt,
    }));
    const db = makeDbMock();
    db.playerRepository.upsertPlayerProfile = upsertPlayerProfile;

    const api = createApiService({
      db,
      uploads: makeUploadsMock(),
      queue: { sendMessage: vi.fn(async () => undefined) },
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    const profile = await api.readApis.syncMyProfile({
      bypassActorId: 'gm-zzz',
    });

    expect(profile.playerId).toBe('gm-zzz');
    expect(profile.roles).toEqual(['PLAYER']);
    expect(upsertPlayerProfile).toHaveBeenCalledTimes(1);
    expect(upsertPlayerProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'gm-zzz',
        displayName: 'gm-zzz',
      })
    );
  });
});

describe('game chat', () => {
  it('returns participants sorted by role then name, and IRC-ready sender labels', async () => {
    const db = makeDbMock();
    db.membershipRepository.listMembershipsForGame = vi.fn(async () => [
      {
        pk: 'GAME#game-1',
        sk: 'MEMBER#gm-1',
        type: 'GameMember',
        gameId: 'game-1',
        playerId: 'gm-1',
        roles: ['GM'],
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        pk: 'GAME#game-1',
        sk: 'MEMBER#player-2',
        type: 'GameMember',
        gameId: 'game-1',
        playerId: 'player-2',
        roles: ['PLAYER'],
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        pk: 'GAME#game-1',
        sk: 'MEMBER#player-1',
        type: 'GameMember',
        gameId: 'game-1',
        playerId: 'player-1',
        roles: ['PLAYER'],
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);
    db.playerRepository.getPlayerProfile = vi.fn(async (playerId: string) => ({
      pk: `PLAYER#${playerId}`,
      sk: 'PROFILE',
      type: 'PlayerProfile',
      playerId,
      displayName: playerId === 'gm-1' ? 'Zed GM' : playerId === 'player-2' ? 'Alice' : 'Player One',
      email: `${playerId}@example.com`,
      emailNormalized: `${playerId}@example.com`,
      emailVerified: true,
      roles: ['PLAYER'],
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    }) as any);
    db.characterRepository.findOwnedCharacterInGame = vi.fn(async (_gameId: string, playerId: string) => {
      if (playerId === 'player-1') {
        return {
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
        } as any;
      }
      return null;
    });
    db.chatRepository.queryMessages = vi.fn(async () => [
      {
        pk: 'GAME#game-1',
        sk: 'CHAT#2026-03-01T09:15:00.000Z#msg-1',
        type: 'GameChatMessage',
        messageId: 'msg-1',
        gameId: 'game-1',
        senderPlayerId: 'gm-1',
        senderRole: 'GM',
        senderCharacterId: null,
        senderNameSnapshot: 'Zed GM',
        body: 'Session starts soon.',
        createdAt: '2026-03-01T09:15:00.000Z',
      },
      {
        pk: 'GAME#game-1',
        sk: 'CHAT#2026-03-01T09:16:00.000Z#msg-2',
        type: 'GameChatMessage',
        messageId: 'msg-2',
        gameId: 'game-1',
        senderPlayerId: 'player-1',
        senderRole: 'PLAYER',
        senderCharacterId: 'char-1',
        senderNameSnapshot: 'Borin',
        body: 'Ready.',
        createdAt: '2026-03-01T09:16:00.000Z',
      },
    ]);

    const api = createApiService({
      db,
      uploads: makeUploadsMock(),
      queue: { sendMessage: vi.fn(async () => undefined) },
      queueUrl: 'commands.fifo',
      jwtBypass: true,
    });

    const chat = await api.readApis.getGameChat('game-1');

    expect(chat.gameName).toBe('Game One');
    expect(chat.participants.map((participant) => participant.displayName)).toEqual(['@Zed GM', 'Alice', 'Borin']);
    expect(chat.messages.map((message) => `${message.senderDisplayName}:${message.body}`)).toEqual([
      '@Zed GM:Session starts soon.',
      'Borin:Ready.',
    ]);
  });
});
