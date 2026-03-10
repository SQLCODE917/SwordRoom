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
  ScanCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  characterItemSchema,
  commandLogItemSchema,
  commandLogKeys,
  gameStateKeys,
  gameInviteItemSchema,
  gameMemberItemSchema,
  gmInboxItemSchema,
  gameMetadataItemSchema,
  playerInboxItemSchema,
  playerProfileItemSchema,
  type CharacterDraft,
  type CharacterItem,
  type CharacterStatus,
  type CommandLogItem,
  type CommandStatus,
  type GameInviteItem,
  type GameInviteStatus,
  type GameMemberItem,
  type GameMetadataItem,
  type GMInboxItem,
  type GameVisibility,
  type PlayerProfileItem,
  type PlayerInboxItem,
} from '@starter/shared';

export interface DbTables {
  gameStateTableName: string;
  commandLogTableName: string;
}

export interface DbAccess {
  tables: DbTables;
  keyBuilders: {
    gameState: typeof gameStateKeys;
    commandLog: typeof commandLogKeys;
  };
  transactWrite(items: NonNullable<TransactWriteCommandInput['TransactItems']>): Promise<void>;
  characterRepository: {
    getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
    listCharactersByOwner(ownerPlayerId: string): Promise<CharacterItem[]>;
    putCharacterDraft(input: PutCharacterDraftInput): Promise<CharacterItem>;
    updateCharacterWithVersion(input: UpdateCharacterWithVersionInput): Promise<CharacterItem>;
  };
  gameRepository: {
    getGameMetadata(gameId: string): Promise<GameMetadataItem | null>;
    putGameMetadata(input: PutGameMetadataInput): Promise<GameMetadataItem>;
    updateGameMetadataWithVersion(input: UpdateGameMetadataWithVersionInput): Promise<GameMetadataItem>;
    listPublicGames(): Promise<GameMetadataItem[]>;
    listAllGames(): Promise<GameMetadataItem[]>;
    listGamesForPlayer(playerId: string): Promise<GameMetadataItem[]>;
    listGamesForGm(playerId: string): Promise<GameMetadataItem[]>;
  };
  playerRepository: {
    getPlayerProfile(playerId: string): Promise<PlayerProfileItem | null>;
    getPlayerProfileByEmail(emailNormalized: string): Promise<PlayerProfileItem | null>;
    upsertPlayerProfile(input: UpsertPlayerProfileInput): Promise<PlayerProfileItem>;
    listUsers(): Promise<PlayerProfileItem[]>;
  };
  membershipRepository: {
    getMembership(gameId: string, playerId: string): Promise<GameMemberItem | null>;
    putMembership(input: PutGameMemberInput): Promise<GameMemberItem>;
    deleteMembership(gameId: string, playerId: string): Promise<void>;
  };
  inviteRepository: {
    getInvite(gameId: string, inviteId: string): Promise<GameInviteItem | null>;
    putInvite(input: PutGameInviteInput): Promise<GameInviteItem>;
    updateInviteWithVersion(input: UpdateGameInviteWithVersionInput): Promise<GameInviteItem>;
  };
  inboxRepository: {
    addGmInboxItem(input: AddGmInboxItemInput): Promise<GMInboxItem>;
    addPlayerInboxItem(input: AddPlayerInboxItemInput): Promise<PlayerInboxItem>;
    queryGmInbox(gameId: string): Promise<GMInboxItem[]>;
    queryPlayerInbox(playerId: string): Promise<PlayerInboxItem[]>;
    deleteGmInboxItem(gameId: string, createdAt: string, promptId: string): Promise<void>;
    deletePlayerInboxItem(playerId: string, createdAt: string, promptId: string): Promise<void>;
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
  submittedAt?: string | null;
  submittedDraftVersion?: number | null;
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
    submittedAt?: string | null;
    submittedDraftVersion?: number | null;
  };
}

export interface AddGmInboxItemInput {
  gameId: string;
  promptId: string;
  kind: 'PENDING_CHARACTER' | 'GAME_INVITE_ACCEPTED' | 'GAME_INVITE_REJECTED';
  ref: {
    characterId?: string | null;
    commandId?: string | null;
    inviteId?: string | null;
    playerId?: string | null;
  };
  ownerPlayerId?: string | null;
  message: string;
  createdAt: string;
  submittedAt?: string | null;
  readAt?: string | null;
}

export interface AddPlayerInboxItemInput {
  playerId: string;
  promptId: string;
  gameId: string;
  kind: 'CHAR_SUBMITTED' | 'CHAR_APPROVED' | 'CHAR_REJECTED' | 'ACTION_REQUIRED' | 'GAME_INVITE';
  ref: {
    characterId?: string | null;
    commandId?: string | null;
    inviteId?: string | null;
    playerId?: string | null;
  };
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface PutGameMetadataInput {
  gameId: string;
  name: string;
  visibility: GameVisibility;
  createdByPlayerId: string;
  gmPlayerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateGameMetadataWithVersionInput {
  gameId: string;
  expectedVersion: number;
  next: {
    name: string;
    visibility: GameVisibility;
    createdByPlayerId: string;
    gmPlayerId: string;
    updatedAt: string;
  };
}

export interface UpsertPlayerProfileInput {
  playerId: string;
  displayName: string;
  email: string | null;
  emailNormalized: string | null;
  emailVerified: boolean;
  roles: Array<'PLAYER' | 'GM' | 'ADMIN'>;
  updatedAt: string;
}

export interface PutGameMemberInput {
  gameId: string;
  playerId: string;
  roles: Array<'PLAYER' | 'GM'>;
  createdAt: string;
  updatedAt: string;
}

export interface PutGameInviteInput {
  gameId: string;
  inviteId: string;
  invitedPlayerId: string;
  invitedEmailNormalized: string;
  invitedByPlayerId: string;
  status: GameInviteStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}

export interface UpdateGameInviteWithVersionInput {
  gameId: string;
  inviteId: string;
  expectedVersion: number;
  next: {
    invitedPlayerId: string;
    invitedEmailNormalized: string;
    invitedByPlayerId: string;
    status: GameInviteStatus;
    updatedAt: string;
    respondedAt: string | null;
  };
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
    tables,
    keyBuilders: {
      gameState: gameStateKeys,
      commandLog: commandLogKeys,
    },
    async transactWrite(items) {
      try {
        await client.send(
          new TransactWriteCommand({
            TransactItems: items,
          })
        );
      } catch (error) {
        if (!isDynaliteUnknownTransactionError(error)) {
          throw error;
        }
        await applyTransactFallback(client, items);
      }
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

      async listCharactersByOwner(ownerPlayerId) {
        const result = await client.send(
          new ScanCommand({
            TableName: tables.gameStateTableName,
            FilterExpression: '#type = :type AND ownerPlayerId = :ownerPlayerId',
            ExpressionAttributeNames: {
              '#type': 'type',
            },
            ExpressionAttributeValues: {
              ':type': 'Character',
              ':ownerPlayerId': ownerPlayerId,
            },
          })
        );

        return (result.Items ?? []).map((item) => characterItemSchema.parse(item));
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
          submittedAt: input.submittedAt ?? null,
          submittedDraftVersion: input.submittedDraftVersion ?? null,
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
              'SET ownerPlayerId = :ownerPlayerId, #status = :status, draft = :draft, updatedAt = :updatedAt, submittedAt = :submittedAt, submittedDraftVersion = :submittedDraftVersion, #version = :nextVersion',
            ExpressionAttributeNames: {
              '#version': 'version',
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':ownerPlayerId': input.next.ownerPlayerId,
              ':status': input.next.status,
              ':draft': input.next.draft,
              ':updatedAt': input.next.updatedAt,
              ':submittedAt': input.next.submittedAt ?? null,
              ':submittedDraftVersion': input.next.submittedDraftVersion ?? null,
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
    gameRepository: {
      async getGameMetadata(gameId) {
        const key = gameStateKeys.gameMetadata(gameId);
        const result = await client.send(
          new GetCommand({
            TableName: tables.gameStateTableName,
            Key: key,
          })
        );

        if (!result.Item) {
          return null;
        }

        return gameMetadataItemSchema.parse(result.Item);
      },

      async putGameMetadata(input) {
        const key = gameStateKeys.gameMetadata(input.gameId);
        const item: GameMetadataItem = {
          ...key,
          type: 'GameMetadata',
          gameId: input.gameId,
          name: input.name,
          visibility: input.visibility,
          createdByPlayerId: input.createdByPlayerId,
          gmPlayerId: input.gmPlayerId,
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

      async updateGameMetadataWithVersion(input) {
        const key = gameStateKeys.gameMetadata(input.gameId);
        const nextVersion = input.expectedVersion + 1;
        await client.send(
          new UpdateCommand({
            TableName: tables.gameStateTableName,
            Key: key,
            ConditionExpression: '#version = :expectedVersion',
            UpdateExpression:
              'SET #name = :name, visibility = :visibility, createdByPlayerId = :createdByPlayerId, gmPlayerId = :gmPlayerId, updatedAt = :updatedAt, #version = :nextVersion',
            ExpressionAttributeNames: {
              '#version': 'version',
              '#name': 'name',
            },
            ExpressionAttributeValues: {
              ':name': input.next.name,
              ':visibility': input.next.visibility,
              ':createdByPlayerId': input.next.createdByPlayerId,
              ':gmPlayerId': input.next.gmPlayerId,
              ':updatedAt': input.next.updatedAt,
              ':expectedVersion': input.expectedVersion,
              ':nextVersion': nextVersion,
            },
          })
        );

        const refreshed = await this.getGameMetadata(input.gameId);
        if (!refreshed) {
          throw new Error('game metadata not found after successful update');
        }
        return refreshed;
      },

      async listPublicGames() {
        return scanGameMetadataByVisibility(client, tables.gameStateTableName, 'PUBLIC');
      },

      async listAllGames() {
        const result = await client.send(
          new ScanCommand({
            TableName: tables.gameStateTableName,
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
              '#type': 'type',
            },
            ExpressionAttributeValues: {
              ':type': 'GameMetadata',
            },
          })
        );

        return (result.Items ?? []).map((item) => gameMetadataItemSchema.parse(item));
      },

      async listGamesForPlayer(playerId) {
        const memberships = await scanMembershipsByPlayer(client, tables.gameStateTableName, playerId);
        const games = await Promise.all(memberships.map((membership) => this.getGameMetadata(membership.gameId)));
        return games.filter((game): game is GameMetadataItem => game !== null);
      },

      async listGamesForGm(playerId) {
        const memberships = await scanMembershipsByPlayer(client, tables.gameStateTableName, playerId);
        const gmMemberships = memberships.filter((membership) => membership.roles.includes('GM'));
        const games = await Promise.all(gmMemberships.map((membership) => this.getGameMetadata(membership.gameId)));
        return games.filter((game): game is GameMetadataItem => game !== null);
      },
    },
    playerRepository: {
      async getPlayerProfile(playerId) {
        const key = gameStateKeys.playerProfile(playerId);
        const result = await client.send(
          new GetCommand({
            TableName: tables.gameStateTableName,
            Key: key,
          })
        );

        if (!result.Item) {
          return null;
        }

        return playerProfileItemSchema.parse(result.Item);
      },

      async getPlayerProfileByEmail(emailNormalized) {
        const result = await client.send(
          new ScanCommand({
            TableName: tables.gameStateTableName,
            FilterExpression: '#type = :type AND emailNormalized = :emailNormalized',
            ExpressionAttributeNames: {
              '#type': 'type',
            },
            ExpressionAttributeValues: {
              ':type': 'PlayerProfile',
              ':emailNormalized': emailNormalized,
            },
          })
        );

        const first = result.Items?.[0];
        return first ? playerProfileItemSchema.parse(first) : null;
      },

      async upsertPlayerProfile(input) {
        const key = gameStateKeys.playerProfile(input.playerId);
        const existing = await this.getPlayerProfile(input.playerId);
        const item: PlayerProfileItem = {
          ...key,
          type: 'PlayerProfile',
          playerId: input.playerId,
          displayName: input.displayName,
          email: input.email,
          emailNormalized: input.emailNormalized,
          emailVerified: input.emailVerified,
          roles: input.roles,
          createdAt: existing?.createdAt ?? input.updatedAt,
          updatedAt: input.updatedAt,
        };

        await client.send(
          new PutCommand({
            TableName: tables.gameStateTableName,
            Item: item,
          })
        );

        return item;
      },

      async listUsers() {
        const result = await client.send(
          new ScanCommand({
            TableName: tables.gameStateTableName,
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
              '#type': 'type',
            },
            ExpressionAttributeValues: {
              ':type': 'PlayerProfile',
            },
          })
        );

        return (result.Items ?? []).map((item) => playerProfileItemSchema.parse(item));
      },
    },
    membershipRepository: {
      async getMembership(gameId, playerId) {
        const key = gameStateKeys.gameMember(gameId, playerId);
        const result = await client.send(
          new GetCommand({
            TableName: tables.gameStateTableName,
            Key: key,
          })
        );

        if (!result.Item) {
          return null;
        }

        return gameMemberItemSchema.parse(result.Item);
      },

      async putMembership(input) {
        const key = gameStateKeys.gameMember(input.gameId, input.playerId);
        const item: GameMemberItem = {
          ...key,
          type: 'GameMember',
          gameId: input.gameId,
          playerId: input.playerId,
          roles: input.roles,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        };

        await client.send(
          new PutCommand({
            TableName: tables.gameStateTableName,
            Item: item,
          })
        );

        return item;
      },

      async deleteMembership(gameId, playerId) {
        await client.send(
          new DeleteCommand({
            TableName: tables.gameStateTableName,
            Key: gameStateKeys.gameMember(gameId, playerId),
          })
        );
      },
    },
    inviteRepository: {
      async getInvite(gameId, inviteId) {
        const result = await client.send(
          new GetCommand({
            TableName: tables.gameStateTableName,
            Key: gameStateKeys.gameInvite(gameId, inviteId),
          })
        );

        if (!result.Item) {
          return null;
        }

        return gameInviteItemSchema.parse(result.Item);
      },

      async putInvite(input) {
        const key = gameStateKeys.gameInvite(input.gameId, input.inviteId);
        const item: GameInviteItem = {
          ...key,
          type: 'GameInvite',
          inviteId: input.inviteId,
          gameId: input.gameId,
          invitedPlayerId: input.invitedPlayerId,
          invitedEmailNormalized: input.invitedEmailNormalized,
          invitedByPlayerId: input.invitedByPlayerId,
          status: input.status,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          respondedAt: input.respondedAt,
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

      async updateInviteWithVersion(input) {
        const key = gameStateKeys.gameInvite(input.gameId, input.inviteId);
        const nextVersion = input.expectedVersion + 1;
        await client.send(
          new UpdateCommand({
            TableName: tables.gameStateTableName,
            Key: key,
            ConditionExpression: '#version = :expectedVersion',
            UpdateExpression:
              'SET invitedPlayerId = :invitedPlayerId, invitedEmailNormalized = :invitedEmailNormalized, invitedByPlayerId = :invitedByPlayerId, #status = :status, updatedAt = :updatedAt, respondedAt = :respondedAt, #version = :nextVersion',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#version': 'version',
            },
            ExpressionAttributeValues: {
              ':invitedPlayerId': input.next.invitedPlayerId,
              ':invitedEmailNormalized': input.next.invitedEmailNormalized,
              ':invitedByPlayerId': input.next.invitedByPlayerId,
              ':status': input.next.status,
              ':updatedAt': input.next.updatedAt,
              ':respondedAt': input.next.respondedAt,
              ':expectedVersion': input.expectedVersion,
              ':nextVersion': nextVersion,
            },
          })
        );

        const refreshed = await this.getInvite(input.gameId, input.inviteId);
        if (!refreshed) {
          throw new Error('invite not found after successful update');
        }
        return refreshed;
      },
    },
    inboxRepository: {
      async addGmInboxItem(input) {
        const key = gameStateKeys.gmInboxItem(input.gameId, input.createdAt, input.promptId);
        const item: GMInboxItem = {
          ...key,
          type: 'GMInboxItem',
          promptId: input.promptId,
          gameId: input.gameId,
          kind: input.kind,
          ref: input.ref,
          ownerPlayerId: input.ownerPlayerId ?? null,
          message: input.message,
          createdAt: input.createdAt,
          submittedAt: input.submittedAt ?? null,
          readAt: input.readAt ?? null,
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
              ':prefix': 'INBOX#',
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
      async deleteGmInboxItem(gameId, createdAt, promptId) {
        const key = gameStateKeys.gmInboxItem(gameId, createdAt, promptId);
        await client.send(
          new DeleteCommand({
            TableName: tables.gameStateTableName,
            Key: key,
          })
        );
      },
      async deletePlayerInboxItem(playerId, createdAt, promptId) {
        await client.send(
          new DeleteCommand({
            TableName: tables.gameStateTableName,
            Key: gameStateKeys.playerInboxItem(playerId, createdAt, promptId),
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

function isDynaliteUnknownTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = (error as { message?: string }).message;
  return name === 'UnknownError' || message === 'UnknownError';
}

async function applyTransactFallback(
  client: DynamoDBDocumentClient,
  items: NonNullable<TransactWriteCommandInput['TransactItems']>
): Promise<void> {
  for (const item of items) {
    if (item.Put) {
      await client.send(new PutCommand(item.Put));
      continue;
    }
    if (item.Update) {
      await client.send(new UpdateCommand(item.Update));
      continue;
    }
    if (item.Delete) {
      await client.send(new DeleteCommand(item.Delete));
      continue;
    }
  }
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

async function scanGameMetadataByVisibility(
  client: DynamoDBDocumentClient,
  tableName: string,
  visibility: GameVisibility
): Promise<GameMetadataItem[]> {
  const result = await client.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: '#type = :type AND visibility = :visibility',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':type': 'GameMetadata',
        ':visibility': visibility,
      },
    })
  );

  return (result.Items ?? []).map((item) => gameMetadataItemSchema.parse(item));
}

async function scanMembershipsByPlayer(
  client: DynamoDBDocumentClient,
  tableName: string,
  playerId: string
): Promise<GameMemberItem[]> {
  const result = await client.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: '#type = :type AND playerId = :playerId',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':type': 'GameMember',
        ':playerId': playerId,
      },
    })
  );

  return (result.Items ?? []).map((item) => gameMemberItemSchema.parse(item));
}
