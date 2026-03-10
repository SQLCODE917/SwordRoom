import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import dynalite from 'dynalite';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import {
  createDbAccess,
  createDynamoDbDocumentClient,
  isConditionalCheckFailed,
  type DbAccess,
} from './db.js';
import type { CharacterDraft } from '@starter/shared';

const RUN_LOCAL_DDB_TESTS = process.env.RUN_LOCAL_DDB_TESTS === '1';
const ddbDescribe = RUN_LOCAL_DDB_TESTS ? describe : describe.skip;

const GAME_STATE_TABLE = 'GameState';
const COMMAND_LOG_TABLE = 'CommandLog';

const dbPath = join(tmpdir(), `dynalite-services-shared-${randomUUID()}`);
mkdirSync(dbPath, { recursive: true });

const server = dynalite({
  path: dbPath,
  createTableMs: 0,
  deleteTableMs: 0,
});

let lowLevelClient: DynamoDBClient;
let db: DbAccess;

ddbDescribe('Local DynamoDB integration', () => {
  beforeAll(async () => {
    const port = await new Promise<number>((resolve, reject) => {
      server.listen(4569, '127.0.0.1', (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        const address = server.address();
        if (!address || typeof address.port !== 'number') {
          reject(new Error('dynalite did not expose a valid bound port'));
          return;
        }

        resolve(address.port);
      });
    });

    const endpoint = `http://127.0.0.1:${port}`;
    lowLevelClient = new DynamoDBClient({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });

    const docClient = createDynamoDbDocumentClient({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });

    db = createDbAccess(docClient, {
      gameStateTableName: GAME_STATE_TABLE,
      commandLogTableName: COMMAND_LOG_TABLE,
    });
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    rmSync(dbPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await recreateTables();
  });

  it('DB key builders construct pk/sk patterns from schema', () => {
    expect(db.keyBuilders.gameState.character('game-1', 'char-1')).toEqual({
      pk: 'GAME#game-1',
      sk: 'CHAR#char-1',
    });

    expect(db.keyBuilders.gameState.gmInboxItem('game-1', '2026-03-01T00:00:00.000Z', 'char-1')).toEqual({
      pk: 'GM#game-1',
      sk: 'INBOX#2026-03-01T00:00:00.000Z#char-1',
    });

    expect(db.keyBuilders.commandLog.command('cmd-1')).toEqual({
      pk: 'COMMAND#cmd-1',
      sk: 'METADATA',
    });
  });

  it('Character repository: putCharacterDraft + getCharacter match schema shape', async () => {
    const draft = makeDraft();

    await db.characterRepository.putCharacterDraft({
      gameId: 'game-1',
      characterId: 'char-1',
      ownerPlayerId: 'player-1',
      draft,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      status: 'DRAFT',
    });

    const loaded = await db.characterRepository.getCharacter('game-1', 'char-1');
    expect(loaded?.pk).toBe('GAME#game-1');
    expect(loaded?.sk).toBe('CHAR#char-1');
    expect(loaded?.status).toBe('DRAFT');
    expect(loaded?.version).toBe(1);
    expect(loaded?.draft.identity.name).toBe('Lina');
  });

  it('Character repository: conditional update increments version and fails on mismatch', async () => {
    const created = await db.characterRepository.putCharacterDraft({
      gameId: 'game-1',
      characterId: 'char-1',
      ownerPlayerId: 'player-1',
      draft: makeDraft(),
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });

    const updated = await db.characterRepository.updateCharacterWithVersion({
      gameId: 'game-1',
      characterId: 'char-1',
      expectedVersion: created.version,
      next: {
        ownerPlayerId: created.ownerPlayerId,
        status: 'PENDING',
        draft: {
          ...created.draft,
          identity: { ...created.draft.identity, name: 'Lina Updated' },
        },
        updatedAt: '2026-03-01T00:05:00.000Z',
      },
    });

    expect(updated.version).toBe(2);
    expect(updated.status).toBe('PENDING');
    expect(updated.draft.identity.name).toBe('Lina Updated');

    await expect(
      db.characterRepository.updateCharacterWithVersion({
        gameId: 'game-1',
        characterId: 'char-1',
        expectedVersion: 1,
        next: {
          ownerPlayerId: created.ownerPlayerId,
          status: 'APPROVED',
          draft: updated.draft,
          updatedAt: '2026-03-01T00:06:00.000Z',
        },
      })
    ).rejects.toSatisfy((error: unknown) => isConditionalCheckFailed(error));
  });

  it('Inbox repository: write + query patterns match YAML access patterns', async () => {
    await db.inboxRepository.addGmInboxItem({
      gameId: 'game-1',
      promptId: 'prompt-char-1',
      kind: 'PENDING_CHARACTER',
      ref: { characterId: 'char-1', playerId: 'player-1', commandId: 'cmd-1' },
      ownerPlayerId: 'player-1',
      message: 'Character char-1 submitted for review',
      createdAt: '2026-03-01T00:10:00.000Z',
      submittedAt: '2026-03-01T00:10:00.000Z',
      readAt: null,
    });

    await db.inboxRepository.addPlayerInboxItem({
      playerId: 'player-1',
      promptId: 'prompt-1',
      gameId: 'game-1',
      kind: 'CHAR_SUBMITTED',
      ref: { characterId: 'char-1', commandId: 'cmd-1' },
      message: 'Submitted for review',
      createdAt: '2026-03-01T00:10:01.000Z',
      readAt: null,
    });

    const gmItems = await db.inboxRepository.queryGmInbox('game-1');
    expect(gmItems).toHaveLength(1);
    expect(gmItems[0]?.pk).toBe('GM#game-1');
    expect(gmItems[0]?.sk.startsWith('INBOX#')).toBe(true);

    const playerItems = await db.inboxRepository.queryPlayerInbox('player-1');
    expect(playerItems).toHaveLength(1);
    expect(playerItems[0]?.pk).toBe('PLAYER#player-1');
    expect(playerItems[0]?.sk.startsWith('INBOX#')).toBe(true);
  });

  it('CommandLog repository: createAccepted -> markProcessing -> markProcessed -> get', async () => {
    const accepted = await db.commandLogRepository.createAccepted({
      commandId: 'cmd-1',
      gameId: 'game-1',
      actorId: 'player-1',
      type: 'CreateCharacterDraft',
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    expect(accepted.status).toBe('ACCEPTED');

    const processing = await db.commandLogRepository.markProcessing('cmd-1', '2026-03-01T00:00:02.000Z');
    expect(processing.status).toBe('PROCESSING');

    const processed = await db.commandLogRepository.markProcessed('cmd-1', '2026-03-01T00:00:03.000Z', {
      characterId: 'char-1',
    });
    expect(processed.status).toBe('PROCESSED');
    expect(processed.resultRef.characterId).toBe('char-1');

    const loaded = await db.commandLogRepository.get('cmd-1');
    expect(loaded?.pk).toBe('COMMAND#cmd-1');
    expect(loaded?.status).toBe('PROCESSED');
  });

  it('CommandLog repository: markFailed stores error metadata', async () => {
    await db.commandLogRepository.createAccepted({
      commandId: 'cmd-2',
      gameId: 'game-1',
      actorId: 'player-1',
      type: 'SpendStartingExp',
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    const failed = await db.commandLogRepository.markFailed(
      'cmd-2',
      '2026-03-01T00:00:05.000Z',
      'EXP_INSUFFICIENT',
      'Not enough exp'
    );

    expect(failed.status).toBe('FAILED');
    expect(failed.errorCode).toBe('EXP_INSUFFICIENT');
    expect(failed.errorMessage).toBe('Not enough exp');
  });
});

async function recreateTables(): Promise<void> {
  await deleteTableIfExists(GAME_STATE_TABLE);
  await deleteTableIfExists(COMMAND_LOG_TABLE);

  await lowLevelClient.send(
    new CreateTableCommand({
      TableName: GAME_STATE_TABLE,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    })
  );
  await waitUntilTableExists(
    { client: lowLevelClient, maxWaitTime: 10, minDelay: 1, maxDelay: 1 },
    { TableName: GAME_STATE_TABLE }
  );

  await lowLevelClient.send(
    new CreateTableCommand({
      TableName: COMMAND_LOG_TABLE,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    })
  );
  await waitUntilTableExists(
    { client: lowLevelClient, maxWaitTime: 10, minDelay: 1, maxDelay: 1 },
    { TableName: COMMAND_LOG_TABLE }
  );
}

async function deleteTableIfExists(tableName: string): Promise<void> {
  try {
    await lowLevelClient.send(new DeleteTableCommand({ TableName: tableName }));
    await waitUntilTableNotExists(
      { client: lowLevelClient, maxWaitTime: 10, minDelay: 1, maxDelay: 1 },
      { TableName: tableName }
    );
  } catch {
    // ignore if table does not exist
  }
}

function makeDraft(): CharacterDraft {
  return {
    race: 'HUMAN',
    raisedBy: null,
    subAbility: { A: 9, B: 8, C: 6, D: 7, E: 7, F: 12, G: 8, H: 6 },
    ability: { dex: 17, agi: 14, int: 13, str: 19, lf: 20, mp: 14 },
    bonus: { dex: 2, agi: 2, int: 2, str: 3, lf: 3, mp: 2 },
    background: { kind: 'RUNE_MASTER', roll2d: 3 },
    starting: {
      expTotal: 2000,
      expUnspent: 1500,
      moneyGamels: 1800,
      moneyRoll2d: 9,
      startingSkills: [
        { skill: 'Sorcerer', level: 1 },
        { skill: 'Sage', level: 1 },
      ],
    },
    skills: [
      { skill: 'Sorcerer', level: 1 },
      { skill: 'Sage', level: 1 },
      { skill: 'Fighter', level: 1 },
    ],
    purchases: {
      weapons: [{ itemId: 'mage_staff', reqStr: 10, costGamels: 200 }],
      armor: [{ itemId: 'cloth_armor', reqStr: 3, costGamels: 40 }],
      shields: [],
      gear: [],
    },
    identity: { name: 'Lina', age: 22, gender: 'F' },
    gmNote: null,
  };
}
