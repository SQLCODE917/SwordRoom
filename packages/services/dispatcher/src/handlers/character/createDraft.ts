import type { CommandHandler } from '../types.js';
import { emptyCharacterDraft } from './shared.js';

export const createDraftHandler: CommandHandler<'CreateCharacterDraft'> = async (ctx, envelope) => {
  const payload = envelope.payload;
  const existing = await ctx.db.characterRepository.getCharacter(envelope.gameId, payload.characterId);
  if (existing) {
    const error = new Error(`Character ID "${payload.characterId}" already exists in game "${envelope.gameId}".`);
    (error as Error & { code?: string }).code = 'CHARACTER_ID_ALREADY_EXISTS';
    throw error;
  }

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
