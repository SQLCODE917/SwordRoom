import type { CommandHandler } from '../types.js';
import { computeAndValidate, requireCharacter, toCharacterDraft, toEngineState } from './shared.js';

export const setSubAbilitiesHandler: CommandHandler<'SetCharacterSubAbilities'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);
  state.subAbility = envelope.payload.subAbility;

  const nextState = computeAndValidate(state);

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
