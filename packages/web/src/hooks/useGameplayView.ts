import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, type GameplayView } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../logging/flowLog';

const livePollingIntervalMs = 3000;

export function useGameplayView(
  gameId: string,
  view: 'PLAYER' | 'GM'
): {
  gameplay: GameplayView | null;
  initialLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [gameplay, setGameplay] = useState<GameplayView | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background ?? false;
      const shouldShowInitialLoading = !background && !hasLoadedRef.current;
      if (shouldShowInitialLoading) {
        setInitialLoading(true);
      }

      logWebFlow('WEB_GAMEPLAY_VIEW_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        view,
        background,
      });

      try {
        const next = view === 'GM' ? await api.getGmGameplayView(gameId) : await api.getPlayerGameplayView(gameId);
        setGameplay(next);
        setError(null);
        hasLoadedRef.current = true;
        logWebFlow('WEB_GAMEPLAY_VIEW_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          view,
          background,
          found: next !== null,
          currentNodeId: next?.session.currentNodeId ?? null,
        });
      } catch (loadError) {
        if (!hasLoadedRef.current) {
          setGameplay(null);
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
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
          setInitialLoading(false);
        }
      }
    },
    [api, auth.actorId, auth.mode, gameId, view]
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
    // Avoid repeated 404 polling noise when no gameplay session exists yet.
    if (!gameplay) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        if (!cancelled) {
          await load({ background: true });
        }
      })();
    }, livePollingIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [gameplay, load]);

  return {
    gameplay,
    initialLoading,
    error,
    refresh: useCallback(async () => {
      await load();
    }, [load]),
  };
}
