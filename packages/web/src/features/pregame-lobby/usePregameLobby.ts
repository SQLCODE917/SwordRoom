import { useEffect, useMemo, useState } from 'react';
import { createApiClient, type CharacterItem, type GameActorContextResponse, type GameChatResponse, type GameItem } from '../../api/ApiClient';
import { useAuthProvider } from '../../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../../logging/flowLog';

export type PregameLobbyState =
  | { status: 'loading'; gameId: string }
  | { status: 'error'; gameId: string; message: string }
  | {
      status: 'ready';
      gameId: string;
      game: GameItem;
      actorContext: GameActorContextResponse;
      chat: GameChatResponse;
      myCharacters: CharacterItem[];
    };

export function usePregameLobby(gameId: string): PregameLobbyState {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [state, setState] = useState<PregameLobbyState>({ status: 'loading', gameId });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: 'loading', gameId });
      logWebFlow('WEB_PREGAME_LOBBY_LOAD_START', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
      });
      try {
        const [game, actorContext, chat, myCharacters] = await Promise.all([
          api.getGame(gameId),
          api.getGameActorContext(gameId),
          api.getGameChat(gameId),
          api.getMyCharacters(),
        ]);

        if (cancelled) {
          return;
        }
        if (!game) {
          throw new Error(`Game ${gameId} was not found.`);
        }

        setState({
          status: 'ready',
          gameId,
          game,
          actorContext,
          chat,
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
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setState({
          status: 'error',
          gameId,
          message,
        });
        logWebFlow('WEB_PREGAME_LOBBY_LOAD_FAILED', {
          actorId: auth.actorId,
          authMode: auth.mode,
          gameId,
          ...summarizeError(loadError),
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, auth.actorId, auth.mode, gameId]);

  return state;
}
