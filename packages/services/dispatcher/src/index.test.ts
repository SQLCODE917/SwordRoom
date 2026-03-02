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
      async putCharacterDraft() {
        throw new Error('should not be called');
      },
      async updateCharacterWithVersion() {
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
      async resolveGmInboxItem() {
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
      'CreateCharacterDraft',
      'SetCharacterSubAbilities',
      'ApplyStartingPackage',
      'SpendStartingExp',
      'PurchaseStarterEquipment',
      'SubmitCharacterForApproval',
      'GMReviewCharacter',
    ]);
  });

  it('verifies command types exist in source contract text', () => {
    const asyncDoc = readFileSync(ASYNC_DOC_PATH, 'utf8');
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
