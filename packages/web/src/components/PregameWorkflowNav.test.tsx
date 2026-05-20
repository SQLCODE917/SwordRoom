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
          sheetTo="/games/game-1/characters/char-1"
        />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Pregame workflow' });
    expect(within(nav).getByRole('link', { name: 'Lobby' }).getAttribute('href')).toBe('/games/game-1');
    expect(within(nav).getByRole('link', { name: 'Create' }).getAttribute('href')).toBe('/games/game-1/characters/char-1/edit');
    expect(within(nav).getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe('/games/game-1/chat');
    expect(within(nav).getByRole('link', { name: 'Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
    expect(within(nav).getByRole('link', { name: 'Inbox' }).getAttribute('href')).toBe('/me/inbox');
  });

  it('renders the sheet entry as disabled when no sheet route is available yet', () => {
    render(
      <MemoryRouter initialEntries={['/games/game-1']}>
        <PregameWorkflowNav gameId="game-1" createTo="/games/game-1/character/new" sheetTo={null} />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Pregame workflow' });
    const disabledSheet = within(nav).getByRole('link', { name: 'Sheet' });
    expect(disabledSheet.getAttribute('aria-disabled')).toBe('true');
  });
});
