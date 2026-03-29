import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type PlayerProfile } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../logging/flowLog';

export function useMyProfile(): {
  profile: PlayerProfile | null;
  loading: boolean;
  error: string | null;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!auth.isAuthenticated) {
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      logWebFlow('WEB_PROFILE_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
      });
      try {
        const nextProfile = await api.getMyProfile();
        if (cancelled) {
          return;
        }
        setProfile(nextProfile);
        setError(null);
        logWebFlow('WEB_PROFILE_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          profilePlayerId: nextProfile.playerId,
          roles: nextProfile.roles ?? [],
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setProfile(null);
        setError(loadError instanceof Error ? loadError.message : String(loadError));
        logWebFlow('WEB_PROFILE_LOAD_FAILED', {
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
    profile,
    loading,
    error,
  };
}
