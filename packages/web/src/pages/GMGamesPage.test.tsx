import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-aaa' }),
  };
}

describe('GMGamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows GM Inbox after creating a first game', async () => {
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
      <MemoryRouter>
        <GMGamesPage />
      </MemoryRouter>
    );

    await screen.findByText('No GM games yet.');

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Fresh Game' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Game' }));

    await waitFor(() =>
      expect(submitEnvelopeAndAwait).toHaveBeenCalledWith(
        'Create game',
        expect.objectContaining({
          type: 'CreateGame',
          payload: { name: 'Fresh Game' },
        })
      )
    );

    expect(await screen.findByRole('link', { name: 'GM Inbox' })).toBeTruthy();
    expect(vi.mocked(notifyAuthStateChanged)).toHaveBeenCalledTimes(1);
  });
});
