import { describe, expect, it } from 'vitest';
import { gameplayLoopGraph } from '@starter/shared';
import { getGameplayLoopFixture } from '@starter/shared/fixtures';
import {
  closeCombat,
  computeAttackResolution,
  computeCheckResolution,
  declareCombatAction,
  deriveCombatantFromProfile,
  openCombatRound,
  resolveCombatTurn,
  resolveGameplayCheck,
  seedGameplaySession,
  selectGameplayProcedure,
} from './gameplay.js';

function makeCombatProfile(
  overrides?: Partial<Parameters<typeof deriveCombatantFromProfile>[0]>
): Parameters<typeof deriveCombatantFromProfile>[0] {
  return {
    actorId: 'player-1',
    characterId: 'char-1',
    identityName: 'Ducard Sample II',
    abilities: { agi: 9, int: 8, lf: 12 },
    bonuses: { dex: 2, agi: 1, str: 2 },
    skills: [{ skill: 'Fighter', level: 2 }, { skill: 'Sage', level: 1 }],
    fallbackDisplayName: null,
    ...overrides,
  };
}

function toSceneSeed(fixture = getGameplayLoopFixture('rpg_sample_tavern')) {
  return {
    scenarioId: fixture.seedId,
    sceneTitle: fixture.scene.title,
    sceneSummary: fixture.scene.summary,
    focusPrompt: fixture.scene.focus_prompt,
    enemies: fixture.enemies.map((enemy) => ({
      combatantId: enemy.combatantId,
      displayName: enemy.displayName,
      lifePoints: enemy.lifePoints,
      stats: enemy.stats,
    })),
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
  it('seeds the tavern scene from host-provided scene data and derives player combatants', () => {
    const playerCombatant = deriveCombatantFromProfile(makeCombatProfile());
    const seeded = seedGameplaySession({
      scene: toSceneSeed(),
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
    const seeded = seedGameplaySession({
      scene: toSceneSeed(),
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [deriveCombatantFromProfile(makeCombatProfile())],
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
    const seeded = seedGameplaySession({
      scene: toSceneSeed(),
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [
        deriveCombatantFromProfile(makeCombatProfile()),
        deriveCombatantFromProfile(
          makeCombatProfile({
            actorId: 'player-2',
            characterId: 'char-2',
            identityName: 'Borin',
            abilities: { agi: 12, int: 6, lf: 11 },
            bonuses: { dex: 1, agi: 2, str: 2 },
            skills: [{ skill: 'Fighter', level: 1 }],
          })
        ),
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

    const seeded = seedGameplaySession({
      scene: toSceneSeed(),
      createdAt: '2026-04-01T00:00:00.000Z',
      playerCombatants: [deriveCombatantFromProfile(makeCombatProfile())],
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
