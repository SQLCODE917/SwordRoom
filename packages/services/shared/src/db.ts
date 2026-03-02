import {
  DynamoDBClient,
  type ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  characterItemSchema,
  commandLogItemSchema,
  commandLogKeys,
  gameStateKeys,
  gmInboxItemSchema,
  playerInboxItemSchema,
  type CharacterDraft,
  type CharacterItem,
  type CharacterStatus,
  type CommandLogItem,
  type CommandStatus,
  type GMInboxItem,
  type PlayerInboxItem,
} from '@starter/shared';

export interface DbTables {
  gameStateTableName: string;
  commandLogTableName: string;
}

export interface DbAccess {
  keyBuilders: {
    gameState: typeof gameStateKeys;
    commandLog: typeof commandLogKeys;
  };
  characterRepository: {
    getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
    putCharacterDraft(input: PutCharacterDraftInput): Promise<CharacterItem>;
    updateCharacterWithVersion(input: UpdateCharacterWithVersionInput): Promise<CharacterItem>;
  };
  inboxRepository: {
    addGmInboxItem(input: AddGmInboxItemInput): Promise<GMInboxItem>;
    addPlayerInboxItem(input: AddPlayerInboxItemInput): Promise<PlayerInboxItem>;
    queryGmInbox(gameId: string): Promise<GMInboxItem[]>;
    queryPlayerInbox(playerId: string): Promise<PlayerInboxItem[]>;
    resolveGmInboxItem(gameId: string, submittedAt: string, characterId: string): Promise<void>;
  };
  commandLogRepository: {
    createAccepted(input: CreateAcceptedCommandInput): Promise<CommandLogItem>;
    markProcessing(commandId: string, updatedAt: string): Promise<CommandLogItem>;
    markProcessed(
      commandId: string,
      updatedAt: string,
      resultRef?: { characterId: string | null }
    ): Promise<CommandLogItem>;
    markFailed(
      commandId: string,
      updatedAt: string,
      errorCode: string,
      errorMessage: string
    ): Promise<CommandLogItem>;
    get(commandId: string): Promise<CommandLogItem | null>;
  };
}

export interface PutCharacterDraftInput {
  gameId: string;
  characterId: string;
  ownerPlayerId: string;
  draft: CharacterDraft;
  createdAt: string;
  updatedAt: string;
  status?: CharacterStatus;
}

export interface UpdateCharacterWithVersionInput {
  gameId: string;
  characterId: string;
  expectedVersion: number;
  next: {
    ownerPlayerId: string;
    draft: CharacterDraft;
    updatedAt: string;
    status: CharacterStatus;
  };
}

export interface AddGmInboxItemInput {
  gameId: string;
  characterId: string;
  ownerPlayerId: string;
  submittedAt: string;
}

export interface AddPlayerInboxItemInput {
  playerId: string;
  promptId: string;
  gameId: string;
  kind: 'CHAR_SUBMITTED' | 'CHAR_APPROVED' | 'CHAR_REJECTED' | 'ACTION_REQUIRED';
  ref: {
    characterId: string | null;
    commandId: string | null;
  };
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface CreateAcceptedCommandInput {
  commandId: string;
  gameId: string;
  actorId: string;
  type: string;
  createdAt: string;
  resultRef?: { characterId: string | null };
}

export function createDynamoDbDocumentClient(input?: {
  region?: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: input?.region ?? 'us-east-1',
    endpoint: input?.endpoint,
    credentials: input?.credentials,
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  });
}

export function createDbAccess(client: DynamoDBDocumentClient, tables: DbTables): DbAccess {
  return {
    keyBuilders: {
      gameState: gameStateKeys,
      commandLog: commandLogKeys,
    },
    characterRepository: {
      async getCharacter(gameId, characterId) {
        const key = gameStateKeys.character(gameId, characterId);
        const result = await client.send(
          new GetCommand({
            TableName: tables.gameStateTableName,
            Key: key,
          })
        );

        if (!result.Item) {
          return null;
        }

        return characterItemSchema.parse(result.Item);
      },

      async putCharacterDraft(input) {
        const key = gameStateKeys.character(input.gameId, input.characterId);

        const item: CharacterItem = {
          ...key,
          type: 'Character',
          gameId: input.gameId,
          characterId: input.characterId,
          ownerPlayerId: input.ownerPlayerId,
          status: input.status ?? 'DRAFT',
          draft: input.draft,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          version: 1,
        };

        await client.send(
          new PutCommand({
            TableName: tables.gameStateTableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          })
        );

        return item;
      },

      async updateCharacterWithVersion(input) {
        const key = gameStateKeys.character(input.gameId, input.characterId);
        const nextVersion = input.expectedVersion + 1;

        await client.send(
          new UpdateCommand({
            TableName: tables.gameStateTableName,
            Key: key,
            ConditionExpression: '#version = :expectedVersion',
            UpdateExpression:
              'SET ownerPlayerId = :ownerPlayerId, #status = :status, draft = :draft, updatedAt = :updatedAt, #version = :nextVersion',
            ExpressionAttributeNames: {
              '#version': 'version',
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':ownerPlayerId': input.next.ownerPlayerId,
              ':status': input.next.status,
              ':draft': input.next.draft,
              ':updatedAt': input.next.updatedAt,
              ':expectedVersion': input.expectedVersion,
              ':nextVersion': nextVersion,
            },
            ReturnValues: 'ALL_NEW',
          })
        );

        const refreshed = await this.getCharacter(input.gameId, input.characterId);
        if (!refreshed) {
          throw new Error('character not found after successful update');
        }
        return refreshed;
      },
    },
    inboxRepository: {
      async addGmInboxItem(input) {
        const key = gameStateKeys.gmInboxItem(input.gameId, input.submittedAt, input.characterId);
        const item: GMInboxItem = {
          ...key,
          type: 'GMInboxItem',
          gameId: input.gameId,
          characterId: input.characterId,
          ownerPlayerId: input.ownerPlayerId,
          status: 'PENDING',
          submittedAt: input.submittedAt,
        };

        await client.send(
          new PutCommand({
            TableName: tables.gameStateTableName,
            Item: item,
          })
        );

        return item;
      },

      async addPlayerInboxItem(input) {
        const key = gameStateKeys.playerInboxItem(input.playerId, input.createdAt, input.promptId);
        const item: PlayerInboxItem = {
          ...key,
          type: 'PlayerInboxItem',
          promptId: input.promptId,
          gameId: input.gameId,
          kind: input.kind,
          ref: input.ref,
          message: input.message,
          createdAt: input.createdAt,
          readAt: input.readAt,
        };

        await client.send(
          new PutCommand({
            TableName: tables.gameStateTableName,
            Item: item,
          })
        );

        return item;
      },

      async queryGmInbox(gameId) {
        const result = await client.send(
          new QueryCommand({
            TableName: tables.gameStateTableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: {
              ':pk': `GM#${gameId}`,
              ':prefix': 'PENDING_CHAR#',
            },
          })
        );

        return (result.Items ?? []).map((item) => gmInboxItemSchema.parse(item));
      },

      async queryPlayerInbox(playerId) {
        const result = await client.send(
          new QueryCommand({
            TableName: tables.gameStateTableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: {
              ':pk': `PLAYER#${playerId}`,
              ':prefix': 'INBOX#',
            },
          })
        );

        return (result.Items ?? []).map((item) => playerInboxItemSchema.parse(item));
      },
      async resolveGmInboxItem(gameId, submittedAt, characterId) {
        const key = gameStateKeys.gmInboxItem(gameId, submittedAt, characterId);
        await client.send(
          new DeleteCommand({
            TableName: tables.gameStateTableName,
            Key: key,
          })
        );
      },
    },
    commandLogRepository: {
      async createAccepted(input) {
        const key = commandLogKeys.command(input.commandId);
        const item: CommandLogItem = {
          ...key,
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
          resultRef: {
            characterId: input.resultRef?.characterId ?? null,
          },
        };

        await client.send(
          new PutCommand({
            TableName: tables.commandLogTableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          })
        );

        return item;
      },

      async markProcessing(commandId, updatedAt) {
        return updateCommandLogStatus(client, tables.commandLogTableName, commandId, 'PROCESSING', updatedAt);
      },

      async markProcessed(commandId, updatedAt, resultRef) {
        return updateCommandLogStatus(
          client,
          tables.commandLogTableName,
          commandId,
          'PROCESSED',
          updatedAt,
          null,
          null,
          resultRef
        );
      },

      async markFailed(commandId, updatedAt, errorCode, errorMessage) {
        return updateCommandLogStatus(
          client,
          tables.commandLogTableName,
          commandId,
          'FAILED',
          updatedAt,
          errorCode,
          errorMessage
        );
      },

      async get(commandId) {
        const key = commandLogKeys.command(commandId);
        const result = await client.send(
          new GetCommand({
            TableName: tables.commandLogTableName,
            Key: key,
          })
        );

        if (!result.Item) {
          return null;
        }

        return commandLogItemSchema.parse(result.Item);
      },
    },
  };
}

export function isConditionalCheckFailed(error: unknown): error is ConditionalCheckFailedException {
  return Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'ConditionalCheckFailedException');
}

async function updateCommandLogStatus(
  client: DynamoDBDocumentClient,
  tableName: string,
  commandId: string,
  status: CommandStatus,
  updatedAt: string,
  errorCode: string | null = null,
  errorMessage: string | null = null,
  resultRef?: { characterId: string | null }
): Promise<CommandLogItem> {
  const key = commandLogKeys.command(commandId);

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression:
        'SET #status = :status, updatedAt = :updatedAt, errorCode = :errorCode, errorMessage = :errorMessage, resultRef = :resultRef',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': updatedAt,
        ':errorCode': errorCode,
        ':errorMessage': errorMessage,
        ':resultRef': {
          characterId: resultRef?.characterId ?? null,
        },
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  const refreshed = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
    })
  );

  if (!refreshed.Item) {
    throw new Error('command log missing after update');
  }

  return commandLogItemSchema.parse(refreshed.Item);
}
