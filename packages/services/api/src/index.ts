import { randomUUID } from 'node:crypto';
import {
  anyCommandEnvelopeSchema,
  getPlayerIdFromCharacterLibraryGameId,
  isPlayerCharacterLibraryGameId,
  toPlayerCharacterLibraryGameId,
  type AnyCommandEnvelope,
} from '@starter/shared';
import {
  assertActorHasRole,
  assertCharacterOwnerOrGameMaster,
  assertGameMasterActor,
  getGameActorContext,
  isConditionalCheckFailed,
  logServiceFlow,
  summarizeCommandEnvelope,
  summarizeError,
  type DbAccess,
} from '@starter/services-shared';
import { resolveActorId, resolveActorIdentity } from './auth.js';
import type {
  ApiRoute,
  CommandStatusResponse,
  PostCommandRequest,
  PostCommandResponse,
  ReadApis,
} from './apiTypes.js';

export const contractRoutes: ApiRoute[] = [
  { method: 'POST', path: '/commands', auth: 'required' },
  { method: 'POST', path: '/me/profile/sync', auth: 'required' },
  { method: 'GET', path: '/commands/{commandId}', auth: 'required' },
  { method: 'GET', path: '/me', auth: 'required' },
  { method: 'GET', path: '/me/characters', auth: 'required' },
  { method: 'GET', path: '/me/games', auth: 'required' },
  { method: 'GET', path: '/games/{gameId}', auth: 'required' },
  { method: 'GET', path: '/games/{gameId}/me', auth: 'required' },
  { method: 'GET', path: '/me/inbox', auth: 'required' },
  { method: 'GET', path: '/games/public', auth: 'required' },
  { method: 'GET', path: '/games/{gameId}/characters/{characterId}', auth: 'required' },
  { method: 'GET', path: '/players/{playerId}/characters/{characterId}', auth: 'required' },
  { method: 'GET', path: '/gm/games', auth: 'required' },
  { method: 'GET', path: '/gm/{gameId}/inbox', auth: 'gm_required' },
  { method: 'GET', path: '/admin/users', auth: 'admin_required' },
  { method: 'GET', path: '/admin/games', auth: 'admin_required' },
];

export interface ApiServiceDependencies {
  db: DbAccess;
  uploads: {
    headObject(key: string): Promise<boolean>;
    createSignedDownloadUrl(input: { key: string; expiresInSeconds: number }): Promise<string>;
  };
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
  const flowLogEnabled = process.env.FLOW_LOG === '1';

  return {
    async postCommands(request: PostCommandRequest): Promise<PostCommandResponse> {
      const actorId = await resolveActorId({
        bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
        authorizationHeader: request.authHeader,
        bypassActorId: request.bypassActorId,
      });
      logServiceFlow({
        enabled: flowLogEnabled,
        service: 'api',
        event: 'API_ACTOR_RESOLVED',
        data: {
          actorId,
          authMode: process.env.AUTH_MODE ?? (deps.jwtBypass ? 'dev' : 'oidc'),
          bypassActorIdProvided: typeof request.bypassActorId === 'string' && request.bypassActorId.length > 0,
        },
      });

      const envelopeCandidate = normalizeEnvelopeCandidate(request.envelope, actorId);

      const envelope = anyCommandEnvelopeSchema.parse(envelopeCandidate);
      logServiceFlow({
        enabled: flowLogEnabled,
        service: 'api',
        event: 'API_VALIDATE_ENVELOPE',
        data: summarizeCommandEnvelope(envelope),
      });

      if (envelope.type === 'GMReviewCharacter') {
        const gmContext = await assertGameMasterActor(deps.db, {
          gameId: envelope.gameId,
          actorId: envelope.actorId,
        });
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_GM_AUTHORIZED',
          data: {
            ...summarizeCommandEnvelope(envelope),
            roles: gmContext.roles,
            gmPlayerId: gmContext.gmPlayerId,
          },
        });
      }

      if (envelope.type === 'SetGameVisibility' || envelope.type === 'InvitePlayerToGameByEmail') {
        const gmContext = await assertGameMasterActor(deps.db, {
          gameId: envelope.gameId,
          actorId: envelope.actorId,
        });
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_GM_AUTHORIZED',
          data: {
            ...summarizeCommandEnvelope(envelope),
            roles: gmContext.roles,
            gmPlayerId: gmContext.gmPlayerId,
          },
        });
      }

      if (envelope.type === 'SaveCharacterDraft') {
        await assertSaveCharacterDraftAuthorized(deps.db, envelope);
      }

      if (envelope.type === 'SubmitCharacterForApproval') {
        await assertSubmitCharacterForApprovalAuthorized(deps.db, envelope);
      }

      if (envelope.type === 'ConfirmCharacterAppearanceUpload') {
        await assertCharacterOwnerOrGameMaster(deps.db, {
          gameId: envelope.gameId,
          characterId: envelope.payload.characterId,
          actorId: envelope.actorId,
        });
        assertAppearanceObjectKeyMatchesCharacter({
          gameId: envelope.gameId,
          characterId: envelope.payload.characterId,
          s3Key: envelope.payload.s3Key,
        });
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_APPEARANCE_COMMAND_AUTHORIZED',
          data: summarizeCommandEnvelope(envelope),
        });

        const objectExists = await deps.uploads.headObject(envelope.payload.s3Key);
        if (!objectExists) {
          throw createApiError(
            `appearance upload object not found for key "${envelope.payload.s3Key}"`,
            'APPEARANCE_UPLOAD_NOT_FOUND',
            400
          );
        }
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_APPEARANCE_OBJECT_VERIFIED',
          data: summarizeCommandEnvelope(envelope),
        });
      }

      let commandStatus: PostCommandResponse['status'] = 'ACCEPTED';
      let shouldEnqueue = true;
      try {
        await deps.db.commandLogRepository.createAccepted({
          commandId: envelope.commandId,
          gameId: envelope.gameId,
          actorId: envelope.actorId,
          type: envelope.type,
          createdAt: envelope.createdAt,
        });
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_COMMANDLOG_ACCEPTED',
          data: summarizeCommandEnvelope(envelope),
        });
      } catch (error) {
        if (isConditionalCheckFailed(error)) {
          const existing = await deps.db.commandLogRepository.get(envelope.commandId);
          if (!existing) {
            logServiceFlow({
              enabled: flowLogEnabled,
              service: 'api',
              event: 'API_COMMANDLOG_ACCEPT_FAILED',
              data: {
                ...summarizeCommandEnvelope(envelope),
                reason: 'CONDITIONAL_FAILED_WITHOUT_EXISTING_LOG',
                ...summarizeError(error),
              },
            });
            throw error;
          }

          commandStatus = existing.status;
          shouldEnqueue = existing.status === 'ACCEPTED';
          logServiceFlow({
            enabled: flowLogEnabled,
            service: 'api',
            event: 'API_COMMANDLOG_IDEMPOTENT_REPLAY',
            data: {
              ...summarizeCommandEnvelope(envelope),
              existingStatus: existing.status,
              existingType: existing.commandType,
              shouldEnqueue,
            },
          });
        } else {
          logServiceFlow({
            enabled: flowLogEnabled,
            service: 'api',
            event: 'API_COMMANDLOG_ACCEPT_FAILED',
            data: {
              ...summarizeCommandEnvelope(envelope),
              ...summarizeError(error),
            },
          });
          throw error;
        }
      }

      if (shouldEnqueue) {
        try {
          await deps.queue.sendMessage(
            buildFifoMessage({
              queueUrl: deps.queueUrl,
              envelope,
            })
          );
        } catch (error) {
          logServiceFlow({
            enabled: flowLogEnabled,
            service: 'api',
            event: 'API_ENQUEUE_FAILED',
            data: {
              ...summarizeCommandEnvelope(envelope),
              queueUrl: deps.queueUrl,
              ...summarizeError(error),
            },
          });
          throw error;
        }
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_ENQUEUED',
          data: {
            ...summarizeCommandEnvelope(envelope),
            queueUrl: deps.queueUrl,
          },
        });
      } else {
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_ENQUEUE_SKIPPED_REPLAY',
          data: {
            ...summarizeCommandEnvelope(envelope),
            queueUrl: deps.queueUrl,
            status: commandStatus,
          },
        });
      }

      return {
        accepted: true,
        commandId: envelope.commandId,
        status: commandStatus,
      };
    },

    readApis: {
      async syncMyProfile(input) {
        const identity = await resolveActorIdentity({
          bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
          authorizationHeader: input.authHeader,
          bypassActorId: input.bypassActorId,
        });
        const profile = await deps.db.playerRepository.upsertPlayerProfile({
          playerId: identity.actorId,
          displayName: identity.displayName,
          email: identity.email,
          emailNormalized: identity.emailNormalized,
          emailVerified: identity.emailVerified,
          roles: identity.roles,
          updatedAt: new Date().toISOString(),
        });
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_PROFILE_SYNCED',
          data: {
            actorId: identity.actorId,
            authMode: identity.authMode,
            roles: identity.roles,
            emailNormalized: identity.emailNormalized,
          },
        });
        return profile;
      },

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

      async getGame(gameId: string) {
        return deps.db.gameRepository.getGameMetadata(gameId);
      },

      async getCharacter(gameId: string, characterId: string) {
        const character = await deps.db.characterRepository.getCharacter(gameId, characterId);
        if (!character) {
          return null;
        }

        const imageKey = character.draft.appearance?.imageKey ?? null;
        if (!imageKey) {
          return character;
        }

        return {
          ...character,
          draft: {
            ...character.draft,
            appearance: {
              imageKey,
              imageUrl: await deps.uploads.createSignedDownloadUrl({
                key: imageKey,
                expiresInSeconds: 900,
              }),
              updatedAt: character.draft.appearance?.updatedAt ?? null,
            },
          },
        };
      },

      async getOwnedCharacter(playerId: string, characterId: string) {
        const namespaceGameId = toPlayerCharacterLibraryGameId(playerId);
        const character = await deps.db.characterRepository.getCharacter(namespaceGameId, characterId);
        if (!character) {
          return null;
        }

        const imageKey = character.draft.appearance?.imageKey ?? null;
        if (!imageKey) {
          return character;
        }

        return {
          ...character,
          draft: {
            ...character.draft,
            appearance: {
              imageKey,
              imageUrl: await deps.uploads.createSignedDownloadUrl({
                key: imageKey,
                expiresInSeconds: 900,
              }),
              updatedAt: character.draft.appearance?.updatedAt ?? null,
            },
          },
        };
      },

      async listCharactersByOwner(playerId: string) {
        return deps.db.characterRepository.listCharactersByOwner(playerId);
      },

      async getMyInbox(playerId: string) {
        return deps.db.inboxRepository.queryPlayerInbox(playerId);
      },

      async getMyProfile(playerId: string) {
        return deps.db.playerRepository.getPlayerProfile(playerId);
      },

      async listPublicGames() {
        return deps.db.gameRepository.listPublicGames();
      },

      async listAllGames() {
        return deps.db.gameRepository.listAllGames();
      },

      async listGamesForPlayer(playerId: string) {
        return deps.db.gameRepository.listGamesForPlayer(playerId);
      },

      async listGamesForGm(playerId: string) {
        return deps.db.gameRepository.listGamesForGm(playerId);
      },

      async listUsers() {
        return deps.db.playerRepository.listUsers();
      },

      async getGameActorContext(gameId: string, actorId: string) {
        const context = await getGameActorContext(deps.db, { gameId, actorId });
        return {
          actorId: context.actorId,
          displayName: context.displayName,
          roles: context.roles,
          gmPlayerId: context.gmPlayerId,
          isGameMaster: context.isGameMaster,
        };
      },

      async getGmInbox(gameId: string) {
        return deps.db.inboxRepository.queryGmInbox(gameId);
      },
    },
  };
}

async function assertSaveCharacterDraftAuthorized(
  db: DbAccess,
  envelope: Extract<AnyCommandEnvelope, { type: 'SaveCharacterDraft' }>
): Promise<void> {
  const existing = await db.characterRepository.getCharacter(envelope.gameId, envelope.payload.characterId);
  if (isPlayerCharacterLibraryGameId(envelope.gameId)) {
    const playerId = getPlayerIdFromCharacterLibraryGameId(envelope.gameId);
    if (!playerId || playerId !== envelope.actorId) {
      throw createApiError(
        `player character library "${envelope.gameId}" is not owned by actor "${envelope.actorId}"`,
        'PLAYER_CHARACTER_OWNER_REQUIRED',
        403
      );
    }
    return;
  }

  if (existing) {
    return;
  }

  const game = await db.gameRepository.getGameMetadata(envelope.gameId);
  if (!game) {
    throw createApiError(`game not found: ${envelope.gameId}`, 'GAME_NOT_FOUND', 404);
  }
  if (game.visibility !== 'PUBLIC') {
    throw createApiError(`game "${game.name}" is not public`, 'GAME_NOT_PUBLIC', 403);
  }
}

async function assertSubmitCharacterForApprovalAuthorized(
  db: DbAccess,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitCharacterForApproval' }>
): Promise<void> {
  if (isPlayerCharacterLibraryGameId(envelope.gameId)) {
    throw createApiError(
      `player-owned character drafts cannot be submitted for game review: ${envelope.gameId}`,
      'PLAYER_CHARACTER_SUBMIT_NOT_ALLOWED',
      400
    );
  }

  const game = await db.gameRepository.getGameMetadata(envelope.gameId);
  if (!game) {
    throw createApiError(`game not found: ${envelope.gameId}`, 'GAME_NOT_FOUND', 404);
  }
  if (game.visibility !== 'PUBLIC') {
    throw createApiError(`game "${game.name}" is not public`, 'GAME_NOT_PUBLIC', 403);
  }
}

function normalizeEnvelopeCandidate(
  envelope: PostCommandRequest['envelope'],
  actorId: string
): Omit<AnyCommandEnvelope, 'actorId'> & { actorId: string } {
  const candidate = {
    ...envelope,
    actorId,
  } as Omit<AnyCommandEnvelope, 'actorId'> & { actorId: string };

  if (candidate.type === 'CreateGame') {
    return {
      ...candidate,
      gameId: randomUUID(),
    };
  }

  return candidate;
}

function buildFifoMessage(input: { queueUrl: string; envelope: AnyCommandEnvelope }) {
  return {
    queueUrl: input.queueUrl,
    messageBody: JSON.stringify(input.envelope),
    messageGroupId: input.envelope.gameId,
    messageDeduplicationId: input.envelope.commandId,
  };
}

function assertAppearanceObjectKeyMatchesCharacter(input: {
  gameId: string;
  characterId: string;
  s3Key: string;
}): void {
  const expectedPrefix = `games/${input.gameId}/characters/${input.characterId}/appearance/`;
  if (!input.s3Key.startsWith(expectedPrefix)) {
    throw createApiError(
      `appearance upload key must start with "${expectedPrefix}"`,
      'APPEARANCE_UPLOAD_KEY_MISMATCH',
      400
    );
  }
}

function createApiError(message: string, code: string, statusCode: number): Error & { code: string; statusCode: number } {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.code = code;
  error.statusCode = statusCode;
  return error;
}
