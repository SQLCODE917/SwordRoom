import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GameItem } from '../api/ApiClient';
import { PublicGamesTable } from './HomePage';

describe('PublicGamesTable', () => {
  it('shows GM Inbox only for game GMs, Player Inbox only for joined games, and disables Apply to Join once a character exists', () => {
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
      {
        gameId: 'game-applied',
        name: 'Applied Game',
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
          characterByGameId={
            new Map([
              [
                'game-applied',
                {
                  gameId: 'game-applied',
                  characterId: 'char-77',
                  ownerPlayerId: 'player-aaa',
                  status: 'REJECTED',
                },
              ],
            ])
          }
        />
      </MemoryRouter>
    );

    const gmRow = screen.getByText('GM Game').closest('[role="row"]');
    const joinedRow = screen.getByText('Joined Game').closest('[role="row"]');
    const openRow = screen.getByText('Open Game').closest('[role="row"]');
    const appliedRow = screen.getByText('Applied Game').closest('[role="row"]');

    expect(gmRow).toBeTruthy();
    expect(joinedRow).toBeTruthy();
    expect(openRow).toBeTruthy();
    expect(appliedRow).toBeTruthy();

    expect(within(gmRow as HTMLElement).getByRole('link', { name: 'Player Inbox' })).toBeTruthy();
    expect(within(gmRow as HTMLElement).getByRole('link', { name: 'GM Inbox' })).toBeTruthy();
    expect(within(gmRow as HTMLElement).getByRole('link', { name: 'Player Inbox' }).className).toContain('c-btn');
    expect(within(gmRow as HTMLElement).getByRole('link', { name: 'GM Inbox' }).className).toContain('c-btn');
    expect(within(gmRow as HTMLElement).queryByRole('link', { name: 'Apply to Join' })).toBeNull();

    expect(within(joinedRow as HTMLElement).getByRole('link', { name: 'Player Inbox' })).toBeTruthy();
    expect(within(joinedRow as HTMLElement).getByRole('link', { name: 'Player Inbox' }).className).toContain('c-btn');
    expect(within(joinedRow as HTMLElement).queryByRole('link', { name: 'GM Inbox' })).toBeNull();
    expect(within(joinedRow as HTMLElement).queryByRole('link', { name: 'Apply to Join' })).toBeNull();

    const applyLink = within(openRow as HTMLElement).getByRole('link', { name: 'Apply to Join' });
    expect(applyLink.getAttribute('href')).toBe('/games/game-open/character/new');
    expect(applyLink.className).toContain('c-btn');
    expect(within(openRow as HTMLElement).queryByRole('link', { name: 'Player Inbox' })).toBeNull();
    expect(within(openRow as HTMLElement).queryByRole('link', { name: 'GM Inbox' })).toBeNull();

    const disabledApply = within(appliedRow as HTMLElement).getByRole('link', { name: 'Apply to Join' });
    expect(disabledApply.getAttribute('aria-disabled')).toBe('true');
    expect(disabledApply.getAttribute('title')).toBe('You already have a character in this game.');
    expect(within(appliedRow as HTMLElement).getByRole('link', { name: 'Sheet' }).getAttribute('href')).toBe(
      '/games/game-applied/characters/char-77'
    );
    expect(within(appliedRow as HTMLElement).getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(
      '/games/game-applied/characters/char-77/edit'
    );
  });
});
