import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PregameWorkflowNav } from './PregameWorkflowNav';

describe('PregameWorkflowNav', () => {
  it('renders the shared workflow routes for a game-scoped planning surface', () => {
    render(
      <MemoryRouter initialEntries={['/games/game-1/chat']}>
        <PregameWorkflowNav
          gameId="game-1"
          createTo="/games/game-1/characters/char-1/edit"
          charactersTo="/games/game-1/characters"
        />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Pregame workflow' });
    expect(within(nav).getByRole('link', { name: 'Lobby' }).getAttribute('href')).toBe('/games/game-1');
    expect(within(nav).getByRole('link', { name: 'Create' }).getAttribute('href')).toBe('/games/game-1/characters/char-1/edit');
    expect(within(nav).getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe('/games/game-1/chat');
    expect(within(nav).getByRole('link', { name: 'Characters' }).getAttribute('href')).toBe('/games/game-1/characters');
    expect(within(nav).getByRole('link', { name: 'Inbox' }).getAttribute('href')).toBe('/me/inbox');
  });

  it('defaults the characters entry to the game-scoped workbench route', () => {
    render(
      <MemoryRouter initialEntries={['/games/game-1']}>
        <PregameWorkflowNav gameId="game-1" createTo="/games/game-1/character/new" />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Pregame workflow' });
    expect(within(nav).getByRole('link', { name: 'Characters' }).getAttribute('href')).toBe('/games/game-1/characters');
  });
});
