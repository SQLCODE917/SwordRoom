import {
  COMMAND_TYPES,
  anyCommandEnvelopeSchema,
  type AnyCommandEnvelope,
  type CommandType,
} from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';
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

  return {
    async dispatch(envelopeInput: unknown): Promise<DispatchResult> {
      const parsed = anyCommandEnvelopeSchema.parse(envelopeInput);
      const existing = await deps.db.commandLogRepository.get(parsed.commandId);

      if (existing?.status === 'PROCESSED') {
        return { commandId: parsed.commandId, outcome: 'NOOP_ALREADY_PROCESSED' };
      }

      try {
        await deps.db.commandLogRepository.markProcessing(parsed.commandId, nowIso());

        const handler = handlerRegistry[parsed.type];
        const effects = await handler(context, parsed as never);

        await applyEffectsTransact(deps.db, parsed, effects, nowIso());

        return { commandId: parsed.commandId, outcome: 'PROCESSED' };
      } catch (error) {
        const errorCode = extractErrorCode(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await deps.db.commandLogRepository.markFailed(parsed.commandId, nowIso(), errorCode, errorMessage);
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
            'SET ownerPlayerId = :ownerPlayerId, #status = :status, draft = :draft, updatedAt = :updatedAt, #version = :nextVersion',
          ExpressionAttributeNames: {
            '#version': 'version',
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':ownerPlayerId': effect.input.next.ownerPlayerId,
            ':status': effect.input.next.status,
            ':draft': effect.input.next.draft,
            ':updatedAt': effect.input.next.updatedAt,
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
          Key: db.keyBuilders.gameState.gmInboxItem(
            effect.input.gameId,
            effect.input.submittedAt,
            effect.input.characterId
          ),
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
            ...db.keyBuilders.gameState.gmInboxItem(
              effect.input.gameId,
              effect.input.submittedAt,
              effect.input.characterId
            ),
            type: 'GMInboxItem',
            gameId: effect.input.gameId,
            characterId: effect.input.characterId,
            ownerPlayerId: effect.input.ownerPlayerId,
            status: 'PENDING',
            submittedAt: effect.input.submittedAt,
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
