import type { CharacterDraft } from '@starter/shared';
import type { CommandHandler } from '../types.js';
import { requireCharacter } from './shared.js';

export const gmReviewHandler: CommandHandler<'GMReviewCharacter'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);

  const nextStatus = envelope.payload.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const updatedDraft: CharacterDraft = {
    ...character.draft,
    gmNote: envelope.payload.gmNote ?? null,
  };

  const gmItems = await ctx.db.inboxRepository.queryGmInbox(envelope.gameId);
  const gmItem = gmItems.find((item) => item.kind === 'PENDING_CHARACTER' && item.ref.characterId === envelope.payload.characterId);

  return {
    writes: [
      {
        kind: 'UPDATE_CHARACTER_WITH_VERSION',
        input: {
          gameId: character.gameId,
          characterId: character.characterId,
          expectedVersion: character.version,
          next: {
            ownerPlayerId: character.ownerPlayerId,
            draft: updatedDraft,
            status: nextStatus,
            updatedAt: ctx.nowIso(),
            submittedAt: character.submittedAt ?? null,
            submittedDraftVersion: character.submittedDraftVersion ?? null,
          },
        },
      },
      ...(gmItem
        ? [
            {
              kind: 'DELETE_GM_INBOX_ITEM' as const,
              input: {
                gameId: envelope.gameId,
                createdAt: gmItem.createdAt,
                promptId: gmItem.promptId,
              },
            },
          ]
        : []),
    ],
    inbox: [
      {
        kind: 'PLAYER_INBOX_ITEM',
        input: {
          playerId: character.ownerPlayerId,
          promptId: envelope.commandId,
          gameId: envelope.gameId,
          kind: nextStatus === 'APPROVED' ? 'CHAR_APPROVED' : 'CHAR_REJECTED',
          ref: { characterId: character.characterId, commandId: envelope.commandId },
          message: nextStatus === 'APPROVED' ? 'Character approved' : 'Character rejected',
          createdAt: envelope.createdAt,
          readAt: null,
        },
      },
    ],
    notifications: [
      {
        template: nextStatus === 'APPROVED' ? 'char_approved' : 'char_rejected',
        gameId: envelope.gameId,
        characterId: envelope.payload.characterId,
        actorId: envelope.actorId,
      },
    ],
  };
};
