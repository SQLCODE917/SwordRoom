import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GMGamePage } from './GMGamePage';

vi.mock('./PregameLobbyPage', () => ({
  PregameLobbyPage: () => <div>Pregame Lobby Stub</div>,
}));

vi.mock('./GMGameplayPage', () => ({
  GMGameplayPage: () => <div>GM Play Stub</div>,
}));

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/gm/games/:gameId" element={<GMGamePage />} />
        <Route path="/games/:gameId/play" element={<div>Player Play Route Stub</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GMGamePage', () => {
  it('renders lobby mode directly without the redundant GM game wrapper', async () => {
    renderPage('/gm/games/game-1');

    expect(await screen.findByText('Pregame Lobby Stub')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GM Game' })).toBeNull();
  });

  it('renders play mode in-place when mode=play', async () => {
    renderPage('/gm/games/game-1?mode=play');
    expect(await screen.findByText('Player Play Route Stub')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GM Game' })).toBeNull();
  });

  it('renders gm-play mode in-place when mode=gm-play', async () => {
    renderPage('/gm/games/game-1?mode=gm-play');
    expect(await screen.findByText('GM Play Stub')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GM Game' })).toBeNull();
  });
});
