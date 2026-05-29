import { describe, expect, it, vi } from 'vitest';
import type { CharacterItem, GameItem } from '../../api/ApiClient';
import {
  buildCharacterRows,
  buildGameCharacterByGameId,
  buildMyGameRows,
  createHomeWorkspaceViewModel,
  emptyDashboardState,
  parseHomeTab,
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
