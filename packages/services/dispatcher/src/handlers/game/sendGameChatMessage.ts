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
