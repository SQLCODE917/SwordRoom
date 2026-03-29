import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type GameItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export function useGmGames(): {
  games: GameItem[];
  loading: boolean;
  error: string | null;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!auth.isAuthenticated) {
        setGames([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextGames = await api.getGmGames();
        if (cancelled) {
          return;
        }
        setGames(nextGames);
        setError(null);
        logWebFlow('WEB_GM_GAMES_CONTEXT_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          count: nextGames.length,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setGames([]);
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_GM_GAMES_CONTEXT_LOAD_FAILED', {
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
  }, [api, auth.actorId, auth.isAuthenticated, auth.mode]);

  return {
    games,
    loading,
    error,
  };
}
