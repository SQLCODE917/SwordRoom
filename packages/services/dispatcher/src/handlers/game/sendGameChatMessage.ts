import type { CommandHandler } from '../types.js';
import { requireActiveGame } from './shared.js';

export const sendGameChatMessageHandler: CommandHandler<'SendGameChatMessage'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.gameId);
  const membership = await ctx.db.membershipRepository.getMembership(envelope.gameId, envelope.actorId);
  if (!membership) {
    const error = new Error(`player "${envelope.actorId}" is not a member of game "${envelope.gameId}"`);
    (error as Error & { code?: string }).code = 'GAME_CHAT_MEMBER_REQUIRED';
    throw error;
  }

  const replyTarget = envelope.payload.replyTarget ?? null;
  const reactionArtifact = envelope.payload.artifact?.kind === 'CHARACTER_DRAFT_REACTION' ? envelope.payload.artifact : null;
  const messages =
    replyTarget || reactionArtifact
      ? await ctx.db.chatRepository.queryMessages(envelope.gameId)
      : [];

  if (replyTarget?.kind === 'CHARACTER_DRAFT') {
    const targetMessage = messages.find((message) => message.messageId === replyTarget.targetMessageId);
    const targetDraftArtifact = targetMessage?.artifact?.kind === 'CHARACTER_DRAFT' ? targetMessage.artifact : null;
    if (!targetDraftArtifact) {
      const error = new Error(`reply target "${replyTarget.targetMessageId}" was not found in game "${envelope.gameId}"`);
      (error as Error & { code?: string }).code = 'CHAT_REPLY_TARGET_NOT_FOUND';
      throw error;
    }
    if (
      targetDraftArtifact.characterId !== replyTarget.characterId ||
      targetDraftArtifact.snapshotVersion !== replyTarget.snapshotVersion
    ) {
      const error = new Error(`reply target "${replyTarget.targetMessageId}" does not match the referenced draft snapshot`);
      (error as Error & { code?: string }).code = 'CHAT_REPLY_TARGET_MISMATCH';
      throw error;
    }
  }

  if (replyTarget?.kind === 'GAME_PROMPT') {
    const targetMessage = messages.find((message) => message.messageId === replyTarget.targetMessageId);
    const targetPromptArtifact = targetMessage?.artifact?.kind === 'GAME_PROMPT' ? targetMessage.artifact : null;
    if (!targetPromptArtifact) {
      const error = new Error(`prompt reply target "${replyTarget.targetMessageId}" was not found in game "${envelope.gameId}"`);
      (error as Error & { code?: string }).code = 'CHAT_PROMPT_TARGET_NOT_FOUND';
      throw error;
    }
    if (targetPromptArtifact.promptId !== replyTarget.promptId) {
      const error = new Error(`prompt reply target "${replyTarget.targetMessageId}" does not match the referenced prompt`);
      (error as Error & { code?: string }).code = 'CHAT_PROMPT_TARGET_MISMATCH';
      throw error;
    }
  }

  if (reactionArtifact) {
    const targetMessage = messages.find((message) => message.messageId === reactionArtifact.targetMessageId);
    const targetDraftArtifact = targetMessage?.artifact?.kind === 'CHARACTER_DRAFT' ? targetMessage.artifact : null;
    if (!targetDraftArtifact) {
      const error = new Error(`reaction target "${reactionArtifact.targetMessageId}" was not found in game "${envelope.gameId}"`);
      (error as Error & { code?: string }).code = 'CHAT_REACTION_TARGET_NOT_FOUND';
      throw error;
    }
    if (
      targetDraftArtifact.characterId !== reactionArtifact.characterId ||
      targetDraftArtifact.snapshotVersion !== reactionArtifact.snapshotVersion
    ) {
      const error = new Error(`reaction target "${reactionArtifact.targetMessageId}" does not match the referenced draft snapshot`);
      (error as Error & { code?: string }).code = 'CHAT_REACTION_TARGET_MISMATCH';
      throw error;
    }
  }

  const [senderCharacter, profile] = await Promise.all([
    ctx.db.characterRepository.findOwnedCharacterInGame(envelope.gameId, envelope.actorId),
    ctx.db.playerRepository.getPlayerProfile(envelope.actorId),
  ]);
  const senderRole = membership.roles.includes('GM') ? 'GM' : 'PLAYER';
  const senderNameSnapshot = senderCharacter
    ? readCharacterIdentityName(senderCharacter)
    : (profile?.displayName?.trim() || envelope.actorId);

  return {
    writes: [
      {
        kind: 'PUT_GAME_CHAT_MESSAGE',
        input: {
          gameId: envelope.gameId,
          messageId: envelope.commandId,
          senderPlayerId: envelope.actorId,
          senderRole,
          senderCharacterId: senderCharacter?.characterId ?? null,
          senderNameSnapshot,
          body: envelope.payload.body,
          artifact: envelope.payload.artifact,
          replyTarget: envelope.payload.replyTarget,
          createdAt: envelope.createdAt,
        },
      },
    ],
    inbox: [],
    notifications: [],
  };
};

function readCharacterIdentityName(character: { draft: { identity: { name: string } }; characterId: string }): string {
  const name = character.draft.identity.name.trim();
  return name || character.characterId;
}
