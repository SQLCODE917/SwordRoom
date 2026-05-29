import { describe, expect, it, vi } from 'vitest';
import type { CharacterItem, GameItem } from '../../api/ApiClient';
import {
  buildCharacterRows,
  buildGameCharacterByGameId,
  buildMyGameRows,
  createHomeWorkspaceViewModel,
  createNextMoveViewModel,
  emptyDashboardState,
  parseHomeTab,
  type DashboardState,
} from './viewModel';

function createGame(overrides?: Partial<GameItem>): GameItem {
  return {
    gameId: 'game-1',
    name: 'Game One',
    visibility: 'PUBLIC',
    gmPlayerId: 'gm-1',
    version: 1,
    ...overrides,
  };
}

function createCharacter(overrides?: Partial<CharacterItem>): CharacterItem {
  return {
    gameId: 'game-1',
    characterId: 'char-1',
    ownerPlayerId: 'player-1',
    status: 'DRAFT',
    draft: {
      identity: {
        name: 'Test Hero',
      },
    },
    ...overrides,
  };
}

describe('home view model', () => {
  it('parses supported deep-link tabs and rejects unknown values', () => {
    expect(parseHomeTab('my-games')).toBe('my-games');
    expect(parseHomeTab('public-games')).toBe('public-games');
    expect(parseHomeTab('your-characters')).toBe('your-characters');
    expect(parseHomeTab('characters')).toBeNull();
    expect(parseHomeTab(null)).toBeNull();
  });

  it('defaults to Public Games when the player has no joined games', () => {
    const workspace = createHomeWorkspaceViewModel({
      actorId: 'player-1',
      requestedTab: null,
      hasJoinedGames: false,
      loading: false,
      characterRows: [],
      myGameRows: [],
      publicGameRows: [],
    });

    expect(workspace.active.kind).toBe('public-games');
    expect(workspace.tabs.find((tab) => tab.id === 'public-games')?.selected).toBe(
      true,
    );
  });

  it('defaults to My Games when the player has joined games', () => {
    const workspace = createHomeWorkspaceViewModel({
      actorId: 'player-1',
      requestedTab: null,
      hasJoinedGames: true,
      loading: false,
      characterRows: [],
      myGameRows: [],
      publicGameRows: [],
    });

    expect(workspace.active.kind).toBe('my-games');
    expect(workspace.tabs.find((tab) => tab.id === 'my-games')?.selected).toBe(
      true,
    );
  });

  it('honors a requested tab over the default state', () => {
    const workspace = createHomeWorkspaceViewModel({
      actorId: 'player-1',
      requestedTab: 'your-characters',
      hasJoinedGames: true,
      loading: false,
      characterRows: [],
      myGameRows: [],
      publicGameRows: [],
    });

    expect(workspace.active).toMatchObject({
      kind: 'your-characters',
      title: 'Your Characters',
      newCharacterHref: '/player/player-1/character/new',
    });
  });

  it('uses digest data for the resume next move', () => {
    const dashboard: DashboardState = {
      ...emptyDashboardState,
      pregameDigest: [
        {
          digestId: 'game-1:edit',
          gameId: 'game-1',
          gameName: 'Goblin Cave',
          headline: 'Party needs Frontline',
          detail: 'Your draft can still move toward Frontline.',
          destination: 'EDIT_CHARACTER',
          characterId: 'char-1',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
    };

    const nextMove = createNextMoveViewModel({
      actorId: 'player-1',
      dashboard,
      joinedGameIds: new Set(),
      gmGameIds: new Set(),
      gameCharacterByGameId: new Map(),
    });

    expect(nextMove).toMatchObject({
      kind: 'resume-planning',
      title: 'Next Move',
      headline: 'Continue in Goblin Cave',
      detail: 'Party needs Frontline',
      primaryAction: {
        label: 'Edit Draft',
        to: '/games/game-1/characters/char-1/edit?entry=digest&focus=resume',
      },
    });
  });

  it('uses public game data for the join next move', () => {
    const dashboard: DashboardState = {
      ...emptyDashboardState,
      publicGames: [createGame({ gameId: 'game-public', name: 'Goblin Cave' })],
    };

    const nextMove = createNextMoveViewModel({
      actorId: 'player-1',
      dashboard,
      joinedGameIds: new Set(),
      gmGameIds: new Set(),
      gameCharacterByGameId: new Map(),
    });
    expect(nextMove).toMatchObject({
      kind: 'join-public-game',
      title: 'Next Move',
      headline: 'Goblin Cave is open',
      detail: 'Create a draft to join the table.',
      primaryAction: {
        label: '+ Create Character',
        to: '/games/game-public/character/new?entry=home&focus=start',
      },
      secondaryActions: [
        {
          label: 'Saved Character',
          to: '/player/player-1/character/new',
          disabled: true,
          disabledReason: 'No saved characters yet.',
        },
      ],
    });
  });

  it('enables the saved character next move when a saved character exists', () => {
    const dashboard: DashboardState = {
      ...emptyDashboardState,
      publicGames: [createGame({ gameId: 'game-public', name: 'Goblin Cave' })],
      characters: [
        createCharacter({
          gameId: 'PLAYER_CHARACTER_LIBRARY::player-1',
          characterId: 'saved-1',
        }),
      ],
    };

    const nextMove = createNextMoveViewModel({
      actorId: 'player-1',
      dashboard,
      joinedGameIds: new Set(),
      gmGameIds: new Set(),
      gameCharacterByGameId: new Map(),
    });

    expect(nextMove.secondaryActions).toContainEqual({
      label: 'Saved Character',
      to: '/player/player-1/character/new',
      disabled: false,
      disabledReason: null,
    });
  });

  it('uses joined game data for the create-for-game next move', () => {
    const dashboard: DashboardState = {
      ...emptyDashboardState,
      myGames: [createGame({ gameId: 'game-local', name: 'Local Demo Game' })],
    };

    const nextMove = createNextMoveViewModel({
      actorId: 'player-1',
      dashboard,
      joinedGameIds: new Set(['game-local']),
      gmGameIds: new Set(),
      gameCharacterByGameId: new Map(),
    });

    expect(nextMove).toMatchObject({
      kind: 'create-for-game',
      title: 'Next Move',
      headline: 'Local Demo Game needs your character',
      detail: 'No character from you yet.',
      primaryAction: {
        label: '+ Create Character',
        to: '/games/game-local/character/new?entry=home&focus=start',
      },
    });
  });

  it('uses start-table next move when there is no active game path', () => {
    const nextMove = createNextMoveViewModel({
      actorId: 'player-1',
      dashboard: emptyDashboardState,
      joinedGameIds: new Set(),
      gmGameIds: new Set(),
      gameCharacterByGameId: new Map(),
    });

    expect(nextMove).toMatchObject({
      kind: 'start-table',
      title: 'Next Move',
      headline: 'Start a table',
      detail: 'Create a game or make a saved character.',
      primaryAction: {
        label: '+ Create Game',
        to: '/gm/games',
      },
    });
  });

  it('uses live play as the dominant action for live games', () => {
    const rows = buildMyGameRows({
      games: [createGame({ gameId: 'game-live', name: 'Live Game' })],
      gmGameIds: new Set(),
      characterByGameId: new Map(),
      lifecycleByGameId: {
        'game-live': 'LIVE',
      },
      archivingGameId: null,
      isRunningCommand: false,
      onArchiveGame: vi.fn(),
    });

    expect(rows[0]?.actions.primary).toMatchObject({
      kind: 'link',
      label: 'Continue Play',
      to: '/games/game-live/play',
    });
  });

  it('disables game-scoped character creation when a character already exists', () => {
    const character = createCharacter({
      gameId: 'game-1',
      characterId: 'char-game',
    });
    const rows = buildMyGameRows({
      games: [createGame()],
      gmGameIds: new Set(),
      characterByGameId: new Map([['game-1', character]]),
      lifecycleByGameId: {},
      archivingGameId: null,
      isRunningCommand: false,
      onArchiveGame: vi.fn(),
    });

    const newCharacterAction = rows[0]?.actions.secondary.find(
      (action) => action.label === 'New Character',
    );
    expect(newCharacterAction).toMatchObject({
      disabled: true,
      disabledReason: 'You already have a character in this game.',
    });
  });

  it('keeps library characters out of the game-character lookup', () => {
    const gameCharacter = createCharacter({
      gameId: 'game-1',
      characterId: 'char-game',
    });
    const libraryCharacter = createCharacter({
      gameId: 'PLAYER_CHARACTER_LIBRARY::player-1',
      characterId: 'char-library',
    });

    const byGameId = buildGameCharacterByGameId([
      libraryCharacter,
      gameCharacter,
    ]);

    expect(byGameId.get('game-1')).toBe(gameCharacter);
    expect(byGameId.has('PLAYER_CHARACTER_LIBRARY::player-1')).toBe(false);
  });

  it('marks game characters as removable but not library characters', () => {
    const onRemoveCharacter = vi.fn();
    const rows = buildCharacterRows({
      characters: [
        createCharacter({ gameId: 'game-1', characterId: 'char-game' }),
        createCharacter({
          gameId: 'PLAYER_CHARACTER_LIBRARY::player-1',
          characterId: 'char-library',
        }),
      ],
      isRunningCommand: false,
      removingCharacterId: null,
      onRemoveCharacter,
    });

    expect(
      rows[0]?.actions.secondary.some((action) => action.label === 'Leave Game'),
    ).toBe(true);
    expect(
      rows[1]?.actions.secondary.some((action) => action.label === 'Leave Game'),
    ).toBe(false);
  });

  it('exports an empty dashboard state for the connected page', () => {
    expect(emptyDashboardState).toMatchObject({
      characters: [],
      myGames: [],
      gmGames: [],
      publicGames: [],
      pregameDigest: [],
      lifecycleByGameId: {},
    });
  });
});
