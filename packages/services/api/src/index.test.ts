import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
      async putCharacterDraft() {
        throw new Error('not implemented in api test mock');
      },
      async updateCharacterWithVersion() {
        throw new Error('not implemented in api test mock');
      },
    },
    gameRepository: {
      async getGameMetadata() {
        return null;
      },
    },
    playerRepository: {
      async getPlayerProfile() {
        return null;
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
      async resolveGmInboxItem() {
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
    expect(routes).toEqual([
      { method: 'POST', path: '/commands', auth: 'required' },
      { method: 'GET', path: '/commands/{commandId}', auth: 'required' },
      { method: 'GET', path: '/games/{gameId}/me', auth: 'required' },
      { method: 'GET', path: '/me/inbox', auth: 'required' },
      { method: 'GET', path: '/games/{gameId}/characters/{characterId}', auth: 'required' },
      { method: 'GET', path: '/gm/{gameId}/inbox', auth: 'gm_required' },
    ]);
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
});
