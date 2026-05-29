import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createApiClient,
  type GameItem,
  type PregameDigestEntry,
} from '../api/ApiClient';
import {
  type AuthProvider,
  useAuthProvider,
} from '../auth/AuthProvider';
import { useMyProfile } from '../hooks/useMyProfile';
import { HomePage } from './HomePage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
  notifyAuthStateChanged: vi.fn(),
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
    withActor: <T extends Record<string, unknown>>(body: T) => ({
      ...body,
      bypassActorId: 'player-aaa',
    }),
    login: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    register: vi.fn(async () => ({ ok: true, redirectTo: '/' })),
    logout: vi.fn(async () => ({ ok: true, redirectTo: '/login' })),
    clearError: vi.fn(),
  };
}

function createApiClientMock(
  overrides?: Partial<ReturnType<typeof createApiClient>>,
): ReturnType<typeof createApiClient> {
  return {
    getMyCharacters: vi.fn(async () => []),
    getMyGames: vi.fn(async () => []),
    getGmGames: vi.fn(async () => []),
    getPublicGames: vi.fn(async () => []),
    getMyPregameDigest: vi.fn(async () => []),
    getGameplayLifecycle: vi.fn(async () => ({
      gameId: 'game-default',
      phase: 'PREGAME',
      hasGameplaySession: false,
    })),
    ...overrides,
  } as unknown as ReturnType<typeof createApiClient>;
}

function openRowMoreActions(row: HTMLElement): void {
  const summary = within(row).queryByText('More Actions');
  if (summary) {
    fireEvent.click(summary);
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
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
    vi.mocked(createApiClient).mockReturnValue(createApiClientMock());

    render(
      <MemoryRouter
        initialEntries={['/?tab=my-games']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HomePage />
      </MemoryRouter>,
    );

    const myGamesSection = await screen.findByLabelText('My Games section');
    const createGameLink = within(myGamesSection).getByRole('link', {
      name: '+ Create Game',
    });
    expect(createGameLink.getAttribute('href')).toBe('/gm/games');
  });

  it('shows loading placeholders in stable table regions while dashboard data is loading', () => {
    const pending = new Promise<never>(() => undefined);
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(useMyProfile).mockReturnValue({
      profile: {
        playerId: 'player-aaa',
        displayName: 'Local Player',
        email: 'player@example.com',
        roles: ['PLAYER'],
      },
      loading: true,
      error: null,
    });
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyCharacters: vi.fn(async () => pending),
        getMyGames: vi.fn(async () => pending),
        getGmGames: vi.fn(async () => pending),
        getPublicGames: vi.fn(async () => pending),
        getMyPregameDigest: vi.fn(async () => pending),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Next Move')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'My Games' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Public Games' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Your Characters' })).toBeTruthy();
    expect(screen.getAllByText('Loading games...').length).toBeGreaterThan(0);
  });

  it('defaults to Public Games when the player is not in any games', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(createApiClientMock());

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    const publicGamesTab = await screen.findByRole('tab', { name: 'Public Games' });
    expect(publicGamesTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('table', { name: 'Public Games' })).toBeTruthy();
  });

  it('defaults to My Games when the player is in a game', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-1',
            name: 'Game One',
            visibility: 'PUBLIC',
            gmPlayerId: 'gm-zzz',
            version: 1,
          },
        ]),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    const myGamesTab = await screen.findByRole('tab', { name: 'My Games' });
    expect(myGamesTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('table', { name: 'My Games' })).toBeTruthy();
  });

  it('honors a deep link to Your Characters', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(createApiClientMock());

    render(
      <MemoryRouter
        initialEntries={['/?tab=your-characters']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HomePage />
      </MemoryRouter>,
    );

    const charactersTab = await screen.findByRole('tab', {
      name: 'Your Characters',
    });
    expect(charactersTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('table', { name: 'Your Characters' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Character' }).getAttribute('href')).toBe(
      '/player/player-aaa/character/new',
    );
  });

  it('keeps debug-only profile errors out of the main Home surface', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(createAuth());
    vi.mocked(useMyProfile).mockReturnValue({
      profile: null,
      loading: false,
      error: 'Profile load failed.',
    });
    vi.mocked(createApiClient).mockReturnValue(createApiClientMock());

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Next Move')).toBeTruthy();
    expect(screen.queryByText('Profile load failed.')).toBeNull();
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
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
      }),
    );

    render(
      <MemoryRouter
        initialEntries={['/?tab=your-characters']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HomePage />
      </MemoryRouter>,
    );

    const row = (await screen.findByText('Test Hero')).closest('tr');
    expect(row).toBeTruthy();
    const sheetLink = within(row as HTMLElement).getByRole('link', {
      name: 'Sheet',
    });
    openRowMoreActions(row as HTMLElement);
    const editLink = within(row as HTMLElement).getByRole('link', {
      name: 'Edit',
    });

    expect(sheetLink.getAttribute('href')).toBe('/player/player-aaa/characters/char-1');
    expect(sheetLink.className).toContain('c-btn');
    expect(editLink.className).toContain('c-btn');
  });

  it('shows Leave Game for non-library characters only', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyCharacters: vi.fn(async () => [
          {
            gameId: 'game-1',
            characterId: 'char-game',
            ownerPlayerId: 'player-aaa',
            status: 'APPROVED',
            draft: {
              identity: { name: 'Game Hero' },
            },
          },
          {
            gameId: 'PLAYER_CHARACTER_LIBRARY::player-aaa',
            characterId: 'char-library',
            ownerPlayerId: 'player-aaa',
            status: 'DRAFT',
            draft: {
              identity: { name: 'Library Hero' },
            },
          },
        ]),
      }),
    );

    render(
      <MemoryRouter
        initialEntries={['/?tab=your-characters']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HomePage />
      </MemoryRouter>,
    );

    const gameRow = (await screen.findByText('Game Hero')).closest('tr');
    const libraryRow = screen.getByText('Library Hero').closest('tr');
    expect(gameRow).toBeTruthy();
    expect(libraryRow).toBeTruthy();

    openRowMoreActions(gameRow as HTMLElement);
    openRowMoreActions(libraryRow as HTMLElement);

    expect(
      within(gameRow as HTMLElement).getByRole('button', { name: 'Leave Game' }),
    ).toBeTruthy();
    expect(
      within(libraryRow as HTMLElement).queryByRole('button', {
        name: 'Leave Game',
      }),
    ).toBeNull();
  });

  it('shows game status inline and keeps game actions visible in My Games rows', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-1',
            name: 'Game One',
            visibility: 'PUBLIC',
            gmPlayerId: 'gm-zzz',
            version: 1,
          },
        ]),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    const row = (await screen.findByText('Game One')).closest('tr');
    expect(row).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Visibility' })).toBeNull();
    expect(within(row as HTMLElement).getByText('PUBLIC')).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('link', { name: 'Open Lobby' })).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('link', { name: 'Chat' })).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('link', { name: 'Inbox' })).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('link', { name: 'Play' })).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('More Actions')).toBeNull();
  });

  it('disables Create Character on joined games where the player already has a character', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyCharacters: vi.fn(async () => [
          {
            gameId: 'game-1',
            characterId: 'char-game',
            ownerPlayerId: 'player-aaa',
            status: 'APPROVED',
            draft: {
              identity: { name: 'Game Hero' },
            },
          },
        ]),
        getMyGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-1',
            name: 'Game One',
            visibility: 'PUBLIC',
            gmPlayerId: 'gm-zzz',
            version: 1,
          },
        ]),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    const gameRow = (await screen.findByText('Game One')).closest('tr');
    expect(gameRow).toBeTruthy();
    openRowMoreActions(gameRow as HTMLElement);

    const newCharacterControl = within(gameRow as HTMLElement).getByRole('link', {
      name: '+ Create Character',
    });
    expect(newCharacterControl.getAttribute('aria-disabled')).toBe('true');
    expect(newCharacterControl.getAttribute('title')).toBe(
      'You already have a character in this game.',
    );
  });

  it('shows a destructive Delete button on GM-manageable games in My Games', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyCharacters: vi.fn(async () => []),
        getMyGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-gm',
            name: 'GM Game',
            visibility: 'PRIVATE',
            gmPlayerId: 'player-aaa',
            version: 3,
          },
        ]),
        getGmGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-gm',
            name: 'GM Game',
            visibility: 'PRIVATE',
            gmPlayerId: 'player-aaa',
            version: 3,
          },
        ]),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    const gameRow = (await screen.findByText('GM Game')).closest('tr');
    expect(gameRow).toBeTruthy();
    openRowMoreActions(gameRow as HTMLElement);
    const deleteButton = within(gameRow as HTMLElement).getByRole('button', {
      name: 'Delete',
    });
    expect(deleteButton.className).toContain('c-btn--destructive');
  });

  it('uses Continue Play as the dominant action when lifecycle is live', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-live',
            name: 'Live Game',
            visibility: 'PUBLIC',
            gmPlayerId: 'gm-zzz',
            version: 1,
          },
        ]),
        getGameplayLifecycle: vi.fn(async () => ({
          gameId: 'game-live',
          phase: 'LIVE' as const,
          hasGameplaySession: true,
        })),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    const row = (await screen.findByText('Live Game')).closest('tr');
    expect(row).toBeTruthy();
    expect(
      within(row as HTMLElement).getByRole('link', { name: 'Continue Play' }).getAttribute('href'),
    ).toBe('/games/game-live/play');
  });

  it('prioritizes resume planning when a pregame digest entry exists', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getMyPregameDigest: vi.fn(async (): Promise<PregameDigestEntry[]> => [
          {
            digestId: 'game-1:edit',
            gameId: 'game-1',
            gameName: 'Goblin Cave',
            headline: 'Party needs Frontline',
            detail: 'Your draft can still move toward Frontline.',
            destination: 'EDIT_CHARACTER',
            characterId: 'char-1',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ]),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Continue in Goblin Cave')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Edit Draft' }).getAttribute('href'),
    ).toBe('/games/game-1/characters/char-1/edit?entry=digest&focus=resume');
  });

  it('shows join, start, and create-first actions for phone-style quick entry', async () => {
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
    vi.mocked(createApiClient).mockReturnValue(
      createApiClientMock({
        getPublicGames: vi.fn(async (): Promise<GameItem[]> => [
          {
            gameId: 'game-public',
            name: 'Goblin Cave',
            visibility: 'PUBLIC',
            gmPlayerId: 'gm-1',
            version: 1,
          },
        ]),
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Goblin Cave is open')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: '+ Create Character' }).getAttribute('href'),
    ).toBe('/games/game-public/character/new?entry=home&focus=start');

    const nextMovePanel = screen.getByLabelText('Next Move');
    const savedCharacterLink = within(nextMovePanel).getByRole('link', {
      name: 'Saved Character',
    });
    expect(savedCharacterLink.getAttribute('aria-disabled')).toBe('true');
    expect(savedCharacterLink.getAttribute('title')).toBe('No saved characters yet.');
    expect(
      within(nextMovePanel).queryByRole('link', { name: '+ Create Game' }),
    ).toBeNull();
    expect(screen.queryByText('Other Paths')).toBeNull();
  });
});
