import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { AdminDashboardPage } from './AdminDashboardPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
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
    actorId: 'admin-aaa',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'admin-aaa' }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows game names without rendering their UUIDs in the games table', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getAdminUsers: vi.fn(async () => []),
      getAdminGames: vi.fn(async () => [
        {
          gameId: '7499f10c-ff0e-4dc1-a9cd-f34bc5668cea',
          name: 'Test Game',
          visibility: 'PUBLIC',
          gmPlayerId: 'gm-1',
          version: 1,
        },
      ]),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    );

    const gameRow = (await screen.findByText('Test Game')).closest('[role="row"]');
    expect(gameRow).toBeTruthy();
    expect(within(gameRow as HTMLElement).queryByText('7499f10c-ff0e-4dc1-a9cd-f34bc5668cea')).toBeNull();
  });
});
