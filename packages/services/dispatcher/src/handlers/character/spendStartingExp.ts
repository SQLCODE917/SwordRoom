import type { CommandHandler } from '../types.js';
import { requireCharacter, spendExpAndValidate, toCharacterDraft, toEngineState } from './shared.js';

export const spendStartingExpHandler: CommandHandler<'SpendStartingExp'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);

  const nextState = spendExpAndValidate(state, { purchases: envelope.payload.purchases });

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
            draft: toCharacterDraft(character, nextState),
            status: 'DRAFT',
            updatedAt: ctx.nowIso(),
          },
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};
