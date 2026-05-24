import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLifecycle } from '../hooks/useGameLifecycle';
import { GMGamePage } from './GMGamePage';

vi.mock('../hooks/useGameLifecycle', () => ({
  useGameLifecycle: vi.fn(),
}));

vi.mock('./PregameLobbyPage', () => ({
  PregameLobbyPage: () => <div>Pregame Lobby Stub</div>,
}));

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/gm/games/:gameId" element={<GMGamePage />} />
        <Route path="/games/:gameId/play" element={<div>Player Play Destination</div>} />
        <Route path="/gm/:gameId/play" element={<div>GM Play Destination</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GMGamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGameLifecycle).mockReturnValue({
      lifecycle: { gameId: 'game-1', phase: 'PREGAME', hasGameplaySession: false },
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });
  });

  it('renders lobby mode with deep links for play and gm play', async () => {
    renderPage('/gm/games/game-1');

    expect(await screen.findByRole('heading', { name: 'GM Game' })).toBeTruthy();
    expect(screen.getByText('Pregame Lobby Stub')).toBeTruthy();
    expect(screen.getByText('Phase: PREGAME')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Play' }).getAttribute('href')).toBe('/gm/games/game-1?mode=play');
    expect(screen.getByRole('link', { name: 'GM Play' }).getAttribute('href')).toBe('/gm/games/game-1?mode=gm-play');
  });

  it('redirects play mode to the player play route', async () => {
    renderPage('/gm/games/game-1?mode=play');
    expect(await screen.findByText('Player Play Destination')).toBeTruthy();
  });

  it('redirects gm-play mode to the gm play route', async () => {
    renderPage('/gm/games/game-1?mode=gm-play');
    expect(await screen.findByText('GM Play Destination')).toBeTruthy();
  });

  it('shows the live lifecycle guidance when gameplay is live', async () => {
    vi.mocked(useGameLifecycle).mockReturnValue({
      lifecycle: { gameId: 'game-1', phase: 'LIVE', hasGameplaySession: true },
      initialLoading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
    });

    renderPage('/gm/games/game-1');

    expect(await screen.findByText('Phase: LIVE')).toBeTruthy();
    expect(
      screen.getByText('Gameplay is live. Continue in Play or GM Play; Lobby remains available for planning context.')
    ).toBeTruthy();
  });
});
