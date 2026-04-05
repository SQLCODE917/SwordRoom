import { acceptInvite } from '@starter/engine';
import type { CommandHandler } from '../types.js';
import { requireActiveGame } from './shared.js';

export const acceptGameInviteHandler: CommandHandler<'AcceptGameInvite'> = async (ctx, envelope) => {
  await requireActiveGame(ctx.db, envelope.payload.gameId);
  const invite = await ctx.db.inviteRepository.getInvite(envelope.payload.gameId, envelope.payload.inviteId);
  if (!invite) {
    const error = new Error(`invite not found: ${envelope.payload.gameId}/${envelope.payload.inviteId}`);
    (error as Error & { code?: string }).code = 'INVITE_NOT_FOUND';
    throw error;
  }

  const accepted = acceptInvite(
    {
      inviteId: invite.inviteId,
      gameId: invite.gameId,
      invitedPlayerId: invite.invitedPlayerId,
      invitedEmailNormalized: invite.invitedEmailNormalized,
      invitedByPlayerId: invite.invitedByPlayerId,
      status: invite.status,
      version: invite.version,
    },
    envelope.actorId
  );

  if (accepted.errors.length > 0) {
    const first = accepted.errors[0]!;
    const error = new Error(first.message);
    (error as Error & { code?: string }).code = first.code;
    throw error;
  }

  const playerInbox = await ctx.db.inboxRepository.queryPlayerInbox(envelope.actorId);
  const invitePrompt = playerInbox.find((item) => item.promptId === invite.inviteId);

  return {
    writes: [
      {
        kind: 'UPDATE_GAME_INVITE_WITH_VERSION',
        input: {
          gameId: invite.gameId,
          inviteId: invite.inviteId,
          expectedVersion: invite.version,
          next: {
            invitedPlayerId: invite.invitedPlayerId,
            invitedEmailNormalized: invite.invitedEmailNormalized,
            invitedByPlayerId: invite.invitedByPlayerId,
            status: 'ACCEPTED',
            updatedAt: ctx.nowIso(),
            respondedAt: envelope.createdAt,
          },
        },
      },
      {
        kind: 'PUT_GAME_MEMBER',
        input: {
          gameId: invite.gameId,
          playerId: invite.invitedPlayerId,
          roles: ['PLAYER'],
          createdAt: envelope.createdAt,
          updatedAt: ctx.nowIso(),
        },
      },
      ...(invitePrompt
        ? [
            {
              kind: 'DELETE_PLAYER_INBOX_ITEM' as const,
              input: {
                playerId: envelope.actorId,
                createdAt: invitePrompt.createdAt,
                promptId: invitePrompt.promptId,
              },
            },
          ]
        : []),
    ],
    inbox: [
      {
        kind: 'GM_INBOX_ITEM',
        input: {
          gameId: invite.gameId,
          promptId: envelope.commandId,
          kind: 'GAME_INVITE_ACCEPTED',
          ref: { inviteId: invite.inviteId, playerId: envelope.actorId, commandId: envelope.commandId },
          message: `Player ${envelope.actorId} accepted the invite`,
          createdAt: envelope.createdAt,
          readAt: null,
        },
      },
    ],
    notifications: [],
  };
};
