import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { GMInboxPage } from './GMInboxPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', () => ({
  createCommandId: () => 'cmd-1',
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
    actorId: 'gm-1',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'gm-1' }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('GMInboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
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
      submitEnvelopeAndAwait: vi.fn(),
    });
  });

  it('renders pending reviews and invite activity as compact lists', async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getGmInbox: vi.fn(async () => [
        {
          promptId: 'pending-1',
          gameId: 'game-1',
          kind: 'PENDING_CHARACTER',
          ref: {
            characterId: 'char-1',
            playerId: 'player-1',
          },
          ownerPlayerId: 'player-1',
          message: 'Character is pending review.',
          createdAt: '2026-03-01T09:00:00.000Z',
          submittedAt: '2026-03-01T09:05:00.000Z',
        },
        {
          promptId: 'invite-1',
          gameId: 'game-1',
          kind: 'GAME_INVITE_ACCEPTED',
          ref: {
            inviteId: 'invite-1',
            playerId: 'player-2',
          },
          ownerPlayerId: 'player-2',
          message: 'player-2 accepted the invite.',
          createdAt: '2026-03-01T09:10:00.000Z',
          submittedAt: null,
        },
      ]),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GMInboxPage gameId="game-1" />
      </MemoryRouter>
    );

    const reviews = await screen.findByRole('list', { name: 'GM Pending Characters' });
    expect(within(reviews).getByText('char-1')).toBeTruthy();
    expect(within(reviews).getByText(/player-1/)).toBeTruthy();
    expect(within(reviews).getByRole('link', { name: 'Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
    expect(within(reviews).getByRole('button', { name: 'Approve' })).toBeTruthy();
    expect(within(reviews).getByRole('button', { name: 'Reject' })).toBeTruthy();

    const activity = screen.getByRole('list', { name: 'GM invite activity' });
    expect(within(activity).getByText('Game Invite Accepted')).toBeTruthy();
    expect(within(activity).getByText('player-2 accepted the invite.')).toBeTruthy();

    expect(screen.queryByRole('table', { name: 'GM Pending Characters' })).toBeNull();
    expect(screen.queryByRole('table', { name: 'GM invite activity' })).toBeNull();
  });

  it('keeps empty GM inbox states compact', async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getGmInbox: vi.fn(async () => []),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GMInboxPage gameId="game-1" />
      </MemoryRouter>
    );

    const reviews = await screen.findByRole('list', { name: 'GM Pending Characters' });
    expect(within(reviews).getByText('No pending characters.')).toBeTruthy();

    const activity = screen.getByRole('list', { name: 'GM invite activity' });
    expect(within(activity).getByText('No invite activity yet.')).toBeTruthy();
  });
});
