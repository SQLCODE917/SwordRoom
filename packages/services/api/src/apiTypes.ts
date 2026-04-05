import type {
  AnyCommandEnvelope,
  CharacterItem,
  CommandStatus,
  GameChatSenderRole,
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
  createdAt: string;
}

export interface GameChatResponse {
  gameId: string;
  gameName: string;
  participants: GameChatParticipantResponse[];
  messages: GameChatMessageResponse[];
}

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
  getGameActorContext(gameId: string, actorId: string): Promise<GameActorContextResponse>;
  getGmInbox(gameId: string): Promise<GMInboxItem[]>;
  getGameChat(gameId: string): Promise<GameChatResponse>;
}
