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
import { createApiService } from '@starter/services-api';
import { createDispatcher } from '@starter/services-dispatcher';
import { createDbAccess, createDynamoDbDocumentClient, InMemoryFifoQueue } from '@starter/services-shared';
import { loadVerticalSliceFixtures } from '@starter/shared';

const RUN_LOCAL_DDB_TESTS = process.env.RUN_LOCAL_DDB_TESTS === '1';
const maybeDescribe = RUN_LOCAL_DDB_TESTS ? describe : describe.skip;

const GAME_STATE_TABLE = 'GameState';
const COMMAND_LOG_TABLE = 'CommandLog';
const QUEUE_URL = 'commands.fifo';

const dbPath = join(tmpdir(), `dynalite-test-e2e-${randomUUID()}`);
mkdirSync(dbPath, { recursive: true });

const server = dynalite({
  path: dbPath,
  createTableMs: 0,
  deleteTableMs: 0,
});

let lowLevelClient: DynamoDBClient;
let db: ReturnType<typeof createDbAccess>;
let queue: InMemoryFifoQueue;
let api: ReturnType<typeof createApiService>;
let dispatcher: ReturnType<typeof createDispatcher>;

maybeDescribe('e2e.good.human_rune_master_sequence', () => {
  beforeAll(async () => {
    const port = await new Promise<number>((resolve, reject) => {
      server.listen(4570, '127.0.0.1', (error?: Error) => {
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

    queue = new InMemoryFifoQueue();
    api = createApiService({
      db,
      uploads: {
        async headObject() {
          return true;
        },
        async createSignedDownloadUrl() {
          return 'https://uploads.test/unused';
        },
      },
      queue,
      queueUrl: QUEUE_URL,
      jwtBypass: true,
    });
    dispatcher = createDispatcher({ db });
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

  it('runs command sequence and reaches APPROVED with expected inbox effects', async () => {
    const fixtures = loadVerticalSliceFixtures() as Record<string, any>;
    const sequence = (fixtures.command_sequences_for_integration as Array<Record<string, any>>).find(
      (item) => item.id === 'e2e.good.human_rune_master_sequence'
    );
    expect(sequence).toBeTruthy();

    const commands = (sequence!.commands ?? []) as Array<Record<string, any>>;

    let gmInboxSeen = false;
    let index = 0;
    for (const cmd of commands) {
      const commandId = deterministicCommandId(index);
      index += 1;

      const actorId = cmd.type === 'GMReviewCharacter' ? 'gm-player-1' : 'player-aaa';
      const envelope = {
        commandId,
        gameId: 'game-1',
        type: cmd.type,
        schemaVersion: 1,
        createdAt: `2026-03-01T00:00:${String(index).padStart(2, '0')}.000Z`,
        payload: cmd.payload,
      } as const;

      await api.postCommands({
        envelope,
        bypassActorId: actorId,
      });

      const messages = await queue.receiveMessages(QUEUE_URL, 1);
      expect(messages).toHaveLength(1);

      const message = messages[0]!;
      const parsedEnvelope = JSON.parse(message.messageBody);
      const dispatchResult = await dispatcher.dispatch(parsedEnvelope);
      expect(['PROCESSED', 'NOOP_ALREADY_PROCESSED']).toContain(dispatchResult.outcome);
      await queue.deleteMessage(QUEUE_URL, message.receiptHandle);
      const commandStatus = await api.readApis.getCommandStatus(commandId);
      expect(commandStatus?.status).toBe('PROCESSED');

      if (cmd.type === 'SubmitCharacterForApproval') {
        const gmInbox = await api.readApis.getGmInbox('game-1');
        expect(gmInbox.length).toBeGreaterThan(0);
        gmInboxSeen = true;
      }
    }

    expect(gmInboxSeen).toBe(true);

    const character = await api.readApis.getCharacter('game-1', 'char-human-1');
    expect(character?.status).toBe('APPROVED');

    const gmInboxAfterReview = await api.readApis.getGmInbox('game-1');
    expect(gmInboxAfterReview).toHaveLength(0);

    const playerInbox = await api.readApis.getMyInbox('player-aaa');
    expect(playerInbox.some((item) => item.kind === 'CHAR_APPROVED')).toBe(true);
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
    // ignore
  }
}

function deterministicCommandId(index: number): string {
  const suffix = String(index + 1).padStart(12, '0');
  return `00000000-0000-4000-8000-${suffix}`;
}
