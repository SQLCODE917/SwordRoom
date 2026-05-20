import { randomUUID } from 'node:crypto';
import {
  anyCommandEnvelopeSchema,
  getPlayerIdFromCharacterLibraryGameId,
  isPlayerCharacterLibraryGameId,
  type AnyCommandEnvelope,
} from '@starter/shared';
import {
  assertCharacterOwnerOrGameMaster,
  assertGameMasterActor,
  isConditionalCheckFailed,
  logServiceFlow,
  summarizeCommandEnvelope,
  summarizeError,
} from '@starter/services-shared';
import { resolveActorId } from '../../auth.js';
import type { ApiRuntimeService, CommandStatusResponse, PostCommandRequest, PostCommandResponse } from '../../apiTypes.js';
import type { ApiServiceDependencies } from '../../index.js';
import { createApiError, requireActiveGameMetadata, resolveApiAuthEnv, type ReadApisSubset } from '../../serviceSupport.js';

export function createCommandReadApis(deps: ApiServiceDependencies): ReadApisSubset<'getCommandStatus'> {
  return {
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
  };
}

export function createCommandRuntimeService(
  deps: ApiServiceDependencies,
  flowLogEnabled: boolean
): Pick<ApiRuntimeService, 'postCommands'> {
  return {
    async postCommands(request: PostCommandRequest): Promise<PostCommandResponse> {
      const authEnv = resolveApiAuthEnv(deps);
      const actorId = await resolveActorId({
        bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
        authorizationHeader: request.authHeader,
        bypassActorId: request.bypassActorId,
        env: authEnv,
      });
      logServiceFlow({
        enabled: flowLogEnabled,
        service: 'api',
        event: 'API_ACTOR_RESOLVED',
        data: {
          actorId,
          authMode: authEnv.AUTH_MODE ?? null,
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

      await authorizeCommand(deps, envelope, flowLogEnabled);

      let commandStatus: PostCommandResponse['status'] = 'ACCEPTED';
      let shouldEnqueue = true;
      try {
        await deps.db.commandLogRepository.createAccepted({
          commandId: envelope.commandId,
          gameId: envelope.gameId,
          actorId: envelope.actorId,
          type: envelope.type,
          createdAt: new Date().toISOString(),
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
  };
}

async function authorizeCommand(
  deps: ApiServiceDependencies,
  envelope: AnyCommandEnvelope,
  flowLogEnabled: boolean
): Promise<void> {
  if (envelope.type === 'GMReviewCharacter') {
    const gmContext = await assertGameMasterActor(deps.db, {
      gameId: envelope.gameId,
      actorId: envelope.actorId,
    });
    logAuthorizedGameMasterCommand(envelope, gmContext, flowLogEnabled);
    return;
  }

  if (
    envelope.type === 'GMFrameGameplayScene' ||
    envelope.type === 'GMSelectGameplayProcedure' ||
    envelope.type === 'GMResolveGameplayCheck' ||
    envelope.type === 'GMOpenCombatRound' ||
    envelope.type === 'GMResolveCombatTurn' ||
    envelope.type === 'GMCloseCombat' ||
    envelope.type === 'ArchiveGame' ||
    envelope.type === 'SetGameVisibility' ||
    envelope.type === 'InvitePlayerToGameByEmail'
  ) {
    const gmContext = await assertGameMasterActor(deps.db, {
      gameId: envelope.gameId,
      actorId: envelope.actorId,
    });
    logAuthorizedGameMasterCommand(envelope, gmContext, flowLogEnabled);
    return;
  }

  if (envelope.type === 'SaveCharacterDraft') {
    await assertSaveCharacterDraftAuthorized(deps, envelope);
    return;
  }

  if (envelope.type === 'DeleteCharacter') {
    await assertCharacterOwnerOrGameMaster(deps.db, {
      gameId: envelope.gameId,
      characterId: envelope.payload.characterId,
      actorId: envelope.actorId,
    });
    logServiceFlow({
      enabled: flowLogEnabled,
      service: 'api',
      event: 'API_CHARACTER_COMMAND_AUTHORIZED',
      data: summarizeCommandEnvelope(envelope),
    });
    return;
  }

  if (envelope.type === 'SendGameChatMessage') {
    await assertSendGameChatMessageAuthorized(deps, envelope);
    return;
  }

  if (envelope.type === 'SubmitGameplayIntent') {
    await assertSubmitGameplayIntentAuthorized(deps, envelope);
    return;
  }

  if (envelope.type === 'SubmitCombatAction') {
    await assertSubmitCombatActionAuthorized(deps, envelope);
    return;
  }

  if (envelope.type === 'SubmitCharacterForApproval') {
    await assertSubmitCharacterForApprovalAuthorized(deps, envelope);
    return;
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
}

function logAuthorizedGameMasterCommand(
  envelope: AnyCommandEnvelope,
  gmContext: { roles: string[]; gmPlayerId: string | null },
  flowLogEnabled: boolean
) {
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

async function assertSaveCharacterDraftAuthorized(
  deps: ApiServiceDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SaveCharacterDraft' }>
): Promise<void> {
  const existing = await deps.db.characterRepository.getCharacter(envelope.gameId, envelope.payload.characterId);
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

  const game = await requireActiveGameMetadata(deps.db, envelope.gameId);
  if (game.visibility !== 'PUBLIC') {
    throw createApiError(`game "${game.name}" is not public`, 'GAME_NOT_PUBLIC', 403);
  }
}

async function assertSubmitCharacterForApprovalAuthorized(
  deps: ApiServiceDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitCharacterForApproval' }>
): Promise<void> {
  if (isPlayerCharacterLibraryGameId(envelope.gameId)) {
    throw createApiError(
      `player-owned character drafts cannot be submitted for game review: ${envelope.gameId}`,
      'PLAYER_CHARACTER_SUBMIT_NOT_ALLOWED',
      400
    );
  }

  const game = await requireActiveGameMetadata(deps.db, envelope.gameId);
  if (game.visibility !== 'PUBLIC') {
    throw createApiError(`game "${game.name}" is not public`, 'GAME_NOT_PUBLIC', 403);
  }
}

async function assertSendGameChatMessageAuthorized(
  deps: ApiServiceDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SendGameChatMessage' }>
): Promise<void> {
  const membership = await requireMembership(deps, envelope.gameId, envelope.actorId);
  if (envelope.payload.artifact?.kind === 'CHARACTER_DRAFT') {
    await assertCharacterOwnerOrGameMaster(deps.db, {
      gameId: envelope.gameId,
      characterId: envelope.payload.artifact.characterId,
      actorId: envelope.actorId,
    });
  }
  if (envelope.payload.artifact?.kind === 'PARTY_ROLE_CLAIM') {
    await assertCharacterOwnerOrGameMaster(deps.db, {
      gameId: envelope.gameId,
      characterId: envelope.payload.artifact.characterId,
      actorId: envelope.actorId,
    });
  }
  if (envelope.payload.artifact?.kind === 'GAME_PROMPT' && !membership.roles.includes('GM')) {
    throw createApiError(
      `only the game master can post structured game prompts for "${envelope.gameId}"`,
      'GAME_PROMPT_GM_REQUIRED',
      403
    );
  }
}

async function assertSubmitGameplayIntentAuthorized(
  deps: ApiServiceDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitGameplayIntent' }>
): Promise<void> {
  await requireMembership(deps, envelope.gameId, envelope.actorId);
}

async function assertSubmitCombatActionAuthorized(
  deps: ApiServiceDependencies,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitCombatAction' }>
): Promise<void> {
  const membership = await requireMembership(deps, envelope.gameId, envelope.actorId);

  if (membership.roles.includes('GM')) {
    return;
  }

  const ownedCharacter = await deps.db.characterRepository.findOwnedCharacterInGame(envelope.gameId, envelope.actorId);
  if (!ownedCharacter || ownedCharacter.characterId !== envelope.payload.actorCombatantId) {
    throw createApiError(
      `combat action actor "${envelope.payload.actorCombatantId}" is not owned by "${envelope.actorId}"`,
      'COMBAT_ACTION_OWNER_REQUIRED',
      403
    );
  }
}

async function requireMembership(deps: ApiServiceDependencies, gameId: string, actorId: string) {
  await requireActiveGameMetadata(deps.db, gameId);

  const membership = await deps.db.membershipRepository.getMembership(gameId, actorId);
  if (!membership) {
    throw createApiError(
      `game access required for actor "${actorId}" and game "${gameId}"`,
      'GAME_ACCESS_REQUIRED',
      403
    );
  }

  return membership;
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
