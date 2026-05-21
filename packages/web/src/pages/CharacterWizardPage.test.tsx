import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { CharacterWizardPage } from './CharacterWizardPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', () => ({
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

describe('CharacterWizardPage', () => {
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

  it('allows a game-scoped draft route for a private invited game and shows planning focus', async () => {
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => ({
        gameId: 'game-private',
        name: 'Private Delve',
        visibility: 'PRIVATE',
        gmPlayerId: 'gm-1',
        version: 1,
      })),
      getMyCharacters: vi.fn(async () => []),
      getPregamePlanning: vi.fn(async () => ({
        gameId: 'game-private',
        gameName: 'Private Delve',
        viewer: {
          isMember: true,
          isGameMaster: false,
        },
        activePrompt: {
          promptId: 'prompt-1',
          title: 'Party needs Frontline',
          prompt: 'We still need Frontline. Please share a draft if you can cover it.',
          suggestedRoles: ['FRONTLINE'],
          senderDisplayName: '@Zed GM',
          createdAt: '2026-03-01T09:15:00.000Z',
        },
        partyNeeds: [
          { role: 'FRONTLINE', label: 'Frontline', isOpen: true, claimedBy: [] },
          { role: 'HEALER', label: 'Healer', isOpen: false, claimedBy: ['Mira'] },
          { role: 'SCOUT', label: 'Scout', isOpen: false, claimedBy: ['Tarn'] },
          { role: 'ARCANE', label: 'Arcane Support', isOpen: false, claimedBy: ['Iris'] },
        ],
        recentClaims: [],
      })),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter initialEntries={['/games/game-private/character/new?entry=lobby&focus=role']}>
        <Routes>
          <Route path="/games/:gameId/character/new" element={<CharacterWizardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Character Wizard' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Planning Focus' })).toBeTruthy();
    expect(screen.getByText('Draft toward Frontline')).toBeTruthy();
    expect(screen.getByText('Opened from Lobby so the game need stays visible while you draft.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back To Lobby' }).getAttribute('href')).toBe('/games/game-private');
    expect(screen.queryByText('Route validation failed.')).toBeNull();
    expect(screen.getByText(/Create or revise a character inside this game's pregame planning loop\./)).toBeTruthy();
  });
});
