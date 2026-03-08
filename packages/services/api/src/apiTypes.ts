import type { AnyCommandEnvelope, CommandStatus, GMInboxItem, PlayerInboxItem } from '@starter/shared';
import type { CharacterItem } from '@starter/shared';

export interface ApiRoute {
  method: 'POST' | 'GET';
  path: string;
  auth: 'required' | 'gm_required';
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

export interface ReadApis {
  getCommandStatus(commandId: string): Promise<CommandStatusResponse | null>;
  getCharacter(gameId: string, characterId: string): Promise<CharacterItem | null>;
  getMyInbox(playerId: string): Promise<PlayerInboxItem[]>;
  getGameActorContext(gameId: string, actorId: string): Promise<GameActorContextResponse>;
  getGmInbox(gameId: string): Promise<GMInboxItem[]>;
}
