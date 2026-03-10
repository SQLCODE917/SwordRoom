import { describe, expect, it } from 'vitest';
import { acceptInvite, createGame, createInvite, rejectInvite, setGameVisibility } from './games.js';

describe('games domain', () => {
  it('creates a private game with trimmed name', () => {
    const created = createGame({
      gameId: 'game-42',
      name: '  Demo Game  ',
      gmPlayerId: 'player-1',
    });

    expect(created.errors).toEqual([]);
    expect(created.state).toEqual({
      gameId: 'game-42',
      name: 'Demo Game',
      visibility: 'PRIVATE',
      gmPlayerId: 'player-1',
      version: 1,
    });
  });

  it('changes visibility idempotently', () => {
    const created = createGame({
      gameId: 'game-42',
      name: 'Demo Game',
      gmPlayerId: 'player-1',
    }).state!;

    const published = setGameVisibility(created, 'PUBLIC');
    expect(published.errors).toEqual([]);
    expect(published.state.visibility).toBe('PUBLIC');
    expect(published.state.version).toBe(2);

    const replay = setGameVisibility(published.state, 'PUBLIC');
    expect(replay.errors).toEqual([]);
    expect(replay.state).toEqual(published.state);
  });

  it('accepts and rejects invites only for the addressed actor', () => {
    const invite = createInvite({
      inviteId: 'invite-1',
      gameId: 'game-1',
      invitedPlayerId: 'player-2',
      invitedEmailNormalized: 'player@example.com',
      invitedByPlayerId: 'gm-1',
    }).state;

    const wrongActor = acceptInvite(invite, 'player-3');
    expect(wrongActor.errors).toEqual([
      { code: 'INVITE_ACTOR_MISMATCH', message: 'invite is not addressed to this actor' },
    ]);

    const accepted = acceptInvite(invite, 'player-2');
    expect(accepted.errors).toEqual([]);
    expect(accepted.state.status).toBe('ACCEPTED');
    expect(accepted.state.version).toBe(2);

    const rejectedReplay = rejectInvite(accepted.state, 'player-2');
    expect(rejectedReplay.errors).toEqual([{ code: 'INVITE_NOT_PENDING', message: 'invite is not pending' }]);
  });
});
