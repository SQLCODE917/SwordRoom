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

  it('renders pregame digest re-entry links alongside the inbox table', async () => {
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
      <MemoryRouter>
        <PlayerInboxPage />
      </MemoryRouter>
    );

    const resumePanel = (await screen.findByRole('heading', { name: 'Resume Planning' })).closest('section');
    expect(resumePanel).toBeTruthy();
    expect(within(resumePanel as HTMLElement).getByText('Resume planning in Dungeon Delvers')).toBeTruthy();
    expect(within(resumePanel as HTMLElement).getByRole('link', { name: 'Edit Draft' }).getAttribute('href')).toBe(
      '/games/game-1/characters/char-1/edit?entry=digest&focus=resume'
    );
    expect(within(resumePanel as HTMLElement).getByRole('link', { name: 'Open Chat: Forest Watch' }).getAttribute('href')).toBe(
      '/games/game-2/chat'
    );

    const digestTable = await screen.findByRole('table', { name: 'Pregame Digest Items' });
    expect(within(digestTable).getByText('Dungeon Delvers')).toBeTruthy();
    expect(within(digestTable).getByText('Party needs Frontline')).toBeTruthy();
    expect(within(digestTable).getByRole('link', { name: 'Edit Draft' }).getAttribute('href')).toBe(
      '/games/game-1/characters/char-1/edit?entry=digest&focus=resume'
    );
    expect(within(digestTable).getByRole('link', { name: 'Open Chat' }).getAttribute('href')).toBe('/games/game-2/chat');

    const inboxTable = screen.getByRole('table', { name: 'Player Inbox Items' });
    expect(within(inboxTable).getByText('CHAR_APPROVED')).toBeTruthy();
    expect(within(inboxTable).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
  });
});
