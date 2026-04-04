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
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-aaa' }),
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
});
