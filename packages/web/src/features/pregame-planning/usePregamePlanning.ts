import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient, type PregamePlanningResponse } from '../../api/ApiClient';
import { useAuthProvider } from '../../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../../logging/flowLog';

export type PregamePlanningState =
  | { status: 'disabled'; gameId: string }
  | { status: 'loading'; gameId: string }
  | { status: 'error'; gameId: string; message: string }
  | { status: 'ready'; gameId: string; planning: PregamePlanningResponse };

export function usePregamePlanning(gameId: string, enabled = true) {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [state, setState] = useState<PregamePlanningState>(enabled ? { status: 'loading', gameId } : { status: 'disabled', gameId });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ status: 'disabled', gameId });
      return;
    }

    setState({ status: 'loading', gameId });
    logWebFlow('WEB_PREGAME_PLANNING_LOAD_START', {
      actorId: auth.actorId,
      authMode: auth.mode,
      gameId,
    });
    try {
      const planning = await api.getPregamePlanning(gameId);
      setState({ status: 'ready', gameId, planning });
      logWebFlow('WEB_PREGAME_PLANNING_LOAD_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        isMember: planning.viewer.isMember,
        isGameMaster: planning.viewer.isGameMaster,
        hasActivePrompt: planning.activePrompt !== null,
        partyNeedCount: planning.partyNeeds.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ status: 'error', gameId, message });
      logWebFlow('WEB_PREGAME_PLANNING_LOAD_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        ...summarizeError(error),
      });
    }
  }, [api, auth.actorId, auth.mode, enabled, gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    refresh,
  };
}
