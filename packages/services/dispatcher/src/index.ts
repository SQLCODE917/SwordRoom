import {
  COMMAND_TYPES,
  anyCommandEnvelopeSchema,
  type AnyCommandEnvelope,
  type CommandType,
} from '@starter/shared';
import {
  assertGameMasterActor,
  logServiceFlow,
  summarizeCommandEnvelope,
  summarizeError,
  type DbAccess,
} from '@starter/services-shared';
import { handlerRegistry } from './handlers/index.js';
import type { DispatcherContext, HandlerEffects, InboxEffect, WriteEffect } from './handlers/types.js';

export interface DispatcherDependencies {
  db: DbAccess;
}

export interface DispatchResult {
  commandId: string;
  outcome: 'NOOP_ALREADY_PROCESSED' | 'PROCESSED' | 'FAILED';
  errorCode?: string;
}

export const registeredTypes: ReadonlyArray<CommandType> = COMMAND_TYPES;

export function listRegisteredCommandTypes(): ReadonlyArray<CommandType> {
  return registeredTypes;
}

export function createDispatcher(deps: DispatcherDependencies) {
  const context: DispatcherContext = {
    db: deps.db,
    nowIso,
  };
  const flowLogEnabled = process.env.FLOW_LOG === '1';

  return {
    async dispatch(envelopeInput: unknown): Promise<DispatchResult> {
      const parsed = anyCommandEnvelopeSchema.parse(envelopeInput);
      logFlow(flowLogEnabled, 'DISPATCH_BEGIN', summarizeCommandEnvelope(parsed));
      const existing = await deps.db.commandLogRepository.get(parsed.commandId);

      if (existing?.status === 'PROCESSED') {
        logFlow(flowLogEnabled, 'DISPATCH_NOOP_ALREADY_PROCESSED', summarizeCommandEnvelope(parsed));
        return { commandId: parsed.commandId, outcome: 'NOOP_ALREADY_PROCESSED' };
      }

      try {
        await deps.db.commandLogRepository.markProcessing(parsed.commandId, nowIso());
        logFlow(flowLogEnabled, 'DISPATCH_MARK_PROCESSING', {
          commandId: parsed.commandId,
          type: parsed.type,
          gameId: parsed.gameId,
        });

        if (
          parsed.type === 'GMReviewCharacter' ||
          parsed.type === 'SetGameVisibility' ||
          parsed.type === 'InvitePlayerToGameByEmail'
        ) {
          await assertGameMasterActor(deps.db, {
            gameId: parsed.gameId,
            actorId: parsed.actorId,
          });
          logFlow(flowLogEnabled, 'DISPATCH_GM_AUTHORIZED', summarizeCommandEnvelope(parsed));
        }

        const handler = handlerRegistry[parsed.type];
        const effects = await handler(context, parsed as never);
        logFlow(flowLogEnabled, 'DISPATCH_HANDLER_EFFECTS', {
          ...summarizeCommandEnvelope(parsed),
          ...summarizeHandlerEffects(effects),
        });

        await applyEffectsTransact(deps.db, parsed, effects, nowIso());
        logFlow(flowLogEnabled, 'DISPATCH_APPLY_EFFECTS_OK', {
          ...summarizeCommandEnvelope(parsed),
          ...summarizeHandlerEffects(effects),
        });

        return { commandId: parsed.commandId, outcome: 'PROCESSED' };
      } catch (error) {
        const errorCode = extractErrorCode(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await deps.db.commandLogRepository.markFailed(parsed.commandId, nowIso(), errorCode, errorMessage);
        logFlow(flowLogEnabled, 'DISPATCH_FAILED', {
          ...summarizeCommandEnvelope(parsed),
          ...summarizeError(error),
        });
        return { commandId: parsed.commandId, outcome: 'FAILED', errorCode };
      }
    },
  };
}

async function applyEffectsTransact(
  db: DbAccess,
  envelope: AnyCommandEnvelope,
  effects: HandlerEffects,
  updatedAt: string
): Promise<void> {
  const transactItems: Parameters<DbAccess['transactWrite']>[0] = [];

  for (const write of effects.writes) {
    transactItems.push(toTransactWriteItem(db, write));
  }

  for (const inbox of effects.inbox) {
    transactItems.push(toTransactInboxItem(db, inbox));
  }

  transactItems.push({
    Update: {
      TableName: db.tables.commandLogTableName,
      Key: db.keyBuilders.commandLog.command(envelope.commandId),
      ConditionExpression: '#status = :processing',
      UpdateExpression:
        'SET #status = :status, updatedAt = :updatedAt, errorCode = :errorCode, errorMessage = :errorMessage, resultRef = :resultRef',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':processing': 'PROCESSING',
        ':status': 'PROCESSED',
        ':updatedAt': updatedAt,
        ':errorCode': null,
        ':errorMessage': null,
        ':resultRef': {
          characterId: extractCharacterId(envelope),
        },
      },
    },
  });

  await db.transactWrite(transactItems);
}

function toTransactWriteItem(
  db: DbAccess,
  effect: WriteEffect
): Parameters<DbAccess['transactWrite']>[0][number] {
  switch (effect.kind) {
    case 'PUT_CHARACTER_DRAFT': {
      const key = db.keyBuilders.gameState.character(effect.input.gameId, effect.input.characterId);
      return {
        Put: {
          TableName: db.tables.gameStateTableName,
          Item: {
            ...key,
            type: 'Character',
            gameId: effect.input.gameId,
            characterId: effect.input.characterId,
            ownerPlayerId: effect.input.ownerPlayerId,
            status: effect.input.status ?? 'DRAFT',
            draft: effect.input.draft,
            submittedAt: effect.input.submittedAt ?? null,
            submittedDraftVersion: effect.input.submittedDraftVersion ?? null,
            createdAt: effect.input.createdAt,
            updatedAt: effect.input.updatedAt,
            version: 1,
          },
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      };
    }
    case 'UPDATE_CHARACTER_WITH_VERSION': {
      const key = db.keyBuilders.gameState.character(effect.input.gameId, effect.input.characterId);
      return {
        Update: {
          TableName: db.tables.gameStateTableName,
          Key: key,
          ConditionExpression: '#version = :expectedVersion',
          UpdateExpression:
            'SET ownerPlayerId = :ownerPlayerId, #status = :status, draft = :draft, updatedAt = :updatedAt, submittedAt = :submittedAt, submittedDraftVersion = :submittedDraftVersion, #version = :nextVersion',
          ExpressionAttributeNames: {
            '#version': 'version',
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':ownerPlayerId': effect.input.next.ownerPlayerId,
            ':status': effect.input.next.status,
            ':draft': effect.input.next.draft,
            ':updatedAt': effect.input.next.updatedAt,
            ':submittedAt': effect.input.next.submittedAt ?? null,
            ':submittedDraftVersion': effect.input.next.submittedDraftVersion ?? null,
            ':expectedVersion': effect.input.expectedVersion,
            ':nextVersion': effect.input.expectedVersion + 1,
          },
        },
      };
    }
    case 'PUT_GAME_METADATA': {
      const key = db.keyBuilders.gameState.gameMetadata(effect.input.gameId);
      return {
        Put: {
          TableName: db.tables.gameStateTableName,
          Item: {
            ...key,
            type: 'GameMetadata',
            gameId: effect.input.gameId,
            name: effect.input.name,
            visibility: effect.input.visibility,
            createdByPlayerId: effect.input.createdByPlayerId,
            gmPlayerId: effect.input.gmPlayerId,
            createdAt: effect.input.createdAt,
            updatedAt: effect.input.updatedAt,
            version: 1,
          },
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      };
    }
    case 'UPDATE_GAME_METADATA_WITH_VERSION': {
      const key = db.keyBuilders.gameState.gameMetadata(effect.input.gameId);
      return {
        Update: {
          TableName: db.tables.gameStateTableName,
          Key: key,
          ConditionExpression: '#version = :expectedVersion',
          UpdateExpression:
            'SET #name = :name, visibility = :visibility, createdByPlayerId = :createdByPlayerId, gmPlayerId = :gmPlayerId, updatedAt = :updatedAt, #version = :nextVersion',
          ExpressionAttributeNames: {
            '#version': 'version',
            '#name': 'name',
          },
          ExpressionAttributeValues: {
            ':name': effect.input.next.name,
            ':visibility': effect.input.next.visibility,
            ':createdByPlayerId': effect.input.next.createdByPlayerId,
            ':gmPlayerId': effect.input.next.gmPlayerId,
            ':updatedAt': effect.input.next.updatedAt,
            ':expectedVersion': effect.input.expectedVersion,
            ':nextVersion': effect.input.expectedVersion + 1,
          },
        },
      };
    }
    case 'PUT_GAME_MEMBER': {
      return {
        Put: {
          TableName: db.tables.gameStateTableName,
          Item: {
            ...db.keyBuilders.gameState.gameMember(effect.input.gameId, effect.input.playerId),
            type: 'GameMember',
            gameId: effect.input.gameId,
            playerId: effect.input.playerId,
            roles: effect.input.roles,
            createdAt: effect.input.createdAt,
            updatedAt: effect.input.updatedAt,
          },
        },
      };
    }
    case 'DELETE_GAME_MEMBER': {
      return {
        Delete: {
          TableName: db.tables.gameStateTableName,
          Key: db.keyBuilders.gameState.gameMember(effect.input.gameId, effect.input.playerId),
        },
      };
    }
    case 'PUT_GAME_INVITE': {
      return {
        Put: {
          TableName: db.tables.gameStateTableName,
          Item: {
            ...db.keyBuilders.gameState.gameInvite(effect.input.gameId, effect.input.inviteId),
            type: 'GameInvite',
            inviteId: effect.input.inviteId,
            gameId: effect.input.gameId,
            invitedPlayerId: effect.input.invitedPlayerId,
            invitedEmailNormalized: effect.input.invitedEmailNormalized,
            invitedByPlayerId: effect.input.invitedByPlayerId,
            status: effect.input.status,
            createdAt: effect.input.createdAt,
            updatedAt: effect.input.updatedAt,
            respondedAt: effect.input.respondedAt,
            version: 1,
          },
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        },
      };
    }
    case 'UPDATE_GAME_INVITE_WITH_VERSION': {
      return {
        Update: {
          TableName: db.tables.gameStateTableName,
          Key: db.keyBuilders.gameState.gameInvite(effect.input.gameId, effect.input.inviteId),
          ConditionExpression: '#version = :expectedVersion',
          UpdateExpression:
            'SET invitedPlayerId = :invitedPlayerId, invitedEmailNormalized = :invitedEmailNormalized, invitedByPlayerId = :invitedByPlayerId, #status = :status, updatedAt = :updatedAt, respondedAt = :respondedAt, #version = :nextVersion',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#version': 'version',
          },
          ExpressionAttributeValues: {
            ':invitedPlayerId': effect.input.next.invitedPlayerId,
            ':invitedEmailNormalized': effect.input.next.invitedEmailNormalized,
            ':invitedByPlayerId': effect.input.next.invitedByPlayerId,
            ':status': effect.input.next.status,
            ':updatedAt': effect.input.next.updatedAt,
            ':respondedAt': effect.input.next.respondedAt,
            ':expectedVersion': effect.input.expectedVersion,
            ':nextVersion': effect.input.expectedVersion + 1,
          },
        },
      };
    }
    case 'DELETE_GM_INBOX_ITEM': {
      return {
        Delete: {
          TableName: db.tables.gameStateTableName,
          Key: db.keyBuilders.gameState.gmInboxItem(effect.input.gameId, effect.input.createdAt, effect.input.promptId),
        },
      };
    }
    case 'DELETE_PLAYER_INBOX_ITEM': {
      return {
        Delete: {
          TableName: db.tables.gameStateTableName,
          Key: db.keyBuilders.gameState.playerInboxItem(effect.input.playerId, effect.input.createdAt, effect.input.promptId),
        },
      };
    }
    default: {
      const neverWrite: never = effect;
      throw new Error(`unsupported write effect ${(neverWrite as { kind: string }).kind}`);
    }
  }
}

function toTransactInboxItem(
  db: DbAccess,
  effect: InboxEffect
): Parameters<DbAccess['transactWrite']>[0][number] {
  switch (effect.kind) {
    case 'GM_INBOX_ITEM': {
      return {
        Put: {
          TableName: db.tables.gameStateTableName,
          Item: {
            ...db.keyBuilders.gameState.gmInboxItem(effect.input.gameId, effect.input.createdAt, effect.input.promptId),
            type: 'GMInboxItem',
            promptId: effect.input.promptId,
            gameId: effect.input.gameId,
            kind: effect.input.kind,
            ref: effect.input.ref,
            ownerPlayerId: effect.input.ownerPlayerId ?? null,
            message: effect.input.message,
            createdAt: effect.input.createdAt,
            submittedAt: effect.input.submittedAt ?? null,
            readAt: effect.input.readAt ?? null,
          },
        },
      };
    }
    case 'PLAYER_INBOX_ITEM': {
      return {
        Put: {
          TableName: db.tables.gameStateTableName,
          Item: {
            ...db.keyBuilders.gameState.playerInboxItem(
              effect.input.playerId,
              effect.input.createdAt,
              effect.input.promptId
            ),
            type: 'PlayerInboxItem',
            promptId: effect.input.promptId,
            gameId: effect.input.gameId,
            kind: effect.input.kind,
            ref: effect.input.ref,
            message: effect.input.message,
            createdAt: effect.input.createdAt,
            readAt: effect.input.readAt,
          },
        },
      };
    }
    default: {
      const neverInbox: never = effect;
      throw new Error(`unsupported inbox effect ${(neverInbox as { kind: string }).kind}`);
    }
  }
}

function extractCharacterId(envelope: AnyCommandEnvelope): string | null {
  const payload = envelope.payload as { characterId?: unknown };
  return typeof payload.characterId === 'string' ? payload.characterId : null;
}

function extractErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { code?: string }).code === 'string') {
    return (error as { code: string }).code;
  }
  return 'UNEXPECTED_ERROR';
}

function nowIso(): string {
  return new Date().toISOString();
}

function logFlow(enabled: boolean, event: string, data: Record<string, unknown>): void {
  logServiceFlow({
    enabled,
    service: 'dispatcher',
    event,
    data,
  });
}

function summarizeHandlerEffects(effects: HandlerEffects): Record<string, unknown> {
  const writeKinds = effects.writes.map((write) => write.kind);
  const inboxKinds = effects.inbox.map((item) => item.kind);
  const notificationTemplates = effects.notifications.map((item) => item.template);
  const primaryWrite = effects.writes[0];

  return {
    writes: effects.writes.length,
    inbox: effects.inbox.length,
    notifications: effects.notifications.length,
    writeKinds,
    inboxKinds,
    notificationTemplates,
    nextStatus:
      primaryWrite?.kind === 'PUT_CHARACTER_DRAFT'
        ? (primaryWrite.input.status ?? 'DRAFT')
        : primaryWrite?.kind === 'UPDATE_CHARACTER_WITH_VERSION'
          ? primaryWrite.input.next.status
          : null,
  };
}
