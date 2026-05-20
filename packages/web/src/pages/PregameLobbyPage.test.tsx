import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { PregameLobbyPage } from './PregameLobbyPage';

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

describe('PregameLobbyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders the game-scoped planning view with lobby actions, roster, and recent activity', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => ({
        gameId: 'game-1',
        name: 'Dungeon Delvers',
        visibility: 'PUBLIC',
        gmPlayerId: 'gm-1',
        version: 1,
      })),
      getGameActorContext: vi.fn(async () => ({
        actorId: 'player-1',
        displayName: 'Borin',
        roles: ['PLAYER'],
        gmPlayerId: 'gm-1',
        isGameMaster: false,
      })),
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
          { playerId: 'player-2', displayName: 'Alice', role: 'PLAYER', characterId: null },
        ],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'gm-1',
            senderDisplayName: '@Zed GM',
            senderRole: 'GM',
            senderCharacterId: null,
            body: 'We still need a frontline character.',
            createdAt: '2026-03-01T09:15:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
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
          { role: 'HEALER', label: 'Healer', isOpen: false, claimedBy: ['Borin Stonehand'] },
          { role: 'SCOUT', label: 'Scout', isOpen: true, claimedBy: [] },
          { role: 'ARCANE', label: 'Arcane Support', isOpen: true, claimedBy: [] },
        ],
        recentClaims: [],
      })),
      getMyCharacters: vi.fn(async () => [
        {
          gameId: 'game-1',
          characterId: 'char-1',
          ownerPlayerId: 'player-1',
          status: 'DRAFT',
          draft: {
            identity: { name: 'Borin Stonehand' },
          },
        },
      ]),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter initialEntries={['/games/game-1']}>
        <Routes>
          <Route path="/games/:gameId" element={<PregameLobbyPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Pregame Lobby' })).toBeTruthy();
    expect(screen.getByText('Dungeon Delvers (game-1)')).toBeTruthy();
    const workflow = screen.getByRole('navigation', { name: 'Pregame workflow' });
    expect(within(workflow).getByRole('link', { name: 'Create' }).getAttribute('href')).toBe('/games/game-1/characters/char-1/edit');
    expect(within(workflow).getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe('/games/game-1/chat');
    expect(within(workflow).getByRole('link', { name: 'Characters' }).getAttribute('href')).toBe('/games/game-1/characters');
    expect(screen.getByRole('link', { name: 'Continue Character' }).getAttribute('href')).toBe('/games/game-1/characters/char-1/edit');
    expect(screen.getByRole('link', { name: 'Character Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
    expect(screen.getByRole('link', { name: 'Player Inbox' }).getAttribute('href')).toBe('/me/inbox');
    expect(screen.getByText('Your current character is Borin Stonehand (DRAFT).')).toBeTruthy();
    expect(screen.getByText('One player still needs a character before the party is fully represented.')).toBeTruthy();
    expect(screen.getByText('We still need Frontline. Please share a draft if you can cover it.')).toBeTruthy();
    expect(screen.getByText('Frontline: open')).toBeTruthy();
    expect(screen.getByText('Healer: claimed by Borin Stonehand')).toBeTruthy();

    const roster = screen.getByRole('table', { name: 'Pregame party roster' });
    expect(within(roster).getByText('@Zed GM')).toBeTruthy();
    expect(within(roster).getByRole('link', { name: 'Open Borin Stonehand' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
    expect(within(roster).getAllByText('No character yet')).toHaveLength(2);

    const activity = screen.getByRole('table', { name: 'Pregame recent activity' });
    expect(within(activity).getByText('@Zed GM')).toBeTruthy();
    expect(within(activity).getByText('We still need a frontline character.')).toBeTruthy();
  });

  it('renders a recoverable error state when the lobby context fails to load', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(createApiClient).mockReturnValue({
      getGame: vi.fn(async () => {
        throw new Error('Forbidden');
      }),
      getGameActorContext: vi.fn(async () => ({
        actorId: 'player-1',
        displayName: 'Borin',
        roles: ['PLAYER'],
        gmPlayerId: 'gm-1',
        isGameMaster: false,
      })),
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [],
        messages: [],
      })),
      getPregamePlanning: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        viewer: {
          isMember: false,
          isGameMaster: false,
        },
        activePrompt: null,
        partyNeeds: [],
        recentClaims: [],
      })),
      getMyCharacters: vi.fn(async () => []),
    } as unknown as ReturnType<typeof createApiClient>);

    render(
      <MemoryRouter initialEntries={['/games/game-1']}>
        <Routes>
          <Route path="/games/:gameId" element={<PregameLobbyPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Forbidden')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('table', { name: 'Pregame party roster' })).toBeNull();
  });
});
