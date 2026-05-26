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

  it('renders play mode in-place when mode=play', async () => {
    renderPage('/gm/games/game-1?mode=play');
    expect(await screen.findByText('Player Play Route Stub')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'GM Game' })).toBeNull();
  });

  it('renders gm-play mode in-place when mode=gm-play', async () => {
    renderPage('/gm/games/game-1?mode=gm-play');
    expect(await screen.findByText('GM Play Stub')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Play' }).getAttribute('href')).toBe('/gm/games/game-1?mode=play');
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
