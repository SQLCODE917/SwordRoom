import type { AuthProvider } from '../auth/AuthProvider';

export type CommandType =
  | 'CreateCharacterDraft'
  | 'SetCharacterSubAbilities'
  | 'ApplyStartingPackage'
  | 'SpendStartingExp'
  | 'PurchaseStarterEquipment'
  | 'SubmitCharacterForApproval'
  | 'GMReviewCharacter';

interface CommandPayloadByType {
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
  SubmitCharacterForApproval: { characterId: string; noteToGm?: string };
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
  status: 'ACCEPTED';
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

export interface ApiClient {
  postCommand<T extends CommandType>(input: { envelope: CommandEnvelopeInput<T> }): Promise<PostCommandResponse>;
  getCommandStatus(commandId: string): Promise<CommandStatusResponse | null>;
  getMyInbox(): Promise<PlayerInboxItem[]>;
  getGmInbox(gameId: string): Promise<GMInboxItem[]>;
  getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
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
      return requestJson<PostCommandResponse>(`${baseUrl}/commands`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    },

    async getCommandStatus(commandId: string): Promise<CommandStatusResponse | null> {
      return requestJsonOrNull<CommandStatusResponse>(`${baseUrl}/commands/${encodeURIComponent(commandId)}`, auth);
    },

    async getMyInbox(): Promise<PlayerInboxItem[]> {
      return requestJson<PlayerInboxItem[]>(`${baseUrl}/me/inbox`, {
        headers: await auth.withAuthHeaders(),
      });
    },

    async getGmInbox(gameId: string): Promise<GMInboxItem[]> {
      return requestJson<GMInboxItem[]>(`${baseUrl}/gm/${encodeURIComponent(gameId)}/inbox`, {
        headers: await auth.withAuthHeaders(),
      });
    },

    async getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null> {
      return requestJsonOrNull<CharacterItem>(
        `${baseUrl}/games/${encodeURIComponent(gameId)}/characters/${encodeURIComponent(characterId)}`,
        auth
      );
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

async function requestJsonOrNull<T>(url: string, auth: AuthProvider): Promise<T | null> {
  const response = await fetch(url, { headers: await auth.withAuthHeaders() });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
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
