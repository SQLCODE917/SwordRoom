import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProviderContext, type AuthProvider } from '../auth/AuthProvider';
import { AppShell } from './AppShell';

const useGmGamesMock = vi.fn();
const useMyProfileMock = vi.fn();

vi.mock('../hooks/useGmGames', () => ({
  useGmGames: () => useGmGamesMock(),
}));

vi.mock('../hooks/useMyProfile', () => ({
  useMyProfile: () => useMyProfileMock(),
}));

describe('AppShell', () => {
  it('disables GM nav when the actor has no GM games', () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['PLAYER'] },
      loading: false,
      error: null,
    });
    useGmGamesMock.mockReturnValue({
      games: [],
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    expect(screen.getByText('GM Games').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('GM Inbox').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Admin').getAttribute('aria-disabled')).toBe('true');
  });

  it('enables GM nav and points GM inbox to the first GM game', () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['GM', 'ADMIN'] },
      loading: false,
      error: null,
    });
    useGmGamesMock.mockReturnValue({
      games: [
        {
          gameId: 'game-2',
          name: 'GM Game',
          visibility: 'PUBLIC',
          gmPlayerId: 'player-aaa',
          version: 1,
        },
      ],
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    expect(screen.getByRole('link', { name: 'GM Games' }).getAttribute('href')).toBe('/gm/games');
    expect(screen.getByRole('link', { name: 'GM Inbox' }).getAttribute('href')).toBe('/gm/game-2/inbox');
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
  });

  it('keeps GM Games available for a GM with no games yet', () => {
    useMyProfileMock.mockReturnValue({
      profile: { playerId: 'player-aaa', roles: ['GM'] },
      loading: false,
      error: null,
    });
    useGmGamesMock.mockReturnValue({
      games: [],
      loading: false,
      error: null,
    });

    renderWithAuth({
      actorId: 'player-aaa',
      isAuthenticated: true,
    });

    expect(screen.getByRole('link', { name: 'GM Games' }).getAttribute('href')).toBe('/gm/games');
    expect(screen.getByText('GM Inbox').getAttribute('aria-disabled')).toBe('true');
  });
});

function renderWithAuth(overrides?: Partial<AuthProvider>) {
  const auth: AuthProvider = {
    mode: 'dev',
    actorId: 'player-aaa',
    isAuthenticated: true,
    async withAuthHeaders(headers?: HeadersInit) {
      return new Headers(headers);
    },
    withActor<T extends Record<string, unknown>>(body: T): T & { bypassActorId?: string } {
      return { ...body, bypassActorId: 'player-aaa' };
    },
    ...overrides,
  };

  return render(
    <AuthProviderContext.Provider value={auth}>
      <MemoryRouter>
        <AppShell>
          <div>Body</div>
        </AppShell>
      </MemoryRouter>
    </AuthProviderContext.Provider>
  );
}
