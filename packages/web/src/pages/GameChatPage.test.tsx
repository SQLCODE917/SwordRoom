import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type GameChatResponse } from '../api/ApiClient';
import { useAuthProvider, type AuthProvider } from '../auth/AuthProvider';
import { useCommandWorkflow } from '../hooks/useCommandStatus';
import { GameChatPage } from './GameChatPage';

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuthProvider: vi.fn(),
}));

vi.mock('../hooks/useCommandStatus', () => ({
  createCommandId: () => 'cmd-send',
  useCommandWorkflow: vi.fn(),
}));

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

function createAuth(overrides?: Partial<AuthProvider>): AuthProvider {
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
    ...overrides,
  };
}

describe('GameChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the IRC-style transcript and refreshes after sending a message', async () => {
    const getGameChat = vi
      .fn()
      .mockResolvedValueOnce({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
        ],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'gm-1',
            senderDisplayName: '@Zed GM',
            senderRole: 'GM',
            senderCharacterId: null,
            body: 'Session starts soon.',
            createdAt: '2026-03-01T09:15:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
        ],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'gm-1',
            senderDisplayName: '@Zed GM',
            senderRole: 'GM',
            senderCharacterId: null,
            body: 'Session starts soon.',
            createdAt: '2026-03-01T09:15:00.000Z',
          },
          {
            messageId: 'msg-2',
            senderPlayerId: 'player-1',
            senderDisplayName: 'Borin',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-1',
            body: 'Ready for the delve.',
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      });
    const submitEnvelopeAndAwait = vi.fn(async () => ({
      commandId: 'cmd-send',
      status: 'PROCESSED' as const,
      errorCode: null,
      errorMessage: null,
    }));

    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'player-1',
        withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
      })
    );
    vi.mocked(createApiClient).mockReturnValue({
      getGameChat,
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
      <MemoryRouter initialEntries={['/games/game-1/chat']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    const transcript = await screen.findByRole('log');
    expect(screen.getByText('Dungeon Delvers')).toBeTruthy();
    expect(screen.queryByText('Dungeon Delvers (game-1)')).toBeNull();
    expect(
      await within(transcript).findByText(
        (_, element) =>
          element?.classList.contains('c-chat__line') === true &&
          element.textContent === '[09:15] <@Zed GM> Session starts soon.'
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: '  Ready for the delve.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(submitEnvelopeAndAwait).toHaveBeenCalledWith(
        'Send chat message',
        expect.objectContaining({
          commandId: 'cmd-send',
          gameId: 'game-1',
          type: 'SendGameChatMessage',
          payload: {
            body: 'Ready for the delve.',
          },
        })
      )
    );
    expect(getGameChat).toHaveBeenCalledTimes(1);

    expect(
      await within(transcript).findByText(
        (_, element) =>
          element?.classList.contains('c-chat__line') === true &&
          element.textContent?.includes('<Borin> Ready for the delve.') === true
      )
    ).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement).value).toBe('');
  });

  it('shows the member list in GM-first alphabetical order inside the mobile sheet', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'player-1',
        withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
      })
    );
    vi.mocked(createApiClient).mockReturnValue({
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
          { playerId: 'player-2', displayName: 'Alice', role: 'PLAYER', characterId: 'char-2' },
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
        ],
        messages: [],
      })),
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
      submitEnvelopeAndAwait: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/games/game-1/chat']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Dungeon Delvers')).toBeTruthy();
    expect(screen.queryByText('Dungeon Delvers (game-1)')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Members (3)' }));

    const dialog = screen.getByRole('dialog', { name: 'Game chat members' });
    const memberNames = within(dialog)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.c-chat__member-name')?.textContent);

    expect(memberNames).toEqual(['@Zed GM', 'Alice', 'Borin']);
  });

  it('renders a shared character artifact as a richer chat card', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'player-1',
        withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
      })
    );
    vi.mocked(createApiClient).mockReturnValue({
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
        ],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'player-1',
            senderDisplayName: 'Borin',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-1',
            body: 'Sharing Borin for party feedback.',
            artifact: {
              kind: 'CHARACTER_DRAFT',
              characterId: 'char-1',
              snapshotVersion: 2,
              characterName: 'Borin',
              race: 'HUMAN',
              status: 'DRAFT',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
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
      submitEnvelopeAndAwait: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/games/game-1/chat']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Sharing Borin for party feedback.')).toBeTruthy();
    expect(screen.getByText('Borin (HUMAN) v2')).toBeTruthy();
    expect(screen.getByText('Status: DRAFT')).toBeTruthy();
    expect(screen.getByText('STR 16 | DEX 10 | MP 12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
  });

  it('opens a preview sheet for a shared character artifact and hands reply context to the composer', async () => {
    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'player-1',
        withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
      })
    );
    vi.mocked(createApiClient).mockReturnValue({
      getGameChat: vi.fn(async () => ({
        gameId: 'game-1',
        gameName: 'Dungeon Delvers',
        participants: [
          { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
          { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
        ],
        messages: [
          {
            messageId: 'msg-1',
            senderPlayerId: 'player-1',
            senderDisplayName: 'Borin',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-1',
            body: 'Sharing Borin for party feedback.',
            artifact: {
              kind: 'CHARACTER_DRAFT',
              characterId: 'char-1',
              snapshotVersion: 2,
              characterName: 'Borin',
              race: 'HUMAN',
              status: 'DRAFT',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
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
      submitEnvelopeAndAwait: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/games/game-1/chat']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));

    const dialog = screen.getByRole('dialog', { name: 'Character draft preview' });
    expect(within(dialog).getByText('Borin v2')).toBeTruthy();
    expect(within(dialog).getByText('Shared by Borin')).toBeTruthy();
    expect(within(dialog).getByText('HUMAN • DRAFT')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Open Full Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reply' }));

    expect(screen.queryByRole('dialog', { name: 'Character draft preview' })).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement).value).toBe('About Borin v2: ');
  });

  it('keeps the steady loaded state visible during background polling', async () => {
    let resolveRefresh!: (value: GameChatResponse) => void;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler) => {
      return 1 as unknown as number;
    }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation((() => undefined) as typeof window.clearInterval);

    const initialChat: GameChatResponse = {
      gameId: 'game-1',
      gameName: 'Dungeon Delvers',
      participants: [
        { playerId: 'gm-1', displayName: '@Zed GM', role: 'GM', characterId: null },
        { playerId: 'player-1', displayName: 'Borin', role: 'PLAYER', characterId: 'char-1' },
      ],
      messages: [
        {
          messageId: 'msg-1',
          senderPlayerId: 'gm-1',
          senderDisplayName: '@Zed GM',
          senderRole: 'GM',
          senderCharacterId: null,
          body: 'Session starts soon.',
          createdAt: '2026-03-01T09:15:00.000Z',
        },
      ],
    };

    const getGameChat = vi
      .fn()
      .mockResolvedValueOnce(initialChat)
      .mockImplementationOnce(
        () =>
          new Promise<GameChatResponse>((resolve) => {
            resolveRefresh = resolve;
          })
      );

    vi.mocked(useAuthProvider).mockReturnValue(
      createAuth({
        actorId: 'player-1',
        withActor: <T extends Record<string, unknown>>(body: T) => ({ ...body, bypassActorId: 'player-1' }),
      })
    );
    vi.mocked(createApiClient).mockReturnValue({
      getGameChat,
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
      submitEnvelopeAndAwait: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/games/game-1/chat']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('IRC-style table chat for current game members.')).toBeTruthy();
    expect(screen.getByText('Dungeon Delvers')).toBeTruthy();
    expect(screen.queryByText('Dungeon Delvers (game-1)')).toBeNull();
    expect(screen.queryByText('Loading chat...')).toBeNull();

    const chatIntervalCall = [...setIntervalSpy.mock.calls].reverse().find((call) => call[1] === 3000);
    expect(chatIntervalCall).toBeTruthy();
    const backgroundPoll = chatIntervalCall?.[0];
    expect(typeof backgroundPoll).toBe('function');

    await act(async () => {
      (backgroundPoll as () => void)();
    });

    await waitFor(() => expect(getGameChat).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Loading chat...')).toBeNull();
    expect(screen.getByText('IRC-style table chat for current game members.')).toBeTruthy();

    resolveRefresh(initialChat);
    await waitFor(() => expect(screen.getByText('IRC-style table chat for current game members.')).toBeTruthy());

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
