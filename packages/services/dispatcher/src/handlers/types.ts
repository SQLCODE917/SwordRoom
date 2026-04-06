import type { CommandEnvelope, CommandType } from '@starter/shared';
import type {
  AddGmInboxItemInput,
  AddGameplayEventInput,
  AddPlayerInboxItemInput,
  DbAccess,
  PutGameInviteInput,
  PutGameMemberInput,
  PutGameMetadataInput,
  PutGameplaySessionInput,
  PutCharacterDraftInput,
  UpdateGameInviteWithVersionInput,
  UpdateGameMetadataWithVersionInput,
  UpdateCharacterWithVersionInput,
} from '@starter/services-shared';

export interface DispatcherContext {
  db: DbAccess;
  nowIso: () => string;
}

export type WriteEffect =
  | {
      kind: 'PUT_CHARACTER_DRAFT';
      input: PutCharacterDraftInput;
    }
  | {
      kind: 'UPDATE_CHARACTER_WITH_VERSION';
      input: UpdateCharacterWithVersionInput;
    }
  | {
      kind: 'DELETE_CHARACTER';
      input: { gameId: string; characterId: string };
    }
  | {
      kind: 'PUT_GAME_CHAT_MESSAGE';
      input: {
        gameId: string;
        messageId: string;
        senderPlayerId: string;
        senderRole: 'PLAYER' | 'GM';
        senderCharacterId: string | null;
        senderNameSnapshot: string;
        body: string;
        createdAt: string;
      };
    }
  | {
      kind: 'PUT_GAMEPLAY_SESSION';
      input: PutGameplaySessionInput;
    }
  | {
      kind: 'PUT_GAMEPLAY_EVENT';
      input: AddGameplayEventInput;
    }
  | {
      kind: 'PUT_GAME_METADATA';
      input: PutGameMetadataInput;
    }
  | {
      kind: 'UPDATE_GAME_METADATA_WITH_VERSION';
      input: UpdateGameMetadataWithVersionInput;
    }
  | {
      kind: 'PUT_GAME_MEMBER';
      input: PutGameMemberInput;
    }
  | {
      kind: 'DELETE_GAME_MEMBER';
      input: { gameId: string; playerId: string };
    }
  | {
      kind: 'PUT_GAME_INVITE';
      input: PutGameInviteInput;
    }
  | {
      kind: 'UPDATE_GAME_INVITE_WITH_VERSION';
      input: UpdateGameInviteWithVersionInput;
    }
  | {
      kind: 'DELETE_GM_INBOX_ITEM';
      input: { gameId: string; createdAt: string; promptId: string };
    }
  | {
      kind: 'DELETE_PLAYER_INBOX_ITEM';
      input: { playerId: string; createdAt: string; promptId: string };
    };

export type InboxEffect =
  | { kind: 'GM_INBOX_ITEM'; input: AddGmInboxItemInput }
  | { kind: 'PLAYER_INBOX_ITEM'; input: AddPlayerInboxItemInput };

export interface NotificationEffect {
  template: 'char_submitted_to_gm' | 'char_approved' | 'char_rejected';
  gameId: string;
  characterId: string;
  actorId: string;
}

export interface HandlerEffects {
  writes: WriteEffect[];
  inbox: InboxEffect[];
  notifications: NotificationEffect[];
}

export type CommandHandler<T extends CommandType> = (
  ctx: DispatcherContext,
  envelope: CommandEnvelope<T>
) => Promise<HandlerEffects>;

export type HandlerRegistry = {
  [K in CommandType]: CommandHandler<K>;
};
