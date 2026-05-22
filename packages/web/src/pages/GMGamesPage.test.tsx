import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { notifyAuthStateChanged, useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { GMGamesPage } from './GMGamesPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
  notifyAuthStateChanged: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', () => ({
  createCommandId: () => 'cmd-create',
  useCommandWorkflow: vi.fn(),
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('GMGamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a first game, notifies auth state, and opens the lobby', async () => {
    const getGmGames = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          gameId: 'game-new',
          name: 'Fresh Game',
          visibility: 'PRIVATE',
          gmPlayerId: 'player-aaa',
          version: 1,
        },
      ]);
    const submitEnvelopeAndAwait = vi.fn(async () => ({
      commandId: 'cmd-create',
      status: 'PROCESSED' as const,
      errorCode: null,
      errorMessage: null,
    }));

    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getGmGames,
    } as unknown as ReturnType<typeof createApiClient>);
    vi.mocked(useCommandWorkflow).mockReturnValue({
      status: {
        state: 'Idle',
        commandId: null,
        message: 'No command submitted yet.',
        errorCode: null,
        errorMessage: null,
      },
      isRunning: false,
      resetStatus: vi.fn(),
      submitAndAwait: vi.fn(),
      submitEnvelopeAndAwait,
    });

    render(
      <MemoryRouter initialEntries={['/gm/games']}>
        <GMGamesPage />
        <LocationProbe />
      </MemoryRouter>
    );

    await screen.findByText('No GM games yet.');

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Fresh Game' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Game and Open Lobby' }));

    await waitFor(() =>
      expect(submitEnvelopeAndAwait).toHaveBeenCalledWith(
        'Create game',
        expect.objectContaining({
          type: 'CreateGame',
          payload: { name: 'Fresh Game' },
        })
      )
    );

    expect((await screen.findByTestId('location')).textContent).toBe('/games/game-new');
    expect(vi.mocked(notifyAuthStateChanged)).toHaveBeenCalledTimes(1);
  });

  it('submits ArchiveGame and removes the row after deleting a game', async () => {
    const getGmGames = vi
      .fn()
      .mockResolvedValueOnce([
        {
          gameId: 'game-delete',
          name: 'Delete Me',
          visibility: 'PRIVATE',
          gmPlayerId: 'player-aaa',
          version: 3,
        },
      ])
      .mockResolvedValueOnce([]);
    const submitEnvelopeAndAwait = vi.fn(async () => ({
      commandId: 'cmd-create',
      status: 'PROCESSED' as const,
      errorCode: null,
      errorMessage: null,
    }));

    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getGmGames,
    } as unknown as ReturnType<typeof createApiClient>);
    vi.mocked(useCommandWorkflow).mockReturnValue({
      status: {
        state: 'Idle',
        commandId: null,
        message: 'No command submitted yet.',
        errorCode: null,
        errorMessage: null,
      },
      isRunning: false,
      resetStatus: vi.fn(),
      submitAndAwait: vi.fn(),
      submitEnvelopeAndAwait,
    });

    render(
      <MemoryRouter>
        <GMGamesPage />
      </MemoryRouter>
    );

    const row = await screen.findByText('Delete Me');
    expect(row).toBeTruthy();

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton.className).toContain('c-btn--destructive');
    fireEvent.click(deleteButton);

    await waitFor(() =>
      expect(submitEnvelopeAndAwait).toHaveBeenCalledWith(
        'Delete game',
        expect.objectContaining({
          type: 'ArchiveGame',
          gameId: 'game-delete',
          payload: {
            gameId: 'game-delete',
            expectedVersion: 3,
          },
        })
      )
    );

    await screen.findByText('No GM games yet.');
    expect(screen.queryByText('Delete Me')).toBeNull();
    expect(vi.mocked(notifyAuthStateChanged)).toHaveBeenCalledTimes(1);
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Delete "Delete Me"? Players will be notified and the game will disappear from active lists.'
    );
  });
});
