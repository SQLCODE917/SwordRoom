import { finalizeCharacter, submitForApproval } from '@starter/engine';
import type { CommandHandler } from '../types.js';
import { requireCharacter, throwOnEngineErrors, toCharacterDraft, toEngineState } from './shared.js';

export const submitForApprovalHandler: CommandHandler<'SubmitCharacterForApproval'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  if (character.ownerPlayerId !== envelope.actorId) {
    const error = new Error(`character "${character.characterId}" is not owned by actor "${envelope.actorId}"`);
    (error as Error & { code?: string }).code = 'CHARACTER_OWNER_REQUIRED';
    throw error;
  }
  if (character.status === 'APPROVED') {
    const error = new Error(`character "${character.characterId}" is already approved`);
    (error as Error & { code?: string }).code = 'CHARACTER_ALREADY_APPROVED';
    throw error;
  }
  if (character.status === 'PENDING' && character.submittedDraftVersion === envelope.payload.expectedVersion) {
    return {
      writes: [],
      inbox: [],
      notifications: [],
    };
  }
  if (character.version !== envelope.payload.expectedVersion) {
    const error = new Error(
      `stale character version for "${character.characterId}": expected ${envelope.payload.expectedVersion}, actual ${character.version}`
    );
    (error as Error & { code?: string }).code = 'STALE_CHARACTER_VERSION';
    throw error;
  }

  const state = toEngineState(character);

  const finalized = finalizeCharacter(state, { requireIdentityName: true });
  throwOnEngineErrors(finalized.errors);

  const submitted = submitForApproval(finalized.state);
  throwOnEngineErrors(submitted.errors);

  const nextDraft = {
    ...toCharacterDraft(character, submitted.state),
    noteToGm: character.draft.noteToGm ?? null,
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
            draft: nextDraft,
            status: 'PENDING',
            updatedAt: ctx.nowIso(),
            submittedAt: envelope.createdAt,
            submittedDraftVersion: character.version,
          },
        },
      },
    ],
    inbox: [
      {
        kind: 'GM_INBOX_ITEM',
        input: {
          gameId: envelope.gameId,
          promptId: envelope.commandId,
          kind: 'PENDING_CHARACTER',
          ref: { characterId: envelope.payload.characterId, commandId: envelope.commandId, playerId: character.ownerPlayerId },
          ownerPlayerId: character.ownerPlayerId,
          message: `Character ${envelope.payload.characterId} submitted for review`,
          createdAt: envelope.createdAt,
          submittedAt: envelope.createdAt,
          readAt: null,
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
