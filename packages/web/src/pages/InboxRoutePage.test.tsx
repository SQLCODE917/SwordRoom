import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxRoutePage } from './InboxRoutePage';
import { useGmGames } from '../hooks/useGmGames';

vi.mock('../hooks/useGmGames', () => ({
  useGmGames: vi.fn(),
}));

vi.mock('./PlayerInboxPage', () => ({
  PlayerInboxPage: () => <div data-testid="player-inbox">player inbox</div>,
}));

vi.mock('./GMInboxPage', () => ({
  GMInboxPage: ({ gameId }: { gameId: string }) => <div data-testid="gm-inbox">{gameId}</div>,
}));

function LocationDump() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('InboxRoutePage', () => {
  beforeEach(() => {
    vi.mocked(useGmGames).mockReset();
    vi.mocked(useGmGames).mockReturnValue({
      games: [],
      loading: false,
      error: null,
    });
  });

  it('defaults to player inbox when mode is omitted', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/inbox']}>
        <Routes>
          <Route path="/inbox" element={<InboxRoutePage />} />
          <Route path="*" element={<LocationDump />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('player-inbox')).toBeTruthy();
  });

  it('renders the selected gm game inbox when mode=gm and gameId is provided', () => {
    vi.mocked(useGmGames).mockReturnValue({
      games: [
        {
          gameId: 'game-2',
          name: 'Primary',
          visibility: 'PUBLIC',
          gmPlayerId: 'gm-1',
          version: 2,
        },
        {
          gameId: 'game-1',
          name: 'Backup',
          visibility: 'PUBLIC',
          gmPlayerId: 'gm-1',
          version: 1,
        },
      ],
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/inbox?mode=gm&gameId=game-2']}>
        <Routes>
          <Route path="/inbox" element={<InboxRoutePage />} />
          <Route path="*" element={<LocationDump />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('gm-inbox').textContent).toBe('game-2');
  });

  it('falls back to first gm game when mode=gm gameId is not a gm game', () => {
    vi.mocked(useGmGames).mockReturnValue({
      games: [
        {
          gameId: 'game-1',
          name: 'Primary',
          visibility: 'PUBLIC',
          gmPlayerId: 'gm-1',
          version: 1,
        },
      ],
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/inbox?mode=gm&gameId=game-9']}>
        <Routes>
          <Route path="/inbox" element={<InboxRoutePage />} />
          <Route path="*" element={<LocationDump />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('gm-inbox').textContent).toBe('game-1');
  });

  it('falls back to player inbox when mode=gm has no gm games', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/inbox?mode=gm']}>
        <Routes>
          <Route path="/inbox" element={<InboxRoutePage />} />
          <Route path="*" element={<LocationDump />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('player-inbox')).toBeTruthy();
  });
});
