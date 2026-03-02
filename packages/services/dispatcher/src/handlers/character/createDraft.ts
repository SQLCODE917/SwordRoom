import type { CommandHandler } from '../types.js';
import { emptyCharacterDraft } from './shared.js';

export const createDraftHandler: CommandHandler<'CreateCharacterDraft'> = async (ctx, envelope) => {
  const payload = envelope.payload;

  return {
    writes: [
      {
        kind: 'PUT_CHARACTER_DRAFT',
        input: {
          gameId: envelope.gameId,
          characterId: payload.characterId,
          ownerPlayerId: envelope.actorId,
          draft: emptyCharacterDraft(payload.race, payload.raisedBy ?? null),
          createdAt: envelope.createdAt,
          updatedAt: ctx.nowIso(),
          status: 'DRAFT',
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};
