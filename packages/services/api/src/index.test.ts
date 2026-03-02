import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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

  return {
    tables: { gameStateTableName: 'GameState', commandLogTableName: 'CommandLog' },
    keyBuilders: { gameState: {} as any, commandLog: {} as any },
    async transactWrite() {
      throw new Error('not implemented in api test mock');
    },
    characterRepository: {
      async getCharacter() {
        return null;
      },
      async putCharacterDraft() {
        throw new Error('not implemented in api test mock');
      },
      async updateCharacterWithVersion() {
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
      async resolveGmInboxItem() {
        return;
      },
    },
    commandLogRepository: {
      async createAccepted(input) {
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

describe('services/api contract route map', () => {
  it('matches the vertical-slice async-layer endpoint contract', () => {
    const routes = listContractRoutes();
    expect(routes).toEqual([
      { method: 'POST', path: '/commands', auth: 'required' },
      { method: 'GET', path: '/commands/{commandId}', auth: 'required' },
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
});
