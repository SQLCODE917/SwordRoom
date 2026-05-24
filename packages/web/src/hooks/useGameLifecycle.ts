import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, type GameplayLifecycle } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { deriveGameplayPhaseGate } from '../features/gameplay-lifecycle/phaseGate';
import { logWebFlow, summarizeError } from '../logging/flowLog';

const defaultPollingIntervalMs = 3000;

export type GameLifecyclePolling = 'none' | 'live-only';

export function useGameLifecycle(
  gameId: string,
  options?: {
    poll?: GameLifecyclePolling;
    pollingIntervalMs?: number;
  }
): {
  lifecycle: GameplayLifecycle | null;
  initialLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const poll = options?.poll ?? 'none';
  const pollingIntervalMs = options?.pollingIntervalMs ?? defaultPollingIntervalMs;
  const [lifecycle, setLifecycle] = useState<GameplayLifecycle | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const phaseGate = deriveGameplayPhaseGate(lifecycle);

  const load = useCallback(
    async (input?: { background?: boolean }) => {
      const background = input?.background ?? false;
      const shouldShowInitialLoading = !background && !hasLoadedRef.current;
      if (shouldShowInitialLoading) {
        setInitialLoading(true);
      }

      logWebFlow('WEB_GAME_LIFECYCLE_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        background,
      });

      try {
        const next = await api.getGameplayLifecycle(gameId);
        setLifecycle(next);
        setError(null);
        hasLoadedRef.current = true;
        logWebFlow('WEB_GAME_LIFECYCLE_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          background,
          phase: next.phase,
          hasGameplaySession: next.hasGameplaySession,
        });
      } catch (loadError) {
        if (!hasLoadedRef.current) {
          setLifecycle(null);
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_GAME_LIFECYCLE_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          background,
          ...summarizeError(loadError),
        });
      } finally {
        if (shouldShowInitialLoading) {
          setInitialLoading(false);
        }
      }
    },
    [api, auth.actorId, auth.mode, gameId]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await load();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (poll === 'none') {
      return;
    }

    if (poll === 'live-only' && !phaseGate.isLive) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        if (!cancelled) {
          await load({ background: true });
        }
      })();
    }, pollingIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [load, phaseGate.isLive, poll, pollingIntervalMs]);

  return {
    lifecycle,
    initialLoading,
    error,
    refresh: useCallback(async () => {
      await load();
    }, [load]),
  };
}
