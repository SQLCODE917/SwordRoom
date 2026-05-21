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

  const reactionArtifact = envelope.payload.artifact?.kind === 'CHARACTER_DRAFT_REACTION' ? envelope.payload.artifact : null;
  if (reactionArtifact) {
    const targetMessage = (await ctx.db.chatRepository.queryMessages(envelope.gameId)).find(
      (message) => message.messageId === reactionArtifact.targetMessageId
    );
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
