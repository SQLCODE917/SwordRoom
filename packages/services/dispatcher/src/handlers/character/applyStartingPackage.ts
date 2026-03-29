import type { CommandHandler } from '../types.js';
import { applyStartingAndValidate, requireCharacter, toCharacterDraft, toEngineState } from './shared.js';

export const applyStartingPackageHandler: CommandHandler<'ApplyStartingPackage'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);

  const nextState = applyStartingAndValidate(state, {
    backgroundRoll2dTotal: envelope.payload.backgroundRoll2dTotal ?? envelope.payload.backgroundRoll2d,
    startingMoneyRoll2dTotal: envelope.payload.startingMoneyRoll2dTotal,
    useOrdinaryCitizenShortcut: envelope.payload.useOrdinaryCitizenShortcut,
  });

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
