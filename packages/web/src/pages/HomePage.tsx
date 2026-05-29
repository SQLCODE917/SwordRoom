import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createApiClient,
  type CharacterItem,
  type GameItem,
  type GameplayLifecycle,
} from '../api/ApiClient';
import { notifyAuthStateChanged, useAuthProvider } from '../auth/AuthProvider';
import { reportDebugStatusRegion } from '../debug/debugTelemetry';
import { Panel } from '../components/Panel';
import { ButtonLink } from '../components/ButtonLink';
import { HomeWorkspace } from '../features/home/components/HomeWorkspace';
import {
  buildCharacterRows,
  buildGameCharacterByGameId,
  buildMyGameRows,
  buildPublicGameRows,
  createHomeWorkspaceViewModel,
  createNextMoveViewModel,
  emptyDashboardState,
  parseHomeTab,
  type DashboardState,
  type HomeWorkspaceViewModel,
  type NextMoveViewModel,
} from '../features/home/viewModel';
import {
  createCommandId,
  useCommandWorkflow,
} from '../hooks/useCommandStatus';
import { useMyProfile } from '../hooks/useMyProfile';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import styles from '../features/home/HomePage.module.css';

interface HomePageViewModel {
  nextMove: NextMoveViewModel;
  workspace: HomeWorkspaceViewModel;
}

export function HomePage() {
  const view = useHomePageViewModel();

  return (
    <div className="l-page">
      <Panel title="Home" subtitle="Your characters and visible games.">
        <Panel title={view.nextMove.title}>
          <div className={`c-note c-note--info ${styles.nextMoveNote}`}>
            <div className="t-small">{view.nextMove.headline}</div>
            <div className="t-small">{view.nextMove.detail}</div>
          </div>
          <NextMoveActions nextMove={view.nextMove} />
        </Panel>

        <HomeWorkspace workspace={view.workspace} />
      </Panel>
    </div>
  );
}

function useHomePageViewModel(): HomePageViewModel {
  const [searchParams] = useSearchParams();
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const { loading: profileLoading, error: profileError } = useMyProfile();
  const [dashboard, setDashboard] =
    useState<DashboardState>(emptyDashboardState);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [removingCharacterId, setRemovingCharacterId] = useState<string | null>(
    null,
  );
  const [archivingGameId, setArchivingGameId] = useState<string | null>(null);
  const {
    status: commandStatus,
    isRunning: isRunningCommand,
    submitEnvelopeAndAwait,
  } = useCommandWorkflow();

  const refreshDashboard = useCallback(async () => {
    setDataLoading(true);
    logWebFlow('WEB_HOME_LOAD_START', {
      actorId: auth.actorId,
      authMode: auth.mode,
    });
    try {
      const [characters, myGames, gmGames, publicGames, pregameDigest] =
        await Promise.all([
          api.getMyCharacters(),
          api.getMyGames(),
          api.getGmGames(),
          api.getPublicGames(),
          api.getMyPregameDigest(),
        ]);
      const lifecycleByGameIdEntries = await Promise.all(
        myGames.map(async (game) => {
          try {
            const lifecycle = await api.getGameplayLifecycle(game.gameId);
            return [game.gameId, lifecycle.phase] as const;
          } catch (lifecycleError) {
            logWebFlow('WEB_HOME_GAME_LIFECYCLE_FALLBACK', {
              actorId: auth.actorId,
              authMode: auth.mode,
              gameId: game.gameId,
              ...summarizeError(lifecycleError),
            });
            return [game.gameId, 'PREGAME' as const] as const;
          }
        }),
      );

      const lifecycleByGameId: Record<string, GameplayLifecycle['phase']> = {};
      for (const [gameId, phase] of lifecycleByGameIdEntries) {
        lifecycleByGameId[gameId] = phase;
      }

      setDashboard({
        characters,
        myGames,
        gmGames,
        publicGames,
        pregameDigest,
        lifecycleByGameId,
      });
      setDataError(null);
      logWebFlow('WEB_HOME_LOAD_OK', {
        actorId: auth.actorId,
        authMode: auth.mode,
        characterCount: characters.length,
        myGameCount: myGames.length,
        gmGameCount: gmGames.length,
        publicGameCount: publicGames.length,
        pregameDigestCount: pregameDigest.length,
      });
    } catch (loadError) {
      setDataError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
      logWebFlow('WEB_HOME_LOAD_FAILED', {
        actorId: auth.actorId,
        authMode: auth.mode,
        ...summarizeError(loadError),
      });
    } finally {
      setDataLoading(false);
    }
  }, [api, auth.actorId, auth.mode]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (cancelled) {
        return;
      }
      await refreshDashboard();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshDashboard]);

  const removeCharacter = useCallback(
    async (character: CharacterItem) => {
      setRemovingCharacterId(character.characterId);
      setDataError(null);
      try {
        await submitEnvelopeAndAwait('Delete character', {
          commandId: createCommandId(),
          gameId: character.gameId,
          type: 'DeleteCharacter',
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          payload: {
            characterId: character.characterId,
          },
        });
        await refreshDashboard();
      } catch (error) {
        setDataError(error instanceof Error ? error.message : String(error));
      } finally {
        setRemovingCharacterId(null);
      }
    },
    [refreshDashboard, submitEnvelopeAndAwait],
  );

  const archiveGame = useCallback(
    async (game: GameItem) => {
      const confirmed = window.confirm(
        `Delete "${game.name}"? Players will be notified and the game will disappear from active lists.`,
      );
      if (!confirmed) {
        return;
      }

      setArchivingGameId(game.gameId);
      setDataError(null);
      try {
        await submitEnvelopeAndAwait('Delete game', {
          commandId: createCommandId(),
          gameId: game.gameId,
          type: 'ArchiveGame',
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          payload: {
            gameId: game.gameId,
            expectedVersion: game.version,
          },
        });
        notifyAuthStateChanged();
        await refreshDashboard();
      } catch (error) {
        setDataError(error instanceof Error ? error.message : String(error));
      } finally {
        setArchivingGameId(null);
      }
    },
    [refreshDashboard, submitEnvelopeAndAwait],
  );

  const loading = profileLoading || dataLoading;
  const errorText = profileError ?? dataError;
  const joinedGameIds = useMemo(
    () => new Set(dashboard.myGames.map((game) => game.gameId)),
    [dashboard.myGames],
  );
  const gmGameIds = useMemo(
    () => new Set(dashboard.gmGames.map((game) => game.gameId)),
    [dashboard.gmGames],
  );
  const gameCharacterByGameId = useMemo(() => {
    return buildGameCharacterByGameId(dashboard.characters);
  }, [dashboard.characters]);
  const nextMove = useMemo(
    () =>
      createNextMoveViewModel({
        actorId: auth.actorId,
        dashboard,
        joinedGameIds,
        gmGameIds,
        gameCharacterByGameId,
      }),
    [auth.actorId, dashboard, joinedGameIds, gmGameIds, gameCharacterByGameId],
  );

  const characterRows = useMemo(
    () =>
      buildCharacterRows({
        characters: dashboard.characters,
        isRunningCommand,
        removingCharacterId,
        onRemoveCharacter: (character) => {
          void removeCharacter(character);
        },
      }),
    [dashboard.characters, isRunningCommand, removeCharacter, removingCharacterId],
  );

  const myGameRows = useMemo(
    () =>
      buildMyGameRows({
        games: dashboard.myGames,
        gmGameIds,
        characterByGameId: gameCharacterByGameId,
        lifecycleByGameId: dashboard.lifecycleByGameId,
        archivingGameId,
        isRunningCommand,
        onArchiveGame: (game) => {
          void archiveGame(game);
        },
      }),
    [
      archivingGameId,
      archiveGame,
      dashboard.lifecycleByGameId,
      dashboard.myGames,
      gameCharacterByGameId,
      gmGameIds,
      isRunningCommand,
    ],
  );

  const publicGameRows = useMemo(
    () =>
      buildPublicGameRows({
        games: dashboard.publicGames,
        joinedGameIds,
        gmGameIds,
        characterByGameId: gameCharacterByGameId,
      }),
    [dashboard.publicGames, gameCharacterByGameId, gmGameIds, joinedGameIds],
  );
  const requestedTab = parseHomeTab(searchParams.get('tab'));
  const hasJoinedGames = dashboard.myGames.length > 0;
  const workspace = useMemo(
    () =>
      createHomeWorkspaceViewModel({
        actorId: auth.actorId,
        requestedTab,
        hasJoinedGames,
        loading,
        characterRows,
        myGameRows,
        publicGameRows,
      }),
    [
      auth.actorId,
      characterRows,
      hasJoinedGames,
      loading,
      myGameRows,
      publicGameRows,
      requestedTab,
    ],
  );

  useEffect(() => {
    reportDebugStatusRegion({
      pageStatusText: loading ? 'Loading dashboard...' : 'Dashboard ready.',
      identityStatusText: `Signed in as ${auth.actorId}.`,
      errorText,
    });
  }, [auth.actorId, errorText, loading]);

  return {
    nextMove,
    workspace,
  };
}

function NextMoveActions({ nextMove }: { nextMove: NextMoveViewModel }) {
  return (
    <div className={styles.nextMoveActions}>
      <ButtonLink to={nextMove.primaryAction.to}>
        {nextMove.primaryAction.label}
      </ButtonLink>
      {nextMove.secondaryActions.map((action) => (
        <ButtonLink
          key={`${action.label}:${action.to}`}
          to={action.to}
          disabled={action.disabled}
          disabledReason={action.disabledReason}
        >
          {action.label}
        </ButtonLink>
      ))}
    </div>
  );
}

export { PublicGamesTable } from '../features/home/components/HomeWorkspace';
