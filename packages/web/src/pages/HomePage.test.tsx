import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useMyProfile } from '../hooks/useMyProfile';
import { HomePage } from './HomePage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useMyProfile', () => ({
  useMyProfile: vi.fn(),
}));

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

function createAuth(): AuthProvider {
  return {
    mode: 'dev',
    actorId: 'player-aaa',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-aaa' }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Create Game under My Games for authenticated players', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(useMyProfile).mockReturnValue({
      profile: {
        playerId: 'player-aaa',
        displayName: 'Local Player',
        email: 'player@example.com',
        roles: ['PLAYER'],
      },
      loading: false,
      error: null,
    });
    vi.mocked(createApiClient).mockReturnValue({
      getMyCharacters: vi.fn(async () => []),
      getMyGames: vi.fn(async () => []),
      getGmGames: vi.fn(async () => []),
      getPublicGames: vi.fn(async () => []),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const createGameLink = await screen.findByRole('link', { name: 'Create Game' });
    expect(createGameLink.getAttribute('href')).toBe('/gm/games');
  });

  it('renders character action links with the shared button style', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(useMyProfile).mockReturnValue({
      profile: {
        playerId: 'player-aaa',
        displayName: 'Local Player',
        email: 'player@example.com',
        roles: ['PLAYER'],
      },
      loading: false,
      error: null,
    });
    vi.mocked(createApiClient).mockReturnValue({
      getMyCharacters: vi.fn(async () => [
        {
          gameId: 'PLAYER_CHARACTER_LIBRARY::player-aaa',
          characterId: 'char-1',
          ownerPlayerId: 'player-aaa',
          status: 'DRAFT',
          draft: {
            identity: { name: 'Test Hero' },
          },
        },
      ]),
      getMyGames: vi.fn(async () => []),
      getGmGames: vi.fn(async () => []),
      getPublicGames: vi.fn(async () => []),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const sheetLink = await screen.findByRole('link', { name: 'Sheet' });
    const editLink = screen.getByRole('link', { name: 'Edit' });

    expect(sheetLink.getAttribute('href')).toBe('/player/player-aaa/characters/char-1');
    expect(sheetLink.className).toContain('c-btn');
    expect(editLink.className).toContain('c-btn');
  });
});
