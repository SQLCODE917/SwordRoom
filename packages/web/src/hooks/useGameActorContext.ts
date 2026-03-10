import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type GameActorContextResponse } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../logging/flowLog';

const fallbackContext: GameActorContextResponse = {
  actorId: '',
  displayName: null,
  roles: [],
  gmPlayerId: null,
  isGameMaster: false,
};

export function useGameActorContext(gameId: string): {
  context: GameActorContextResponse;
  loading: boolean;
  error: string | null;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [context, setContext] = useState<GameActorContextResponse>(() => ({
    ...fallbackContext,
    actorId: auth.actorId,
    roles: auth.mode === 'dev' && auth.actorId === 'gm-zzz' ? ['PLAYER', 'GM'] : [],
    isGameMaster: auth.mode === 'dev' && auth.actorId === 'gm-zzz',
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!auth.isAuthenticated) {
        setContext({
          ...fallbackContext,
          actorId: '',
          roles: [],
          isGameMaster: false,
        });
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      logWebFlow('WEB_GAME_ACTOR_CONTEXT_LOAD_START', {
        gameId,
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      try {
        const next = await api.getGameActorContext(gameId);
        if (cancelled) {
          return;
        }
        setContext(next);
        setError(null);
        logWebFlow('WEB_GAME_ACTOR_CONTEXT_LOAD_OK', {
          gameId,
          actorId: next.actorId,
          roles: next.roles,
          isGameMaster: next.isGameMaster,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_GAME_ACTOR_CONTEXT_LOAD_FAILED', {
          gameId,
          actorId: auth.actorId,
          authMode: auth.mode,
          ...summarizeError(loadError),
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, auth.actorId, auth.isAuthenticated, auth.mode, gameId]);

  return {
    context,
    loading,
    error,
  };
}
