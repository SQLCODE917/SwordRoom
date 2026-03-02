import { finalizeCharacter, submitForApproval } from '@starter/engine';
import type { CommandHandler } from '../types.js';
import { requireCharacter, throwOnEngineErrors, toCharacterDraft, toEngineState } from './shared.js';

export const submitForApprovalHandler: CommandHandler<'SubmitCharacterForApproval'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const state = toEngineState(character);

  const finalized = finalizeCharacter(state, { requireIdentityName: false });
  throwOnEngineErrors(finalized.errors);

  const submitted = submitForApproval(finalized.state);
  throwOnEngineErrors(submitted.errors);

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
            draft: toCharacterDraft(character, submitted.state),
            status: 'PENDING',
            updatedAt: ctx.nowIso(),
          },
        },
      },
    ],
    inbox: [
      {
        kind: 'GM_INBOX_ITEM',
        input: {
          gameId: envelope.gameId,
          characterId: envelope.payload.characterId,
          ownerPlayerId: character.ownerPlayerId,
          submittedAt: envelope.createdAt,
        },
      },
      {
        kind: 'PLAYER_INBOX_ITEM',
        input: {
          playerId: character.ownerPlayerId,
          promptId: envelope.commandId,
          gameId: envelope.gameId,
          kind: 'CHAR_SUBMITTED',
          ref: { characterId: character.characterId, commandId: envelope.commandId },
          message: 'Character submitted for GM review',
          createdAt: envelope.createdAt,
          readAt: null,
        },
      },
    ],
    notifications: [
      {
        template: 'char_submitted_to_gm',
        gameId: envelope.gameId,
        characterId: envelope.payload.characterId,
        actorId: envelope.actorId,
      },
    ],
  };
};
