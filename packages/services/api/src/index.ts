import { randomUUID } from 'node:crypto';
import {
  anyCommandEnvelopeSchema,
  getPlayerIdFromCharacterLibraryGameId,
  isActiveGame,
  isPlayerCharacterLibraryGameId,
  gameplayLoopGraph,
  toPlayerCharacterLibraryGameId,
  type AnyCommandEnvelope,
} from '@starter/shared';
import {
  assertCharacterOwnerOrGameMaster,
  assertGameMasterActor,
  getActorProfileRoles,
  getGameActorContext,
  isConditionalCheckFailed,
  logServiceFlow,
  summarizeCommandEnvelope,
  summarizeError,
  type DbAccess,
} from '@starter/services-shared';
import { resolveActorId, resolveActorIdentity } from './auth.js';
import { listContractRoutes } from './httpRoutes.js';
import type {
  ApiRuntimeService,
  CommandStatusResponse,
  GameChatParticipantResponse,
  PostCommandRequest,
  PostCommandResponse,
  ReadApis,
} from './apiTypes.js';

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

export { listContractRoutes };

export function createApiService(deps: ApiServiceDependencies): ApiRuntimeService {
  const flowLogEnabled = process.env.FLOW_LOG === '1';

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
      }

      if (envelope.type === 'SendGameChatMessage') {
        await assertSendGameChatMessageAuthorized(deps.db, envelope);
      }

      if (envelope.type === 'SubmitGameplayIntent') {
        await assertSubmitGameplayIntentAuthorized(deps.db, envelope);
      }

      if (envelope.type === 'SubmitCombatAction') {
        await assertSubmitCombatActionAuthorized(deps.db, envelope);
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

    readApis: {
      async syncMyProfile(input) {
        const authEnv = resolveApiAuthEnv(deps);
        const identity = await resolveActorIdentity({
          bypassAllowed: deps.jwtBypass ?? process.env.JWT_BYPASS === '1',
          authorizationHeader: input.authHeader,
          bypassActorId: input.bypassActorId,
          env: authEnv,
        });
        const profile = await deps.db.playerRepository.upsertPlayerProfile({
          playerId: identity.actorId,
          displayName: identity.displayName,
          email: identity.email,
          emailNormalized: identity.emailNormalized,
          emailVerified: identity.emailVerified,
          updatedAt: new Date().toISOString(),
        });
        const response = await withEffectiveProfileRoles(deps.db, profile);
        logServiceFlow({
          enabled: flowLogEnabled,
          service: 'api',
          event: 'API_PROFILE_SYNCED',
          data: {
            actorId: identity.actorId,
            authMode: identity.authMode,
            roles: response.roles,
            emailNormalized: identity.emailNormalized,
          },
        });
        return response;
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
        const game = await deps.db.gameRepository.getGameMetadata(gameId);
        return game && isActiveGame(game) ? game : null;
      },

      async getCharacter(gameId: string, characterId: string) {
        if (!isPlayerCharacterLibraryGameId(gameId)) {
          const game = await deps.db.gameRepository.getGameMetadata(gameId);
          if (!game || !isActiveGame(game)) {
            return null;
          }
        }
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
        const characters = await deps.db.characterRepository.listCharactersByOwner(playerId);
        const filtered = await Promise.all(
          characters.map(async (character) => {
            if (isPlayerCharacterLibraryGameId(character.gameId)) {
              return character;
            }
            const game = await deps.db.gameRepository.getGameMetadata(character.gameId);
            return game && isActiveGame(game) ? character : null;
          })
        );
        return filtered.filter((character): character is NonNullable<(typeof filtered)[number]> => character !== null);
      },

      async getMyInbox(playerId: string) {
        return deps.db.inboxRepository.queryPlayerInbox(playerId);
      },

      async getMyProfile(playerId: string) {
        const profile = await deps.db.playerRepository.getPlayerProfile(playerId);
        return profile ? withEffectiveProfileRoles(deps.db, profile) : null;
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
        const users = await deps.db.playerRepository.listUsers();
        return Promise.all(users.map((user) => withEffectiveProfileRoles(deps.db, user)));
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

      async getGameChat(gameId: string) {
        const [game, memberships, messages] = await Promise.all([
          deps.db.gameRepository.getGameMetadata(gameId),
          deps.db.membershipRepository.listMembershipsForGame(gameId),
          deps.db.chatRepository.queryMessages(gameId),
        ]);
        assertActiveGame(gameId, game);

        const participantRecords = await Promise.all(
          memberships.map(async (membership) => {
            const [profile, character] = await Promise.all([
              deps.db.playerRepository.getPlayerProfile(membership.playerId),
              deps.db.characterRepository.findOwnedCharacterInGame(gameId, membership.playerId),
            ]);
            const role: GameChatParticipantResponse['role'] = membership.roles.includes('GM') ? 'GM' : 'PLAYER';
            const baseName = character
              ? readCharacterIdentityName(character)
              : (profile?.displayName?.trim() || membership.playerId);
            return {
              playerId: membership.playerId,
              displayName: formatChatDisplayName(baseName, role),
              sortName: baseName.toLocaleLowerCase(),
              role,
              characterId: character?.characterId ?? null,
            };
          })
        );

        const participants = participantRecords
          .sort((left, right) => {
            if (left.role !== right.role) {
              return left.role === 'GM' ? -1 : 1;
            }
            return left.sortName.localeCompare(right.sortName);
          })
          .map(({ sortName: _sortName, ...participant }) => participant);

        return {
          gameId: game.gameId,
          gameName: game.name,
          participants,
          messages: messages.map((message) => ({
            messageId: message.messageId,
            senderPlayerId: message.senderPlayerId,
            senderDisplayName: formatChatDisplayName(message.senderNameSnapshot, message.senderRole),
            senderRole: message.senderRole,
            senderCharacterId: message.senderCharacterId,
            body: message.body,
            createdAt: message.createdAt,
          })),
        };
      },

      async getPlayerGameplayView(gameId: string) {
        return buildGameplayView(deps.db, gameId, 'PLAYER');
      },

      async getGmGameplayView(gameId: string) {
        return buildGameplayView(deps.db, gameId, 'GM');
      },
    },
  };
}

async function withEffectiveProfileRoles(
  db: DbAccess,
  profile: Awaited<ReturnType<DbAccess['playerRepository']['getPlayerProfile']>> extends infer T ? Exclude<T, null> : never
) {
  return {
    ...profile,
    roles: await getActorProfileRoles(db, profile.playerId),
  };
}

function resolveApiAuthEnv(deps: ApiServiceDependencies): Record<string, string | undefined> {
  if (!deps.jwtBypass) {
    return process.env;
  }

  return {
    ...process.env,
    AUTH_MODE: process.env.AUTH_MODE ?? 'dev',
    ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH ?? '1',
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

  const game = await requireActiveGameMetadata(db, envelope.gameId);
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

  const game = await requireActiveGameMetadata(db, envelope.gameId);
  if (game.visibility !== 'PUBLIC') {
    throw createApiError(`game "${game.name}" is not public`, 'GAME_NOT_PUBLIC', 403);
  }
}

async function assertSendGameChatMessageAuthorized(
  db: DbAccess,
  envelope: Extract<AnyCommandEnvelope, { type: 'SendGameChatMessage' }>
): Promise<void> {
  await requireActiveGameMetadata(db, envelope.gameId);

  const membership = await db.membershipRepository.getMembership(envelope.gameId, envelope.actorId);
  if (!membership) {
    throw createApiError(
      `game access required for actor "${envelope.actorId}" and game "${envelope.gameId}"`,
      'GAME_ACCESS_REQUIRED',
      403
    );
  }
}

async function assertSubmitGameplayIntentAuthorized(
  db: DbAccess,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitGameplayIntent' }>
): Promise<void> {
  await requireActiveGameMetadata(db, envelope.gameId);

  const membership = await db.membershipRepository.getMembership(envelope.gameId, envelope.actorId);
  if (!membership) {
    throw createApiError(
      `game access required for actor "${envelope.actorId}" and game "${envelope.gameId}"`,
      'GAME_ACCESS_REQUIRED',
      403
    );
  }
}

async function assertSubmitCombatActionAuthorized(
  db: DbAccess,
  envelope: Extract<AnyCommandEnvelope, { type: 'SubmitCombatAction' }>
): Promise<void> {
  await requireActiveGameMetadata(db, envelope.gameId);

  const membership = await db.membershipRepository.getMembership(envelope.gameId, envelope.actorId);
  if (!membership) {
    throw createApiError(
      `game access required for actor "${envelope.actorId}" and game "${envelope.gameId}"`,
      'GAME_ACCESS_REQUIRED',
      403
    );
  }

  if (membership.roles.includes('GM')) {
    return;
  }

  const ownedCharacter = await db.characterRepository.findOwnedCharacterInGame(envelope.gameId, envelope.actorId);
  if (!ownedCharacter || ownedCharacter.characterId !== envelope.payload.actorCombatantId) {
    throw createApiError(
      `combat action actor "${envelope.payload.actorCombatantId}" is not owned by "${envelope.actorId}"`,
      'COMBAT_ACTION_OWNER_REQUIRED',
      403
    );
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

async function requireActiveGameMetadata(db: DbAccess, gameId: string) {
  const game = await db.gameRepository.getGameMetadata(gameId);
  assertActiveGame(gameId, game);
  return game;
}

function assertActiveGame(
  gameId: string,
  game: Awaited<ReturnType<DbAccess['gameRepository']['getGameMetadata']>>
): asserts game is NonNullable<Awaited<ReturnType<DbAccess['gameRepository']['getGameMetadata']>>> {
  if (!game) {
    throw createApiError(`game not found: ${gameId}`, 'GAME_NOT_FOUND', 404);
  }
  if (!isActiveGame(game)) {
    throw createApiError(`game archived: ${gameId}`, 'GAME_ARCHIVED', 404);
  }
}

function readCharacterIdentityName(character: { draft: { identity: { name: string } }; characterId: string }): string {
  const name = character.draft.identity.name.trim();
  return name || character.characterId;
}

function formatChatDisplayName(name: string, role: 'PLAYER' | 'GM'): string {
  return role === 'GM' ? `@${name}` : name;
}

async function buildGameplayView(
  db: DbAccess,
  gameId: string,
  view: 'PLAYER' | 'GM'
) {
  const [game, session, memberships, publicEvents, gmOnlyEvents] = await Promise.all([
    db.gameRepository.getGameMetadata(gameId),
    db.gameplayRepository.getSession(gameId),
    db.membershipRepository.listMembershipsForGame(gameId),
    db.gameplayRepository.queryEvents(gameId, 'PUBLIC'),
    view === 'GM' ? db.gameplayRepository.queryEvents(gameId, 'GM_ONLY') : Promise.resolve([]),
  ]);
  assertActiveGame(gameId, game);

  if (!session) {
    return null;
  }

  const participants = await Promise.all(
    memberships.map(async (membership) => {
      const [profile, character] = await Promise.all([
        db.playerRepository.getPlayerProfile(membership.playerId),
        db.characterRepository.findOwnedCharacterInGame(gameId, membership.playerId),
      ]);
      return {
        playerId: membership.playerId,
        displayName: character?.draft.identity.name.trim() || profile?.displayName?.trim() || membership.playerId,
        role: membership.roles.includes('GM') ? 'GM' : 'PLAYER',
        characterId: character?.characterId ?? null,
      } as const;
    })
  );

  const sortedParticipants = participants.sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === 'GM' ? -1 : 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });

  return {
    gameId: game.gameId,
    gameName: game.name,
    view,
    graph: gameplayLoopGraph,
    participants: sortedParticipants,
    session: session.state,
    publicEvents: publicEvents.map(toGameplayEventRecord),
    ...(view === 'GM' ? { gmOnlyEvents: gmOnlyEvents.map(toGameplayEventRecord) } : {}),
  };
}

function toGameplayEventRecord(event: Awaited<ReturnType<DbAccess['gameplayRepository']['queryEvents']>>[number]) {
  return {
    eventId: event.eventId,
    gameId: event.gameId,
    audience: event.audience,
    eventKind: event.eventKind,
    nodeId: event.nodeId,
    actorId: event.actorId,
    title: event.title,
    body: event.body,
    detail: event.detail,
    createdAt: event.createdAt,
  };
}
