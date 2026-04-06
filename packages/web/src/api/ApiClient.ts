import type { AuthProvider } from '../auth/AuthProvider';
import type {
  GameplayCombatActionType,
  GameplayEventRecord,
  GameplayGraphEdge,
  GameplayGraphNode,
  GameplayMovementMode,
  GameplayProcedure,
  GameplayViewResponse,
} from '@starter/shared';
import { logWebFlow, summarizeCommandEnvelope, summarizeError } from '../logging/flowLog';

export type CommandType =
  | 'CreateGame'
  | 'ArchiveGame'
  | 'SetGameVisibility'
  | 'InvitePlayerToGameByEmail'
  | 'AcceptGameInvite'
  | 'RejectGameInvite'
  | 'SaveCharacterDraft'
  | 'CreateCharacterDraft'
  | 'SetCharacterSubAbilities'
  | 'ApplyStartingPackage'
  | 'SpendStartingExp'
  | 'PurchaseStarterEquipment'
  | 'ConfirmCharacterAppearanceUpload'
  | 'DeleteCharacter'
  | 'SendGameChatMessage'
  | 'SubmitCharacterForApproval'
  | 'GMReviewCharacter'
  | 'GMFrameGameplayScene'
  | 'SubmitGameplayIntent'
  | 'GMSelectGameplayProcedure'
  | 'GMResolveGameplayCheck'
  | 'GMOpenCombatRound'
  | 'SubmitCombatAction'
  | 'GMResolveCombatTurn'
  | 'GMCloseCombat';

interface CommandPayloadByType {
  CreateGame: {
    name: string;
  };
  ArchiveGame: {
    gameId: string;
    expectedVersion: number;
  };
  SetGameVisibility: {
    gameId: string;
    expectedVersion: number;
    visibility: 'PUBLIC' | 'PRIVATE';
  };
  InvitePlayerToGameByEmail: {
    gameId: string;
    email: string;
  };
  AcceptGameInvite: {
    gameId: string;
    inviteId: string;
  };
  RejectGameInvite: {
    gameId: string;
    inviteId: string;
  };
  SaveCharacterDraft: {
    characterId: string;
    expectedVersion?: number | null;
    race: string;
    raisedBy?: string | null;
    subAbility: { A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number };
    backgroundRoll2dTotal?: number;
    startingMoneyRoll2dTotal?: number;
    craftsmanSkill?: string;
    merchantScholarChoice?: 'MERCHANT' | 'SAGE';
    generalSkillName?: string;
    identity: {
      name: string;
      age?: number | null;
      gender?: string | null;
    };
    purchases: Array<{ skill: string; targetLevel: number }>;
    cart: Record<string, unknown>;
    noteToGm?: string;
  };
  CreateCharacterDraft: { characterId: string; race: string; raisedBy?: string | null };
  SetCharacterSubAbilities: {
    characterId: string;
    subAbility: { A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number };
  };
  ApplyStartingPackage: {
    characterId: string;
    backgroundRoll2d?: number;
    backgroundRoll2dTotal?: number;
    startingMoneyRoll2dTotal?: number;
    useOrdinaryCitizenShortcut?: boolean;
  };
  SpendStartingExp: {
    characterId: string;
    purchases: Array<{ skill: string; targetLevel: number }>;
  };
  PurchaseStarterEquipment: { characterId: string; cart: Record<string, unknown> };
  ConfirmCharacterAppearanceUpload: { characterId: string; s3Key: string };
  DeleteCharacter: { characterId: string };
  SendGameChatMessage: { body: string };
  SubmitCharacterForApproval: {
    characterId: string;
    expectedVersion: number;
  };
  GMReviewCharacter: { characterId: string; decision: 'APPROVE' | 'REJECT'; gmNote?: string };
  GMFrameGameplayScene: { seedId: 'rpg_sample_tavern' };
  SubmitGameplayIntent: { body: string; characterId?: string | null };
  GMSelectGameplayProcedure: {
    procedure: GameplayProcedure;
    actionLabel: string;
    baselineScore: number;
    modifiers: number;
    targetScore?: number | null;
    difficulty?: number | null;
    publicPrompt: string;
    gmPrompt?: string;
  };
  GMResolveGameplayCheck: {
    procedure: 'NO_ROLL' | 'STANDARD_CHECK' | 'DIFFICULTY_CHECK';
    actionLabel: string;
    baselineScore: number;
    modifiers: number;
    targetScore?: number | null;
    difficulty?: number | null;
    playerRollTotal?: number | null;
    gmRollTotal?: number | null;
    publicNarration: string;
    gmNarration?: string;
  };
  GMOpenCombatRound: {
    summary: string;
  };
  SubmitCombatAction: {
    roundNumber: number;
    actorCombatantId: string;
    targetCombatantId?: string | null;
    actionType: GameplayCombatActionType;
    movementMode: GameplayMovementMode;
    delayToOrderZero?: boolean;
    summary: string;
  };
  GMResolveCombatTurn: {
    roundNumber: number;
    actionId: string;
    actorCombatantId: string;
    targetCombatantId: string;
    attackContext: 'CHARACTER_TO_MONSTER' | 'MONSTER_TO_CHARACTER' | 'CHARACTER_TO_CHARACTER';
    attackerBase: number;
    attackerRollTotal: number;
    fixedTargetScore?: number | null;
    defenderBase?: number | null;
    defenderRollTotal?: number | null;
    baseDamage: number;
    bonusDamage: number;
    defenseValue: number;
    damageReduction: number;
    narration: string;
  };
  GMCloseCombat: { summary: string };
}

export type CommandEnvelopeInput<T extends CommandType = CommandType> = {
  commandId: string;
  type: T;
  schemaVersion: number;
  createdAt: string;
  payload: CommandPayloadByType[T];
} & (T extends 'CreateGame' ? { gameId?: string } : { gameId: string });

export interface PostCommandResponse {
  accepted: true;
  commandId: string;
  status: BackendCommandStatus;
}

export type BackendCommandStatus = 'ACCEPTED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface CommandStatusResponse {
  commandId: string;
  status: BackendCommandStatus;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PlayerInboxItem {
  kind: string;
  [key: string]: unknown;
}

export interface GMInboxItem {
  promptId: string;
  gameId: string;
  kind: string;
  ref?: Record<string, unknown>;
  ownerPlayerId?: string | null;
  message?: string;
  createdAt?: string;
  submittedAt?: string | null;
  [key: string]: unknown;
}

export interface CharacterItem {
  gameId: string;
  characterId: string;
  status: string;
  [key: string]: unknown;
}

export interface GameItem {
  gameId: string;
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  lifecycleStatus?: 'ACTIVE' | 'ARCHIVED';
  archivedAt?: string | null;
  archivedByPlayerId?: string | null;
  gmPlayerId: string;
  version: number;
  [key: string]: unknown;
}

export interface PlayerProfile {
  playerId: string;
  displayName?: string | null;
  email?: string | null;
  emailNormalized?: string | null;
  emailVerified?: boolean;
  roles?: string[];
  [key: string]: unknown;
}

export interface GameActorContextResponse {
  actorId: string;
  displayName: string | null;
  roles: string[];
  gmPlayerId: string | null;
  isGameMaster: boolean;
}

export interface GameChatParticipant {
  playerId: string;
  displayName: string;
  role: 'PLAYER' | 'GM';
  characterId: string | null;
}

export interface GameChatMessage {
  messageId: string;
  senderPlayerId: string;
  senderDisplayName: string;
  senderRole: 'PLAYER' | 'GM';
  senderCharacterId: string | null;
  body: string;
  createdAt: string;
}

export interface GameChatResponse {
  gameId: string;
  gameName: string;
  participants: GameChatParticipant[];
  messages: GameChatMessage[];
}

export type GameplayGraphNodeView = GameplayGraphNode;
export type GameplayGraphEdgeView = GameplayGraphEdge;
export type GameplayEventView = GameplayEventRecord;
export type GameplayView = GameplayViewResponse;

export interface AppearanceUploadUrlRequest {
  contentType: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface AppearanceUploadUrlResponse {
  uploadId: string;
  s3Key: string;
  putUrl: string;
  getUrl: string;
  expiresInSeconds: number;
}

export interface ApiClient {
  postCommand<T extends CommandType>(input: { envelope: CommandEnvelopeInput<T> }): Promise<PostCommandResponse>;
  syncMyProfile(): Promise<PlayerProfile>;
  getCommandStatus(commandId: string): Promise<CommandStatusResponse | null>;
  getMyProfile(): Promise<PlayerProfile>;
  getGame(gameId: string): Promise<GameItem | null>;
  getMyCharacters(): Promise<CharacterItem[]>;
  getMyGames(): Promise<GameItem[]>;
  getPublicGames(): Promise<GameItem[]>;
  getGmGames(): Promise<GameItem[]>;
  getAdminUsers(): Promise<PlayerProfile[]>;
  getAdminGames(): Promise<GameItem[]>;
  getMyInbox(): Promise<PlayerInboxItem[]>;
  getGameActorContext(gameId: string): Promise<GameActorContextResponse>;
  getGmInbox(gameId: string): Promise<GMInboxItem[]>;
  getGameChat(gameId: string): Promise<GameChatResponse>;
  getPlayerGameplayView(gameId: string): Promise<GameplayView | null>;
  getGmGameplayView(gameId: string): Promise<GameplayView | null>;
  getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
  getOwnedCharacter(playerId: string, characterId: string): Promise<CharacterItem | null>;
  requestAppearanceUploadUrl(
    gameId: string,
    characterId: string,
    input: AppearanceUploadUrlRequest
  ): Promise<AppearanceUploadUrlResponse>;
}

interface ApiClientOptions {
  baseUrl?: string;
  auth: AuthProvider;
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE ?? '/api';
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? getApiBaseUrl());
  const auth = options.auth;

  return {
    async postCommand<T extends CommandType>(input: { envelope: CommandEnvelopeInput<T> }): Promise<PostCommandResponse> {
      const headers = await auth.withAuthHeaders({ 'content-type': 'application/json' });
      const body = auth.withActor({
        envelope: input.envelope,
      });
      logWebFlow('WEB_API_POST_COMMAND_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        ...summarizeCommandEnvelope(input.envelope),
      });
      const response = await requestJson<PostCommandResponse>(`${baseUrl}/commands`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      logWebFlow('WEB_API_POST_COMMAND_ACCEPTED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        ...summarizeCommandEnvelope(input.envelope),
        status: response.status,
      });
      return response;
    },

    async syncMyProfile(): Promise<PlayerProfile> {
      logWebFlow('WEB_API_POST_PROFILE_SYNC_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<PlayerProfile>(`${baseUrl}/me/profile/sync`, {
        method: 'POST',
        headers: await auth.withAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(auth.withActor({})),
      });
      logWebFlow('WEB_API_POST_PROFILE_SYNC_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        syncedPlayerId: response.playerId,
        roles: response.roles ?? [],
      });
      return response;
    },

    async getCommandStatus(commandId: string): Promise<CommandStatusResponse | null> {
      logWebFlow('WEB_API_GET_COMMAND_STATUS_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        commandId,
      });
      const response = await requestJsonOrNull<CommandStatusResponse>(`${baseUrl}/commands/${encodeURIComponent(commandId)}`, auth);
      logWebFlow(response ? 'WEB_API_GET_COMMAND_STATUS_HIT' : 'WEB_API_GET_COMMAND_STATUS_MISS', {
        actorId: auth.actorId,
        authMode: auth.mode,
        commandId,
        status: response?.status ?? null,
        errorCode: response?.errorCode ?? null,
      });
      return response;
    },

    async getMyProfile(): Promise<PlayerProfile> {
      logWebFlow('WEB_API_GET_ME_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<PlayerProfile>(`${baseUrl}/me`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_ME_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        profilePlayerId: response.playerId,
        roles: response.roles ?? [],
      });
      return response;
    },

    async getGame(gameId: string): Promise<GameItem | null> {
      logWebFlow('WEB_API_GET_GAME_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
      });
      const response = await requestJsonOrNull<GameItem>(`${baseUrl}/games/${encodeURIComponent(gameId)}`, auth);
      logWebFlow(response ? 'WEB_API_GET_GAME_HIT' : 'WEB_API_GET_GAME_MISS', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        visibility: response?.visibility ?? null,
      });
      return response;
    },

    async getMyCharacters(): Promise<CharacterItem[]> {
      logWebFlow('WEB_API_GET_MY_CHARACTERS_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<CharacterItem[]>(`${baseUrl}/me/characters`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_MY_CHARACTERS_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getMyGames(): Promise<GameItem[]> {
      logWebFlow('WEB_API_GET_MY_GAMES_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<GameItem[]>(`${baseUrl}/me/games`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_MY_GAMES_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getPublicGames(): Promise<GameItem[]> {
      logWebFlow('WEB_API_GET_PUBLIC_GAMES_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<GameItem[]>(`${baseUrl}/games/public`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_PUBLIC_GAMES_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getGmGames(): Promise<GameItem[]> {
      logWebFlow('WEB_API_GET_GM_GAMES_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<GameItem[]>(`${baseUrl}/gm/games`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_GM_GAMES_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getAdminUsers(): Promise<PlayerProfile[]> {
      logWebFlow('WEB_API_GET_ADMIN_USERS_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<PlayerProfile[]>(`${baseUrl}/admin/users`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_ADMIN_USERS_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getAdminGames(): Promise<GameItem[]> {
      logWebFlow('WEB_API_GET_ADMIN_GAMES_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<GameItem[]>(`${baseUrl}/admin/games`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_ADMIN_GAMES_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getMyInbox(): Promise<PlayerInboxItem[]> {
      logWebFlow('WEB_API_GET_PLAYER_INBOX_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      const response = await requestJson<PlayerInboxItem[]>(`${baseUrl}/me/inbox`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_PLAYER_INBOX_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        count: response.length,
      });
      return response;
    },

    async getGameActorContext(gameId: string): Promise<GameActorContextResponse> {
      logWebFlow('WEB_API_GET_GAME_ACTOR_CONTEXT_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
      });
      const response = await requestJson<GameActorContextResponse>(
        `${baseUrl}/games/${encodeURIComponent(gameId)}/me`,
        {
          headers: await auth.withAuthHeaders(),
        }
      );
      logWebFlow('WEB_API_GET_GAME_ACTOR_CONTEXT_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        isGameMaster: response.isGameMaster,
        roles: response.roles,
      });
      return response;
    },

    async getGmInbox(gameId: string): Promise<GMInboxItem[]> {
      logWebFlow('WEB_API_GET_GM_INBOX_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
      });
      const response = await requestJson<GMInboxItem[]>(`${baseUrl}/gm/${encodeURIComponent(gameId)}/inbox`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_GM_INBOX_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        count: response.length,
      });
      return response;
    },

    async getGameChat(gameId: string): Promise<GameChatResponse> {
      logWebFlow('WEB_API_GET_GAME_CHAT_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
      });
      const response = await requestJson<GameChatResponse>(`${baseUrl}/games/${encodeURIComponent(gameId)}/chat`, {
        headers: await auth.withAuthHeaders(),
      });
      logWebFlow('WEB_API_GET_GAME_CHAT_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        participantCount: response.participants.length,
        messageCount: response.messages.length,
      });
      return response;
    },

    async getPlayerGameplayView(gameId: string): Promise<GameplayView | null> {
      logWebFlow('WEB_API_GET_GAMEPLAY_VIEW_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        view: 'PLAYER',
      });
      const response = await requestJsonOrNull<GameplayView>(
        `${baseUrl}/games/${encodeURIComponent(gameId)}/play`,
        auth
      );
      logWebFlow(response ? 'WEB_API_GET_GAMEPLAY_VIEW_HIT' : 'WEB_API_GET_GAMEPLAY_VIEW_MISS', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        view: 'PLAYER',
        publicEventCount: response?.publicEvents.length ?? 0,
      });
      return response;
    },

    async getGmGameplayView(gameId: string): Promise<GameplayView | null> {
      logWebFlow('WEB_API_GET_GAMEPLAY_VIEW_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        view: 'GM',
      });
      const response = await requestJsonOrNull<GameplayView>(
        `${baseUrl}/gm/${encodeURIComponent(gameId)}/play`,
        auth
      );
      logWebFlow(response ? 'WEB_API_GET_GAMEPLAY_VIEW_HIT' : 'WEB_API_GET_GAMEPLAY_VIEW_MISS', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        view: 'GM',
        publicEventCount: response?.publicEvents.length ?? 0,
        gmEventCount: response?.gmOnlyEvents?.length ?? 0,
      });
      return response;
    },

    async getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null> {
      logWebFlow('WEB_API_GET_CHARACTER_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        characterId,
      });
      const response = await requestJsonOrNull<CharacterItem>(
        `${baseUrl}/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(characterId)}`,
        auth
      );
      logWebFlow(response ? 'WEB_API_GET_CHARACTER_HIT' : 'WEB_API_GET_CHARACTER_MISS', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        characterId,
        status: response && typeof response.status === 'string' ? response.status : null,
      });
      return response;
    },

    async getOwnedCharacter(playerId: string, characterId: string): Promise<CharacterItem | null> {
      logWebFlow('WEB_API_GET_OWNED_CHARACTER_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        playerId,
        characterId,
      });
      const response = await requestJsonOrNull<CharacterItem>(
        `${baseUrl}/players/${encodeURIComponent(playerId)}/characters/${encodeURIComponent(characterId)}`,
        auth
      );
      logWebFlow(response ? 'WEB_API_GET_OWNED_CHARACTER_HIT' : 'WEB_API_GET_OWNED_CHARACTER_MISS', {
        actorId: auth.actorId,
        authMode: auth.mode,
        playerId,
        characterId,
        status: response && typeof response.status === 'string' ? response.status : null,
      });
      return response;
    },

    async requestAppearanceUploadUrl(
      gameId: string,
      characterId: string,
      input: AppearanceUploadUrlRequest
    ): Promise<AppearanceUploadUrlResponse> {
      logWebFlow('WEB_API_APPEARANCE_UPLOAD_URL_REQUEST', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        characterId,
        contentType: input.contentType,
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
      });
      const response = await requestJson<AppearanceUploadUrlResponse>(
        `${baseUrl}/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(characterId)}/appearance/upload-url`,
        {
          method: 'POST',
          headers: await auth.withAuthHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify(input),
        }
      );
      logWebFlow('WEB_API_APPEARANCE_UPLOAD_URL_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        characterId,
        uploadId: response.uploadId,
        s3Key: response.s3Key,
      });
      return response;
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

async function requestJsonOrNull<T>(url: string, auth: AuthProvider): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: await auth.withAuthHeaders() });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw await toApiError(response);
    }
    return (await response.json()) as T;
  } catch (error) {
    logWebFlow('WEB_API_REQUEST_ERROR', {
      actorId: auth.actorId,
      authMode: auth.mode,
      url,
      ...summarizeError(error),
    });
    throw error;
  }
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw await toApiError(response);
    }
    return (await response.json()) as T;
  } catch (error) {
    logWebFlow('WEB_API_REQUEST_ERROR', {
      url,
      method: init.method ?? 'GET',
      ...summarizeError(error),
    });
    throw error;
  }
}

async function toApiError(response: Response): Promise<Error> {
  let message = `${response.status} ${response.statusText}`;
  try {
    const json = (await response.json()) as { error?: string };
    if (json.error) {
      message = json.error;
    }
  } catch {
    // no-op: keep fallback message
  }
  return new Error(message);
}
