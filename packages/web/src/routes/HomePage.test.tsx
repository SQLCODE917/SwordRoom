import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GameItem } from '../api/ApiClient';
import { PublicGamesTable } from './HomePage';

describe('PublicGamesTable', () => {
  it('shows GM Inbox only for game GMs, Player Inbox only for joined games, and Apply to Join otherwise', () => {
    const games: GameItem[] = [
      {
        gameId: 'game-gm',
        name: 'GM Game',
        visibility: 'PUBLIC',
        gmPlayerId: 'player-aaa',
        version: 1,
      },
      {
        gameId: 'game-joined',
        name: 'Joined Game',
        visibility: 'PUBLIC',
        gmPlayerId: 'gm-zzz',
        version: 1,
      },
      {
        gameId: 'game-open',
        name: 'Open Game',
        visibility: 'PUBLIC',
        gmPlayerId: 'gm-zzz',
        version: 1,
      },
    ];

    render(
      <MemoryRouter>
        <PublicGamesTable
          games={games}
          loading={false}
          emptyText="No public games found."
          joinedGameIds={new Set(['game-gm', 'game-joined'])}
          gmGameIds={new Set(['game-gm'])}
        />
      </MemoryRouter>
    );

    const gmRow = screen.getByText('GM Game').closest('[role="row"]');
    const joinedRow = screen.getByText('Joined Game').closest('[role="row"]');
    const openRow = screen.getByText('Open Game').closest('[role="row"]');

    expect(gmRow).toBeTruthy();
    expect(joinedRow).toBeTruthy();
    expect(openRow).toBeTruthy();

    expect(within(gmRow as HTMLElement).getByRole('link', { name: 'Player Inbox' })).toBeTruthy();
    expect(within(gmRow as HTMLElement).getByRole('link', { name: 'GM Inbox' })).toBeTruthy();
    expect(within(gmRow as HTMLElement).queryByRole('link', { name: 'Apply to Join' })).toBeNull();

    expect(within(joinedRow as HTMLElement).getByRole('link', { name: 'Player Inbox' })).toBeTruthy();
    expect(within(joinedRow as HTMLElement).queryByRole('link', { name: 'GM Inbox' })).toBeNull();
    expect(within(joinedRow as HTMLElement).queryByRole('link', { name: 'Apply to Join' })).toBeNull();

    const applyLink = within(openRow as HTMLElement).getByRole('link', { name: 'Apply to Join' });
    expect(applyLink.getAttribute('href')).toBe('/games/game-open/character/new');
    expect(within(openRow as HTMLElement).queryByRole('link', { name: 'Player Inbox' })).toBeNull();
    expect(within(openRow as HTMLElement).queryByRole('link', { name: 'GM Inbox' })).toBeNull();
  });
});
