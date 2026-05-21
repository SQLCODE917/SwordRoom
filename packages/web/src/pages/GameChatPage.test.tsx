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

function createPregamePlanningResponse() {
  return {
    gameId: 'game-1',
    gameName: 'Dungeon Delvers',
    viewer: {
      isMember: true,
      isGameMaster: false,
    },
    activePrompt: {
      promptId: 'prompt-1',
      title: 'Party needs Frontline and Healer',
      prompt: 'We still need Frontline and Healer. Please share a draft if you can cover one of those roles.',
      suggestedRoles: ['FRONTLINE', 'HEALER'],
      senderDisplayName: '@Zed GM',
      createdAt: '2026-03-01T09:15:00.000Z',
    },
    partyNeeds: [
      { role: 'FRONTLINE', label: 'Frontline', isOpen: true, claimedBy: [] },
      { role: 'HEALER', label: 'Healer', isOpen: true, claimedBy: [] },
      { role: 'SCOUT', label: 'Scout', isOpen: false, claimedBy: ['Alice'] },
      { role: 'ARCANE', label: 'Arcane Support', isOpen: false, claimedBy: ['Borin'] },
    ],
    recentClaims: [],
  } as const;
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
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
    const workflow = screen.getByRole('navigation', { name: 'Pregame workflow' });
    expect(within(workflow).getByRole('link', { name: 'Lobby' }).getAttribute('href')).toBe('/games/game-1');
    expect(within(workflow).getByRole('link', { name: 'Characters' }).getAttribute('href')).toBe('/games/game-1/characters');
    expect(await screen.findByText('Open roles: Frontline, Healer')).toBeTruthy();
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
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
              shareIntent: 'ASK_QUESTION',
              contextNote: 'Should I trade damage for more party support?',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
          {
            messageId: 'msg-2',
            senderPlayerId: 'gm-1',
            senderDisplayName: '@Zed GM',
            senderRole: 'GM',
            senderCharacterId: null,
            body: 'Reaction: Party fit',
            artifact: {
              kind: 'CHARACTER_DRAFT_REACTION',
              targetMessageId: 'msg-1',
              characterId: 'char-1',
              snapshotVersion: 2,
              characterName: 'Borin',
              reaction: 'PARTY_FIT',
            },
            createdAt: '2026-03-01T09:17:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
    expect(screen.getByText('Share: Ask a question')).toBeTruthy();
    expect(screen.getByText('Should I trade damage for more party support?')).toBeTruthy();
    expect(screen.getByText('STR 16 | DEX 10 | MP 12')).toBeTruthy();
    expect(screen.getByText('Reactions: Party fit 1')).toBeTruthy();
    expect(screen.queryByText('Reaction: Party fit')).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open In Characters' }).getAttribute('href')).toBe('/games/game-1/characters?shared=msg-1');
    expect(screen.getByRole('link', { name: 'Open Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');
  });

  it('submits low-friction reaction artifacts for shared drafts', async () => {
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
              shareIntent: 'ASK_QUESTION',
              contextNote: 'Should I trade damage for more party support?',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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

    fireEvent.click(await screen.findByRole('button', { name: 'Party fit' }));

    await waitFor(() =>
      expect(submitEnvelopeAndAwait).toHaveBeenCalledWith(
        'React to shared draft',
        expect.objectContaining({
          gameId: 'game-1',
          type: 'SendGameChatMessage',
          payload: {
            body: 'Reaction: Party fit',
            artifact: {
              kind: 'CHARACTER_DRAFT_REACTION',
              targetMessageId: 'msg-1',
              characterId: 'char-1',
              snapshotVersion: 2,
              characterName: 'Borin',
              reaction: 'PARTY_FIT',
            },
          },
        })
      )
    );

    expect(await screen.findByText('Reactions: Party fit 1')).toBeTruthy();
  });

  it('renders compare-direction shares with their intent and note', async () => {
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
            body: 'Borin is comparing two build directions.',
            artifact: {
              kind: 'CHARACTER_DRAFT',
              characterId: 'char-1',
              snapshotVersion: 3,
              characterName: 'Borin',
              race: 'HUMAN',
              status: 'DRAFT',
              shareIntent: 'COMPARE_DIRECTIONS',
              contextNote: 'Option A keeps Fighter 1. Option B pivots to Priest 2.',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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

    expect(await screen.findByText('Borin is comparing two build directions.')).toBeTruthy();
    expect(screen.getByText('Share: Compare directions')).toBeTruthy();
    expect(screen.getByText('Option A keeps Fighter 1. Option B pivots to Priest 2.')).toBeTruthy();
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
              shareIntent: 'ASK_QUESTION',
              contextNote: 'Should I trade damage for more party support?',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
    expect(within(dialog).getByText('Share: Ask a question')).toBeTruthy();
    expect(within(dialog).getByText('Should I trade damage for more party support?')).toBeTruthy();
    expect(within(dialog).getByText('Reactions: No reactions yet')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Open Full Sheet' }).getAttribute('href')).toBe('/games/game-1/characters/char-1');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reply' }));

    expect(screen.queryByRole('dialog', { name: 'Character draft preview' })).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement).value).toBe('About Borin v2: ');
  });

  it('prefills the composer from the workbench discussion handoff', async () => {
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
        messages: [],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
      <MemoryRouter initialEntries={['/games/game-1/chat?draft=About%20Aline%20v3%3A%20']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Dungeon Delvers')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement).value).toBe('About Aline v3: ');
  });

  it('foregrounds the active shared draft when discussion is opened from the workbench', async () => {
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
              shareIntent: 'ASK_QUESTION',
              contextNote: 'Should I trade damage for more party support?',
              abilitySummary: ['STR 16', 'DEX 10', 'MP 12'],
              skillSummary: ['Fighter 1'],
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
      <MemoryRouter initialEntries={['/games/game-1/chat?artifact=msg-1&draft=About%20Borin%20v2%3A%20']}>
        <Routes>
          <Route path="/games/:gameId/chat" element={<GameChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('region', { name: 'Active draft discussion' })).toBeTruthy();
    expect(screen.getByText('Borin v2 is the current draft under discussion.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reply To Active Draft' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open In Characters' })[0]?.getAttribute('href')).toBe(
      '/games/game-1/characters?shared=msg-1'
    );
  });

  it('renders structured GM prompts and party role claims inside chat', async () => {
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
            senderPlayerId: 'gm-1',
            senderDisplayName: '@Zed GM',
            senderRole: 'GM',
            senderCharacterId: null,
            body: 'GM posted a new pregame planning prompt.',
            artifact: {
              kind: 'GAME_PROMPT',
              promptId: 'prompt-1',
              title: 'Party needs Frontline and Healer',
              prompt: 'We still need Frontline and Healer. Please share a draft if you can cover one of those roles.',
              suggestedRoles: ['FRONTLINE', 'HEALER'],
            },
            createdAt: '2026-03-01T09:15:00.000Z',
          },
          {
            messageId: 'msg-2',
            senderPlayerId: 'player-1',
            senderDisplayName: 'Borin',
            senderRole: 'PLAYER',
            senderCharacterId: 'char-1',
            body: 'Borin is claiming Frontline for the party.',
            artifact: {
              kind: 'PARTY_ROLE_CLAIM',
              claimId: 'claim-1',
              characterId: 'char-1',
              snapshotVersion: 4,
              characterName: 'Borin',
              roles: ['FRONTLINE'],
              note: 'Current plan is to cover Frontline.',
            },
            createdAt: '2026-03-01T09:16:00.000Z',
          },
        ],
      })),
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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

    expect(await screen.findByText('Party needs Frontline and Healer')).toBeTruthy();
    expect(screen.getByText('Suggested roles: Frontline and Healer')).toBeTruthy();
    expect(screen.getByText('Borin claims Frontline')).toBeTruthy();
    expect(screen.getByText('Current plan is to cover Frontline.')).toBeTruthy();
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
      getPregamePlanning: vi.fn(async () => createPregamePlanningResponse()),
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
