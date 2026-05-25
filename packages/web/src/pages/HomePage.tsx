import { useCallback, useEffect, useMemo, useState } from 'react';
import { isPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import {
  createApiClient,
  type CharacterItem,
  type GameItem,
  type GameplayLifecycle,
  type PregameDigestEntry,
} from '../api/ApiClient';
import { notifyAuthStateChanged, useAuthProvider } from '../auth/AuthProvider';
import { ButtonLink } from '../components/ButtonLink';
import { reportDebugStatusRegion } from '../debug/debugTelemetry';
import { Panel } from '../components/Panel';
import { appendCharacterWizardEntryContext } from '../features/character-wizard';
import { deriveGameplayPhaseGate } from '../features/gameplay-lifecycle/phaseGate';
import {
  createCommandId,
  useCommandWorkflow,
} from '../hooks/useCommandStatus';
import { useMyProfile } from '../hooks/useMyProfile';
import { logWebFlow, summarizeError } from '../logging/flowLog';
import styles from './HomePage.module.css';

interface DashboardState {
  characters: CharacterItem[];
  myGames: GameItem[];
  gmGames: GameItem[];
  publicGames: GameItem[];
  pregameDigest: PregameDigestEntry[];
  lifecycleByGameId: Record<string, GameplayLifecycle['phase']>;
}

interface HomePageViewModel {
  actorId: string;
  loading: boolean;
  hasJoinedGames: boolean;
  quickStartHeadline: string;
  quickStartDetail: string;
  quickStartActions: ActionDeckViewModel;
  characterRows: CharacterRowViewModel[];
  myGameRows: GameRowViewModel[];
  publicGameRows: GameRowViewModel[];
}

type ActionVariant = 'default' | 'destructive';

interface LinkActionViewModel {
  kind: 'link';
  key: string;
  label: string;
  to: string;
  disabled: boolean;
  disabledReason: string | null;
  variant: ActionVariant;
}

interface ButtonActionViewModel {
  kind: 'button';
  key: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: ActionVariant;
}

type ActionViewModel = LinkActionViewModel | ButtonActionViewModel;

interface ActionDeckViewModel {
  primary: ActionViewModel;
  secondary: ActionViewModel[];
  moreLabel: string;
}

interface CharacterRowViewModel {
  key: string;
  characterName: string;
  status: string;
  actions: ActionDeckViewModel;
}

interface GameRowViewModel {
  key: string;
  gameName: string;
  visibility: string;
  phaseLabel: GameplayLifecycle['phase'] | null;
  actions: ActionDeckViewModel;
}

interface QuickStartAction {
  label: string;
  to: string;
}

interface QuickStartViewModel {
  headline: string;
  detail: string;
  primaryAction: QuickStartAction;
  secondaryActions: QuickStartAction[];
}

const emptyState: DashboardState = {
  characters: [],
  myGames: [],
  gmGames: [],
  publicGames: [],
  pregameDigest: [],
  lifecycleByGameId: {},
};

const existingCharacterDisabledReason =
  'You already have a character in this game.';

const actionPriorityOrder = [
  'Lobby',
  'Play',
  'Chat',
  'Player Inbox',
  'Sheet',
  'Edit',
  'New Character',
  'Apply to Join',
  'GM Play',
  'GM Inbox',
  'Delete',
] as const;

export function HomePage() {
  const view = useHomePageViewModel();

  return (
    <div className="l-page">
      <Panel title="Home" subtitle="Your characters and visible games.">
        <Panel
          title="Pregame Quick Start"
          subtitle="Fastest path into active planning on a phone."
        >
          <div className={`c-note c-note--info ${styles.quickStartNote}`}>
            <div className="t-small">{view.quickStartHeadline}</div>
            <div className="t-small">{view.quickStartDetail}</div>
          </div>
          <ActionDeck actions={view.quickStartActions} />
        </Panel>

        <div className="l-split">
          <section className="l-col l-grow" aria-label="Games section">
            <div className={styles.sectionHeader}>
              <SectionTitle title="Games" />
              <ButtonLink to="/gm/games">Create Game</ButtonLink>
            </div>
            {view.hasJoinedGames ? (
              <MyGamesTable
                rows={view.myGameRows}
                loading={view.loading}
                emptyText="You are not in any games yet."
              />
            ) : (
              <>
                <SectionTitle title="Public Games" />
                <PublicGamesTable
                  rows={view.publicGameRows}
                  loading={view.loading}
                  emptyText="No public games found."
                />
              </>
            )}
          </section>

          <section className="l-col l-grow" aria-label="My Characters section">
            <div className={styles.sectionHeader}>
              <SectionTitle title="My Characters" />
              <ButtonLink
                to={`/player/${encodeURIComponent(view.actorId)}/character/new`}
              >
                New Character
              </ButtonLink>
            </div>
            <CharactersTable
              rows={view.characterRows}
              loading={view.loading}
              emptyText="No characters yet."
            />
          </section>
        </div>
      </Panel>
    </div>
  );
}

function useHomePageViewModel(): HomePageViewModel {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const { loading: profileLoading, error: profileError } = useMyProfile();
  const [dashboard, setDashboard] = useState<DashboardState>(emptyState);
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
    const next = new Map<string, CharacterItem>();
    for (const character of dashboard.characters) {
      if (
        isPlayerCharacterLibraryGameId(character.gameId) ||
        next.has(character.gameId)
      ) {
        continue;
      }
      next.set(character.gameId, character);
    }
    return next;
  }, [dashboard.characters]);
  const quickStart = useMemo(
    () =>
      createQuickStartViewModel({
        actorId: auth.actorId,
        dashboard,
        joinedGameIds,
        gmGameIds,
        gameCharacterByGameId,
      }),
    [auth.actorId, dashboard, joinedGameIds, gmGameIds, gameCharacterByGameId],
  );

  const quickStartActions = useMemo<ActionDeckViewModel>(
    () => ({
      primary: createLinkAction({
        key: `quick-start:${quickStart.primaryAction.label}`,
        label: quickStart.primaryAction.label,
        to: quickStart.primaryAction.to,
      }),
      secondary: quickStart.secondaryActions.map((action) =>
        createLinkAction({
          key: `quick-start:${action.label}`,
          label: action.label,
          to: action.to,
        }),
      ),
      moreLabel: 'More Start Actions',
    }),
    [quickStart],
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

  useEffect(() => {
    reportDebugStatusRegion({
      pageStatusText: loading ? 'Loading dashboard...' : 'Dashboard ready.',
      identityStatusText: `Signed in as ${auth.actorId}.`,
      errorText,
    });
  }, [auth.actorId, errorText, loading]);

  return {
    actorId: auth.actorId,
    loading,
    hasJoinedGames: dashboard.myGames.length > 0,
    quickStartHeadline: quickStart.headline,
    quickStartDetail: quickStart.detail,
    quickStartActions,
    characterRows,
    myGameRows,
    publicGameRows,
  };
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function CharactersTable(input: {
  rows: CharacterRowViewModel[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <table className={styles.table} aria-label="My characters">
      <thead>
        <tr>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Character
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Status
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {input.rows.length === 0 ? (
          renderLoadingOrEmptyRows({
            loading: input.loading,
            emptyText: input.emptyText,
            loadingLabel: 'Loading characters...',
            columnCount: 3,
          })
        ) : (
          input.rows.map((row) => (
            <tr key={row.key}>
              <td className={`${styles.bodyCell} t-small`}>{row.characterName}</td>
              <td className={`${styles.bodyCell} t-small`}>{row.status}</td>
              <td className={`${styles.bodyCell} t-small`}>
                <ActionDeck actions={row.actions} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function MyGamesTable(input: {
  rows: GameRowViewModel[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <table className={styles.table} aria-label="My games">
      <thead>
        <tr>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Game
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Visibility
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {input.rows.length === 0 ? (
          renderLoadingOrEmptyRows({
            loading: input.loading,
            emptyText: input.emptyText,
            loadingLabel: 'Loading games...',
            columnCount: 3,
          })
        ) : (
          input.rows.map((row) => (
            <tr key={row.key}>
              <td className={`${styles.bodyCell} t-small`}>
                <div>{row.gameName}</div>
                {row.phaseLabel ? <div className="t-small">Phase: {row.phaseLabel}</div> : null}
              </td>
              <td className={`${styles.bodyCell} t-small`}>{row.visibility}</td>
              <td className={`${styles.bodyCell} t-small`}>
                <ActionDeck actions={row.actions} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function PublicGamesTable(input: {
  rows: GameRowViewModel[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <table className={styles.table} aria-label="Public games">
      <thead>
        <tr>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Game
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Visibility
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {input.rows.length === 0 ? (
          renderLoadingOrEmptyRows({
            loading: input.loading,
            emptyText: input.emptyText,
            loadingLabel: 'Loading games...',
            columnCount: 3,
          })
        ) : (
          input.rows.map((row) => (
            <tr key={row.key}>
              <td className={`${styles.bodyCell} t-small`}>
                <div>{row.gameName}</div>
                {row.phaseLabel ? <div className="t-small">Phase: {row.phaseLabel}</div> : null}
              </td>
              <td className={`${styles.bodyCell} t-small`}>{row.visibility}</td>
              <td className={`${styles.bodyCell} t-small`}>
                <ActionDeck actions={row.actions} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ActionDeck(input: { actions: ActionDeckViewModel }) {
  return (
    <div className={styles.actionDeck}>
      <div className={styles.primaryAction}>{renderAction(input.actions.primary)}</div>
      {input.actions.secondary.length > 0 ? (
        <details className={styles.secondaryActions}>
          <summary className={`c-btn ${styles.secondarySummary}`}>
            {input.actions.moreLabel}
          </summary>
          <div className={styles.secondaryList}>
            {input.actions.secondary.map((action) => renderAction(action))}
          </div>
        </details>
      ) : (
        <div className={styles.secondaryPlaceholder}>
          <span
            className={`c-btn is-disabled ${styles.secondaryPlaceholderButton}`}
            aria-hidden="true"
          >
            No Secondary Actions
          </span>
        </div>
      )}
    </div>
  );
}

function renderAction(action: ActionViewModel) {
  if (action.kind === 'link') {
    return (
      <ButtonLink
        key={action.key}
        to={action.to}
        disabled={action.disabled}
        disabledReason={action.disabledReason}
        variant={action.variant}
      >
        {action.label}
      </ButtonLink>
    );
  }

  return (
    <button
      key={action.key}
      className={[
        'c-btn',
        action.variant === 'destructive' ? 'c-btn--destructive' : '',
        action.disabled ? 'is-disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}

function renderLoadingOrEmptyRows(input: {
  loading: boolean;
  emptyText: string;
  loadingLabel: string;
  columnCount: number;
}) {
  if (input.loading) {
    return Array.from({ length: 3 }, (_, index) => (
      <tr key={`loading-${index}`}>
        <td className={`${styles.bodyCell} t-small`} colSpan={input.columnCount}>
          <div className={styles.loadingRow}>
            <span>{input.loadingLabel}</span>
            <span className={`c-btn is-disabled ${styles.loadingActionPlaceholder}`}>
              Loading...
            </span>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <tr>
      <td className={`${styles.bodyCell} t-small`} colSpan={input.columnCount}>
        {input.emptyText}
      </td>
    </tr>
  );
}

function createLinkAction(input: {
  key: string;
  label: string;
  to: string;
  disabled?: boolean;
  disabledReason?: string | null;
  variant?: ActionVariant;
}): LinkActionViewModel {
  return {
    kind: 'link',
    key: input.key,
    label: input.label,
    to: input.to,
    disabled: input.disabled ?? false,
    disabledReason: input.disabledReason ?? null,
    variant: input.variant ?? 'default',
  };
}

function createButtonAction(input: {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: ActionVariant;
}): ButtonActionViewModel {
  return {
    kind: 'button',
    key: input.key,
    label: input.label,
    onClick: input.onClick,
    disabled: input.disabled ?? false,
    variant: input.variant ?? 'default',
  };
}

function buildCharacterRows(input: {
  characters: CharacterItem[];
  isRunningCommand: boolean;
  removingCharacterId: string | null;
  onRemoveCharacter: (character: CharacterItem) => void;
}): CharacterRowViewModel[] {
  return input.characters.map((character) => {
    const isRemoving =
      input.removingCharacterId === character.characterId || input.isRunningCommand;
    const secondaryActions: ActionViewModel[] = [
      createLinkAction({
        key: `${character.characterId}:edit`,
        label: 'Edit',
        to: getCharacterEditPath(character),
      }),
    ];

    if (isRemovableGameCharacter(character)) {
      secondaryActions.push(
        createButtonAction({
          key: `${character.characterId}:leave`,
          label: 'Leave Game',
          disabled: isRemoving,
          onClick: () => input.onRemoveCharacter(character),
        }),
      );
    }

    return {
      key: `${character.gameId}:${character.characterId}`,
      characterName: readCharacterName(character),
      status: character.status,
      actions: {
        primary: createLinkAction({
          key: `${character.characterId}:sheet`,
          label: 'Sheet',
          to: getCharacterSheetPath(character),
        }),
        secondary: orderActions(secondaryActions),
        moreLabel: 'More Actions',
      },
    };
  });
}

function buildMyGameRows(input: {
  games: GameItem[];
  gmGameIds: ReadonlySet<string>;
  characterByGameId: ReadonlyMap<string, CharacterItem>;
  lifecycleByGameId: Readonly<Record<string, GameplayLifecycle['phase']>>;
  archivingGameId: string | null;
  isRunningCommand: boolean;
  onArchiveGame: (game: GameItem) => void;
}): GameRowViewModel[] {
  return input.games.map((game) => {
    const gameId = encodeURIComponent(game.gameId);
    const character = input.characterByGameId.get(game.gameId) ?? null;
    const isGmGame = input.gmGameIds.has(game.gameId);
    const phase = input.lifecycleByGameId[game.gameId] ?? 'PREGAME';
    const phaseGate = deriveGameplayPhaseGate({ phase });
    const isArchiving = input.archivingGameId === game.gameId;

    const secondaryActions: ActionViewModel[] = [
      createLinkAction({
        key: `${game.gameId}:play`,
        label: 'Play',
        to: `/games/${gameId}/play`,
      }),
      createLinkAction({
        key: `${game.gameId}:chat`,
        label: 'Chat',
        to: `/games/${gameId}/chat`,
      }),
      createLinkAction({
        key: `${game.gameId}:player-inbox`,
        label: 'Player Inbox',
        to: '/inbox?mode=player',
      }),
      createLinkAction({
        key: `${game.gameId}:new-character`,
        label: 'New Character',
        to: `/games/${gameId}/character/new`,
        disabled: Boolean(character),
        disabledReason: character ? existingCharacterDisabledReason : null,
      }),
    ];

    if (character) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:sheet`,
          label: 'Sheet',
          to: getCharacterSheetPath(character),
        }),
      );
      if (canEditCharacter(character)) {
        secondaryActions.push(
          createLinkAction({
            key: `${game.gameId}:edit`,
            label: 'Edit',
            to: getCharacterEditPath(character),
          }),
        );
      }
    }

    if (isGmGame) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:gm-play`,
          label: 'GM Play',
          to: `/gm/games/${gameId}?mode=gm-play`,
        }),
      );
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:gm-inbox`,
          label: 'GM Inbox',
          to: `/gm/${gameId}/inbox`,
        }),
      );
      secondaryActions.push(
        createButtonAction({
          key: `${game.gameId}:delete`,
          label: 'Delete',
          variant: 'destructive',
          disabled: isArchiving || input.isRunningCommand,
          onClick: () => input.onArchiveGame(game),
        }),
      );
    }

    return {
      key: game.gameId,
      gameName: game.name,
      visibility: `${game.visibility}`,
      phaseLabel: phase,
      actions: {
        primary: createLinkAction({
          key: `${game.gameId}:primary`,
          label: phaseGate.isLive ? 'Continue Play' : 'Open Lobby',
          to: phaseGate.isLive ? `/games/${gameId}/play` : `/games/${gameId}`,
        }),
        secondary: orderActions(secondaryActions),
        moreLabel: 'More Actions',
      },
    };
  });
}

function buildPublicGameRows(input: {
  games: GameItem[];
  joinedGameIds: ReadonlySet<string>;
  gmGameIds: ReadonlySet<string>;
  characterByGameId: ReadonlyMap<string, CharacterItem>;
}): GameRowViewModel[] {
  return input.games.map((game) => {
    const gameId = encodeURIComponent(game.gameId);
    const joined = input.joinedGameIds.has(game.gameId);
    const isGmGame = input.gmGameIds.has(game.gameId);
    const canEnterLobby = joined || isGmGame;
    const character = input.characterByGameId.get(game.gameId) ?? null;

    const applyAction = createLinkAction({
      key: `${game.gameId}:apply`,
      label: 'Apply to Join',
      to: `/games/${gameId}/character/new`,
      disabled: Boolean(character),
      disabledReason: character ? existingCharacterDisabledReason : null,
    });

    const secondaryActions: ActionViewModel[] = [];

    if (canEnterLobby) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:play`,
          label: 'Play',
          to: `/games/${gameId}/play`,
        }),
      );
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:chat`,
          label: 'Chat',
          to: `/games/${gameId}/chat`,
        }),
      );
    }
    if (joined) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:player-inbox`,
          label: 'Player Inbox',
          to: '/inbox?mode=player',
        }),
      );
    }
    if (character) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:sheet`,
          label: 'Sheet',
          to: getCharacterSheetPath(character),
        }),
      );
      if (canEditCharacter(character)) {
        secondaryActions.push(
          createLinkAction({
            key: `${game.gameId}:edit`,
            label: 'Edit',
            to: getCharacterEditPath(character),
          }),
        );
      }
    }
    if (isGmGame) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:gm-play`,
          label: 'GM Play',
          to: `/gm/games/${gameId}?mode=gm-play`,
        }),
      );
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:gm-inbox`,
          label: 'GM Inbox',
          to: `/gm/${gameId}/inbox`,
        }),
      );
    }

    return {
      key: game.gameId,
      gameName: game.name,
      visibility: game.visibility,
      phaseLabel: null,
      actions: {
        primary: canEnterLobby
          ? createLinkAction({
              key: `${game.gameId}:lobby`,
              label: 'Lobby',
              to: `/games/${gameId}`,
            })
          : applyAction,
        secondary: orderActions(secondaryActions),
        moreLabel: 'More Actions',
      },
    };
  });
}

function orderActions(actions: ActionViewModel[]): ActionViewModel[] {
  const findPriority = (label: string): number => {
    const index = actionPriorityOrder.findIndex((value) => value === label);
    return index === -1 ? actionPriorityOrder.length : index;
  };

  return [...actions].sort((a, b) => {
    return findPriority(a.label) - findPriority(b.label);
  });
}

function readCharacterName(character: CharacterItem): string {
  const draft =
    typeof character.draft === 'object' && character.draft !== null
      ? (character.draft as Record<string, unknown>)
      : null;
  const identity =
    draft && typeof draft.identity === 'object' && draft.identity !== null
      ? (draft.identity as Record<string, unknown>)
      : null;
  const name = typeof identity?.name === 'string' ? identity.name.trim() : '';
  return name || character.characterId;
}

function getCharacterSheetPath(character: CharacterItem): string {
  if (isPlayerCharacterLibraryGameId(character.gameId)) {
    const ownerPlayerId =
      typeof character.ownerPlayerId === 'string' ? character.ownerPlayerId : '';
    return `/player/${encodeURIComponent(ownerPlayerId)}/characters/${encodeURIComponent(character.characterId)}`;
  }
  return `/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}`;
}

function getCharacterEditPath(character: CharacterItem): string {
  if (isPlayerCharacterLibraryGameId(character.gameId)) {
    const ownerPlayerId =
      typeof character.ownerPlayerId === 'string' ? character.ownerPlayerId : '';
    return `/player/${encodeURIComponent(ownerPlayerId)}/characters/${encodeURIComponent(character.characterId)}/edit`;
  }
  return appendCharacterWizardEntryContext(
    `/games/${encodeURIComponent(character.gameId)}/characters/${encodeURIComponent(character.characterId)}/edit`,
    { entrySource: 'home', focus: 'resume' },
  );
}

function canEditCharacter(character: CharacterItem): boolean {
  return character.status !== 'PENDING' && character.status !== 'APPROVED';
}

function isRemovableGameCharacter(character: CharacterItem): boolean {
  return !isPlayerCharacterLibraryGameId(character.gameId);
}

function createQuickStartViewModel(input: {
  actorId: string;
  dashboard: DashboardState;
  joinedGameIds: ReadonlySet<string>;
  gmGameIds: ReadonlySet<string>;
  gameCharacterByGameId: ReadonlyMap<string, CharacterItem>;
}): QuickStartViewModel {
  const digestEntry = input.dashboard.pregameDigest[0] ?? null;
  const joinableGame =
    input.dashboard.publicGames.find(
      (game) =>
        !input.joinedGameIds.has(game.gameId) &&
        !input.gmGameIds.has(game.gameId),
    ) ?? null;
  const gameNeedingCharacter =
    input.dashboard.myGames.find(
      (game) => !input.gameCharacterByGameId.has(game.gameId),
    ) ??
    joinableGame ??
    null;

  if (digestEntry) {
    return {
      headline: `Resume planning in ${digestEntry.gameName}`,
      detail: digestEntry.headline,
      primaryAction: {
        label: readPregameDigestActionLabel(digestEntry),
        to: toPregameDigestPath(digestEntry),
      },
      secondaryActions: buildSecondaryQuickStartActions({
        actorId: input.actorId,
        joinableGame,
        gameNeedingCharacter,
      }),
    };
  }

  if (joinableGame) {
    return {
      headline: `Join ${joinableGame.name}`,
      detail:
        'Start planning by creating a character draft for a visible game.',
      primaryAction: {
        label: 'Join a Game',
        to: appendCharacterWizardEntryContext(
          `/games/${encodeURIComponent(joinableGame.gameId)}/character/new`,
          {
            entrySource: 'home',
            focus: 'start',
          },
        ),
      },
      secondaryActions: buildSecondaryQuickStartActions({
        actorId: input.actorId,
        joinableGame,
        gameNeedingCharacter,
      }).filter((action) => action.label !== 'Join a Game'),
    };
  }

  if (gameNeedingCharacter) {
    return {
      headline: `Create for ${gameNeedingCharacter.name}`,
      detail:
        'Enter the game-scoped creator and start the pregame loop immediately.',
      primaryAction: {
        label: 'Create a Character',
        to: appendCharacterWizardEntryContext(
          `/games/${encodeURIComponent(gameNeedingCharacter.gameId)}/character/new`,
          {
            entrySource: 'home',
            focus: 'start',
          },
        ),
      },
      secondaryActions: buildSecondaryQuickStartActions({
        actorId: input.actorId,
        joinableGame,
        gameNeedingCharacter,
      }).filter((action) => action.label !== 'Create a Character'),
    };
  }

  return {
    headline: 'Start the pregame loop',
    detail:
      'Create a game, join a visible game, or start a character draft with the fewest possible steps.',
    primaryAction: {
      label: 'Start a Game',
      to: '/gm/games',
    },
    secondaryActions: buildSecondaryQuickStartActions({
      actorId: input.actorId,
      joinableGame,
      gameNeedingCharacter,
    }).filter((action) => action.label !== 'Start a Game'),
  };
}

function buildSecondaryQuickStartActions(input: {
  actorId: string;
  joinableGame: GameItem | null;
  gameNeedingCharacter: GameItem | null;
}): QuickStartAction[] {
  const actions: QuickStartAction[] = [];
  if (input.joinableGame) {
    actions.push({
      label: 'Join a Game',
      to: appendCharacterWizardEntryContext(
        `/games/${encodeURIComponent(input.joinableGame.gameId)}/character/new`,
        {
          entrySource: 'home',
          focus: 'start',
        },
      ),
    });
  }
  actions.push({
    label: 'Start a Game',
    to: '/gm/games',
  });
  actions.push({
    label: 'Create a Character',
    to: input.gameNeedingCharacter
      ? appendCharacterWizardEntryContext(
          `/games/${encodeURIComponent(input.gameNeedingCharacter.gameId)}/character/new`,
          {
            entrySource: 'home',
            focus: 'start',
          },
        )
      : `/player/${encodeURIComponent(input.actorId)}/character/new`,
  });
  return dedupeQuickStartActions(actions);
}

function dedupeQuickStartActions(
  actions: QuickStartAction[],
): QuickStartAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.label}:${action.to}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function toPregameDigestPath(entry: PregameDigestEntry): string {
  if (entry.destination === 'CHAT') {
    return `/games/${encodeURIComponent(entry.gameId)}/chat`;
  }
  if (entry.destination === 'CREATE_CHARACTER') {
    return appendCharacterWizardEntryContext(
      `/games/${encodeURIComponent(entry.gameId)}/character/new`,
      {
        entrySource: 'digest',
        focus: 'resume',
      },
    );
  }
  if (entry.destination === 'EDIT_CHARACTER' && entry.characterId) {
    return appendCharacterWizardEntryContext(
      `/games/${encodeURIComponent(entry.gameId)}/characters/${encodeURIComponent(entry.characterId)}/edit`,
      { entrySource: 'digest', focus: 'resume' },
    );
  }
  return `/games/${encodeURIComponent(entry.gameId)}`;
}

function readPregameDigestActionLabel(entry: PregameDigestEntry): string {
  if (entry.destination === 'CHAT') {
    return 'Open Chat';
  }
  if (entry.destination === 'CREATE_CHARACTER') {
    return 'Create Draft';
  }
  if (entry.destination === 'EDIT_CHARACTER') {
    return 'Edit Draft';
  }
  return 'Open Lobby';
}
