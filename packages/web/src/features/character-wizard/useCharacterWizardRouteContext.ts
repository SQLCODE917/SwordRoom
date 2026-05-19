import { useEffect, useState } from 'react';
import type { CharacterItem, GameItem } from '../../api/ApiClient';

export function useCharacterWizardRouteContext(input: {
  actorId: string | null;
  api: {
    getPublicGames(): Promise<GameItem[]>;
    getMyCharacters(): Promise<CharacterItem[]>;
  };
  isEditMode: boolean;
  routeGameId: string;
  routePlayerId: string | null;
  wizardMode: 'apply' | 'library';
}) {
  const [savedCharacters, setSavedCharacters] = useState<CharacterItem[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeReady, setRouteReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRouteContext = async () => {
      setRouteReady(false);
      setRouteError(null);
      try {
        if (input.wizardMode === 'library') {
          if (!input.routePlayerId || input.routePlayerId !== input.actorId) {
            throw new Error(`Player "${input.routePlayerId ?? 'unknown'}" does not match the signed-in actor.`);
          }
        } else if (!input.isEditMode) {
          const game = (await input.api.getPublicGames()).find((item) => item.gameId === input.routeGameId) ?? null;
          if (!game) {
            throw new Error(`Game ${input.routeGameId} was not found.`);
          }
          if (game.visibility !== 'PUBLIC') {
            throw new Error(`${game.name} is not a public game`);
          }
        }

        const characters = await input.api.getMyCharacters();
        if (cancelled) {
          return;
        }
        if (
          !input.isEditMode &&
          input.wizardMode === 'apply' &&
          characters.some((item) => item.gameId === input.routeGameId)
        ) {
          throw new Error('You already have a character in this game. Open it from My Characters or remove it before applying again.');
        }
        setSavedCharacters(characters);
        setRouteError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSavedCharacters([]);
        setRouteError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) {
          setRouteReady(true);
        }
      }
    };

    void loadRouteContext();

    return () => {
      cancelled = true;
    };
  }, [input.actorId, input.api, input.isEditMode, input.routeGameId, input.routePlayerId, input.wizardMode]);

  return {
    routeReady,
    routeError,
    savedCharacters,
    setSavedCharacters,
  };
}
