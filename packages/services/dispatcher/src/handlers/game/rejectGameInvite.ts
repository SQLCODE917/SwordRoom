import { rejectInvite } from '@starter/engine';
import type { CommandHandler } from '../types.js';

export const rejectGameInviteHandler: CommandHandler<'RejectGameInvite'> = async (ctx, envelope) => {
  const invite = await ctx.db.inviteRepository.getInvite(envelope.payload.gameId, envelope.payload.inviteId);
  if (!invite) {
    const error = new Error(`invite not found: ${envelope.payload.gameId}/${envelope.payload.inviteId}`);
    (error as Error & { code?: string }).code = 'INVITE_NOT_FOUND';
    throw error;
  }

  const rejected = rejectInvite(
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

  if (rejected.errors.length > 0) {
    const first = rejected.errors[0]!;
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
            status: 'REJECTED',
            updatedAt: ctx.nowIso(),
            respondedAt: envelope.createdAt,
          },
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
          kind: 'GAME_INVITE_REJECTED',
          ref: { inviteId: invite.inviteId, playerId: envelope.actorId, commandId: envelope.commandId },
          message: `Player ${envelope.actorId} rejected the invite`,
          createdAt: envelope.createdAt,
          readAt: null,
        },
      },
    ],
    notifications: [],
  };
};
