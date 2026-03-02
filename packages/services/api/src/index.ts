import { anyCommandEnvelopeSchema, type AnyCommandEnvelope } from '@starter/shared';
import type { DbAccess } from '@starter/services-shared';
import { resolveActorId } from './auth.js';
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
      const actorId = await resolveActorId({
        bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
        authorizationHeader: request.authHeader,
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
