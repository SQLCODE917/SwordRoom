import type { AuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeCommandEnvelope, summarizeError } from '../logging/flowLog';

export type CommandType =
  | 'SaveCharacterDraft'
  | 'CreateCharacterDraft'
  | 'SetCharacterSubAbilities'
  | 'ApplyStartingPackage'
  | 'SpendStartingExp'
  | 'PurchaseStarterEquipment'
  | 'ConfirmCharacterAppearanceUpload'
  | 'SubmitCharacterForApproval'
  | 'GMReviewCharacter';

interface CommandPayloadByType {
  SaveCharacterDraft: {
    characterId: string;
    expectedVersion?: number | null;
    race: string;
    raisedBy?: string | null;
    subAbility: { A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number };
    backgroundRoll2dTotal?: number;
    startingMoneyRoll2dTotal?: number;
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
  SubmitCharacterForApproval: {
    characterId: string;
    expectedVersion: number;
  };
  GMReviewCharacter: { characterId: string; decision: 'APPROVE' | 'REJECT'; gmNote?: string };
}

export interface CommandEnvelopeInput<T extends CommandType = CommandType> {
  commandId: string;
  gameId: string;
  type: T;
  schemaVersion: number;
  createdAt: string;
  payload: CommandPayloadByType[T];
}

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
  gameId: string;
  characterId: string;
  ownerPlayerId: string;
  status: 'PENDING';
  submittedAt: string;
  [key: string]: unknown;
}

export interface CharacterItem {
  gameId: string;
  characterId: string;
  status: string;
  [key: string]: unknown;
}

export interface GameActorContextResponse {
  actorId: string;
  displayName: string | null;
  roles: string[];
  gmPlayerId: string | null;
  isGameMaster: boolean;
}

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
  getCommandStatus(commandId: string): Promise<CommandStatusResponse | null>;
  getMyInbox(): Promise<PlayerInboxItem[]>;
  getGameActorContext(gameId: string): Promise<GameActorContextResponse>;
  getGmInbox(gameId: string): Promise<GMInboxItem[]>;
  getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
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
