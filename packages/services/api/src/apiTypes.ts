import type {
  AnyCommandEnvelope,
  CharacterItem,
  CommandStatus,
  PregameRole,
  SharedChatArtifact,
  GameChatSenderRole,
  GameplayViewResponse as SharedGameplayViewResponse,
  GameMetadataItem,
  GMInboxItem,
  PlayerInboxItem,
  PlayerProfileItem,
} from '@starter/shared';

export type ApiRouteMethod = 'POST' | 'GET';
export type ApiRouteAuth = 'required' | 'gm_required' | 'admin_required';

export interface ApiRoute {
  method: ApiRouteMethod;
  path: string;
  auth: ApiRouteAuth;
}

export interface CommandStatusResponse {
  commandId: string;
  status: CommandStatus;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface GameActorContextResponse {
  actorId: string;
  displayName: string | null;
  roles: string[];
  gmPlayerId: string | null;
  isGameMaster: boolean;
}

export interface GameChatParticipantResponse {
  playerId: string;
  displayName: string;
  role: GameChatSenderRole;
  characterId: string | null;
}

export interface GameChatMessageResponse {
  messageId: string;
  senderPlayerId: string;
  senderDisplayName: string;
  senderRole: GameChatSenderRole;
  senderCharacterId: string | null;
  body: string;
  artifact?: SharedChatArtifact;
  createdAt: string;
}

export interface GameChatResponse {
  gameId: string;
  gameName: string;
  participants: GameChatParticipantResponse[];
  messages: GameChatMessageResponse[];
}

export interface PregamePlanningPromptResponse {
  promptId: string;
  title: string;
  prompt: string;
  suggestedRoles: PregameRole[];
  senderDisplayName: string;
  createdAt: string;
}

export interface PregamePlanningClaimResponse {
  claimId: string;
  characterId: string;
  snapshotVersion: number;
  characterName: string;
  roles: PregameRole[];
  note: string | null;
  senderDisplayName: string;
  createdAt: string;
}

export interface PregamePlanningNeedResponse {
  role: PregameRole;
  label: string;
  isOpen: boolean;
  claimedBy: string[];
}

export interface PregamePlanningResponse {
  gameId: string;
  gameName: string;
  viewer: {
    isMember: boolean;
    isGameMaster: boolean;
  };
  activePrompt: PregamePlanningPromptResponse | null;
  partyNeeds: PregamePlanningNeedResponse[];
  recentClaims: PregamePlanningClaimResponse[];
}

export type PregameDigestDestination = 'LOBBY' | 'CHAT' | 'CREATE_CHARACTER' | 'EDIT_CHARACTER';

export interface PregameDigestEntryResponse {
  digestId: string;
  gameId: string;
  gameName: string;
  headline: string;
  detail: string;
  destination: PregameDigestDestination;
  characterId: string | null;
  createdAt: string;
}

export type GameplayViewResponse = SharedGameplayViewResponse;

export interface PostCommandRequest {
  envelope: Omit<AnyCommandEnvelope, 'actorId'> & { actorId?: string };
  authHeader?: string;
  bypassActorId?: string;
}

export interface PostCommandResponse {
  accepted: true;
  commandId: string;
  status: CommandStatus;
}

export interface ApiRuntimeService {
  postCommands(request: PostCommandRequest): Promise<PostCommandResponse>;
  readApis: ReadApis;
}

export interface ReadApis {
  syncMyProfile(input: {
    authHeader?: string;
    bypassActorId?: string;
  }): Promise<PlayerProfileItem>;
  getCommandStatus(commandId: string): Promise<CommandStatusResponse | null>;
  getGame(gameId: string): Promise<GameMetadataItem | null>;
  getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
  getOwnedCharacter(playerId: string, characterId: string): Promise<CharacterItem | null>;
  listCharactersByOwner(playerId: string): Promise<CharacterItem[]>;
  getMyInbox(playerId: string): Promise<PlayerInboxItem[]>;
  getMyProfile(playerId: string): Promise<PlayerProfileItem | null>;
  listPublicGames(): Promise<GameMetadataItem[]>;
  listAllGames(): Promise<GameMetadataItem[]>;
  listGamesForPlayer(playerId: string): Promise<GameMetadataItem[]>;
  listGamesForGm(playerId: string): Promise<GameMetadataItem[]>;
  listUsers(): Promise<PlayerProfileItem[]>;
  getMyPregameDigest(playerId: string): Promise<PregameDigestEntryResponse[]>;
  getGameActorContext(gameId: string, actorId: string): Promise<GameActorContextResponse>;
  getGmInbox(gameId: string): Promise<GMInboxItem[]>;
  getGameChat(gameId: string): Promise<GameChatResponse>;
  getPregamePlanning(gameId: string, actorId: string): Promise<PregamePlanningResponse>;
  getPlayerGameplayView(gameId: string): Promise<GameplayViewResponse | null>;
  getGmGameplayView(gameId: string): Promise<GameplayViewResponse | null>;
}
