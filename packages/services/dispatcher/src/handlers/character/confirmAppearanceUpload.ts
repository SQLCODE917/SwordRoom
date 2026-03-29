import type { CharacterDraft } from '@starter/shared';
import type { CommandHandler } from '../types.js';
import { requireCharacter } from './shared.js';

export const confirmAppearanceUploadHandler: CommandHandler<'ConfirmCharacterAppearanceUpload'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const updatedDraft: CharacterDraft = {
    ...character.draft,
    appearance: {
      imageKey: envelope.payload.s3Key,
      imageUrl: null,
      updatedAt: ctx.nowIso(),
    },
  };

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
            status: character.status,
            updatedAt: ctx.nowIso(),
          },
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};
