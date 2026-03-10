export interface GameState {
  gameId: string;
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  gmPlayerId: string;
  version?: number;
}

export interface GameInviteState {
  inviteId: string;
  gameId: string;
  invitedPlayerId: string;
  invitedEmailNormalized: string;
  invitedByPlayerId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  version?: number;
}

export interface DomainError {
  code: string;
  message: string;
}

export function createGame(input: {
  gameId: string;
  name: string;
  gmPlayerId: string;
}): { state: GameState | null; errors: DomainError[] } {
  if (input.name.trim() === '') {
    return { state: null, errors: [{ code: 'GAME_NAME_REQUIRED', message: 'game name is required' }] };
  }

  return {
    state: {
      gameId: input.gameId,
      name: input.name.trim(),
      visibility: 'PRIVATE',
      gmPlayerId: input.gmPlayerId,
      version: 1,
    },
    errors: [],
  };
}

export function setGameVisibility(
  game: GameState,
  visibility: 'PUBLIC' | 'PRIVATE'
): { state: GameState; errors: DomainError[] } {
  if (game.visibility === visibility) {
    return { state: game, errors: [] };
  }

  return {
    state: {
      ...game,
      visibility,
      version: (game.version ?? 1) + 1,
    },
    errors: [],
  };
}

export function createInvite(input: {
  inviteId: string;
  gameId: string;
  invitedPlayerId: string;
  invitedEmailNormalized: string;
  invitedByPlayerId: string;
}): { state: GameInviteState; errors: DomainError[] } {
  return {
    state: {
      inviteId: input.inviteId,
      gameId: input.gameId,
      invitedPlayerId: input.invitedPlayerId,
      invitedEmailNormalized: input.invitedEmailNormalized,
      invitedByPlayerId: input.invitedByPlayerId,
      status: 'PENDING',
      version: 1,
    },
    errors: [],
  };
}

export function acceptInvite(
  invite: GameInviteState,
  actorId: string
): { state: GameInviteState; errors: DomainError[] } {
  return transitionInvite(invite, actorId, 'ACCEPTED');
}

export function rejectInvite(
  invite: GameInviteState,
  actorId: string
): { state: GameInviteState; errors: DomainError[] } {
  return transitionInvite(invite, actorId, 'REJECTED');
}

function transitionInvite(
  invite: GameInviteState,
  actorId: string,
  nextStatus: 'ACCEPTED' | 'REJECTED'
): { state: GameInviteState; errors: DomainError[] } {
  if (invite.invitedPlayerId !== actorId) {
    return {
      state: invite,
      errors: [{ code: 'INVITE_ACTOR_MISMATCH', message: 'invite is not addressed to this actor' }],
    };
  }

  if (invite.status === nextStatus) {
    return {
      state: invite,
      errors: [],
    };
  }

  if (invite.status !== 'PENDING') {
    return {
      state: invite,
      errors: [{ code: 'INVITE_NOT_PENDING', message: 'invite is not pending' }],
    };
  }

  return {
    state: {
      ...invite,
      status: nextStatus,
      version: (invite.version ?? 1) + 1,
    },
    errors: [],
  };
}
