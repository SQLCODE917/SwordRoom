import { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, type GameplayView } from '../api/ApiClient';
import { AuthProviderContext, type AuthProvider } from '../auth/AuthProvider';
import type { GameLifecycleUiState } from '../features/gameplay-lifecycle/lifecycleUiState';
import { useGameLifecycle } from './useGameLifecycle';
import { useGameplayView } from './useGameplayView';

const getPlayerGameplayView = vi.fn();
const getGmGameplayView = vi.fn();
const refreshLifecycle = vi.fn(async () => undefined);
const testAuthProvider = createAuthProvider();

vi.mock('../api/ApiClient', () => ({
  createApiClient: vi.fn(),
}));

vi.mock('./useGameLifecycle', () => ({
  useGameLifecycle: vi.fn(),
}));

vi.mock('../logging/flowLog', () => ({
  logWebFlow: vi.fn(),
  summarizeError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

interface MockLifecycleState {
  lifecycle: {
    gameId: string;
    phase: 'PREGAME' | 'LIVE';
    hasGameplaySession: boolean;
  } | null;
  initialLoading: boolean;
  error: string | null;
  state: GameLifecycleUiState;
}

describe('useGameplayView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createApiClient).mockReturnValue({
      getPlayerGameplayView,
      getGmGameplayView,
    } as unknown as ReturnType<typeof createApiClient>);
  });

  it('does not fetch gameplay while lifecycle is pregame', async () => {
    const lifecycleSnapshot: MockLifecycleState = {
      lifecycle: { gameId: 'game-1', phase: 'PREGAME', hasGameplaySession: false },
      initialLoading: false,
      error: null,
      state: {
        kind: 'pregame',
        phase: 'PREGAME',
        shouldLoadGameplay: false,
        shouldPollGameplay: false,
        errorMessage: null,
      },
    };

    vi.mocked(useGameLifecycle).mockImplementation(() => ({
      ...lifecycleSnapshot,
      refresh: refreshLifecycle,
    }));

    const { result } = renderHook(() => useGameplayView('game-1', 'PLAYER'), {
      wrapper: AuthWrapper,
    });

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(getPlayerGameplayView).not.toHaveBeenCalled();
    expect(result.current.gameplay).toBeNull();
  });

  it('fetches gameplay after lifecycle transitions from pregame to live', async () => {
    const lifecycleSnapshot: MockLifecycleState = {
      lifecycle: { gameId: 'game-1', phase: 'PREGAME', hasGameplaySession: false },
      initialLoading: false,
      error: null,
      state: {
        kind: 'pregame',
        phase: 'PREGAME',
        shouldLoadGameplay: false,
        shouldPollGameplay: false,
        errorMessage: null,
      },
    };

    const gameplayFixture = {
      gameId: 'game-1',
      gameName: 'Local Demo Game',
      view: 'PLAYER',
      graph: {
        nodes: [],
        edges: [],
      },
      participants: [],
      session: {
        sessionId: 'session-1',
        scenarioId: 'rpg_sample_tavern',
        graphVersion: 1,
        currentNodeId: 'SCENE_FRAME',
        status: 'ACTIVE',
        sceneTitle: 'Tavern At Sundown',
        sceneSummary: 'A crowded tavern with rising tension.',
        focusPrompt: 'Who breaks the standoff first?',
        selectedProcedure: null,
        pendingIntentId: null,
        activeCheck: null,
        combatants: [],
        combat: null,
        updatedAt: '2026-05-25T00:00:00.000Z',
        version: 1,
      },
      publicEvents: [],
      gmOnlyEvents: [],
    } as unknown as GameplayView;

    getPlayerGameplayView.mockResolvedValue(gameplayFixture);

    vi.mocked(useGameLifecycle).mockImplementation(() => ({
      ...lifecycleSnapshot,
      refresh: refreshLifecycle,
    }));

    const { result, rerender } = renderHook(
      ({ view }) => useGameplayView('game-1', view),
      {
        initialProps: { view: 'PLAYER' as const },
        wrapper: AuthWrapper,
      }
    );

    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(getPlayerGameplayView).toHaveBeenCalledTimes(0);

    lifecycleSnapshot.lifecycle = { gameId: 'game-1', phase: 'LIVE', hasGameplaySession: true };
    lifecycleSnapshot.state = {
      kind: 'live',
      phase: 'LIVE',
      shouldLoadGameplay: true,
      shouldPollGameplay: true,
      errorMessage: null,
    };

    rerender({ view: 'PLAYER' });

    await waitFor(() => expect(getPlayerGameplayView).toHaveBeenCalledTimes(1));
    expect(result.current.gameplay?.gameId).toBe('game-1');
  });
});

function AuthWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProviderContext.Provider value={testAuthProvider}>
      {children}
    </AuthProviderContext.Provider>
  );
}

function createAuthProvider(): AuthProvider {
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
