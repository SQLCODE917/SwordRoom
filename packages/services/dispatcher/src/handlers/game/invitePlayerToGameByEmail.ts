import { createInvite } from '@starter/engine';
import type { CommandHandler } from '../types.js';

export const invitePlayerToGameByEmailHandler: CommandHandler<'InvitePlayerToGameByEmail'> = async (ctx, envelope) => {
  const game = await ctx.db.gameRepository.getGameMetadata(envelope.payload.gameId);
  if (!game) {
    const error = new Error(`game not found: ${envelope.payload.gameId}`);
    (error as Error & { code?: string }).code = 'GAME_NOT_FOUND';
    throw error;
  }

  const emailNormalized = envelope.payload.email.trim().toLowerCase();
  const invitedProfile = await ctx.db.playerRepository.getPlayerProfileByEmail(emailNormalized);
  if (!invitedProfile) {
    const error = new Error(`player not found for email "${emailNormalized}"`);
    (error as Error & { code?: string }).code = 'PLAYER_NOT_FOUND_BY_EMAIL';
    throw error;
  }

  const existingMembership = await ctx.db.membershipRepository.getMembership(game.gameId, invitedProfile.playerId);
  if (existingMembership) {
    const error = new Error(`player "${invitedProfile.playerId}" is already a member of game "${game.gameId}"`);
    (error as Error & { code?: string }).code = 'PLAYER_ALREADY_IN_GAME';
    throw error;
  }

  const invite = createInvite({
    inviteId: envelope.commandId,
    gameId: game.gameId,
    invitedPlayerId: invitedProfile.playerId,
    invitedEmailNormalized: emailNormalized,
    invitedByPlayerId: envelope.actorId,
  });

  return {
    writes: [
      {
        kind: 'PUT_GAME_INVITE',
        input: {
          gameId: game.gameId,
          inviteId: invite.state.inviteId,
          invitedPlayerId: invite.state.invitedPlayerId,
          invitedEmailNormalized: invite.state.invitedEmailNormalized,
          invitedByPlayerId: invite.state.invitedByPlayerId,
          status: invite.state.status,
          createdAt: envelope.createdAt,
          updatedAt: ctx.nowIso(),
          respondedAt: null,
        },
      },
    ],
    inbox: [
      {
        kind: 'PLAYER_INBOX_ITEM',
        input: {
          playerId: invitedProfile.playerId,
          promptId: invite.state.inviteId,
          gameId: game.gameId,
          kind: 'GAME_INVITE',
          ref: { inviteId: invite.state.inviteId, playerId: invitedProfile.playerId, commandId: envelope.commandId },
          message: `Invitation to join ${game.name}`,
          createdAt: envelope.createdAt,
          readAt: null,
        },
      },
    ],
    notifications: [],
  };
};
