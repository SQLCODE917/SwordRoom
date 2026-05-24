import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createApiClient,
  type CharacterItem,
  type GameplayLifecycle,
  type GameActorContextResponse,
  type GameChatResponse,
  type GameItem,
  type PregamePlanningResponse,
} from '../../api/ApiClient';
import { useAuthProvider } from '../../auth/AuthProvider';
import { deriveGameplayPhaseGate } from '../gameplay-lifecycle/phaseGate';
import { logWebFlow, summarizeError } from '../../logging/flowLog';

export type PregameLobbyState =
  | { status: 'loading'; gameId: string }
  | { status: 'error'; gameId: string; message: string }
  | { status: 'forbidden'; gameId: string; message: string }
  | { status: 'missing'; gameId: string; message: string }
  | {
      status: 'live';
      gameId: string;
      game: GameItem;
      actorContext: GameActorContextResponse;
      lifecycle: GameplayLifecycle;
    }
  | {
      status: 'ready';
      gameId: string;
      game: GameItem;
      actorContext: GameActorContextResponse;
      chat: GameChatResponse;
      planning: PregamePlanningResponse;
      myCharacters: CharacterItem[];
    };

export function usePregameLobby(gameId: string): {
  state: PregameLobbyState;
  refresh: () => Promise<void>;
} {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [state, setState] = useState<PregameLobbyState>({ status: 'loading', gameId });
  const isMountedRef = useRef(true);

  const refresh = useMemo(
    () => async () => {
      if (!isMountedRef.current) {
        return;
      }
      setState({ status: 'loading', gameId });
      logWebFlow('WEB_PREGAME_LOBBY_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
      });
      try {
        const [game, actorContext, lifecycle] = await Promise.all([
          api.getGame(gameId),
          api.getGameActorContext(gameId),
          api.getGameplayLifecycle(gameId),
        ]);
        const phaseGate = deriveGameplayPhaseGate(lifecycle);

        if (!game) {
          throw new Error(`Game ${gameId} was not found.`);
        }

        if (phaseGate.isLive) {
          if (!isMountedRef.current) {
            return;
          }
          setState({
            status: 'live',
            gameId,
            game,
            actorContext,
            lifecycle,
          });
          logWebFlow('WEB_PREGAME_LOBBY_LOAD_LIVE', {
            actorId: auth.actorId,
            authMode: auth.mode,
            gameId,
            phase: phaseGate.phase,
            hasGameplaySession: lifecycle.hasGameplaySession,
            isGameMaster: actorContext.isGameMaster,
          });
          return;
        }

        const [chat, planning, myCharacters] = await Promise.all([
          api.getGameChat(gameId, 'LOBBY'),
          api.getPregamePlanning(gameId),
          api.getMyCharacters(),
        ]);

        if (!isMountedRef.current) {
          return;
        }
        setState({
          status: 'ready',
          gameId,
          game,
          actorContext,
          chat,
          planning,
          myCharacters,
        });
        logWebFlow('WEB_PREGAME_LOBBY_LOAD_OK', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          participantCount: chat.participants.length,
          messageCount: chat.messages.length,
          myCharacterCount: myCharacters.length,
          isGameMaster: actorContext.isGameMaster,
        });
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        const statusCode =
          loadError && typeof loadError === 'object' && typeof (loadError as { statusCode?: unknown }).statusCode === 'number'
            ? ((loadError as { statusCode: number }).statusCode)
            : null;
        if (!isMountedRef.current) {
          return;
        }
        if (statusCode === 403) {
          setState({
            status: 'forbidden',
            gameId,
            message,
          });
        } else if (statusCode === 404) {
          setState({
            status: 'missing',
            gameId,
            message,
          });
        } else {
          setState({
            status: 'error',
            gameId,
            message,
          });
        }
        logWebFlow('WEB_PREGAME_LOBBY_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          ...summarizeError(loadError),
        });
      }
    },
    [api, auth.actorId, auth.mode, gameId]
  );

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();

    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  return { state, refresh };
}
