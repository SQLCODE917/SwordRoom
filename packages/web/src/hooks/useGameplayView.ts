import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, type GameplayLifecycle, type GameplayView } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { deriveGameLifecycleUiState, type GameLifecycleUiState } from '../features/gameplay-lifecycle/lifecycleUiState';
import { useGameLifecycle } from './useGameLifecycle';
import { logWebFlow, summarizeError } from '../logging/flowLog';

const livePollingIntervalMs = 3000;

export function useGameplayView(
  gameId: string,
  view: 'PLAYER' | 'GM'
): {
  gameplay: GameplayView | null;
  lifecycle: GameplayLifecycle | null;
  initialLoading: boolean;
  error: string | null;
  lifecycleState?: GameLifecycleUiState;
  refresh: () => Promise<void>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const lifecycleState = useGameLifecycle(gameId, {
    poll: 'live-only',
    pollingIntervalMs: livePollingIntervalMs,
  });
  const lifecycleUiState =
    lifecycleState.state ??
    deriveGameLifecycleUiState({
      initialLoading: lifecycleState.initialLoading,
      lifecycle: lifecycleState.lifecycle,
      error: lifecycleState.error,
    });
  const [gameplay, setGameplay] = useState<GameplayView | null>(null);
  const [gameplayInitialLoading, setGameplayInitialLoading] = useState(true);
  const [gameplayError, setGameplayError] = useState<string | null>(null);
  const hasLoadedGameplayRef = useRef(false);

  const loadGameplay = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background ?? false;
      const shouldShowInitialLoading = !background && !hasLoadedGameplayRef.current;
      if (shouldShowInitialLoading) {
        setGameplayInitialLoading(true);
      }

      logWebFlow('WEB_GAMEPLAY_VIEW_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        view,
        background,
      });

      try {
        if (!lifecycleUiState.shouldLoadGameplay) {
          setGameplay(null);
          setGameplayError(null);
          hasLoadedGameplayRef.current = true;
          return;
        }

        const next = view === 'GM' ? await api.getGmGameplayView(gameId) : await api.getPlayerGameplayView(gameId);
        setGameplay(next);
        setGameplayError(null);
        hasLoadedGameplayRef.current = true;
        logWebFlow('WEB_GAMEPLAY_VIEW_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          view,
          background,
          phase: lifecycleUiState.phase,
          hasGameplaySession: lifecycleState.lifecycle?.hasGameplaySession ?? false,
          found: next !== null,
          currentNodeId: next?.session.currentNodeId ?? null,
        });
      } catch (loadError) {
        if (!hasLoadedGameplayRef.current) {
          setGameplay(null);
        }
        setGameplayError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_GAMEPLAY_VIEW_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          view,
          background,
          ...summarizeError(loadError),
        });
      } finally {
        if (shouldShowInitialLoading) {
          setGameplayInitialLoading(false);
        }
      }
    },
    [api, auth.actorId, auth.mode, gameId, lifecycleState.lifecycle, lifecycleUiState.phase, lifecycleUiState.shouldLoadGameplay, view]
  );

  useEffect(() => {
    if (lifecycleState.initialLoading) {
      return;
    }

    if (!lifecycleUiState.shouldLoadGameplay) {
      setGameplay(null);
      setGameplayError(null);
      hasLoadedGameplayRef.current = true;
      setGameplayInitialLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await loadGameplay();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lifecycleState.initialLoading, lifecycleUiState.shouldLoadGameplay, loadGameplay]);

  useEffect(() => {
    if (!lifecycleUiState.shouldPollGameplay) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        if (!cancelled) {
          await loadGameplay({ background: true });
        }
      })();
    }, livePollingIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [lifecycleUiState.shouldPollGameplay, loadGameplay]);

  const initialLoading = lifecycleState.initialLoading || gameplayInitialLoading;
  const error = lifecycleState.error ?? gameplayError;

  return {
    gameplay,
    lifecycle: lifecycleState.lifecycle,
    initialLoading,
    error,
    lifecycleState: lifecycleUiState,
    refresh: useCallback(async () => {
      await lifecycleState.refresh();
      if (lifecycleUiState.shouldLoadGameplay) {
        await loadGameplay();
      } else {
        setGameplay(null);
      }
    }, [lifecycleState, lifecycleUiState.shouldLoadGameplay, loadGameplay]),
  };
}
