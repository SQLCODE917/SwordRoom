import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { PlayerInboxPage } from './PlayerInboxPage';

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

vi.mock('../hooks/useGmGames', () => ({
  useGmGames: () => ({
    games: [],
    loading: false,
    error: null,
  }),
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
    actorId: 'player-1',
    isAuthenticated: true,
    pendingAction: null,
    errorMessage: null,
    withAuthHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers ?? {})),
    withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

describe('PlayerInboxPage', () => {
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

  it('renders pregame digest re-entry links alongside compact inbox items', async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getMyInbox: vi.fn(async () => [
        {
          kind: 'CHAR_APPROVED',
          message: 'Your character was approved.',
          createdAt: '2026-03-01T09:10:00.000Z',
          gameId: 'game-1',
          promptId: 'approved-1',
          ref: {
            characterId: 'char-1',
          },
        },
      ]),
      getMyPregameDigest: vi.fn(async () => [
        {
          digestId: 'game-1:edit',
          gameId: 'game-1',
          gameName: 'Dungeon Delvers',
          headline: 'Party needs Frontline',
          detail: 'Your draft can still move toward Frontline, Healer, Scout, Arcane Support.',
          destination: 'EDIT_CHARACTER',
          characterId: 'char-1',
          createdAt: '2026-03-01T09:15:00.000Z',
        },
        {
          digestId: 'game-2:chat',
          gameId: 'game-2',
          gameName: 'Forest Watch',
          headline: 'Asha updated party roles',
          detail: 'Asha claimed Healer.',
          destination: 'CHAT',
          characterId: null,
          createdAt: '2026-03-01T09:16:00.000Z',
        },
      ]),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PlayerInboxPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole('heading', { name: 'Resume Planning' })).toBeNull();

    const nextMovePanel = (await screen.findByRole('heading', { name: 'Next Move' })).closest('section');
    expect(nextMovePanel).toBeTruthy();
    expect(within(nextMovePanel as HTMLElement).getByText('Dungeon Delvers')).toBeTruthy();
    expect(within(nextMovePanel as HTMLElement).getByRole('link', { name: 'Edit Draft' }).getAttribute('href')).toBe(
      '/games/game-1/characters/char-1/edit?entry=digest&focus=resume'
    );
    expect(within(nextMovePanel as HTMLElement).getByText(/Forest Watch - Asha updated party roles/)).toBeTruthy();
    expect(within(nextMovePanel as HTMLElement).getByRole('link', { name: 'Open Chat' }).getAttribute('href')).toBe('/games/game-2/chat');

    const digestList = await screen.findByRole('list', { name: 'Pregame Digest Items' });
    expect(within(digestList).queryByText('Dungeon Delvers')).toBeNull();
    expect(within(digestList).getByText('Forest Watch')).toBeTruthy();
    expect(within(digestList).getByText('Asha updated party roles')).toBeTruthy();
    expect(within(digestList).getByRole('link', { name: 'Open Chat' }).getAttribute('href')).toBe('/games/game-2/chat');
    expect(screen.queryByRole('table', { name: 'Pregame Digest Items' })).toBeNull();

    const inboxList = screen.getByRole('list', { name: 'Player Inbox Items' });
    expect(within(inboxList).getByText('Char Approved')).toBeTruthy();
    expect(within(inboxList).getByRole('link', { name: 'Open Character' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
    expect(screen.queryByRole('table', { name: 'Player Inbox Items' })).toBeNull();
  });

  it('labels character creation actions consistently', async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getMyInbox: vi.fn(async () => []),
      getMyPregameDigest: vi.fn(async () => [
        {
          digestId: 'game-1:create',
          gameId: 'game-1',
          gameName: 'Dungeon Delvers',
          headline: 'Party needs Frontline',
          detail: 'Create a character draft and answer the current GM prompt.',
          destination: 'CREATE_CHARACTER',
          characterId: null,
          createdAt: '2026-03-01T09:15:00.000Z',
        },
      ]),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PlayerInboxPage />
      </MemoryRouter>
    );

    expect(
      (await screen.findAllByRole('link', { name: '+ Create Character' })).length,
    ).toBe(1);
    expect(screen.queryByRole('link', { name: 'Create Character' })).toBeNull();
  });
});
