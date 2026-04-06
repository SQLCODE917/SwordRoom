import { describe, expect, it } from 'vitest';
import { gameplayLoopGraph, type CharacterItem } from '@starter/shared';
import { getGameplayLoopFixture } from '@starter/shared/fixtures';
import {
  closeCombat,
  computeAttackResolution,
  computeCheckResolution,
  declareCombatAction,
  deriveCombatantFromCharacter,
  openCombatRound,
  resolveCombatTurn,
  resolveGameplayCheck,
  seedGameplaySession,
  selectGameplayProcedure,
} from './gameplay.js';

function makeCharacter(overrides?: Partial<CharacterItem>): CharacterItem {
  return {
    pk: 'GAME#game-1',
    sk: 'CHAR#char-1',
    type: 'Character',
    gameId: 'game-1',
    characterId: 'char-1',
    ownerPlayerId: 'player-1',
    status: 'APPROVED',
    draft: {
      race: 'HUMAN',
      raisedBy: null,
      subAbility: { A: 6, B: 4, C: 5, D: 4, E: 4, F: 6, G: 4, H: 5 },
      ability: { dex: 10, agi: 9, int: 8, str: 10, lf: 12, mp: 9 },
      bonus: { dex: 2, agi: 1, int: 1, str: 2, lf: 2, mp: 1 },
      background: { kind: 'RUNE_MASTER', roll2d: 3 },
      starting: { expTotal: 2000, expUnspent: 1000, moneyGamels: 1800, moneyRoll2d: 9, startingSkills: [] },
      skills: [{ skill: 'Fighter', level: 2 }, { skill: 'Sage', level: 1 }],
      purchases: { weapons: [], armor: [], shields: [], gear: [] },
      appearance: { imageKey: null, imageUrl: null, updatedAt: null },
      identity: { name: 'Ducard Sample II', age: 24, gender: 'M' },
      noteToGm: null,
      gmNote: null,
    },
    submittedAt: null,
    submittedDraftVersion: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('gameplay graph', () => {
  it('covers the documented scene -> intent -> procedure -> combat flow', () => {
    expect(gameplayLoopGraph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(['SCENE_FRAME', 'PLAYER_INTENT', 'PROCEDURE_SELECTION', 'COMBAT_ROUND', 'DAMAGE'])
    );
    expect(gameplayLoopGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'SCENE_FRAME', to: 'PLAYER_INTENT' }),
        expect.objectContaining({ from: 'PROCEDURE_SELECTION', to: 'STANDARD_CHECK' }),
        expect.objectContaining({ from: 'COMBAT_ROUND', to: 'WEAPON_ATTACK' }),
      ])
    );
  });
});

describe('gameplay checks', () => {
  it('handles standard checks with baseline 0 and automatic results', () => {
    expect(
      computeCheckResolution({
        procedure: 'STANDARD_CHECK',
        baselineScore: 0,
        modifiers: 0,
        targetScore: 7,
        difficulty: null,
        playerRollTotal: 12,
        gmRollTotal: null,
      })
    ).toEqual({ outcome: 'SUCCESS', automaticResult: 'DOUBLE_SIX' });

    expect(
      computeCheckResolution({
        procedure: 'STANDARD_CHECK',
        baselineScore: 0,
        modifiers: 0,
        targetScore: 7,
        difficulty: null,
        playerRollTotal: 2,
        gmRollTotal: null,
      })
    ).toEqual({ outcome: 'FAILURE', automaticResult: 'DOUBLE_ONE' });
  });

  it('handles difficulty checks against a secret target', () => {
    const result = computeCheckResolution({
      procedure: 'DIFFICULTY_CHECK',
      baselineScore: 3,
      modifiers: 0,
      targetScore: null,
      difficulty: 5,
      playerRollTotal: 7,
      gmRollTotal: 6,
    });

    expect(result).toEqual({ outcome: 'FAILURE', automaticResult: null });
  });
});

describe('gameplay session', () => {
  it('seeds the tavern scene from fixtures and derives player combatants', () => {
    const fixture = getGameplayLoopFixture('rpg_sample_tavern');
    const playerCombatant = deriveCombatantFromCharacter({
      actorId: 'player-1',
      character: makeCharacter(),
      fallbackDisplayName: 'Player One',
    });
    const seeded = seedGameplaySession({
      fixture,
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [playerCombatant],
    });

    expect(seeded.errors).toEqual([]);
    expect(seeded.state.sceneTitle).toBe('Tavern At Sundown');
    expect(seeded.state.currentNodeId).toBe('PLAYER_INTENT');
    expect(seeded.state.combatants.map((combatant) => combatant.displayName)).toEqual(
      expect.arrayContaining(['Ducard Sample II', 'Brando Boss'])
    );
  });

  it('selects and resolves a public check', () => {
    const fixture = getGameplayLoopFixture('rpg_sample_tavern');
    const seeded = seedGameplaySession({
      fixture,
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [deriveCombatantFromCharacter({ actorId: 'player-1', character: makeCharacter() })],
    }).state;
    const selected = selectGameplayProcedure(seeded, {
      procedure: 'STANDARD_CHECK',
      actionLabel: 'Warn the thugs',
      baselineScore: 4,
      modifiers: 0,
      targetScore: 10,
      updatedAt: '2026-04-01T00:01:00.000Z',
    }).state;
    const resolved = resolveGameplayCheck(selected, {
      procedure: 'STANDARD_CHECK',
      actionLabel: 'Warn the thugs',
      baselineScore: 4,
      modifiers: 0,
      targetScore: 10,
      playerRollTotal: 8,
      publicNarration: 'The warning lands with confidence.',
      updatedAt: '2026-04-01T00:02:00.000Z',
    });

    expect(selected.currentNodeId).toBe('STANDARD_CHECK');
    expect(resolved.state.activeCheck?.outcome).toBe('SUCCESS');
    expect(resolved.state.currentNodeId).toBe('SCENE_FRAME');
  });
});

describe('combat flow', () => {
  it('orders announcements by Intelligence and resolution by Agility with delay support', () => {
    const fixture = getGameplayLoopFixture('rpg_sample_tavern');
    const seeded = seedGameplaySession({
      fixture,
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [
        deriveCombatantFromCharacter({ actorId: 'player-1', character: makeCharacter() }),
        deriveCombatantFromCharacter({
          actorId: 'player-2',
          character: makeCharacter({
            characterId: 'char-2',
            draft: {
              ...makeCharacter().draft,
              identity: { name: 'Borin', age: 21, gender: 'M' },
              ability: { dex: 8, agi: 12, int: 6, str: 10, lf: 11, mp: 6 },
              bonus: { dex: 1, agi: 2, int: 1, str: 2, lf: 1, mp: 1 },
              skills: [{ skill: 'Fighter', level: 1 }],
            },
          }),
        }),
      ],
    }).state;

    const opened = openCombatRound(seeded, {
      updatedAt: '2026-04-01T00:03:00.000Z',
    }).state;
    const round = opened.combat?.rounds[0];
    expect(round?.announcementOrder.length).toBeGreaterThan(0);
    expect(round?.resolutionOrder.length).toBeGreaterThan(0);

    const withAction = declareCombatAction(opened, {
      roundNumber: 1,
      actorCombatantId: 'char-1',
      actorId: 'player-1',
      targetCombatantId: 'brando-boss',
      actionType: 'ATTACK',
      movementMode: 'NORMAL',
      delayToOrderZero: false,
      summary: 'Charge with a sword',
      announcedAt: '2026-04-01T00:03:30.000Z',
    }).state;
    const delayed = declareCombatAction(withAction, {
      roundNumber: 1,
      actorCombatantId: 'char-2',
      actorId: 'player-2',
      targetCombatantId: 'brando-thug-1',
      actionType: 'ATTACK',
      movementMode: 'NORMAL',
      delayToOrderZero: true,
      summary: 'Hold until the end of the round',
      announcedAt: '2026-04-01T00:03:40.000Z',
    }).state;

    expect(delayed.combat?.rounds[0]?.resolutionOrder.at(-1)).toBe('char-2');
  });

  it('resolves a hit, applies damage, and closes combat into aftermath', () => {
    expect(
      computeAttackResolution({
        attackContext: 'CHARACTER_TO_MONSTER',
        attackerBase: 4,
        attackerRollTotal: 8,
        fixedTargetScore: 10,
        defenderBase: null,
        defenderRollTotal: null,
        baseDamage: 7,
        bonusDamage: 2,
        defenseValue: 1,
        damageReduction: 0,
      })
    ).toEqual({ hit: true, damage: 8 });

    const fixture = getGameplayLoopFixture('rpg_sample_tavern');
    const seeded = seedGameplaySession({
      fixture,
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [deriveCombatantFromCharacter({ actorId: 'player-1', character: makeCharacter() })],
    }).state;
    const opened = openCombatRound(seeded, { updatedAt: '2026-04-01T00:03:00.000Z' }).state;
    const acted = declareCombatAction(opened, {
      roundNumber: 1,
      actorCombatantId: 'char-1',
      actorId: 'player-1',
      targetCombatantId: 'brando-boss',
      actionType: 'ATTACK',
      movementMode: 'NORMAL',
      delayToOrderZero: false,
      summary: 'Attack the Brando Boss',
      announcedAt: '2026-04-01T00:03:30.000Z',
    }).state;
    const resolved = resolveCombatTurn(acted, {
      roundNumber: 1,
      actionId: 'char-1:1',
      actorCombatantId: 'char-1',
      targetCombatantId: 'brando-boss',
      attackContext: 'CHARACTER_TO_MONSTER',
      attackerBase: 4,
      attackerRollTotal: 8,
      fixedTargetScore: 10,
      baseDamage: 7,
      bonusDamage: 2,
      defenseValue: 1,
      damageReduction: 0,
      updatedAt: '2026-04-01T00:04:00.000Z',
    }).state;
    const closed = closeCombat(resolved, {
      summary: 'The tavern goes quiet after the last thug falls back.',
      updatedAt: '2026-04-01T00:05:00.000Z',
    }).state;

    expect(resolved.combatants.find((combatant) => combatant.combatantId === 'brando-boss')?.lifePoints).toBe(10);
    expect(closed.currentNodeId).toBe('AFTERMATH');
    expect(closed.combat?.aftermathSummary).toContain('tavern');
  });
});
