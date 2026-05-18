import type { CommandHandler } from '../types.js';
import { toCharacterDraft, toEngineState, toEquipmentCart } from './mappers.js';
import { purchaseAndValidate, requireCharacter } from './shared.js';

export const purchaseStarterEquipmentHandler: CommandHandler<'PurchaseStarterEquipment'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);

  const nextState = purchaseAndValidate(state, toEquipmentCart(envelope.payload.cart));

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
