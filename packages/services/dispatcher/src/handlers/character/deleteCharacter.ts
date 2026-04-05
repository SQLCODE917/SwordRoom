import { isPlayerCharacterLibraryGameId } from '@starter/shared';
import { assertGameMasterActor } from '@starter/services-shared';
import type { CommandHandler } from '../types.js';
import { requireCharacter } from './shared.js';

export const deleteCharacterHandler: CommandHandler<'DeleteCharacter'> = async (ctx, envelope) => {
  const character = await requireCharacter(ctx.db, envelope.gameId, envelope.payload.characterId);
  const actorIsOwner = character.ownerPlayerId === envelope.actorId;
  if (!actorIsOwner) {
    await assertGameMasterActor(ctx.db, {
      gameId: envelope.gameId,
      actorId: envelope.actorId,
    });
  }

  const shouldInspectGameMembership = !isPlayerCharacterLibraryGameId(envelope.gameId);
  const [membership, gmInboxItems] = await Promise.all([
    shouldInspectGameMembership ? ctx.db.membershipRepository.getMembership(envelope.gameId, character.ownerPlayerId) : null,
    shouldInspectGameMembership ? ctx.db.inboxRepository.queryGmInbox(envelope.gameId) : [],
  ]);
  const pendingCharacterItems = gmInboxItems.filter(
    (item) => item.kind === 'PENDING_CHARACTER' && item.ref.characterId === character.characterId
  );

  return {
    writes: [
      {
        kind: 'DELETE_CHARACTER',
        input: {
          gameId: character.gameId,
          characterId: character.characterId,
        },
      },
      ...(membership && membership.roles.every((role) => role === 'PLAYER')
        ? [
            {
              kind: 'DELETE_GAME_MEMBER' as const,
              input: {
                gameId: membership.gameId,
                playerId: membership.playerId,
              },
            },
          ]
        : []),
      ...pendingCharacterItems.map((item) => ({
        kind: 'DELETE_GM_INBOX_ITEM' as const,
        input: {
          gameId: item.gameId,
          createdAt: item.createdAt,
          promptId: item.promptId,
        },
      })),
    ],
    inbox: [],
    notifications: [],
  };
};
