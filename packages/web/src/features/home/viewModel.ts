import { isPlayerCharacterLibraryGameId } from '@starter/shared/contracts/db';
import {
  type CharacterItem,
  type GameItem,
  type GameplayLifecycle,
  type PregameDigestEntry,
} from '../../api/ApiClient';
import { appendCharacterWizardEntryContext } from '../character-wizard';
import { deriveGameplayPhaseGate } from '../gameplay-lifecycle/phaseGate';

export interface DashboardState {
  characters: CharacterItem[];
  myGames: GameItem[];
  gmGames: GameItem[];
  publicGames: GameItem[];
  pregameDigest: PregameDigestEntry[];
  lifecycleByGameId: Record<string, GameplayLifecycle['phase']>;
}

export interface HomeWorkspaceViewModel {
  tabs: HomeTabViewModel[];
  active: HomeWorkspaceStateViewModel;
}

export type HomeTabId = 'my-games' | 'public-games' | 'your-characters';

export interface HomeTabViewModel {
  id: HomeTabId;
  label: string;
  href: string;
  selected: boolean;
}

export type HomeWorkspaceStateViewModel =
  | MyGamesWorkspaceStateViewModel
  | PublicGamesWorkspaceStateViewModel
  | YourCharactersWorkspaceStateViewModel;

export interface MyGamesWorkspaceStateViewModel {
  kind: 'my-games';
  title: string;
  createGameHref: string;
  rows: GameRowViewModel[];
  loading: boolean;
  emptyText: string;
}

export interface PublicGamesWorkspaceStateViewModel {
  kind: 'public-games';
  title: string;
  createGameHref: string;
  rows: GameRowViewModel[];
  loading: boolean;
  emptyText: string;
}

export interface YourCharactersWorkspaceStateViewModel {
  kind: 'your-characters';
  title: string;
  newCharacterHref: string;
  rows: CharacterRowViewModel[];
  loading: boolean;
  emptyText: string;
}

export type ActionVariant = 'default' | 'destructive';

export interface LinkActionViewModel {
  kind: 'link';
  key: string;
  label: string;
  to: string;
  disabled: boolean;
  disabledReason: string | null;
  variant: ActionVariant;
}

export interface ButtonActionViewModel {
  kind: 'button';
  key: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: ActionVariant;
}

export type ActionViewModel = LinkActionViewModel | ButtonActionViewModel;

export interface ActionDeckViewModel {
  primary: ActionViewModel;
  secondary: ActionViewModel[];
  moreLabel: string;
}

export interface CharacterRowViewModel {
  key: string;
  characterName: string;
  status: string;
  actions: ActionDeckViewModel;
}

export interface GameRowViewModel {
  key: string;
  gameName: string;
  visibility: string;
  phaseLabel: GameplayLifecycle['phase'] | null;
  actions: ActionDeckViewModel;
}

export interface QuickStartAction {
  label: string;
  to: string;
}

export interface QuickStartViewModel {
  headline: string;
  detail: string;
  primaryAction: QuickStartAction;
  secondaryActions: QuickStartAction[];
}

const existingCharacterDisabledReason =
  'You already have a character in this game.';

const actionPriorityOrder = [
  'Lobby',
  'Play',
  'Chat',
  'Inbox',
  'Sheet',
  'Edit',
  'New Character',
  'Apply to Join',
  'GM Play',
  'Delete',
] as const;

const homeTabs: Array<{ id: HomeTabId; label: string }> = [
  { id: 'my-games', label: 'My Games' },
  { id: 'public-games', label: 'Public Games' },
  { id: 'your-characters', label: 'Your Characters' },
];

export const emptyDashboardState: DashboardState = {
  characters: [],
  myGames: [],
  gmGames: [],
  publicGames: [],
  pregameDigest: [],
  lifecycleByGameId: {},
};

export function parseHomeTab(value: string | null): HomeTabId | null {
  if (
    value === 'my-games' ||
    value === 'public-games' ||
    value === 'your-characters'
  ) {
    return value;
  }
  return null;
}

export function createHomeWorkspaceViewModel(input: {
  actorId: string;
  requestedTab: HomeTabId | null;
  hasJoinedGames: boolean;
  loading: boolean;
  characterRows: CharacterRowViewModel[];
  myGameRows: GameRowViewModel[];
  publicGameRows: GameRowViewModel[];
}): HomeWorkspaceViewModel {
  const activeTab =
    input.requestedTab ??
    (input.hasJoinedGames ? 'my-games' : 'public-games');
  const tabs = homeTabs.map((tab): HomeTabViewModel => ({
    ...tab,
    href: `/?tab=${tab.id}`,
    selected: tab.id === activeTab,
  }));

  return {
    tabs,
    active: createHomeWorkspaceState({
      activeTab,
      actorId: input.actorId,
      loading: input.loading,
      characterRows: input.characterRows,
      myGameRows: input.myGameRows,
      publicGameRows: input.publicGameRows,
    }),
  };
}

function createHomeWorkspaceState(input: {
  activeTab: HomeTabId;
  actorId: string;
  loading: boolean;
  characterRows: CharacterRowViewModel[];
  myGameRows: GameRowViewModel[];
  publicGameRows: GameRowViewModel[];
}): HomeWorkspaceStateViewModel {
  if (input.activeTab === 'my-games') {
    return {
      kind: 'my-games',
      title: 'My Games',
      createGameHref: '/gm/games',
      rows: input.myGameRows,
      loading: input.loading,
      emptyText: 'You are not in any games yet.',
    };
  }

  if (input.activeTab === 'your-characters') {
    return {
      kind: 'your-characters',
      title: 'Your Characters',
      newCharacterHref: `/player/${encodeURIComponent(input.actorId)}/character/new`,
      rows: input.characterRows,
      loading: input.loading,
      emptyText: 'No characters yet.',
    };
  }

  return {
    kind: 'public-games',
    title: 'Public Games',
    createGameHref: '/gm/games',
    rows: input.publicGameRows,
    loading: input.loading,
    emptyText: 'No public games found.',
  };
}

export function createQuickStartActionDeckViewModel(
  quickStart: QuickStartViewModel,
): ActionDeckViewModel {
  return {
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
  };
}

export function buildCharacterRows(input: {
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

export function buildMyGameRows(input: {
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
        key: `${game.gameId}:inbox`,
        label: 'Inbox',
        to: isGmGame ? `/inbox?mode=gm&gameId=${gameId}` : '/inbox?mode=player',
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

export function buildPublicGameRows(input: {
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
          key: `${game.gameId}:inbox`,
          label: 'Inbox',
          to: isGmGame ? `/inbox?mode=gm&gameId=${gameId}` : '/inbox?mode=player',
        }),
      );
    } else if (isGmGame) {
      secondaryActions.push(
        createLinkAction({
          key: `${game.gameId}:inbox`,
          label: 'Inbox',
          to: `/inbox?mode=gm&gameId=${gameId}`,
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

export function buildGameCharacterByGameId(
  characters: CharacterItem[],
): Map<string, CharacterItem> {
  const next = new Map<string, CharacterItem>();
  for (const character of characters) {
    if (
      isPlayerCharacterLibraryGameId(character.gameId) ||
      next.has(character.gameId)
    ) {
      continue;
    }
    next.set(character.gameId, character);
  }
  return next;
}

export function createQuickStartViewModel(input: {
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
