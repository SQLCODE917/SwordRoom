import { anyCommandEnvelopeSchema, type AnyCommandEnvelope } from '@starter/shared';
import { Buffer } from 'node:buffer';
import type { DbAccess } from '@starter/services-shared';
import type {
  ApiRoute,
  CommandStatusResponse,
  PostCommandRequest,
  PostCommandResponse,
  ReadApis,
} from './apiTypes.js';

export const contractRoutes: ApiRoute[] = [
  { method: 'POST', path: '/commands', auth: 'required' },
  { method: 'GET', path: '/commands/{commandId}', auth: 'required' },
  { method: 'GET', path: '/me/inbox', auth: 'required' },
  { method: 'GET', path: '/games/{gameId}/characters/{characterId}', auth: 'required' },
  { method: 'GET', path: '/gm/{gameId}/inbox', auth: 'gm_required' },
];

export interface ApiServiceDependencies {
  db: DbAccess;
  queue: {
    sendMessage(input: {
      queueUrl: string;
      messageBody: string;
      messageGroupId: string;
      messageDeduplicationId: string;
    }): Promise<void>;
  };
  queueUrl: string;
  jwtBypass?: boolean;
}

export function listContractRoutes(): ApiRoute[] {
  return [...contractRoutes];
}

export function createApiService(deps: ApiServiceDependencies): {
  postCommands(request: PostCommandRequest): Promise<PostCommandResponse>;
  readApis: ReadApis;
} {
  return {
    async postCommands(request: PostCommandRequest): Promise<PostCommandResponse> {
      const actorId = resolveActorId({
        bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
        authHeader: request.authHeader,
        bypassActorId: request.bypassActorId,
      });

      const envelopeCandidate = {
        ...request.envelope,
        actorId,
      };

      const envelope = anyCommandEnvelopeSchema.parse(envelopeCandidate);

      await deps.db.commandLogRepository.createAccepted({
        commandId: envelope.commandId,
        gameId: envelope.gameId,
        actorId: envelope.actorId,
        type: envelope.type,
        createdAt: envelope.createdAt,
      });

      await deps.queue.sendMessage(
        buildFifoMessage({
          queueUrl: deps.queueUrl,
          envelope,
        })
      );

      return {
        accepted: true,
        commandId: envelope.commandId,
        status: 'ACCEPTED',
      };
    },

    readApis: {
      async getCommandStatus(commandId: string): Promise<CommandStatusResponse | null> {
        const entry = await deps.db.commandLogRepository.get(commandId);
        if (!entry) {
          return null;
        }

        return {
          commandId: entry.commandId,
          status: entry.status,
          errorCode: entry.errorCode,
          errorMessage: entry.errorMessage,
        };
      },

      async getCharacter(gameId: string, characterId: string) {
        return deps.db.characterRepository.getCharacter(gameId, characterId);
      },

      async getMyInbox(playerId: string) {
        return deps.db.inboxRepository.queryPlayerInbox(playerId);
      },

      async getGmInbox(gameId: string) {
        return deps.db.inboxRepository.queryGmInbox(gameId);
      },
    },
  };
}

function buildFifoMessage(input: { queueUrl: string; envelope: AnyCommandEnvelope }) {
  return {
    queueUrl: input.queueUrl,
    messageBody: JSON.stringify(input.envelope),
    messageGroupId: input.envelope.gameId,
    messageDeduplicationId: input.envelope.commandId,
  };
}

function resolveActorId(input: {
  bypassAllowed: boolean;
  authHeader?: string;
  bypassActorId?: string;
}): string {
  if (input.bypassAllowed) {
    if (!input.bypassActorId) {
      throw new Error('JWT bypass enabled but bypassActorId not provided');
    }
    return input.bypassActorId;
  }

  if (!input.authHeader) {
    throw new Error('missing Authorization header');
  }

  const token = input.authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('invalid JWT format');
  }

  const payloadJson = Buffer.from(parts[1]!, 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson) as { sub?: string };
  if (!payload.sub) {
    throw new Error('JWT payload missing sub');
  }

  return payload.sub;
}
