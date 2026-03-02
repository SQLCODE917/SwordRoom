import type { CommandEnvelope, CommandType } from '@starter/shared';
import type {
  AddGmInboxItemInput,
  AddPlayerInboxItemInput,
  DbAccess,
  PutCharacterDraftInput,
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
      kind: 'DELETE_GM_INBOX_ITEM';
      input: { gameId: string; submittedAt: string; characterId: string };
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
