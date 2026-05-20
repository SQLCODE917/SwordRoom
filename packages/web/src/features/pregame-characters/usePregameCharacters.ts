import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CharacterItem, GameChatMessage, GameItem } from '../../api/ApiClient';
import { createApiClient } from '../../api/ApiClient';
import { useAuthProvider } from '../../auth/AuthProvider';
import { logWebFlow, summarizeError } from '../../logging/flowLog';

export type PregameCharactersState =
  | { status: 'loading'; gameId: string }
  | { status: 'error'; gameId: string; message: string }
  | {
      status: 'ready';
      gameId: string;
      game: GameItem;
      myCharacters: CharacterItem[];
      chatMessages: GameChatMessage[];
      sharedMessages: GameChatMessage[];
      gameCharacters: CharacterItem[];
    };

export function usePregameCharacters(gameId: string) {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const [state, setState] = useState<PregameCharactersState>({ status: 'loading', gameId });

  const refresh = useCallback(async () => {
    setState({ status: 'loading', gameId });
    logWebFlow('WEB_PREGAME_CHARACTERS_LOAD_START', {
      actorId: auth.actorId,
      authMode: auth.mode,
      gameId,
    });

    try {
      const [game, myCharacters, chat] = await Promise.all([api.getGame(gameId), api.getMyCharacters(), api.getGameChat(gameId)]);
      if (!game) {
        setState({ status: 'error', gameId, message: `Game not found: ${gameId}` });
        return;
      }

      const characterIds = Array.from(
        new Set(
          chat.participants
            .map((participant) => participant.characterId)
            .filter((characterId): characterId is string => typeof characterId === 'string' && characterId.trim() !== '')
        )
      );
      const gameCharacters = (
        await Promise.all(characterIds.map(async (characterId) => api.getCharacter(gameId, characterId)))
      ).filter((character): character is CharacterItem => character !== null);

      const sharedMessages = chat.messages.filter((message) => message.artifact?.kind === 'CHARACTER_DRAFT');
      const ownCharacters = myCharacters.filter((character) => character.gameId === gameId);

      setState({
        status: 'ready',
        gameId,
        game,
        myCharacters: ownCharacters,
        chatMessages: chat.messages,
        sharedMessages,
        gameCharacters,
      });
      logWebFlow('WEB_PREGAME_CHARACTERS_LOAD_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        myCharacterCount: ownCharacters.length,
        sharedCount: sharedMessages.length,
        gameCharacterCount: gameCharacters.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ status: 'error', gameId, message });
      logWebFlow('WEB_PREGAME_CHARACTERS_LOAD_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        gameId,
        ...summarizeError(error),
      });
    }
  }, [api, auth.actorId, auth.mode, gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    state,
    refresh,
  };
}
